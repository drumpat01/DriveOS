# JourneyDeck current handoff

## Current objective

One performance pull request from main for the public site. Do not merge and do not deploy. Raise mobile Lighthouse on `/` and `/driving-history-app` toward 95, with mobile LCP under 2.5 s and TBT under 100 ms, and no visual change.

## Checkout

- Branch `cursor/site-lcp-images-7a68`, based on main `fbdc2e7` (`Add the FollowX badge to every public footer. (#321)`).
- Public home is `web/beta.html` at `GET /`. Driving history is `web/driving-history-app.html`. The site Worker serves `web/`.

## Material changes

- Hero on `/` and `/driving-history-app` is an `<img class="hero-photo">` using the existing `grand-touring-home-800/1600` files, preloaded with `imagesrcset`. The homepage no longer preloads `01-today-400`.
- `picture` sources add 400w WebP and AVIF, plus a native 660w AVIF, for v4 screenshots 02 through 08. Memories uses real 400 and 800 WebP and AVIF. Tesla `06-atlas` sizes is `228px` under 700px.
- Untagged `grand-touring-*`, v4 shots, and `journeydeck-pulse.svg` use `?v=1` so the existing cache rule marks them immutable.
- Launch Llama badge is `loading="lazy"` and `decoding="async"`. The image URL and link are unchanged.
- `web/umami-loader.js` keeps a deferred same-origin script, promotes non-critical CSS, and injects Umami after `load`. Homepage defers `medallions.css` and `v2-features.css`. `soundtrack-v2.css` stays blocking because deferring it shifted the proof section (CLS 0.08).
- Reveal and parallax in `web/beta.js` start after `load` via `requestIdleCallback`. Content stays visible until `html.motion-ready`, and without JavaScript.
- CSP, FollowX, UTMs, and copy are unchanged.

## Verification

- `npm run check:server`, `npm run lint:server`, `npm run test:server` (81), `npm run check:site`, `npm run test:site` (27), and Playwright `tests/e2e/public-beta.spec.ts` (13) passed on Node 24.
- Local Lighthouse 12 against Fastify on 127.0.0.1, 3 runs, median by Perf: home mobile 99 / LCP 2.18 s / TBT 0 / CLS 0; driving-history mobile 99 / LCP 2.04 s / TBT 0 / CLS 0. Desktop is 100 on both. Tesla, one run, mobile 99 and desktop 100, CLS 0.
- `npm run verify:live` was not run against production.

## Unresolved

- Do not merge. No deploy. Live scores stay on the previous release until this is deployed.

## Next steps

1. Review the pull request for `cursor/site-lcp-images-7a68`. Do not merge it from this handoff.
