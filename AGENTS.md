# JourneyDeck - AI Agent Instructions

These rules apply to AI coding assistants working in this repository.

1. **Read `GEMINI.md` before modifying code.** It is the authoritative repository-wide engineering handbook. For read-only questions, inspect only the material needed to answer accurately.
2. **Read only relevant subsystem guidance.** When changing a subsystem, consult its nearest `AGENTS.md` and the specific documentation needed for the task. Do not preload unrelated documentation.
3. **Inspect before changing.** Before edits, run `git status` and `git log -5 --oneline`, then inspect the relevant implementation.
4. **Follow the core invariants in `GEMINI.md`.** Preserve security, privacy, environment isolation, local-first persistence, targeted testing, and safe Git behavior.

## Shared AI handoff protocol

- At session start, read `.ai/HANDOFF.md`, which must contain current state only. Do not automatically read files under `.ai/archive/`.
- Keep `.ai/HANDOFF.md` under 150 lines and 20 KB. Rewrite or remove stale entries instead of appending a chronological journal.
- Update the handoff only after a material repository or environment change, when unresolved work must pass to another agent, or when the user explicitly requests a handoff. Do not update it for read-only questions, audits with no changes, or no-op sessions.
- Record only the current objective, material changes, active branch/tree state, verification, unresolved issues, and exact next steps.
- The repository is authoritative. Verify handoff claims with `git status`, `git diff --stat`, recent history, and path-scoped diffs. Read a full `git diff` only when the task genuinely requires it.
- If runtime-reported remaining context falls below 5%, warn the user and refresh the concise handoff before continuing.
- Handoff work never authorizes staging, committing, pushing, reverting, discarding, deploying, or releasing.

## Git command normalization

- Run Git commands individually rather than chaining them with `;`, `&&`, or shell pipelines.
- Prefer stable commands such as `git status`, `git log -5 --oneline`, `git diff --stat`, `git diff -- <relevant-paths>`, and `git diff --check`.
- Stage only explicit user-approved paths. Do not commit, push, deploy, reset, discard changes, or rewrite history unless the user requests it.
