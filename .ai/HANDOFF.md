# JourneyDeck current handoff

## Current objective

`journeydeck-site` answers Apple's Retention Messaging API itself. Draft PR only. Do not deploy, do not change DNS, Render, or App Store Connect. The Cloudflare account is Workers Free. Workers Paid needs Patrick's yes.

## Checkout

- Branch `cursor/worker-retention-api-02df`, based on main `75cffb2`.
- Draft PR: https://github.com/drumpat01/DriveOS/pull/310. Do not merge.
- R029–R032 are `native` on `cloudflare/site/src/retention.ts`. Every other route is unchanged. Render's `server/src/retention-messaging.ts` is still there.
- Config is `workers_dev` only. No routes, DNS, or new secrets. `preview_urls` is false.

## Material changes

- Worker verifies the signed JWS with Web Crypto. No `@apple/app-store-server-library` on this path, and no OCSP fetch.
- Apple Root CA - G3 and Apple WWDR G6 are base64 in `cloudflare/site/src/apple-pinned-certs.ts`. Module load decodes and X.509-parses them. `crypto.subtle.importKey` stays on the first request and is memoized per isolate. The request leaf is parsed once. Method, size, content-type, JSON, `alg`, and certificate expiry run before any signature check.
- Response is `{ message: { messageIdentifier } }` from `JOURNEYDECK_RETENTION_MESSAGE_ID`. Sandbox and Production stay in `JOURNEYDECK_RETENTION_ENVIRONMENTS`. Bundle id `com.journeydeck.recorder`, app id `6806502526`.
- `ALLOW_RETENTION_TEST_ROOT` still applies only to localhost, `127.0.0.1`, and `::1`. It is not in `wrangler.jsonc`.

## Verification

- `npm run check:site` passed. `npm run test:site`: 25 passed. `npm run predeploy:site` passed.
- Totals are 435 rows (318 worker, 110 passthrough, 7 dead, 375 probes).
- Node, 12 fresh processes, handler `process.cpuUsage`: cold median 5.195 ms, max 5.643 ms. Warm (120 requests) median 0.670 ms, max 2.688 ms.
- workerd, 10 fresh isolates, `performance.now` inside the handler (1 ms resolution, no CPU counter): cold wall 8, 8, 9, 9, 10, 10, 10, 12, 12, 14 ms. Median 10 ms, max 14 ms. Warm (100 requests) median 1 ms, max 2 ms.
- Cold workerd wall does not reliably get under about 8 ms. The account is Workers Free. A real Apple sandbox request was not sent.

## Unresolved

- No deploy. Login and passkeys stay known-fail on `workers.dev`.
- Cutover blocker: Render logs the real visitor IP for /login through the Worker. Do not set `TRUST_PROXY=2`.
- Phase 2 cutover needs a separate yes. www stays on Render until the apex is stable.
- Free-plan cold start is still over the 10 ms CPU limit on some fresh isolates (workerd wall max 14 ms). Paid CPU default is 30 seconds and needs Patrick's yes. If it stays Free, Apple shows the default message on a request that exceeds the limit and does not retry.

## Next steps

1. Review https://github.com/drumpat01/DriveOS/pull/310. Do not merge it as a deploy.
2. Patrick decides whether Workers Paid is acceptable before any route cutover.
3. From a machine with approval: `npm run predeploy:site`, then `npx wrangler deploy --config cloudflare/site/wrangler.jsonc`.
4. Re-run parity against the workers.dev URL. A real Apple sandbox retention request is still untested.
