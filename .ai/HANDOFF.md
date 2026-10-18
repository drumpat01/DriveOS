# JourneyDeck current handoff

## Current objective

Replace the temporary journey stand-in from pull request 304 with the sample-profile Soundtrack captures. Pull request stays open. Do not merge and do not deploy.

## Checkout

- Branch `cursor/soundtrack-sample-capture-5892`, rebased onto main `7c9383f` (#302).
- Pull request: https://github.com/drumpat01/DriveOS/pull/307. Do not merge.
- `GET /` in web mode serves `web/beta.html`. Tour slide 2 uses `/assets/v4/05-soundtrack-sample.webp`. The route-replay figure still uses `/assets/v4/02-journey.webp`.
- `/apple-music-soundtrack` uses `/assets/v2/soundtrack-sample.webp?v=1` as a single image, the same shape as before #304. There is no `<picture>` or srcset on that figure. The jpg is served at `/assets/v2/soundtrack-sample.jpg` and is not in the markup.
- Deleted URLs still 404: `/assets/v4/05-soundtrack.webp`, `/assets/v2/soundtrack.webp`, `/assets/v2/soundtrack.webp?v=1`, `/assets/v2/soundtrack.jpg`.
- Rebase conflict was `.ai/HANDOFF.md`. Login throttle from #302 stayed.

## Material changes

- New files: `web/assets/v4/05-soundtrack-sample.webp` (660x1434), `web/assets/v2/soundtrack-sample.webp` and `web/assets/v2/soundtrack-sample.jpg` (600x1304).
- Alt text on both figures: "JourneyDeck Soundtrack screen with this month's road anthem, Golden Hour Highway by The Marlow Set, and listening stats from sample drives."
- Slide 2 copy in `web/beta.js` was already "Hear the memory again." / "The songs you played belong to the story". PR #304 did not change it.
- Soundtrack page caption: "I used a sample profile for this one. This month's road anthem is Golden Hour Highway by The Marlow Set."
- `verify:live` still 404-checks the three old URLs and now requires the sample files to return 200 with `image/webp` or `image/jpeg`. Forbidden page tokens are the old filenames with extensions, so the sample names are allowed.

## Verification

Node `v24.22.0`, after the rebase onto `7c9383f`:

- `npm run check:server` passed.
- `npm run lint:server` passed.
- `npm run test:server`: 79 passed.
- `npm run test:e2e`: 19 passed.
- `npm run verify:live -- --base http://127.0.0.1:8795` passed, including the three old 404s and the three sample 200s.

## Unresolved

- Do not merge and do not deploy.
- GitHub CI on `6e5f36e` passed, then main moved and the pull request conflicted. This rebase still needs CI.
- `mobile/recorder/store/screenshots/SHOT-LIST.md` still names a local `05-soundtrack.png`. That file is not a public URL.

## Next steps

1. Re-run checks on this rebase, push, and wait for GitHub CI. Do not merge.
2. If main moves again, rebase. The usual conflict is `.ai/HANDOFF.md`.
