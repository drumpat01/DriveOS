# JourneyDeck current handoff

## Current objective

Give each landing page that used `ct=journal` its own App Store campaign token so App Store Connect can attribute downloads. Do not merge and do not deploy.

## Checkout

- Branch `cursor/app-store-page-ct-bdbe`, based on main `d6bbbcc` (#314).
- Public home is `web/beta.html` at `GET /`. The site Worker serves `web/`. Render is suspended.

## Material changes

- Replaced `ct=journal` on nine landing pages. `home`, `tesla_page`, `soundtrack`, and `site` are unchanged. Query shape stays `pt=129344416&ct=...&mt=8`.
- `tools/verify-live/expectations.json` `appStore.pageCampaigns` and the server tests that assert those tokens match the new values.

| Page | Old | New |
| --- | --- | --- |
| `/private-driving-journal` | journal | private_journal |
| `/road-trip-journal-app` | journal | road_trip |
| `/road-trip-tracker-app` | journal | road_trip_tracker |
| `/travel-journal-app-with-photos` | journal | travel_journal |
| `/driving-history-app` | journal | driving_history |
| `/route-66-road-trip-journal` | journal | route_66 |
| `/pacific-coast-highway-road-trip-journal` | journal | route_pacific_coast_highway |
| `/national-parks-road-trip-journal` | journal | route_national_parks |
| `/texas-hill-country-road-trip-journal` | journal | route_texas_hill_country |

## Verification

- Node v24.22.0.
- `npm run check:server`, `npm run lint:server`, `npm run test:server` (79 pass).
- Playwright `tests/e2e/public-beta.spec.ts` (11 pass), including the per-page `ct` check.
- `verify:live` was not run against production. The new tokens are not deployed.

## Unresolved

- Do not merge. No deploy.

## Next steps

1. Review the pull request for `cursor/app-store-page-ct-bdbe`. Do not merge it from this handoff.
