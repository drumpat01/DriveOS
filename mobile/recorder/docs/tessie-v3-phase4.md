# Tessie V3 Phase 4: Statistics data contract

`localAtlasClient.tessieStatistics(userId, range)` is the Phase 5 entry point.
It returns `null` when Tessie is disabled for the app variant, or a
`TessieStatistics` object from `src/tessie-statistics-model.ts` when enabled.
It reads only the current profile's local SQLite archive and works offline.
The existing non-Tessie Statistics model and screen are unchanged.

The caller supplies canonical UTC ISO timestamps as a half-open range:
`{ startInclusive, endExclusive }`. Drives and energy by journey belong to the
range containing the drive's start. Road charging belongs to the range
containing the charge's start, even when its preceding drive began in another
range. Phase 5 should display that same date range for all four sections.

- **Driving efficiency:** `energyUsedKwh` is the sum of valid measured drives
  with positive miles; `whPerMile` is the distance-weighted ratio. The model
  also provides `measuredJourneys` and `measuredMiles` so coverage is visible.
- **Energy by journey:** each imported Tessie journey has kWh and Wh/mi fields.
  Wh/mi is `null` when energy is unknown or miles are zero. A measured zero is
  `0`. The journey ID can open existing journey detail.
- **Charging on the road:** only Phase 2's matched Supercharger markers are
  included. Energy is kWh added, duration is minutes, and battery gain is
  percentage points. Charge IDs and linked journey IDs are opaque. Ordinary
  charging sessions are outside this durable on-road source.
- **Repeated routes:** groups require at least two imported journeys for one
  vehicle and the same normalized start/end labels. Unknown location labels
  do not form routes. Each group exposes all journeys and miles, plus measured
  journeys/miles for its weighted Wh/mi comparison. Best and worst are valid
  per-drive Wh/mi values. No cost is inferred from drive energy.

The source adapter selects `provider='tessie'` journeys with drive metadata
and charge markers in separate queries. It never joins charge rows into drive
totals. The pure model deduplicates opaque source drive IDs, substantially
overlapping same-vehicle intervals, and charge IDs. Invalid timestamps,
negative or nonfinite measurements, and out-of-range rows are excluded.
Missing energy is `null` in the result; a true measured zero stays `0`.

Migration 11 adds local energy-observed flags. The Worker now sends observed
flags with drive and charge energy. Old cached or stored zeroes are
conservatively unknown because the previous contract used zero for absent
provider values; positive old values remain measured. Imported journey
metadata and charge markers remain device-only; no Tessie token, VIN, or
coordinates enter this model. A restored Tessie journey without its device-only
metadata is excluded rather than assigned zero energy.

## Phase 5 handoff

Build the V3 Statistics interface using the entry point and field units above.
Keep the existing Statistics totals for all journeys and music intact. Show
coverage when a period contains journeys with missing energy, and show unknown
values distinctly from measured zero. Validate against a real Tessie account
and a migrated profile before release. Phase 4 did not redesign the screen,
deploy the Worker, publish an OTA, or produce a build.
