# JourneyDeck current handoff — October 10, 2026

## Current objective

Remove leftover 3-day Plus trial wording from public marketing pages in `web/`. Do not merge, deploy, or touch hosting/DNS/analytics.

## Checkout

- Branch `cursor/remove-web-trial-copy-d8e5` off `main`.
- Owner already removed the in-app trial (PR 254). This PR is marketing copy and a server regression test only.

## Material changes

- `web/beta.html`: drop trial pitch from the hero footnote, Atlas note, membership intro, Free card, and membership footnote. Keep existing US$0.99 / week and US$24.99 / year prices.
- `web/support.html`: rewrite Plus FAQ answers and keep FAQPage JSON-LD in exact sync.
- `web/terms.html`: left alone (`trial terms` is general legal language).
- `server/tests/api.test.ts`: fail if served home or Support HTML contains `3-day` or `Plus trial`.

## Verification

- Targeted: `node --test --import tsx --test-name-pattern='3-day Plus trial|public information' server/tests/api.test.ts`
- Then `npm run test:server` so existing API tests stay green.

## Unresolved / owner decisions

- Terms still says “trial terms” in the purchases paragraph. Owner can decide whether to keep that general legal wording.
- Owner to-do from prior handoff: delete the scheduled Oct 14 App Store 3-day intro offers; release 4.5.0 after approval.

## Next steps

1. Keep the PR open for review. Do not merge or deploy from this session.

## Verify-live CLI (October 11, 2026)

Current objective: add a reusable live-site verifier and feature map. Do not merge, deploy, or change visible pages.

- Branch `cursor/verify-live-cli-0e37` off `main`.
- Added `tools/verify-live/verify-live.mjs`, `tools/verify-live/lib.mjs`, `tools/verify-live/expectations.json`, `tools/verify-live/FEATURE_MAP.md`, `server/tests/verify-live.test.ts`, and npm script `verify:live`.
- `/readyz` `generatedAtUtc` is service restart / snapshot time, not deploy time.
