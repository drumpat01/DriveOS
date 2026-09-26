# Siri AI in JourneyDeck V3

Implementation contract, updated September 26, 2026 for planner revision 5 in Build 40.
The EAS archive compiled; physical iPhone acceptance is still required before behavior claims.

## Architecture

The existing authenticated Ask service remains the sole read-only native archive reader.
Siri and the in-app conversation share this service. Apple's on-device Foundation
Models guided generation proposes a versioned query plan when available. Supported
local rules and validated period follow-ups remain available when the model is not ready.
The model sees the question and authorized prior query context, never archive rows,
private labels, notes, photographs, audio, SQL, credentials, or record identifiers.
The query executor validates the plan, calculates facts, and formats the entire answer.
There is no generated answer prose or automatic cloud fallback. Siri's own processing
is controlled by Apple and the person's settings; this is not a promise that Siri is offline.

## Initial query coverage

| Domain | Supported facts and operations | Meaning |
| --- | --- | --- |
| Journeys | count, total/average miles and minutes, earliest/latest, largest/smallest, date grouping, period comparison | Completed saved journeys; time filters use start time |
| Music | play count, artist/track/album filters and rankings, linked journey lookup | Repeat recorded plays count; not all real-world listening |
| Memories | created count, earliest/latest, photo counts, linked journey lookup | Creation time is distinct from the dates of included journeys |
| Markers | saved count, photo counts, earliest/latest, linked journey lookup | Only visible completed-journey segments; no voice-memo, notes or transcript search |
| Places | recorded arrival counts and rankings; named geocoded-place matching | Recorded endpoints, not continuous visits or inferred cities |
| Follow-ups | reuse period, filters, or a bounded previous selection | Siri context lasts five minutes; in-app context lasts for the process. Both invalidate on profile/lock changes. |

Date ranges use the device's calendar/time zone, Monday-start weeks, and exclusive
end boundaries. Night means a journey beginning before 06:00 or at/after 18:00;
it does not mean astronomical sunset or time spent driving in darkness. Explicit
requests exceeding accessible history are refused, never silently truncated.
No recorded evidence, unsupported filters, ambiguous questions, route intersections,
photo recognition, note/transcript semantics, and unrecorded visits must be distinguished.
Start, Stop and Create Marker retain their explicit App Intents; the query planner is read-only.
All Siri features remain free without a membership gate. Say “Ask JourneyDeck”; Siri
requests the question and speaks its answer without opening the app. Revision 5
preserves distinct clarification, unsupported-request, invalid-plan and model-unavailable
reasons instead of replacing every non-answer with `Beep Boop. Can not compute.` The in-app themed conversation
keeps its bubbles in memory across sheet dismissal and backgrounding until the process ends.

## Privacy and future entity indexing

This first build opens supporting records through authenticated answer tickets.
Spotlight donation and iOS 27 search/open schemas are a subsequent integration,
not an active capability in this implementation. The intended policy is opt-in
indexing with generic date-based labels, dates, distances, durations,
and attachment counts. Names, notes, photos, transcripts, music metadata and locations
are not donated to Spotlight. Live entity resolution rechecks profile, lock and access.
Index lifetime is separate from answer tickets; disable, deletion, profile changes and
reindexing must remove stale entries. Use custom App Entities where no Apple schema fits.
Search/open schema adoption requires actual SDK validation; protocol conformance alone
does not prove arbitrary Siri phrasing works. Keep index testing distinct from model testing.

## Evaluation and build

The internal testing screen runs synthetic fixtures through the same native planner and
executor used by Siri; expected plans and numeric results are graded independently.
It reports unavailable, failed and cancelled evaluations separately. No synthetic records
are inserted into the user's archive. Questions/results stay in memory and clear on exit.
Real archive questions remain in the normal Ask screen with authenticated evidence links.

First physical-device sample (September 18, 2026, planner revision 1): Apple Intelligence
available, 2/13 passed, 11/13 failed, 4.3 seconds average; first case 6.5 seconds.
The two passes were unsupported requests. Nine supported questions reported an
unsupported decision; two reported invalid plans. Most refusal results otherwise
matched the expected fields. The screenshots do not include the raw invalid plans.

Revision 2 clarifies that decision `answer` authorizes execution by the archive engine,
not generation of a factual result by the model. It removes the conflicting "Never
answer it" instruction and generates the decision after the query fields. Metric,
ranking-limit and unused-field guidance is more explicit. Synthetic failures retain
the proposed/expected plans and validator reason, shown only in internal testing.
The strict executor still refuses unsupported or invalid plans. Revision 2 requires
a native rebuild and a fresh physical-device sample; local fixture passes do not
establish that the model interpretation has improved.

