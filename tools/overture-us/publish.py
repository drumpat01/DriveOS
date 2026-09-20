"""Validate and upload immutable public packs via the signed-in Wrangler CLI.

Uploads a manifest last. Does not activate a Worker release or purchase storage.
"""
import argparse
from concurrent.futures import ThreadPoolExecutor
import gzip
import hashlib
import json
from pathlib import Path
import re
import subprocess

ROOT = Path(__file__).resolve().parents[2]


def validate(directory):
    manifest = json.loads((directory / 'manifest.json').read_text(encoding='utf-8'))
    if manifest['schema'] != 1 or manifest['country'] != 'US' or not re.fullmatch(r'20\d\d-\d\d-\d\d\.\d+', manifest['release']):
        raise ValueError('Invalid public release manifest')
    tiles = 0
    files = []
    for band, meta in manifest['bands'].items():
        if not band.isdigit() or not 0 <= int(band) < 180:
            raise ValueError('Invalid band')
        index_path, pack_path = directory / 'bands' / f'{band}.json', directory / 'bands' / f'{band}.bin'
        index_bytes = index_path.read_bytes()
        if hashlib.sha256(index_bytes).hexdigest() != meta['indexSha256'] or pack_path.stat().st_size != meta['bytes']:
            raise ValueError('Pack/index checksum or size mismatch')
        index = json.loads(index_bytes)
        offset = 0
        with pack_path.open('rb') as pack:
            for tile, (start, length) in index.items():
                if start != offset or length < 1 or not re.fullmatch(r'\d+_\d+', tile):
                    raise ValueError('Invalid tile range')
                row, col = map(int, tile.split('_'))
                if row//50 != int(band) or not 0 <= row < 9000 or not 0 <= col < 18000:
                    raise ValueError('Tile belongs to another band')
                raw = gzip.decompress(pack.read(length))
                if len(raw) > 4_000_000:
                    raise ValueError('Oversized tile')
                data = json.loads(raw)
                if data['release'] != manifest['release'] or data['tile'] != tile or data['schema'] != 1 or len(data['places']) > 20000:
                    raise ValueError('Invalid tile payload')
                offset += length
        if offset != meta['bytes'] or len(index) != meta['tiles']:
            raise ValueError('Incomplete band')
        tiles += len(index)
        files += [index_path, pack_path]
    if tiles != manifest['tileCount'] or not tiles or manifest['placeCount'] < 1:
        raise ValueError('Incomplete national pack')
    return manifest, files


def main():
    p = argparse.ArgumentParser()
    p.add_argument('directory', type=Path)
    p.add_argument('--wrangler-cli', type=Path)
    p.add_argument('--bucket', default='journeydeck-public-places')
    p.add_argument('--upload', action='store_true')
    args = p.parse_args()
    directory = args.directory.resolve()
    manifest, files = validate(directory)
    print(f"Validated {manifest['placeCount']} places in {manifest['tileCount']} tiles.", flush=True)
    if not args.upload:
        return
    if not args.wrangler_cli or not args.wrangler_cli.is_file() or not re.fullmatch(r'[a-z0-9-]+', args.bucket):
        p.error('Pass the installed Wrangler bin/wrangler.js path and a valid bucket name')
    if manifest.get('coverage') and not args.bucket.endswith('-preview'):
        p.error('Partial canary coverage is restricted to a preview bucket')
    prefix = f"{args.bucket}/us/v1/{manifest['release']}"
    command = ['node', str(args.wrangler_cli.resolve()), 'r2', 'object']
    config = ['--config', str(ROOT / 'cloudflare/wrangler.jsonc'), '--remote']
    # Immutable releases cannot overwrite a live manifest. A failed upload can
    # be resumed because its manifest has not yet been committed.
    check = subprocess.run(command + ['get', prefix+'/manifest.json', '--pipe'] + config, capture_output=True)
    if check.returncode == 0:
        raise RuntimeError('This release is already published; refuse to overwrite it.')
    if b'404' not in check.stderr+check.stdout and b'does not exist' not in check.stderr+check.stdout:
        raise RuntimeError('Cannot confirm release is absent; check Wrangler account/access.')

    def upload(item):
        path, key = item
        kind = 'application/json' if path.suffix == '.json' else 'application/octet-stream'
        result = subprocess.run(command + ['put', prefix+'/'+key, '--file', str(path), '--content-type', kind] + config, capture_output=True)
        if result.returncode:
            raise RuntimeError(f'Upload failed for public object {key}: '+result.stderr.decode(errors='replace')[-1000:])
        print('Uploaded '+key, flush=True)

    uploads = [(path, path.relative_to(directory).as_posix()) for path in files]
    uploads.append((ROOT / 'mobile/recorder/assets/overture-licenses.json', 'licenses.json'))
    uploads.append((ROOT / 'tools/overture-us/NOTICE.txt', 'NOTICE.txt'))
    with ThreadPoolExecutor(max_workers=4) as pool:
        list(pool.map(upload, uploads))
    upload((directory / 'manifest.json', 'manifest.json'))
    print('Public release uploaded. Activate preview only after a ranged-read smoke test.', flush=True)


if __name__ == '__main__':
    main()
