"""Read back an immutable R2 package and compare every byte to its upload plan."""
import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
import hashlib
import json
from pathlib import Path
import subprocess
from publish import validate

ROOT = Path(__file__).resolve().parents[2]


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--plan', required=True, type=Path)
    p.add_argument('--output', required=True, type=Path)
    p.add_argument('--wrangler-cli', required=True, type=Path)
    p.add_argument('--bucket', default='journeydeck-public-places')
    args = p.parse_args()
    plan = json.loads(args.plan.read_text(encoding='utf-8'))
    args.output.mkdir(parents=True, exist_ok=False)

    def fetch(item):
        path = (args.output / item['file']).resolve()
        if not path.is_relative_to(args.output.resolve()):
            raise ValueError('Invalid package path')
        path.parent.mkdir(parents=True, exist_ok=True)
        command = ['node', str(args.wrangler_cli), 'r2', 'object', 'get', args.bucket+'/'+item['objectKey'],
                   '--file', str(path), '--config', str(ROOT / 'cloudflare/wrangler.jsonc'), '--remote']
        result = subprocess.run(command, capture_output=True, timeout=300)
        if result.returncode:
            raise RuntimeError(f"Read failed for {item['file']}: "+result.stderr.decode(errors='replace')[-500:])
        with path.open('rb') as handle:
            digest = hashlib.file_digest(handle, 'sha256').hexdigest()
        if path.stat().st_size != item['bytes'] or digest != item['sha256']:
            raise ValueError(f"Uploaded bytes differ: {item['file']}")
        return {'file': item['file'], 'bytes': item['bytes'], 'sha256': digest}

    checked = []
    with ThreadPoolExecutor(max_workers=4) as pool:
        for future in as_completed([pool.submit(fetch, item) for item in plan['objects']]):
            checked.append(future.result())
            if len(checked) % 10 == 0 or len(checked) == len(plan['objects']):
                print(f'Verified {len(checked)}/{len(plan["objects"])} remote object hashes.', flush=True)
    manifest, _ = validate(args.output)
    smoke = subprocess.run(['node', '--experimental-strip-types', str(ROOT / 'tools/overture-us/smoke_local.mjs'), str(args.output)], capture_output=True)
    if smoke.returncode:
        raise RuntimeError(smoke.stderr.decode(errors='replace')[-1500:])
    report = dict(bucket=args.bucket, release=plan['release'], verifiedObjects=len(checked), bytes=sum(x['bytes'] for x in checked),
                  tiles=manifest['tileCount'], files=checked, smoke=smoke.stdout.decode().strip(), remoteWrites=False,
                  limitation='Tile slices tested from R2-readback bytes; live Worker remote-binding range path requires separate preview verification.')
    (args.output / 'verification-report.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
    print(json.dumps({k: v for k, v in report.items() if k != 'files'}), flush=True)


if __name__ == '__main__':
    main()
