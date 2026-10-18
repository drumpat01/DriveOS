# JourneyDeck current handoff

## Current objective

Keep `/wife.html` behind the same login as `/wife`, including case and trailing-slash variants. Pull request stays open. Do not merge and do not deploy.

## Checkout

- Branch `cursor/wife-html-auth-460d`, rebased onto main `2c190bf` (PR #298).
- Pull request: https://github.com/drumpat01/DriveOS/pull/301. Do not merge it.
- The rebase conflict was only `.ai/HANDOFF.md`. PR #298's first-trip Plus card stayed.
- CI on `74cc114` failed because Windows served `/Wife.html` as 200. The wife gate now folds case and a trailing slash before the `/wife` and `/wife.html` comparison.

## Material changes

- In web mode, the existing session hook treats a decoded wife path as literal `/wife` after `decodeURI`, stripping trailing slashes, and lowercasing. That covers `/wife.html`, percent-encoded aliases, `/Wife.html`, `/WIFE.HTML`, `/wife.html/`, and `/wife/`.
- Unauthenticated, those paths return 302 to `/login` with `X-Robots-Tag: noindex, nofollow`. Literal `/wife` is unchanged aside from that header.
- `/app`, `/index.html`, and `/spotify-callback` are not case-folded. Do not start that decoded-path work here.
- `web/robots.txt` already disallows `/wife`. `web/sitemap.xml` does not list the page.
- `tools/verify-live/expectations.json` asserts unauthenticated `/wife.html` is 302 to `/login`.

## Verification

Node `v24.22.0`, after the case-normalization change:

- `npm run check:server` passed.
- `npm run lint:server` passed.
- `npm run test:server`: 69 passed. `wife.html uses the same session gate and robots tag as /wife` now requires the case and trailing-slash URLs to match `/wife`.
- `npm run test:e2e`: 18 passed.
- Local web server on `http://127.0.0.1:8795`. Unauthenticated `/wife`, `/wife.html`, `/Wife.html`, `/WIFE.HTML`, `/wife.html/`, and `/wife/` each returned `302`, `location: /login`, and `x-robots-tag: noindex, nofollow`.
- `npm run verify:live -- --base http://127.0.0.1:8795` passed, including `unauthenticated:/wife.html`.

## Unresolved

- Do not merge and do not deploy. Render and Cloudflare were not changed.
- Production `npm run verify:live` will fail `unauthenticated:/wife.html` until this commit is deployed.
- Other public `.html` bypasses were left unchanged.

## Next steps

1. Wait for GitHub CI on the new head of pull request 301. Do not merge.
2. After deploy, `curl -sI https://journeydeck.me/wife.html` should match `curl -sI https://journeydeck.me/wife`: `302` and `location: /login`.
