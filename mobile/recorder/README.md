# JourneyDeck Recorder

JourneyDeck Recorder is the private, local-first iPhone app for recording journeys without Tessie or a Tesla. Build 11 moves automatic drive detection and route capture into a native Swift engine that continues independently of the React Native UI. It writes GPS points into the unified on-device SQLite queue and commits every journey locally before optional provider enrichment, private iCloud sync, or legacy backup. Completion work is stored in a leased retry queue so closing the UI can delay enrichment but cannot reopen or lose a finished drive. Optional recorder credentials are stored in iOS Keychain and are never bundled with the app.

## Public-release scope

- iPhone-only, local-first journey recording;
- iOS background GPS recording;
- Start, Pause, Resume, Finish, and manual retry;
- offline-first local storage with optional private iCloud continuity;
- Apple Music history for automatic soundtracks, plus user-initiated ShazamKit recognition for individual songs;
- a StoreKit-verified membership that unlocks Atlas and history older than 45 days;
- no public Spotify, Last.fm, or direct Spotify import until the separate commercial permissions and review scope are complete;
- no Android build.

Locking the phone or opening another app does not stop native automatic recording. iOS does not relaunch location work after the user deliberately force-quits the app until JourneyDeck is opened again.

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

For Build 11, retain the exact App Store Connect product setup in [SUBSCRIPTION_SETUP.md](./SUBSCRIPTION_SETUP.md). StoreKit pricing is loaded from Apple at runtime; never hardcode or simulate paid entitlement in production. Install Build 11 over an existing Build 10 TestFlight installation before clean-install testing so the version-6 unified migration and preserved recorder import are exercised on real user data.

Then create a production build and submit it through the App Store workflow:

```powershell
npx eas-cli build --platform ios --profile production
npx eas-cli submit --platform ios --profile production
```
