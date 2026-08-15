CREATE TABLE IF NOT EXISTS journey_collections(
    id TEXT PRIMARY KEY,
    household_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    created_at_utc TEXT NOT NULL,
    updated_at_utc TEXT NOT NULL,
    FOREIGN KEY(household_id) REFERENCES households(id)
);

CREATE INDEX IF NOT EXISTS ix_journey_collections_household_updated
    ON journey_collections(household_id,updated_at_utc DESC);

CREATE TABLE IF NOT EXISTS journey_collection_drives(
    collection_id TEXT NOT NULL,
    drive_id TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    added_at_utc TEXT NOT NULL,
    PRIMARY KEY(collection_id,drive_id),
    FOREIGN KEY(collection_id) REFERENCES journey_collections(id) ON DELETE CASCADE,
    FOREIGN KEY(drive_id) REFERENCES drives(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS ix_journey_collection_drives_order
    ON journey_collection_drives(collection_id,sort_order,drive_id);
