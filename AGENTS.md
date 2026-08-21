# JourneyDeck - AI Agent Instructions

All AI coding assistants (Codex, Claude, Gemini, etc.) working in this repository must follow these rules:

1. **Read `GEMINI.md` First**: Read the root `GEMINI.md` before modifying any code. It is the authoritative repository-wide developer handbook and rules of engagement.
2. **Consult Subsystem Instructions**: If working within a specific subsystem that contains its own `AGENTS.md` (such as `mobile/recorder/AGENTS.md`) or documentation in `docs/`, read and follow those instructions in addition to `GEMINI.md`.
3. **Inspect Before Changing**: Always inspect `git status` and recent commit history before making changes.
4. **Follow Core Invariants**: Strictly adhere to the security, privacy, environment-isolation (desktop vs. mobile), local-first persistence, testing, and Git-safety rules detailed in `GEMINI.md`.
