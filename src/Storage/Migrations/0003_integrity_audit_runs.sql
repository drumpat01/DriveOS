CREATE TABLE IF NOT EXISTS integrity_audit_runs(
    id TEXT PRIMARY KEY,
    household_id TEXT NOT NULL,
    audit_kind TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('ready','not_ready','incomplete','failed')),
    ready_for_read_canary INTEGER NOT NULL DEFAULT 0 CHECK(ready_for_read_canary IN (0,1)),
    range_from_utc TEXT,
    range_to_utc TEXT,
    generated_at_utc TEXT NOT NULL,
    completed_at_utc TEXT NOT NULL,
    report_json TEXT NOT NULL,
    created_at_utc TEXT NOT NULL,
    FOREIGN KEY(household_id) REFERENCES households(id)
);

CREATE INDEX IF NOT EXISTS ix_integrity_audit_runs_household_kind_completed
    ON integrity_audit_runs(household_id,audit_kind,completed_at_utc DESC,id DESC);
