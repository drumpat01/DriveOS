# Phase 4 status

Phase 4 completes the planned modular-monolith migration without changing DriveOS URLs, data formats, credentials, or user experience.

## Delivered

- Desktop backend process lifecycle, installation checks, readiness polling, logs, and shutdown are owned by `DriveOSBackendHost`.
- Session token generation, localhost trust, WebView hardening, and the external navigation allowlist are owned by `DriveOSSecurityPolicy`.
- The installer compiles all desktop sources in a stable order and supports staging output without changing the user's desktop shortcut.
- `release-files.json` is the release allowlist and privacy denylist.
- `tools/Build-Release.ps1` stages a release, compiles the desktop host, writes SHA-256 metadata, and creates a stable-order archive.
- `tools/Test-CleanInstall.ps1` validates required files, privacy exclusions, compilation, and every recorded checksum in an isolated staging folder.
- The inactive pre-Phase-2 monthly recap implementation was removed. Public root launch/admin shims remain supported until an announced deprecation release.

## Still intentionally composed in legacy roots

- `DriveOS-Server.ps1` remains the backend composition root for routing, authentication, lifecycle, soundtrack enrichment, and map orchestration.
- `web/app.js` remains the frontend composition/compatibility root for rendering and map orchestration.
- JSON readers remain available for SQLite rollback; source JSON/JSONL is never automatically deleted.

These are maintenance targets, not reasons for another broad rewrite.
