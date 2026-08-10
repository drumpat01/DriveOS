# DriveOS Web Hosting Plan

Status: planning / non-breaking preparation  
Branch: `web-hosting-prep`

## Goal

Add a hosted, single-user DriveOS web edition that can run independently of the Windows desktop app and be accessed securely from any modern browser.

The existing desktop edition must continue to work unchanged unless a later migration explicitly says otherwise.

## Guiding rule

Do not weaken the current desktop security model to make web hosting work.

Desktop mode currently assumes:

- Windows + WebView2
- localhost binding
- desktop parent-process validation
- per-session local credential
- Windows DPAPI-protected credentials
- local runtime data
- optional authenticated Tailscale access

Web mode should be a separate runtime path with its own authentication, secret storage, networking, and persistence rules.

## Target architecture

### Desktop mode

- Browser host: WebView2
- Backend: current PowerShell backend
- Network: localhost / existing Tailscale behavior
- Secrets: Windows DPAPI
- Persistence: local `data` directory and SQLite repository
- Authentication: existing local session credential

### Web mode

- Browser host: normal HTTPS browser
- Backend: PowerShell 7-compatible hosted runtime initially
- Network: hosting platform assigned host/port behind managed TLS
- Secrets: hosting platform environment secrets + application encryption key
- Persistence: persistent mounted `data` directory using the existing SQLite repository where possible
- Authentication: owner-only web login using secure server sessions

## Initial hosting target

Render is the current preferred first deployment target because the planned DriveOS web runtime needs:

- Docker deployment from GitHub
- environment secrets
- managed HTTPS
- a platform-provided public port
- HTTP health checks
- a persistent disk for SQLite and runtime data

This choice can be revisited before production deployment.

## Web v1 scope

DriveOS Web v1 is intentionally single-user.

Included:

1. Owner login page
2. Secure authenticated session cookie
3. Existing DriveOS dashboard in a normal browser
4. Tessie integration
5. Spotify integration with a public HTTPS OAuth callback
6. Existing Last.fm and Foursquare integrations where portable
7. Persistent SQLite/runtime storage
8. Share-card browser download behavior
9. HTTPS deployment from GitHub
10. Health/readiness endpoint

Not included in v1:

- public account registration
- multiple users
- invitations
- organizations/roles
- billing
- horizontal scaling

## Required runtime split

Introduce an explicit runtime mode rather than inferring behavior from the OS.

Suggested environment value:

`DRIVEOS_MODE=desktop` or `DRIVEOS_MODE=web`

Desktop should remain the default until web mode is considered stable.

## Web configuration contract

Web mode should eventually understand values similar to:

- `DRIVEOS_MODE`
- `PORT`
- `DRIVEOS_DATA_DIR`
- `DRIVEOS_PUBLIC_URL`
- `DRIVEOS_OWNER_EMAIL`
- `DRIVEOS_PASSWORD_HASH`
- `DRIVEOS_AUTH_SECRET`
- `DRIVEOS_ENCRYPTION_KEY`
- `TESSIE_TOKEN`
- `SPOTIFY_CLIENT_ID`
- optional Last.fm / Foursquare values

No production secret value belongs in Git.

## Authentication design

Web mode should use a real server-authenticated session rather than exposing a bearer credential to frontend JavaScript.

Requirements:

- owner-only sign-in
- password stored only as a slow password hash
- secure random session identifiers
- `HttpOnly` cookie
- `Secure` cookie in production
- `SameSite=Lax` or stricter where compatible
- session expiry
- login throttling / lockout controls
- constant-time secret comparison where applicable
- CSRF protection for state-changing requests
- no public registration endpoint

## Spotify migration

Desktop Spotify authorization currently uses PKCE with a loopback callback.

Web mode should preserve PKCE and state validation but move the callback into the hosted application, for example:

`https://<driveos-host>/auth/spotify/callback`

The hosted runtime must not start a local browser process or a temporary localhost callback listener.

Spotify refresh tokens must not use Windows DPAPI in web mode. They should be encrypted at rest using a server-side encryption key and written only to persistent storage, or stored using an equivalent secure server-side mechanism.

## Persistence

The existing repository abstraction and SQLite implementation should be reused before considering a database rewrite.

Suggested web runtime layout:

- application code: read-only / ephemeral container filesystem
- `DRIVEOS_DATA_DIR=/app/data`
- persistent disk mounted at `DRIVEOS_DATA_DIR`

All writable runtime artifacts should be routed through the configurable data directory instead of assuming `$PSScriptRoot/data`.

## Port and listener behavior

Desktop mode should keep its current localhost address and port behavior.

Web mode should:

- bind to an externally reachable container interface such as `0.0.0.0`
- listen on the platform-provided `PORT`
- trust proxy information only from the hosting environment and only where explicitly configured
- never use Tailscale identity headers as general public-web authentication

## Health endpoint

Add a lightweight unauthenticated readiness endpoint such as:

`GET /healthz`

It should reveal no user or provider data and return success when the web process can accept requests and required storage is available.

## Cross-platform audit

Before running the existing backend in Linux PowerShell 7, locate and isolate Windows-only behavior, especially:

- `powershell.exe`
- `Start-Process` browser/child-process assumptions
- Windows ACL APIs
- DPAPI / `ConvertFrom-SecureString` machine-user behavior
- WebView2 integration
- Windows path assumptions
- parent-process lifecycle coupling

Provider/domain/repository code that is already platform-neutral should be preserved.

## Deployment milestones

### Milestone 1 — safe runtime seams

- configurable runtime mode
- configurable data directory
- configurable host/port
- desktop defaults unchanged
- no public exposure yet

### Milestone 2 — portable hosted process

- PowerShell 7 Linux compatibility
- Dockerfile
- `/healthz`
- persistent data directory
- provider calls working from container

### Milestone 3 — web security

- owner login
- secure sessions
- CSRF defenses
- logout
- web secret protection

### Milestone 4 — provider authorization

- Spotify hosted OAuth callback
- portable refresh-token encryption
- Last.fm/Foursquare web configuration strategy

### Milestone 5 — Render deployment

- Render service linked to GitHub
- persistent disk
- environment secrets
- health check
- HTTPS URL
- verify app works while the home Windows PC is powered off

## Safety / regression requirements

- Never commit real API keys, tokens, encryption keys, passwords, password hashes tied to production credentials, or runtime user data.
- Do not change `main` during exploratory web-hosting work.
- Existing desktop installation and launch paths remain valid.
- Desktop localhost/session/Tailscale protections should not be relaxed as part of web hosting.
- Web endpoints must not expose exact Home information beyond existing privacy projections.
- SQLite backups/migration protections should remain available.

## First implementation tasks

1. Add a central runtime configuration module.
2. Make the data directory configurable while retaining the existing desktop default.
3. Make listener host/port configurable by mode.
4. Extract desktop parent/session validation from generic application startup.
5. Add a non-sensitive health endpoint.
6. Add cross-platform tests for the configuration layer.
7. Add Docker development scaffolding only after the backend can start safely in web mode.
