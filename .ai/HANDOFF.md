# JourneyDeck current handoff — October 9, 2026

## Current objective

Ship the Node-first hosted runtime on the current Standard plan first. Apply Render Free (`plan: free`, disk path removal, `maxShutdownDelaySeconds` removal) only after Standard is deployed and verified. Do not merge or touch Render from this session.

## Checkout

- Runtime PR: `cursor/driveos-free-memory-69b8` / #252, based on `main` `ac152e5`.
- Free blueprint follow-up: separate draft PR stacked on `main` after #252.
- App baseline remains feature-complete (V4 / V3 / V2). This work is hosted runtime and blueprint only.

## Material changes (kept on #252)

- Node is the only public process. `/readyz` returns 200 once Node is listening. Public pages are not gated on PowerShell or a finished Atlas refresh.
- Atlas refresh is in-process and paged (default 75 rows). It runs after listen and again when the snapshot is older than `DRIVEOS_ATLAS_REFRESH_SECONDS` (900).
- PowerShell stays for dashboard/auth/legacy APIs and starts only on the first compatibility route (loopback only).
- `render.yaml` stays `plan: standard` with `maxShutdownDelaySeconds: 60` and `DRIVEOS_ATLAS_LEGACY_DATABASE=/var/data/atlas/journeydeck.db` as on main. Runtime env (lazy PS, inline rebuild, batch size, `NODE_OPTIONS`) stays. SQLite cache stays on `/tmp/driveos`. Dockerfile no longer installs nginx.

## Verification

- `npm run check:server`, `npm run lint:server`, and `npm run test:server` passed (43 tests) on the runtime work.
- Synthetic measure (2100 journeys, 4 KB payloads, local Node 22, no Turso, no pwsh): load-all 164 MB / 322 ms; paged 154 MB / 305 ms; listen then in-process refresh `/readyz` 225 ms, refresh 275 ms, peak 165 MB. 16 KB: load-all 221 MB vs paged 186 MB.

## Unresolved / owner decisions

- Merge and deploy #252 on Standard first. Verify memory and `/readyz` there.
- Then merge the Free blueprint PR. If blueprint sync is on, that second merge flips the plan and drops the disk path.
- First login/dashboard request after sleep starts PowerShell (up to 20 s).
- Do not merge or touch Render from the agent.

## Next steps

1. Confirm `validate` is green on #252 and leave it ready for review.
2. Leave the Free PR as draft until Standard is verified.
3. Do not merge either PR or change Render until the owner asks.
