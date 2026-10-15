# JourneyDeck current handoff, October 15, 2026

## Current objective

Design-review fixes for PR #290 are on `cursor/tesla-drive-journal-9ccf`. Do not merge.

## Checkout

- Branch `cursor/tesla-drive-journal-9ccf` off `main` (`43df42c`).

## Material changes

- `web/tesla-drive-journal.html`: each visible fact once. The lede is the journal sentence. The proof section is the reason to keep a long drive. Who it is for absorbed the private card. How it works is three steps, with charging and efficiency in step 3. Plus is the price only. FAQ is iOS 17. Tessie fees are a separate line. Desktop nav no longer has "Tesla journal". The page loads `public-a11y.css?v=2` so the header button stays one line. Meta and Open Graph keep one description.
- Homepage hero in `web/beta.html` is "A road trip journal" / "for your iPhone." Measured at 2 lines at 1280 and 390. The idea section under the hero says the journal lives on the device and no account is required.
- Default `verify:live` headline expectations match that hero. The X campaign headline is unchanged.

## Verification

- `npm run check:server`
- `npm run lint:server`
- `npm run test:server` (66 pass)
- `npm run test:atlas-performance`
- `npm run test:e2e` (15 pass)
- `npm run verify:live -- --base http://127.0.0.1:8795` (pass)
- Hero line count is 2 at 1280 and 390. Tesla header button at 390 matches the private driving journal button (one line, no horizontal overflow).

## Unresolved / owner decisions

- Keep the PR open. Do not merge or deploy from this session.
- Homepage Plus still says US$24.99 a year. The Tesla page says $39.99 a year, as requested.
- PowerShell analysis runs in Windows CI. This environment does not have `powershell.exe`.

## Next steps

1. Confirm JourneyDeck CI is green on the updated PR.
2. Do not merge or deploy.
