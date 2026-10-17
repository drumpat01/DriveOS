# iOS backlog — 12 October 2026

This audit is the iOS backlog. GitHub had **no open issues** on 12 October 2026 (`gh issue list --state open` returned `[]`), so there is no existing iOS issue tracker to extend.

**Scope:** Expo / React Native app under `mobile/recorder/`, `mobile/recorder/app.json`, `mobile/recorder/app.config.js` (authoritative), root `app.json`, and native iOS modules under `mobile/recorder/modules/**/ios/`. No app code was changed. Render and website deploy config were left alone.

**Method:** Read-only inspection of screens, local store, CloudKit, background recording, Watch/Ask native modules, and existing mobile docs. There are **no** `TODO` / `FIXME` / `HACK` / `XXX` markers in the mobile TypeScript or Swift sources. Leftover work lives in crash paths, accessibility gaps, and documented-but-unrun device acceptance.

**Ranking:** User harm first — crash or data loss, then sync correctness, then VoiceOver / Dynamic Type blockers, then documented unfinished acceptance, then polish. Size is rough: **S** one focused PR, **M** a few files or a screen, **L** architecture or device matrix.

**Visual/UI** means a user sees or hears the defect on a screen (including VoiceOver), not that the fix is cosmetic.

Items marked **★ one-PR** are the five best independent first fixes: small, evidenced, and they do not share files with each other.

---

## Five best independent one-PR fixes

These five can be implemented in parallel. None share files.

| # | Item | Files | Size | Why this first |
| --- | --- | --- | --- | --- |
| ★1 | Guard corrupt private-place JSON | `mobile/recorder/src/private-place-record.ts`, `mobile/recorder/src/local-store.ts`, `mobile/recorder/src/cloudkit-sync.ts` | S | One bad backup row can crash Settings delete **and** abort a CloudKit pull |
| ★2 | Stop force-unwrapping CloudKit asset URLs | `mobile/recorder/modules/journeydeck-cloudkit/ios/JourneyDeckCloudKitModule.swift` | S | Native crash mid photo/route sync |
| ★3 | Catch recorder DB failure in the location task | `mobile/recorder/src/location-task.ts` | S | Background GPS points can be dropped after a `quick_check` throw |
| ★4 | Mark the share-card sheet as an a11y modal | `mobile/recorder/src/share-card-modal.tsx` | S | VoiceOver can escape the share sheet onto tab content behind it |
| ★5 | Add a root React error boundary | `mobile/recorder/App.tsx` plus a new small boundary module | M | Any uncaught render error whitescreens the whole app |

---

## Ranked items

### 1. ★ Guard corrupt private-place JSON so delete and CloudKit pull cannot throw

- **Files:** `mobile/recorder/src/private-place-record.ts` (`parsePrivatePlace`), `mobile/recorder/src/local-store.ts` (`privatePlacePreferences`, `queuePrivatePlace`, `deletePlace`), `mobile/recorder/src/cloudkit-sync.ts` (PrivatePreference ingest ~865–874)
- **Why it matters:** `parsePrivatePlace` throws on invalid JSON shape. `privatePlacePreferences` uses that throw as a **filter**, so one damaged `library.place.v1.*` row (partial iCloud restore, interrupted write) crashes Home/Work delete and Settings place load. CloudKit ingest only `try/catch`es `JSON.parse`; a well-formed JSON object that fails place validation then throws and can abort the rest of the pull.
- **Visual/UI:** Yes — Settings / saved places; sync errors surface in Data Health.
- **Size:** S
- **Parallel:** ★ one-PR. Do not pair with item 14 (`pendingSyncCount` also edits `local-store.ts`) or item 18 (same CloudKit ingest loop). Independent of every other item.

### 2. Dual Expo + native SQLite handles on the Ask WAL database

