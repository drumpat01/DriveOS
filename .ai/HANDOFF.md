# JourneyDeck current handoff

## Current objective

Add the approved home-page cross-link to the studio Road Trip templates. Open a non-draft PR. Do not merge and do not deploy.

## Checkout

- Branch `cursor/home-studio-crosslink-1e8d`, based on main `48178cb` (#312).
- Public home is `web/beta.html` served at `GET /`. `web/index.html` is the private app shell and was not changed.

## Material changes

- Footer nav in `web/beta.html` gains one same-tab link: `From the studio: Road Trip templates` to `https://studio.journeydeck.me/?utm_source=journeydeck&utm_medium=referral&utm_campaign=crosslink`.
- The existing footer `/login` link (`Sign in`) is unchanged.
- Header Studio links, Worker code, `cloudflare/`, and private pages are unchanged.
- `expectations.json` and `FEATURE_MAP.md` do not list footer nav links, so they were not edited.

## Verification

- Node v24.22.0.
- `npm run check:server`, `npm run lint:server`, `npm run test:server`, and `npm run test:e2e` passed (19 e2e).
- Local `npm run verify:live -- --base http://127.0.0.1:8795` passed, including `page:/ launch-badge` and `/login` HTTP 200.
- Footer screenshots at 390 and 1280, before and after, are in the PR.

## Unresolved

- Do not merge. No deploy.

## Next steps

1. Review the PR. Do not merge it from this handoff.
2. After merge, both the site Worker and Render serve the updated `web/beta.html` at `/`.
