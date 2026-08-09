# Phase 3 status

Phase 3 is complete on `refactor/modular-monolith-phase3`.

## Extracted frontend boundaries

- `web/core/`: build metadata, API client, DOM helpers, shared state, and platform detection.
- `web/components/`: reusable song-artwork presentation.
- `web/features/navigation.js`: view routing and mobile navigation placement.
- `web/features/pwa.js`: remote/PWA detection, registration, install banner, and cache cleanup.
- `web/features/theme.js`: theme persistence and controls.
- `web/features/ignition.js`: launch sequence plus the desktop-host compatibility entry point.
- `web/features/places.js`, `charging.js`, and `recaps.js`: vertical API/render/action modules.
- `web/features/refresh.js`: initial loading, manual refresh, and polling schedules.
- `web/features/drives.js`, `music.js`, and `replay.js`: search/grouping/location and replay calculations.

## Compatibility policy

Existing selectors, markup contracts, URL hashes, API endpoints, refresh intervals, global desktop ignition entry point, PWA behavior, and visible UX are unchanged. Some superseded function bodies remain in `web/app.js` for one release window, but established callers are routed to the extracted modules. They can be removed after production validation without another architecture change.

## Validation

- deterministic module behavior and load-order tests;
- JavaScript syntax checks for every web script;
- local mock server with sanitized API fixtures;
- browser smoke tests for Dashboard, Drives, Music, Statistics, theme, manual refresh, drive modal, map/replay initialization, Places, Charging, and Recaps;
- console error/warning checks after each browser workflow;
- desktop host compilation and the complete Phase 1–3 offline suite.

Phase 4 should focus on desktop-host/release hardening and removal of compatibility implementations after a validation window.
