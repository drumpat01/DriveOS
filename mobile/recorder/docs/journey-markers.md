# Journey Markers (V3)

## Experience

- During an active recording, tap **Create a marker**, or say **“Siri, create a marker in JourneyDeck V3.”** The Shortcuts action is **Create a Marker**. The installed app name is supplied by Apple's application-name phrase token.
- Capture saves the time, active recorder session, latest durable GPS fix, fix time, and accuracy. It does not open an editor or start another journey.
- The live map and completed journey route display distinct polaroid pins alongside numbered song pins. Replay reveals pins at their capture time. Selecting a saved pin pauses replay and opens its editor.
- After recording, open a journey's Markers section or **Settings → Markers**. Notes and multiple photos are saved locally. A marker can be opened from its list even if map tiles fail to load.
- Notes have an explicit Save action and unsaved-change protection. Photos use the system library picker and are normalized to JPEG (up to 2048 px wide).
- Editing is blocked while a journey is active. Capture itself remains a single action. Photos and notes are never spoken in the Siri confirmation.

## Local data and safety

Native inbox schema **4** adds `native_journey_markers`. Capture runs on the recorder's serial work queue, fenced by configured owner, control token, and exact recording session. It rejects paused/finished sessions, a GPS fix older than 30 seconds, accuracy worse than 100 m, and fixes preceding the session. Both capture time and location-fix time are retained; no location is synthesized. The marker UUID provides retry identity within the inbox.

Master schema **8** adds `local_journey_markers` and `local_marker_media`. The inbox export includes markers even when the route cursor has advanced. Route and marker import commit in the same transaction before a completed native session can be acknowledged. Import is idempotent and does not overwrite edited notes. Invalid data or failed writes roll back the import, leaving the native copy available for retry. Duplicate polling does not repeatedly notify archive subscribers.

The marker's `root_journey_id` resolves through the journey editor's immutable-root membership. Trim hides excluded markers without deleting them; Restore Original reveals them again. Split displays a marker in the matching interval; an exact split-boundary timestamp belongs to the later segment.

Attachments are copied into `Documents/journeydeck-marker-media/<escaped-profile-id>/`. Database records store generated filenames rather than absolute container paths, so a changed iOS sandbox path does not break them. A media reference is inserted only after a nonempty file copy is verified. Profile and recorder state are checked again after asynchronous copying. Failed copies remove their new destination. Account deletion removes this app-owned directory after private-cloud deletion succeeds, then user-FK cascades remove metadata.

Markers remain local-first. In the new V3 native build, Marker metadata and photos participate in the owner's private iCloud backup. They are not included in JSON exports or share cards. Raw Marker coordinates remain inside the owner's local/private-iCloud experience. Adding a future sharing path requires the existing home/work privacy mask.

### Private iCloud backup — phase 1 complete

Master schema 9 adds local revision-safe sync metadata and pending queues without enabling CloudKit transfer yet. Existing schema-8 Markers retain their IDs, notes, coordinates, journey roots, photos, and timestamps. Migration backfills Marker creation/update times from capture time and photo update times from attachment creation time.

New native imports start at revision 1 and unsynced. A changed note increments the Marker revision only when its text actually changes. Added photos have stable IDs and independent revision state; removing a photo keeps a tombstone and increments its revision instead of deleting the database row. Database triggers prevent later code from rewriting Marker capture identity or photo ownership/file identity. Legacy voice rows remain hidden compatibility data and are not included in the photo sync queue.

### Private iCloud backup — phase 2 complete

The private sync engine now maps Markers to versioned `JourneyMarker` records and photos to versioned `MarkerPhoto` assets. Both types live in a dedicated profile-scoped Marker zone. This prevents older JourneyDeck binaries from encountering record types they cannot decode. Account deletion removes the base, Journey Editing, and Marker zones before local profile cleanup proceeds.

Uploads are revision-acknowledged: a network response can mark a row backed up only when the local revision still matches the payload that was sent. Pulls process Journeys before Markers and Markers before photos, defer missing dependencies without advancing the zone cursor, reject changed immutable capture/photo identity, and use revision-first deterministic conflict handling. Physical CloudKit deletions are quarantined and requeue the surviving local copy rather than erasing the only copy.

