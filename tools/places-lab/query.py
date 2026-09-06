"""Isolated, bounded open-data queries. JSON over stdin/stdout; never log inputs."""
import contextlib
import io
import json
import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / '.cache/places-lab-python'))


def distance(lat, lon, y, x):
    a, b = math.radians(lat), math.radians(y)
    h = math.sin((b-a)/2)**2 + math.cos(a)*math.cos(b)*math.sin(math.radians(x-lon)/2)**2
    return 6371008.8 * 2 * math.asin(min(1, math.sqrt(h)))


def bounds(lat, lon, radius):
    dy = radius / 110500
    dx = dy / max(.1, math.cos(math.radians(lat)))
    return [lon-dx, lat-dy, lon+dx, lat+dy]


def normalize(row, source):
    if source == 'overture':
        box = row['bbox']
        x, y = box['xmin'], box['ymin']
        if row.get('geometry'):
            from shapely import from_wkb
            point = from_wkb(row['geometry'])
            x, y = point.x, point.y
        addresses = row.get('addresses') or []
        address = addresses[0] if addresses else {}
        taxonomy = row.get('categories') or row.get('taxonomy') or {}
        category = row.get('basic_category') or taxonomy.get('primary', '')
        return dict(id=row['id'], name=(row.get('names') or {}).get('primary', ''),
                    lat=y, lon=x, category=str(category).replace('_', ' '),
                    address=', '.join(str(address[k]) for k in ['freeform','locality','region'] if address.get(k)),
                    confidence=row.get('confidence'), status=row.get('operating_status', ''),
                    sources=sorted(set(s.get('dataset','') for s in row.get('sources',[]) if s.get('dataset'))))
    labels = row.get('fsq_category_labels') or []
    if isinstance(labels, str):
        labels = [labels]
    return dict(id=row['fsq_place_id'], name=row.get('name',''), lat=row['latitude'], lon=row['longitude'],
                category=' · '.join(labels), address=', '.join(str(row[k]) for k in ['address','locality','region'] if row.get(k)),
                status='closed' if row.get('date_closed') else 'not marked closed',
                refreshed=str(row.get('date_refreshed') or ''), flags=row.get('unresolved_flags') or [])


def ranked(rows, lat, lon, radius):
    result = []
    for row in rows:
        if not row.get('name') or row.get('lat') is None or row.get('lon') is None:
            continue
        row['distance'] = round(distance(lat, lon, float(row['lat']), float(row['lon'])), 1)
        if row['distance'] <= radius:
            result.append(row)
    return sorted(result, key=lambda r:(r['distance'],r['name'],str(r['id'])))


def run(payload):
    source, lat, lon, radius = payload['source'], payload['lat'], payload['lon'], payload['radius']
    box = bounds(lat, lon, radius)
    if source == 'overture':
        from overturemaps import core
        # Capture library diagnostics: they may contain a requested bounding box.
        with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
            release = core.get_latest_release()
            prepared = core._prepare_query('place', box, release, 8, 20, True)
            if prepared is None:
                rows = []
            else:
                dataset, predicate = prepared
                columns = [c for c in ['id','names','bbox','geometry','categories','taxonomy','basic_category','addresses','confidence','operating_status','sources'] if c in dataset.schema.names]
                rows = dataset.to_table(columns=columns, filter=predicate).to_pylist()
        data = [normalize(row, source) for row in rows]
        return dict(places=ranked(data,lat,lon,radius), release=release)
    if source == 'foursquare':
        import duckdb
        db = duckdb.connect()
        try:
            db.execute("SET threads=4; SET memory_limit='512MB'; SET http_timeout=20;")
            db.execute('LOAD httpfs; LOAD iceberg;')
            token = payload['token']
            # Token arrives over stdin, is used only in this in-memory DB, never persisted.
            db.execute("CREATE SECRET fsq (TYPE ICEBERG, TOKEN '" + token.replace("'", "''") + "')")
            db.execute("ATTACH 'places' AS places (TYPE iceberg, SECRET fsq, ENDPOINT 'https://catalog.h3-hub.foursquare.com/iceberg')")
            cur = db.execute('SELECT fsq_place_id,name,latitude,longitude,address,locality,region,fsq_category_labels,date_refreshed,date_closed,unresolved_flags FROM places.datasets.places_os WHERE bbox.xmin BETWEEN ? AND ? AND bbox.ymin BETWEEN ? AND ?', [box[0],box[2],box[1],box[3]])
            cols = [c[0] for c in cur.description]
            rows = [normalize(dict(zip(cols,row)),source) for row in cur.fetchall()]
            return dict(places=ranked(rows,lat,lon,radius),release='Places Portal current snapshot')
        finally:
            db.close()
    raise ValueError('Unsupported source')


if __name__ == '__main__':
    try:
        result = run(json.load(sys.stdin))
        print(json.dumps(result, default=str))
    except Exception as exc:
        # Do not expose exception messages: DuckDB errors can contain the access token.
        message = 'Source query failed. Check the connection and try again.'
        if isinstance(exc, ImportError):
            message = 'The local data reader needs its dependencies installed.'
        print(json.dumps(dict(error=message)))
        sys.exit(1)