- **Files:** `mobile/recorder/modules/journeydeck-recorder/ios/JourneyDeckAskService.swift` (`AskArchiveOwner` ~101–117), `mobile/recorder/src/ask-journeydeck.ts`
- **Why it matters:** Comments already warn that Expo and native both open `journeydeck-local.db` in WAL mode. A long-lived native reader while Expo writes can invalidate the mapped WAL index (`EXC_BAD_ACCESS` or archive corruption) during Ask / Siri. Not a JS exception — a process kill.
- **Visual/UI:** Ask JourneyDeck and Siri answers.
- **Size:** L (single reader, snapshot file, or pause Expo writes)
- **Parallel:** Same native recorder module as item 8 (Watch bridge). Do not run those two in the same PR. Independent of JS-only items.

### 3. ★ CloudKit `validatedAssetURL` force-unwraps `URL(string:)`

- **Files:** `mobile/recorder/modules/journeydeck-cloudkit/ios/JourneyDeckCloudKitModule.swift` (~297–298)
- **Why it matters:** `URL(string: path)?.isFileURL == true ? URL(string: path)! : URL(fileURLWithPath: path)` crashes the native module if the second parse fails. That aborts private photo/route/marker upload mid-flight. Local queue remains, but the user sees a hard sync failure.
- **Visual/UI:** Partial (Settings sync / account).
- **Size:** S
- **Parallel:** ★ one-PR. Swift CloudKit module only. Independent of Ask/Watch (different module) and all JS items.

### 4. ★ Background location task does not catch `recordLocations` / `initializeDatabase`

- **Files:** `mobile/recorder/src/location-task.ts` (~14–27), `mobile/recorder/src/storage.ts` (`recordLocations` ~296–300, `initializeDatabase` ~119–122)
- **Why it matters:** The task `try/catch`es `prepareJourneyDeckDatabase()`, then calls `recordLocations`, which calls `initializeDatabase()` again. A later `PRAGMA quick_check` failure throws out of the task with no handler. Manual-recording GPS points for that tick are dropped; the user may think recording is still healthy.
- **Visual/UI:** No (background data loss; later journey looks short).
- **Size:** S
- **Parallel:** ★ one-PR. `location-task.ts` only if the catch stays at the task boundary. Do not combine with a broader `storage.ts` rewrite in the same PR if another agent is touching recorder persistence.

### 5. ★ No React error boundary in the app tree

- **Files:** `mobile/recorder/App.tsx` (root stack ~906+). Repo-wide: no `ErrorBoundary` / `componentDidCatch`.
- **Why it matters:** `DatabaseStartupGate` covers DB open only. Any uncaught render error (bad row, unexpected `undefined`) unwinds the whole tree to a white screen / force quit. A shell-level boundary would keep tabs alive.
- **Visual/UI:** Yes — full-app blank screen.
- **Size:** M (new boundary component + wrap in `App.tsx`; optionally a second boundary around Ask / share / journey detail)
- **Parallel:** ★ one-PR. Touches `App.tsx` plus a new file. Do not pair with item 13 (widget start also lives in `App.tsx`). Independent of store, CloudKit, and screen-level a11y items.

### 6. Deep-link `id` is typed as `string` but Expo Router can pass `string[]`

- **Files:** `mobile/recorder/src/shell.tsx` (`NativeJourneyScreen` ~2823–2827), `mobile/recorder/src/use-journey-detail.ts`, `mobile/recorder/src/native-navigation.tsx`, `mobile/recorder/src/journey-editor-screen.tsx`, `mobile/recorder/src/matched-photo-screen.tsx`, `mobile/recorder/src/ask-journeydeck-screen.tsx`
- **Why it matters:** `useLocalSearchParams<{ id: string }>()` does not normalize duplicate query keys. `useJourneyDetail` and `appDataClient.journey` then receive a non-string. Duplicate `/journey?id=` links, Siri snippet handoff, or a malformed widget URL can error the detail screen or query the wrong key.
- **Visual/UI:** Yes — journey / memory / editor / photo / Ask ticket routes.
- **Size:** S (one `normalizeRouteParam` helper + call sites)
- **Parallel:** Touches `shell.tsx` (conflicts with items 10 and 17). Safer as its own PR that only adds a helper and the param lines. Independent of native modules and share-card.

