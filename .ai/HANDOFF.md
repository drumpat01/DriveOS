# JourneyDeck current handoff

## Current objective

Footer cross-link to the studio Road Trip templates, and drop the public footer Login link. Same PR. Do not merge and do not deploy.

## Checkout

- Branch `cursor/home-studio-crosslink-1e8d`, based on main `48178cb`.
- PR: https://github.com/drumpat01/DriveOS/pull/314. Do not merge.
- Public home is `web/beta.html` at `GET /`. The site Worker serves `web/`. Render is suspended.

## Material changes

- Home footer nav: same-tab `From the studio: Road Trip templates` to `https://studio.journeydeck.me/?utm_source=journeydeck&utm_medium=referral&utm_campaign=crosslink`, in the slot where Sign in was.
- Footer `href="/login"` removed from `web/beta.html` and `web/landing.html`. Other public pages already had no footer login link.
- `/login` route and Worker source are unchanged. `expectations.loginPath` still expects HTTP 200 until the separate 410 expectations PR lands.
- `verify:live` checks `page:<path> no-footer-login` on every public page and `page:/ studio-link` on `/`.

## Verification

- Node v24.22.0.
- `npm run check:server`, `npm run lint:server`, `npm run test:server` (79 pass), and `npm run test:e2e` (20 pass).
- Local `npm run verify:live -- --base http://127.0.0.1:8795` passed, including `page:/ studio-link` and `page:/login` HTTP 200.

## Unresolved

- Do not merge. No deploy.
- PR 313 may still change retired-page expectations. Rebase this branch if that lands first. Keep this branch's expectation edits limited to footer links.

## Next steps

1. Review https://github.com/drumpat01/DriveOS/pull/314. Do not merge it from this handoff.
