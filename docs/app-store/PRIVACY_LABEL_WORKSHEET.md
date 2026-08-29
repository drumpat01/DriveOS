# JourneyDeck App Privacy worksheet

> Working analysis for App Store Connect, not a legal determination. Reconcile this document against the final production build, deployed edge worker, CloudKit schema, any linked SDK privacy manifest, and advice from qualified counsel before publishing app privacy answers.

Apple requires disclosure of data handled by the app and third-party partners. Data processed only on device and never sent off device is not “collected” for the App Store privacy label, but optional iCloud sync, owner backup, optional integrations, map tiles, and software-update traffic must be reviewed in the final production data flow. See Apple’s [App privacy details guidance](https://developer.apple.com/app-store/app-privacy-details/) and [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/).

## Public-release data-flow inventory

| Feature | Data involved | Where it is handled | Required label review |
| --- | --- | --- | --- |
| Core journey recorder | Precise route coordinates, timestamps, speed/heading, derived distance and duration | On-device SQLite by default | If the user never enables an off-device path, this is on-device processing. Confirm whether the production app ever transmits it by default. |
| Optional private iCloud sync | Journey records, route coordinates, labels, memories, collections, selected photos, preferences | User’s private CloudKit database | Conservatively review **Precise Location**, **Photos or Videos**, and relevant **User Content** as linked to the user for App Functionality. Confirm the final CloudKit design with counsel/Apple guidance. |
| Optional Sign in with Apple | Apple subject identifier and any display name the user provides | Local profile and private iCloud when enabled | Review **User ID** and **Name** for App Functionality. |
| Optional Apple Music | Track, artist, album, playback timing, artwork URLs | On device; optional private iCloud continuity | Review **Audio Data** only if Apple’s final definition requires song/playback metadata to be classified that way; do not claim microphone recordings are collected. |
| Optional ShazamKit recognition | Brief microphone input and recognized music metadata | Recognition runs on device; recognized metadata can be stored locally/private iCloud | Microphone audio is not saved. Confirm whether only stored recognition results require a label. |
| Optional photo attachment | User-selected photos | On device and optional private iCloud | Review **Photos or Videos** for App Functionality. |
| Optional Tessie | User-provided access token, vehicle status/energy/charging summaries | Token in iPhone Keychain; bounded requests to the configured privacy edge and Tessie | Review **Other User Content**, **Device ID**, or another applicable type only after confirming the production request payload and retention. Never disclose an untrue “no sharing” claim. |
| Optional legacy owner backup | Device identifier, journey records, route points, music observations | Only when an existing owner supplies a private recorder endpoint and key | Review the actual deployed owner-backup policy before allowing public users to configure it. |
| Map display | Map tile requests and device/network metadata | MapLibre/OpenFreeMap directly from the device | Review third-party service practices and any IP-address handling. |
| Expo updates | Device/network metadata needed to deliver updates | Expo update infrastructure | Review the deployed Expo configuration and vendor documentation. |

## Intended label positions — confirm before App Store Connect entry

- **Data used to track you:** No.
- **Advertising, data broker, or sale of personal information:** No.
- **Core on-device-only data:** Not collected, only when it never leaves the iPhone.
- **Optional iCloud continuity:** Treat as a conservative App Functionality disclosure until the final CloudKit/Apple interpretation is confirmed.
- **Diagnostics and analytics:** No first-party analytics SDK is intentionally configured. Reconfirm after every dependency change.

## Final sign-off questions

1. Does the production build transmit any route, vehicle, photo, or music data automatically outside the device?
2. Does the deployed privacy edge log, retain, or forward any request data beyond servicing the request?
3. Are all selected third-party SDK privacy manifests present and reviewed?
4. Is every optional integration and account flow described accurately in the public policy?
5. Does the privacy policy explain consent, retention, deletion, and a working contact method?
6. Does the App Store Connect label answer for the most inclusive production behavior, not only the simplest no-account path?
