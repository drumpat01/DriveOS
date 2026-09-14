# JourneyDeck Mobile Subsystem (iOS / Expo SDK 57)

## V2 feature freeze — September 10, 2026

The user has declared V2 feature complete. Limit V2 work to minor bug fixes and small polish/UI tweaks. Preserve the established feature set and behavior; do not add features, undertake broad redesigns, or expand scope unless the user explicitly changes this direction. Feature-complete status does not imply all device acceptance checks are finished.

## V2 iPad release acceptance priority — September 10, 2026

Treat iPad portrait, landscape with Apple's native sidebar, rotation, and narrow Split View as release-blocking acceptance surfaces for V2. Base responsive choices on the measured content canvas left after native navigation insets, preserve the system-managed sidebar, and check Dynamic Type before publishing UI changes.

At normal iPad landscape widths, major tab content follows a shared six-column grid with 12pt gutters. Cards and panels must occupy whole-column spans (for example 2+4, 3+3, or 2+2+2); do not introduce fractional panel widths between those tracks. Collapse the grid at narrower effective widths so Split View and Dynamic Type remain readable.

## Approved reusable Atlas Flip animation

Before implementing or modifying a widget flip/expanded-details interaction, read [the Atlas Flip baseline in docs/motion.md](docs/motion.md#atlas-flip--approved-reusable-card-expansion). The user approved the Driving Rhythms implementation on September 9, 2026 and asked that it be reused. Preserve its exact timing, complete card faces, native foreground layer boundary, and modal/source handoff. Reuse that implementation for requested widgets rather than redesigning the animation; do not automatically enable it on other widgets.

## User-approved combined native build (September 4, 2026)

The user was alerted that Build 2 omitted automatic iOS Home Screen icon variants and explicitly authorized the next V2 preview build to include BOTH native tab spacing and the selected option 2 light icon with the existing dark icon. The reminder has been fulfilled; no further confirmation is needed. Use native iOS appearance assets, independent of the in-app theme switch. Preserve the isolated v2-preview identity and production App Store update path.

## Core Architecture Invariants & Rules

1. **Expo SDK 57 Strict Adherence**:
   - Current source targets `2.0.0-watch.6` (internal preview `2.0.0-preview.11`) for native recorder schema 3, the consolidated recorder state machine, CloudKit recovery, RevenueCat, PhotoKit, recap audio, reversible editor schema 7, and the Minted 1.1.1 keepsake renderer. Build 24 uses `2.0.0-watch.5`. Keep OTA packages isolated by native runtime. Expo SDK 57 / React 19 / RN 0.86 remain unchanged. `app.config.js` is authoritative; the `app.json` 1.9 baseline is historical. Do not publish the new source to an older runtime.
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
