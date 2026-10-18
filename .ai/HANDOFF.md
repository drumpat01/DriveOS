# JourneyDeck current handoff

## Current objective

Phase-one `journeydeck-site` Worker: serve public files from `web/`, answer retention natively, and proxy everything else to Render. Draft PR only. Do not deploy.

## Checkout

- Route list regenerated from this tree after rebasing onto main `e490f0f` (#304 and #306). `/homeworld` is in `server/src/app.ts`. The three private Soundtrack screenshots are not in the map.
- Branch `cursor/journeydeck-site-worker-4cad`, based on main `e490f0f`. Draft PR: https://github.com/drumpat01/DriveOS/pull/303
- Config is `workers_dev` only. No routes, DNS, or secrets. `preview_urls` is false. Invocation logs are off, and query strings are redacted.

## Material changes

- `cloudflare/site/` Worker, route CSV, parity script, and tests. `web/.assetsignore` excludes `wife.html`, `index.html`, and `login.html`.
- HTML cache-control is `public, max-age=0` with no `must-revalidate`. `html_handling` is `none`. `/assets/` is 403.
- Proxy strips `tailscale-user-login`, `x-journeydeck-test-auth`, inbound `cf-*`, `cdn-loop`, and `x-real-ip`.
- `driveos.onrender.com` is behind Cloudflare, so the Worker fetch is cross-zone. Cloudflare rewrites `CF-Connecting-IP` to the Worker egress address (for example `2a06:98c0:3600::103`). Render appends its own `X-Forwarded-For` hop. PR #302's one-hop rule therefore selects the Worker address, and logins likely share one throttle bucket. Spoofing stays blocked. Appending the inbound `CF-Connecting-IP` does not change that. Do not set `TRUST_PROXY=2`: a request sent straight to Render could spoof its IP.
- `X-Forwarded-Proto` and `X-Forwarded-Host` come from the request the Worker received. `Host` is `driveos.onrender.com`. Asset fetches pass `If-None-Match` through.
- `ALLOW_RETENTION_TEST_ROOT` is honored only for `localhost`, `127.0.0.1`, and `::1`.
- `.gitattributes` forces LF. `npm run predeploy:site` fails if a deleted `web/` file would be published or a text asset contains CR. `web/index.html` and `web/service-worker.js` were stored with CRLF and are LF now.
- `/wife.html` is a 302 to `/login` without a session (#301).

## Verification

- `npx tsc -p cloudflare/site/tsconfig.json --noEmit` passed.
- `npm run test:site`: 24 passed. `npm run predeploy:site` passed.
- Retention workerd span `duration_ms` is wall time, not CPU. This run: cold 26 ms, warm 3/4/3/4 ms, warm p95 4 ms.
- Route rows versus the pre-rebase map: removed `GET /assets/v2/soundtrack.jpg`, `GET /assets/v2/soundtrack.webp`, and `GET /assets/v4/05-soundtrack.webp`. `GET /wife.html` is now 302 with `noindex`. Totals are 429 rows (312 worker, 110 passthrough, 7 dead, 369 probes).

## Unresolved

- No deploy. Login and passkeys stay known-fail on `workers.dev` (origin check and WebAuthn RP ID).
- Cutover blocker: Render logs the real visitor IP for /login through the Worker.
- Phase 2 fix for that blocker, not implemented: a signed header that #302 trusts, using a shared key. That needs a Worker secret, a Render env var, and Patrick's yes. Do not use `TRUST_PROXY=2`.
- Retention rows R029–R032: before cutover, measure CPU in workers.dev observability. If it is over 10 ms, either move to Workers Paid (spending, so Patrick decides) or set those rows to proxy.
- Phase 2 cutover needs a separate yes. www stays on Render until the apex is stable.
- A real Apple-signed retention payload is still untested. The test root is not in `wrangler.jsonc`.

## Next steps

1. Review the draft PR. Do not merge it as a deploy.
2. From a machine with approval: `npm run predeploy:site`, then `npx wrangler deploy --config cloudflare/site/wrangler.jsonc`.
3. Re-run parity against the workers.dev URL. Confirm the login IP blocker and the retention CPU gate before any route cutover.
