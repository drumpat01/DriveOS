# Modular monolith migration roadmap

## Phase 1 — seams and safety (this branch)

Canonicalize version metadata; add integration and storage boundaries; extract frontend infrastructure; relocate operational scripts behind compatibility shims; document dependencies; add offline validation. Preserve all public behavior and JSON/JSONL persistence.

## Phase 2 — domain modules and SQLite (complete)

1. Add characterization tests for every API endpoint using recorded, sanitized provider fixtures.
2. Extract `Vehicle`, `Drives`, `Music`, `Charging`, `Places`, `Recaps`, and `Replay` domain modules from the server.
3. Define repository contracts for listening history, aliases, settings, and cached provider data.
4. Introduce SQLite behind those repository contracts. On first start, create a timestamped backup, import JSON/JSONL transactionally, verify row counts and stable IDs, then mark migration complete. Keep the JSON reader available for rollback for at least one release; never delete source data automatically.
5. Add schema migrations, integrity checks, and backup/restore commands. Do not place OAuth tokens in SQLite unless the DPAPI protection contract is retained and tested.
6. Split HTTP routing/security from application services.

## Phase 3 — frontend feature modules (complete)

Frontend foundations and feature modules now cover navigation, PWA, theme, ignition, refresh, drives, music, charging, places, recaps, and replay calculations. Route IDs, selectors, markup, styling, keyboard behavior, and PWA behavior remain stable, with deterministic and browser smoke coverage.

## Phase 4 — host and release hardening (complete)

Desktop backend lifecycle and WebView security policy are separate internal boundaries. Release inputs are allowlisted, builds have sorted inputs and a checksum manifest, archives have stable entry order/timestamps, and clean staging validates compilation, required files, privacy exclusions, and hashes. The unused legacy recap implementation was removed after Phase 2/3 contract coverage. Public root compatibility shims remain because their deprecation window has not elapsed.

## Post-roadmap maintenance

The four-phase modular-monolith migration is complete. Further work should be normal feature-sized maintenance: shrink the server composition root route by route, remove frontend compatibility renderers only after browser coverage owns them, exercise SQLite migration/rollback against copies of real datasets, and retire public root script shims only in a separately announced breaking release.

DriveOS 4.1.0 is the first post-roadmap provider extension: a Last.fm adapter feeds the existing listening-history repository without changing its storage contract. This is the intended pattern for future Tessie, music, mapping, and place-provider additions.

## SQLite implementation

SQLite is available behind the repository interface as an explicit, reversible migration. DriveOS uses a single local database with WAL mode, an indexed listening-history table, schema migrations, integrity checks, timestamped source backups, and JSON rollback. Source JSON/JSONL is retained.
