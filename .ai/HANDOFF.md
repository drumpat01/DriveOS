# JourneyDeck current handoff

## Current objective

Retire the old `journeydeck-site` web app routes that still proxy to Render. Draft PR only. Do not deploy, do not merge, and do not run wrangler against the real account.

## Checkout

- Branch `cursor/retire-render-web-routes-800d`, based on main `880926f`.
- Draft PR: https://github.com/drumpat01/DriveOS/pull/311. Do not merge.

## Material changes

- `/api` and `/api/*`, every method: HTTP 410 JSON `{"error":"gone","message":"This API has been retired."}`, `Cache-Control: no-store`. No fetch to Render.
- `/login`, `/app`, `/wife` and their subpaths, every method: HTML 410 notice, `noindex`, App Store link, home link. No fetch to Render.
- Exact `/login.html`, `/index.html`, `/wife.html`, and `/spotify-callback`, every method: the same HTML 410 notice. No fetch to Render. `/index.html` is not `/`.
- Still proxied to `https://driveos.onrender.com`: `GET /healthz` and `GET /readyz`.
- `/` stays the homepage asset (`beta.html`). `/retention-messaging-api` and the static pages, including the footer `/login` link, are unchanged.
- `wrangler.jsonc` is still `workers_dev` only. No routes, DNS, or secrets.

## Verification

- `npm run check:site` passed.
- `npm run test:site`: 27 passed, including the homepage-versus-`/index.html` checks and the workerd retention test.
- Local Node was v22.14.0. CI runs Node 24. `npm test` does not run `test:site`.

## Unresolved

- No deploy. The apex stays on Render until a separate cutover.
- `verify:live` still expects the Node app's `/login` to be HTTP 200. That check is the server, not this Worker.

## Next steps

1. Review https://github.com/drumpat01/DriveOS/pull/311. Do not merge it as a deploy.
2. After approval, from a machine with permission: `npm run predeploy:site`, then `npx wrangler deploy --config cloudflare/site/wrangler.jsonc`.
3. Curl the workers.dev origin: `/api/anything` is 410 JSON; `/login`, `/app`, `/wife`, `/login.html`, `/index.html`, `/wife.html`, and `/spotify-callback` are the notice; `/` `/privacy` `/support` are unchanged; `/healthz` still comes from Render.
