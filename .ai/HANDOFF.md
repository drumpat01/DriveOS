# JourneyDeck current handoff

## Current objective

Footer cross-link to the studio Road Trip templates, and drop the public footer Sign in link. Same PR. Do not merge and do not deploy.

## Checkout

- Branch `cursor/home-studio-crosslink-1e8d`, rebased on main `dde5d6f` (#313).
- PR: https://github.com/drumpat01/DriveOS/pull/314. Do not merge.
- Public home is `web/beta.html` at `GET /`. The site Worker serves `web/`. Render is suspended.

## Material changes

- Home footer nav: same-tab `From the studio: Road Trip templates` to `https://studio.journeydeck.me/?utm_source=journeydeck&utm_medium=referral&utm_campaign=crosslink`, in the slot where Sign in was.
- Footer `href="/login"` removed from `web/beta.html` and `web/landing.html`. Other public pages already had no footer login link.
- `/login` route and Worker source are unchanged. Retired-page expectations from #313 stay: `/login` is HTTP 410.
- `verify:live` checks `page:<path> no-footer-login` on every public page and `page:/ studio-link` on `/`.

## Verification

- Node v24.22.0.
- `npm run check:server`, `npm run lint:server`, `npm run test:server` (79 pass), and `npm run test:e2e` (20 pass).

## Unresolved

- Do not merge. No deploy.

## Next steps

1. Review https://github.com/drumpat01/DriveOS/pull/314. Do not merge it from this handoff.
