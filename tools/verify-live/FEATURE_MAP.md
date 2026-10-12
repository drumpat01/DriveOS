# Live marketing site feature map

This map ties each public journeydeck.me feature to `npm run verify:live` check names and the source files that own the behavior. The CLI reads expected values from `tools/verify-live/expectations.json`. It does not hard-code them.

`/readyz` `generatedAtUtc` is the Atlas snapshot time (service restart / snapshot time), not deploy time. It changes when the service restarts. On 2026-10-11 it moved to 20:31:30Z with no new commit on main since the 12:55Z deploy, so it proves a restart after the given time, not that a specific commit is live.

## How to run

```bash
npm run verify:live
npm run verify:live -- --base https://journeydeck.me --json
npm run verify:live -- --base http://127.0.0.1:8795 --since 2026-10-11T12:55:00Z
```

Exit code 0 means every check passed. Exit code 1 means at least one check failed. `npm test` does not hit journeydeck.me.

## Public pages

Public HTML is served by `server/src/app.ts` in web mode. The public route allowlist is `publicPaths` in that file. Home is `web/beta.html` (`GET /`). Canonical and Open Graph URLs stay on `https://journeydeck.me` even when `--base` points at a local server.

| Page | Source | CLI checks |
| --- | --- | --- |
| `/` | `web/beta.html` via `server/src/app.ts` `GET /` | `page:/ status`, `page:/ title`, `page:/ meta-description`, `page:/ canonical`, `page:/ og:title`, `page:/ og:description`, `page:/ og:url`, `page:/ og:image`, `page:/ json-ld`, `page:/ umami`, `page:/ trial-wording` |
| `/apple-music-soundtrack` | `web/apple-music-soundtrack.html` | `page:/apple-music-soundtrack status`, `page:/apple-music-soundtrack title`, `page:/apple-music-soundtrack meta-description`, `page:/apple-music-soundtrack canonical`, `page:/apple-music-soundtrack og:title`, `page:/apple-music-soundtrack og:description`, `page:/apple-music-soundtrack og:url`, `page:/apple-music-soundtrack og:image`, `page:/apple-music-soundtrack json-ld`, `page:/apple-music-soundtrack umami`, `page:/apple-music-soundtrack trial-wording` |
| `/private-driving-journal` | `web/private-driving-journal.html` | `page:/private-driving-journal status`, `page:/private-driving-journal title`, `page:/private-driving-journal meta-description`, `page:/private-driving-journal canonical`, `page:/private-driving-journal og:title`, `page:/private-driving-journal og:description`, `page:/private-driving-journal og:url`, `page:/private-driving-journal og:image`, `page:/private-driving-journal json-ld`, `page:/private-driving-journal umami`, `page:/private-driving-journal trial-wording` |
| `/travel-journal-app-with-photos` | `web/travel-journal-app-with-photos.html` | `page:/travel-journal-app-with-photos status`, `page:/travel-journal-app-with-photos title`, `page:/travel-journal-app-with-photos meta-description`, `page:/travel-journal-app-with-photos canonical`, `page:/travel-journal-app-with-photos og:title`, `page:/travel-journal-app-with-photos og:description`, `page:/travel-journal-app-with-photos og:url`, `page:/travel-journal-app-with-photos og:image`, `page:/travel-journal-app-with-photos json-ld`, `page:/travel-journal-app-with-photos umami`, `page:/travel-journal-app-with-photos trial-wording` |
| `/road-trip-tracker-app` | `web/road-trip-tracker-app.html` | `page:/road-trip-tracker-app status`, `page:/road-trip-tracker-app title`, `page:/road-trip-tracker-app meta-description`, `page:/road-trip-tracker-app canonical`, `page:/road-trip-tracker-app og:title`, `page:/road-trip-tracker-app og:description`, `page:/road-trip-tracker-app og:url`, `page:/road-trip-tracker-app og:image`, `page:/road-trip-tracker-app json-ld`, `page:/road-trip-tracker-app umami`, `page:/road-trip-tracker-app trial-wording` |
| `/support` | `web/support.html` | `page:/support status`, `page:/support title`, `page:/support meta-description`, `page:/support canonical`, `page:/support og:title`, `page:/support og:description`, `page:/support og:url`, `page:/support og:image`, `page:/support json-ld`, `page:/support umami`, `page:/support trial-wording` |
| `/privacy` | `web/privacy.html` | `page:/privacy status`, `page:/privacy title`, `page:/privacy meta-description`, `page:/privacy canonical`, `page:/privacy og:title`, `page:/privacy og:description`, `page:/privacy og:url`, `page:/privacy og:image`, `page:/privacy json-ld`, `page:/privacy umami`, `page:/privacy trial-wording` |
| `/terms` | `web/terms.html` | `page:/terms status`, `page:/terms title`, `page:/terms meta-description`, `page:/terms canonical`, `page:/terms og:title`, `page:/terms og:description`, `page:/terms og:url`, `page:/terms og:image`, `page:/terms json-ld`, `page:/terms umami`, `page:/terms trial-wording` |
| `/login` | `web/login.html` | `page:/login status`, `page:/login umami` |

