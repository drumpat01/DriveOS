# JourneyDeck current handoff — October 9, 2026

## Current objective

Fit the hosted DriveOS web service (`driveos` on Render, journeydeck.me) onto Render Free: 512 MB RAM, 0.1 CPU, spin-down after ~15 minutes idle. Do not merge or deploy. Owner must apply `plan: free` in Render (blueprint and/or dashboard).

## Checkout

- Branch `cursor/driveos-free-memory-69b8` off `main` `ac152e5`.
- App baseline remains feature-complete (V4 / V3 / V2). This change is hosted runtime only.

## Material changes

- Node is the only public process. `/readyz` returns 200 once Node is listening so Free health checks and public pages are not gated on PowerShell or a finished Atlas refresh.
- Atlas refresh is in-process and paged (default 75 rows). It runs after listen and again when the snapshot is older than `DRIVEOS_ATLAS_REFRESH_SECONDS` (900). No second Node refresh process and no 15-minute timer as the freshness mechanism.
- PowerShell stays for dashboard/auth/legacy APIs and starts only on the first compatibility route (loopback only). It cannot be removed without dropping Replay, Share Card, Timeline, Collections, Memories, Wife Mode, login, and related screens.
- `render.yaml` is `plan: free`. Removed persistent-disk path `/var/data/...` and `maxShutdownDelaySeconds`. SQLite cache stays on `/tmp/driveos`. Dockerfile no longer installs nginx.
- Worker Atlas rebuilds fall back to in-process if the worker cannot start. Hosted sets `DRIVEOS_ATLAS_INLINE_REBUILD=true`.

## Verification

- `npm run check:server`, `npm run lint:server`, and `npm run test:server` passed (43 tests).
- Synthetic measure (2100 journeys, 4 KB payloads, local Node 22, no Turso, no pwsh):
  - Before-style load-all refresh: peak 164 MB, 322 ms.
  - After batched refresh: peak 154 MB, 305 ms.
  - After hosted path (listen then in-process refresh): `/readyz` in 225 ms, refresh 275 ms, peak 165 MB.
  - 16 KB payloads: load-all 221 MB vs batched 186 MB.
- Combined before (Node server + separate refresh process + PowerShell) was the OOM risk on 512 MB. After idle/public/Atlas stay in one Node process under ~170 MB in this measure. PowerShell RSS was not measured here (pwsh not installed).

## Unresolved / owner decisions

- Apply Render Free: compute plan Free, no disk, health check `/readyz`. Existing secrets stay. Optional: confirm `NODE_OPTIONS=--max-old-space-size=288` in the service env.
- First login/dashboard request after sleep starts PowerShell (up to 20 s). Public pages, Atlas, and recorder do not.
- Free loses local files on spin-down; Turso remains durable. First Atlas request after sleep refreshes from Turso.
- Free monthly hours/bandwidth limits and possible service-initiated traffic suspension are Render policy, not code.
- Do not merge or deploy until the owner asks.

## Next steps

1. Review the PR. Do not merge or touch Render until the owner asks.
2. V4 App Review / public release remain owner-gated and unchanged by this branch.
