# JourneyDeck current handoff

## Current objective

The journeydeck-site Worker answers `/healthz` and `/readyz` itself so they do not 5xx when Render is suspended. Draft PR only. Do not deploy, do not merge, and do not run wrangler against the real account.

## Checkout

- Branch `cursor/site-worker-health-e458`, based on main `1e6a219` (#311).
- Draft PR: open this branch. Do not merge.

## Material changes

- GET and HEAD `/healthz` and `/readyz`: 200 JSON `{"ok":true,"service":"journeydeck-site"}`, `Cache-Control: no-store`. No fetch to Render. HEAD has an empty body.
- Other methods on those two paths: 405 JSON `{"error":"Method not allowed."}`, `Allow: GET, HEAD`, `Cache-Control: no-store`.
- `proxy.ts` and `RENDER_ORIGIN` are removed. No route proxies to Render. Legacy `R084` `GET /healthz` stays `worker_action` `none` and does not match.
- `/`, static pages, `/retention-messaging-api`, the #311 410 routes, and the footer `/login` link are unchanged.
- `wrangler.jsonc` is still `workers_dev` only. No routes, DNS, or secrets.

## Verification

- `npm run check:site` passed.
- `npm run test:site`: 26 passed, including the health routes, the no-onrender sweep, and the workerd retention test.
- Local Node was v22.14.0 (`npm ci` warned the package wants Node >= 24). CI runs Node 24. `npm test` does not run `test:site`.

## Unresolved

- No deploy. The apex stays on Render until a separate cutover.
- `verify:live` still reads the Node server's `/readyz` (`generatedAtUtc`) and expects `/login` to be HTTP 200. Those checks are the server, not this Worker.

## Next steps

1. Review the draft PR for this branch. Do not merge it as a deploy.
2. After approval, from a machine with permission: `npm run predeploy:site`, then `npx wrangler deploy --config cloudflare/site/wrangler.jsonc`.
3. Curl the workers.dev origin: `/healthz` and `/readyz` are 200 JSON with no Render headers; `/` `/privacy` `/support` are 200; one #311 route is still 410.
