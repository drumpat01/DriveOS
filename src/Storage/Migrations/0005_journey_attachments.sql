CREATE TABLE IF NOT EXISTS journey_attachments(
    id TEXT PRIMARY KEY,
    household_id TEXT NOT NULL,
    collection_id TEXT NOT NULL,
    file_name TEXT NOT NULL,
    content_type TEXT NOT NULL,
    byte_length INTEGER NOT NULL,
    data_base64 TEXT NOT NULL,
    created_at_utc TEXT NOT NULL,
    FOREIGN KEY(household_id) REFERENCES households(id),
    FOREIGN KEY(collection_id) REFERENCES journey_collections(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS ix_journey_attachments_collection_created
    ON journey_attachments(household_id,collection_id,created_at_utc,id);
