# Live marketing site feature map

This map ties each public journeydeck.me feature to `npm run verify:live` check names and the source files that own the behavior. The CLI reads expected values from `tools/verify-live/expectations.json`. It does not hard-code them.

`/healthz` and `/readyz` are answered by the site Worker in `cloudflare/site/src/health.ts`. Both return `{"ok":true,"service":"journeydeck-site"}`.

## How to run

```bash
npm run verify:live
npm run verify:live -- --base https://journeydeck.me --json
```

Exit code 0 means every check passed. Exit code 1 means at least one check failed. `npm test` does not hit journeydeck.me.

## Public pages

Public HTML is served by `server/src/app.ts` in web mode. The public route allowlist is `publicPaths` in that file. Home is `web/beta.html` (`GET /`). Canonical and Open Graph URLs stay on `https://journeydeck.me` even when `--base` points at a local server.

| Page | Source | CLI checks |
| --- | --- | --- |
| `/` | `web/beta.html` via `server/src/app.ts` `GET /` | `page:/ status`, `page:/ title`, `page:/ meta-description`, `page:/ canonical`, `page:/ og:title`, `page:/ og:description`, `page:/ og:url`, `page:/ og:image`, `page:/ json-ld`, `page:/ umami`, `page:/ trial-wording`, `page:/ pricing`, `page:/ launch-badge`, `page:/ no-footer-login`, `page:/ studio-link`, `page:/ plus-annual` |
| `/apple-music-soundtrack` | `web/apple-music-soundtrack.html` | `page:/apple-music-soundtrack status`, `page:/apple-music-soundtrack title`, `page:/apple-music-soundtrack meta-description`, `page:/apple-music-soundtrack canonical`, `page:/apple-music-soundtrack og:title`, `page:/apple-music-soundtrack og:description`, `page:/apple-music-soundtrack og:url`, `page:/apple-music-soundtrack og:image`, `page:/apple-music-soundtrack json-ld`, `page:/apple-music-soundtrack umami`, `page:/apple-music-soundtrack trial-wording`, `page:/apple-music-soundtrack pricing`, `page:/apple-music-soundtrack no-footer-login` |
| `/private-driving-journal` | `web/private-driving-journal.html` | `page:/private-driving-journal status`, `page:/private-driving-journal title`, `page:/private-driving-journal meta-description`, `page:/private-driving-journal canonical`, `page:/private-driving-journal og:title`, `page:/private-driving-journal og:description`, `page:/private-driving-journal og:url`, `page:/private-driving-journal og:image`, `page:/private-driving-journal json-ld`, `page:/private-driving-journal umami`, `page:/private-driving-journal trial-wording`, `page:/private-driving-journal pricing`, `page:/private-driving-journal no-footer-login` |
| `/road-trip-journal-app` | `web/road-trip-journal-app.html` | `page:/road-trip-journal-app status`, `page:/road-trip-journal-app title`, `page:/road-trip-journal-app meta-description`, `page:/road-trip-journal-app canonical`, `page:/road-trip-journal-app og:title`, `page:/road-trip-journal-app og:description`, `page:/road-trip-journal-app og:url`, `page:/road-trip-journal-app og:image`, `page:/road-trip-journal-app json-ld`, `page:/road-trip-journal-app umami`, `page:/road-trip-journal-app trial-wording`, `page:/road-trip-journal-app pricing`, `page:/road-trip-journal-app no-footer-login` |
| `/road-trip-tracker-app` | `web/road-trip-tracker-app.html` | `page:/road-trip-tracker-app status`, `page:/road-trip-tracker-app title`, `page:/road-trip-tracker-app meta-description`, `page:/road-trip-tracker-app canonical`, `page:/road-trip-tracker-app og:title`, `page:/road-trip-tracker-app og:description`, `page:/road-trip-tracker-app og:url`, `page:/road-trip-tracker-app og:image`, `page:/road-trip-tracker-app json-ld`, `page:/road-trip-tracker-app umami`, `page:/road-trip-tracker-app trial-wording`, `page:/road-trip-tracker-app pricing`, `page:/road-trip-tracker-app no-footer-login` |
| `/travel-journal-app-with-photos` | `web/travel-journal-app-with-photos.html` | `page:/travel-journal-app-with-photos status`, `page:/travel-journal-app-with-photos title`, `page:/travel-journal-app-with-photos meta-description`, `page:/travel-journal-app-with-photos canonical`, `page:/travel-journal-app-with-photos og:title`, `page:/travel-journal-app-with-photos og:description`, `page:/travel-journal-app-with-photos og:url`, `page:/travel-journal-app-with-photos og:image`, `page:/travel-journal-app-with-photos json-ld`, `page:/travel-journal-app-with-photos umami`, `page:/travel-journal-app-with-photos trial-wording`, `page:/travel-journal-app-with-photos pricing`, `page:/travel-journal-app-with-photos no-footer-login` |
| `/driving-history-app` | `web/driving-history-app.html` | `page:/driving-history-app status`, `page:/driving-history-app title`, `page:/driving-history-app meta-description`, `page:/driving-history-app canonical`, `page:/driving-history-app og:title`, `page:/driving-history-app og:description`, `page:/driving-history-app og:url`, `page:/driving-history-app og:image`, `page:/driving-history-app json-ld`, `page:/driving-history-app umami`, `page:/driving-history-app trial-wording`, `page:/driving-history-app pricing`, `page:/driving-history-app no-footer-login`, `page:/driving-history-app plus-annual` |
| `/route-66-road-trip-journal` | `web/route-66-road-trip-journal.html` | `page:/route-66-road-trip-journal status`, `page:/route-66-road-trip-journal title`, `page:/route-66-road-trip-journal meta-description`, `page:/route-66-road-trip-journal canonical`, `page:/route-66-road-trip-journal og:title`, `page:/route-66-road-trip-journal og:description`, `page:/route-66-road-trip-journal og:url`, `page:/route-66-road-trip-journal og:image`, `page:/route-66-road-trip-journal json-ld`, `page:/route-66-road-trip-journal umami`, `page:/route-66-road-trip-journal trial-wording`, `page:/route-66-road-trip-journal pricing`, `page:/route-66-road-trip-journal no-footer-login` |
| `/pacific-coast-highway-road-trip-journal` | `web/pacific-coast-highway-road-trip-journal.html` | `page:/pacific-coast-highway-road-trip-journal status`, `page:/pacific-coast-highway-road-trip-journal title`, `page:/pacific-coast-highway-road-trip-journal meta-description`, `page:/pacific-coast-highway-road-trip-journal canonical`, `page:/pacific-coast-highway-road-trip-journal og:title`, `page:/pacific-coast-highway-road-trip-journal og:description`, `page:/pacific-coast-highway-road-trip-journal og:url`, `page:/pacific-coast-highway-road-trip-journal og:image`, `page:/pacific-coast-highway-road-trip-journal json-ld`, `page:/pacific-coast-highway-road-trip-journal umami`, `page:/pacific-coast-highway-road-trip-journal trial-wording`, `page:/pacific-coast-highway-road-trip-journal pricing`, `page:/pacific-coast-highway-road-trip-journal no-footer-login` |
| `/national-parks-road-trip-journal` | `web/national-parks-road-trip-journal.html` | `page:/national-parks-road-trip-journal status`, `page:/national-parks-road-trip-journal title`, `page:/national-parks-road-trip-journal meta-description`, `page:/national-parks-road-trip-journal canonical`, `page:/national-parks-road-trip-journal og:title`, `page:/national-parks-road-trip-journal og:description`, `page:/national-parks-road-trip-journal og:url`, `page:/national-parks-road-trip-journal og:image`, `page:/national-parks-road-trip-journal json-ld`, `page:/national-parks-road-trip-journal umami`, `page:/national-parks-road-trip-journal trial-wording`, `page:/national-parks-road-trip-journal pricing`, `page:/national-parks-road-trip-journal no-footer-login` |
| `/texas-hill-country-road-trip-journal` | `web/texas-hill-country-road-trip-journal.html` | `page:/texas-hill-country-road-trip-journal status`, `page:/texas-hill-country-road-trip-journal title`, `page:/texas-hill-country-road-trip-journal meta-description`, `page:/texas-hill-country-road-trip-journal canonical`, `page:/texas-hill-country-road-trip-journal og:title`, `page:/texas-hill-country-road-trip-journal og:description`, `page:/texas-hill-country-road-trip-journal og:url`, `page:/texas-hill-country-road-trip-journal og:image`, `page:/texas-hill-country-road-trip-journal json-ld`, `page:/texas-hill-country-road-trip-journal umami`, `page:/texas-hill-country-road-trip-journal trial-wording`, `page:/texas-hill-country-road-trip-journal pricing`, `page:/texas-hill-country-road-trip-journal no-footer-login` |
| `/tesla-drive-journal` | `web/tesla-drive-journal.html` | `page:/tesla-drive-journal status`, `page:/tesla-drive-journal title`, `page:/tesla-drive-journal meta-description`, `page:/tesla-drive-journal canonical`, `page:/tesla-drive-journal og:title`, `page:/tesla-drive-journal og:description`, `page:/tesla-drive-journal og:url`, `page:/tesla-drive-journal og:image`, `page:/tesla-drive-journal json-ld`, `page:/tesla-drive-journal umami`, `page:/tesla-drive-journal trial-wording`, `page:/tesla-drive-journal pricing`, `page:/tesla-drive-journal headline`, `page:/tesla-drive-journal copy`, `page:/tesla-drive-journal no-footer-login`, `page:/tesla-drive-journal plus-annual` |
| `/support` | `web/support.html` | `page:/support status`, `page:/support title`, `page:/support meta-description`, `page:/support canonical`, `page:/support og:title`, `page:/support og:description`, `page:/support og:url`, `page:/support og:image`, `page:/support json-ld`, `page:/support umami`, `page:/support trial-wording`, `page:/support pricing`, `page:/support no-footer-login` |
| `/privacy` | `web/privacy.html` | `page:/privacy status`, `page:/privacy title`, `page:/privacy meta-description`, `page:/privacy canonical`, `page:/privacy og:title`, `page:/privacy og:description`, `page:/privacy og:url`, `page:/privacy og:image`, `page:/privacy json-ld`, `page:/privacy umami`, `page:/privacy trial-wording`, `page:/privacy pricing`, `page:/privacy no-footer-login` |
| `/terms` | `web/terms.html` | `page:/terms status`, `page:/terms title`, `page:/terms meta-description`, `page:/terms canonical`, `page:/terms og:title`, `page:/terms og:description`, `page:/terms og:url`, `page:/terms og:image`, `page:/terms json-ld`, `page:/terms umami`, `page:/terms trial-wording`, `page:/terms pricing`, `page:/terms snippets`, `page:/terms no-footer-login` |
| `/login` | `cloudflare/site/src/retired.ts` | `page:/login status`, `page:/login noindex`, `page:/login umami` |

