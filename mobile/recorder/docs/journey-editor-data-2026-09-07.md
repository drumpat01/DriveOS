# Journey Editing Studio — persistence and private sync

Implemented locally on September 7, 2026. No native build, OTA, CloudKit production-schema deployment, or Git publication was performed by this work.

## Data contract

- `loadJourneyEditor(userId, journeyId)` returns the complete original route, original summary, the current saved parts, current playback metadata, an optimistic review token, and a stable proposed split-part ID.
- `previewJourneyEdit(snapshot, selection)` is pure. Trim interpolates boundary coordinates; split assigns a playback beginning exactly on the split to the later part. It preserves sibling parts and computes miles, time and playback counts. Restore previews the original recorded totals.
- `commitJourneyEdit(snapshot, selection)` rereads native StoreKit entitlement for Trim/Split, rereads native recording status, checks the active profile and local recorder, and compares the current authoritative content with the reviewed snapshot. Backup acknowledgements alone do not invalidate a review. Restore remains available after a membership downgrade.
- `getJourneyEditConflictChoices` and `resolveJourneyEditConflict` implement explicit keep-current/use-other decisions. A resolution is another immutable operation, not deletion of the competing version. The editor displays both saved summaries before asking which one to use.

## Original preservation and consistency

Schema 7 adds `local_journey_edit_operations`, `local_journey_edit_heads`, `local_journey_edit_members`, and `local_journey_edit_music`. It drops no existing table or column. Operation payloads retain the original summary, exact GPS samples and music metadata; SQLite triggers prohibit overwriting saved operation payloads. Profile deletion cascades to the new tables.

Each save materializes only the current visible result: the original Journey ID represents the first part and split parts receive new identifiers. The unedited original exists in the recovery operation, not as a second counted Journey row. One synchronous SQLite transaction writes the operation, GPS, summary, song associations, Memory/Collection link deltas, active head and retired-part registry. A failure rolls all of these back. Restoring removes current split projections and reconstitutes the original GPS sequence and summary while retaining later-discovered music.

Songs are reassigned by their recorded start timestamp without duplicating listening-history rows. Songs outside a trim remain saved with no Journey association. Old recorder completion passes and ordinary cloud Journey/RouteArchive/MusicEntry records cannot replace editor-owned projections or resurrect a retired split ID. Later songs arriving for the source recording are mapped into the appropriate current part. Memory changes replace only affected Journey IDs; independent renames, photos and other Journey links remain.

The editor notifies existing archive subscribers and invalidates the saved Atlas snapshot. The UI integration also refreshes the archive and treats editor-owned route/song data as authoritative over legacy cached originals.

## Private iCloud design

Each operation uploads as one immutable, SHA-256-checked `JourneyEdit` asset, with its ID, original root ID and parent-operation ID. The complete original and resulting time ranges travel together, so another device never applies half a split. In-batch ancestors are processed first; absent parents defer with the change token retained. Conflicting branches remain stored and appear in sync diagnostics and the editor. Physical cloud deletions quarantine the event and requeue a surviving local recovery copy.

The native transport advertises private-content version 4 / transport version 5. Editor assets use a **separate derived private zone** in the existing container. Old clients never receive the new record type in their ordinary zone. The current account-deletion path drains uploads and deletes both zones under the existing persistent deletion barrier.

Ordinary records are rechecked for editor ownership after asynchronous asset preparation. This prevents an edit made during preparation from sending an old summary with a newly trimmed route.

All complete route and original assets remain in the app sandbox and the user's private CloudKit container. They are not sent to the application server or privacy edge. Normal share/export privacy masking remains mandatory; these recovery payloads are not public export artifacts.

## Verification

Executed actual production TypeScript against Node's SQLite, not an in-memory imitation of the mutations:

- Trim interpolation, current totals, exact original preservation (including valid cached GPS fixes just outside the recording summary), unlinked outside songs and restoration without Plus.
- Split boundary assignment, repeated splitting, sibling preservation, no duplicate counted Journey rows, independent Memory rename/link preservation, later music discovery and restoration.
- Paid-access enforcement, native recording blockade, wrong-profile rejection and stale-review rejection before mutation.
- Injected SQLite failure rolls back summary, routes, songs, Memories and operation history together.
- Remote restoration, missing-parent deferral, retired-child rejection and old-route replay rejection.
- Two-device conflicting edits preserve both copies and explicit resolution converges.
- SQLite operation immutability, foreign-key integrity and schema version.
- Backup acknowledgements do not invalidate an otherwise unchanged preview.
- Dedicated editor-zone routing, both-zone account deletion, checksum corruption rejection, reversed incoming operation order and physical-deletion requeue.
- An edit committed during ordinary route-asset preparation takes ownership before push.

Targeted command: `node --experimental-strip-types --test tests/journey-editor.test.mts tests/private-library-sync.test.mts tests/database-hardening.test.mts tests/cloudkit-sync.test.mts` — **42 passed**. TypeScript passed after these changes. Native Swift has not been compiled in this task.

## Release/device acceptance still required

1. Ship schema 7 only in the new isolated runtime. An older schema-6 bundle must not be offered as its OTA rollback. Installation over an existing library must retain all prior data.
2. Compile the native transport and verify `JourneyEdit` support. Confirm/deploy the CloudKit production record schema before release: `id`, `rootJourneyId`, nullable `parentId`, `formatVersion`, `sha256`, `syncRevision`, `updatedAt`, plus the `asset` CKAsset field. No production schema change was made here.
3. Test two physical iOS devices on the new build: offline trim/split/restore, concurrent edits, explicit conflict choices, original/photo/music preservation, iCloud quota/network failures, and account deletion from the new build.
4. Old builds continue to display their last ordinary/unedited projections. They do not understand editor operations, and deletion initiated by an old build cannot remove the new editor zone. Upgrade all devices before expecting edited views and complete current account-deletion behavior across devices.
5. Test recording/Watch transitions, Keychain/phone lock, app termination and low storage during save. Native recording and SQLite checks are verified with fixtures; real native races and power-loss recovery still need device acceptance.
6. Check iPhone/iPad interaction and accessibility, all four themes, reduced motion, actual handle responsiveness and the smoke effect on long routes. Full precision is computed at review/save; the animated display uses sampled route data.

Limits: at least two valid timestamped GPS samples; ten seconds per newly trimmed/split part; maximum 16 parts, 100,000 original GPS samples and a 20 MiB recovery asset. Oversized or invalid recordings are rejected before mutation. Original operation history is retained; no automatic pruning or public export of that history is introduced.
