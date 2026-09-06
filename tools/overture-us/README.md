# JourneyDeck US places directory

The app resolves saved names first, then protected places, then its existing local
cache. It asks Apple's geocoder for the stop's country. Confirmed US stops can
use Overture; every other country (including unknown country) uses MapKit. Empty,
ambiguous, unavailable, or invalid Overture results fall back to MapKit and then
Apple's address label. Maps, recording, and private iCloud data stay separate.

## Public directory contract

- Source: Overture `2026-08-19.0`, Places theme. Only rows with an explicit US
  address, `operating_status=open`, confidence >=0.7, and a valid primary name.
  Alaska/Hawaii are included; this is not a contiguous-US rectangle. Unlabelled
  country/status rows are intentionally handled by native fallback. These filters
  favor conservative matching over exhaustive directory coverage.
  Geographic bbox prefilters cover CONUS, Alaska (both sides of the date line)
  and Hawaii including its northwestern islands, to skip unrelated source blocks.
- Fields: GERS ID, primary name, precise public POI point, category, confidence.
  Source dataset names are retained in the release manifest. No phone number,
  website, personal account, drive, photo, or user location enters this bucket.
- Cells are .02 degrees (about 2.2 km north/south), with a 250 m halo. Coordinates
  come from geometry, not reduced-precision Parquet bbox values. A nearby business
  across a cell boundary remains a candidate, including an ambiguous runner-up.
- Each latitude-degree band has an index and a binary pack of independent gzip
  members. A tile index contains `[offset,length]`; the Worker reads only that
  member with R2 Range. This avoids hundreds of thousands of separate R2 uploads.
  The Worker decodes that member before edge caching; Cloudflare negotiates
  outgoing gzip/Brotli normally. Cache keys include environment and directory
  namespace so canary data cannot leak into a national release.
- `POST /api/places/us-tile` accepts exactly `{"tile":"6140_4135"}`. No precise
  coordinates, profile token, or arbitrary R2 object path. Requests share the
  existing edge rate limit. Operational logs contain the fixed API path only.
- The closest point must be within 160 m and at least 35 m farther from its
  runner-up, with a 1.5 distance ratio. Confidence describes directory existence,
  not proof the driver visited. Ambiguous shopping-center stops can retain an
  address until the user supplies a correction.
- The app caches at most 24 public tiles for seven days in its reclaimable cache
  directory (each decoded tile <=4 MB). A service error pauses edge retries for
  five minutes. Existing chosen place labels retain their normal 30-day cache;
  user corrections always win. This rollout does not bulk-rename old journeys.
- Chosen labels use the existing local place/canonical alias and private CloudKit
  envelope. Newly created Overture place IDs include GERS identity. Public tile
  caches are neither uploaded to iCloud nor included in user exports.
- Country geocoding and enrichment remain foreground-only, four endpoints per
  pass, suspended while recording. Check profile, saved names and privacy fences
  before calls and after awaits. Home/Work minimum protection is 300 m.

## Build and validate

For an already downloaded complete release, `prepare_local.py` validates the
official S3 shard names/sizes (metadata request only), decodes every local Parquet
column/page, records SHA-256 hashes, extracts locally, builds and validates every
tile range, and copies notices/licenses into a self-contained upload directory.
It has **no upload option**. The installed DuckDB spatial extension is required.
Use the Python interpreter matching the cached dependency wheels (3.12 here).

```
python tools/overture-us/prepare_local.py --input C:/Users/patri/Downloads/Overture-Places --output C:/Users/patri/Downloads/Overture-US-Upload-2026-08-19 --release 2026-08-19.0
```

The output must be fresh. `upload-plan.json` records exact object keys, sizes and
hashes; only its listed objects are intended for upload, with the manifest last.
The extracted Parquet and validation reports stay outside that upload directory.
Local hashes establish a reproducible baseline; multipart S3 ETags are not
claimed to be upstream SHA-256 hashes. Interrupted runs remain untouched.
If packing fails after a completed extraction, `--resume-extraction` verifies
its completion marker/hash/row count and writes a fresh `-ready` package.
Preparation explicitly omits tiles exceeding 20,000 candidates or 4 MB decoded,
listing each in `nativeFallbackTiles` in the manifest/upload plan. Missing tiles
use existing MapKit fallback; candidates are never truncated to create false
nearest-place confidence. The lower-level packer remains strict by default.