JSON-LD blocks live in `web/beta.html`, `web/apple-music-soundtrack.html`, `web/private-driving-journal.html`, `web/road-trip-journal-app.html`, `web/road-trip-tracker-app.html`, `web/travel-journal-app-with-photos.html`, `web/driving-history-app.html`, `web/route-66-road-trip-journal.html`, `web/pacific-coast-highway-road-trip-journal.html`, `web/national-parks-road-trip-journal.html`, `web/texas-hill-country-road-trip-journal.html`, `web/tesla-drive-journal.html`, `web/support.html`, `web/privacy.html`, and `web/terms.html`. Every `application/ld+json` block that is present must parse. Plus pricing is an `Offer`.

Every public page also checks `page:<path> description-voice`. The meta description and `og:description` speak to you (`you`, `your`, `yours`, or `yourself`) and do not use first person. A `twitter:description`, when present, follows the same rule. Each stays at 155 characters or fewer. `page:<path> no-app-name-description` fails when `description`, `og:description`, or `twitter:description` names a third-party app from `expectations.thirdPartyAppNames`, matched as a whole name in any case (`Tessie` and `tessie` fail; `Tesla` and `ShazamKit` do not). Add or remove names in that one array.

When a page contains an `Offer`, `page:<path> offer` requires `price` `39.99`, `priceCurrency` `USD`, `availability` `https://schema.org/InStock`, `url` equal to that page's App Store link (`pt`, the page `ct`, and `mt`), and `priceSpecification` of type `UnitPriceSpecification` with the same price and currency and `billingDuration` `P1Y`.

