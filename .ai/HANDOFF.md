# JourneyDeck current handoff

## Current objective

Polish the Tesla page soundtrack shots. Pull request stays open. Do not merge and do not deploy.

## Checkout

- Branch `cursor/tesla-soundtrack-alignment-85c4`, rebased onto main `f93ecce` (PR #307).
- Pull request: https://github.com/drumpat01/DriveOS/pull/309. Do not merge it.
- The rebase conflict was only `.ai/HANDOFF.md`. Both sides are kept below. CSS behavior is unchanged.

## Tesla soundtrack alignment

- From 900px up, `.soundtrack-shots` uses `justify-content: start` so the phones share the text column's left edge. The text column stays left-aligned.
- From 701px up, the pair figures stretch and each figcaption uses `margin-top: auto` with `padding-top: 12px`, so the two captions share a baseline.
- Tesla stylesheet cache buster is `soundtrack-v2.css?v=5`. Copy and images are unchanged.
- At 390 the soundtrack section screenshot is byte-identical to before the change.
- Node `v24.22.0`, local web server `http://127.0.0.1:8795`: `check:server`, `lint:server`, `test:server` (79), `test:e2e` (19), and `verify:live` passed.
- At 1280, caption tops (viewport y, section scrolled to the top) were replay 883.80 and Atlas 891.23 before the change (Atlas 7.44px lower). After the change both caption tops are 879.23 and both text bottoms are section y 908.375.

## Sample Soundtrack captures (from main, PR #307)

- Branch `cursor/soundtrack-sample-capture-5892`, rebased onto main `7c9383f` (#302). Pull request: https://github.com/drumpat01/DriveOS/pull/307. Merged as `f93ecce`.
- `GET /` in web mode serves `web/beta.html`. Tour slide 2 uses `/assets/v4/05-soundtrack-sample.webp`. The route-replay figure still uses `/assets/v4/02-journey.webp`.
- `/apple-music-soundtrack` uses `/assets/v2/soundtrack-sample.webp?v=1` as a single image, the same shape as before #304. There is no `<picture>` or srcset on that figure. The jpg is served at `/assets/v2/soundtrack-sample.jpg` and is not in the markup.
- Deleted URLs still 404: `/assets/v4/05-soundtrack.webp`, `/assets/v2/soundtrack.webp`, `/assets/v2/soundtrack.webp?v=1`, `/assets/v2/soundtrack.jpg`.
- Rebase conflict was `.ai/HANDOFF.md`. Login throttle from #302 stayed.
- New files: `web/assets/v4/05-soundtrack-sample.webp` (660x1434), `web/assets/v2/soundtrack-sample.webp` and `web/assets/v2/soundtrack-sample.jpg` (600x1304).
- Alt text on both figures: "JourneyDeck Soundtrack screen with this month's road anthem, Golden Hour Highway by The Marlow Set, and listening stats from sample drives."
- Slide 2 copy in `web/beta.js` was already "Hear the memory again." / "The songs you played belong to the story". PR #304 did not change it.
- Soundtrack page caption: "I used a sample profile for this one. This month's road anthem is Golden Hour Highway by The Marlow Set."
- `verify:live` still 404-checks the three old URLs and now requires the sample files to return 200 with `image/webp` or `image/jpeg`. Forbidden page tokens are the old filenames with extensions, so the sample names are allowed.
- Node `v24.22.0`, after the rebase onto `7c9383f`: `check:server`, `lint:server`, `test:server` (79), `test:e2e` (19), and `verify:live` passed, including the three old 404s and the three sample 200s.
- GitHub CI on `6e5f36e` passed, then main moved and that pull request conflicted before it merged.
- `mobile/recorder/store/screenshots/SHOT-LIST.md` still names a local `05-soundtrack.png`. That file is not a public URL.

## Unresolved

- Do not merge and do not deploy pull request 309.
- GitHub CI on the handoff rebase still needs to finish.

## Next steps

1. Wait for GitHub CI on pull request 309. Do not merge.
2. If main moves again and the branch conflicts, rebase. The usual conflict is `.ai/HANDOFF.md`. Keep both sides.
