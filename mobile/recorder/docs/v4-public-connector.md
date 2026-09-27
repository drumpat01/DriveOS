# V4 public connector app contract

## Production CloudKit action

The checked-in Development schema has `JourneyMarker` and `MarkerPhoto`. The V3 Marker documentation says these types were never deployed to Production; this checkout cannot inspect the live Production schema. Deploy both types and the new `Entitlement` type from Development to Production in the CloudKit Console before testing V4 uploads. The app retains every existing record type, field, and recordName. No query indexes are required for the connector's zone-change reads.

| Record type | App field | CloudKit type |
| --- | --- | --- |
| JourneyMarker | accuracyMeters | DOUBLE |
| JourneyMarker | capturedAt | STRING |
| JourneyMarker | createdAt | STRING |
| JourneyMarker | deletedAt | STRING |
| JourneyMarker | id | STRING |
| JourneyMarker | latitude | DOUBLE |
| JourneyMarker | locationAt | STRING |
| JourneyMarker | longitude | DOUBLE |
| JourneyMarker | notes | STRING |
| JourneyMarker | rootJourneyId | STRING |
| JourneyMarker | sessionId | STRING |
| JourneyMarker | syncRevision | INT64 |
| JourneyMarker | updatedAt | STRING |
| MarkerPhoto | asset | ASSET |
| MarkerPhoto | byteLength | INT64 |
| MarkerPhoto | contentType | STRING |
| MarkerPhoto | createdAt | STRING |
| MarkerPhoto | deletedAt | STRING |
| MarkerPhoto | fileName | STRING |
| MarkerPhoto | id | STRING |
| MarkerPhoto | markerId | STRING |
| MarkerPhoto | rootJourneyId | STRING |
| MarkerPhoto | syncRevision | INT64 |
| MarkerPhoto | updatedAt | STRING |
| Entitlement | environment | STRING |
| Entitlement | expiresAt | TIMESTAMP |
| Entitlement | isActive | INT64 |
| Entitlement | originalTransactionId | STRING |
| Entitlement | productId | STRING |
| Entitlement | updatedAt | TIMESTAMP |

CloudKit also supplies its standard `___` system fields for each type. `deletedAt` and `expiresAt` are absent when null. `MarkerPhoto.asset` is absent for a soft-deleted photo. Marker record names remain `journey_marker_<marker id>` and `marker_photo_<photo id>`; the existing local marker id starts with `marker_`. The Pro record name is always `entitlement_pro` in the account's canonical zone.

## Source findings

- V3 already saves markers and photos into revision-safe SQLite pending queues. Migration 9 sets preexisting rows to unsynced, so they are backfilled after the schema is deployed. Capability 5 enables the queue, and the native module creates the target zone. The missing Production schema is the documented deployment gap consistent with zero remote marker records. A live Production schema read and CloudKit error log are still needed to confirm it was the only cause.
- V3's base zone scope is the first 48 SHA-256 hex characters of `journeydeck-profile:apple:<Sign in with Apple subject>` or, before sign-in, `journeydeck-profile:local:<local user id>`. Automatic sync ran before sign-in, so local-profile churn could create new zones. Editor and Marker zones are further hashes of that scope.
- V4 waits for Apple sign-in, derives one canonical `JourneyDeck-<48 hex>` zone from the CloudKit user record ID and the fixed `journeydeck-icloud-v1:` prefix, reads all existing `JourneyDeck-` zones, and writes new records only to the canonical zone. The first V4 sync may create that one zone. Reinstalls and a second device signed into the same iCloud account reuse it. Old zones and records remain in place.
- CloudKit normally saves in groups of 25. If a group throws a record-specific error, V4 isolates its members and continues with healthy records. Per-record failures include record type and CloudKit code in logs, without record contents. Transport-wide failures still use sync backoff.
- StoreKit's verified current entitlement or latest verified past subscription supplies the Pro pointer. V4 writes on launch, transaction updates and restore/purchase status changes. It writes an inactive record when Pro ends, does not create one for a never-subscribed account, and checks both local and remote state to skip unchanged writes until the daily refresh.

## TestFlight checks

1. Deploy the three record types above to Production. Build V4 with the `v4-testflight` profile. It uses the existing live bundle and iCloud container, version `4.0.0`, runtime `4.0.0-preview.1`, and its own `v4-testflight` update branch. Do not use a V3 profile for this source.
2. On an account with existing local markers, sign in with Apple, tap **Sync**, and check that `JourneyMarker` and `MarkerPhoto` appear in the canonical zone. Create a new marker with a photo, edit its notes, sync again, then delete the photo and confirm its record remains with `deletedAt` and no asset. Check the logs for any record type and CloudKit error code; no content should appear.
3. Record the set of `JourneyDeck-` zone names after the first V4 sync. Reinstall V4, sign in with the same Apple and iCloud accounts, sync, and confirm the set is unchanged. Repeat on a second device. Confirm old journeys, music, places, memories and photos remain visible. Legacy zones should remain.
4. With an active App Store sandbox or TestFlight Pro subscription, sync and inspect `entitlement_pro` in the canonical zone. Compare `originalTransactionId`, `productId`, `expiresAt` and `environment` with StoreKit/App Store Server API data. Refresh twice without a transaction change and confirm `updatedAt` does not advance. Confirm a renewal changes the expiry; after expiration or revocation, `isActive` becomes `0` and the record remains. A never-subscribed account should have no record.

Swift compilation and device CloudKit behavior remain unverified on this Windows host. The V4 checkout has not built or submitted a TestFlight binary.
