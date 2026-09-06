import gzip
import importlib.util
import json
import math
from pathlib import Path
import sys
import tempfile
import unittest

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from build import cells, pack
from publish import validate
from prepare_local import validate_sources
import pyarrow as pa
import pyarrow.parquet as pq


class PublicPacks(unittest.TestCase):
    def test_dense_tiles_use_explicit_native_fallback_without_truncating_candidates(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            dense = dict(name='Dense place', lon=-73.991, lat=40.749, category='shop', confidence=.9, sources=['Meta'])
            rows = [dict(dense, id=f'gers-{i}') for i in range(20001)]
            rows.append(dict(dense, id='sparse', lon=-100., lat=35.))
            source = root / 'us.parquet'
            pq.write_table(pa.Table.from_pylist(rows), source)
            with self.assertRaisesRegex(ValueError, 'mobile download limit'):
                pack(source, root / 'strict', '2026-08-19.0')
            pack(source, root / 'fallback', '2026-08-19.0', native_fallback_on_overflow=True)
            manifest, _ = validate(root / 'fallback')
            self.assertTrue(manifest['nativeFallbackTiles'])
            for tile, detail in manifest['nativeFallbackTiles'].items():
                band = str(int(tile.split('_')[0]) // 50)
                index = json.loads((root / 'fallback' / 'bands' / f'{band}.json').read_text())
                self.assertNotIn(tile, index)
                self.assertEqual(detail['places'], 20001)

    def test_local_source_validation_rejects_missing_size_and_corrupt_data(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            source = root / 'part-00000.parquet'
            pq.write_table(pa.table({'value': [1, 2, 3]}), source)
            expected = {source.name: {'bytes': source.stat().st_size, 'etag': 'test'}}
            result = validate_sources(root, expected)
            self.assertEqual(result[0]['rows'], 3)
            self.assertEqual(len(result[0]['sha256']), 64)
            with self.assertRaisesRegex(ValueError, 'Shard set mismatch'):
                validate_sources(root, {})
            with self.assertRaisesRegex(ValueError, 'size mismatch'):
                validate_sources(root, {source.name: {'bytes': 1, 'etag': 'test'}})
            source.write_bytes(b'not parquet')
            with self.assertRaises(Exception):
                validate_sources(root, {source.name: {'bytes': source.stat().st_size, 'etag': 'test'}})

    def test_halo_covers_edges_corners_and_alaska(self):
        for lon, lat in [(-97.3, 32.8), (-150, 65), (-179.999, 51.5)]:
            covered = set(cells(lon, lat))
            self.assertIn((math.floor((lat+90)*50), math.floor((lon+180)*50)), covered)
            self.assertGreater(len(covered), 1)
            self.assertTrue(all(0 <= x < 18000 and 0 <= y < 9000 for y, x in covered))

    def test_pack_ranges_are_independent_gzip_and_manifest_matches(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            rows = [dict(id='gers-1', name='Test place', lon=-97.3, lat=32.8, category='restaurant', confidence=.95, sources=['Meta']),
                    dict(id='gers-2', name='Alaska place', lon=-150., lat=65., category='shop', confidence=.9, sources=['Microsoft'])]
            source = root / 'us.parquet'
            pq.write_table(pa.Table.from_pylist(rows), source)
            output = root / 'release'
            pack(source, output, '2026-08-19.0')
            manifest, files = validate(output)
            self.assertEqual(manifest['placeCount'], 2)
            self.assertEqual(manifest['sources'], ['Meta', 'Microsoft'])
            self.assertGreater(manifest['tileCount'], 2)
            self.assertGreater(len(files), 2)
            # Every halo copy survives a range read; no dependence on other gzip members.
            for band in manifest['bands']:
                index = json.loads((output / 'bands' / f'{band}.json').read_text())
                binary = (output / 'bands' / f'{band}.bin').read_bytes()
                for tile, (offset, length) in index.items():
                    payload = json.loads(gzip.decompress(binary[offset:offset+length]))
                    self.assertEqual(payload['tile'], tile)
                    self.assertEqual(payload['places'][0][1].endswith('place'), True)
            index_path = next((output / 'bands').glob('*.json'))
            index_path.write_text('{}')
            with self.assertRaisesRegex(ValueError, 'checksum'):
                validate(output)


if __name__ == '__main__':
    unittest.main()
