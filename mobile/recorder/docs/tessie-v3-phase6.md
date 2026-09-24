# Tessie V3 Phase 6: Atlas travel stories

Phase 6 adds four V3-only sections to Atlas. They read the current profile's
local Tessie journey metadata and matched Supercharger stops, plus on-device
Apple Music and Last.fm soundtrack entries. No new network call or background
job is required to open Atlas. Existing V2 surfaces stay gated off.

## Appllama research and design decisions

The study covered 30+ screen records and 20 actual screenshots across map,
music, journal, and activity flows. Screen references are durable Appllama IDs;
the captured media URLs expire.

- Strava `426826309/oth_ifmv6` (Maps Route Explore) and
  `426826309/oth_067nr` (Saved Routes Grid) use a route preview next to a
  short destination summary. Atlas keeps its existing full map and adds small
  route thumbnails to the song and return-drive rows. Rows open the existing
  Journey detail stack.
- Mapstr `917288465/oth_fb1ky` (Place Detail Overlay) and
  `917288465/oth_lmv8i` (Filtered Map) keep details attached to map context.
  The Atlas rows retain route shape beside the name and time instead of
  introducing a new map tab or editing workflow.
- must.fm `6444621447/oth_qoeww` (Track Details) puts a single song's
  identity above its related information. Atlas selects one track at a time
  and lists the drives with a verified play timestamp. The source label names
  Apple Music and Last.fm; no Spotify-only features were imported.
- Day One `1044867788/oth_47e7h` (Reflection Prompt Pack) uses a discrete
  prompt before writing, and `1044867788/oth_c547u` shows an explanatory
  empty state. Atlas uses a small inline invitation, a separate name/notes
  composer, and text empty states. Strava `426826309/oth_ovkdd` (Save
  Activity Form) informed the explicit save step. No Memory is created merely
  by viewing or opening the prompt.

These patterns use JourneyDeck's existing Atlas cards, route thumbnails,
colors, typography, and navigation. Reference app paywalls, social sharing,
route planning, and discovery tools were outside this phase.

## Matching and interpretation

- Song travel accepts only Apple Music or Last.fm entries already matched to
  a Tessie journey, with an explicit timezone in `playedAt` and a time inside
  that drive's half-open start/end interval. A track and artist identify a
  song; one journey appears once even if the song played there repeatedly.
- A return story requires an outward drive starting at a named **Home**, the
  next drive for that same opaque vehicle within 18 hours, reversed named
  endpoints, and nonoverlapping times. Other-vehicle activity may occur
  between the two. Only a matched Supercharger stop entirely between those
  drives is shown. Unnamed or unrelated trips are left unpaired.
- Quiet moments are gaps of at least 15 minutes between recorded song
  timestamps, or a drive of at least 10 minutes with no recorded songs. The
  UI says **no music recorded**; it never claims silence or no playback.
- “Remember this drive?” appears inline in Atlas from 20 minutes to 48 hours
  after a completed Tessie drive, if that drive is not already in a Memory and
  was not dismissed. The profile-scoped dismissal persists locally. Saving
  requires an explicit Memory name and Save action; notes are optional.

## Verification and limits

The pure model tests cover timestamp/source rejection, song deduplication,
same-vehicle pairing, intervening trips, charging placement, history gaps,
and prompt timing. The UI fixture covers journey navigation, explicit save,
dismissal persistence, and empty states. Existing Atlas tests cover the
phone's stacked Atlas sections, iPad Duo panes, enlarged-text insight grid,
and navigation state. TypeScript and `git diff --check` passed.

This Windows host has no iOS Simulator or connected iPhone/iPad. Actual
screenshots, keyboard behavior, VoiceOver, iPad rotation/Split View, and
installed-device Dynamic Type remain unverified. The model cannot establish
silence: missing songs may reflect a disconnected provider, late import,
another player, or sparse history. A missing named Home, route geometry,
matched charge, or trustworthy song timestamp leaves that detail absent
instead of inventing it. Charge marker details remain device-only as in
Phase 2; the new Atlas stories do not export coordinates.

## Phase 7 handoff

1. On a V3 iPhone and iPad, exercise a real Tessie outward/return route with
   a Supercharger stop, Apple Music and Last.fm histories, partial GPS, late
   music sync, multiple vehicles, offline launch, and a profile switch.
2. Inspect Atlas and its Memory composer in iPhone portrait, iPad portrait
   and landscape with native sidebar, narrow Split View, rotation, keyboard,
   Dynamic Type XL, Reduce Motion, and VoiceOver. Confirm row push/back,
   dismissal persistence, and that a saved Memory appears in the library.
3. Confirm Tessie access/cost, vehicle route availability, and membership
   policy. Run the separate V3 release gates before any authorized Worker
   deploy, OTA, build, or submission.
