"""Build immutable US-only public place packs; no JourneyDeck user data is input."""
import argparse
import gzip
import hashlib
import json
import math
import re
import sqlite3
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / '.cache/places-lab-python'))
SCALE = 50  # .02 degree cells, with a 250 m halo baked into each download.
MAX_JSON_BYTES = 4_000_000


def cells(lon, lat):
    dy = 250 / 110_000
    dx = dy / max(.01, math.cos(math.radians(lat)))
    for y in range(max(0, math.floor((lat-dy+90)*SCALE)), min(8999, math.floor((lat+dy+90)*SCALE))+1):
        for x in range(math.floor((lon-dx+180)*SCALE), math.floor((lon+dx+180)*SCALE)+1):
            yield y, x % 18000


def extract(output, release, local_files=None):
    import duckdb
    db = duckdb.connect()
    db.execute("SET memory_limit='1GB'; SET threads=4; SET http_timeout=120;")
    if local_files:
        # Local preparation must not install extensions or re-download source data.
        db.execute('LOAD spatial')
        source = [str(Path(path).resolve()) for path in local_files]
    else:
        db.execute('INSTALL httpfs; LOAD httpfs; INSTALL spatial; LOAD spatial;')
        db.execute("SET s3_region='us-west-2'")
        source = f's3://overturemaps-us-west-2/release/{release}/theme=places/type=place/*.parquet'
    # Country is explicit source data, not a rectangle that admits Canada/Mexico.
    # Missing country/status/confidence is deliberately left to Apple's fallback.
    sql = """SELECT id, names.primary AS name, ST_X(geometry) AS lon, ST_Y(geometry) AS lat,
        categories.primary AS category, confidence,
        list_sort(list_distinct(list_transform(sources, s -> s.dataset))) AS sources
        FROM read_parquet(?) WHERE (
          (bbox.xmin BETWEEN -125 AND -66 AND bbox.ymin BETWEEN 24 AND 50)
          OR ((bbox.xmin BETWEEN -180 AND -129 OR bbox.xmin BETWEEN 170 AND 180) AND bbox.ymin BETWEEN 50 AND 72)
          OR (bbox.xmin BETWEEN -179 AND -154 AND bbox.ymin BETWEEN 18 AND 29)
        ) AND list_contains(list_transform(addresses, a -> a.country), 'US')
        AND names.primary IS NOT NULL AND length(trim(names.primary)) BETWEEN 1 AND 200
        AND confidence >= 0.7 AND operating_status = 'open'"""
    # Arrow streaming prevents the national directory from accumulating in RAM.
    reader = db.execute(sql, [source]).to_arrow_reader(batch_size=10000)
    import pyarrow.parquet as pq
    count, reported = 0, time.monotonic()
    with pq.ParquetWriter(output, reader.schema, compression='zstd') as writer:
        for batch in reader:
            writer.write_batch(batch)
            count += batch.num_rows
            if time.monotonic() - reported >= 30:
                print(f'Extracted {count:,} US places...', flush=True)
                reported = time.monotonic()
    print(f'Extraction complete: {count:,} US places.', flush=True)
    db.close()
    with Path(output).open('rb') as finished:
        checksum = hashlib.file_digest(finished, 'sha256').hexdigest()
    Path(str(output)+'.complete.json').write_text(json.dumps(dict(schema=1, release=release,
        country='US', rows=count, bytes=Path(output).stat().st_size, sha256=checksum)), encoding='utf-8')


