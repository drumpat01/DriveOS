# JourneyDeck current handoff, October 15, 2026

## Current objective

Open a non-draft PR for the Tesla SEO landing page and the homepage hero rewrite. Do not merge.

## Checkout

- Branch `cursor/tesla-drive-journal-9ccf` off `main` (`43df42c`).

## Material changes

- New public page `web/tesla-drive-journal.html` at `/tesla-drive-journal`, for Tesla and EV owners.
- Registered in `server/src/app.ts` (`publicPaths` and `GET`), `web/sitemap.xml`, `tools/verify-live/expectations.json` and `FEATURE_MAP.md`, server tests, and the Playwright studio nav check.
- Homepage hero in `web/beta.html`: "A private road trip journal" / "for your iPhone." The subline names drives, the music you played, and Tesla owners via Tessie. No trial language. CSS cache keys are unchanged.
- Default `verify:live` headline expectations match that hero. The X campaign headline is unchanged.
- The Tessie card on the homepage links to the new page.

## Verification

- `npm run check:server`
- `npm run lint:server`
- `npm run test:server` (66 pass)
- `npm run test:atlas-performance`
- `npm run test:e2e` (15 pass)
- `npm run verify:live -- --base http://127.0.0.1:8795` (pass)
- Screenshots of `/tesla-drive-journal` and the homepage hero at 1280 and 390.

## Unresolved / owner decisions

- Keep the PR open. Do not merge or deploy from this session.
- PowerShell, gitleaks, and Trivy run in Windows CI. They are not installed in this Linux environment.

## Next steps

1. Confirm JourneyDeck CI is green.
2. Do not merge or deploy.
