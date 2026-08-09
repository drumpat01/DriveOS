# Phase 2 status

Phase 2 is complete on `refactor/modular-monolith-phase2`.

## Completed checkpoints

- JSON/JSONL persistence is now selected through a repository contract rather than directly by domain workflows.
- Sanitized tests pin all current API route registrations and representative response-model behavior.
- Vehicle mapping, replay state projection, friendly places, charging calculations, music statistics, and drive statistics live in domain modules.
- Drive response mapping, monthly recaps, playlist orchestration, and HTTP validation/error policy live behind domain, application, and transport boundaries.
- SQLite 3.53.4 is installed from the official archive with a pinned SHA-256 checksum.
- Migration creates timestamped backups, imports tolerant legacy data, verifies counts and integrity, and switches providers only after success.
- Rollback switches immediately to the unchanged JSON/JSONL source files.
- The backend keeps compatibility wrapper functions, so endpoints and callers remain unchanged while logic moves incrementally.

## Deliberately retained compatibility code

- The backend composition root still contains endpoint dispatch, authentication, server lifecycle, soundtrack enrichment, and map orchestration.
- The previous recap implementation remains as `Get-MonthlyRecapsLegacy` for one validation/release window. It is not called by production routes.
- JSON/JSONL readers remain supported for rollback and export compatibility.
- Frontend feature extraction belongs to Phase 3.

## SQLite gate

SQLite is opt-in rather than silently enabled. Run `tools/Migrate-To-Sqlite.ps1`; use `tools/Rollback-To-Json.ps1` to switch back. The completed safety gates are:

1. a pinned, redistributable Windows-compatible SQLite runtime;
2. provider signature/hash verification in the installer;
3. schema migrations and foreign-key/integrity checks;
4. timestamped source-file backup before import;
5. transactional JSON/JSONL import with stable-ID and row-count verification;
6. an explicit rollback/export command;
7. tests for duplicate plays, malformed legacy lines, missing `track_uri`, aliases, settings, ordering, and repeat startup.

Existing JSON/JSONL files are never deleted automatically. A new install continues with JSON until migration is explicitly run.
