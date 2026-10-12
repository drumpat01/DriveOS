# JourneyDeck current handoff, October 12, 2026

## Current objective

Ship four themed road-trip SEO landing pages in one draft PR. Do not merge or deploy.

## Checkout

- Branch `cursor/road-trip-journal-seo-pages-2843` off `main`.

## Material changes

- New public pages: `/route-66-road-trip-journal`, `/pacific-coast-highway-road-trip-journal`, `/national-parks-road-trip-journal`, `/texas-hill-country-road-trip-journal`.
- Wired like #268/#270/#273/#276: `publicPaths`, `app.get` sendFile, sitemap, server tests, verify-live expectations, feature map, canonical/meta/OG/JSON-LD/Umami, plain App Store CTA plus `campaign.js`.
- Copy from the draft, minus unconfirmed personal lines, plus design-review FAQ and intro fixes. JSON-LD FAQ text matches the visible FAQ. No em/en dashes. Journeys start only when the user taps Start Journey.
- Cross-links from `/road-trip-journal-app`, `/private-driving-journal`, and the Apple Music soundtrack footer.

## Verification

- `node --test --import tsx server/tests/api.test.ts`
- `node --test --import tsx server/tests/campaign.test.ts server/tests/verify-live.test.ts`
- Desktop 1280 and mobile 390 screenshots of each page in the PR body.

## Unresolved / owner decisions

- Keep the PR as a draft. Do not merge or deploy from this session.

## Next steps

1. Keep the four-page SEO PR open for review. Do not merge or deploy.
2. Confirm JourneyDeck CI is green.