## Umami tag

- Owner: the public HTML files above. `/login` is the retired notice from `cloudflare/site/src/retired.ts`, and that page must stay untagged.
- The CLI counts every `<script>` whose `src` host is `cloud.umami.is`, including query-string variants. It does not ignore a second tag just because the website id differs.
- Public pages: exactly one such tag, and that tag must have website id `a5f66e11-ec7d-4133-8e1a-f8e6c08593af` and `data-domains="journeydeck.me"`.
- `/login`: zero `cloud.umami.is` scripts of any kind.
- Checks: `page:<path> umami` on every public page and `page:/login umami`.

## Trial wording

- Owner: public HTML, including JSON-LD text.
- Forbidden trial phrase (case-insensitive): `3-day` only.
- Earlier checks also banned `plus trial` and `free trial`. Those bans are gone. Plus is annual with a 7-day free trial, so `free trial` is allowed. `/terms` may still contain the generic legal phrase `trial terms`. Do not broaden the ban to every use of the word trial.
- Checks: `page:<path> trial-wording`.

## Plus pricing

- Owner: public HTML, including visible copy and JSON-LD offers. Privacy and terms meta descriptions do not pitch the price. Plus is $39.99/yr, with a 7-day free trial. Meta descriptions, Open Graph descriptions, and Twitter descriptions stay at 155 characters or fewer.
- Required phrases: `$39.99/yr`, `7-day free trial`. `$39.99/year` is forbidden.
- `/tesla-drive-journal` replaces that required price line with `expectations.pages["/tesla-drive-journal"].requiredPricingPhrases`: `JourneyDeck Plus, $39.99/yr, 7-day free trial for new subscribers`. Its `headline` check expects `The trip, later`. Its `copy` check requires `Keep your Tesla drives and charging history on your iPhone.`, `iPhone only.`, the one shortcut explanation, and `Neither one shows a Tesla drive.` It forbids `2.99`, `monthly`, `$39.99/year`, `CarPlay`, `Bluetooth`, `motion trigger`, `the car records`, `navigation app`, and `Tessie`, plus the global price and trial bans. The hero does not repeat the trial and price. The Plus annual block under the hero is the one pitch in that area.
- Forbidden price phrases (case-insensitive): `0.99`, `24.99`, `per week`, `weekly`.
- Free recording stays available.
- Checks: `page:<path> pricing`.

