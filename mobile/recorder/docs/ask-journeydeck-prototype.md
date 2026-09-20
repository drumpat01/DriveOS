# Ask JourneyDeck — focused V3 prototype

Status: source implementation, September 16, 2026. No build, prebuild, export, OTA, or device run was performed. Swift compilation, Siri discovery/speech/snippets, and physical-device acceptance below are **not verified**. Do not mark roadmap V3-10 complete.

## Entry points and scope

- The optional **Ask JourneyDeck** Home widget appears in both V3 compact and regular layouts after the four metric cards by default. It shares the existing reorder/resize/hide editor. Recording stays outside the grid; no tab is added.
- Tapping it opens a native question sheet with free text, example questions, a result, short-lived follow-up context, supporting Journey/Memory links, and Done. Existing themes, including Grand Touring, supply the colors.
- The app-target `AskJourneyDeckIntent` takes a String question and returns a String result plus `IntentDialog` for Siri. Invoke the app shortcut with “Ask JourneyDeck V3,” then give the question when prompted. The interactive answer snippet offers an optional supporting-details link; answering alone does not foreground the app.
- The Siri prototype uses iOS 26+ interactive snippets (annotated availability); the planned acceptance device is a supported iOS 27 iPhone. No claim is made that arbitrary questions automatically route to this action or that Siri will preserve an entire open-ended conversation.
- This is deterministic English question handling, **not an LLM**. No Foundation Models, external inference service, entity indexing, App Schema adoption, connected-vehicle questions, or on-screen semantic context is implemented here.

Apple's [App Intent response guidance](https://developer.apple.com/documentation/appintents/creating-your-first-app-intent) and [snippet lifecycle guidance](https://developer.apple.com/documentation/appintents/displaying-static-and-interactive-snippets) inform the Siri integration. The system controls whether and how it presents dialog/snippets, so those behaviors remain device acceptance gates.

## Supported question contract

| Topic | Example | Meaning |
| --- | --- | --- |
| Distance | How many miles did I drive this week? | Sum saved completed journeys whose **start** is in the period; round once to one decimal. |
| Count | How many journeys did I record this month? | Count completed saved journeys by start date. |
| Dates / journeys | When was my last journey? / When was my first journey? / What was my longest journey? | Date and miles; longest means distance, not duration. |
| Memories | How many Memories did I create this month? / When was my last Memory? | Creation date, not dates of contained journeys; exclude deleted Memories. |
| Music | How many songs did I listen to this month? / What was my top artist this month? / What was my top song this week? | Recorded plays linked to same-owner completed journeys; repeat plays count. Ties are disclosed. Unknown/unrecorded listening cannot be inferred. |
| Follow-up | And how many journeys was that? | Reuse the previous successful answer's period. |
| Changed period | What about last week? | Reuse the previous successful answer's metric. |

Ranges: today, yesterday, this/last week, this/last month, this/last year, last/past N days (1–999), on YYYY-MM-DD, all time, in total. Device-local calendar boundaries, Monday-start weeks, half-open intervals; N days means elapsed 24-hour periods. No range means the currently accessible local history. Invalid dates, unsupported filters, multiple questions, and expired/missing follow-up context request clarification; they never silently drop a condition.

The prototype respects a 45-day free history window. Only verified, current StoreKit membership products permit older history; the V3 Atlas preview flag and editable membership caches do not. An explicit range spanning unavailable history is refused instead of reporting a truncated total. As a conservative native prototype, it does not separately infer RevenueCat promotional access.

## Native data boundary

1. Both the Expo bridge and app-target intent call `JourneyDeckAskService` in the existing recorder module.
2. The service opens the existing Documents/SQLite/journeydeck-local.db **read-only**, checks its application ID and schema 7, and never creates, migrates, or writes it. This short-lived native reader is intentional; `database-owner.ts` remains the sole Expo connection/writer owner.
3. `AskResources/ask-queries.json` is the complete SQL allowlist. Bound active-user IDs and date cutoffs constrain every dataset. A read transaction provides a consistent snapshot. No SQL comes from a question.
4. Selected data includes IDs, times, distance/duration, music metadata, and private saved-place labels used only for redaction. It excludes coordinates, routes, addresses, place associations, Memory names/notes/photos, credentials, Apple identity, and unrelated preferences. The JS-facing bridge returns only the answer, safe evidence, profile ID, and opaque tickets—not archive rows.
5. The bundled `ask-engine.js` runs unchanged in JavaScriptCore and the Node tests. Questions are function arguments, never evaluated as source. There are no model/network requests or question logs.
6. Reads are capped at 20,000 rows per dataset, 1 KB per selected text cell, and 8 MB of strings per query. Oversized/invalid archives produce an unavailable answer, not partial totals. SQLite has a one-second busy timeout; a read failure asks the person to open the app/retry rather than touching database recovery.

No App Group, replica, private-record file export, or database schema migration is added. Existing `local_preferences` stores only device-local `ask_profile_epoch` and `ask_profile_blocked` control values. They do not sync to iCloud.

## Privacy and lifecycle policies

