# JourneyDeck current handoff

## Current objective

Make `verify:live` expect the retired web app to return HTTP 410. Do not merge. Do not change site or Worker code.

## Checkout

- Branch `cursor/verify-live-retired-410-dd91`, based on main `48178cb` (#312).
- PR: https://github.com/drumpat01/DriveOS/pull/313. Do not merge.
- Live `GET https://journeydeck.me/login` is HTTP 410, `text/html; charset=utf-8`, `Cache-Control: no-store`, `X-Robots-Tag: noindex`. The body is the retirement notice and has no Umami tag.

## Material changes

- `expectations.retiredPages` covers `/app`, `/wife`, `/wife.html`, `/index.html`, `/spotify-callback`, `/login.html`, and `/login`.
- Each path must be 410, with `X-Robots-Tag: noindex`, a robots meta of `noindex`, `Cache-Control: no-store`, and the phrase `The old web app has been retired`.
- `/login` keeps `page:/login status`, `page:/login noindex`, and `page:/login umami` (zero `cloud.umami.is` scripts).
- Public-page, pricing, redirect, image, CSP, and `/readyz` checks are unchanged. Live `/readyz` is `{"ok":true,"service":"journeydeck-site"}`; the existing check still requires HTTP 200 and `ok: true`.

## Verification

- `npm run test:server`: 79 passed, 0 failed.
- `npm run verify:live -- --base https://journeydeck.me`: 232 passed, 0 failed. Exit 0.

## Unresolved

- Do not merge this PR.

## Next steps

1. Wait for CI on the verify:live PR. Rebase onto main if it moves. Do not merge.