Downloaded photos are size-checked and copied out of CloudKit's transport cache into `Documents/journeydeck-marker-media/<escaped-profile-id>/`. Cloud record fields never include the local profile ID or a device path. Photo tombstones remove the app-owned file only after the winning version has been accepted. Marker photos are normalized JPEGs with a 10 MB private-backup limit.

The checked-in development schema declares both record types, but no CloudKit environment was changed or deployed during Windows implementation. Production schema deployment remains a later explicit release action.

## Native rollout

V3 runtime is now **`3.0.0-preview.4`**. A new iOS binary is required for Expo SDK 58, the native capture method, Siri intent registration, inbox schema 4, and Marker CloudKit capability version 5. V2 runtime/identity remain unchanged. Marker shortcut registration and native capture are V3-only. Master schema 9 supplies revision-safe private-sync queues for Markers and photos; Ask JourneyDeck's database version check matches schema 9.

No native build, OTA, Git commit, or push is authorized by implementation alone. The full native implementation must not be published to runtime `3.0.0-preview.2`; do not downgrade a migrated archive to an older binary.

### Compatible OTA for installed Build 10

The explicitly requested OTA uses `EXPO_PUBLIC_JOURNEYDECK_MARKER_OTA_COMPAT=1`, alongside `APP_VARIANT=v3-preview`, `EAS_BUILD_PROFILE=v3-preview`, and `EXPO_PUBLIC_JOURNEYDECK_INTERNAL_TESTING=1`. This selects a JavaScript-only implementation and runtime `3.0.0-preview.2`. Compatibility mode is rejected during EAS native builds; omit the flag for the new native build.

Tap capture synchronizes the existing recorder inbox, validates the current native recording status and exact session, and saves a fresh real GPS fix with its timestamp. Notes, photos, route pins, replay and the marker library are available. Siri marker capture remains unavailable because the installed binary lacks the new intent.

Compatibility mode retains master schema 7 so existing native Ask continues to work. Marker records live in profile-scoped `local_preferences` keys (not cloud preferences); photos use the same private local media directory. Account deletion removes these records. Migration 8 imports OTA markers and relative media paths before deleting their preference records; migration 9 then adds and backfills sync metadata without changing captured identity. Automated tests cover upgrade preservation, profile isolation, failed media copies, and capture failures. A release bundle must be verified with compatibility enabled before publishing it to the old runtime.

## Verification

Automated coverage includes real SQLite import/rollback/reopen, duplicate import preserving notes, owner isolation, attachment-copy failure, profile change during copying, trim/restore/split boundaries, native schema SQL, Siri source generation alongside Start/Stop/Ask, recording-button double tap, note save failure, and mounted map selection/replay. Private-sync tests additionally exercise two-device metadata/photo restore, app-owned asset copying, revision-safe acknowledgements, note conflicts, photo tombstones, stale replay, missing dependencies, immutable identity collisions, separate-zone routing, and three-zone account deletion. The production iOS JavaScript export and TypeScript checks run on Windows.

Swift/App Intents compilation and physical-device acceptance remain necessary in the new build:

1. Start a journey, wait for GPS, create a marker by tap, then use Siri while the app is backgrounded and while the phone is locked. Confirm one marker per successful invocation after reopening.
2. Ask without an active journey, while paused, and with a stale GPS fix. Confirm truthful failure and no invented marker or new journey.
3. Finish the journey. Confirm real coordinates and timestamps, song pins plus polaroid pins, replay timing, and access through Settings → Markers.
4. Save notes and attach and remove selected photos. Restart the app and verify all retained content.
5. Trim/split/restore and verify markers follow visible intervals. Switch profiles and verify isolation; test account deletion in an expendable profile only.
6. Check iPhone, iPad portrait/landscape, narrow Split View, Dynamic Type, all themes, and VoiceOver. Confirm unsaved-note protection and photo controls remain usable.