JSON-LD blocks live in `web/beta.html`, `web/apple-music-soundtrack.html`, `web/private-driving-journal.html`, `web/travel-journal-app-with-photos.html`, `web/road-trip-tracker-app.html`, and `web/support.html`. Privacy and terms have none today. Every `application/ld+json` block that is present must parse.

## Umami tag

- Owner: the public HTML files above. Login must stay untagged (`web/login.html`).
- The CLI counts every `<script>` whose `src` host is `cloud.umami.is`, including query-string variants. It does not ignore a second tag just because the website id differs.
- Public pages: exactly one such tag, and that tag must have website id `a5f66e11-ec7d-4133-8e1a-f8e6c08593af` and `data-domains="journeydeck.me"`.
- `/login`: zero `cloud.umami.is` scripts of any kind.
- Checks: `page:<path> umami` on every public page and `page:/login umami`.

## Trial wording

- Owner: public HTML, including JSON-LD text. Recent removals were in `web/beta.html` and `web/support.html`.
- Forbidden phrases (case-insensitive): `3-day`, `plus trial`, `free trial`.
- `/terms` may contain the generic legal phrase `trial terms`. That is not one of the forbidden phrases and must not be broadened.
- Checks: `page:<path> trial-wording`.

## Campaign pass-through and X headline

- Owner: `web/campaign.js`, loaded as `/campaign.js?v=4` from the public HTML files. Home headline markup starts in `web/beta.html` `#hero-title`.
- Campaign values persist in `sessionStorage`, so the default visit uses a fresh browser context.
- Test campaign query: `?utm_source=x&utm_medium=social&utm_campaign=launch_oct13`.
- Expected App Store extras: `pt=129344416`, `ct=x-launch_oct13`, `mt=8`. Every App Store link must stay on `https://apps.apple.com/us/app/journeydeck/id6806502526`. The reviews link keeps `see-all=reviews`.
- Default visit: headline `Take the road.` / `Keep the story.`, and App Store hrefs exactly as served in the HTML (same URLs and the same number of repeated CTAs) with none of `pt`, `ct`, or `mt`.
- X visit: headline `Keep the drive.` / `Keep the song.`.
- Checks, at `390x844` and `1280x800`: `browser <viewport> campaign headline`, `browser <viewport> campaign app-store-hrefs`, `browser <viewport> default headline`, `browser <viewport> default app-store-hrefs`.

## Content Security Policy

- Owner: `securityHeaders` in `server/src/app.ts`. `script-src` allows `https://cloud.umami.is`. `connect-src` allows `https://gateway.umami.is` and does not allow `https://cloud.umami.is`.
- The verifier lets `cloud.umami.is/script.js` load so the policy is actually exercised. It aborts `gateway.umami.is` so a run never sends analytics. It also aborts navigations to `apps.apple.com`.
- The aborted gateway request is expected to appear as `net::ERR_FAILED`. That must not fail the run. It is listed as `blocked by verifier`.
- Checks: `csp console` (no console errors that mention Content Security Policy, and no `securitypolicyviolation` events).

## Readyz

- Owner: `GET /readyz` in `server/src/app.ts`, snapshot fields from `AtlasStore.status()` in `server/src/atlas-store.ts`.
- Checks: `readyz` (HTTP 200 and `ok: true`, reports `atlas.generatedAtUtc`) and, when `--since` is set, `readyz since` (fail if `generatedAtUtc` is older than the given time).
- Label the timestamp as service restart / snapshot time, not deploy time. This PR does not add a commit SHA to `/readyz`.
