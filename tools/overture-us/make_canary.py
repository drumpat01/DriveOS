"""Package the six already-tested public destinations for a staging smoke test.

This is NOT the national dataset and must only be uploaded to the preview bucket.
"""
import json
from pathlib import Path
from build import pack
import pyarrow as pa
import pyarrow.parquet as pq

ROOT = Path(__file__).resolve().parents[2]
if __name__ == '__main__':
    cases = json.loads((ROOT / '.cache/places-lab-six-results.json').read_text(encoding='utf-8'))
    rows = {}
    for case in cases:
        for p in case['sources']['overture']['places']:
            if p.get('status') != 'open' or (p.get('confidence') or 0) < .7:
                continue
            rows[p['id']] = dict(id=p['id'], name=p['name'], lon=p['lon'], lat=p['lat'], category=p['category'], confidence=p['confidence'], sources=p['sources'])
    source = ROOT / '.cache/overture-canary.parquet'
    pq.write_table(pa.Table.from_pylist(list(rows.values())), source)
    output = ROOT / '.cache/overture-canary/2026-08-19.0'
    pack(source, output, '2026-08-19.0')
    path = output / 'manifest.json'
    data = json.loads(path.read_text())
    data['coverage'] = 'six public test destinations only; not national coverage'
    path.write_text(json.dumps(data, indent=2), encoding='utf-8')
