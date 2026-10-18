# JourneyDeck current handoff

## Current objective

Put `/wife.html` behind the same login that already protects `/wife`. Open a draft pull request. Do not merge and do not deploy.

## Checkout

- Branch `cursor/wife-html-auth-460d`, based on main `102a13b`.
- Draft pull request: https://github.com/drumpat01/DriveOS/pull/301. Do not merge it.

## Material changes

- In web mode, the existing session hook now treats a decoded `/wife` or `/wife.html` path the same as literal `/wife`. That covers `/wife.html` and percent-encoded aliases such as `/wife%2ehtml`, `/%77ife.html`, and `/%77ife`.
- Literal `/wife` still returns 302 to `/login` when unauthenticated. Wife page responses, including that redirect, now send `X-Robots-Tag: noindex, nofollow`.
- `web/robots.txt` already disallows `/wife`, which covers `/wife.html`. `web/sitemap.xml` does not list the page.
- `tools/verify-live/expectations.json` asserts unauthenticated `/wife.html` is 302 to `/login`.

## Verification

- Node `v24.22.0`.
- `npm run check:server` passed.
- `npm run lint:server` passed.
- `npm run test:server`: 69 passed.
- `npm run test:e2e`: 18 passed.
- Local web server on `http://127.0.0.1:8795`. Unauthenticated `curl` of `/wife.html` and `/wife` both returned `302`, `location: /login`, and `x-robots-tag: noindex, nofollow`.
- `npm run verify:live -- --base http://127.0.0.1:8795` passed, including `unauthenticated:/wife.html`.

## Unresolved

- Do not merge and do not deploy. Render and Cloudflare were not changed.
- Production `npm run verify:live` will fail `unauthenticated:/wife.html` until this commit is deployed.
- Other public `.html` bypasses were found and left unchanged. See the pull request body.

## Next steps

1. Leave the draft pull request open until the owner merges it.
2. After deploy, `curl -sI https://journeydeck.me/wife.html` should match `curl -sI https://journeydeck.me/wife`: `302` and `location: /login`.
