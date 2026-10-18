# JourneyDeck current handoff

## Current objective

Phase-one `journeydeck-site` Worker: serve public files from `web/`, answer retention natively, and proxy everything else to Render. Draft PR only. Do not deploy. Do not rebase; #299 and #301 have not landed.

## Checkout

- Do not regenerate `cloudflare/site/route-list.csv` from this tree. The CSV includes `/homeworld`, which is not in this commit's `server/src/app.ts`.
- Branch `cursor/journeydeck-site-worker-4cad`, based on main `ec46402`. Draft PR: https://github.com/drumpat01/DriveOS/pull/303
- Config is `workers_dev` only. No routes, DNS, or secrets. `preview_urls` is false. Invocation logs are off, and query strings are redacted.

## Material changes

- `cloudflare/site/` Worker, route CSV, parity script, and tests. `web/.assetsignore` excludes `wife.html`, `index.html`, and `login.html`.
- HTML cache-control is `public, max-age=0` with no `must-revalidate`. `html_handling` is `none`. `/assets/` is 403.
- Proxy strips `tailscale-user-login`, `x-journeydeck-test-auth`, inbound `cf-*`, `cdn-loop`, and `x-real-ip`.
- `driveos.onrender.com` is behind Cloudflare, so the Worker fetch is cross-zone. Cloudflare rewrites `CF-Connecting-IP` to the Worker egress address (for example `2a06:98c0:3600::103`). Render appends its own `X-Forwarded-For` hop. PR #302's one-hop rule therefore selects the Worker address, and logins likely share one throttle bucket. Spoofing stays blocked. Appending the inbound `CF-Connecting-IP` does not change that. Do not set `TRUST_PROXY=2`: a request sent straight to Render could spoof its IP.
- `X-Forwarded-Proto` and `X-Forwarded-Host` come from the request the Worker received. `Host` is `driveos.onrender.com`. Asset fetches pass `If-None-Match` through.
- `ALLOW_RETENTION_TEST_ROOT` is honored only for `localhost`, `127.0.0.1`, and `::1`. `server/` was not changed.

## Verification

- `npx tsc -p cloudflare/site/tsconfig.json --noEmit` passed.
- `npm run test:site`: 21 passed.
- Retention workerd span `duration_ms` is wall time, not CPU. This run: cold 27 ms, warm 3/4/4/3 ms, warm p95 4 ms. The earlier 30 ms cold figure was the same wall duration.
- `node cloudflare/site/parity-check.mjs --staging http://127.0.0.1:8787 --live https://journeydeck.me` against `wrangler dev --local`: PASS 372, PASS* 0, FAIL 0, ERROR 0.

## Unresolved

- No deploy. Login and passkeys stay known-fail on `workers.dev` (origin check and WebAuthn RP ID).
- Cutover blocker: Render logs the real visitor IP for /login through the Worker.
- Phase 2 fix for that blocker, not implemented: a signed header that #302 trusts, using a shared key. That needs a Worker secret, a Render env var, and Patrick's yes. Do not use `TRUST_PROXY=2`.
- Retention rows R029–R032: before cutover, measure CPU in workers.dev observability. If it is over 10 ms, either move to Workers Paid (spending, so Patrick decides) or set those rows to proxy.
- Phase 2 cutover needs a separate yes. www stays on Render until the apex is stable.
- A real Apple-signed retention payload is still untested. The test root is not in `wrangler.jsonc`.

## Next steps

1. Review the draft PR. Do not merge it as a deploy, and do not rebase until #299 and #301 land.
2. After that rebase, regenerate `cloudflare/site/route-list.csv` with `gen-route-list.mjs` and replace the checkout note that says not to regenerate it.
3. From a machine with approval: `npx wrangler deploy --config cloudflare/site/wrangler.jsonc`.
4. Re-run parity against the workers.dev URL. Confirm the login IP blocker and the retention CPU gate before any route cutover.
