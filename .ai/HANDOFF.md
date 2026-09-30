# JourneyDeck current handoff — September 29, 2026

## Objective and checkout

- V4 is being prepared for an October 14, 2026 public launch. Public release, App Review submission, OTA, deploy, commit, and push still require the owner's explicit request. V2 is live. Owner decision (2026-09-30): V4 4.0.0 replaces the live App Store version directly; V3 is never released (frozen, emergency fixes only).
- Checkout: `D:\JourneyDeckV4`, branch `claude/v4-redesign`, tracking `origin/claude/v4-redesign`. Latest local commits before this work: `fa20e81` (App Review prep), `420d55a` (production connector/icons), `5876b00` (Aurora Glass icon). Verify current branch, status, and diff before acting.
- This session has **uncommitted** V4 subscription work in membership StoreKit/Swift, Siri plugin, paywalls, tests, and `mobile/recorder/SUBSCRIPTION_SETUP.md`. Do not stage, commit, push, discard, or publish without a user request.

## V4 app and release state

- V4 is gated by `V4_REDESIGN_ENABLED` and uses runtime `4.0.0-preview.3` (Build 45 and later; Build 44 is preview.2); V4 iPhone redesign, recorder accessory/sheet, Ask, Atlas, Memories, Soundtrack, themes, and connector settings are implemented. iPad and V3 paths remain distinct. See `mobile/recorder/docs/v4-production-handoff.md` and subsystem docs for release details.
- V4 Build 44 was uploaded to internal TestFlight on September 29 from `main` `eedd835` (EAS build `112332a0-7daa-4590-bbf2-e7df7b5dd661`, submission `1f7a39a0-c3ce-4f4c-ae2d-3d5814608a48`). No External testers or App Review submission. V4 Build 45 (EAS `1f6fb08e-a642-489c-980c-70a730d6fbef`, `main` `3f1a8cb`, runtime preview.3, submission `e2966ad8-739b-4207-8dfc-a33148812c4e`) contains the subscription/Siri changes below; its IPA was inspected: all six alternate icons incl. Aurora Glass, 3-day trial keys, new Always text, app + widget privacy manifests.
- V4 store builds and OTAs point to production connector `https://mcp.journeydeck.me/mcp`; simulator or explicit staging override uses staging. Production CloudKit schema includes `Entitlement` and marker/photo fields. The connector repo is `C:\Users\patri\OneDrive\Documents\ChatGPT\JourneyDeck Data MCP`; its production environment is deployed. Production secrets were name-verified: `TOKEN_KEY`, `CLOUDKIT_API_TOKEN`, `APPSTORE_KEY_ID`, `APPSTORE_ISSUER_ID`, `APPSTORE_PRIVATE_KEY`. Production root returned 200 and `/mcp` returned 401 without auth. No secret values belong in this handoff or repo.
- Connector PRs #4–#10 added Plus verification, production environment, Apple token rotation, privacy filtering, resumable Cloudflare work, and non-Plus session lapse. The owner connected Claude to production; Plus tools require a verified purchase. See `mobile/recorder/docs/v4-public-connector.md`.
- Device review remains needed for V4 layouts, Aurora Glass, icon switching, CloudKit marker/photo sync, `entitlement_pro`, and connector behavior. Keep V4 out of the External TestFlight group.

## Subscription decision and implementation (uncommitted)

- Owner chose **weekly instead of monthly, keep annual**, targeting **$0.99/week and $39.99/year U.S.**, with a **three-day App Store free trial on both**. The App Store offer window is October 14, 2026 through October 13, 2027. Customers get one introductory offer per subscription group.
- Code now requests weekly + annual products in V4, while V3 still requests monthly + annual and native entitlement checks still recognize active monthly subscribers. Native StoreKit returns a trial duration only when the free introductory offer exists and Apple reports eligibility; V4 paywalls show the trial and renewal price accordingly. Owner decision (2026-09-30): V4 gives 3 days of Plus from first launch (`PLUS_TRIAL_DAYS`, Info.plist `JourneyDeckPlusTrialDays` for Siri); V3 keeps 7. Only one trial: the owner is deleting the App Store 3-day introductory offers Codex scheduled on weekly and annual (2026-09-30).
- App Store Connect app `6806502526`, group `22349553`: weekly product `com.journeydeck.recorder.pro.weekly` (Apple ID `6817585321`) is a **Prepare for Submission** draft. U.S. price $0.99, 148 sale regions matching annual, English (U.S.) purchase text, same subscription level 1 as monthly/annual. **Not added for review.**
- Annual `com.journeydeck.recorder.pro.annual` (Apple ID `6807180473`) is currently $24.99 U.S. A $39.99 U.S. price is scheduled for October 14 across its 175 pricing regions; App Store Connect confirms **existing annual subscriber prices preserved**. Three-day free introductory offers on weekly and annual are scheduled October 14, 2026 to October 13, 2027 in 148 sale regions. The current live monthly product remains on sale for V3.
- Verification: `npm run typecheck` passed; focused membership, Ask, and public-release tests passed (54/54); `git diff --check` passed. Swift changes have not been compiled on a Mac or device, and no new build was made.

## Next steps

1. Review the uncommitted subscription diff and run targeted tests after any change. Build V4 natively to verify StoreKit and Siri, then test eligible/ineligible trials, weekly and annual purchases, legacy monthly entitlement, restore, cancellation, and expiration in Sandbox.
2. Add weekly review screenshot and V4 notes in App Store Connect; submit the weekly product for App Review only when the owner requests it. Confirm product approval before the October 14 launch. Keep V3 and current live pricing functional meanwhile.
3. Before launch, confirm both scheduled offers and the annual price in App Store Connect. Decide when to remove monthly from new sale while preserving active monthly subscribers. Do not submit/release V4 without owner authorization.
4. Update this handoff after material repo/environment changes, keeping it under 150 lines and 20 KB.