## JourneyDeck Plus annual block

- Owner: `web/beta.html` (`GET /`), `web/tesla-drive-journal.html`, and `web/driving-history-app.html`. The block is `section#plus-annual`.
- The heading is `JourneyDeck Plus annual`. The copy matches the Support answer in the second person (`You can keep recording for free and view today’s journeys.`) and names only Plus additions already described on the site. The price line is `Plus is $39.99/yr.` The block does not state a trial length, a weekly price, or a third-party app name.
- The primary control reads `Start your free trial` and uses `data-umami-event="plus-annual-click"`. Its href is that page's App Store URL (`pt`, the page `ct`, and `mt`) plus `utm_source=journeydeck.me`, `utm_medium=site`, `utm_campaign=plus_annual`, and `utm_content` set to the page slug (`home`, `tesla-drive-journal`, or `driving-history-app`). At 620px and below the control is full width, and the label and arrow stay together in the center.
- Styles live in the stylesheets those pages already load (`web/beta.css` and `web/public-page.css`). Cache-bust tokens are `beta.css?v=plus-annual-3` and `public-page.css?v=plus-annual-3`. `web/api-docs.html` and the retired notice stay on `public-page.css?v=perf-1`.
- Checks: `page:/ plus-annual`, `page:/tesla-drive-journal plus-annual`, `page:/driving-history-app plus-annual`.

## Terms Studio products

- Owner: `web/terms.html` `#studio-products`.
- `/terms` must include `id="studio-products"` and the 7-day refund line `within 7 days of purchase and I’ll refund you.`
- `/` must include `id="templates"` and `data-umami-event="templates-click" href="https://studio.journeydeck.me/?utm_source=journeydeck&utm_medium=referral&utm_campaign=crosslink"`. That section links to the studio store with the same campaign parameters as the footer studio link. The footer link text stays `From the studio: Road Trip templates` and is a separate check.
- Checks: `page:/ snippets` and `page:/terms snippets`.

## Campaign pass-through and X headline

