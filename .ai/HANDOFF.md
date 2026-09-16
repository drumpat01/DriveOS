# Current AI Handoff

Last updated: September 16, 2026

## Current objective

Reduce recurring agent token and tool usage caused by oversized handoff history, overlapping skills, and overly broad validation instructions.

## Repository state

- Active branch: `codex/journeydeck-v2`.
- JourneyDeck V2 remains complete and frozen. Only urgent customer-reported runtime fixes belong on the V2 line; new product work belongs on a separate V3 branch.
- This task changes agent documentation and local Codex plugin/skill configuration only. It does not change application runtime behavior.
- The user authorized committing and pushing all instruction-cleanup changes. No application deployment, Expo/EAS build, OTA, or App Review action was requested.

## Material changes in progress

- Archived the former chronological handoff as `.ai/archive/HANDOFF-through-2026-09-15.md` and replaced it with this current-state file.
- Tightened root `AGENTS.md` so archives and unrelated documentation are not preloaded, the active handoff remains bounded, and handoff updates occur only after material changes.
- Reworked `mobile/recorder/AGENTS.md` so ordinary work uses targeted checks and full suites or iOS exports are reserved for relevant release/native work.
- Uninstalled the global Zoom plugin because it was unrelated to this repository.
- Moved six duplicated personal Cloudflare skills to the recoverable folder `C:/Users/patri/.agents/skills-disabled/cloudflare-duplicates-2026-09-16/`; the maintained Cloudflare plugin versions remain active.

## Verification

- Active handoff verified at 2,269 bytes and 38 lines, below the 20 KB and 150-line limits.
- Historical archive verified intact at 947,317 bytes and 5,214 lines.
- All six duplicated personal Cloudflare skill directories are absent from the active skills root and present in the recoverable disabled folder.
- Zoom plugin removal returned `uninstalled`.
- `git diff --check` passed with line-ending notices only; no whitespace errors were reported.
- The staged change set contains only the intended agent-documentation changes and the new handoff archive.

## Next steps

1. Commit the staged documentation cleanup.
2. Push `codex/journeydeck-v2` to `origin`.

## Historical context

The full pre-cleanup chronology is preserved in `.ai/archive/HANDOFF-through-2026-09-15.md`. Consult it only for a specific historical question; do not load it during normal session startup.
