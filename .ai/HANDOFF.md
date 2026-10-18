# JourneyDeck current handoff

## Current objective

Phase-one `journeydeck-site` Worker: serve public files from `web/`, answer retention natively, and proxy everything else to Render. Draft PR only. Do not deploy.

## Checkout

- Branch `cursor/journeydeck-site-worker-4cad`, based on main `ec46402`.
- Config is `workers_dev` only. No routes, DNS, or secrets.
- Do not regenerate `cloudflare/site/route-list.csv` from this tree. The CSV includes `/homeworld`, which is not in this commit's `server/src/app.ts`.

## Material changes

- `cloudflare/site/` Worker, route CSV, parity script, and tests.
- HTML cache-control is `public, max-age=0` with no `must-revalidate`. `html_handling` is `none`. `/assets/` is 403.
- Proxy strips `tailscale-user-login` and `x-journeydeck-test-auth`.
- `X-Forwarded-For` appends the incoming `CF-Connecting-IP` so Render's one-hop client derivation sees the visitor. `X-Forwarded-Proto` and `X-Forwarded-Host` come from the request the Worker received. `Host` is `driveos.onrender.com`.
- `server/` and `web/` were not changed.

## Verification

- `npx tsc -p cloudflare/site/tsconfig.json --noEmit` passed.
- `npm run test:site`: 20 passed.
- Retention workerd span duration (upper bound on CPU, not tail `cpuTime`): cold 30 ms, warm 5/4/5/3 ms, warm p95 5 ms. Workers Free CPU limit is 10 ms. Warm is under it. Cold duration is over it.
- `node cloudflare/site/parity-check.mjs --staging http://127.0.0.1:8787 --live https://journeydeck.me` against `wrangler dev --local`: PASS 372, PASS* 0, FAIL 0, ERROR 0.

## Unresolved

- No deploy. Login and passkeys stay known-fail on `workers.dev` (origin check and WebAuthn RP ID).
- After a workers.dev deploy, check the client IP Render logs for `/login`. If it is the Worker egress address, every login shares one throttle bucket.
- Phase 2 cutover needs a separate yes. www stays on Render until the apex is stable.
- A real Apple-signed retention payload is still untested. The test root is not in `wrangler.jsonc`.

## Next steps

1. Review the draft PR. Do not merge it as a deploy.
2. From a machine with approval: `npx wrangler deploy --config cloudflare/site/wrangler.jsonc`.
3. Re-run parity against the workers.dev URL, then check Render's `/login` client IP.
