# JourneyDeck current handoff

## Current objective

Revise the JourneyDeck Studio terms card and keep pull request 306 open. Do not merge and do not deploy.

## Checkout

- Branch `cursor/terms-studio-digital-products-b41d`, rebased onto `origin/main` `68657b7` (#305). Pull request: https://github.com/drumpat01/DriveOS/pull/306
- #304 was still open at rebase time.
- Terms use an effective date, not a last-updated line. Effective date stays September 13, 2026.

## Material changes

- `#studio-products` is three paragraphs: what is sold, the 7-day refund plus 90 days of free updates, and the personal license.
- `support@journeydeck.me` is named once in that card. The Contact card on `/terms` uses the same address. Privacy was not changed.
- `npm run verify:live` checks `page:/terms snippets` for `id="studio-products"` and `within 7 days of purchase and I’ll refund you.`

## Verification

- Node 24.22.0: `check:server`, `lint:server`, `test:server` (69/69), `test:e2e` (18/18), local `verify:live --base http://127.0.0.1:8795` (pass, including `page:/terms snippets`).
- Screenshots: `/opt/cursor/artifacts/terms-studio-products-390.png` and `terms-studio-products-1280.png`.

## Unresolved

- Do not merge and do not deploy. Render was not changed.
- GitHub CI on the rebased head is still pending.

## Next steps

1. Leave pull request 306 open until the owner merges it.
2. If CI fails only on the retention bad-signature test, rerun that job once.
