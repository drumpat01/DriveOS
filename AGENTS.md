# JourneyDeck - AI Agent Instructions

All AI coding assistants (Codex, Claude, Gemini, etc.) working in this repository must follow these rules:

1. **Read `GEMINI.md` First**: Read the root `GEMINI.md` before modifying any code. It is the authoritative repository-wide developer handbook and rules of engagement.
2. **Consult Subsystem Instructions**: If working within a specific subsystem that contains its own `AGENTS.md` (such as `mobile/recorder/AGENTS.md`) or documentation in `docs/`, read and follow those instructions in addition to `GEMINI.md`.
3. **Inspect Before Changing**: Always inspect `git status` and recent commit history before making changes.
4. **Follow Core Invariants**: Strictly adhere to the security, privacy, environment-isolation (desktop vs. mobile), local-first persistence, testing, and Git-safety rules detailed in `GEMINI.md`.
5. **Shared AI Handoff Protocol (`.ai/HANDOFF.md`)**:
   - **On Session Start**: Check `.ai/HANDOFF.md` for context on recent changes, environment state, and pending work left by previous agents or sessions.
   - **On Session End / Milestone**: Update `.ai/HANDOFF.md` with:
     - **Summary of Changes**: What was implemented, modified, or cleaned up.
     - **Current Environment & Verification**: Active branch, test results, running processes, or environment state.
     - **Next Steps & Pending Items**: Actionable next tasks or open questions for the next agent.
   - **Repository State Is Authoritative**: Verify the handoff against `git status`, `git diff --stat`, `git diff`, and recent commit history. If `.ai/HANDOFF.md` conflicts with the actual working tree, trust the repository state.
   - **Token Fallback / Agent Switching**: When asked to prepare a handoff, token fallback, or agent switch, update `.ai/HANDOFF.md` with the current objective, completed work, changed files, unresolved issues, verification performed, and exact next steps.
   - **Low-Context Automatic Handoff**: If an agent detects critically low remaining context window capacity (using 5% remaining as the threshold when exposed by the runtime), it must proactively warn the user and update `.ai/HANDOFF.md` before continuing.
   - **Do Not Force Git Actions for Handoff**: Do not stage, commit, push, revert, or discard work merely to create a handoff unless explicitly instructed.
   - **Continue Existing Work**: A receiving agent should continue from the current working tree rather than reimplementing work already completed by another agent.
   - Keep handoff notes concise, factual, and up to date.
