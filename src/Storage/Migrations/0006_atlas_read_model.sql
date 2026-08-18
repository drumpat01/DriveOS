CREATE TABLE IF NOT EXISTS atlas_snapshots(
    id TEXT PRIMARY KEY,
    household_id TEXT NOT NULL,
    schema_version INTEGER NOT NULL,
    source_watermark TEXT NOT NULL,
    generated_at_utc TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('ready','failed')),
    payload_json TEXT NOT NULL,
    error_message TEXT
);

CREATE INDEX IF NOT EXISTS ix_atlas_snapshots_household_generated
    ON atlas_snapshots(household_id,generated_at_utc DESC);

CREATE TABLE IF NOT EXISTS atlas_place_details(
    snapshot_id TEXT NOT NULL,
    place_id TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    PRIMARY KEY(snapshot_id,place_id),
    FOREIGN KEY(snapshot_id) REFERENCES atlas_snapshots(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS atlas_pattern_candidates(
    id TEXT PRIMARY KEY,
    source_place_id TEXT NOT NULL,
    target_place_id TEXT NOT NULL,
    drive_count INTEGER NOT NULL,
    sort_key TEXT NOT NULL,
    payload_json TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_atlas_pattern_candidates_queue
    ON atlas_pattern_candidates(drive_count DESC,sort_key,id);

CREATE TABLE IF NOT EXISTS atlas_pattern_reviews(
    id TEXT PRIMARY KEY,
    status TEXT NOT NULL CHECK(status IN ('confirmed','dismissed')),
    type TEXT,
    custom_name TEXT,
    updated_at_utc TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS atlas_place_labels(
    place_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    latitude REAL,
    longitude REAL,
    radius_feet REAL NOT NULL DEFAULT 200,
    updated_at_utc TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS atlas_snapshot_state(
    household_id TEXT PRIMARY KEY,
    active_snapshot_id TEXT,
    dirty INTEGER NOT NULL DEFAULT 1,
    rebuild_started_at_utc TEXT,
    rebuild_completed_at_utc TEXT,
    last_error TEXT,
    FOREIGN KEY(active_snapshot_id) REFERENCES atlas_snapshots(id)
);