### 7. Share-card route snapshot can load a large OSM tile grid into Skia at once

- **Files:** `mobile/recorder/src/share-card-modal.tsx` (`ShareRouteSnapshot` ~433–490)
- **Why it matters:** Tile loops cover the full bounding box at the computed zoom; each tile uses `useImage(uri)` on a 1792×768 snapshot. Long routes or older iPhones can jetsam the app while composing a share image.
- **Visual/UI:** Yes — share flow.
- **Size:** M (cap tile count / zoom, sequential decode)
- **Parallel:** Same file as item 9. Do **not** run 7 and 9 in the same week unless one owner takes both. Independent of store, recording, and native modules.

### 8. Watch bridge force-unwraps last-drive JSON after loose type checks

- **Files:** `mobile/recorder/modules/journeydeck-recorder/ios/JourneyDeckWatchBridge.swift` (~30–36)
- **Why it matters:** Guard is `drive["miles"] is NSNumber`, then `drive["miles"]!`. Unusual plist bridging (`NSNull`, unexpected NSNumber subclasses) can still nil-unwrap and crash the Watch companion while publishing context.
- **Visual/UI:** Watch face / companion, not the iPhone tabs.
- **Size:** S
- **Parallel:** Same module directory as item 2 (Ask service). Run separately. Independent of JS and CloudKit.

### 9. ★ Share-card modal is not an accessibility modal

- **Files:** `mobile/recorder/src/share-card-modal.tsx` (`ShareCardModal` ~215–256)
- **Why it matters:** Native sheets elsewhere set `accessibilityViewIsModal` (`native-sheet.tsx`, Memory flip). The share `Modal` does not. VoiceOver can reach the tab bar and Home content behind the full-screen dismiss `Pressable`. Primary “Share image” has a role but no explicit label when idle.
- **Visual/UI:** Yes
- **Size:** S
- **Parallel:** ★ one-PR if item 7 is not in flight. Isolated to this file.

### 10. Home profile editor modal traps VoiceOver poorly

- **Files:** `mobile/recorder/src/shell.tsx` (`CinematicHomeScreen` profile editor ~1885–1930)
- **Why it matters:** Backdrop `Pressable` has no `accessibilityLabel`. The tree is not `accessibilityViewIsModal`. Avatar / cancel / save rows are unlabeled `Pressable`s. Profile edit is a blocking overlay on Home.
- **Visual/UI:** Yes
- **Size:** S–M
- **Parallel:** `shell.tsx` also hosts items 6 (param line only), 17 (recording-mode picker), and cinematic Home actions. Pair 10 with 17 only if one owner takes the cinematic Home block. Do not combine with a wide `shell.tsx` rewrite.

### 11. V4 typography clips under Large Text instead of reflowing

- **Files:** `mobile/recorder/src/journeydeck-design-tokens.ts` (`journeyDeckTypography`), `mobile/recorder/src/redesign-ui.tsx` (`LargeTitle` ~96), `mobile/recorder/src/today-screen.tsx` (hero / card type)
- **Why it matters:** React Native `Text` still font-scales by default (`allowFontScaling` is never set). The real gap is locked `lineHeight`, `numberOfLines={1}`, and `adjustsFontSizeToFit` on titles, plus iPad grids that react to `fontScale` while hero copy stays one line. Larger Text users get truncated Home / Today titles. `mobile/recorder/AGENTS.md` lists Dynamic Type as an iPad acceptance surface.
- **Visual/UI:** Yes
- **Size:** L (token + layout pass; not one screen)
- **Parallel:** Cross-cutting. Do not start this in parallel with Today (item 16), Timeline (item 12), or other V4 screen a11y work that restyles the same files.

### 12. Timeline day rail has no button, label, or selected state

