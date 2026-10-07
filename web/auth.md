# JourneyDeck auth.md

This document describes how automated agents can authenticate with JourneyDeck (`https://journeydeck.me`).

## Agent registration

JourneyDeck does **not** offer agent registration or provisioning. It is a private, single-owner driving journal: there is no endpoint through which an agent can create an account, request credentials, or obtain an access token on its own.

- No OAuth authorization server is published, so there is no `/.well-known/oauth-authorization-server` or `/.well-known/oauth-protected-resource` document.
- No ID-JAG, verified-email or anonymous registration flow is supported.
- Do not attempt to register, and do not probe `/api/` routes for registration endpoints.

## Public endpoints (no credentials)

These endpoints need no authentication and are described in the [OpenAPI document](https://journeydeck.me/openapi.json) and the [API catalog](https://journeydeck.me/.well-known/api-catalog):

- `GET /healthz` — liveness check
- `GET /readyz` — readiness check

## Authenticated endpoints

All other `/api/` routes require the owner's authenticated session and are not available to agents. Credentials are issued only to the owner, directly, and are never issued through an automated flow.

## Contact

Questions: see [support](https://journeydeck.me/support).
