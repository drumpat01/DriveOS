# Current Handoff State

## Current V3 source and release (September 24, 2026)

- The merge candidate combines the latest main website and server sources (through 3db0ed0) with the V3 mobile source used for Build 38, plus tools/xprem-local. The mobile master database schema is 11. The older schema-9 snapshot 2e9d595 is retained in branch history but is not the merged mobile implementation.
- Build 38 is the current native TestFlight build: EAS build a34d2a2a-1201-4b9e-bcc3-e6eeb79a6968, live bundle com.journeydeck.recorder, production channel, runtime 3.0.0-preview.6. EAS submission 47a2abe5-82ea-4c5f-b076-4fb71ed53ae2 finished and Apple accepted the upload. The IPA embeds the xprem HTTPS manifest URL, app ID, signing certificate, and production channel.
- Build 38 was produced from the previously dirty checkout C:\Users\patri\JourneyDeckv3-origin-main-20260922. Its handoff retains detailed Tessie, artwork, Ask, photo, Worker, OTA, and device-validation history. The current integration copied its mobile and Cloudflare source; the source checkout remains unmodified.
- Build 36 uses runtime 3.0.0-preview.5 and Expo Updates. Do not publish the runtime .6 source to Build 36. No xprem OTA has been published. The Last.fm image relay in Cloudflare source has not been deployed.
- V2 remains frozen. V3 TestFlight uses the existing live App Store identity and is not submitted to App Review without separate authorization.

## Local xprem environment

- tools/xprem-local runs xprem v3.2.2 and PostgreSQL with persistent local volumes. The optional Cloudflare Tunnel serves https://ota.journeydeck.me while this computer and Docker are running.
- Local credentials, keys, tunnel token, and publisher token are in ignored tools/xprem-local/.env; the public signing certificate is in ignored certificate.pem. Back up that file with both Docker volumes.
- Build 38 source configures xprem for V3 preview and live TestFlight, with a checked-in public certificate and guarded publisher. V2 retains Expo Updates.

## Verification and next step

- After integrating schema 11, mobile, server, and Cloudflare typechecks passed; all 903 mobile tests and 12 server API tests passed. The Build 38 V3 store iOS Expo export passed after clearing a stale cross-checkout Metro cache. Complete the staged secret/whitespace scans and CI before merging to main.
- Verify Build 38 on device and separately validate the new Ask/photo native bridges before another build or OTA. Do not infer on-device success from source tests.
