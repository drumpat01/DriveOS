# JourneyDeck current handoff, October 16, 2026

## Current objective

Public Plus pricing matches App Store Connect at $39.99/year with a 7-day free trial. Design nits are on PR #293. Do not merge.

## Checkout

- Branch `cursor/plus-annual-pricing-44cf` off `origin/main` (`386a40c`).

## Material changes

- Public HTML states Plus at $39.99/year, with a 7-day free trial. Weekly $0.99 and annual $24.99 are gone.
- Tesla Plus card states full history and Tessie auto recording. The FAQ keeps the short price answer.
- Homepage Plus card opens on the yearly price. The membership intro states that price and does not say annual only. Support states the yearly price the same way.
- Privacy and terms meta and og descriptions do not pitch the price. The price stays in the page body and the JSON-LD Offer.
- `tools/verify-live` forbids only `3-day` as trial wording. Pricing checks require `$39.99/year` and `7-day free trial`, and forbid `0.99`, `24.99`, `per week`, and `weekly`.

## Verification

- `npm run check:server`, `npm run test:server` (66 pass), and `tests/e2e/public-beta.spec.ts` (7 pass) passed on Node 24 after the nits.
- Homepage pricing and the Tesla page were reshot at 1280 and 390. Horizontal overflow was 0.

## Unresolved

- Do not merge this PR. CI on the updated head still has to finish green.
- Dashboard "Weekly" statistics in `web/index.html` and music week totals in `server/src/recorder-mobile.ts` are not Plus plans. They were left as they are.

## Next steps

1. Push this branch and update PR #293 with the refreshed screenshots.
2. Leave the PR open. Do not merge until the owner says so.
