# JourneyDeck current handoff, October 13, 2026

## Current objective

Open a non-draft PR that adds the Launch Llama badge to the homepage footer. Do not merge.

## Checkout

- Branch `cursor/launch-llama-homepage-badge-4cdd` off `main`.

## Material changes

- Exact Launch Llama badge snippet in `web/beta.html` footer, centered via `.footer-badge`.
- CSP `img-src` allows `https://tools.launchllama.co` only. CSS cache-bust `beta.css?v=grand-tour-5`.
- verify-live `page:/ launch-badge` plus server and Playwright coverage.

## Verification

- `npm run check:server`
- `npm run lint:server`
- `npm run test:server` (66 pass)
- `npx playwright test tests/e2e/public-beta.spec.ts` (5 pass)
- Footer screenshots at 390 and 1280 before/after.

## Unresolved / owner decisions

- Keep the PR open. Do not merge or deploy from this session.

## Next steps

1. Confirm JourneyDeck CI is green.
2. Do not merge or deploy.
