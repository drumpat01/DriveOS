# JourneyDeck current handoff

## Current objective

Add a JourneyDeck Studio digital products section to `web/terms.html`. Do not merge and do not deploy.

## Checkout

- Branch `cursor/terms-studio-digital-products-b41d`, based on main `ec46402`.
- Pull request: https://github.com/drumpat01/DriveOS/pull/306 (not a draft). Do not merge.
- Terms use an effective date, not a last-updated line. Effective date stays September 13, 2026.

## Material changes

- `#studio-products` covers Stripe downloads on studio.journeydeck.me (template packs and the Grok Bot Team Kit), with a 7-day refund line.
- Apple refund language in the Plus section now says it applies to in-app subscriptions only.
- `npm run verify:live` checks `page:/terms snippets` for `id="studio-products"` and `within 7 days of purchase and I'll refund you.`

## Verification

- Node 24.22.0: `check:server`, `lint:server`, `test:server` (68/68 on rerun; first run failed only the known flaky retention bad-signature assertion, 200 vs 401), `test:e2e` (18/18), local `verify:live --base http://127.0.0.1:8795` (pass, including `page:/terms snippets`).
- Screenshots: `/opt/cursor/artifacts/terms-studio-products-390.png` and `terms-studio-products-1280.png`.

## Unresolved

- Do not merge and do not deploy. Render was not changed.
- GitHub CI on https://github.com/drumpat01/DriveOS/pull/306 was still pending when this note was written.

## Next steps

1. Leave the pull request open until the owner merges it.
2. If GitHub CI fails only on the retention bad-signature test, rerun that job once.
