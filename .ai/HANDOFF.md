# JourneyDeck current handoff — October 10, 2026

## Current objective

Ship first-party App Store campaign pass-through on public journeydeck.me pages for the Oct 13 X launch. Do not merge. Do not touch deploy, hosting, DNS, or add analytics.

## Checkout

- Branch `cursor/app-store-campaign-passthrough-e92c` / #258, based on `main` `cff39eb`.
- Head: `d177881` (sanitizer test fix after `1629b6c`).

## Material changes

- `web/campaign.js` reads `utm_source` and `utm_campaign`, stores them in `sessionStorage`, rewrites App Store hrefs with Apple `ct`, and adds `pt` only when `APP_STORE_PROVIDER_TOKEN` is set (empty for now).
- Same script loads on home, Soundtracks, private driving journal, Support, Privacy, and Terms.
- App Store clicks dispatch `journeydeck:appstore-click` on `window`. No network, cookies, or third-party code.
- When the source is `x`, home `#hero-title` swaps to `Keep the drive. Keep the song.` The HTML default stays `Take the road. Keep the story.`
- Tests: `server/tests/campaign.test.ts`.

## Verification

- `npm run check:server`, `npm run lint:server`, and `npm run test:server` passed locally.
- Playwright `tests/e2e/public-beta.spec.ts` passed.
- Browser check at 390px and 1280px: headline height unchanged (87.6px / 147.9px), button becomes `...id6806502526?ct=x-launch-oct`, and the value survives a click through to Privacy.

## Unresolved / owner decisions

- Patrick still needs to put the App Store Connect provider token in `APP_STORE_PROVIDER_TOKEN` before Apple will attribute the campaign.
- Owner to-do from earlier: delete the scheduled Oct 14 App Store 3-day intro offers on weekly and annual; release 4.5.0 after approval.

## Next steps

1. Wait for JourneyDeck CI on #258.
2. Do not merge until the owner asks.
