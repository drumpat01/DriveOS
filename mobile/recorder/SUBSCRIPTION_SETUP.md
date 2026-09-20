# JourneyDeck subscription setup for Build 10

The app uses StoreKit 2 and unlocks paid access only from a verified current App Store transaction. No subscription flag is stored in editable app preferences.

## App Store Connect work required

1. Open **Apps → JourneyDeck → Monetization → Subscriptions**.
2. Create one subscription group named **JourneyDeck Membership**.
3. Create either or both of these auto-renewable subscriptions in that group. The product IDs must match exactly:

   - Monthly: `com.journeydeck.recorder.pro.monthly`
   - Annual: `com.journeydeck.recorder.pro.annual`

4. Choose the price for each plan in App Store Connect. JourneyDeck reads and displays Apple’s localized price; no price is hardcoded in the app.
5. Add the required App Store localization, description, and review screenshot for each product.
6. Keep both products at the same subscription-group service level because they unlock the same features: Atlas and history older than 45 days.
7. Confirm **Agreements, Tax, and Banking** is active for paid apps.
8. Add the subscriptions to the Build 10 app-version submission before sending it to App Review.
9. Test purchase, cancellation, pending purchase, expiration, and **Restore Purchases** with a Sandbox Apple Account in TestFlight.

The app safely handles partial setup. If only one product is available, it shows only that product. If neither product is available or the transaction cannot be verified, JourneyDeck remains on the free tier.

## Access model

- Free: Manual Start and Finish, Statistics in the fifth tab, and the latest 45 days of Journeys, Memories, Statistics, and timeline history.
- Paid: Atlas and complete locally stored Journey, Memory, and soundtrack history.
- Downgrade or expiration never deletes history. Older content is hidden until a current entitlement is verified again.
- Recording remains manual for free and paid users in version 1.


## RevenueCat integration — September 10, 2026

Source is prepared but **not activated or released**. `react-native-purchases` 10.9.0 runs with `purchasesAreCompletedBy: MY_APP` and StoreKit 2. Apple continues to handle purchase, restore, transaction finishing and verified access. RevenueCat mirrors billing using an anonymous SDK identity. No JourneyDeck profile ID, Apple sign-in identity, route, photo or music data is supplied. Automatic attribution identifier collection and SDK diagnostics are disabled.

### Dashboard configuration needed

1. Create or select the JourneyDeck RevenueCat project.
2. Connect the production Apple app `com.journeydeck.recorder`. Configure Apple's In-App Purchase key in the RevenueCat dashboard; private `.p8` credentials stay there, never in the app or chat.
3. Import the existing monthly and annual product IDs listed above. Do not recreate or rename production subscriptions.
4. Create an entitlement named `pro` and attach both products. Optionally create the default offering with monthly and annual packages for future RevenueCat paywalls. The current custom paywall still reads Apple's products directly.
5. If testing purchases in the separate V2 app, configure a distinct RevenueCat Apple app for `com.journeydeck.recorder.v2` and confirm that app's actual App Store Connect products. The current native bridge permits the two IDs above; a separate bundle does not automatically inherit production subscriptions.
6. Review RevenueCat's restore behavior to match App Store account ownership; anonymous IDs must not become linked to JourneyDeck profiles. Configure App Store server notifications for ongoing renewal/refund reporting.
7. Supply each app's **public Apple SDK key** through EAS environment variables:
   - Preview environment: `REVENUECAT_PREVIEW_APPLE_API_KEY`
   - Production environment: `REVENUECAT_PRODUCTION_APPLE_API_KEY`
   These must start with `appl_`. They are intentionally embedded in the client. Secret and Test Store keys are rejected. A missing preview key never falls back to production.

### Behavior and release

- Missing configuration or native SDK leaves existing StoreKit membership working.
- Existing paid purchases are synced once per RevenueCat anonymous identity. A Keychain marker is written only after successful sync. Offline failure retries on the next membership read.
- A successful Apple purchase or explicit restore requests a fresh billing sync without delaying or changing Apple's result. RevenueCat also observes native transactions.
- The combined native hardening release advances source runtimes to `2.0.0-preview.10` and `2.0.0-watch.5`. Build 23 remains on watch.4; do not publish this source to an older runtime.
- Before release, validate monthly/annual purchases, cancellation, pending approval, restore/reinstall, renewal/refund and offline access on a device; confirm matching transactions in RevenueCat. Publish updated privacy disclosures covering purchase information and the pseudonymous RevenueCat identifier.
- Dashboard credentials, product availability and real transactions have not yet been verified. No RevenueCat key has been configured by this change.

References: [Existing purchase code](https://www.revenuecat.com/docs/migrating-to-revenuecat/sdk-or-not/finishing-transactions), [Expo installation](https://www.revenuecat.com/docs/getting-started/installation/expo).
