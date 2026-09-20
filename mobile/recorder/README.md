# JourneyDeck Recorder

## Stories & Studio — TestFlight Build 22, September 7, 2026

Journey detail now opens the Plus trim/split editor with live themed route feedback and a smoke dissolve. Memory detail offers free, reviewed Photo Matching from permitted Photos timestamps and locations. Statistics opens the Plus Year on the Road recap with eight animated chapters, optional original music and an independent recap theme chooser. Original journey recovery and existing work are preserved. [Native Build 22](https://expo.dev/accounts/journeydeck/projects/journeydeck/builds/d2bec584-7978-41a0-93e2-c80deeda53a4), version 2.0.0/runtime `2.0.0-watch.3`, is accepted and available for internal TestFlight on iPhone/iPad with the paired Watch app. The new JourneyEdit CloudKit schema is deployed to production. Signed package checks pass; physical feature/upgrade/sync acceptance remains pending. Update both devices before testing edited-journey sync. Production OTA `01a07ef8-a1db-7929-84c6-433ee6e0eb4c` adds the explicit asynchronous SQLite startup gate and non-destructive recovery screen for this runtime. No public App Store release was published. See [implementation, permissions and release acceptance](docs/stories-studio-2026-09-07.md) and [SQLite startup architecture](docs/sqlite-startup-architecture-2026-09-07.md).

## September 7 TestFlight release — 2.0.0 (19)

Apple reports Build 19 as valid and available for internal TestFlight testing. The Themes & Icons release uses public runtime `2.0.0-watch.2` and preview runtime `2.0.0-preview.7`, preserving the existing public bundle identifier, private iCloud container and on-device store. Build 18 remains on `2.0.0-watch.1`. This build contains all device-proven UI/gesture fixes, five approved Grand Touring tab images, four independent app-icon choices, the compact Watch layout and DIAG-10 local JavaScript failure capture. Physical icon switching and installation acceptance remain for testing on installed devices.

## Independent app icon picker — source implementation, September 7, 2026

Settings on iPhone and iPad now has a separate **App Icon** picker with Original, Warm Ivory, Rosewater and Grand Touring. Icon selection is persisted under its own key and never follows or changes the in-app theme. The three alternate icons are generated as opaque 1024px iOS asset-catalog entries during prebuild, and a local UIKit module reads and changes the icon that iOS actually applied. Warm Ivory reuses the current production light icon asset. The existing binary does not contain that native module or the alternate icon sets, so this feature becomes functional only after the next native build.

## Rosewater and Grand Touring — September 6, 2026

These replace Sakura Chrome and Redline Noir while retaining saved preference IDs. Settings offers Cinematic Dark, Grand Touring, Warm Ivory and Rosewater, all free for testing. Rosewater uses blush surfaces, raspberry and botanical accents; Grand Touring uses midnight navy, steel blue, champagne, ivory and chrome. Each replacement includes dedicated header, default Memory-cover and journey-placeholder artwork. Real photos and album covers remain intact. See [current theme notes and artwork prompts](docs/premium-themes.md). Earlier theme entries below are historical.

## Theme picker — source implementation, September 6, 2026

Published to iOS production for Build18 (`2.0.0-watch.1`), OTA group `3dbc40c7-f561-4547-911d-bf4d3a54c4ba`, September 6. Channel readback verified; physical review remains pending. This supersedes the publication-pending statement below.

Settings on iPhone and iPad now offers Cinematic Dark, Warm Ivory, Sakura Chrome and Redline Noir, all free for testing. The selection persists locally and updates shared screen palettes, decorative artwork, materials and native navigation appearance. Sakura uses pearl/blossom surfaces; Redline uses carbon/chrome with a red signature and varied metric colors. No native dependency or runtime change is required. Physical review and OTA publication are pending. See [theme implementation and acceptance notes](docs/premium-themes.md).

## iPad Statistics — source implementation, September 5, 2026

The approved calendar-under-widgets dashboard in `src/ipad-statistics-screen.tsx` now powers both iPad and iPhone: six summary cards, local-date calendar and selected-day journeys, daily mileage, distance bands, departure hours, distance/duration scatter, distinct music totals, paged recent journeys, averages, record highs and activity split. iPhone uses compact safe-area spacing, two equal headline columns and stacked detail panels; iPad retains its wide rows. The shared screen uses the existing profile-owned archive, neon dark and pastel light themes, native journey links and membership/Atlas gates. Listening time sums known saved song durations and marks incomplete music data. Comparisons require a complete accessible prior period. The pure model and interaction/calculation tests are in `ipad-statistics-model.ts` and `tests/ipad-statistics.test.mts`.

Typecheck and the full 294-test mobile suite pass with shared iPhone/iPad Statistics coverage. Physical iPhone/iPad layout and VoiceOver acceptance remain pending for the newest source. No build or submission was run for this follow-up; see `.ai/HANDOFF.md` for the latest production OTA state. Older blank-Statistics notes below are historical.

## Apple Watch companion — source implementation, September 5, 2026

The paired Watch app adds one Start/Stop Journey button backed by the iPhone's native local recorder, with a ten-minute GPS inactivity stop. New manual starts on the phone share that recorder. See [Watch implementation, native build and device checks](watch/README.md). Source now uses preview runtime `2.0.0-preview.6` (public `2.0.0-watch.1`); installed Build 6 / preview.5 is unchanged and needs a new native build to gain Watch support. Older runtime notes below describe earlier previews.

## Current iPad V2 preview — September 5, 2026

`V2-P5-MEM2` brings Memory Studio to the iPhone Memories tab. Phone presentation shares the iPad drag/drop engine and persistence handlers, with a compact theme-matched artwork header, two-column photo gallery (one column on narrow/large-text layouts), and an independently scrolling, spring-expandable journey tray above the native tab bar. Search/selection/scroll hosts survive tray collapse and resizing. Native Memory detail/Edit/Share, journey action menus, photo editor, membership gates and private iCloud queue remain connected. Keyboard avoidance and tap selection alternatives are included. No new native modules or build; physical iPhone layout, keyboard, bar clearance and gesture acceptance remain pending.

`V2-P5-MEM1` implements the iPad Memory Studio in both themes: a responsive photo-card gallery beside a searchable journey library, long-press dragging onto a Memory to append or onto another journey/new-chapter target to open the shared creation sheet. Reanimated UI-thread movement, target highlighting, spring return/settle, panel edge scrolling, Reduce Motion, native Memory detail/context actions, and tap selection alternatives use the existing native runtime. Drops append to the latest profile-owned SQLite record, preserve hidden journey links/notes/cover, reject missing/deleted/foreign records, and queue private iCloud sync. iPhone layout and native tab bar are unchanged. Physical iPad gesture, sidebar, rotation and visual acceptance remain pending.

`V2-P5-S7` checks the current Documents folder when an app-authored private photo's persisted absolute URI fails. It reconstructs only the exact original profile/photo-ID/extension path and relinks it only if the file exists and is nonempty. Shared by photo display and upload preflight. The SQLite compare-and-set changes only the local URI, preserving revisions, timestamps, sync acknowledgement, and tombstones; concurrent replacement/removal cannot be overwritten. No search across profiles, file deletion, or synthetic upload success. This handles stale Documents paths; it cannot recreate photo bytes that are absent. Native-downloaded Application Support assets are not rebased by this focused repair.

`V2-P5-S6` adds local sync failure details to Settings and manual-sync alerts: item type, Memory/song title where known, photo position, a stable short reference, and an allowlisted explanation. Local missing/empty/unreadable files, deferred dependencies, and native per-record CloudKit failures are distinguished. No filesystem paths, coordinates, raw native metadata, or diagnostic titles are sent to telemetry. Incomplete sync alerts no longer say finished; missing-file failures do not suggest endless manual retries. This diagnoses the remaining iPhone item without deleting or marking it synced. Existing launch/resume automatic sync behavior is unchanged.

Latest OTA `V2-P5-S5` adds canonical places to private iCloud using versioned `library.place.v1.*` PrivatePreference payloads. Existing place rows are backfilled, saved Home/Work/School identities map to the receiving profile, journey references resolve to local canonical rows, and explicit edits/removals round-trip with revision checks. Restore preferences/places before journeys, then routes/music/memories/photos. A missing dependency retains the CloudKit cursor for retry while independent data and uploads continue. Exact route assets restore endpoint coordinates, and Atlas rebuilds from downloaded data. Missing local photo files remain pending without blocking later valid photos. Settings reports remaining uploads instead of claiming full sync. Existing native Build 6/runtime preview.5 and private CloudKit schema suffice; update both V2 apps, sync iPhone first, then iPad. Physical transfer acceptance is pending. The inactive legacy Collections format and device credentials are outside the current library contract.

`V2-P5-T2` uses three exact one-third slots for the iPhone Statistics highlights, with symmetric five-point inner padding that creates fixed 10-point gutters independently of the longest-drive card's native Link/menu wrapper. Both themes and existing card interactions are retained.

The installed universal preview is Build 6 / runtime `2.0.0-preview.5`; Build 5/runtime preview.4 references below are historical. `V2-P5-M2` implements the approved Soundtracks option-2 album gallery: six initial covers in a responsive three-column grid with Show more, a side column of 2×2 metrics, artists and a seven-day saved-duration chart, and full-width searchable/paged listening history below. Home, Soundtracks and Settings share `IpadPageHeader`, with each page's themed artwork behind its title and the same system font, weight, size and spacing (36pt, 28pt below 600pt usable canvas). Native sidebar insets reduce the usable canvas; narrow windows stack panels. Memories and Statistics remain blank. Existing source links, refresh, journey navigation, recorder state and account controls are reused. iPhone layout and accepted Stats/Statistics rotation behavior are preserved.

`V2-P5-S2` presents iPad Settings as the approved option-3 grid in Warm Ivory and dark mode, with aligned account/Apple/sync buttons, matching three-column preference and saved-place rows, and a slim Advanced Support / Privacy Policy / Support Page row. Actual sidebar-adjusted width and text size determine when the grid stacks in narrow windows. Profile/place editors keep their focused reading width. Existing iPhone handlers still own Apple sign-in, private iCloud sync, membership and music settings; phone layout is unchanged. OTA-compatible with Build 6. After sync the shared Home/Music snapshot reloads. Use the same device iCloud account and the same Apple-linked JourneyDeck profile on both V2 devices; sync the source iPhone first, then the iPad. The V2 preview's private container remains separate from V1. Native sign-in/sync and iPad appearance require physical device acceptance.

JourneyDeck Recorder is a private, local-first iPhone driving journal. Version 1 uses one predictable recording flow for everyone: tap Start Journey, drive, then tap End Journey. Apple Music can build the soundtrack while the journey is active, or the user can choose manual song recognition instead. Completion work is stored in a leased retry queue so closing the UI can delay enrichment but cannot reopen or lose a finished drive. Optional recorder credentials are stored in iOS Keychain and are never bundled with the app.

## V2 worktree: preview builds and OTA updates

This worktree adds a saved Settings **Light Mode** switch for the warm ivory palette. Existing users remain in cinematic dark until they select light. See the [V2 roadmap](../../docs/JOURNEYDECK-V2-ROADMAP.md).

Phase 1 now uses Expo Router Native Tabs, with a permanently orange Home icon, and a native stack for Memory/Journey details and Atlas/Tools. Tabs remain mounted; native back gestures return to the existing screen. The shared shell retains the single recorder and profile-scoped archive. Settings editors hide the bar without removing tab routes. The native tab host owns selection; the old pager and custom dock no longer render.

The tab-spacing follow-up assigns five equal item widths through public UIKit appearance APIs. Build 4's legacy bar-only settings did not fix physical spacing: selected UITabBarItem appearances override the bar appearance. The revised `plugins/with-even-native-tabs.js` covers both bar and per-item standard/scroll-edge appearances, preserves existing styles by copying them, and avoids repeated assignments when unchanged. It applies during prebuild and fails closed if React Native Screens moves beyond the reviewed 4.26.2 controller. Review that plugin when upgrading Screens. Native iOS app-icon assets include the approved ivory/plum light variant and original dark variant; Home Screen Auto appearance controls them independently of the in-app theme switch. These changes require a native build. The user confirmed Build 5 plus the Music-label OTA fixes the reported spacing issue on their iPhone.

Current signed preview: [JourneyDeck V2 2.0.0 (5)](https://expo.dev/accounts/journeydeck/projects/journeydeck/builds/600df751-9b24-49e1-b889-fbdd692bdf6d). Includes revised per-item native spacing and automatic light/dark Home Screen icons. Open on the registered iPhone and install over the existing V2 preview. The compatible preview.4 OTA `145d93b7-561a-4a8d-ac54-a1de038f228c` shortens the first tab label to **Music**, retaining the **Soundtracks** page title; restart when the update prompt appears. Signed identity, runtime, entitlements and archive integrity verified; the user confirmed tab spacing and the Music label on their iPhone. Broader gesture/recording acceptance remains pending.

Use the `v2-preview` profile here; the older `preview` and `development` commands below describe V1 and are deliberately blocked by the V2 configuration. The preview installs alongside V1 as **JourneyDeck V2**, with its own local library and private iCloud container. Its different bundle ID does not inherit the original app's StoreKit subscription.

Run from `mobile/recorder`, after verification and when preview distribution is authorized:

```powershell
$env:APP_VARIANT = 'v2-preview'
npx eas-cli build --platform ios --profile v2-preview
```

For authorized JavaScript/asset updates compatible with the installed preview runtime:

```powershell
$env:APP_VARIANT = 'v2-preview'
$env:EXPO_PUBLIC_JOURNEYDECK_INTERNAL_TESTING = '0'
npx expo export --platform ios --output-dir dist-v2-preview
npx eas-cli update --channel v2-preview --environment preview --platform ios --skip-bundler --input-dir dist-v2-preview --message "Describe the preview change"
```

Preview channel: `v2-preview`; current source runtime: `2.0.0-preview.4`; bundle: `com.journeydeck.recorder.v2`. Install the appearance-spacing correction build before testing compatible OTAs. Older previews use `2.0.0-preview.1`, `.2` or `.3` and cannot receive these native changes by OTA. Preview build numbers increment remotely. The shared EAS preview environment contains INTERNAL_TESTING=1, so export explicitly with 0 and upload that verified bundle with `--skip-bundler`; the build profile also explicitly sets 0. Native module, entitlement, or permission changes require a new compatible native build. Verify the resolved config before either command. Do not publish V2 test updates to the V1 preview or production channels.

Before accepting Phase 1 on the iPhone, check quick tab changes in both themes, the orange Home icon in selected/unselected states, scroll/search/filter retention, Memory → Journey → swipe back, sharing/editing from details, Settings editor keyboard behavior, and recording across tabs/background/lock. Also check Reduce Motion and large text. Automated route/state tests validate lifecycle and data ownership; native frame timing and iPhone gesture/layout acceptance require the physical build.

Public V2 uses the existing JourneyDeck App Store listing and `com.journeydeck.recorder`, preserving the normal update path, local data, original iCloud container, and StoreKit product IDs. Before an explicitly authorized production build/update, clear `APP_VARIANT` from the shell (`Remove-Item Env:APP_VARIANT -ErrorAction SilentlyContinue`) and verify the original identity. The production runtime becomes `2.0.0`, separate from both V1 and the side-by-side preview. The preview request does not authorize App Store submission or production OTA publication.

## Public-release scope

- iPhone-only, local-first journey recording;
- manual Start and Finish with background GPS route capture;
- Start, Pause, Resume, Finish, and manual retry;
- offline-first local storage with optional private iCloud continuity;
- Apple Music history for automatic soundtracks, plus user-initiated ShazamKit recognition for individual songs;
- a StoreKit-verified membership that unlocks Atlas and history older than 45 days;
- no public Spotify, Last.fm, or direct Spotify import until the separate commercial permissions and review scope are complete;
- no Android build.

Locking the phone or opening another app does not stop an active journey. Version 1 never starts a journey automatically.

`EXPO_PUBLIC_JOURNEYDECK_INTERNAL_TESTING=1` is reserved for development and preview builds. It exposes the owner-only Spotify and Last.fm experiments. Production explicitly sets it to `0`; do not change that setting for an App Store build.

## Local verification

Use Node 22.13 or newer, then run:

```powershell
cd mobile/recorder
npm install
npm run typecheck
npx expo-doctor
```

Background location cannot be tested in Expo Go. Use an EAS internal build on a physical iPhone.

## Server configuration

Production requires a random secret of at least 32 characters in `JOURNEYDECK_RECORDER_TOKEN`. Do not put its value in source control or Expo configuration. The same value is pasted once into the app and retained in iOS Keychain.

Set `JOURNEYDECK_RECORDER_DURABLE_TURSO=true` so recording sessions survive Render restarts. Apply all shared SQL migrations before the first recording.

## iPhone build

The Expo project is linked to owner `journeydeck`, project `journeydeck`, and EAS project ID `ea19ed01-7b62-49e9-a9e3-8058f1e6cbd4`. Its iOS bundle identifier is `com.journeydeck.recorder`.

```powershell
npx eas-cli login
npx eas-cli build --platform ios --profile preview
```

EAS will prompt for Apple Developer access and device registration. Install the resulting standalone build on the registered iPhone, open it, enter `https://journeydeck.me` and the recorder key, then grant foreground and “Always” location access.

For live development with a Metro server, use the development profile instead:

```powershell
npx eas-cli build --platform ios --profile development
npx expo start --dev-client --tunnel
```

Before a production build, complete every item in [APP_STORE_RELEASE.md](./APP_STORE_RELEASE.md). In particular, publish a real privacy-policy URL and support contact, finish the production CloudKit schema deployment, and validate the build in TestFlight.

Retain the exact App Store Connect product setup in [SUBSCRIPTION_SETUP.md](./SUBSCRIPTION_SETUP.md). StoreKit pricing is loaded from Apple at runtime; never hardcode or simulate paid entitlement in production. Build 13 retains the isolated native recorder inbox and native MapKit POI enrichment, adds EAS Observe diagnostics, and keeps the canonical schema at version 6. Automatic recording remains disabled, and Tessie is deferred to JourneyDeck V3 with no V2 UI or runtime access.

Then create a production build and submit it through the App Store workflow:

```powershell
npx eas-cli build --platform ios --profile production
npx eas-cli submit --platform ios --profile production
```
