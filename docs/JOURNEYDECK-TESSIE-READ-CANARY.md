# JourneyDeck Tessie read-canary runbook

This runbook moves the existing 30-day drive and charging screens from Tessie request-path reads to JourneyDeck's database. It does not cover route telemetry, history older than 30 days, or deployment authorization.

## Preconditions

- `JOURNEYDECK_TESSIE_DB_WRITE_ENABLED=true`
- `JOURNEYDECK_TESSIE_DB_READ_ENABLED=false`
- `JOURNEYDECK_TESSIE_READ_CANARY_APPROVED=false`
- At least two independent Tessie workflow runs have completed successfully.
- Both `tessie/drives` and `tessie/charges` cursors have no current error.
- Both cursors have succeeded and advanced within `JOURNEYDECK_TESSIE_READ_MAX_STALENESS_MINUTES` (45 minutes by default).
- The repository provider is Turso in production or SQLite for a local rehearsal.

## Generate the readiness report

Before using production credentials, rehearse the ordered migrations, synthetic ingestion, correction retry, parity readiness, and nondestructive rollback on a newly created isolated Turso database:

```powershell
.\tools\Test-JourneyDeckTursoRehearsal.ps1 -ConfirmIsolatedDatabase
```

The rehearsal intentionally retains uniquely namespaced synthetic rows in that isolated database for audit. Never point it at production.

### Recorded isolated-Turso evidence

On 2026-08-14, a disposable Turso database (`journeydeck-rehearsal-20260814-160707-a50e`) was exercised from the SuperRedux checkout with Turso CLI 1.0.31. Schema initialization and the existing state, alias, setting, and listening-history round trips passed using synthetic data. The one-day write token was not printed, process credentials were cleared, the database was destroyed, and its absence was independently confirmed. Production was not accessed.

That checkout created its own untracked rehearsal script and did not contain this unpushed Tessie vertical slice. Therefore, the result is evidence that the established repository contract works against real Turso; it is not a substitute for running the canonical `tools/Test-JourneyDeckTursoRehearsal.ps1` from the exact release candidate. The canonical harness additionally verifies ordered migrations, Tessie correction upserts, retry/cursor behavior, read readiness, and nondestructive rollback. Run it against a fresh disposable database after the candidate source is available on the rehearsal host and before enabling any rollout flag.

The exact local candidate passed `tools/Test-DriveOS.ps1` with the bundled Node runtime, `tools/Test-ReleasePreflight.ps1`, the shared-drive soundtrack and release-workflow suites, both standalone Node test files, and `git diff --check` on 2026-08-14. These checks validate the offline and mocked contracts but do not remove the exact-source real-Turso gate above.

Run the manual **Audit Tessie read readiness** workflow from the exact candidate commit. The workflow uses the repository's existing Turso and Tessie secrets, forces the Turso repository provider, enforces the 30-day window and 45-minute cursor limit, and fails unless the report is ready. It writes only counts and pass/fail status to the Actions summary. The full privacy-safe report is retained as a workflow artifact for 14 days.

For a local or isolated environment with the same repository credentials and Tessie token as the target instance, the equivalent command is:

```powershell
.\tools\Test-JourneyDeckTessieParity.ps1 -RequireReady
```

The default local report is `data/journeydeck-tessie-parity.json` (or the configured web data directory). The Actions workflow instead writes to the runner's temporary directory. Both report forms contain no VIN, locations, or provider payloads. Archive the report with the rollout record before changing flags.

The report must say `status: ready` and `readyForReadCanary: true`. The gate fails when a cursor is absent or stale, either resource has an error, identities or UTC-day counts differ, normalized columns differ, payload hashes differ, or the existing drive/charge compatibility projections differ.

## Canary activation

After explicit deployment authorization:

1. Set `JOURNEYDECK_TESSIE_READ_CANARY_APPROVED=true`.
2. Set `JOURNEYDECK_TESSIE_DB_READ_ENABLED=true`.
3. Restart the service once.
4. Verify owner/Full Mode and Wife Mode see the same journeys and soundtrack data.
5. Exercise drives, charging, dashboard statistics, recaps, favorite routes, places, search/assistant, map authorization, and share-card privacy.
6. Confirm live vehicle state still refreshes from Tessie and both sync cursors continue moving.

The approval flag is deliberately separate. The server refuses to start with database reads enabled unless approval and the external-worker flag are both true and both resource cursors are fresh and error-free, preventing an accidental or stale cutover.

## Rollback

Set `JOURNEYDECK_TESSIE_DB_READ_ENABLED=false` and restart. Provider-backed historical reads resume immediately. Leave the approval flag and durable rows intact for diagnosis; neither changes data. If ingestion is implicated, disable `JOURNEYDECK_TESSIE_DB_WRITE_ENABLED` separately.

Rollback does not drop migrations, delete rows, change authentication, affect Spotify synchronization, or alter Wife Mode permissions.