- Owner: `web/campaign.js`, loaded as `/campaign.js?v=5` from the public HTML files. Home headline markup starts in `web/beta.html` `#hero-title`.
- Campaign values persist in `sessionStorage`, so the default visit uses a fresh browser context.
- Static App Store hrefs include `pt=129344416`, the page `ct` from `expectations.appStore.pageCampaigns`, and `mt=8`. Every App Store link must stay on `https://apps.apple.com/us/app/journeydeck/id6806502526`. The homepage reviews link keeps `see-all=reviews` and appends the campaign query with `&`.
- Test campaign query: `?utm_source=x&utm_medium=social&utm_campaign=launch_oct13`. That visit rewrites `ct` to `x-launch_oct13` and keeps a single `pt=129344416` and `mt=8`.
- `utm_source=x` with `utm_campaign=bio` rewrites `ct` to `xbio`. A visit with no UTM leaves the static `ct` in place.
- Default visit: headline `A road trip journal` / `for your iPhone.`, and App Store hrefs exactly as served in the HTML (same URLs and the same number of repeated CTAs), including `pt=129344416`, homepage `ct=home`, and `mt=8`.
- X visit: headline `Keep the drive.` / `Keep the song.`.
- Unknown public paths serve `web/404.html` with `ct=site`. The verifier fetches `expectations.appStore.notFoundPath` and expects HTTP 404.
- Checks, at `390x844` and `1280x800`: `browser <viewport> campaign headline`, `browser <viewport> campaign app-store-hrefs`, `browser <viewport> default headline`, `browser <viewport> default app-store-hrefs`.
- Checks: `page:<path> app-store` on each public page, plus `page:<notFoundPath> status` and `page:<notFoundPath> app-store`.

## FollowX badge