Revision 2 physical-device sample remained 2/13 with a 5.4 second average. Its new
diagnostics showed that the model generally extracted the correct domain, operation,
metric, period and filters, but filled constrained fields that were irrelevant to the
selected operation and classified supported queries as unsupported. Examples included
days=7 with thisWeek, date fields on an available-history query, comparePeriod on a
total, songPlays instead of count for the music domain, and limit=5 for a single top
artist. This evidence supersedes the initial prompt-only diagnosis.

Revision 3 treats model output as a proposal. A deterministic boundary canonicalizes
only fields whose applicability follows from another selected field, such as clearing
dates outside date/between and comparePeriod outside compare. It accepts a supported
proposal only when independent question cues agree with its domain, operation and
metric. Explicit writes, note/transcript or photo-content searches, vehicle data,
route-crossing/exclusion conditions, and ambiguous superlatives remain refused. Tests
replay all 13 observed device proposals and inject equivalent filler noise across all
100 phrasings, including refusal cases. Physical-device validation remains required.

Revision 4 addresses a reported mismatch after Build 39: the in-app Ask chat showed
AJR with 49 recorded plays for an all-history top-artist question while Siri said
Olivia Rodrigo. The source of Siri's spoken answer is not yet confirmed. Standalone
questions no longer receive an earlier Siri ticket as model context, and the common
unqualified top-artist phrasings use a fixed local ranking plan on both surfaces.
The model boundary also removes time ranges, artist filters, and previous-selection
constraints that were not stated in the question. These changes are native bundle
resources and require a build after 39; physical-device comparison is still needed.
Invoke the JourneyDeck App Shortcut explicitly, then give Siri the same question as
the in-app chat, to confirm Siri routes the request to JourneyDeck.

### Revision 5: interpretation and validation have separate responsibilities

The longest-journey failure exposed a contradiction introduced by revision 3:
the model was instructed that an unqualified longest journey means miles, while
the validator required literal mileage/distance words. The older local matcher
also accepted "what was" but rejected "what is". The error presenter hid whether
failure came from interpretation, validation, or archive access. Earlier evaluation
phrases almost always named the units and tested prepared proposals; they did not
establish successful interpretation of the user's wording by the device model.

Revision 5 removes the domain/operation/metric vocabulary gate. Model proposals
still undergo schema, enum, metric/domain, limit, filter, date, read-only and privacy
validation. Unsupported capabilities remain blocked; a model's refusal is preserved,
not promoted solely because its words overlap an accepted vocabulary.

Chat sends the original question. Chat and Siri call the same `resolvePlan` entry point:
complete deterministic local questions and validated follow-ups produce structured
plans; other phrasings use the on-device model. The existing offline grammar is
translated into the same plan contract and executor, rather than independently
calculating a different answer. A complete known query can work when the model is
busy or incorrectly refuses it; partial keyword matches cannot override a refusal.
Longest defaults to distance, explicit duration selects minutes, and answers state
the basis. Refusals require no archive snapshot. Profile and lock checks surround
inference and execution, and no model prose, query text, or records are logged.

The shipped synthetic suite now includes both exact screenshot questions and an
ordinary synonym without literal schema words. Local tests cover original wording
through the chat bridge, semantic proposals through the resolver/executor, offline
periods/follow-ups, refusal reasons, and all 100 golden queries. Model replies are
fixtures in these tests; they do not prove live Foundation Models behavior. This
revision changes Swift and bundled resources, requires a native build, and must be
checked on an iPhone in both Ask and the explicit Siri shortcut before release claims.

Windows runs deterministic SQLite/engine, bridge, UI, privacy, and regression checks.
Build 39 uses the authorized EAS `v3-testflight` profile with the live bundle
`com.journeydeck.recorder`, schema 11, and runtime `3.0.0-preview.7`. The older GitHub
ad hoc workflow is a separate preview path. Signing credentials remain outside source.
Native code, entity/schema declarations and bundled native resources require rebuilding;
React Native UI and supported JavaScript behavior can use compatible OTA updates.

Device acceptance: model availability, golden questions, cold/warm latency, Siri invocation,
follow-ups, Spotlight search/open/remove, lock during inference, A→B→A profile changes,
deletion, airplane mode, model-disabled fallback, active recording, VoiceOver, iPad and
large text. Existing V2 is frozen. No claim of perfect interpretation or fixed latency.