def pack(source, output, release, native_fallback_on_overflow=False):
    import pyarrow.parquet as pq
    if output.exists() and any(output.iterdir()):
        raise RuntimeError('Use a fresh output directory; existing releases are immutable.')
    output.mkdir(parents=True, exist_ok=True)
    temporary = output / 'packing.sqlite'
    if temporary.exists():
        raise RuntimeError('Use a fresh output directory; existing releases are immutable.')
    db = sqlite3.connect(temporary)
    try:
        db.execute('PRAGMA journal_mode=OFF')
        db.execute('CREATE TABLE points (band INTEGER, tile TEXT, row TEXT)')
        count = 0
        sources = set()
        for batch in pq.ParquetFile(source).iter_batches(batch_size=10000):
            inserts = []
            for row in batch.to_pylist():
                lon, lat = row['lon'], row['lat']
                if not math.isfinite(lon) or not math.isfinite(lat) or not (-180 <= lon < 180 and -90 < lat < 90):
                    raise ValueError('Invalid public place geometry')
                value = [row['id'], row['name'].strip(), lon, lat, row['category'] or '', row['confidence']]
                encoded = json.dumps(value, ensure_ascii=False, separators=(',', ':'))
                sources.update(row['sources'] or [])
                inserts.extend((y//50, f'{y}_{x}', encoded) for y, x in cells(lon, lat))
                count += 1
            db.executemany('INSERT INTO points VALUES(?,?,?)', inserts)
            db.commit()
            if count % 500000 == 0:
                print(f'Grouped {count:,} US places...', flush=True)
        db.execute('CREATE INDEX tile_order ON points(band,tile)')
        directory = output / 'bands'
        directory.mkdir()
        manifest = dict(schema=1, release=release, country='US', cellDegrees=.02, haloMeters=250,
                        placeCount=count, sources=sorted(sources), bands={}, tileCount=0,
                        attribution='Overture Maps Foundation and contributors',
                        licenses=['CDLA-Permissive-2.0', 'Apache-2.0', 'CC0-1.0'], nativeFallbackTiles={})
        for (band,) in db.execute('SELECT DISTINCT band FROM points ORDER BY band').fetchall():
            index = {}
            with (directory / f'{band}.bin').open('wb') as destination:
                current, rows = None, []

                def flush():
                    if current is None:
                        return
                    payload = ('{"schema":1,"release":'+json.dumps(release)+',"tile":'+json.dumps(current)+',"places":['+','.join(rows)+']}').encode()
                    if len(payload) > MAX_JSON_BYTES or len(rows) > 20000:
                        if native_fallback_on_overflow:
                            # Never truncate candidates: doing so can manufacture an
                            # unambiguous nearest match. Missing tile uses MapKit.
                            manifest['nativeFallbackTiles'][current] = dict(places=len(rows), decodedBytes=len(payload), reason='mobile-tile-limit')
                            print(f'Tile {current}: {len(rows):,} candidates; retained native fallback.', flush=True)
                            return
                        raise ValueError('Public tile exceeds mobile download limit; do not publish this release')
                    compressed = gzip.compress(payload, mtime=0)
                    index[current] = [destination.tell(), len(compressed)]
                    destination.write(compressed)

                for tile, row in db.execute('SELECT tile,row FROM points WHERE band=? ORDER BY tile', (band,)):
                    if tile != current:
                        flush()
                        current, rows = tile, []
                    rows.append(row)
                flush()
            index_bytes = json.dumps(index, separators=(',', ':')).encode()
            if len(index_bytes) > 4_000_000:
                raise ValueError('Band index exceeds worker limit')
            (directory / f'{band}.json').write_bytes(index_bytes)
            manifest['bands'][str(band)] = dict(tiles=len(index), bytes=(directory / f'{band}.bin').stat().st_size,
                indexSha256=hashlib.sha256(index_bytes).hexdigest())
            manifest['tileCount'] += len(index)
    finally:
        db.close()
    temporary.unlink()  # Only our freshly created temporary database.
    (output / 'manifest.json').write_text(json.dumps(manifest, indent=2), encoding='utf-8')
    print(json.dumps(dict(places=count, tiles=manifest['tileCount'], bands=len(manifest['bands']),
                         bytes=sum(p.stat().st_size for p in output.rglob('*') if p.is_file()))), flush=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--release', required=True)
    parser.add_argument('--output', required=True, type=Path)
    parser.add_argument('--extract-only', action='store_true')
    parser.add_argument('--source', type=Path, help='Previously extracted US parquet')
    args = parser.parse_args()
    if not re.fullmatch(r'20\d\d-\d\d-\d\d\.\d+', args.release):
        parser.error('Invalid Overture release')
    args.output.parent.mkdir(parents=True, exist_ok=True)
    source = args.source or args.output.parent / f'us-{args.release}.parquet'
    if args.source:
        marker = Path(str(source)+'.complete.json')
        if not marker.exists():
            parser.error('Missing extraction completion marker; do not reuse an interrupted download')
        metadata = json.loads(marker.read_text(encoding='utf-8'))
        with source.open('rb') as completed:
            checksum = hashlib.file_digest(completed, 'sha256').hexdigest()
        if metadata.get('release') != args.release or metadata.get('country') != 'US' or metadata.get('sha256') != checksum:
            parser.error('Completed source does not match the requested release')
    if not args.source:
        if source.exists():
            parser.error('Extract already exists; pass --source to reuse it')
        print('Extracting confirmed US open places from public Overture data...', flush=True)
        extract(source, args.release)
    if not args.extract_only:
        pack(source, args.output, args.release)


if __name__ == '__main__':
    main()