- **Profile isolation:** query the canonical active user in SQLite, not a caller-selected identity. Recheck user and epoch after reading and on return to the main actor. Block reads while switching, signing out, or deleting. Epochs rotate on actual changes (including A → B → A and same-profile authentication); unchanged bootstrap retains the epoch so background Siri details can open. The Expo wrapper checks the active profile before/after native work and validates answer ownership.
- **Sensitive locations:** do not fetch or speak location fields or user-written Journey/Memory titles. Music output also conservatively redacts saved private-place labels, common street-address patterns, decimal coordinates, URLs, email-like strings, and control characters. This is defense in depth over the field allowlist, not a general-purpose text anonymizer.
- **Locked device:** both the question and snippet intents require [authentication on the local device](https://developer.apple.com/documentation/appintents/intentauthenticationpolicy/requireslocaldeviceauthentication). The service checks protected-data availability before/after work; its lock observer invalidates ticket/context state and in-flight lock generations. There is no Watch-authentication shortcut. Native enforcement must be verified while locking during execution and while a snippet is visible.
- **Question UI:** clears the field, answer and conversation on blur, profile change, or background/inactive state; pending results cannot repopulate the dismissed screen. It does not add app-wide screenshot protection. Inspect app-switcher snapshots during device acceptance.
- **Offline:** the archive query/answer path works without a JourneyDeck server or model. StoreKit reads current local entitlements without requesting products/restores. Siri recognition, availability, and Apple's question/response handling follow the person's Apple settings and may require connectivity. JourneyDeck itself does not persist questions.
- **Supporting details:** a UUID ticket in `journeydeck-v3://ask-journeydeck?ticket=…` contains no query, record ID, or user ID. Tickets and minimal conversation state live only in native memory, expire after five minutes, and fail closed after process death, profile change, or locking. Resolve recomputes the answer from live authorized rows; evidence taps resolve again before opening the existing detail route. Expired/deleted/mismatched records prompt a new question.
- **No silent changes:** all actions are read-only. The prototype cannot edit journeys, start recording, query a vehicle, or change a profile.

## Wiring and verification

`plugins/with-ask-journeydeck.js` copies the intent source into the **app target**, adds it to Sources exactly once, and links AppIntents during a future prebuild. The recorder pod packages the engine/query bundle and links JavaScriptCore/StoreKit. The plugin and Home flag are enabled only for `com.journeydeck.recorder.v3`; the native reader independently checks bundle identity and `JourneyDeckAskEnabled`. V2/production have no registered Ask shortcut or widget. Old installed runtimes display a native-preview-required message rather than inventing answers.

Targeted checks, not a native build:

```powershell
npm run typecheck
node --experimental-strip-types --test tests/ask-journeydeck.test.mts tests/ask-journeydeck-ui.test.mts tests/home-widget-layout.test.mts tests/home-grid-integration.test.mts tests/ipad-home.test.mts
node --experimental-strip-types --test tests/auth.test.mts tests/local-store.test.mts tests/database-startup.test.mts tests/native-runtime-prep.test.mts tests/profile-test-lab.test.mts tests/native-navigation.test.mts tests/public-release-integrity.test.mts
npm run test:tab-runtime
```

The engine tests execute the production SQL against a real in-memory SQLite database initialized through the app's migrations, then run the exact shipped engine. React tests cover question entry, duplicate suppression, follow-ups, error recovery, profile/background/blur invalidation, detail revalidation and unavailable runtimes. Native policy checks and Xcode project fixture tests are **source checks, not Swift compilation or device proof**.

## Physical-device acceptance — NOT RUN

Do not initiate a build without a new user instruction. After that authorization, use the isolated V3 internal build and registered device/CloudKit identity; no TestFlight is needed. The repository's existing Duo/toolchain prerequisites still apply.

Prepare two non-production local profiles and a written expected-results ledger from their saved records. In profile A, use two completed journeys in the current week (12.5 and 7.25 miles), one earlier this month outside the week, and two music plays by Example Artist versus one Other Artist. Dates must be eligible under the native history window. Put obviously different totals and private labels in profile B. Do not seed real private data into a shared fixture.

| Required case | Expected | Status |
| --- | --- | --- |
| How many miles did I drive this week? | A: 19.8 miles / 2 journeys. Spoken and typed results agree. | Not run |
| When was my last journey? | A: latest completed saved journey's date and miles, no title/location. | Not run |
| What was my top artist this month? | Example Artist, 2 recorded plays; correct supporting journeys. | Not run |
| After the first question: And how many journeys was that? | 2, using the exact same week. Test typed and repeated Siri action within five minutes. | Not run |
| Open supporting details | Optional snippet link opens the native prompt; Journey/Memory links open only current authorized records. | Not run |
| Background/cold launch and process death | Existing valid ticket resolves after unchanged bootstrap; terminated-process ticket expires safely. | Not run |
| A → B → A, sign-out, deletion during answer | No cross-profile text, evidence, or reused follow-up; stale tickets refused. | Not run |
| Lock before/during query and with visible snippet | Local unlock required, no protected answer replay; app-switcher snapshot inspected. | Not run |
| Airplane mode / Siri disabled | Typed local results remain available; no network/model fallback; Siri limitations reported honestly. | Not run |
| Redaction / missing / stale data | No sensitive location or title leakage; empty, unsupported and deleted-record states remain honest. | Not run |
| History limit and malformed/oversized archive | Clear refusal, no truncated or fabricated total; paid/free boundary checked. | Not run |
| Home customization / accessibility | Widget opens on phone/iPad, hide/reorder persists; VoiceOver, large text, keyboard, Done and sheet dismissal work. | Not run |

Record device model, iOS version, build identity, exact invocation, profile, expected/actual result, speech and snippet behavior, and redacted evidence for each row. Native compilation and all required physical-device cases remain blockers to calling this prototype validated.
