# JourneyDeck current handoff

## Current objective

Keep draft PR #299 open. The Tesla landing page is rebased onto main `102a13b`, which already redirects `/homeworld`. Do not merge and do not deploy.

## Checkout

- Branch `cursor/tesla-journal-landing-e036`.
- Draft PR: https://github.com/drumpat01/DriveOS/pull/299

## Material changes

- `web/tesla-drive-journal.html` keeps the URL, canonical, Umami script, and CSP. Headline is "The trip, later".
- Price line is exactly `JourneyDeck Plus, $39.99/yr, 7-day free trial for new subscribers`.
- Automatic recording is `automatic drive and charging history with Tessie, a Plus feature`. It needs Plus and Tessie. iPhone only.
- Without Tessie: one tap or Siri, the Start Journey and Stop Journey shortcuts.
- Tessie setup is the three owner steps through Music & Connections.
- Screenshot caption says the captures are not from a Tesla.
- `tools/verify-live` keeps both the Tesla page checks and the `/homeworld` 301 checks from main.

## Verification

- `npm run check:server` and `npm run lint:server` passed.
- `npm run test:server`: 68 passed. `npm run test:e2e`: 19 passed.
- `node tools/verify-live/verify-live.mjs --base http://127.0.0.1:8792`: 214 checks, 0 failed. Tesla headline, pricing, and copy passed. `redirect:/homeworld` and `redirect:/homeworld/` passed.

## Unresolved

- Do not merge and do not deploy.
- `mobile/recorder/src/first-run-v4.tsx` still says Settings, Recording. The public page follows Music & Connections. The app was not changed.

## Next steps

1. Leave the draft pull request open until the owner merges it.
2. After merge, deploy is a separate decision.
