# Tessie V3 Phase 2: automatic journeys

This phase imports Tessie drives into the existing local journey archive when a verified, paid V3 connection is present. Capture runs on app open/resume (throttled to 15 minutes) and on explicit Tessie refresh. It is best effort: a failed provider call leaves recorded and previously imported journeys available offline. No background iOS scheduling was added.

## Import and matching

- Phase 1's whitelisted, opaque vehicle/drive/charge/route contract remains the input. The iPhone retries a 200-row saturated summary using smaller time windows and deduplicates overlapping window rows by opaque ID. A failed subwindow fails the refresh instead of saving a truncated history.
- Each completed drive of at least 30 seconds becomes one profile-scoped `provider='tessie'` journey. Repeated IDs and substantially overlapping partial/provider-replayed drives do not create extra journeys. A substantially overlapping manual journey is left untouched. A later duplicate Tessie ID can add its charge marker to the earlier imported journey.
- The route is built from Tessie's historical car GPS points, not the iPhone recorder. A missing or failed GPS response still leaves a summary; up to four outstanding routes are retried per sync, with a five-minute retry interval. A one-point partial route can be repaired when a later fetch has more points. Route writes and charge metadata are transactional and do not replace a complete route or an editor-managed journey.
- Only Supercharger charges are considered for route stops. A stop belongs to the nearest preceding drive of the same vehicle when charging begins within 45 minutes after that drive and does not materially overlap the next drive. The marker uses the last car GPS point of the matched journey. Without GPS, the charge details remain available in the journey detail list, without a map pin. Arrival/departure battery, energy added, and stopped minutes are shown when the contract provides them.
- Apple Music or Last.fm history is matched by playback time to imported journeys according to the selected music provider. Tessie now-playing is not used to create music entries. Repeated history imports preserve existing play rows.

## Persistence and privacy

Migration 10 adds profile-scoped Tessie drive metadata and Supercharger marker tables. Journeys and GPS points use the existing local SQLite archive, so normal private CloudKit journey/route backup applies. Charge marker details and Phase 1's bounded Tessie summary/route caches remain device-only. The Tessie token stays in the profile's iPhone Keychain; the privacy edge remains stateless and receives a token plus an opaque ID and bounded times to resolve a route. No Tessie calls go through the JourneyDeck application server. Share cards use the existing Home/Work route masker; Supercharger markers are not exported.

Disconnect clears the token, connection marker, and Tessie cache. Imported journeys are durable user history and are not deleted on disconnect. Account deletion still removes the profile's local archive and secrets.

## Phase 3 handoff

1. Validate on a V3 iPhone with a real Tessie account: first capture, repeat sync, a trip with a Supercharger between drives, partial/missing GPS, more than one vehicle, profile switch, expired token, offline launch, and disconnect. Check iPad portrait, landscape, narrow Split View, rotation, and Dynamic Type for charge cards and map pins.
2. Confirm Tessie API access/cost, route availability for the intended vehicles, and the paid membership product policy. Review whether charge marker details should join private CloudKit backup; Phase 2 keeps them on device.
3. Confirm route and share-card fidelity around saved Home/Work places and verify Apple Music/Last.fm matching with real playback timestamps.
4. Deploy the Phase 1 route Worker and publish a compatible V3 build only after separate authorization and release gates. Neither happened in Phase 2.
