# JourneyDeck iOS database map

JourneyDeck iOS is a local-first system with two private SQLite files. The two
files have different jobs and must be reviewed together.

## File boundaries

| File | Owner | Purpose | Cloud behavior |
| --- | --- | --- | --- |
| `journeydeck-local.db` | `src/local-store.ts` | Durable master archive for profiles, completed journeys, exact routes, music, named places, memories, collections, photos, private preferences, and derived Atlas statistics | Selected records are mirrored only to the signed-in user's private CloudKit database. Exact routes are checksummed private assets. |
| `journeydeck-recorder.db` | `src/storage.ts` | Crash-tolerant active recording queue, pending route/music upload state, Last.fm retry state, and profile-scoped UI caches | Queue rows can be retried against the legacy JourneyDeck recorder service; completion is also mirrored into the master archive. |

Both databases use WAL mode, foreign-key enforcement, a five-second busy
timeout, bounded WAL growth, `secure_delete=FAST`, and `synchronous=NORMAL`.
They have distinct SQLite `application_id` values so one file cannot silently be
opened as the other. Opening a database created by a newer app schema fails
closed instead of attempting a downgrade.

`src/database-owner.ts` is the only runtime module that opens these files.
Archive, recorder, and Atlas code share one intentional Expo SQLite handle per
file, preventing a connection-wide PRAGMA from leaking between independently
opened JavaScript wrappers.

## Master archive schema (`journeydeck-local.db`, version 5)

```text
local_users
├── local_journeys
│   ├── local_gps_points
│   └── local_music_entries (optional journey; SET NULL on journey delete)
├── local_places
├── local_collections
│   └── local_photos (collection-owned)
├── local_memories
│   └── local_photos (memory-owned)
├── local_private_preferences
├── local_cloud_deletion_quarantine
└── local_atlas_snapshots

local_preferences (device-level active-profile selection)
```

### Tables

- `local_users`: local profile root. `apple_subject` is unique when Sign in with
  Apple is linked. Deleting a confirmed account cascades through user-owned
  master data.
- `local_journeys`: one completed journey summary, endpoint coordinates, named
  place references, source/provider metadata, and summary/route sync revisions.
- `local_gps_points`: ordered exact route samples keyed by
  `(journey_id, sequence)`.
- `local_music_entries`: Apple Music, Shazam, Last.fm, or Spotify observations.
  The optional journey reference must belong to the same local profile.
- `local_places`: user-named or geocoded places and match radii. Home and Work
  coordinates remain local; named-place labels are private preference data.
- `local_collections`: collection metadata. `journey_ids` is a legacy JSON array
  retained for CloudKit and API compatibility.
- `local_memories`: memory metadata. `collection_ids` is a legacy JSON array.
- `local_photos`: metadata and private local file path for exactly one Collection
  or Memory owner. The owner and photo must belong to the same profile.
- `local_private_preferences`: profile-scoped, versioned JSON values suitable for
  private CloudKit sync.
- `local_cloud_deletion_quarantine`: records unexpected physical CloudKit
  deletions without deleting the surviving on-device source of truth.
- `local_atlas_snapshots`: disposable derived statistics. The underlying journey
  and music rows remain authoritative.
- `local_preferences`: device-only values such as the active local profile.

## Recorder schema (`journeydeck-recorder.db`, version 2)

```text
recording_sessions
├── recording_points
├── recording_music_observations
├── recording_lastfm_sync
└── recording_jobs

recording_app_cache (keys are prefixed with the active profile id)
```

- `recording_sessions`: active and recently completed recorder state. At most
  one non-completed session is allowed per profile.
- `recording_points`: ordered, bounded GPS samples and upload acknowledgements.
- `recording_music_observations`: normalized per-session music observations and
  upload acknowledgements.
- `recording_lastfm_sync`: bounded retry state for a completed session.
- `recording_jobs`: durable, profile-owned completion work for the archive
  mirror, Apple Music history/artwork, private iCloud sync, and optional legacy
  remote completion. Jobs use bounded leases, dependency ordering, exponential
  retry backoff, and privacy-safe error codes.
- `recording_app_cache`: JSON UI/cache state. Keys are profile-scoped; values
  are validated JSON and capped at 4 MiB to allow legacy cached photo payloads.

## Completion and recovery

Recorder completion is intentionally local-first:

1. One recorder transaction marks the session completed and inserts all of its
   deterministic completion jobs.
2. JourneyDeck immediately attempts the highest-priority archive-mirror job so
   the journey appears without waiting for a provider or network.
3. A deterministic journey id (`local_<recording-session-id>`) is upserted into
   `journeydeck-local.db`; exact points and deterministic music ids follow.
4. The durable worker captures Apple Music history, resolves and disk-caches
   artwork against that archived journey id, then refreshes the mirror.
5. Private iCloud and optional legacy remote completion run only after the
   archive and music dependencies succeed.

SQLite cannot make one transaction span both files through the Expo API, so the
handoff is not physically atomic. It is idempotent: rerunning the mirror updates
the same journey and ignores the same point keys instead of duplicating them.
More importantly, the intent to mirror is now committed atomically with the
recorder completion. If the app is terminated between the two database writes,
the leased job expires and is retried after launch. Recent completed sessions
are mirrored again after music/artwork enrichment. The recorder row remains
available for retry.

## Enforced integrity rules

Schema version 5/1 adds database-level guards for:

- immutable primary identity and profile ownership on updates;
- cross-profile journey/place, journey/music, Collection/Memory/photo, and JSON
  relationship references;
- valid coordinate ranges, coordinate pairs, sequence numbers, speeds,
  headings, distances, counts, sync flags, and revisions;
- valid timestamps for journeys, recordings, points, and music observations;
- nonempty names required by the UI;
- valid JSON arrays for Collection/Memory membership and valid JSON for private
  preferences/caches;
- a single active recording session per profile;
- bounded recorder cache entries and valid queue acknowledgement flags.

Indexes cover profile/time pagination, sync queues, legacy journey lookup,
place proximity candidates, recorder queues, and completed-session recovery.

## Runtime integrity checks

Data Health now runs read-only reports for both files. Analytics code issues
only `SELECT` queries on its read connection; it does not use SQLite
`PRAGMA query_only` because Expo may share native handles for the same file:

- SQLite `quick_check`;
- `foreign_key_check`;
- cross-profile relationship checks;
- malformed/range-invalid row counts;
- duplicate active recorder-session detection;
- pending completion-job and expired-lease counts;
- expected application id and migration version.

These checks do not upload row values, coordinates, file paths, or identifiers.

## Security and privacy notes

- SQLite files live in the iOS application sandbox and receive iOS filesystem
  protection. They are not SQLCipher databases; JourneyDeck does not claim
  column-level SQLite encryption.
- Apple credentials and provider tokens do not belong in either SQLite file;
  they are stored through iOS Secure Store/Keychain code paths.
- WAL can temporarily contain recently changed pages. Bounded WAL size and
  `secure_delete=FAST` reduce unnecessary remnants without trading away recorder
  reliability.
- `local_collections.journey_ids` and `local_memories.collection_ids` remain JSON
  arrays for backward compatibility. They are now validated and profile-checked,
  but a future major schema can normalize them into junction tables after all
  CloudKit and UI consumers are migrated together.
