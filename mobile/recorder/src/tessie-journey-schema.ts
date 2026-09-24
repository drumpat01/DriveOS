/** Device-only metadata; no Tessie charge details are sent to the app server. */
export const TESSIE_JOURNEY_SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS local_tessie_drive_metadata (
    journey_id TEXT PRIMARY KEY NOT NULL REFERENCES local_journeys(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES local_users(id) ON DELETE CASCADE,
    vehicle_key TEXT NOT NULL,
    starting_location TEXT NOT NULL,
    ending_location TEXT NOT NULL,
    starting_battery_percent REAL,
    ending_battery_percent REAL,
    energy_used_kwh REAL NOT NULL,
    route_attempted_at TEXT,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS local_tessie_charge_markers (
    id TEXT NOT NULL,
    user_id TEXT NOT NULL REFERENCES local_users(id) ON DELETE CASCADE,
    journey_id TEXT NOT NULL REFERENCES local_journeys(id) ON DELETE CASCADE,
    started_at TEXT NOT NULL,
    ended_at TEXT NOT NULL,
    location TEXT NOT NULL,
    latitude REAL,
    longitude REAL,
    arrival_battery_percent REAL,
    departure_battery_percent REAL,
    energy_added_kwh REAL NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY(user_id,id)
  );
  CREATE INDEX IF NOT EXISTS ix_tessie_charge_journey ON local_tessie_charge_markers(user_id,journey_id,started_at);
  CREATE TRIGGER IF NOT EXISTS tessie_drive_profile_insert BEFORE INSERT ON local_tessie_drive_metadata
    WHEN (SELECT user_id FROM local_journeys WHERE id=NEW.journey_id) IS NOT NEW.user_id
    BEGIN SELECT RAISE(ABORT, 'Tessie drive belongs to another profile'); END;
  CREATE TRIGGER IF NOT EXISTS tessie_drive_profile_update BEFORE UPDATE ON local_tessie_drive_metadata
    WHEN (SELECT user_id FROM local_journeys WHERE id=NEW.journey_id) IS NOT NEW.user_id
    BEGIN SELECT RAISE(ABORT, 'Tessie drive belongs to another profile'); END;
  CREATE TRIGGER IF NOT EXISTS tessie_charge_profile_insert BEFORE INSERT ON local_tessie_charge_markers
    WHEN (SELECT user_id FROM local_journeys WHERE id=NEW.journey_id) IS NOT NEW.user_id
    BEGIN SELECT RAISE(ABORT, 'Tessie charge belongs to another profile'); END;
  CREATE TRIGGER IF NOT EXISTS tessie_charge_profile_update BEFORE UPDATE ON local_tessie_charge_markers
    WHEN (SELECT user_id FROM local_journeys WHERE id=NEW.journey_id) IS NOT NEW.user_id
    BEGIN SELECT RAISE(ABORT, 'Tessie charge belongs to another profile'); END;
`;
