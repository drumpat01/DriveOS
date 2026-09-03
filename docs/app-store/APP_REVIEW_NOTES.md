# JourneyDeck App Review notes draft

> Paste the reviewed, current version of this note into App Store Connect’s App Review Information field. Update it if any feature, permission flow, or public integration changes.

JourneyDeck is an iPhone-only, local-first driving journal. Its core recorder does not require an account, a server connection, a music subscription, or a vehicle connection.

## Core review path

1. Open the app. Version 1 introduces every user to **Manual Recording**; tap Start and Finish for each journey.
2. Apple Music is the recommended automatic soundtrack method. The ShazamKit alternative is manual: during an active journey, the user must tap **Identify Song** for each track they want to save. It never begins listening from background journey detection. You may decline either permission; recording remains available.
3. Allow Location access. The app requests **Always Allow** so a user-started journey can keep recording while the iPhone is locked or another app is open.
4. On **Home**, tap **Start Journey**. Locking the phone during a short physical-device test is supported. Return to the app and tap **End Journey**.
5. Open **Memories** and **Statistics** to review the free 45-day archive. **Atlas** and history older than 45 days are unlocked by the JourneyDeck auto-renewable subscription.

## Permissions and optional integrations

- **Location:** Core to recording an intentionally started journey. Version 1 never begins a journey automatically. The iPhone records and stores the route locally first. It does not provide navigation or emergency services.
- **Microphone / ShazamKit:** Optional. Used only for recognition; JourneyDeck never records or stores microphone audio.
- **Apple Music:** Optional. If unavailable or declined, the route recorder remains fully functional.
- **Photos:** Optional. Requested only when a user selects a photo for a Memory.
- **Sign in with Apple and private iCloud sync:** Optional. Core recording works without sign-in. Private iCloud continuity is a user choice.
- **Subscriptions:** Optional. Free manual recording, Apple Music soundtracks, Memories, and Statistics remain available for the most recent 45 days. A verified current subscription unlocks Atlas and complete locally stored history. **Restore Purchases** is available on the paywall.

## No reviewer account required

No username, password, recorder key, music account, subscription, or test vehicle is required to evaluate the core product.

## Public-build restrictions

The production build has internal testing disabled. It does not offer Last.fm, direct Spotify, Tessie, or automatic journey recording. Paid entitlement is accepted only from StoreKit’s verified current transactions; there is no reviewer-only unlock or editable local flag.

## Reviewer contact

Name: `Patrick Benjamin Stewart`

Email: `journeydeckapp@gmail.com`

Phone: `(682) 325-7181`

Confirm that the email and phone number are monitored during App Review before submission.
