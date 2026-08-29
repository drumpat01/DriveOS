# JourneyDeck App Review notes draft

> Paste the reviewed, current version of this note into App Store Connect’s App Review Information field. Update it if any feature, permission flow, or public integration changes.

JourneyDeck is an iPhone-only, local-first driving journal. Its core recorder does not require an account, a server connection, a music subscription, or a vehicle connection.

## Core review path

1. Open the app and choose **Manual Recording** when asked how to record journeys.
2. Choose either **Apple Music** or **Auto Recognition** as an optional soundtrack method. You may decline either permission; recording remains available.
3. Allow Location access. The app requests **Always Allow** only because a user-selected journey or Automatic Drive Detection must continue recording while the iPhone is locked or another app is open.
4. Open **Live** and tap **Start a journey**. Locking the phone during a short physical-device test is supported. Return to the app and finish the journey.
5. Open **Memories** and **Atlas** to review the local archive and its private insights.

## Permissions and optional integrations

- **Location:** Core to recording an intentionally started journey and to the optional Automatic Drive Detection mode. The app stores the route on the iPhone first. It does not provide navigation or emergency services.
- **Microphone / ShazamKit:** Optional. Used only for recognition; JourneyDeck never records or stores microphone audio.
- **Apple Music:** Optional. If unavailable or declined, the route recorder remains fully functional.
- **Photos:** Optional. Requested only when a user selects a photo for a Memory or Collection.
- **Sign in with Apple and private iCloud sync:** Optional. Core recording works without sign-in. Private iCloud continuity is a user choice.
- **Tessie:** Optional. It requires a user-provided Tessie token and is not required for review.

## No reviewer account required

No username, password, recorder key, music account, Tessie account, or test vehicle is required to evaluate the core product. The **Optional owner backup** section is a legacy migration path for existing JourneyDeck owners; it is not a public sign-up or core feature.

## Public-build restrictions

The production build has internal testing disabled. It does not offer Last.fm, direct Spotify, or a paid subscription. Please review the public UI rather than any development-client screenshots.

## Reviewer contact

Name: `Patrick Benjamin Stewart`

Email: `Journeydeckme@gmail.com`

Phone: Add a monitored App Review contact number before submission.

Confirm that the email and phone number are monitored during App Review before submission.