Python 3.12+, dependencies in requirements.txt. The existing ignored Places Lab
Python dependency directory is supported for this Windows workspace.

```
python tools/overture-us/build.py --release 2026-08-19.0 --output .cache/overture-us/2026-08-19.0
python tools/overture-us/test_build.py
python tools/overture-us/publish.py .cache/overture-us/2026-08-19.0
```

Extraction streams public S3 Parquet through DuckDB with a 1 GB memory limit.
Packing uses a temporary SQLite database, not a user database. Output includes
counts, exact compressed bytes, source provenance and index checksums. No secrets
or paid upstream API keys are needed. An interrupted extraction must be rebuilt
to a fresh filename; a completed parquet can be reused with `--source` only when
its `.complete.json` checksum marker is present. A valid Parquet footer alone
does not prove the extraction finished (a failed streamed query can close a
partial file). Never publish an interrupted extract as national coverage.

## Upload and activate

September6 preview status: the user uploaded all107 objects; remote readback
matched every SHA-256. Preview now binds the national bucket with `national-v1`
cache namespace. Six-business smoke and live byte comparisons across all52 bands
passed, including omitted dense-tile fallback. Production has not been activated.
`smoke_national.mjs <ready-directory>` repeats preview-only live range comparisons.

Local preparation completed September6,2026 for `2026-08-19.0`: ready directory
`C:/Users/patri/Downloads/Overture-US-Upload-2026-08-19/2026-08-19.0-ready`.
107 objects /981,259,927 bytes, 52 bands, 528,153 served tiles, from10,071,579
filtered source places. Tile `6537_5300` exceeds the20,000-candidate limit and is
documented for native fallback. Every gzip range passed validation; local app
parser smoke passed for six known public businesses, all bands and fallback.
Nothing uploaded. The parent upload plan is authoritative for object keys/hashes.

R2 must first be enabled by the account owner. Bucket: `journeydeck-public-places`.
Keep it private; the Worker exposes only validated read-only public tiles.
The separate `journeydeck-public-places-preview` bucket holds a tiny public
canary made from the six Places Lab destinations. It is NOT national coverage.
`make_canary.py` builds it; the publisher forbids uploading it to the main bucket.

```
python tools/overture-us/publish.py .cache/overture-us/2026-08-19.0 --upload --wrangler-cli <installed-wrangler>/bin/wrangler.js
```

The publisher validates every gzip member, range, count and index checksum,
uploads packs/indexes and bundled redistribution licenses, then writes the
manifest last. It refuses to overwrite a published release. Failed pre-manifest
uploads can be retried. It uses Wrangler's existing sign-in, never copies tokens.

Set preview `OVERTURE_RELEASE` to the uploaded release and `OVERTURE_ENABLED=true`;
deploy the preview Worker and test actual US tiles, empty areas, bad requests,
disabled service, and repeat cached reads. Only then enable the production edge
route. When preview switches from its canary bucket to the full bucket, also
change `OVERTURE_CACHE_NAMESPACE` from `canary-v3` to `national-v1`.
`node --experimental-strip-types tools/overture-us/smoke.mjs <edge-url>` checks
the real compressed/ranged path against known public POIs. These are not physical
parking-stop acceptance tests. Set `OVERTURE_ENABLED=false` to stop new directory
downloads; uncached
lookups fall back to native. Valid on-device public caches remain usable until
their seven-day expiry (a cache-version change in an app update can invalidate
them sooner). Keep the previous immutable directory for release rollback.
New data refreshes are explicit runs, not an unapproved recurring automation.

Public API redistribution notices: see NOTICE.txt and
`mobile/recorder/assets/overture-licenses.json` (full CDLA, Apache, CC0 texts).
The app's Settings > Place data credits displays the same bundled texts offline.
Review attribution when changing the source release; `fetch_licenses.py` fetches
license texts from their publishers, it does not decide legal applicability.

## Mobile release constraint

This POI change uses existing native capabilities and needs no new native module.
However, the shared V2 checkout also has separate Watch/native recorder changes
and now targets `2.0.0-preview.6`. Do not label or publish that whole working tree
as an OTA for installed Build 6 / `2.0.0-preview.5`. Use a verified compatible
release snapshot or include POI in the new native preview build.
