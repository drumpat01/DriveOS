# Atlas Node/TypeScript local architecture

JourneyDeck's local web surface now runs through a compiled Fastify service. Atlas is no longer assembled by PowerShell or the browser during a page request.

## Responsibilities

- **Node.js/TypeScript:** static web serving, authenticated API routing, origin and role checks, security headers, compression, Atlas reads and writes, compatibility routing, readiness, and structured logs.
- **Snapshot worker:** deterministic place clustering, Home consolidation, unresolved-label suppression, recurring-pattern reconstruction and deduplication, 200 representative lines, ten unresolved cards, and three change insights.
- **SQLite:** canonical local development copy plus versioned Atlas snapshots, detail records, review state, label overrides, and diagnostics.
- **PowerShell:** Tessie/Spotify ingestion, scheduled maintenance, imports, provider tooling, and the previous server as a documented rollback boundary. Normal Atlas requests never invoke PowerShell.
- **Legacy compatibility:** non-Atlas reads are explicitly forwarded to the configured signed-in upstream so the local Tessie/Spotify, Replay, Share Card, Timeline, Collections, and Data Health views continue to work. The adapter is read-only except for authentication and a small allowlist of computation-only POST routes. It never silently activates when the upstream variable is absent.

## Local startup

Requirements: Node.js 24 or newer and PowerShell 7.

```powershell
npm install
.\tools\New-AtlasNodeDevelopmentSnapshot.ps1
.\tools\Start-AtlasNodeLocal.ps1
```

The snapshot command reads canonical rows from the configured Turso source, writes only to an ignored local SQLite database, creates and verifies a pre-Atlas backup, deletes its temporary private JSON, and never calls Tessie, Spotify, Foursquare, or Nominatim. Use `npm run seed:atlas` instead when a private source snapshot is neither available nor desirable.

Local URL: `https://superredux.tail1babbd.ts.net:8443/`

## Commands

```powershell
# Build and start directly (environment variables must be configured first)
npm run build:server
npm run start:server

# Apply or roll back only the Atlas migration in the isolated development DB
npm run migrate:atlas
npm run rollback:atlas

# Rebuild the persisted snapshot
$env:DRIVEOS_NODE_DATABASE = (Resolve-Path .\data\atlas-node-dev\journeydeck-local.db).Path
npm run rebuild:atlas
Remove-Item Env:\DRIVEOS_NODE_DATABASE

# Focused Node checks and performance gates
npm test

# Or run the same gates individually
npm run check:server
npm run lint:server
npm run test:server
npm run test:atlas-performance

# Existing application regression suite
.\tools\Test-ReleasePreflight.ps1

# Stop or restore the previous local live-proxy architecture
.\tools\Stop-AtlasNodeLocal.ps1
.\tools\Rollback-AtlasNodeLocal.ps1
```

## Snapshot lifecycle

The active snapshot is immutable from a request's perspective. Atlas bootstrap reads one persisted JSON row and never constructs a graph. Label and recurring-pattern writes are serialized, persist first, patch the active snapshot immediately, mark it dirty, and debounce a rebuild in a worker thread. The last valid snapshot remains available throughout the rebuild. A failed build records `last_error` and does not replace the valid snapshot.

Inspect `GET /readyz` or authenticated `GET /api/atlas/snapshot/status` for `ready`, `dirty`, `rebuilding`, timestamps, watermark, schema version, and the last truthful error. Run `npm run rebuild:atlas` after correcting source data or configuration.

## Environment variable names

- `DRIVEOS_NODE_HOST`
- `DRIVEOS_NODE_PORT`
- `DRIVEOS_NODE_DATABASE`
- `DRIVEOS_NODE_HOUSEHOLD_ID`
- `DRIVEOS_NODE_PUBLIC_ORIGIN`
- `DRIVEOS_NODE_SESSION_SECRET`
- `DRIVEOS_NODE_LEGACY_UPSTREAM`
- `DRIVEOS_NODE_LEGACY_READ_ONLY`
- `DRIVEOS_NODE_LOG_LEVEL`
- `DRIVEOS_NODE_TEST_AUTH` (automated tests only)

Never commit values for these variables. Private database files, backups, logs, build output, and benchmark artifacts are ignored.

## Measured first-load path

The reproducible fixture contains 2,100 journeys and 4,200 raw endpoints.

| Measurement | Previous browser path | Persisted Node path |
| --- | ---: | ---: |
| Representative selection | 665 ms at 100; 9.2 s at 250; over 30 s at 500 | 0 ms during request |
| Warm bootstrap p95 | Full graph request plus browser construction | 3.9 ms |
| Process-cold bootstrap | Not isolated | 551 ms |
| Browser preparation p95 | Grew sharply with journey count | 0.45 ms |
| Initial Atlas JSON | Complete graph/journey projections | 138 KB raw; 11.5 KB Brotli |

The authenticated real-sized local snapshot returned one 38.9 KB transferred bootstrap response in 31.2 ms, then rendered 200 prepared lines. External map tiles are excluded.

## Rollback

`Rollback-AtlasNodeLocal.ps1` validates and stops only the recorded Node process, then restores the previous local proxy on port 8791. The verified pre-Atlas database remains under `data\atlas-node-dev\backups`. No rollback command changes production, DNS, or Turso.

## Hosted canary and promotion

`render-atlas-canary.yaml` defines a separate paid canary service. It does not replace the `driveos` production service. The canary compiles on Node 24, keeps its SQLite read model and Atlas writes on a Render persistent disk, initializes that disk from a count-verified read-only Turso export, and runs the existing PowerShell server behind the Node front door for compatibility routes.

Set both `DRIVEOS_NODE_PUBLIC_ORIGIN` and `DRIVEOS_PUBLIC_URL` to the canary's exact HTTPS origin. Copy the existing production secrets into the canary through Render; never add their values to the blueprint. A first boot is ready only after `/readyz` reports an active Atlas snapshot.

Before promotion, verify login, `/api/atlas/bootstrap`, label and pattern writes, `/api/atlas/snapshot/status`, dashboard, Replay, Share Card, Timeline, Collections, Data Health, and Wife Mode on the canary. Promotion is a separate reviewed change that moves the Node entrypoint and persistent disk settings into `render.yaml`. Rollback leaves `render.yaml` on the PowerShell entrypoint or reverts that promotion commit; the current production service and Turso are not modified by canary creation.

The hosted runtime imports Turso when the persistent database is absent, then refreshes its canonical journey rows every 15 minutes. Each refresh uses count-verified read-only Turso queries, an ignored temporary JSON file that is deleted in `finally`, a single SQLite transaction, and an atomic snapshot rebuild. A failed refresh retains the last valid snapshot. `render.yaml` promotes the same Node front door and persistent-disk boundary to `journeydeck.me`; reverting that promotion returns the production service to its PowerShell entrypoint without changing Turso.
