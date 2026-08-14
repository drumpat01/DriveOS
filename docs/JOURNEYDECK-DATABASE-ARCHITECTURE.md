# JourneyDeck database architecture

## Purpose and preservation rule

JourneyDeck will move historical data ownership into Turso/libSQL without changing the existing product contract. The migration is additive: no current table, JSON/JSONL archive, provider credential, endpoint, drive ID, response property, launch path, authentication path, or deployment workflow is removed. A database-backed path may become authoritative only after its shadow data has been backfilled and compared with the existing provider-backed path.

The current `DriveOS-Server.ps1` endpoint shapes remain the compatibility boundary. In the first slice, durable drive and charging rows retain normalized query columns and the Tessie payload used by the existing domain converters. Reading the payload back through `Convert-RawDrive` and `Convert-RawCharge` preserves Full Mode, Wife Mode, friendly-place substitution, statistics, recaps, favorite routes, assistant/search evidence, soundtrack matching, maps, replay, and share-card privacy behavior.

## Current ownership and compatibility constraints

| Data or capability | Current durable owner/read path | Preservation requirement | Target owner |
| --- | --- | --- | --- |
| Web identities and roles | Environment-backed owner/wife credentials and signed sessions | Preserve subjects, role checks, session format, Full/Wife Mode switching, sign-out, and Wife Mode write restrictions | Existing authentication remains authoritative initially; shadow `app_users` and `household_members`, then migrate only behind a separate auth plan |
| Live vehicle state | Tessie `/vehicles`, cached for 15 seconds | Battery, location, state, temperatures, and live map remain fresh | Tessie is the live source; persist observations only for diagnostics/telemetry where useful |
| Drives | Tessie `/drives` in normal request paths, with a five-minute process cache | Preserve legacy ID `started_at-ended_at`, ordering, labels, local-time formatting, raw locations, aliases, all statistics, and both modes seeing the same rows | Turso `drives`; SQLite uses the identical migration/schema |
| Charging sessions | Tessie `/charges` in normal request paths, with a five-minute process cache | Preserve Tessie-recorded cost precedence, the existing 14-cent estimate, supercharger behavior, aliases, recaps, and response shape | Turso `charging_sessions` |
| Route/replay telemetry | Tessie `/states` when a drive map is requested | Preserve route points, song markers, replay interpolation, and Home privacy | Turso route telemetry after a later backfill; first slice keeps bounded per-drive provider fetches |
| Listening history | Turso/SQLite/JSONL `listening_history` payload rows; Spotify scheduled sync every 15 minutes | Preserve provider de-duplication, artwork/links, playlists, music stats, and Last.fm-origin history still stored | Normalized `tracks`, `track_provider_ids`, and `listening_events`; retain legacy payload reads during transition |
| Drive soundtracks | Shared `drive_soundtracks` cache in the configured repository | Full and Wife Mode must use the same canonical matches; delayed Spotify events must repair recent drives | Normalized `drive_song_matches`, with the existing payload cache retained as a compatibility projection until verified |
| Places | Manual aliases in repository; Foursquare cache/state in app state | Preserve aliases, Home handling, friendly places, Foursquare limits, and no request amplification | Turso normalized places/aliases/enrichment state |
| Preferences | Charging settings, dashboard layout, and integration/app state split across repository tables/files | Preserve dashboard layout, electricity rate, mode-specific permissions, and desktop JSON rollback | Household/user-scoped preferences in Turso, with current keys projected during transition |
| Rollups | Calculated from up to 365 days of drives, charges, and soundtracks per request/cache cycle | Preserve exact statistics, monthly recap fields, favorite routes, and assistant evidence | Durable versioned rollups derived from canonical event tables |

## Target model

All timestamps stored by the new model are UTC ISO-8601 text and, where range performance matters, also have integer Unix seconds. Display localization remains in the existing domain conversion layer. Internal IDs are deterministic SHA-256-derived text IDs based on provider identity; provider IDs and the legacy drive ID remain separately indexed compatibility keys.

