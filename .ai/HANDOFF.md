# JourneyDeck current handoff

## Current objective

Open one pull request against main for the public site: robots `ai-input=yes`, Plus at `$39.99/yr`, `llms.txt`, and meta descriptions of 155 characters or fewer. Do not merge and do not deploy.

## Checkout

- Branch `cursor/site-plus-price-llms-7cea`, based on main `c957167`. Feature commit `19e2d3e`.
- Pull request: https://github.com/drumpat01/DriveOS/pull/318 (draft).
- Public home is `web/beta.html` at `GET /`. The site Worker serves `web/`.

## Material changes

- `web/robots.txt`: `Content-Signal` is `ai-train=no, search=yes, ai-input=yes`. The other robots lines are unchanged.
- Public pages, including `/support`, say Plus is `$39.99/yr`. Offer JSON-LD stays `price` `39.99` and `priceCurrency` `USD`. No weekly price, no `$24.99`, and no 3-day trial. Existing 7-day trial wording stays. Support's check date is October 20, 2026.
- `web/llms.txt` is served at `/llms.txt` as `text/plain; charset=utf-8` by site Worker route `R438`. It is not in the sitemap. The sitemap still lists HTML pages only.
- Meta descriptions, `og:description`, and `twitter:description` are 155 characters or fewer.

## Verification

- Local Node is v22.23.3. CI validate uses Node 24.
- `npm run check:server`, `npm run lint:server`, targeted `server/tests` (`api`, `public-copy`, `verify-live`), `npm run check:site`, `npm run test:site`, `npm run predeploy:site`.
- Playwright `tests/e2e/public-beta.spec.ts` (11 pass).
- Workerd returns `/llms.txt` as `text/plain` with `cache-control: public, max-age=0` and no `x-robots-tag`.
- `verify:live` was not run against production. The live site still has the previous copy.

## Unresolved

- Do not merge. No deploy.

## Next steps

1. Review https://github.com/drumpat01/DriveOS/pull/318. Do not merge it from this handoff.
