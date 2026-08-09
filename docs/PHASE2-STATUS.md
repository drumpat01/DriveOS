# Phase 2 status

Phase 2 is active on `refactor/modular-monolith-phase2`.

## Completed checkpoints

- JSON/JSONL persistence is now selected through a repository contract rather than directly by domain workflows.
- Sanitized tests pin all current API route registrations and representative response-model behavior.
- Vehicle mapping, replay state projection, friendly places, charging calculations, music statistics, and drive statistics live in domain modules.
- The backend keeps compatibility wrapper functions, so endpoints and callers remain unchanged while logic moves incrementally.

## Still to extract

- drive reconstruction and soundtrack matching
- monthly recap aggregation
- Spotify playlist orchestration
- HTTP routing, request validation, authentication, and response serialization
- frontend feature modules planned for Phase 3

## SQLite gate

SQLite is not enabled yet. The current installation has no SQLite executable or managed provider, and adding an unverified dependency would make DriveOS less reliable. Before changing the repository provider, the branch must include:

1. a pinned, redistributable Windows-compatible SQLite runtime;
2. provider signature/hash verification in the installer;
3. schema migrations and foreign-key/integrity checks;
4. timestamped source-file backup before import;
5. transactional JSON/JSONL import with stable-ID and row-count verification;
6. an explicit rollback/export command;
7. tests for duplicate plays, malformed legacy lines, missing `track_uri`, aliases, settings, ordering, and repeat startup.

JSON/JSONL remains the production provider until every gate passes. Existing data will never be deleted automatically.
