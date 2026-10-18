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

- Node 24.22.0 after merging main: `check:server`, `lint:server`, `test:server` (69/69), `test:e2e` (18/18, before the merge), local `verify:live --base http://127.0.0.1:8795` (pass, including `page:/terms snippets`).
- Screenshots: `/opt/cursor/artifacts/terms-studio-products-390.png` and `terms-studio-products-1280.png`.
- GitHub CI `validate` passed on `40c8932`: https://github.com/drumpat01/DriveOS/actions/runs/39091581636

## Unresolved

- Do not merge and do not deploy. Render was not changed.

## Next steps

1. Leave pull request 306 open until the owner merges it.
