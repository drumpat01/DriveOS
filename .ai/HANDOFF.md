# JourneyDeck current handoff

## Current objective

Open one pull request against main that adds the FollowX badge to every public site footer. Do not merge and do not deploy.

## Checkout

- Branch `cursor/followx-footer-badge-cf13`, based on main `07c9d86` (`Drop third-party app names from public site descriptions. (#320)`).
- Public home is `web/beta.html` at `GET /`. The site Worker serves `web/`.

## Material changes

- Every served public page with a site footer, including `web/404.html`, includes the FollowX badge link `https://followx.today/b/journeydeck.me`.
- The 410 notice in `cloudflare/site/src/retired.ts` has no site footer, so it does not include the badge.
- `img-src` in `server/src/app.ts` and `cloudflare/site/src/headers.ts` allows `https://followx.today`.
- `verify:live` checks `page:<path> followx-badge` on every public page and the 404, and `csp followx` on the homepage policy.

## Verification

- Local Node is v22.23.3. The public-page, campaign, verify-live, and FollowX Playwright checks passed.
- `npm run verify:live` was not run against production. Live HTML does not have the badge until this is deployed.

## Unresolved

- Do not merge. No deploy.

## Next steps

1. Review the pull request for `cursor/followx-footer-badge-cf13`. Do not merge it from this handoff.
