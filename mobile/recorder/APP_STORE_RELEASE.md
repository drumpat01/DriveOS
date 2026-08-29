# JourneyDeck iOS public-release checklist

This checklist is deliberately conservative. A green JavaScript test suite proves the repository is internally consistent; it does not by itself make a location-recording app ready for App Review.

## Completed in the public-release code path

- The production EAS profile sets `EXPO_PUBLIC_JOURNEYDECK_INTERNAL_TESTING=0`.
- Public builds offer Apple Music and ShazamKit Auto Recognition only. Last.fm and direct Spotify remain internal-preview capabilities and are blocked at the preferences, queue, and OAuth boundaries.
- The preview-only `JourneyDeck Pro · $4.99 / month` card has been removed. There is no paid tier represented in the public UI.
- The mobile app now uses the documented production privacy-edge URL: `https://journeydeck-edge.patrickbstewart.workers.dev`.
- Recording works without an account, a recorder key, or a working network connection. Optional integrations never block a recording.

## Must be completed outside this repository before submission

1. Publish a public privacy policy at a stable HTTPS URL. It must accurately cover precise and background location, photos selected by the user, microphone use for ShazamKit recognition, Apple Music activity, private iCloud data, optional Tessie tokens, on-device storage, and the production privacy edge.
2. Publish a support URL or support email that a reviewer and customer can use. Enter both the privacy URL and support URL in App Store Connect; do not use placeholders.
3. Deploy the CloudKit production schema for `iCloud.com.journeydeck.recorder`, then exercise private sync and account deletion on two physical devices using a TestFlight build. Development-schema success is not production-schema proof.
4. Keep Last.fm and direct Spotify out of the public binary and App Store metadata until written commercial permissions, branding approval, and their final privacy disclosures are in place.
5. Confirm the production privacy-edge worker is deployed, reachable, rate-limited, and has only the public integrations it needs. Do not copy preview secrets or test allowlists into production.
6. Complete App Store Connect privacy nutrition labels from the actual production data flow, including precise location and any linked or tracked data. Recheck them if any SDK or integration changes.
7. Prepare App Review notes with a clean local first-run flow, demo steps for background route recording, an explanation of why background location is core functionality, and any credentials needed for optional integrations. Never make the reviewer depend on a personal account, vehicle, or music subscription to evaluate the core recorder.
8. Test the signed production archive on real hardware: first launch, denied/limited permissions, manual and automatic recording, lock-screen route capture, offline completion, relaunch/recovery, private iCloud sync, deletion, and the App Store install/update path.
9. Supply final App Store metadata: subtitle, description, keywords, age rating, privacy-policy and support URLs, copyright, support contact, and 6.9-inch/6.7-inch/6.5-inch iPhone screenshots that reflect the public build.

## Required preflight commands

Run these from `mobile/recorder` against the exact submission commit:

```powershell
npm run typecheck
npm test
npx expo-doctor
npx expo export --platform ios
```

After the public legal pages are published, run the networked public-page check as well. This intentionally fails if either URL redirects to a login screen, is not HTTPS, lacks a contact method, or still has an unresolved publication placeholder.

```powershell
$env:JOURNEYDECK_APP_STORE_PRIVACY_URL = 'https://journeydeck.me/privacy'
$env:JOURNEYDECK_APP_STORE_SUPPORT_URL = 'https://journeydeck.me/support'
npm run preflight:public-release
```

The production archive and upload are intentional external actions and are not performed by this repository checklist:

```powershell
npx eas-cli build --platform ios --profile production
npx eas-cli submit --platform ios --profile production
```