- **Files:** `mobile/recorder/src/primary-sections.tsx` (`TimelineScreen` ~774–781)
- **Why it matters:** The horizontal day chips are the main Timeline navigation. They are bare `Pressable`s with no `accessibilityRole`, name, or `accessibilityState.selected`. VoiceOver users cannot tell which day is selected or that the chip changes the list.
- **Visual/UI:** Yes
- **Size:** M
- **Parallel:** `primary-sections.tsx` also hosts the internal Profile Test Lab (item 19) and Data Health copy (item 14 UI). Chip semantics can ship alone if the diff stays in `TimelineScreen`. Independent of native, store, and share-card.

### 13. Home Screen widget “Start a Journey” only auto-starts the V4 accessory recorder

- **Files:** `mobile/recorder/App.tsx` (`RecorderScreen` effect ~614–623), `mobile/recorder/src/start-journey-link.ts`, `mobile/recorder/app/start-journey.tsx`
- **Why it matters:** The deep link sets `requestStartJourney()` and routes Home, but auto-`start()` runs only when `presentation` is `accessory` or `accessory-inline`. Other layouts consume the request, open a sheet, and may not start recording. Users tap the widget twice or think recording is broken.
- **Visual/UI:** Yes — widget → Home / recorder.
- **Size:** M
- **Parallel:** Same `App.tsx` as item 5. Do not run together. Helper (`start-journey-link.ts`) is otherwise free.

### 14. Data Health `pendingSyncCount` counts dormant legacy rows

- **Files:** `mobile/recorder/src/local-store.ts` (~2254–2261), `mobile/recorder/src/primary-sections.tsx` (Data Health), `mobile/recorder/docs/reliability-data-sync-2026-09-07.md` (~34–35)
- **Why it matters:** The diagnostic includes unsynced Collections / Memory / photo rows that the CloudKit engine may treat as dormant. Large legacy libraries show “Needs a look” / inflated pending counts. Documented as a follow-up; not a crash, but it trains users to ignore sync status.
- **Visual/UI:** Yes — Settings / Data Health.
- **Size:** M
- **Parallel:** Conflicts with item 1 (`local-store.ts`) and loosely with item 12 (`primary-sections.tsx` if both edit that file). Independent of recording and share-card.

### 15. Theme water transition `afterPaint().then` has no `.catch`

- **Files:** `mobile/recorder/src/theme-water-transition.tsx` (~162–165, ~239–243)
- **Why it matters:** A rejected `afterPaint()` is an unhandled promise. Theme commit / overlay ready may never run, leaving a stuck water overlay after a theme tap (especially with Reduce Motion / backgrounding).
- **Visual/UI:** Yes — theme picker / Settings.
- **Size:** S
- **Parallel:** This file only. Independent of all ranked items except a later Aurora Glass visual pass (item 21).

### 16. Today “This week” bars are hidden from VoiceOver

- **Files:** `mobile/recorder/src/today-screen.tsx` (`WeekCard` ~263–287)
- **Why it matters:** The card label summarizes weekly miles, but `accessible={false}` on the bar row hides per-day values. Sighted users see seven bars; VoiceOver does not hear Monday–Sunday mileage. Reorder chevrons in the same file are 34×34 (`editorArrow`), under the 44pt HIG minimum.
- **Visual/UI:** Yes
- **Size:** M
- **Parallel:** Conflicts with the Dynamic Type pass (item 11) if both restyle Today. Independent of Timeline, share-card, and native.

### 17. Recording-mode picker tabs and dots lack selected-state semantics; CTA copy is wrong

- **Files:** `mobile/recorder/src/shell.tsx` (`RecordingModePicker` ~1311–1358)
- **Why it matters:** First-run mode choice uses unlabeled tab `Pressable`s and color-only page dots. The primary CTA always reads “Use Manual Recording” even when Automatic is selected — easy to enable the wrong mode.
- **Visual/UI:** Yes
- **Size:** M
- **Parallel:** Same `shell.tsx` as item 10. Combine only as one Home/onboarding a11y PR. Independent of store and native.

### 18. Journey Marker private iCloud upload/restore is still unverified on devices

