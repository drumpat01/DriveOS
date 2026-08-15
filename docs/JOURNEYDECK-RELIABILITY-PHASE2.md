# JourneyDeck reliability phase 2

JourneyDeck treats background integrity evidence as durable product data. Normal web requests never call Tessie, Spotify, or Turso's management API.

## Daily integrity audit

The `Audit Tessie read readiness` workflow runs daily at 06:23 UTC and remains manually dispatchable. It compares the approved 30-day Tessie window with normalized Turso history, checks both sync cursors, writes a redacted aggregate result to `integrity_audit_runs`, and then fails the workflow when read readiness is not approved. Stored reports exclude VINs, locations, provider payloads, record identifiers, and mismatch examples.

Owner-only Data Health reads the latest durable result. An absent or failed result creates an alert; a successful result older than 26 hours is stale. Wife Mode has neither navigation nor API access to Data Health.

## Weekly restore rehearsal

The `Rehearse Turso restore` workflow runs Sundays at 07:43 UTC and remains manually dispatchable. It uses Turso's management API to fork the production database into a uniquely named disposable database, compares schema migration versions and aggregate row counts, runs `PRAGMA integrity_check`, and destroys the disposable database in a `finally` block. A second management API read must return 404 before the rehearsal can pass. The source database is queried only with `SELECT` and is never migrated or mutated.

Required GitHub configuration:

- Repository secret `TURSO_PLATFORM_TOKEN`: an organization-scoped Turso platform token with database create, token-create, read, and delete access.
- Repository variables `TURSO_ORGANIZATION` and `TURSO_SOURCE_DATABASE`.
- Optional repository variable `TURSO_GROUP`; it defaults to `default`.
- Existing repository secrets `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` remain the source database's SQL-over-HTTP credentials.

The workflow never prints or archives credentials, URLs, application rows, or the disposable database token.

## Reliability exit criteria

Phase 2 is operationally complete after all of the following are true:

1. Migration 3 is applied in production and Data Health can read the latest audit without request-path provider work.
2. Two consecutive scheduled daily integrity audits pass, at least 24 hours apart.
3. One exact-commit weekly restore rehearsal passes with schema parity, row-count parity, `integrity_check=ok`, and independently confirmed cleanup.
4. Wife Mode runtime verification confirms Data Health remains inaccessible and mobile sign-out remains visible.
5. Rollback is rehearsed by disabling only the two new schedules; existing durable reads, provider ingestion, and all user-visible history remain unchanged.

After those gates pass, reliability work moves to monitoring rather than feature blocking. The next user-facing slice should be selected independently; good candidates are route favorites/navigation improvements, recap sharing, or search refinements. Last.fm is not a JourneyDeck data source and should not be reintroduced.
