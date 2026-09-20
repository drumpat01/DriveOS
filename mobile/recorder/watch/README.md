# JourneyDeck for Apple Watch

An iPhone-paired SwiftUI watchOS 10+ app with one **Start Journey / Stop Journey** button. The iPhone owns GPS and local persistence. No Watch location permission, HealthKit workout, server connection, or separate library is used.

Open JourneyDeck on the iPhone once after installing the new build and grant **Always** location access. The Watch confirms recording state through WatchConnectivity; an unreachable iPhone shows connection guidance. The Watch cannot record independently. Pause remains an iPhone control; the Watch can stop a paused journey.

## Cinematic appearance

The approved design uses a bundled dusk-road background, warm cream serif text, an amber outlined icon medallion, a copper/amber Start button, and a JourneyDeck purple (`#963CFF`) Stop button. The same controls handle connecting, busy, paused, and error states; the recording and inactivity policy are unchanged. Text scales with Dynamic Type and the screen scrolls on smaller watches. Artwork is decorative and requires no network or location access. Reduce Transparency and a dimmed display use a solid dark background. Press feedback is immediate with no decorative animation.

`Assets.xcassets/CinematicRoad.imageset/cinematic-road.png` is AI-generated fictional scenery made for the approved concept on September 5, 2026. The prebuild plugin copies this asset catalog into the Watch target. Source artwork contains no text or baked-in controls; all controls are native SwiftUI. Native rendering, small-watch layout and VoiceOver still require device/simulator acceptance.

**September6 release authorization:** user resumed the combined POI + iPhone/iPad/Watch TestFlight build, commit and push. This supersedes the earlier hold for that release. App Store public release is separate. Build10's asset-catalog failure was traced to a serialized `undefined` Xcode group path; the plugin now anchors Watch resources to SOURCE_ROOT, covered by a regression test.

## Recording and automatic stop

New manual journeys started on either device use the same native recorder and its private SQLite inbox. Explicit Start is idempotent; Stop carries the exact session ID so an old command cannot end a newer journey. Commands expire after 30 seconds and are never queued for later delivery. Profile changes temporarily fence out new starts. Only state, opaque control/session IDs and timestamps cross WatchConnectivity, never coordinates or profile identity.

The iPhone finishes a manual journey after **10 minutes of observed non-driving movement**. Ordinary walking counts as non-driving. Accurate displacement is checked over at least 15 seconds, with a 2.2 m/s driving threshold and a maximum 50 m horizontal uncertainty. Ambiguous or poor fixes and gaps over two minutes interrupt the countdown; missing GPS is not treated as parking. Stationary callbacks remain enabled. The native countdown persists across process restarts, and Pause/Resume starts a fresh observation interval. The existing 24-hour ceiling is also checked on GPS callbacks and subsequent status/recovery work.

iOS controls location delivery and execution time, so automatic completion occurs on the next qualifying callback, not a guaranteed wall-clock alarm. Force-quitting the iPhone app or revoking location permission can interrupt GPS recording. Test locked-phone behavior on hardware before release.

An existing Expo-owned journey from the previous build must finish on the iPhone before Watch Start becomes available. Older installed binaries retain their compatible Expo manual transport. The native inbox is imported through the existing typed bridge; Swift never opens the Expo-owned master database. A manual journey stopped before its first fix is saved without invented coordinates. Optional enrichment and private iCloud jobs run through the existing completion queue when the phone's app runtime is available. The existing Expo location task continues music sampling for new phone-started native journeys, without writing native GPS sequences.

## Native build

`plugins/with-journeydeck-watch.js` creates and embeds `JourneyDeckWatch` during iOS prebuild, copies the Swift source, generates a 1024px opaque icon from the existing artwork using Expo's image pipeline, inherits the host version/build number, and declares its EAS signing target. The target is native SwiftUI without React Native pods. Build16 exposed the former direct copy of a 512px source into a 1024px catalog slot; regression tests now decode the generated icon to check dimensions and opacity.

| Build | iPhone bundle | Watch bundle | Runtime |
| --- | --- | --- | --- |
| V2 preview | `com.journeydeck.recorder.v2` | `com.journeydeck.recorder.v2.watchkitapp` | `2.0.0-preview.6` |
| Public V2 | `com.journeydeck.recorder` | `com.journeydeck.recorder.watchkitapp` | `2.0.0-watch.1` |

These are new native runtimes. Installed Build 6 / preview.5 remains unchanged; do not publish this as an OTA for that binary. No build, provisioning changes or distribution were performed during implementation. The subsystem handbook's 1.9 runtime entry is historical; `app.config.js` is authoritative for this V2 worktree.

On macOS, from `mobile/recorder`:

```sh
node scripts/test-watch-native-policy.mjs
APP_VARIANT=v2-preview npx expo prebuild --platform ios --no-install
```

Then install pods, open the generated workspace in Xcode, and compile both the iPhone app and its embedded Watch target. For EAS distribution, use the existing `v2-preview` profile; the Watch bundle needs its own Apple provisioning profile. An ad hoc installation may require registering the paired Watch as well as the iPhone. Before building, confirm the resolved config's preview bundle, CloudKit container and runtime. Keep the public identity and original private iCloud container unchanged.

Windows verification covers TypeScript, behavioral JavaScript tests, actual Xcode-project object generation/idempotence, generated plist/assets, and iOS JavaScript export. Windows Expo CLI declines iOS prebuild, and this workstation has no Swift/Xcode compiler. The included native policy harness therefore still needs to run on a Swift toolchain; JavaScript tests are not evidence that the native apps compile.

## Device acceptance

1. Install the new iPhone/Watch pair. Open the phone app and grant Always location. Confirm one Watch Start button.
2. Start on Watch with the phone locked; confirm recording on both devices and saved GPS after foregrounding. Repeat starting on the phone and stopping on Watch, and the reverse.
3. Tap Start on both devices together; confirm exactly one active journey. Repeat Stop and retry a timed-out command; confirm a newer journey is unaffected.
4. Drive, park, and keep valid GPS for ten minutes with the phone locked. Confirm automatic stop and one saved journey. Ordinary walking should not restart the countdown; renewed driving should.
5. Check GPS loss, large GPS drift, airplane/disconnected state, permission revocation, pause/resume, phone restart, rapid Start/Stop before the first fix, and Watch app reopen after automatic stop.
6. Check account switching/deletion while Watch Start is attempted; confirm no cross-profile recording. Verify local archive completion and optional music/iCloud work after reopening the phone.

References: [Apple WatchConnectivity](https://developer.apple.com/documentation/watchconnectivity/transferring-data-with-watch-connectivity), [single-target watchOS apps](https://developer.apple.com/documentation/watchkit/wkapplication), [Expo custom targets and signing](https://docs.expo.dev/build-reference/app-extensions/).
