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
