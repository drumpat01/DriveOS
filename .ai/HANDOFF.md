# JourneyDeck current handoff

## Current objective

Remove the three public Soundtrack screenshots that show real listening history. Do not merge and do not deploy. A sample-profile replacement capture is a later pull request.

## Checkout

- Branch `cursor/remove-private-soundtrack-screenshots-5dcd`, rebased onto main `68657b7`.
- PR: https://github.com/drumpat01/DriveOS/pull/304. Do not merge.
- `GET /` in web mode serves `web/beta.html`. That tour slide now uses `/assets/v4/02-journey.webp`. `02-journey` was not already a tour slide; it remains the route-replay figure as well.
- Deleted: `web/assets/v4/05-soundtrack.webp`, `web/assets/v2/soundtrack.webp`, `web/assets/v2/soundtrack.jpg`.
- Main's `/wife.html` session gate and the deterministic retention bad-signature test are included.

## Material changes

- Homepage tour slide 2 (Soundtrack) and `/apple-music-soundtrack` show `/assets/v4/02-journey.webp` (660×1434).
- Those three URLs return 404 with `Cache-Control: public, max-age=0`. They do not get the 7-day image cache or the year-long immutable cache.
- `GET /` HTML must not contain `05-soundtrack` or `v2/soundtrack`. The same check covers the other HTML routes, including authenticated `/wife.html`.
- `npm run verify:live` checks that `/` and `/apple-music-soundtrack` omit the old paths and that the three URLs 404. The `/homeworld` redirect and unauthenticated `/wife.html` check from main are kept.

## Verification

- Node 24.22.0 after the rebase onto `68657b7`: `check:server`, `lint:server`, `test:server` (69 passed), `test:e2e` (18 passed), and `verify:live` against `http://127.0.0.1:8795` passed. Homepage HTML has neither `05-soundtrack` nor `v2/soundtrack`. The three image URLs returned 404 with `public, max-age=0`.
- A browser or CDN that already stored the old 200 responses can keep them until that cache entry expires. The versioned webp was `public, max-age=31536000, immutable`. The unversioned files were `public, max-age=604800`.

## Unresolved

- Do not merge and do not deploy.
- Sample-profile Soundtrack capture is a separate pull request.
- `mobile/recorder/store/screenshots/SHOT-LIST.md` still names a local `05-soundtrack.png` capture. That file is not a public URL.
- GitHub CI has not run on the rebased head yet.

## Next steps

1. Leave the pull request open until the owner merges it.
2. After deploy, confirm the three URLs 404 on journeydeck.me. Purge any CDN copy of the old images if a direct request still returns them.
3. Replace the interim journey screenshot with the sample-profile capture in a later pull request.
