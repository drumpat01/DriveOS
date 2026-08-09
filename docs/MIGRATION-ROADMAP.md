# Modular monolith migration roadmap

## Phase 1 — seams and safety (this branch)

Canonicalize version metadata; add integration and storage boundaries; extract frontend infrastructure; relocate operational scripts behind compatibility shims; document dependencies; add offline validation. Preserve all public behavior and JSON/JSONL persistence.

## Phase 2 — domain modules and SQLite

1. Add characterization tests for every API endpoint using recorded, sanitized provider fixtures.
2. Extract `Vehicle`, `Drives`, `Music`, `Charging`, `Places`, `Recaps`, and `Replay` domain modules from the server.
3. Define repository contracts for listening history, aliases, settings, and cached provider data.
4. Introduce SQLite behind those repository contracts. On first start, create a timestamped backup, import JSON/JSONL transactionally, verify row counts and stable IDs, then mark migration complete. Keep the JSON reader available for rollback for at least one release; never delete source data automatically.
5. Add schema migrations, integrity checks, and backup/restore commands. Do not place OAuth tokens in SQLite unless the DPAPI protection contract is retained and tested.
6. Split HTTP routing/security from application services.

## Phase 3 — frontend feature modules

Extract one vertical feature at a time (`drives`, `music`, `charging`, `places`, `recaps`, `replay`) with shared API, formatting, state, and DOM utilities. Keep route IDs, selectors, markup, styling, keyboard behavior, and PWA caching stable. Add browser smoke tests before removing the legacy implementations.

## Phase 4 — host and release hardening

Separate desktop lifecycle/security policy from WebView composition, automate version/release artifact generation, add clean-machine installer tests, and remove compatibility shims only after a deprecation window.

## SQLite recommendation

SQLite belongs in Phase 2, not Phase 1. The safe trigger is complete repository interfaces plus fixtures that prove the import preserves history ordering, duplicate handling, timestamps, legacy `track_uri` reconstruction, aliases, and settings. Prefer a single local database with WAL mode, foreign keys enabled, explicit migrations, and a read-only diagnostic/export path.
