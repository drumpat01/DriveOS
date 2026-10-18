# JourneyDeck current handoff

## Current objective

Keep draft PR #299 open. The Tesla page layout stacks the replay text above the phones from 701px up. Do not merge and do not deploy.

## Checkout

- Branch `cursor/tesla-journal-landing-e036`.
- Draft PR: https://github.com/drumpat01/DriveOS/pull/299

## Material changes

- `.soundtrack-proof--pair` is one column above 700px. The text is at most 560px wide. The phones stay side by side, each at most 300px, top-aligned, with a 32px row gap.
- The line under the hero lede has class `tesla-aside` and 14px of top margin.
- Mobile under 701px is unchanged.

## Verification

- No horizontal overflow at 360, 390, 701, 768, 1024, or 1280.
- Text width is 560px from 701px up. At 390 it is 316px. At 360 it is 286px, which is the full card width, and the heading does not overflow.
- `npm run check:server` and `npm run lint:server` passed.
- `npm run test:server`: 68 passed. `npm run test:e2e`: 19 passed.
- Local `verify:live`: 214 checks, 0 failed.
- Lighthouse mobile: performance 99, LCP 2.0 s, accessibility 100, best practices 100, SEO 92.

## Unresolved

- Do not merge and do not deploy.
- `mobile/recorder/src/first-run-v4.tsx` still says Settings, Recording. The app was not changed.

## Next steps

1. Leave the draft pull request open until the owner merges it.
