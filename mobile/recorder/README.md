# JourneyDeck Recorder

JourneyDeck Recorder is the private iPhone companion for recording journeys without Tessie or a Tesla. It captures GPS points in an on-device SQLite queue, continues while the phone is locked, and uploads retry-safe batches to JourneyDeck. The recorder key is stored in iOS Keychain and is never bundled with the app.

## Current scope

- one owner and one iPhone;
- iOS background GPS recording;
- Start, Pause, Resume, Finish, and manual retry;
- offline-first local storage with automatic foreground sync;
- server-created JourneyDeck drives and route replay;
- no Spotify capture, App Store onboarding, Android build, or multi-user account system.

Force-quitting the app stops iOS background location. Locking the phone or opening another app does not.

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

After the development build proves background recording on a real drive, create a production build and submit it to the private TestFlight track:

```powershell
npx eas-cli build --platform ios --profile production
npx eas-cli submit --platform ios --profile production
```