The ordered schema is divided into these areas:

- Identity: `households`, `app_users`, `household_members`, and `user_preferences`. Roles are `owner`, `member`, and `viewer`; the current wife principal maps to `viewer` when identity shadowing begins.
- Mobility: `vehicles`, `drives`, `charging_sessions`, and later `route_samples`/`drive_routes`. Provider payload JSON is retained only on provider-ingest rows where it enables lossless replay, audit, or compatibility.
- Music (next slice): `tracks` for canonical metadata, `track_provider_ids` for Spotify/Last.fm identities, `listening_events` for plays, and `drive_song_matches` for the many-to-many match plus overlap and marker metadata. A play is never duplicated merely because two providers reported it.
- Places (later slice): canonical places, raw provider locations, aliases, and provider enrichment records with provenance and expiry.
- Operations: `integration_sync_cursors`, `integration_sync_runs`, and versioned `durable_rollups`. Cursors are per household/provider/resource, and retries reuse stable natural identities and upserts.

Turso is the production durable source. Local SQLite executes the same files from `src/Storage/Migrations` in the same order. JSON/JSONL remains a compatibility and rollback provider; it does not define a second SQL schema.

## Background ingestion and request paths

Historical ingestion belongs to background workers. The existing 15-minute Spotify workflow and endpoint are preserved unchanged. Tessie has a separate GitHub Actions worker, staggered seven minutes after the Spotify schedule, that checks out JourneyDeck and writes directly to Turso. No Tessie history operation runs through the single-threaded web request process.

The first Tessie worker run reads `JOURNEYDECK_TESSIE_INITIAL_SYNC_DAYS` (default and chosen rollout value: 30). History older than that warm-start window is not required for this rollout and is neither fetched nor deleted. Later syncs start six hours before each resource's durable cursor so late provider corrections are safely upserted. Drives and charges advance independently. Record upserts use bounded, retry-safe transactions; the resource cursor and successful sync-run record commit only after every chunk succeeds. A failed resource records its error without advancing its cursor, while the other resource can still complete.

Tessie's drive and charge APIs document `from`, `to`, and a maximum result `limit`, but no continuation cursor. The ingestor therefore treats a limit-sized response as incomplete and bisects its time window until each accepted window is below the limit. If a minimum window remains saturated, the run fails and its cursor stays put rather than silently dropping history.

After cutover, ordinary historical drive, statistics, place-candidate, charging, recap, Full Mode, and Wife Mode reads use the database. Live vehicle state stays on its short freshness window. Route-state fetches remain per-drive and bounded in this slice; the route telemetry slice will shadow-write and verify states before moving replay reads.

## Migration and backfill plan

1. **Additive schema:** deploy ordered migrations with both Tessie flags false. Verify migration versions and table/index presence on a Turso branch or copy and on local SQLite. Migrations never drop, rename, or rewrite existing tables.
2. **Shadow writes:** enable only `JOURNEYDECK_TESSIE_DB_WRITE_ENABLED` and enable the independent Tessie GitHub Actions worker with its Tessie and Turso secrets. Keep the worker's initial window at 30 days. Confirm both resource cursors, successful/failed run records, retry idempotency, saturation splitting, and isolation from the scheduled Spotify job.
3. **Thirty-day warm start:** let both resources complete their bounded 30-day ingestion. Older history is explicitly outside this rollout; do not run a 365-day backfill. The additive tables can retain any older rows that already exist, but completeness gates cover the chosen 30-day window only.
4. **Parity audit:** for the 30-day window, compare legacy IDs, counts by day, minimum/maximum timestamps, null rates, sampled normalized columns, and canonical JSON payload hashes. Compare `/api/drives`, `/api/charging`, `/api/statistics`, `/api/recap`, `/api/places`, Full Mode, Wife Mode, map authorization, and share-card privacy fixtures against provider-backed results.
5. **Read canary:** run `tools/Test-JourneyDeckTessieParity.ps1 -RequireReady` and retain its machine-readable report. Only after it passes, set `JOURNEYDECK_TESSIE_READ_CANARY_APPROVED=true` and then enable `JOURNEYDECK_TESSIE_DB_READ_ENABLED`. The server also requires the external-worker flag and fresh, error-free drive and charging cursors at startup. Because both modes share the repository functions, they switch together. Older history may no longer appear after this intentional cutover choice. Observe latency, empty-history rates, and response parity before broadening the rollout.
6. **Follow-on slices:** persist route telemetry, then normalize music/matches, places/preferences/integration state, and finally durable rollups. Each slice repeats shadow-write, backfill, compare, canary, and rollback gates.