- **Files:** `mobile/recorder/docs/journey-markers.md`, `mobile/recorder/src/cloudkit-sync.ts` (marker ingest ~559+), `mobile/recorder/modules/journeydeck-cloudkit/`
- **Why it matters:** Production CloudKit types exist and `markerPrototype` is on for modern builds, but docs still say a physical-device marker + photo backup/restore is **unverified**. That is a shipped-feature data-loss risk, not a missing screen.
- **Visual/UI:** Yes — marker capture / library / sync.
- **Size:** M (device matrix; little or no code if it already works)
- **Parallel:** Device work. Do not change CloudKit ingest in the same window as item 1. Independent of UI a11y items.

### 19. Internal Profile Test Lab is still in shipping internal Settings

- **Files:** `mobile/recorder/src/primary-sections.tsx` (~1125–1142), `mobile/recorder/src/internal-testing.ts`, `mobile/recorder/src/auth.ts`
- **Why it matters:** UI copy says the lab stays “until this temporary lab is removed.” Gated by `EXPO_PUBLIC_JOURNEYDECK_INTERNAL_TESTING`, but it still ships in internal builds: isolation profiles and paused iCloud. Accidental use looks like data loss.
- **Visual/UI:** Yes — Tools / More.
- **Size:** S (remove or tighten the gate)
- **Parallel:** Same `primary-sections.tsx` as items 12 and 14. Independent if the diff stays in the lab block.

### 20. Ask / Siri physical-device acceptance was never run

- **Files:** `mobile/recorder/docs/ask-journeydeck-prototype.md` (~86–107), `mobile/recorder/docs/siri-ai-v3.md` (~93–104)
- **Why it matters:** Docs list required hardware cases (weekly miles, top artist, follow-ups, lock, profile switch, VoiceOver) as **Not run**. A reported in-app vs Siri answer mismatch is unconfirmed. Automated SQL tests are not device proof. Highest leftover “TODO” in the docs, with no source `TODO` comment.
- **Visual/UI:** Yes — Ask sheet, Siri snippets, widget entry.
- **Size:** L (signed native build + hardware)
- **Parallel:** Device-only. Do not mix with item 2’s WAL architecture change in the same TestFlight. Independent of JS a11y PRs.

### 21. Aurora Glass device-review gaps (blur cost, iPad backdrop, mint accents)

- **Files:** `mobile/recorder/docs/v4-aurora-glass-theme-brief.md` (~70–89), theme modules under `mobile/recorder/src/theme-*.tsx`
- **Why it matters:** The V4 Plus theme shipped; the brief still lists open device questions (Home scroll blur, iPad scenic backdrop, semantic mint on Home kickers). Performance and Reduce Transparency matter on older phones.
- **Visual/UI:** Yes
- **Size:** M
- **Parallel:** Conflicts with item 15 if both edit water/theme files. Independent of recording and CloudKit.

### 22. `app.json` is stale; root `app.json` is empty

- **Files:** `mobile/recorder/app.json` (`runtimeVersion` `1.9.0-build13`, `supportsTablet: false`, Expo Updates `u.expo.dev`), `mobile/recorder/app.config.js` (authoritative: `4.0.0-preview.3` / tablet / `ota.journeydeck.me`), `/workspace/app.json` (`{ "expo": {} }`)
- **Why it matters:** `AGENTS.md` says `app.config.js` wins. Anyone (or a tool) that reads `app.json` or runs Expo from the repo root gets the wrong runtime, tablet flag, scheme, and plugins. A mismatched OTA on a native build can call missing native methods and throw.
- **Visual/UI:** No (build / update foot-gun).
- **Size:** S (align or clearly deprecate `app.json`; document that the root file is not the mobile app)
- **Parallel:** Config/docs only. Independent of runtime PRs. Do not treat this as an OTA or EAS publish.

### 23. Drive titles and relative dates are hardcoded English

- **Files:** `mobile/recorder/src/redesign-model.ts` (`WEEKDAYS`, `MONTHS`, `driveTitle`, relative labels)
- **Why it matters:** “Friday evening drive” / “yesterday” ignore the system locale. Share cards already use `toLocaleDateString`. Inconsistent for any non-English iPhone.
- **Visual/UI:** Yes
- **Size:** M
- **Parallel:** `redesign-model.ts` feeds Today / Soundtrack / Memories. Independent of native and share-card a11y (item 9). Do not combine with the Dynamic Type token pass (item 11) unless one owner takes both.

