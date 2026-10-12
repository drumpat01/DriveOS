# JourneyDeck current handoff, October 12, 2026

## Current objective

Ship responsive LCP hero images on `/apple-music-soundtrack` and `/private-driving-journal`. Do not merge, deploy, or change hosting, DNS, analytics, or CSP.

## Checkout

- Branch `cursor/hero-lcp-srcset-952c` off `main`.

## Material changes

- Shared LCP art is `web/assets/beta/grand-touring-home.webp` (1536x1024, 315 KB), used as the `.hero` CSS background on both pages.
- Added `grand-touring-home-800.webp` (91 KB) and `grand-touring-home-1600.webp` (258 KB) beside the original, versioned with `?v=1`.
- Both pages now use an absolutely positioned `.hero-photo` with srcset/sizes, preload, and `fetchpriority="high"`. Other public pages keep the CSS background.
- `server/tests/api.test.ts` asserts 200 + immutable cache on the resized files and preload markup on both pages.

## Verification

- `node --test --import tsx server/tests/api.test.ts`
- `node --test --import tsx server/tests/campaign.test.ts server/tests/verify-live.test.ts`
- Playwright screenshots at 390x844 and 1280x800 (before and after). Mobile selects 800w; desktop selects 1600w.

## Unresolved / owner decisions

- Lab Lighthouse after-numbers still need to be recorded in the PR if the environment can run Lighthouse.
- PR 262 (verify:live) remains a separate review. Do not merge or deploy from this session.

## Next steps

1. Keep this hero LCP PR open for review. Do not merge or deploy.
2. Confirm JourneyDeck CI is green.
