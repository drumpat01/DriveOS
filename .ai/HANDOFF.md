# JourneyDeck current handoff

## Current objective

Keep `verify:live` aligned with the site Worker on https://journeydeck.me. Do not merge. Do not change site or Worker code.

## Checkout

- Branch `cursor/verify-live-retired-410-dd91`, based on main `48178cb` (#312).
- PR: https://github.com/drumpat01/DriveOS/pull/313. Do not merge.
- Render (`driveos.onrender.com`) is suspended. The apex is the Cloudflare Worker. Nothing proxies to Render.

## Material changes

- Retired HTML paths expect HTTP 410, `noindex`, `no-store`, and `The old web app has been retired`. `/login` stays Umami-free.
- `/healthz` and `/readyz` expect HTTP 200 and `{"ok":true,"service":"journeydeck-site"}`, with `Cache-Control: no-store` and no `rndr-id`.
- The body must not include `atlas`, `generatedAtUtc`, `legacyCompatibilityReachable`, or `snapshotStale`.
- `--since` is still accepted and does not read a snapshot time.

## Verification

- `npm run test:server`: 79 passed, 0 failed.
- `npm run verify:live -- --base https://journeydeck.me`: 233 passed, 0 failed. Exit 0.

## Unresolved

- Do not merge this PR.

## Next steps

1. Wait for CI on https://github.com/drumpat01/DriveOS/pull/313. Rebase onto main if it moves. Do not merge.
