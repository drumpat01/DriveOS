# JourneyDeck iOS unified data system

JourneyDeck iOS is local-first. The Expo runtime has one canonical private
SQLite database and one connection owner for journeys, places, songs, albums,
and artwork. Build 12 gives the background Swift recorder a separate, narrow
SQLite inbox so two different SQLite libraries never share a WAL file.

## Active file boundary

| File | Runtime role | Cloud behavior |
| --- | --- | --- |
| `journeydeck-local.db` | The canonical application database. Expo SQLite is its sole connection owner. It contains profiles, imported recorder staging, completion jobs, completed journeys, exact routes, canonical places, normalized music/artwork, memories, collections, photos, private preferences, and derived statistics. | Selected user-owned records can mirror to the signed-in user's private CloudKit database. Exact routes are checksummed private assets. |
| `journeydeck-native-inbox.db` | Build 12's native-only recorder inbox. Apple system SQLite is its sole connection owner. It contains only native recording sessions and GPS points awaiting typed import into the canonical database. | Never syncs directly. A completed session is deleted only after the canonical database proves every numbered route point was committed and durable completion jobs were queued. |
| `journeydeck-recorder.db` | Pre-Phase-2 migration source only. It is opened once for validation/import when it already exists. It is never used for normal runtime reads/writes and is retained untouched as a rollback source. | None after Phase 2. |

`src/database-owner.ts` is the only module that opens SQLite files. Both archive
and recorder APIs receive the same `journeydeck-local.db` handle. The legacy
recorder opener is deliberately separate and is reachable only by the one-time
migration.

Build 12's Swift recorder opens only `journeydeck-native-inbox.db` with Apple
system SQLite, `SQLITE_OPEN_FULLMUTEX`, foreign keys, full synchronous commits,
and rollback-journal mode. Expo never opens that file, and Swift never opens
`journeydeck-local.db`. A typed native bridge exports incremental value-object
snapshots; Expo imports them transactionally through the canonical connection.
The inbox is a durable handoff queue, not a second domain archive.

The active database uses WAL mode, foreign-key enforcement, a five-second busy
timeout, bounded WAL growth, `secure_delete=FAST`, and `synchronous=NORMAL`.
Its SQLite `application_id` remains `JDL1`; its schema version is 6.

## Unified schema (`journeydeck-local.db`, version 6)

```text
local_users
├── local_journeys
│   ├── local_gps_points
│   ├── local_music_entries ── local_songs ── local_albums
│   │                                │              │
│   │                                └──── local_artworks
│   └── start/end place ───── local_places ── local_place_aliases
├── local_collections ── local_photos
├── local_memories ───── local_photos
├── local_private_preferences
├── local_cloud_deletion_quarantine
└── local_atlas_snapshots

recording_sessions (active/recovery staging)
├── recording_points
├── recording_music_observations
├── recording_lastfm_sync
└── recording_jobs

recording_app_cache
local_migration_state
local_preferences (device-level active-profile selection)
```

### Canonical domain records

- `local_journeys` is the authoritative completed-journey record. Recorder rows
  are crash-recovery staging and durable job inputs, not a second archive.
- `local_places` is the authoritative label and match area for a physical place.
  Every matching journey endpoint stores that place id. Renaming the place once
  changes the label resolved by every linked journey. `local_place_aliases`
  preserves old ids while converging them on the same canonical row.
- `local_songs` holds one normalized title/artist identity per profile.
  `local_albums` shares album metadata and artwork across songs.
  `local_artworks` stores one remote cover reference and its disk-cache state.
- `local_music_entries` remains the immutable fact that a song played at a time
  on a journey. Its `song_id` points to canonical metadata; legacy text columns
  remain as a preservation fallback and for CloudKit compatibility.
- `local_gps_points` is the authoritative exact route for a completed journey.
- Collections, Memories, photos, private preferences, and disposable Atlas
  snapshots retain their prior roles and profile boundaries.

### Recorder staging and recovery

- `recording_sessions` and child rows hold an active drive and recently
  completed raw samples until all durable completion work succeeds.
- `recording_jobs` handles archive materialization, Apple Music history/artwork,
  private iCloud sync, and optional legacy remote completion with bounded
  leases and exponential retry.
- Completion commits its durable intent locally before asynchronous provider
  work. Replaying a job upserts deterministic journey, point, and playback ids,
  so termination never creates duplicates.

### Build 12 native automatic recorder

- The Swift engine monitors significant location changes while idle and enables
  high-accuracy automotive updates only while confirming motion or recording.
