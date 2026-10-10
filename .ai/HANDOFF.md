# JourneyDeck current handoff — October 10, 2026

## Current objective

Finish App Store campaign pass-through plus cookieless Umami click tracking on public journeydeck.me pages for the Oct 13 X launch. Do not merge. Do not touch deploy, hosting, or DNS.

## Checkout

- Branch `cursor/app-store-campaign-passthrough-e92c` / #258, based on `main` `cff39eb`.

## Material changes

- `web/campaign.js` reads `utm_source` and `utm_campaign`, stores them in `sessionStorage`, and rewrites App Store hrefs with Apple `ct`. `ct` keeps `[a-z0-9_-]`, max 40 chars. Example: `ct=x-launch_oct13`.
- `pt` is omitted while `APP_STORE_PROVIDER_TOKEN` is empty.
- Public pages load Umami Cloud (`cloud.umami.is`, website id `a5f66e11-ec7d-4133-8e1a-f8e6c08593af`). Cookieless. Not on the app shell or `/login`.
- App Store clicks dispatch `journeydeck:appstore-click`, then `window.umami?.track('appstore_click', detail)` with values clipped to 200 chars. Missing or blocked Umami is a no-op and does not block navigation.
- Fastify CSP allows `https://cloud.umami.is` in `script-src` and `connect-src`.
- X home headline variant: `Keep the drive. Keep the song.`

## Verification

- Targeted server tests and public Playwright suite passed on the first campaign pass.
- Umami addition still needs local `test:server` and CI on the latest head.

## Unresolved / owner decisions

- Patrick still needs to put the App Store Connect provider token in `APP_STORE_PROVIDER_TOKEN` before Apple will attribute the campaign.
- Owner to-do from earlier: delete the scheduled Oct 14 App Store 3-day intro offers on weekly and annual; release 4.5.0 after approval.

## Next steps

1. Land #258 after CI is green and the owner reviews.
2. Do not merge until the owner asks.
