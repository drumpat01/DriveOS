# JourneyDeck current handoff

## Current objective

Add a permanent 301 from `/homeworld` and `/homeworld/` to `https://studio.journeydeck.me/homeworld` in the journeydeck.me Fastify app. Open a draft pull request. Do not merge and do not deploy.

## Checkout

- Branch `cursor/homeworld-redirect-8979`, based on main `ec46402`.
- Draft PR: https://github.com/drumpat01/DriveOS/pull/297. Do not merge it.

## Material changes

- `GET` and Fastify's automatic `HEAD` for `/homeworld` and `/homeworld/` reply `301` to `https://studio.journeydeck.me/homeworld`. The query string is not copied.
- Both paths are in `publicPaths` in `server/src/app.ts`, next to the `/driving-journal` redirect.
- `tools/verify-live/expectations.json` lists both redirects. `npm run verify:live` checks status and `Location` without following them.

## Verification

- `npm run check:server` passed.
- `npm run lint:server` passed.
- `npm run test:server`: 68 passed, 0 failed.
- `npm run test:atlas-performance` passed.
- `npm run test:e2e`: 18 passed.
- `node --test ./tests/frontend-modules.test.js ./tests/startup-refresh.test.js`: 2 passed.
- Local `curl -sI http://127.0.0.1:8798/homeworld` in web mode returned `HTTP/1.1 301` and `location: https://studio.journeydeck.me/homeworld`. The same location was returned for `/homeworld/` and for a query string.
- PowerShell analyzer, gitleaks, and trivy were not run here. Those commands are not installed on this Linux agent. GitHub Actions runs them on Windows.

## Unresolved

- Do not merge and do not deploy. Render, Cloudflare, and DNS were not changed.
- `npm run verify:live` against production will fail these two redirect checks until this commit is deployed.

## Next steps

1. Leave the draft pull request open until the owner merges it.
2. After deploy, run `curl -sI https://journeydeck.me/homeworld` and `curl -sI https://journeydeck.me/homeworld/`. Both should show `301` and `location: https://studio.journeydeck.me/homeworld`.
3. Then run `npm run verify:live -- --base https://journeydeck.me`.