- Start and parking decisions use multiple bounded-accuracy samples. Five
  continuously parked minutes complete the journey; ordinary traffic stops do
  not.
- Detection state and the native session id survive UI termination. Coordinates
  are written only to the protected native inbox, never to preferences or the
  Expo database from Swift.
- Expo imports only new point sequences. A completed session stays behind a
  finishing fence until the canonical database contains the complete contiguous
  route. Only then are archive materialization, Apple Music history/artwork,
  private CloudKit sync, and optional remote completion queued and the native
  session acknowledged for deletion.
- The Build 10 Expo automatic task is unregistered during upgrade and retained
  only as a harmless legacy task definition so an already-installed background
  registration cannot execute old detector logic.
- Native sessions use a distinct `native_recording_` prefix. The engine never
  adopts a Build 10, manual, or otherwise foreign active session.
- Arrival enrichment first asks native MapKit for nearby points of interest,
  then falls back to Apple's reverse geocoder. Saved user names remain
  authoritative and canonical place ids propagate a rename to matching journeys.

## Phase 2 migration and preservation

Schema migration is additive and transactional:

1. Version 6 creates canonical place/music/artwork tables and recorder staging
   tables inside `journeydeck-local.db`.
2. Existing music entries are linked to deterministic shared song, album, and
   artwork records without deleting their legacy metadata.
3. Existing journey endpoints are linked to the best matching saved/geocoded
   place. Later place creation also relinks every matching endpoint.
4. If `journeydeck-recorder.db` exists, JourneyDeck validates its application
   id, supported schema, required tables, and SQLite `quick_check` before copy.
5. All legacy sessions, points, music observations, Last.fm state, cache rows,
   and jobs copy into the unified database in one transaction. Running leases
   become retryable jobs.
6. Source and destination row counts must match before the migration marker can
   commit. A failed or interrupted import rolls back and retries on next launch.
7. The source file is closed, never updated or deleted, and remains available as
   an inert rollback artifact.

The executable preservation test uses the same SQL builder as the iOS runtime
and verifies both the unified copies and the unchanged legacy source.

The Build 11 upgrade fixture starts from a schema-5 Build 10 archive plus a
separate legacy recorder database, applies the production migration, and proves
that the profile, completed journey, Collection, Memory, active recorder
session, and every GPS point survive. It also runs `quick_check` and
`foreign_key_check` and confirms the legacy source remains unchanged.

## CloudKit reliability boundary

- The native transport retries bounded transient failures and honors Apple's
  server-provided retry delay.
- Partial record failures return per-record retry metadata. A server-won
  conflict is applied locally instead of being reported as a failed upload.
- Downloaded assets are copied into staging and atomically replaced before they
  become visible to the local store.
- Server change tokens are staged during download and committed only after the
  JavaScript ingestion transaction succeeds. Expired tokens are cleared and
  trigger a safe full refetch.
- A partial sync remains retryable and cannot enter the automatic-sync success
  cooldown. Completion jobs honor the server's minimum retry time.

## Artwork lifecycle

Journey completion captures Apple Music history, resolves only exact
title/artist catalog matches, and requests compact 256-pixel artwork. Expo Image
prefetches those HTTPS covers into its disk cache. A successful prefetch updates
the shared `local_artworks` row to `cached`, so every playback of the same
song/album recalls the same cached cover instead of maintaining per-journey
artwork copies.

## Enforced integrity and diagnostics

Database triggers and Data Health checks cover:

- immutable identity and profile ownership across journeys, places, aliases,
  music facts, songs, albums, artwork, Collections, Memories, and photos;
- valid coordinates, timestamps, ranges, counts, JSON, cache state, and HTTPS
  artwork references;
- a single active recorder session per profile and valid durable job leases;
- missing canonical song links, cross-profile graph edges, `quick_check`, and
  `foreign_key_check` results.

Data Health presents the canonical unified database plus recorder/job health.
The native inbox is a bounded delivery queue and does not upload row values,
coordinates, paths, or identifiers.

## Security and privacy notes

- The database lives in the iOS application sandbox and receives iOS filesystem
  protection. JourneyDeck does not claim SQLCipher or column-level encryption.
- Apple credentials and provider tokens remain in iOS Secure Store/Keychain,
  never SQLite.
- WAL can temporarily contain changed pages. Bounded WAL size and
  `secure_delete=FAST` reduce unnecessary remnants without weakening recorder
  reliability.
- Legacy JSON arrays for Collection/Memory membership remain validated for
  CloudKit compatibility; a later major schema can normalize those after every
  consumer migrates together.
