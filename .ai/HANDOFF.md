# JourneyDeck current handoff

## Current objective

Draft pull request adding a compact JourneyDeck Plus annual block to `/`, `/tesla-drive-journal`, and `/driving-history-app`. Do not merge and do not deploy.

## Checkout

- Branch `cursor/plus-annual-block-0859` at `93c9b95`, based on main `486030b` (`Use the dark FollowX badge at the Launch Llama width. (#323)`).
- Draft pull request: https://github.com/drumpat01/DriveOS/pull/324
- Public home is `web/beta.html` at `GET /`. The site Worker in `cloudflare/site` serves `web/`.

## Material changes

- Each of the three pages has `section#plus-annual` after the hero. Copy: free recording and today's journeys stay free; Plus adds full history, Atlas, Ask JourneyDeck, premium themes and icons, Tesla drive and charging history, and AI assistant connections. Price line: `Plus is $39.99/yr.` CTA: `Start your free trial`.
- The CTA keeps that page's App Store `pt`, `ct`, and `mt` (`home`, `tesla_page`, `driving_history`) and adds `utm_source=journeydeck.me`, `utm_medium=site`, `utm_campaign=plus_annual`, `utm_content` of `home`, `tesla-drive-journal`, or `driving-history-app`. Umami attribute: `data-umami-event="plus-annual-click"`.
- The block does not state a trial length, a weekly price, or a third-party app name. Existing page copy outside the block is unchanged, including the Tesla `plus-trial-click` banner and the site-wide `7-day free trial` pricing lines.
- Styles are in `web/beta.css` and `web/public-page.css`. No new stylesheet, script, or image. The block is outside the hero so the #322 absolute-fill hero photo stays the same size.
- Cache busts: `beta.css?v=plus-annual-1` on the homepage and `public-page.css?v=plus-annual-1` on public pages that load that file. `web/api-docs.html` and `cloudflare/site/src/retired.ts` stay on `public-page.css?v=perf-1`.
- `verify:live` checks `page:/ plus-annual`, `page:/tesla-drive-journal plus-annual`, and `page:/driving-history-app plus-annual`.

## Verification

- `npm run test:server` passed: 81 tests, 0 failed, on Node v22.23.4.
- Playwright `npx playwright test` passed: 23 tests, including the Plus annual viewport check at 1280 and 390.
- `npm run verify:live -- --base http://127.0.0.1:8787` passed against local `wrangler dev` at 2026-10-22T08:25:15.407Z. Health is `{"ok":true,"service":"journeydeck-site"}`. The three plus-annual checks passed.

## Unresolved

- Do not merge. No deploy. Production does not show the block until this ships.

## Next steps

1. Review https://github.com/drumpat01/DriveOS/pull/324. Do not merge it from this handoff.
