# JourneyDeck current handoff

## Current objective

Stop hosted login throttling from treating every caller as 127.0.0.1. Draft pull request only. Do not merge and do not deploy.

## Checkout

- Branch `cursor/login-client-ip-throttle-f653`, rebased onto main `2c190bf` (includes merged #298).
- Draft PR: https://github.com/drumpat01/DriveOS/pull/302. Do not merge it.

## Material changes

- Node derives the client address with `TRUST_PROXY` (default `1`, Render's single hop). It uses the right-most untrusted `X-Forwarded-For` entry and falls back to the socket. `CF-Connecting-IP` is used only when the TCP peer is Cloudflare.
- The proxy strips any incoming `X-DriveOS-Client-IP` and sets that header from the derived address.
- Hosted PowerShell keys the existing 5-failure, 30-second login throttle on that header only for a loopback Node proxy. Other callers use the socket address.
- Node applies the same per-address limit in front of `/api/auth/login` and `/api/auth/passkey/verify`.

## Verification

- `npm run check:server` passed.
- `npm run lint:server` passed.
- `npm run test:server`: 78 passed, 0 failed.
- `tests/WebRequest.Tests.ps1` passed, including proxy header and per-address throttle checks.

## Unresolved

- Do not merge and do not deploy. Render, Cloudflare, and DNS were not changed.
- `TRUST_PROXY` is unset in production. The default of one hop matches the current Render edge. Set it to `0` only if Node is exposed without a proxy, or to a higher hop count only if another proxy is added in front.

## Next steps

1. Leave the draft pull request open until the owner merges it.
2. After deploy, failed logins from one address must not block a different address.
