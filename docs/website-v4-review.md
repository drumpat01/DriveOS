# JourneyDeck 4.0 website draft — September 30, 2026

The owner approved publication of this reviewed website update on September 30, 2026. Deployment follows the repository's pull-request workflow and Render's production auto-deploy from main.

## Changes

- `web/privacy.html`: V4 AI assistant authorization, read-only private CloudKit access, layered sharing switches, Keychain link secret, Plus verification, provider handling, connector storage/logging, Tessie, on-device Ask, iPad, sample library, markers/photos, widgets/Watch, StoreKit, and updated date. Existing Apple Music, ShazamKit, optional sign-in/iCloud, deletion, RevenueCat, Expo diagnostics, and privacy protections remain.
- `web/support.html`: iPad recording limitation, sample entry/exit, 3-day install trial, free today-only access, weekly/annual Plus, retained history, restore, assistant disconnection, and initial iCloud sync.
- `web/beta.html` and `web/beta.js`: native V4 navigation, Ask, Atlas, Memories/photos, markers, widget, six themes and matching icons, current membership limits, and eight optimized V4 screenshots. Existing routes, layout, scripts, and styling are preserved; no prices or new analytics/scripts.
- The hosted root serves `beta.html`; legacy `landing.html` redirects to `/` and is unchanged.

## Discrepancies and open questions

1. **Sample deletion:** supplied copy says the sample is removed on exit. `mobile/recorder/src/auth.ts`, `exitDemoProfile()`, keeps it prepared locally. The draft states the actual behavior. Decide whether the app should delete it; mobile behavior was not changed.
2. **Billing disclosure:** StoreKit supplies entitlement status, but `mobile/recorder/modules/journeydeck-membership/index.ts` still invokes the RevenueCat billing observer. The draft adds StoreKit and retains the existing RevenueCat disclosure.
3. **Recording:** the old policy says 2.0 never starts automatically and background location is only for manually started journeys. V4 has optional automatic recording; the draft removes the obsolete version assertion and covers recording the user starts or enables.
4. **Cloudflare retention:** how long are Workers logs and METRICS session-lifetime entries retained? The connector repo does not establish a log retention period or a TTL for METRICS entries. No duration is claimed.
5. **Disconnected/idle connector metadata:** what is the deletion policy for the stored Apple session, app-link indexes, and diagnostics after an assistant is disconnected or OAuth expires? App disconnection revokes that assistant's grants and clears its switches/use timestamp; it does not delete the user's entire Durable Object. Daily OAuth cleanup does not establish a duration for all connector metadata. No blanket deletion promise is made.

## Connector evidence

Inspected the local checkout whose origin is `drumpat01/journeydeck-data-mcp`, at `C:/Users/patri/OneDrive/Documents/ChatGPT/JourneyDeck Data MCP`.

- `packages/connector/src/index.js`: one-hour access tokens, 90-day refresh lifetime and idle limit, daily expired OAuth cleanup.
- `packages/connector/src/session.js`: encrypted Apple token; in-memory record/route cache; refresh drops the cache after more than 15 idle minutes, 30-second freshness window. This is a check on refresh, not a guaranteed timed erasure.
- `packages/connector/src/user-do.js`: tool/timing/result logs with shortened user identifier, model/session diagnostics, seven-day deletion after detected Plus lapse, persistent session-lifetime metrics.
- `packages/connector/src/consent.js`: consent errors and connection events, including zone count.
- `packages/connector/src/app-api.js`: per-assistant grant revocation and sharing cleanup.
- `packages/connector/wrangler.jsonc`: production observability and METRICS binding.

## Terms findings

Reviewed the live `/terms` and the [Apple standard EULA](https://www.apple.com/legal/internet-services/itunes/dev/stdeula/) linked from the home page. No direct contradiction with the supplied V4 features, device behavior, or subscription facts was found. Terms were not changed.

The site terms have their own app license and a Texas governing-law clause. Apple's standard EULA includes its own license and governing-law provisions. The site's statement that Apple's applicable terms also apply does not explicitly distinguish website/service terms from a custom app EULA. Confirm the intended relationship with the App Store's standard EULA before publication; this is an existing ambiguity, not a V4 feature conflict.

## Verification

- Two targeted server tests passed: public information/discovery routes and hosted root/assets/legacy redirects.
- Headless Edge checks passed at 1440px and 390px for home, privacy, and support: no horizontal overflow, no page JavaScript errors, initial image loading, and Ask carousel caption transition.
- `git diff --check` passed.
- Root dependencies were absent; `npm ci --ignore-scripts` restored lockfile dependencies without changing manifests or lockfiles.
- V4 images are WebP derivatives of the existing local screenshot sets; original mobile screenshots were not changed.

## Publication

Published September 30, 2026 through [PR 224](https://github.com/drumpat01/DriveOS/pull/224), merge `b7e11ef`. Render deploy `dep-daut4j9srm7s73bda640` reports live. Production home, privacy, support, Terms, and health endpoint return 200. The pages, carousel JavaScript, and all eight screenshots match the approved local files. Production browser checks passed at 1440px and 390px, including Ask/Atlas carousel navigation and no JavaScript errors. The post-deploy error-log query returned no entries.

Full release preflight and all four public carousel E2E tests also passed before publication. GitHub merged the PR immediately despite pending CI; Render's actual auto-deploy trigger is commit. The broader [CI run](https://github.com/drumpat01/DriveOS/actions/runs/36810309876) subsequently completed successfully. This approval covers the website update; the App Store still serves 2.0 at the time of approval.
