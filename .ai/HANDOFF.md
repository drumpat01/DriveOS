# JourneyDeck current handoff

## Current objective

Serve Apple's Get Retention Message endpoint from the existing journeydeck.me Fastify app. Do not merge and do not deploy.

## Checkout

- Branch `cursor/retention-messaging-endpoint-5d8a`, based on main `de0cc35`. Draft PR: https://github.com/drumpat01/DriveOS/pull/296
- Public URL to paste after deploy: `https://journeydeck.me/retention-messaging-api`
- The same POST handler is registered at the trailing-slash path and does not redirect.

## Material changes

- `POST /retention-messaging-api` accepts `RealtimeRequestBody` (`application/json`, `signedPayload` JWS).
- Verification uses `@apple/app-store-server-library` `SignedDataVerifier` and the pinned Apple Root CA - G3 at `server/certs/AppleRootCA-G3.cer`.
- A verified request returns `{ "message": { "messageIdentifier": "<uuid>" } }`.
- Invalid requests return 400, 401, 403, 405, or 415 and do not log the signed payload or `originalTransactionId`.

## Verification

- `npm run test:server`: 68 tests passed.
- `npm run build:server` and server ESLint passed.
- A signed test request completed in about 2 ms, inside Apple's 700 ms production timeout.

## Unresolved

- Do not merge and do not deploy. Render, Cloudflare, and DNS were not changed.
- Optional env vars are unset: `JOURNEYDECK_RETENTION_MESSAGE_ID` (default `7f3c1a92-4e58-4b0d-8c6a-1d2e3f4a5b6c`) and `JOURNEYDECK_RETENTION_ENVIRONMENTS` (default `Production,Sandbox`).
- App Store Connect still needs the message upload, per-locale default for `com.journeydeck.recorder.pro.annual`, sandbox realtime URL, and a passing performance test before production.

## Next steps

1. Leave the pull request open until the owner merges it.
2. After deploy, paste `https://journeydeck.me/retention-messaging-api` into Apple's Retention Messaging API form for sandbox.
3. Upload the message UUID and configure the annual product's default message before expecting a customer-visible message.
