# JourneyDeck current handoff

## Current objective

Open one ready pull request against main for the public site. Do not merge and do not deploy.

## Checkout

- Branch `cursor/site-offer-templates-trial-61e1`, based on main `9a886cb` (`Publish the annual Plus price and an llms.txt summary (#318)`).
- Public home is `web/beta.html` at `GET /`. The site Worker serves `web/`.

## Material changes

- Every Plus `Offer` keeps `price` `39.99` and `priceCurrency` `USD`, and adds `url` (the page App Store link), `availability` `https://schema.org/InStock`, and `priceSpecification` (`UnitPriceSpecification`, `billingDuration` `P1Y`).
- Copy: "unlocks" is "adds" on the driving-history and support pages. `landing.html` and `404.html` have no em or en dashes. Meta descriptions speak to you and stay at 155 characters or fewer. The Tesla description includes "drives and charging history".
- `web/robots.txt` keeps `Content-Signal: ai-train=no, search=yes, ai-input=yes`. The site Worker serves that file and does not rewrite it.
- CSP already allows `https://static.cloudflareinsights.com` on `script-src` and `https://cloudflareinsights.com` on `connect-src` in `server/src/app.ts` and `cloudflare/site/src/headers.ts`. Tests lock both.
- Homepage `#templates` links to `https://studio.journeydeck.me` with `data-umami-event="templates-click"`.
- `/tesla-drive-journal` has a Plus trial banner to the page App Store link (`ct=tesla_page`) with `data-umami-event="plus-trial-click"`. Wording: "Try the free trial of JourneyDeck Plus, then $39.99 a year."
- `verify:live` checks description voice, offer schema, home snippets, the robots line, and the Cloudflare insights CSP hosts.

## Verification

- Local Node is v22.23.3. CI validate uses Node 24.
- `tsc` for `server` and `cloudflare/site`, eslint on the touched tests, `server/tests` (`api`, `public-copy`, `verify-live`, `campaign`), site `headers` and `workerd` tests, Playwright `tests/e2e/public-beta.spec.ts` (12 pass).
- After screenshots at 1280 and 390 show the templates section and the Tesla banner with no horizontal overflow.
- `npm run verify:live` was not run against production. Live HTML will not match the new copy until this is deployed.

## Unresolved

- Do not merge. No deploy.

## Next steps

1. Review the pull request for `cursor/site-offer-templates-trial-61e1`. Do not merge it from this handoff.