- Owner: the site footer in every public HTML page, including `web/404.html`. The 410 notice in `cloudflare/site/src/retired.ts` has no site footer.
- The footer contains `expectations.followxBadge.href` (`https://followx.today/b/journeydeck.me`) and the dark badge `expectations.followxBadge.imageSrc` (`theme=dark`). FollowX draws that badge from its own launch state: it read "Launching on Oct 22" before launch and "Featured on FollowX.today" with the upvote count after. `v=live` is a cache-bust so browsers that kept the launch-day image fetch the current one; change it again if FollowX changes the art.
- That image keeps explicit `imageWidth` and `imageHeight` (`250` and `54`, the SVG's own size) so the lazy image reserves its box and layout shift stays at 0.
- `web/beta.css` and `web/public-page.css` draw the badge at 200px wide, the same width as the Launch Llama badge (`expectations.launchBadge.imageWidth`). Those stylesheets currently cache-bust as `beta.css?v=plus-annual-3` and `public-page.css?v=plus-annual-3`.
- Checks: `page:<path> followx-badge` on every public page and on the 404 path.

## Launch Llama badge

- Owner: the homepage footer in `web/beta.html`. The product href, image `src`, `alt`, `width`, `height`, and Launch MCP link must match `expectations.launchBadge` exactly.
- Checks: `page:/ launch-badge` only. Other public pages are not required to include the badge.

## Footer links

- Owner: the footer in each public HTML file. The home footer nav is in `web/beta.html`.
- No public page footer may contain `href="/login"`. `/login` is the retired notice in the Retired web app section. `expectations.loginPath` still names that path.
- The home footer includes one same-tab link. The text is `expectations.footerLinks.homeStudioText` (`From the studio: Road Trip templates`). The href is `expectations.footerLinks.homeStudioHref` (`https://studio.journeydeck.me/?utm_source=journeydeck&utm_medium=referral&utm_campaign=crosslink`).
- Checks: `page:<path> no-footer-login` on every public page, and `page:/ studio-link` on `/` only.

## Removed listening screenshots

- Owner: `web/beta.html` and `web/apple-music-soundtrack.html`. The private Soundtrack captures are not served. The sample-profile replacements use new filenames, so the old URLs stay 404.
- `expectations.removedPublicImages.urls` must return HTTP 404, and those responses must not advertise a year-long immutable cache or the 7-day image cache.
- `expectations.removedPublicImages.pages` must not contain `expectations.removedPublicImages.forbidden`. Those tokens are the deleted filenames, including the extension, so `05-soundtrack-sample.webp` and `soundtrack-sample.webp` are allowed.
- Checks: `removed-image <path>` for `/` and `/apple-music-soundtrack`, plus `removed-image <url>` for each removed file.

## Sample Soundtrack captures

- Owner: the homepage tour slide in `web/beta.html` (`GET /`) and the proof figure in `web/apple-music-soundtrack.html`. The route replay figure on `/` uses a picture whose WebP source still includes `/assets/v4/02-journey.webp`.
- `expectations.samplePublicImages.assets` must return HTTP 200 with the listed image content type.
- `expectations.samplePublicImages.pages` must contain the listed sample path.
- Checks: `sample-image <path>` for `/` and `/apple-music-soundtrack`, plus `sample-image <url>` for each sample file.

## Content Security Policy

- Owner: `securityHeaders` in `server/src/app.ts` and `SECURITY_HEADERS` in `cloudflare/site/src/headers.ts`. `script-src` allows `https://cloud.umami.is` and `https://static.cloudflareinsights.com`. `connect-src` allows `https://gateway.umami.is` and `https://cloudflareinsights.com`, and does not allow `https://cloud.umami.is`. `img-src` allows `https://tools.launchllama.co` for the homepage Launch Llama badge and `https://followx.today` for the FollowX badge, and does not add those hosts to other directives. The beacon script is not in the HTML. The zone injects it.
- The verifier lets `cloud.umami.is/script.js` load so the policy is actually exercised. It aborts `gateway.umami.is` so a run never sends analytics. It also aborts navigations to `apps.apple.com`.
- The aborted gateway request is expected to appear as `net::ERR_FAILED`. That must not fail the run. It is listed as `blocked by verifier`.
- Checks: `csp console` (no console errors that mention Content Security Policy, and no `securitypolicyviolation` events). `csp cloudflare-insights` reads the homepage `Content-Security-Policy` header and requires both Cloudflare insights hosts. `csp followx` requires `img-src` to allow `https://followx.today`.

## robots.txt

- Owner: `web/robots.txt`. The site Worker serves that file as an asset. It does not rewrite the body and does not set `X-Robots-Tag` on it.
- The file includes the exact line `Content-Signal: ai-train=no, search=yes, ai-input=yes`.
- Check: `robots.txt content-signal`.

## Permanent redirects

- Owner: `GET /homeworld` and `GET /homeworld/` in `server/src/app.ts`. Both paths are in `publicPaths`, so anonymous requests are not sent to login.
- The CLI reads `expectations.redirects` and fetches each path without following the redirect. Status and `Location` must match the entry. Query strings on the request are not part of the expected location.
- `/homeworld` and `/homeworld/` return 301 to `https://studio.journeydeck.me/homeworld`.
- Checks: `redirect:/homeworld`, `redirect:/homeworld/`.

## Retired web app

- Owner: `cloudflare/site/src/retired.ts`. The site Worker answers these paths itself. Live `GET /login` is HTTP 410, `Content-Type: text/html; charset=utf-8`, `Cache-Control: no-store`, and `X-Robots-Tag: noindex`.
- `expectations.retiredPages.paths` lists `/app`, `/wife`, `/wife.html`, `/index.html`, `/spotify-callback`, `/login.html`, and `/login`. Each response is the same HTML notice. `/` is the homepage and is not one of these paths.
- Status is 410. `X-Robots-Tag` and the robots meta are `noindex`. `Cache-Control` is `no-store`. The body contains `The old web app has been retired`.
- `/login` still serves that HTML page, so it must contain zero `cloud.umami.is` scripts. The other retired paths use one combined check.
- Checks: `retired:<path>` for each retired path other than `/login`. `/login` checks are `page:/login status`, `page:/login noindex`, and `page:/login umami`.

## Health

- Owner: `GET /healthz` and `GET /readyz` in `cloudflare/site/src/health.ts`. The site Worker answers both itself.
- Each response is HTTP 200, `Content-Type: application/json`, `Cache-Control: no-store`, and the JSON body `{"ok":true,"service":"journeydeck-site"}`.
- `rndr-id` is absent. The body does not include `atlas`, `generatedAtUtc`, `legacyCompatibilityReachable`, or `snapshotStale`.
- `--since` is still accepted and does not read a snapshot time from these responses.
- Checks: `healthz`, `readyz`.