### 24. Music observation sync still has no durable revision (V3-07)

- **Files:** `mobile/recorder/docs/reliability-data-sync-2026-09-07.md` (~38–39), `mobile/recorder/src/cloudkit-sync.ts`
- **Why it matters:** Concurrent music edits on two devices can stay pending instead of converging. Documented as deferred schema work. Multi-device libraries can disagree without a visible conflict UI.
- **Visual/UI:** Partial (Data Health / soundtrack artwork).
- **Size:** L (additive migration + engine + two-device matrix)
- **Parallel:** Conflicts with item 1 if both edit `cloudkit-sync.ts`. Otherwise its own track. Feature-complete policy: treat as emergency/data-correctness only, not a redesign.

### 25. Expo SDK 58 beta peer and TypeScript bridges remain

- **Files:** `mobile/recorder/AGENTS.md`, `mobile/recorder/.npmrc`, `mobile/recorder/tsconfig.json`, `mobile/recorder/plugins/with-even-native-tabs.js`
- **Why it matters:** Prerelease `legacy-peer-deps` and `react-native-legacy-deep-imports` are explicit debt. The tab-spacing plugin fails closed on React Native Screens upgrades. Not a user-facing bug today; it is the upgrade tripwire for the next native SDK.
- **Visual/UI:** Only if a Screens upgrade breaks tab spacing.
- **Size:** M (coordinated dependency bump — not a drive-by)
- **Parallel:** Do not mix with product fixes. Independent file set.

---

## Parallel map (no shared files)

Safe concurrent tracks if each PR stays inside its file set:

| Track | Items | Files to own |
| --- | --- | --- |
| A. Place parse | 1 ★ | `private-place-record.ts`, `local-store.ts`, `cloudkit-sync.ts` |
| B. CloudKit URL | 3 ★ | `JourneyDeckCloudKitModule.swift` |
| C. Location task | 4 ★ | `location-task.ts` |
| D. Share-card a11y | 9 ★ | `share-card-modal.tsx` (not item 7) |
| E. Error boundary | 5 ★ | `App.tsx` + new boundary file (not item 13) |
| F. Theme water catch | 15 | `theme-water-transition.tsx` |
| G. Watch unwrap | 8 | `JourneyDeckWatchBridge.swift` (not item 2) |
| H. Today week a11y | 16 | `today-screen.tsx` (not item 11) |
| I. Locale titles | 23 | `redesign-model.ts` |
| J. Config drift | 22 | `app.json` files / docs only |

**Do not parallelize inside one file:** 1+14 (`local-store.ts`); 2+8 (recorder native module); 5+13 (`App.tsx`); 7+9 (`share-card-modal.tsx`); 10+17 (`shell.tsx`); 11+16 (Today typography); 12+14+19 (`primary-sections.tsx`).

---

## Notes that are not backlog items

- **No `TODO`/`FIXME` in mobile source.** Item 20 is the closest leftover “TODO” (docs: physical-device acceptance not run).
- **Cinematic Roadbook / token consolidation** (`mobile/recorder/docs/ui-redesign-audit.md`) is an approved design direction with no runtime work. The owner declared the app feature-complete; it is not ranked as a defect.
- **V4 weekly StoreKit product / RevenueCat dashboard** (`mobile/recorder/SUBSCRIPTION_SETUP.md`) is App Store Connect work, not an iOS client bug.
- **Root empty `app.json`** is listed in item 22. Do not invent a second Expo app at the repo root.
- Render and website deploy config were not reviewed and must not be changed for this backlog.

---

## Suggested first week

Ship the five ★ one-PR items (1, 3, 4, 9, 5). They cover crash, data loss, VoiceOver, and a white-screen net. Leave Ask WAL (2), Dynamic Type (11), and device acceptance (18, 20) for a later authorized native/device pass.
