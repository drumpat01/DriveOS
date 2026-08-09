# DriveOS architecture

DriveOS remains a single-user, single-process modular monolith. The desktop host starts one authenticated local HTTP backend, which serves one web application. Secrets never cross the backend/browser boundary.

## Phase 1 boundaries

- `desktop/`: Windows/WebView2 composition root. `DriveOSBackendHost` owns the child-process lifecycle and readiness probe; `DriveOSSecurityPolicy` owns session credentials, localhost boundaries, browser hardening, and the external-link allowlist.
- `src/Integrations/Tessie/`: Tessie client boundary. Backend/domain code consumes adapter functions rather than constructing Tessie HTTP requests.
- `src/Integrations/Spotify/`: Spotify client and provider-to-internal play model mapping.
- `src/Storage/`: persistence boundary. It intentionally preserves JSON and JSONL bytes and tolerant legacy reads.
- `src/Repositories/`: provider-neutral persistence contract; JSON/JSONL and SQLite implementations are available.
- `src/Domain/`: provider- and transport-independent business rules extracted feature by feature.
- `web/core/`: frontend infrastructure modules loaded before the legacy application.
- `web/components/`: presentation components extracted without changing their DOM contract or styling.
- `web/app.js`: frontend composition root and compatibility layer; active shared and feature behavior is delegated to `web/core`, `web/components`, and `web/features`.
- `tools/`: installer, administrative, validation, and deterministic release implementation scripts. Root scripts remain compatibility shims.
- `release-files.json`: allowlisted release inputs plus explicit exclusions for private/runtime-only material.
- `version.json`: canonical product/build metadata. `tools/Sync-Version.ps1` generates checked-in consumers and runs during installation.

## Dependency direction

`desktop -> backend composition root -> domain workflow -> integration/storage adapters`

`index.html -> web/core -> app.js`

Integration modules must not call UI or HTTP-server helpers. Storage must not know Tessie, Spotify, or domain concepts. New code should enter through these boundaries rather than adding provider or file-format logic to `DriveOS-Server.ps1`.

## Compatibility contract

Phase 1 does not change URLs, response shapes, file names, JSON/JSONL schemas, credential handling, launch paths, or user experience. Existing root administrative script paths remain supported. Legacy code is retained until its replacement is covered by characterization tests and runtime validation.

## Known remaining monoliths

`DriveOS-Server.ps1` still composes endpoint dispatch, authentication, server lifecycle, soundtrack enrichment, and map orchestration. `web/app.js` still contains compatibility rendering and map orchestration while active shared and feature behavior lives in modules. Public root launch/admin shims remain intentionally supported until a documented deprecation release.
