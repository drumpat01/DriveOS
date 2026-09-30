# V4 App Review: iPad and the sample library

JourneyDeck records drives on iPhone only. iPad shows what an iPhone records and syncs through the user's private iCloud, so a
new iPad has an empty library. To let App Review see every screen on either device, JourneyDeck includes a fictional sample library.

## What the sample is

- A separate local profile named "JourneyDeck Sample" (`src/demo-library.ts`, `enterDemoProfile` in `src/auth.ts`).
- Six fictional-looking drives with routes, songs and places, and three Memories, dated relative to today so Today, This week and
  On this day are populated.
- Each Memory has a bundled cover photo (`src/demo-photos.ts`, credits in `assets/demo/CREDITS.md`, Unsplash License).
- Removes itself: the sample lives for one launch. A sample left over from an earlier launch is deleted at startup, so the real profile
  (where iCloud data can sync in) comes back. Recording is hidden while the sample is open.
- Never uploaded: every row is written as already synced, `syncPrivateCloud` pauses for sandbox profiles, and the profile is
  deleted when the user leaves it. The user's own profile is not touched.
- Onboarding is skipped inside the sample.

## Where reviewers find it

- iPad, empty library: Today, Memories, Soundtrack and Atlas show "Requires an iPhone" with **Try sample data**.
- Any device: Settings, Account, **Try sample data**. Inside the sample the same row reads **Leave sample data**, and Today shows a
  "You're viewing sample data" bar with **Leave**.

## Suggested App Review notes (paste into App Store Connect)

> JourneyDeck records drives on iPhone. On iPad it shows the journeys, Memories and soundtracks recorded on the user's iPhone,
> synced through their private iCloud, so an iPad with no iPhone data shows a "Requires an iPhone" message. To review every screen
> on iPad without an iPhone, tap **Try sample data** on the empty Today screen (or Settings > Account > Try sample data). This opens
> a fictional library stored only on the device. Tap **Leave** on Today to remove it. JourneyDeck Plus can be reviewed with the
> sandbox account from the App Store Connect notes.

## Note for reviewers

If iOS ends the app in the background during review, the next launch returns to the (empty) real profile. Tap **Try sample data** again.
