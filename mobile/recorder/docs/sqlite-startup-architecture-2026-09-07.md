# SQLite startup architecture — September 7, 2026

## Outcome

JourneyDeck now opens `journeydeck-local.db` through one explicit asynchronous startup gate. The app shell, database-backed theme/profile state, CloudKit startup, and Expo background location handlers cannot use the archive until connection hardening, additive migrations, recorder initialization, identity initialization, and a physical SQLite integrity check have completed.

This change does not alter CloudKit's role. SQLite remains the local-first source of truth on each device and CloudKit remains the private synchronization layer.

## Startup sequence

1. `DatabaseStartupGate` renders before `AppThemeProvider` or any JourneyDeck screen.
2. `prepareJourneyDeckDatabase()` coordinates one in-flight startup attempt for foreground and headless callers.
3. `openMasterDatabase()` asynchronously opens and caches the live Expo SQLite handle.
4. `prepareLocalStore()` applies the busy timeout and other connection hardening, validates the application ID and schema ceiling, runs each schema migration inside a transaction, performs the duplicate-playback repair, and requires `PRAGMA quick_check(1)` to return `ok`.
5. Recorder schema/import work runs on the same controlled handle and performs its own final quick check.
6. Local identity is initialized only after the archive is ready. The themed app and its CloudKit-backed screens then render.

Static module evaluation no longer opens the live database. Synchronous repository methods remain synchronous for compatibility, but they can only receive the handle after the asynchronous gate has opened it. The old `journeydeck-recorder.db` file may be opened separately only for the existing one-time, read-only migration; normal runtime code never receives that legacy handle.

Schema changes and multi-row critical mutations use SQLite transactions on the controlled handle. Individual writes remain atomic SQLite statements. The startup coordinator serializes migration and initialization calls within a JavaScript runtime, while the existing WAL and busy-timeout hardening covers native lock contention during process and OTA transitions.

## Recovery behavior

If open, migration, or integrity verification fails, JourneyDeck does not render database-backed screens or start synchronization. It shows a recoverable startup screen with a stable diagnostic code and an explicit **Try again** action. Retry reuses the archive and reruns only idempotent startup work; it never deletes, replaces, or recreates user data.

Failures are classified as lock/busy, integrity/application-ID, newer-schema, or general startup errors. A newer schema is preserved and requires a newer app rather than allowing an older build to modify it.

## Verification completed

- TypeScript passed.
- Complete mobile suite passed: **437/437**, zero failures and zero skips.
- Focused startup and database-hardening suite passed: **11/11**.
- Local-store suite passed: **17/17**.
- Local Atlas suite passed: **13/13**.
- Recorder/recovery focused suite passed: **11/11**.
- Production-style local iOS export passed: 2,454 modules, 84 listed assets, and a 6.8 MB Hermes bundle. The compiled bundle contains the startup gate, recovery messages, and background startup stage.
- `git diff --check` passed, with only the repository's existing line-ending warnings.

## Device testing still required

- Cold launch and foreground retry with the existing Build 22 archive on iPhone and iPad.
- Launch while a prior process or an OTA reload briefly holds the database, confirming the loading/retry screen replaces a crash.
- Background location wake after termination and during a foreground launch, confirming both callers share startup safely and no route batch is lost.
- Upgrade from a real historical schema and launch with a deliberately damaged copy, confirming migration atomicity and the non-destructive recovery screen.
- CloudKit restore/sync on two devices after startup, including airplane-mode recovery, to confirm private sync behavior is unchanged.

After verification, the user explicitly authorized production OTA publication. EAS published and server readback verified iOS update `01a07ef8-a1db-7929-84c6-433ee6e0eb4c`, group `5641758f-1235-4d2e-a183-1875ea589c96`, on production runtime `2.0.0-watch.3` with message `Gate SQLite startup and add safe recovery`. No native build, TestFlight submission, CloudKit schema action, Git staging, commit, or push was performed.
