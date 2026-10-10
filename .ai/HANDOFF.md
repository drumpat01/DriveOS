# JourneyDeck current handoff — October 9, 2026

## Current objective

Switch the hosted `driveos` Render blueprint to Free after Standard verification. Do not merge or touch Render from this session.

## Checkout

- Branch `cursor/driveos-render-free-blueprint-69b8` / #253, rebuilt on `main` `cf2ec0d` (#252 squash merge).
- Runtime is already live on Standard (~40-75 MB). This PR is blueprint-only.

## Material changes

- `render.yaml` `plan: free`.
- Remove `maxShutdownDelaySeconds`.
- Remove `DRIVEOS_ATLAS_LEGACY_DATABASE=/var/data/atlas/journeydeck.db`.
- Matching Free assertions in `tests/WebDeployment.Tests.ps1`.

## Unresolved / owner decisions

- If blueprint sync is on, merging this flips the live plan to Free. The owner is deleting the `/var/data` disk in Render.
- Do not merge or touch Render from the agent.

## Next steps

1. Confirm `validate` is green and leave #253 ready for review.
2. Do not merge until the owner asks.

## V4 no free trial — October 10, 2026

- Owner removed the in-app 3-day Plus trial (PR 254, `30ecc9b`). Members who skip the plans at setup open the sample library. OTA group `db9b695f-0586-4963-ba57-3bc4ae8d4b43` published to `v4-testflight` (runtime `4.0.0-preview.3`), reaching live 4.0.0 Build 48.
- PR 255 pins `v4-testflight` to the Xcode 27.0 image (Apple refuses the 27.1 beta SDK). Build 51 (4.5.0, EAS `3c165a5c`) is attached to 4.5.0 and submitted to App Review (submission `71e472d8`, WAITING_FOR_REVIEW, manual release). Description and review notes say there is no trial. PR 256 updated the docs.
- Owner to-do: delete the scheduled Oct 14 App Store 3-day intro offers on weekly and annual; release 4.5.0 after approval. Duo edge-to-edge needs an Xcode 27.1 build later.
