# Tessie V3 Phase 1 contract

Phase 2 builds on this contract. See `tessie-v3-phase2.md` for automatic journey capture, route persistence, and Supercharger matching. The requested-route behavior below describes the Phase 1 implementation before automatic capture.

Tessie is optional in V3. `app.config.js` sets `features.tessieEnabled` only for
V3 preview and V3 store variants. V2 remains off. Connection, sync, media,
and route reads require a verified paid StoreKit membership, a Tessie token in
the current profile's iPhone Keychain, and at least one verified active vehicle.
The V3 preview Atlas unlock does not grant Tessie access. Manual recording and
local JourneyDeck history continue without Tessie or network access.

## Data on the iPhone

`src/tessie-contract.ts` is the local wire and cache contract. Parsers whitelist
fields and reject malformed records before saving them. All IDs are opaque
edge hashes; no record contains a VIN, token, or provider payload.

- **Vehicle:** opaque `vehicleKey`, display name, online/charging status,
  battery, range, odometer, and observation time.
- **Drive:** opaque `id` and `vehicleKey`, display name, UTC start/end,
  locations as text labels, distance, energy, and battery endpoints.
- **Charge:** opaque `id`, `locationKey`, and `vehicleKey`, UTC start/end,
  location label, energy, battery endpoints, and recorded cost when available.
- **Route point:** UTC `recordedAt`, latitude/longitude, and optional speed,
  heading, and battery. Points belong to one opaque drive ID and are ordered.

The profile-scoped SQLite app cache holds the latest 30-day summary and up to
12 requested routes. It is an on-device cache, separate from JourneyDeck's
recorded journeys and private CloudKit sync. Disconnect removes the token,
verified-vehicle marker, Tessie summary, routes, and derived vehicle cache.
Account deletion also removes the profile's Keychain secrets and local cache.

## Privacy edge

The existing Cloudflare Worker verifies the user-supplied Tessie token and
brokers read-only Tessie calls. It neither stores nor logs tokens, VINs,
provider responses, or coordinates. It returns no VIN or token. Responses are
`no-store`; the usual edge rate limits and bounded request/response sizes apply.

`POST /api/vehicle/tessie/route` accepts a token, opaque drive ID, and exact
UTC drive start/end. The request must be within 31 days and at most 24 hours.
The Worker resolves the opaque ID against that token's active-vehicle drive
history before calling Tessie's historical `/states` endpoint with the web
app's one-second, uncondensed query. It validates timestamps and coordinates,
clips points to the drive, and returns at most 2,500 points, retaining the last
point. Precise Tessie coordinates pass transiently through this Worker only
for a requested drive and are then stored on the iPhone. They are not sent to
JourneyDeck's application server, analytics, share cards, or CloudKit by this
Phase 1 path. Share/export work must use the existing Home/Work masker.

The summary endpoint fails a limit-saturated 200-row Tessie window instead of
silently dropping records. A shorter-window sync strategy is Phase 2 work for
accounts that hit that provider limit.

## Phase 2

Connect the saved Tessie drives and route loader to a V3 journey/map surface,
apply Home/Work masking to any sharing or export, and add device acceptance for
connection, expired token, profile switch, offline cache, and disconnect.
Confirm Tessie provider access/cost and written product policy before any
release. The Worker route must be deployed and the app validated together;
neither is deployed or published by Phase 1.
