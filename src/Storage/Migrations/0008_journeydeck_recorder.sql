CREATE TABLE IF NOT EXISTS recorder_sessions(
    id TEXT PRIMARY KEY,
    household_id TEXT NOT NULL,
    device_id TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('recording','paused','completed')),
    started_at_utc TEXT NOT NULL,
    ended_at_utc TEXT,
    point_count INTEGER NOT NULL DEFAULT 0,
    last_sequence INTEGER NOT NULL DEFAULT -1,
    distance_miles REAL NOT NULL DEFAULT 0,
    drive_id TEXT,
    created_at_utc TEXT NOT NULL,
    updated_at_utc TEXT NOT NULL,
    FOREIGN KEY(household_id) REFERENCES households(id),
    FOREIGN KEY(drive_id) REFERENCES drives(id)
);

CREATE INDEX IF NOT EXISTS ix_recorder_sessions_household_started
    ON recorder_sessions(household_id,started_at_utc DESC);

CREATE TABLE IF NOT EXISTS recorder_points(
    session_id TEXT NOT NULL,
    sequence INTEGER NOT NULL,
    recorded_at_utc TEXT NOT NULL,
    recorded_at_epoch_ms INTEGER NOT NULL,
    latitude REAL NOT NULL CHECK(latitude BETWEEN -90 AND 90),
    longitude REAL NOT NULL CHECK(longitude BETWEEN -180 AND 180),
    accuracy_meters REAL,
    altitude_meters REAL,
    heading_degrees REAL,
    speed_mps REAL,
    created_at_utc TEXT NOT NULL,
    PRIMARY KEY(session_id,sequence),
    FOREIGN KEY(session_id) REFERENCES recorder_sessions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS ix_recorder_points_session_time
    ON recorder_points(session_id,recorded_at_epoch_ms,sequence);
