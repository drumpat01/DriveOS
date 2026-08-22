# JourneyDeck (formerly DriveOS) - AI Developer Handbook

> Quick reference and engineering rules for AI coding assistants working in the JourneyDeck repository.

---

## ⚡ Before You Change Code (Checklist)

1. [ ] **Inspect git status & branch**: Check modified files and recent commits before starting.
2. [ ] **Read subsystem docs**: Check for subsystem-specific `AGENTS.md` (e.g., `mobile/recorder/AGENTS.md`) or detailed guides in `docs/`.
3. [ ] **Respect scope boundaries**: If a task is desktop-only or mobile-only, do not touch the other environment.
4. [ ] **Preserve existing behavior**: Make targeted, minimal edits; avoid unrequested refactors or broad rewrites.
5. [ ] **Check privacy & security**: Never expose credentials, tokens, DPAPI keys, or unscrubbed coordinates.
6. [ ] **Run targeted tests first**: Execute the narrowest relevant test suite before broader validation.

---

## 1. Project Mission & Naming

- **JourneyDeck** (formerly **DriveOS**) is a single-user, local-first hybrid application and "Life OS" for vehicle telemetry, location intelligence, mobility patterns, and listening history.
- **Naming & Legacy Compatibility**: The codebase is transitioning from `DriveOS` to `JourneyDeck`. Do not blindly rename legacy `DriveOS` files, functions, variables, or routes unless explicitly instructed. Treat legacy naming as deliberate compatibility surface.

---

## 2. Repository & Runtime Architecture

The project is structured as a **modular monolith** with hybrid multi-target runtimes:

- **Desktop Host (`desktop/`)**: C# Windows host utilizing Microsoft Edge WebView2. Manages child process lifecycle, local security policies, and injects session headers.
- **Web Backend & Front Door (`server/`)**: Fastify Node.js service (TypeScript, Node >= 24). Serves static assets, auth, mobile recorder endpoints, and hosts the high-performance Atlas snapshot store. In hosted environments, it also proxies legacy endpoints to the internal PowerShell backend.
- **Domain Logic & Workers (`src/`, `tools/`)**: Modular PowerShell architecture (`Application`, `Domain`, `Integrations`, `Repositories`, `Security`, `Storage`) handling ingestion, migrations, and maintenance scripts.
- **Frontend Dashboard (`web/`)**: Modern Vanilla HTML/CSS/JavaScript SPA. Built with modular ES imports (`core/`, `components/`, `features/`) without heavy frontend frameworks.
- **Mobile Companion (`mobile/recorder/`)**: React Native / Expo iOS application for background GPS recording and direct sync.

📖 *Deep dive:* See `docs/ARCHITECTURE.md` and `README.md`.

---

## 3. Environment Differences

| Dimension | Desktop Host | Hosted Web (Render) | Mobile Companion |
| :--- | :--- | :--- | :--- |
| **Runtime** | Windows app + WebView2 | Docker container (`render.yaml`) | iOS React Native (Expo) |
| **Network / Host** | Binds to `127.0.0.1` | Public reverse proxy (Fastify -> PowerShell) | Connects to public API via HTTPS |
| **Authentication** | Process session header (`X-DriveOS-Session`) | Signed cookie session & Passkeys/WebAuthn | Bearer token (`JOURNEYDECK_RECORDER_TOKEN`) |
| **Role Support** | Single Owner | Owner (`mode=full`) vs. Wife (`role=wife`, restricted) | Single Owner ingest |
| **Secret Storage** | Windows DPAPI in local `data/` | Render environment variables | iOS Keychain |
| **Primary Data** | Local SQLite (`System.Data.SQLite`) | Ephemeral SQLite cache + Turso/libSQL cloud | On-device SQLite queue |

📖 *Deep dive:* See `docs/atlas-node-hybrid.md` and `mobile/recorder/README.md`.

---

## 4. Data & Persistence Rules

- **Dual-Stack Persistence**:
  - **Turso (libSQL)**: Authoritative cloud database for durable history.
  - **SQLite**: Local-first offline store for desktop, test fixtures, and high-performance Atlas snapshot caching.
- **Unified Migrations**: All schema updates must be additive SQL migration scripts in `src/Storage/Migrations/` (e.g., `0001_...sql` to `0008_...sql`), executed identically against Turso and SQLite.
- **Atlas Snapshot Engine**: Atlas reads from an immutable in-memory/SQLite snapshot. Mutations (labels, pattern reviews) persist to Turso first and trigger debounced snapshot rebuilds in a worker thread.
- **Offline-First Invariant**: The application must remain fully functional offline using local SQLite. Cloud sync must never be a hard blocking prerequisite for local UI operations.

📖 *Deep dive:* See `docs/JOURNEYDECK-DATABASE-ARCHITECTURE.md`.

---

## 5. Security, Privacy & Role Invariants

- **Secrets & Credentials**:
  - Never commit credentials or expose them to client-side code.
  - Desktop uses Windows DPAPI encryption in `data/` (`driveos-secrets.json`, etc.).
  - Hosted environments use environment variables.
- **Privacy Boundaries (Share Cards & Exports)**:
  - Precise home/work and sensitive location coordinates must be scrubbed using the existing privacy implementation before exporting or sharing.
  - Routes beginning or ending at sensitive locations synthesize safe public routes; never export raw home coordinates or street addresses.
