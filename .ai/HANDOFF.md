# JourneyDeck current handoff

## Current objective

`journeydeck-site` answers Apple's Retention Messaging API itself. Draft PR only. Do not deploy, do not change DNS, Render, or App Store Connect.

## Checkout

- Branch `cursor/worker-retention-api-02df`, based on main `75cffb2`.
- Draft PR: https://github.com/drumpat01/DriveOS/pull/310. Do not merge.
- R029–R032 are `native` on `cloudflare/site/src/retention.ts`. Every other route is unchanged. Render's `server/src/retention-messaging.ts` is still there.
- Config is `workers_dev` only. No routes, DNS, or new secrets. `preview_urls` is false.

## Material changes

- Worker verifies the signed JWS with Web Crypto. No `@apple/app-store-server-library` on this path, and no OCSP fetch. Apple Root CA - G3 stays embedded and is parsed once per isolate at startup.
- Response is `{ message: { messageIdentifier } }` from `JOURNEYDECK_RETENTION_MESSAGE_ID`. Sandbox and Production stay in `JOURNEYDECK_RETENTION_ENVIRONMENTS`. Bundle id `com.journeydeck.recorder`, app id `6806502526`.
- `ALLOW_RETENTION_TEST_ROOT` still applies only to localhost, `127.0.0.1`, and `::1`. It is not in `wrangler.jsonc`.

## Verification

- `npx tsc -p cloudflare/site/tsconfig.json --noEmit` passed.
- `npm run test:site`: 25 passed. `npm run predeploy:site` passed.
- Totals are 435 rows (318 worker, 110 passthrough, 7 dead, 375 probes).
- Node `process.cpuUsage` on the handler: cold about 6.4 ms, warm about 0.7 ms. workerd `performance.now` (1 ms resolution, no CPU counter): cold handler 8–10 ms, warm 1–2 ms. No network on that path.
- A cold isolate is not reliably under the Workers Free 10 ms CPU limit. Warm requests are. Paid CPU default is 30 seconds. The account plan is unconfirmed. A real Apple sandbox request was not sent.

## Unresolved

- No deploy. Login and passkeys stay known-fail on `workers.dev`.
- Cutover blocker: Render logs the real visitor IP for /login through the Worker. Do not set `TRUST_PROXY=2`.
- Phase 2 cutover needs a separate yes. www stays on Render until the apex is stable.
- Free-plan cold start may still miss 10 ms. Confirm the Workers plan before cutover. If it is Free, the first request on a fresh isolate can sit on the limit; Apple then shows the default message and does not retry.

## Next steps

1. Review https://github.com/drumpat01/DriveOS/pull/310. Do not merge it as a deploy.
2. Confirm whether the Cloudflare account is Workers Free or Paid before any route cutover.
3. From a machine with approval: `npm run predeploy:site`, then `npx wrangler deploy --config cloudflare/site/wrangler.jsonc`.
4. Re-run parity against the workers.dev URL. A real Apple sandbox retention request is still untested.
