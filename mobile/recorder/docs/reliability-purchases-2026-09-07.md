# Purchase and access reliability audit — September 7, 2026

Scope: existing dirty `codex/journeydeck-v2` working tree, base HEAD `9421e87`. No OTA, build, submission, Git staging, commit or push. Existing theme/paywall changes preserved. This is a source and executable JavaScript audit, not an App Store sandbox acceptance run.

## Confirmed findings and fixes

1. **Out-of-order membership checks could incorrectly hide or unlock paid history.** `src/membership-store.ts` previously applied every asynchronous read, purchase/restore result and native event without ordering. Three deferred-promise reproductions failed before the change: a startup free result overwrote an approved paid event; a stale read error overwrote a successful restore; an older paid result overwrote a newer free verification. Added request generations, event/action invalidation, mounted guards and purchase/restore polling exclusion. The same executions now pass. Cleanup invalidates outstanding reads/product loads and removes native/AppState listeners and timers.
2. **A completed transaction with no active entitlement closed the paywall as if access were unlocked.** The native purchase bridge can return `outcome: purchased` with the separately queried current entitlement still free. The shell closes the paywall on that outcome. The hook now keeps the paywall open, keeps access free and explains that Restore Purchases can retry reconciliation. It never fabricates paid access from a purchase outcome. Behavioral test covers this exact pair of values.
3. **A known expiration depended on the next foreground event, transaction event or 15-minute poll.** The hook now schedules another StoreKit read just after the reported expiration. This is a recheck, not an expiration-date access gate. An already-past expiration returned as a verified paid entitlement remains paid because StoreKit can include Apple's billing grace period. The periodic/foreground paths remain for later changes. Behavioral test supplies a future expiration, then grace, then a free verification.

Modified runtime files: `src/membership-store.ts` and a stale explanatory comment in `src/membership-entitlements.ts`. Added `tests/membership-store.test.mts`. No native or dependency changes were needed.

## Verified boundaries

- **RevenueCat is not integrated.** Package/lockfile, native modules and source contain no RevenueCat or `react-native-purchases` implementation. Runtime purchases go through the local `JourneyDeckMembership` Expo module and Apple StoreKit 2. Do not describe the app as using both providers.
- Native allowed IDs are the existing production `com.journeydeck.recorder.pro.monthly` and `.annual`; products/prices are loaded from Apple. Unrecognized requested IDs and unverified purchase transactions fail closed.
- Native access comes from verified `Transaction.currentEntitlements` with matching product IDs and no revocation. `Transaction.updates` observes subsequent changes. Explicit restore uses `AppStore.sync()`; startup reads do not force a login/sync request. [Apple's current-entitlements documentation](https://developer.apple.com/documentation/storekit/transaction/currententitlements) includes subscribed and billing-grace subscriptions and excludes revoked/refunded products. [Apple's transaction-updates documentation](https://developer.apple.com/documentation/storekit/transaction/updates) describes outside-app and other-device transactions.
- Membership is owned by the App Store purchase account, not by an editable preference or JourneyDeck Sign in with Apple profile. No payment verification copies route/profile data to a payment backend. The V2 preview bundle is intentionally distinct from production.
- Hook tests cover concurrent requests, refund/expiration ordering, approval events, cancellation, purchase/restore mutual exclusion, restore failure preserving the last verified membership, missing native module, stale product prices, empty products, and cleanup. A native verification error itself still fails closed. Actual offline StoreKit cache behavior is a device test.
- The entitlement module has no database writes. Free history is a 45-day presentation filter and paid history has no date cutoff. Editing filtered Memories was referred to the root audit for separate persistence review; do not infer that all edit paths preserve hidden links solely from the read-only entitlement layer.

## Executed verification

- Before fix: `node --experimental-strip-types --test tests/membership-store.test.mts` — 2 passed, 3 failed, reproducing the three ordering defects above.
- After fix: `node --experimental-strip-types --test tests/membership-store.test.mts tests/membership-entitlements.test.mts tests/public-release-integrity.test.mts tests/native-capabilities.test.mts` — **29 passed, 0 failed** (10 actual-hook behavioral tests, 5 entitlement tests, 14 existing native/release source checks).
- Native/release source checks establish code invariants; they do not execute Apple's purchase system. Root audit owns final aggregate TypeScript/tests.

## Physical iPhone/iPad checks still required

1. Buy monthly and annual in Sandbox, cancel the Apple confirmation sheet, and confirm one transaction for rapid repeated taps. Verify displayed currency/period against Apple's sheet.
2. Trigger Ask to Buy/pending approval; approve outside the app and verify automatic unlock without relaunch.
3. Restore on the second device and after reinstall using the same App Store account. Repeat with a different App Store account. JourneyDeck profile/iCloud identity changes must not transfer another profile's journey data.
4. Test renewal, cancellation through the end of the paid period, expiration, refund/revocation, billing retry with grace enabled, and recovery after grace. Check Atlas and older history on both devices and confirm local data remains present after reactivation.
5. Relaunch and browse an already verified subscription offline; lose network during purchase/restore and recover. Verify product-unavailable errors allow retry and never charge twice or report paid access without a verified entitlement.
6. Background/foreground during Apple's purchase sheet and restore; confirm the final verified status wins and no old response re-locks access.

App Store product configuration, agreements, review approval, and actual transaction delivery were not inspected or altered in this audit. Follow `SUBSCRIPTION_SETUP.md` for the existing setup requirements.