- **Role Isolation & Wife Mode**:
  - `Full Mode` (Owner): Full administrative, configuration, and data management capabilities.
  - `Wife Mode`: Read-only view for journeys, music, and statistics. Blocks configuration, settings, administrative writes, and sensitive raw diagnostics.
- **XSS & Content Security**:
  - All dynamic or external text injected into the DOM must pass through existing HTML escaping/sanitization helpers.

📖 *Deep dive:* See `SECURITY.md`.

---

## 6. Integration Overview

- **Tessie**: Vehicle status, telemetry, charging sessions, and drive history. Ingested via background workers with bounded sync windows.
- **Spotify**: Primary active music service for listening history, playback SDK integration, and album artwork proxying (`/api/artwork`).
- **Last.fm**: Active synchronization has been removed; legacy historical compatibility and read paths remain supported.
- **Foursquare**: Place name enrichment for unnamed coordinates, subject to strict rate limits and caching rules.
- **OpenFreeMap / OpenStreetMap**: Self-hosted/embedded vector tiles for route and place maps (no API key required).

---

## 7. UI & Frontend Conventions

- **Aesthetic**: Follow the "Cinematic" dark theme design system.
- **Key Stylesheets**:
  - `web/beta-theme-v2.css`: Global theme, typography, CSS variables, and components.
  - `web/reference-dashboard.css`: Dashboard widget layout and cards.
  - `web/statistics-dashboard.css`: Statistics, charts, and insights.
  - `web/page-headers.css`: Unified page header styling.
  - `web/wife.css`: Wife Mode presentation styles.
- **Tech Stack**: Vanilla ES modules. Do not introduce frontend frameworks (React, Vue, Tailwind, etc.) into `web/` without explicit user instruction.

---

## 8. Testing & Validation Commands

Run narrow tests first, then broader suites as appropriate:

```powershell
# Server & TypeScript checks
npm run check:server          # Typecheck server without emitting
npm run lint:server           # ESLint server code
npm run test:server           # Run fast Node unit tests
npm run test:atlas-performance# Benchmark Atlas snapshot load/rebuild

# Comprehensive Node & E2E suite
npm test                      # Full Node test pipeline + Playwright + Security + PowerShell lint
npm run test:e2e              # Playwright smoke and visual tests

# PowerShell & Application checks
.\tools\Test-DriveOS.ps1           # Core PowerShell test suite
.\tools\Test-ReleasePreflight.ps1  # Full release validation suite
npm run check:powershell           # PSScriptAnalyzer validation
npm run check:secrets              # Gitleaks secret scan
```

📖 *More commands:* See `package.json` and `tools/`.

---

## 9. Deployment & Release Workflow

- **Release Script**: Use `Deploy-DriveOS.ps1` (`-PreflightOnly` or with `-CommitMessage`).
- **Git Flow**: Releases run preflight checks -> create a timestamped `deploy/*` branch -> verify staged files and secrets -> push branch and open a PR into `main`.
- **Render Deployment**: Render auto-deploys from `main` after checks pass. Docker container boots with `render-start.sh` and gates readiness on `/readyz`.

---

## 10. AI Development Rules

When assisting with code in this repository, you **must** adhere to these rules:

1. **Inspect Before Modifying**: Always check git status, recent history, and inspect existing implementation before making changes.
2. **Consult Subsystem Docs**: Read any subsystem-specific `AGENTS.md` (e.g. `mobile/recorder/AGENTS.md`) or relevant documentation in `docs/` before altering that subsystem.
3. **Preserve Existing Behavior**: Do not break or alter existing functional behavior unless the request explicitly requires it.
4. **Environment Isolation**:
   - If a request is **desktop-only**, do not alter mobile behavior or files unless technically unavoidable and explained first.
   - If a request is **mobile-only**, do not alter desktop behavior or files unless technically unavoidable and explained first.
5. **Targeted Changes**: Prefer minimal, focused edits over sweeping refactors or unnecessary rewrites.
6. **No Unauthorized Frameworks**: Do not introduce new frameworks, build tools, or architectural layers without explicit approval.
7. **Protect Secrets & Coordinates**: Never log, hard-code, or return credentials, tokens, DPAPI keys, or precise unscrubbed home/work coordinates.
8. **Preserve Local-First**: Cloud connectivity (Turso sync) must never be a hard requirement for the desktop/local application to function.
9. **Enforce Privacy & Roles**: Never bypass Wife Mode restrictions or Share Card privacy sanitization.
10. **Sanitize Untrusted Content**: Always use existing HTML escaping/sanitization helpers when rendering dynamic data in the UI.
11. **Run Narrow Tests First**: Validate changes using the most specific test suite before running broad test pipelines.
12. **Safe Git Hygiene**: Do not commit, push, deploy, reset, discard changes, rewrite history, or alter secrets unless explicitly directed.
13. **Respect Legacy Compatibility**: Never assume legacy `DriveOS` identifiers or files should be renamed; verify usage and preserve compatibility.
14. **Flag Discrepancies**: If existing documentation conflicts with executable code, flag the discrepancy to the user instead of silently guessing.
