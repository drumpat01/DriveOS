# JourneyDeck Places Lab

Local, manual comparison of **Overture Places**, **Foursquare Open Places**, and **OpenStreetMap named POIs**. Isolated from the desktop/mobile application and user library. No deployment or paid API needed.

## Run on this Windows workspace

```powershell
& 'C:/Users/patri/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe' -m pip install --target .cache/places-lab-python -r tools/places-lab/requirements.txt
& 'C:/Users/patri/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe' -c "import sys; sys.path.insert(0,'.cache/places-lab-python'); import duckdb; db=duckdb.connect(); db.execute('INSTALL httpfs; INSTALL iceberg')"
& 'C:/Users/patri/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe' tools/places-lab/server.py
```

Open http://127.0.0.1:8768/. Python 3.12+ with dependencies installed normally also works. Start from repository root. The server binds only to loopback; this is not a public web deployment or an iPhone/iPad app.

## Test destinations

1. Search for a **public** destination and city. Choose a result, then move the pin to the actual stop/parking spot. Coordinates can also be entered manually. No automatic geolocation or JourneyDeck library access.
2. Enter the expected business/destination and select a 50–1,500 m radius.
3. Click Compare. Three independent source requests finish independently, with explicit unavailable/empty states. First catalog access can take a minute; each dataset subprocess is killed at 100 seconds.
4. Inspect nearest-first lists and map pins. Click a candidate to remember its rank. Rate Correct if the expected destination is in the list, Close for a related/partially correct place, or Missing if absent. Errors/disconnected sources cannot be rated as missing.
5. Save each case. Scorecard counts only rated sources and allows multiple correct sources. Export contains user-entered public destination labels, ratings, selected ranks, radius, counts and release metadata, **not coordinates, returned source records, tokens, or private app data**.

For a meaningful evaluation, use 20–30 known public stops including parking lots, shopping centers, independent businesses, chains, parks, and difficult MapKit cases. Keep the same radius and pin for all providers. Directory coverage is not proof of visit-recognition quality.

## Foursquare connection

Sign in to https://places.foursquare.com and create an access token under Manage Tokens. Use the app's Connect Foursquare password field. This is **Open Places / Iceberg access**, not a Places API service key, SDK key or billing subscription. The token is held only in server/process memory; restarting the server requires reconnection. DuckDB uses an in-memory secret and the official catalog endpoint `https://catalog.h3-hub.foursquare.com/iceberg`, table `places.datasets.places_os`. No persistent DuckDB secret, filesystem token, browser token storage or application logs.

## Source behavior and limitations

- Overture: official Python reader, latest STAC release, bounded regional column reads. Names, locations, categories, source provenance, closure status and existence confidence are shown. Confidence measures existence, **not likelihood of a user visit**. Overture includes some Foursquare data, so these are not independent datasets.
- Foursquare: original OS Places table queried with a bounding box, then exact common radius/distance filter. Closure and unresolved flags shown rather than silently filtering them. Live catalog snapshot; extraction date is not a promise of freshness for every place.
- OSM: manual, bounded Overpass queries for named amenity/shop/tourism/leisure/office/craft/historic features, including nodes and area centers. This does not include every OSM feature. Public Overpass is for this low-volume research tool only; never use this setup as a production backend. Requests are serialized, at least two seconds apart; cached identical queries expire after 30 minutes. Search uses Nominatim on explicit submit only, serialized at 1.1-second minimum intervals.
- Map tiles are OpenStreetMap standard tiles, loaded only for the viewed map. Selected public locations/search strings go to the relevant services. Provider results and input pins are held only in memory on the server; at most 50 cached queries. Ratings and theme are local browser storage.
- No global dataset download, cloud provisioning, account charges, mobile code changes, OTA, commit or push.

## Attribution

Leaflet 1.9.4 is vendored under its BSD-2-Clause license in `vendor/LICENSE`.
Overture data: https://docs.overturemaps.org/attribution/ (Places uses CDLA-Permissive-2.0 / Apache-2.0 according to source).
Foursquare data: https://opensource.foursquare.com/places-notice-txt/ and Apache-2.0.
OpenStreetMap: https://www.openstreetmap.org/copyright (ODbL; attribution in app/map).
Source records are not included in exported ratings. Preserve applicable notices if adding future data exports or persistent distribution.

## Verification

```powershell
& 'C:/Users/patri/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe' -m unittest discover -s tools/places-lab -p test_lab.py -v
node --check tools/places-lab/app.js
```