Raw payload retention is intentionally selective. Tessie drive/charge payloads are kept during compatibility migration. Once normalized fields and response projections have long-running parity coverage, retention can be bounded by policy; no payload is deleted as part of this work.

## Verification gates

Automated gates must cover:

- migration ordering, contiguity, repeat execution, legacy-version upgrade, foreign keys, and SQLite integrity;
- deterministic IDs and exact legacy drive IDs;
- retrying the same ingest without duplicate vehicles, drives, charges, or cursors;
- corrected provider payloads updating existing records;
- UTC storage and unchanged display-time conversion;
- identical raw-record projections through the existing drive/charge domain converters;
- Wife Mode endpoint allowlisting and the absence of mutation controls;
- shared soundtrack-cache use in Full and Wife Mode;
- authentication, map/replay, privacy, mobile, desktop, scheduled sync, release, and deployment characterization suites.

The parity report uses the lower of the independent drive and charging cursor high-watermarks as its end boundary. It compares provider and database identities, UTC-day counts, oldest/newest timestamps, raw payload hashes, normalized columns, and compatibility projections through the existing drive and charging converters. A report is not ready if either cursor is missing, stale, failed, behind the audit boundary, or more than 45 minutes old by default. Reports omit VINs, locations, and raw payloads.

Operational parity queries should be saved with each rollout record. At minimum, record migration versions, drive/charge counts by UTC day, duplicate natural-key counts, orphan counts, cursor lag, oldest/newest timestamps, and a sample of legacy ID/payload comparisons.

The 2026-08-14 SuperRedux disposable-database run verified real-Turso schema initialization and legacy repository round trips without exposing credentials or touching production. Because SuperRedux used an independently created harness from its older checkout, the exact unpushed Tessie slice still requires the canonical rehearsal described in `docs/JOURNEYDECK-TESSIE-READ-CANARY.md` before rollout. This distinction prevents baseline provider compatibility from being mistaken for release-candidate evidence.

## Rollback

Read rollback is an environment change: set `JOURNEYDECK_TESSIE_DB_READ_ENABLED=false` and restart. Historical screens immediately resume their existing Tessie-backed behavior. Shadow writes may remain enabled for diagnosis or be disabled independently. The 15-minute Spotify job, shared soundtrack cache, authentication, live vehicle path, desktop provider choice, and deployment workflows are unaffected.

No rollback drops new tables or deletes backfilled rows. Local JSON/JSONL archives and the existing SQLite rollback tool remain untouched. A schema migration is rolled forward with another additive migration; applied migration rows are never edited. Destructive cleanup requires a later, explicit retention decision after multiple verified releases.

## First vertical slice in this change

This change implements:

- one ordered migration source shared by SQLite and Turso;
- additive household/user/preference foundations plus durable vehicle, drive, charging, cursor, sync-run, and rollup tables;
- deterministic internal IDs while retaining exact legacy drive IDs;
- transactional, idempotent SQLite/Turso Tessie snapshot upserts with retained provider payloads;
- independent drive/charge cursors, durable sync-run failures, saturated-window splitting, and a flag-gated Tessie worker isolated from both Spotify and the web request process;
- a separately gated database read path that is off by default;
- migration, stable-ID, raw-payload, retry, cursor, and integrity tests.

It deliberately does not enable production flags, run a production backfill, move route-state reads, normalize existing music rows, push, or deploy.
