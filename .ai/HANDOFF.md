# JourneyDeck current handoff, October 16, 2026

## Current objective

Update public site Plus pricing to match App Store Connect: annual only, $39.99/year, with a 7-day free trial. Open a PR against main. Do not merge it.

## Checkout

- Branch `cursor/plus-annual-pricing-44cf` off `origin/main` (`386a40c`).

## Material changes

- Public HTML now says Plus is annual only at $39.99/year, with a 7-day free trial. Weekly $0.99 and annual $24.99 are gone.
- Meta descriptions and JSON-LD `Offer` blocks carry the same price. Free to record stays true.
- `tools/verify-live` forbids only `3-day` as trial wording. `plus trial` and `free trial` are no longer banned. Pricing checks require `$39.99/year` and `7-day free trial`, and forbid `0.99`, `24.99`, `per week`, and `weekly`.

## Verification

- `npm run check:server`, `npm run test:server`, and `tests/e2e/public-beta.spec.ts` passed on Node 24.
- Homepage pricing and the Tesla page were screenshotted at 1280 and 390. No horizontal overflow.

## Unresolved

- Do not merge this PR. CI on the pull request still has to finish green.
- Dashboard "Weekly" statistics in `web/index.html` and music week totals in `server/src/recorder-mobile.ts` are not Plus plans. They were left as they are.

## Next steps

1. Leave the PR open for review.
2. Do not merge until the owner says so.
