CREATE TABLE IF NOT EXISTS app_state(
    key TEXT PRIMARY KEY,
    value_json TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS households(
    id TEXT PRIMARY KEY,
    display_name TEXT NOT NULL,
    created_at_utc TEXT NOT NULL,
    updated_at_utc TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS app_users(
    id TEXT PRIMARY KEY,
    provider_subject TEXT,
    email TEXT,
    display_name TEXT,
    created_at_utc TEXT NOT NULL,
    updated_at_utc TEXT NOT NULL,
    UNIQUE(provider_subject)
);

CREATE TABLE IF NOT EXISTS household_members(
    household_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('owner','member','viewer')),
    created_at_utc TEXT NOT NULL,
    updated_at_utc TEXT NOT NULL,
    PRIMARY KEY(household_id,user_id),
    FOREIGN KEY(household_id) REFERENCES households(id),
    FOREIGN KEY(user_id) REFERENCES app_users(id)
);

CREATE TABLE IF NOT EXISTS user_preferences(
    household_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    preference_key TEXT NOT NULL,
    value_json TEXT NOT NULL,
    updated_at_utc TEXT NOT NULL,
    PRIMARY KEY(household_id,user_id,preference_key),
    FOREIGN KEY(household_id,user_id) REFERENCES household_members(household_id,user_id)
);

CREATE TABLE IF NOT EXISTS vehicles(
    id TEXT PRIMARY KEY,
    household_id TEXT NOT NULL,
    provider TEXT NOT NULL,
    provider_vehicle_id TEXT NOT NULL,
    vin TEXT,
    display_name TEXT,
    observed_at_utc TEXT NOT NULL,
    raw_payload_json TEXT,
    created_at_utc TEXT NOT NULL,
    updated_at_utc TEXT NOT NULL,
    UNIQUE(household_id,provider,provider_vehicle_id),
    FOREIGN KEY(household_id) REFERENCES households(id)
);

CREATE INDEX IF NOT EXISTS ix_vehicles_household
    ON vehicles(household_id,updated_at_utc);

CREATE TABLE IF NOT EXISTS drives(
    id TEXT PRIMARY KEY,
    household_id TEXT NOT NULL,
    vehicle_id TEXT NOT NULL,
    provider TEXT NOT NULL,
    provider_drive_id TEXT NOT NULL,
    legacy_drive_id TEXT NOT NULL,
    started_at_utc TEXT NOT NULL,
    ended_at_utc TEXT NOT NULL,
    started_at_epoch INTEGER NOT NULL,
    ended_at_epoch INTEGER NOT NULL,
    starting_location TEXT,
    ending_location TEXT,
    starting_latitude REAL,
    starting_longitude REAL,
    ending_latitude REAL,
    ending_longitude REAL,
    starting_battery REAL,
    ending_battery REAL,
    distance_miles REAL,
    energy_used_kwh REAL,
    average_speed_mph REAL,
    max_speed_mph REAL,
    tessie_tag TEXT,
    driver_profile TEXT,
    raw_payload_json TEXT NOT NULL,
    source_updated_at_utc TEXT,
    created_at_utc TEXT NOT NULL,
    updated_at_utc TEXT NOT NULL,
    UNIQUE(vehicle_id,provider,provider_drive_id),
    UNIQUE(household_id,legacy_drive_id),
    CHECK(ended_at_epoch >= started_at_epoch),
    FOREIGN KEY(household_id) REFERENCES households(id),
    FOREIGN KEY(vehicle_id) REFERENCES vehicles(id)
);

CREATE INDEX IF NOT EXISTS ix_drives_household_started
    ON drives(household_id,started_at_epoch DESC);

CREATE INDEX IF NOT EXISTS ix_drives_vehicle_started
    ON drives(vehicle_id,started_at_epoch DESC);

CREATE TABLE IF NOT EXISTS charging_sessions(
    id TEXT PRIMARY KEY,
    household_id TEXT NOT NULL,
    vehicle_id TEXT NOT NULL,
    provider TEXT NOT NULL,
    provider_session_id TEXT NOT NULL,
    started_at_utc TEXT NOT NULL,
    ended_at_utc TEXT NOT NULL,
    started_at_epoch INTEGER NOT NULL,
    ended_at_epoch INTEGER NOT NULL,
    location TEXT,
    latitude REAL,
    longitude REAL,
    is_supercharger INTEGER NOT NULL DEFAULT 0 CHECK(is_supercharger IN (0,1)),
    odometer_miles REAL,
    energy_added_kwh REAL,
    energy_used_kwh REAL,
    miles_added REAL,
    starting_battery REAL,
    ending_battery REAL,
    recorded_cost REAL,
    raw_payload_json TEXT NOT NULL,
    source_updated_at_utc TEXT,
    created_at_utc TEXT NOT NULL,
    updated_at_utc TEXT NOT NULL,
    UNIQUE(vehicle_id,provider,provider_session_id),
    CHECK(ended_at_epoch >= started_at_epoch),
    FOREIGN KEY(household_id) REFERENCES households(id),
    FOREIGN KEY(vehicle_id) REFERENCES vehicles(id)
);

CREATE INDEX IF NOT EXISTS ix_charging_household_started
    ON charging_sessions(household_id,started_at_epoch DESC);

CREATE INDEX IF NOT EXISTS ix_charging_vehicle_started
    ON charging_sessions(vehicle_id,started_at_epoch DESC);

CREATE TABLE IF NOT EXISTS integration_sync_cursors(
    household_id TEXT NOT NULL,
    provider TEXT NOT NULL,
    resource TEXT NOT NULL,
    cursor_value TEXT,
    high_watermark_utc TEXT,
    last_attempt_at_utc TEXT,
    last_success_at_utc TEXT,
    last_error TEXT,
    updated_at_utc TEXT NOT NULL,
    PRIMARY KEY(household_id,provider,resource),
    FOREIGN KEY(household_id) REFERENCES households(id)
);

CREATE TABLE IF NOT EXISTS integration_sync_runs(
    id TEXT PRIMARY KEY,
    household_id TEXT NOT NULL,
    provider TEXT NOT NULL,
    resource TEXT NOT NULL,
    idempotency_key TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('running','succeeded','failed')),
    range_from_utc TEXT,
    range_to_utc TEXT,
    records_seen INTEGER NOT NULL DEFAULT 0,
    records_written INTEGER NOT NULL DEFAULT 0,
    started_at_utc TEXT NOT NULL,
    completed_at_utc TEXT,
    error_message TEXT,
    UNIQUE(household_id,provider,resource,idempotency_key),
    FOREIGN KEY(household_id) REFERENCES households(id)
);

CREATE TABLE IF NOT EXISTS durable_rollups(
    household_id TEXT NOT NULL,
    rollup_kind TEXT NOT NULL,
    period_start_utc TEXT NOT NULL,
    period_end_utc TEXT NOT NULL,
    schema_version INTEGER NOT NULL,
    value_json TEXT NOT NULL,
    calculated_at_utc TEXT NOT NULL,
    source_high_watermark_utc TEXT,
    PRIMARY KEY(household_id,rollup_kind,period_start_utc),
    FOREIGN KEY(household_id) REFERENCES households(id)
);
