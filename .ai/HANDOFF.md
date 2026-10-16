# JourneyDeck current handoff, October 16, 2026

## Current objective

Static App Store links on the public site carry Apple campaign tokens so App Store Connect can credit downloads. Open PR against main. Do not merge.

## Checkout

- Branch `cursor/app-store-campaign-tokens-b523` off `origin/main` (`6ac588f`).

## Material changes

- Every `apps.apple.com/us/app/journeydeck/id6806502526` href in `web/*.html` includes `pt=129344416`, a per-page `ct`, and `mt=8`. Reviews links keep `see-all=reviews` and append the campaign query with `&`.
- Page tokens: `home` on `/` (`beta.html`); `tesla` on `/tesla-drive-journal`; `soundtrack` on `/apple-music-soundtrack`; `journal` on the other SEO landing pages; `site` on `/support`, `/privacy`, `/terms`, and `web/404.html`.
- `web/campaign.js` still rewrites `ct` from UTM values. `utm_source=x` and `utm_campaign=bio` set `ct=xbio`. The rewrite keeps a single `pt` and does not duplicate `pt`, `ct`, or `mt`. With no UTM, the static href stays.
- Public pages load `/campaign.js?v=5`. The JSON-LD `installUrl` on the homepage stays the bare listing URL.
- `tools/verify-live/expectations.json` records `pageCampaigns` and checks `pt` plus the page `ct`.

## Verification

- `npm run check:server`, `npm run lint:server`, and `npm run test:server` (66 pass) on Node 24.
- `tests/e2e/public-beta.spec.ts` (9 pass), including static tokens with JavaScript off, the X bio `ct=xbio` rewrite, and `appstore_click`.

## Unresolved

- PR #294 is open and non-draft: https://github.com/drumpat01/DriveOS/pull/294. Do not merge.
- CI on the branch head still has to finish green.
- Live `verify:live` against production will fail the new App Store checks until this ships.

## Next steps

1. Wait for CI on PR #294.
2. Leave the PR open. Do not merge until the owner says so.
