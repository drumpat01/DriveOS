# JourneyDeck current handoff

## Current objective

Keep draft PR #299 open. Apply the design review on the Tesla landing page. Do not merge and do not deploy.

## Checkout

- Branch `cursor/tesla-journal-landing-e036`, on top of `3a793d6`.
- Draft PR: https://github.com/drumpat01/DriveOS/pull/299

## Material changes

- Hero uses the preloaded `has-photo` image from the private driving journal page.
- Copy says each fact once. The shortcut explanation stays on the Tessie card. The price line stays on the Plus card and in the FAQ.
- Replay and Atlas sit side by side from 701px up via `soundtrack-proof--pair`.
- Replay crop is box `(80, 292, 596, 1400)`, 516 by 1108. The right edge is 596 so the zoom controls show. The top starts at 292 so the rounded-corner mat stays outside. A 12px border scan found no marketing-mat pixels.
- Captions say the screens are not a Tesla drive and not Tesla data.

## Verification

- `npm run check:server` and `npm run lint:server` passed.
- `npm run test:server`: 68 passed. `npm run test:e2e`: 19 passed.
- Local `verify:live` at `http://127.0.0.1:8792`: 214 checks, 0 failed, including Tesla copy and both `/homeworld` redirects.
- Lighthouse mobile: performance 100, LCP 1.9 s on `.hero-photo`. SEO 92 is the existing `Content-Signal` line in `robots.txt`.

## Unresolved

- Do not merge and do not deploy.
- `mobile/recorder/src/first-run-v4.tsx` still says Settings, Recording. The public page follows Music & Connections. The app was not changed.

## Next steps

1. Leave the draft pull request open until the owner merges it.
2. After merge, deploy is a separate decision.
