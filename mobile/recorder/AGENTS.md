# JourneyDeck Mobile Subsystem (iOS / Expo SDK 58 beta)

## V2 complete and frozen — September 15, 2026

The user confirmed V2 submission to App Review and declared development complete. No V2 runtime changes are allowed except urgent customer-reported bugs. Cosmetic polish, features, refactors, dependency upgrades, and other non-urgent improvements belong to V3 on a separate branch. Keep urgent fixes minimal, document the report and urgency, and run targeted validation. Release actions still require user authorization. See root `GEMINI.md` for the authoritative freeze policy.

## iPad acceptance surfaces

For relevant mobile UI work, treat iPad portrait, landscape with Apple's native sidebar, rotation, narrow Split View, and Dynamic Type as required acceptance surfaces. Base responsive choices on the measured content canvas after native navigation insets and preserve the system-managed sidebar.

At normal iPad landscape widths, major tab content follows a shared six-column grid with 12pt gutters. Cards and panels occupy whole-column spans such as 2+4, 3+3, or 2+2+2. Collapse the grid at narrower effective widths.

## Approved reusable Atlas Flip animation

Before changing a widget flip or expanded-details interaction, read only the [Atlas Flip baseline in docs/motion.md](docs/motion.md#atlas-flip--approved-reusable-card-expansion). Preserve its timing, complete card faces, native foreground boundary, and modal/source handoff. Do not enable it on unrelated widgets.

## Core architecture invariants

1. **Expo SDK 58 on V3:** This V3 branch uses Expo SDK 58 beta, React 19, and React Native 0.88 RC for iOS 27 development. Submitted V2 Build 31 remains frozen on Expo SDK 57 at commit `dee86fa`; do not rebuild or update V2 from this branch. `app.config.js` is authoritative; `app.json` is historical. Until SDK 58 reaches stable, `.npmrc` permits Expo's prerelease peer set and `tsconfig.json` retains the documented legacy deep-import condition for dependencies that have not finished the Strict TypeScript API migration. Remove both bridges when the stable dependency set supports it. Consult the relevant versioned Expo documentation when changing native modules or framework behavior.
2. **Local-first:** On-device SQLite in `src/local-store.ts` is the primary store. Migrations remain additive through `PRAGMA user_version`.
3. **Analytics:** `src/local-atlas.ts` and `localAtlasClient` in `src/app-data.ts` provide local statistics.
4. **Privacy:** `src/privacy-masker.ts` must preserve the 300 m Home/Work safety boundary before exports or share cards.
5. **Private sync:** `src/cloudkit-sync.ts` uses the selected app variant's private CloudKit container. Capability-5 Journey Marker metadata/photos use their own profile-scoped zone so older binaries never receive unknown record types.
6. **Edge:** Cloudflare Workers live in `cloudflare/`; cloud connectivity must not become a prerequisite for local use.

## Validation policy

Run commands individually and keep output scoped.

## OTA publishing

Before any EAS Update / OTA work, read [docs/OTA_RUNBOOK.md](docs/OTA_RUNBOOK.md).
Use `npm run ota:publish -- --target <target> --message "..."` instead of
composing raw `eas update` commands. The wrapper defaults to dry-run and
requires `--execute` for an authorized publish.

## V3 TestFlight

Before any V3 TestFlight / EAS Build / EAS Submit work, read
[docs/ios-v3-testflight.md](docs/ios-v3-testflight.md) and
[APP_STORE_RELEASE.md](APP_STORE_RELEASE.md). V3 TestFlight updates the
existing live JourneyDeck App Store Connect app (`ascAppId` `6806502526`,
bundle `com.journeydeck.recorder`) using profile `v3-testflight` and
`APP_VARIANT=v3-store`. Never create a new App Store Connect app, never use
the isolated `.v3` bundle or ascAppId `6814695593`, and never submit this
stream to App Review. Run `npm run testflight:gate` before any authorized
build/submit.

### Default: targeted validation

- Run `npm run typecheck` when TypeScript types may be affected.
- Run only tests covering the changed behavior. Select from the commands below rather than running the entire list automatically.
- Use `git diff --check` after edits.

Available focused suites:

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

### Broader validation

Run multiple affected suites when a change crosses subsystem boundaries. Explain why each additional suite is relevant. Do not treat unrelated historical failures as a reason to rerun everything.

### Release or native-build validation

Run the complete applicable mobile suite and `npx expo export --platform ios` only for an explicitly authorized release candidate, native build, runtime/package change, or change whose bundling behavior needs export verification. These are not default checks for ordinary source or documentation edits.

## Git hygiene

Inspect `git status` before modifications, stage only explicit paths, and make atomic commits only when the user authorizes committing.
