"""Validate local official shards and prepare a complete package. No upload path."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import shutil
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET

from build import extract, pack
from publish import validate
import pyarrow.parquet as pq

ROOT = Path(__file__).resolve().parents[2]


def digest(path):
    with path.open('rb') as handle:
        return hashlib.file_digest(handle, 'sha256').hexdigest()


def official_inventory(release):
    prefix = f'release/{release}/theme=places/type=place/'
    query = urllib.parse.urlencode({'list-type': '2', 'prefix': prefix})
    url = 'https://overturemaps-us-west-2.s3.us-west-2.amazonaws.com/?' + query
    with urllib.request.urlopen(url, timeout=60) as response:
        xml = response.read(4_000_001)
    if len(xml) > 4_000_000:
        raise ValueError('Unexpectedly large source inventory')
    root = ET.fromstring(xml)
    ns = {'s': 'http://s3.amazonaws.com/doc/2006-03-01/'}
    if root.findtext('s:IsTruncated', namespaces=ns) != 'false':
        raise ValueError('Incomplete source inventory')
    result = {}
    for item in root.findall('s:Contents', ns):
        key = item.findtext('s:Key', namespaces=ns)
        if key.endswith('.parquet'):
            result[Path(key).name] = {'bytes': int(item.findtext('s:Size', namespaces=ns)), 'etag': item.findtext('s:ETag', namespaces=ns)}
    if not result:
        raise ValueError('No official source shards')
    return result


def validate_sources(directory, expected):
    actual = {p.name: p for p in directory.glob('*.parquet')}
    if set(actual) != set(expected):
        raise ValueError(f'Shard set mismatch: missing={sorted(set(expected)-set(actual))}, extra={sorted(set(actual)-set(expected))}')
    results = []
    for name in sorted(actual):
        path = actual[name]
        before = path.stat()
        if before.st_size != expected[name]['bytes']:
            raise ValueError(f'Source size mismatch: {name}')
        parquet = pq.ParquetFile(path, page_checksum_verification=True)
        count = 0
        # Decode every column/page rather than trusting only the Parquet footer.
        for batch in parquet.iter_batches(batch_size=16384):
            batch.validate(full=True)
            count += batch.num_rows
        if count != parquet.metadata.num_rows:
            raise ValueError(f'Source row count mismatch: {name}')
        checksum = digest(path)
        after = path.stat()
        if (before.st_size, before.st_mtime_ns) != (after.st_size, after.st_mtime_ns):
            raise ValueError(f'Source changed during validation: {name}')
        results.append(dict(file=name, bytes=before.st_size, rows=count, sha256=checksum, upstreamEtag=expected[name]['etag'], mtimeNs=before.st_mtime_ns))
        print(f'Validated {len(results)}/{len(actual)} shards: {count:,} rows', flush=True)
    return results


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input', required=True, type=Path)
    parser.add_argument('--output', required=True, type=Path, help='Fresh preparation directory')
    parser.add_argument('--release', required=True)
    parser.add_argument('--resume-extraction', action='store_true', help='Verify and reuse a completed extraction; create a fresh ready package')
    args = parser.parse_args()
    if not re.fullmatch(r'20\d\d-\d\d-\d\d\.\d+', args.release):
        parser.error('Invalid release')
    if args.output.exists() and not args.resume_extraction:
        parser.error('Preparation directory must be new; prior work is preserved')
    raw = args.output / f'us-{args.release}.parquet'
    if args.resume_extraction:
        report = json.loads((args.output / 'source-validation.json').read_text(encoding='utf-8'))
        marker = json.loads(Path(str(raw)+'.complete.json').read_text(encoding='utf-8'))
        if report['release'] != args.release or marker['release'] != args.release or marker['country'] != 'US' or marker['sha256'] != digest(raw) or marker['rows'] != pq.ParquetFile(raw).metadata.num_rows:
            raise ValueError('Completed extraction verification failed')
        sources = report['files']
        print('Completed extraction checksum and row count verified; reusing it.', flush=True)
    else:
        expected = official_inventory(args.release)
        args.output.mkdir(parents=True)
        print(f'Official release lists {len(expected)} shards. Validating all local pages and hashes...', flush=True)
        sources = validate_sources(args.input, expected)
        (args.output / 'source-validation.json').write_text(json.dumps(dict(release=args.release, files=sources, upstreamNamesAndSizesMatched=True,
            note='SHA-256 computed locally; S3 multipart ETags are provenance, not SHA-256 checksums.'), indent=2), encoding='utf-8')
        print('Extracting U.S. places from validated local shards...', flush=True)
        extract(raw, args.release, [args.input / entry['file'] for entry in sources])
    for entry in sources:
        stat = (args.input / entry['file']).stat()
        if (stat.st_size, stat.st_mtime_ns) != (entry['bytes'], entry['mtimeNs']):
            raise ValueError('Source changed during extraction; package not prepared')
    output = args.output / (args.release + ('-ready' if args.resume_extraction else ''))
    print('Packing U.S. tiles...', flush=True)
    pack(raw, output, args.release, native_fallback_on_overflow=True)
    print('Validating every packed gzip member and byte range...', flush=True)
    manifest, files = validate(output)
    shutil.copyfile(ROOT / 'mobile/recorder/assets/overture-licenses.json', output / 'licenses.json')
    shutil.copyfile(ROOT / 'tools/overture-us/NOTICE.txt', output / 'NOTICE.txt')
    files += [output / 'licenses.json', output / 'NOTICE.txt', output / 'manifest.json']
    inventory = [dict(file=path.relative_to(output).as_posix(), bytes=path.stat().st_size, sha256=digest(path),
                      objectKey=f'us/v1/{args.release}/{path.relative_to(output).as_posix()}') for path in files]
    summary = dict(release=args.release, places=manifest['placeCount'], tiles=manifest['tileCount'], bands=len(manifest['bands']),
                   uploadBytes=sum(item['bytes'] for item in inventory), objects=inventory, nativeFallbackTiles=manifest.get('nativeFallbackTiles', {}), uploaded=False)
    (args.output / 'upload-plan.json').write_text(json.dumps(summary, indent=2), encoding='utf-8')
    (args.output / 'README.txt').write_text(
        f'Validated local U.S. POI upload package: {args.release}\n'
        f'Upload directory: {output.name}/\n'
        'Nothing has been uploaded. Upload-plan.json lists object keys, sizes and SHA-256 hashes.\n'
        'Upload band packs/indexes and both license files first; manifest.json must be LAST.\n'
        'Do not upload raw extracted Parquet, validation reports, or this preparation directory wholesale.\n'
        'Keep the existing immutable release and activate only after separately authorized upload/testing.\n', encoding='utf-8')
    print(json.dumps({k: v for k, v in summary.items() if k != 'objects'}), flush=True)


if __name__ == '__main__':
    main()
