# V4 App Review: iPad and the sample library

JourneyDeck records drives on iPhone only. iPad shows what an iPhone records and syncs through the user's private iCloud, so a
new iPad has an empty library. To let App Review see every screen on either device, JourneyDeck includes a fictional sample library.

## What the sample is

- A separate local profile named "JourneyDeck Sample" (`src/demo-library.ts`, `enterDemoProfile` in `src/auth.ts`).
- Six fictional-looking drives with routes, songs and places, and three Memories, dated relative to today so Today, This week and
  On this day are populated.
- Each Memory has a bundled cover photo (`src/demo-photos.ts`, credits in `assets/demo/CREDITS.md`, Unsplash License).
- Instant: the sample (drives, songs, four Memories with photos) is built quietly in the background about six seconds after launch
  and rebuilt daily so its dates stay current. Turning it on only switches profiles. If it is still being built, an alert says so.
- Steps aside: a sample left open from an earlier launch returns to the real profile at startup (its data stays prepared), so the real
  profile, where iCloud data can sync in, comes back. The recorder bar stays (it is part of the app).
- Never uploaded: every row is written as already synced, `syncPrivateCloud` pauses for sandbox profiles, and the profile is
  kept prepared when the user leaves it. The user's own profile is not touched.
- Onboarding is skipped inside the sample.
- There is no free trial of Plus. A new member who closes the plans screen during setup without buying opens the sample library
  automatically, so the app is never empty or locked on first look.

## Where reviewers find it

- iPad, empty library: Today, Memories, Soundtrack and Atlas show "Requires an iPhone" with **Try sample data**.
- Any device: Settings, Account, **Try sample data**. Inside the sample the same row reads **Leave sample data**, and Today shows a
  "You're viewing sample data" bar with **Leave**.

## Suggested App Review notes (paste into App Store Connect)

> JourneyDeck records drives on iPhone and shows them on iPhone and iPad. A new install has no drives yet, so to review every
> feature right away, open **Settings (profile button on Today) > Account > Try sample data** on iPhone or iPad. On an empty iPad,
> the "Requires an iPhone" card also offers **Try sample data**. This opens a fictional library (drives with routes, songs, four
> Memories with photos) with full access to every JourneyDeck Plus feature, including Atlas and Ask JourneyDeck. It is stored only on
> the device and never uploaded. Tap the x to hide the "You're viewing sample data" bar, or Leave to return to your own data.
>
> JourneyDeck has no free trial. A new install that does not purchase from the plans screen opens this sample library automatically.
> The JourneyDeck Plus purchase can be reviewed outside the sample: open Settings > Membership or any Plus badge, and use
> your sandbox Apple Account. Restore Purchases is in Settings > Membership.

## Note for reviewers

If iOS ends the app in the background during review, the next launch returns to the (empty) real profile. Tap **Try sample data** again.
