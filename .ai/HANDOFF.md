# JourneyDeck current handoff

## Current objective

Open one pull request against main for public site copy. Do not merge and do not deploy.

## Checkout

- Branch `cursor/site-drop-app-names-fd5c`, based on main `4825276` (`Add annual Plus offer details, templates, and a Tesla trial banner (#319)`).
- Public home is `web/beta.html` at `GET /`. The site Worker serves `web/`.

## Material changes

- Served public pages no longer name Tessie. Descriptions, Open Graph descriptions, and Twitter descriptions do not name Tessie or Apple Music. Each description stays at 155 characters or fewer. Descriptions that already said "private" still say it.
- `/tesla-drive-journal` trial banner says `Try the free trial of JourneyDeck Plus, then $39.99/yr.`
- `web/landing.html` is not served. `GET /landing.html` is a 404 in `server/src/app.ts` and the site Worker route list. Tests, the route generator, and docs still name that path. The file is unchanged.
- `web/index.html` is the signed-in app shell and still names Tessie. Soundtrack page bodies still name Apple Music where they explain that connection.

## Verification

- Local Node is v22.23.3. CI validate uses Node 24.
- `tsc -p server/tsconfig.json --noEmit` and eslint on the touched server tests passed.
- `server/tests` (`api`, `public-copy`, `verify-live`, `campaign`) passed. Playwright `tests/e2e/public-beta.spec.ts` passed (12).
- `npm run verify:live` was not run against production. Live HTML still has the previous copy until this is deployed.

## Unresolved

- Do not merge. No deploy. Do not delete `web/landing.html` without Patrick's yes.

## Next steps

1. Review the pull request for `cursor/site-drop-app-names-fd5c`. Do not merge it from this handoff.
