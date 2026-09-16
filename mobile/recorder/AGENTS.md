# JourneyDeck Mobile Subsystem (iOS / Expo SDK 57)

## V2 complete and frozen — September 15, 2026

The user confirmed V2 submission to App Review and declared development complete. No V2 runtime changes are allowed except urgent customer-reported bugs. Cosmetic polish, features, refactors, dependency upgrades, and other non-urgent improvements belong to V3 on a separate branch. Keep urgent fixes minimal, document the report and urgency, and run targeted validation. Release actions still require user authorization. See root `GEMINI.md` for the authoritative freeze policy.

## iPad acceptance surfaces

For relevant mobile UI work, treat iPad portrait, landscape with Apple's native sidebar, rotation, narrow Split View, and Dynamic Type as required acceptance surfaces. Base responsive choices on the measured content canvas after native navigation insets and preserve the system-managed sidebar.

At normal iPad landscape widths, major tab content follows a shared six-column grid with 12pt gutters. Cards and panels occupy whole-column spans such as 2+4, 3+3, or 2+2+2. Collapse the grid at narrower effective widths.

## Approved reusable Atlas Flip animation

Before changing a widget flip or expanded-details interaction, read only the [Atlas Flip baseline in docs/motion.md](docs/motion.md#atlas-flip--approved-reusable-card-expansion). Preserve its timing, complete card faces, native foreground boundary, and modal/source handoff. Do not enable it on unrelated widgets.

## Core architecture invariants

1. **Expo SDK 57:** Submitted Build 31 targets production runtime `2.0.0-watch.9` and preview runtime `2.0.0-preview.14`. Expo SDK 57, React 19, and React Native 0.86 remain fixed. `app.config.js` is authoritative; `app.json` is historical. Consult the relevant versioned Expo documentation only when changing native modules or framework behavior.
2. **Local-first:** On-device SQLite in `src/local-store.ts` is the primary store. Migrations remain additive through `PRAGMA user_version`.
3. **Analytics:** `src/local-atlas.ts` and `localAtlasClient` in `src/app-data.ts` provide local statistics.
4. **Privacy:** `src/privacy-masker.ts` must preserve the 300 m Home/Work safety boundary before exports or share cards.
5. **Private sync:** `src/cloudkit-sync.ts` uses the private `iCloud.com.journeydeck.recorder` container.
6. **Edge:** Cloudflare Workers live in `cloudflare/`; cloud connectivity must not become a prerequisite for local use.

## Validation policy

Run commands individually and keep output scoped.

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
