# JourneyDeck Mobile Subsystem (iOS / Expo SDK 57)

## Core Architecture Invariants & Rules

1. **Expo SDK 57 Strict Adherence**:
   - Runtime version is `1.6.0` on Expo SDK 57 with React 19 / React Native 0.86.
   - Read versioned docs at https://docs.expo.dev/versions/v57.0.0/ before changing native modules.

2. **Local-First & Multi-User Architecture**:
   - **Primary Master Store**: On-device SQLite (`src/local-store.ts`) with `PRAGMA user_version` additive migrations.
   - **Atlas Analytics Engine**: Pure SQLite statistics in `src/local-atlas.ts` and synchronous client `localAtlasClient` in `src/app-data.ts`.
   - **Privacy Masking**: `src/privacy-masker.ts` enforces 300m safety geofences for Home & Work before any export or share card generation.
   - **iCloud Sync**: `src/cloudkit-sync.ts` manages private E2EE synchronization with container `iCloud.com.journeydeck.recorder`.
   - **Serverless Edge**: Cloudflare Workers in `cloudflare/` (`https://journeydeck-edge.patrickbstewart.workers.dev`).

3. **Testing Pipeline**:
   - Run tests individually (never chain with `&&` or PowerShell pipes):
     - `npm run typecheck`
     - `npm run test:tab-runtime`
     - `npm run test:local-store`
     - `npm run test:local-atlas`
     - `npm run test:privacy-masker`
     - `npm run test:local-atlas-client`
     - `npm run test:cloudkit-sync`
     - `npm run test:cloudflare-workers`
     - `npm run test:auth`
     - `npm run test:recovery`
     - `npm run test:sync-status`
     - `npm run test:music-observations`
     - `npm run test:drive-detection`
     - `npm run test:navigation-motion`
     - `npm run test:native-capabilities`
     - `npx expo export --platform ios`

4. **Git Hygiene**:
   - Inspect `git status` before making modifications.
   - Stage explicit paths and use atomic commits.
