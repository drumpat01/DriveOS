# Current Handoff State

## Current objective

Scout polish item 1 (PR #163): soft navy Skia frost / BackdropBlur on
stop/review sheets over imagery. Rebased onto `main` after #164 and #165.
Patrick authorized merge of remaining open PRs. Eng will squash-merge
#163. Do not merge from this branch. Do not touch EAS / TestFlight /
App Store submit.

## This branch — frost (#163)

- `mobile/recorder/src/navy-frost-policy.ts`: navy recipe (not milky white),
  Reduce Transparency → solid navy, frost vs opaque sheet presentation.
- `mobile/recorder/src/navy-frost.tsx`: live `BlurView` + navy tint; Skia
  `BackdropBlur` stills; solid fallback.
- `NativeSheet` `surface="frost"` is transparent `overFullScreen` over imagery.
  Default `surface="opaque"` stays `pageSheet`.
- Wired: journey marker review sheet; Relive stop/review stage over the map.
  Record-active chrome sets `animateChrome={false}`. No Moti.

## Already on main

### #165 — V3 TestFlight live listing

- `APP_VARIANT=v3-store` (EAS profile `v3-testflight`) enables V3 product
  features without switching bundle, Watch, or CloudKit identity.
- `v3-testflight`: store distribution, channel/environment `production`,
  `INTERNAL_TESTING=0`. Submit `ascAppId` is live `6806502526`.
- Isolated preview `APP_VARIANT=v3-preview` still forces
  `com.journeydeck.recorder.v3` / `iCloud.com.journeydeck.recorder.v3`.
- Gate fails closed without Patrick/CoS clear. Accepts `6806502526`,
  rejects isolated preview `6814695593`. TestFlight only — never App Store
  review submit from that stream.

### #164 — Reanimated list skeletons

- Shared skeleton bones (`src/list-skeleton.tsx`) pulse opacity only.
  Reduce Motion / background snaps to a static fill. No Moti.
- Shared list enter/exit/layout (`src/list-motion.ts`) uses FadeIn /
  FadeOut / LinearTransition and disables all three when Reduce Motion
  is on or the app is backgrounded.
- Applied to Soundtracks archive (phone + iPad), Journeys list empty
  load, Memories empty initial load, and JourneyCard row motion.
- Record-active UI in `App.tsx` is unchanged.

## Active tree

- Branch: `cursor/navy-frost-sheets-23bd` (PR #163), rebased onto
  `origin/main` (`86a2da1`, #164 after #165).
- Only rebase conflict was this handoff; frost sources applied cleanly.

## Verification

- Targeted: navy-frost, native-interactions, journey-markers-ui,
  journey-replay-stage, tab-runtime, typecheck.
- No device stills, no EAS, no OTA.

## Unresolved

- Native stills over live map/photo for Design review.
- Recording-finish `JourneySavedMoment` is a Home card, not over imagery.

## Next steps

1. Eng squash-merges #163. Do not merge from this branch.
2. Capture stills with `NavyFrostStill` over journey photo/map frames.
