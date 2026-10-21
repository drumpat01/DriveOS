# JourneyDeck current handoff

## Current objective

Rebase the FollowX badge draft onto main after the #322 performance pass. Do not merge and do not deploy.

## Checkout

- Branch `cursor/followx-badge-dark-width-ea84`, rebased onto main `233d8b2` (`Cut public page LCP with a responsive hero and smaller screenshots. (#322)`).
- Draft pull request: https://github.com/drumpat01/DriveOS/pull/323
- Public home is `web/beta.html` at `GET /`. The site Worker serves `web/`.

## Material changes

- Every public footer badge uses `https://followx.today/api/badge/journeydeck.me.svg?theme=dark`.
- The badge renders at 200px wide, the same width as the Launch Llama badge. Width and height attributes stay `250` and `54`, with `aspect-ratio: 250 / 54`, so the lazy image reserves its box.
- Cache busts sit above main: `beta.css?v=followx-2` and `public-page.css?v=perf-2`. `retired.ts` and `web/api-docs.html` stay on `public-page.css?v=perf-1` because they have no badge.
- The #322 hero preload, AVIF/WebP srcsets, lazy Launch Llama badge, deferred homepage CSS, and Umami-after-load loader stay in place.
- `img-src` in the Worker and the Fastify app still allows `https://followx.today`. `script-src` and `connect-src` do not.
- `verify:live` expects the dark image src plus the explicit width, height, and alt.

## Verification

- `npm run test:server` passed: 81 tests, 0 failed, on Node v22.23.3.
- Playwright `npx playwright test` passed: 22 tests, including the public FollowX width check and the app smoke specs.
- `npm run verify:live -- --base http://127.0.0.1:8787` passed against local `wrangler dev` at 2026-10-21T21:53:26Z. Health is `{"ok":true,"service":"journeydeck-site"}`.

## Unresolved

- Do not merge. No deploy. Production stays on the light badge until this ships.

## Next steps

1. Review the draft pull request for `cursor/followx-badge-dark-width-ea84`. Do not merge it from this handoff.
