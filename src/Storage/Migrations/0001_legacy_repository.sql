CREATE TABLE IF NOT EXISTS listening_history(
    id TEXT PRIMARY KEY,
    played_at TEXT,
    payload_json TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_listening_history_played_at
    ON listening_history(played_at);

CREATE TABLE IF NOT EXISTS drive_soundtracks(
    drive_id TEXT PRIMARY KEY,
    drive_started_at TEXT NOT NULL,
    drive_ended_at TEXT NOT NULL,
    status TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_drive_soundtracks_ended_at
    ON drive_soundtracks(drive_ended_at);

CREATE TABLE IF NOT EXISTS place_aliases(
    location TEXT PRIMARY KEY,
    label TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS settings(
    key TEXT PRIMARY KEY,
    value_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS app_state(
    key TEXT PRIMARY KEY,
    value_json TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
