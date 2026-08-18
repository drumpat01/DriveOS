CREATE TABLE IF NOT EXISTS memories(
    id TEXT PRIMARY KEY,
    household_id TEXT NOT NULL,
    name TEXT NOT NULL,
    notes TEXT,
    artwork_key TEXT NOT NULL DEFAULT 'summer-2026',
    created_at_utc TEXT NOT NULL,
    updated_at_utc TEXT NOT NULL,
    FOREIGN KEY(household_id) REFERENCES households(id)
);

CREATE INDEX IF NOT EXISTS ix_memories_household_updated
    ON memories(household_id,updated_at_utc DESC,id);

CREATE TABLE IF NOT EXISTS memory_collections(
    memory_id TEXT NOT NULL,
    collection_id TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    added_at_utc TEXT NOT NULL,
    PRIMARY KEY(memory_id,collection_id),
    FOREIGN KEY(memory_id) REFERENCES memories(id) ON DELETE CASCADE,
    FOREIGN KEY(collection_id) REFERENCES journey_collections(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS ix_memory_collections_order
    ON memory_collections(memory_id,sort_order,collection_id);

CREATE TABLE IF NOT EXISTS memory_attachments(
    id TEXT PRIMARY KEY,
    household_id TEXT NOT NULL,
    memory_id TEXT NOT NULL,
    file_name TEXT NOT NULL,
    content_type TEXT NOT NULL,
    byte_length INTEGER NOT NULL,
    data_base64 TEXT NOT NULL,
    created_at_utc TEXT NOT NULL,
    FOREIGN KEY(household_id) REFERENCES households(id),
    FOREIGN KEY(memory_id) REFERENCES memories(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS ix_memory_attachments_memory_created
    ON memory_attachments(household_id,memory_id,created_at_utc,id);

CREATE TABLE IF NOT EXISTS memory_suggestions(
    id TEXT PRIMARY KEY,
    household_id TEXT NOT NULL,
    kind TEXT NOT NULL CHECK(kind IN ('memory','collection')),
    suggestion_key TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    payload_json TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'suggested' CHECK(status IN ('suggested','accepted','dismissed')),
    created_at_utc TEXT NOT NULL,
    updated_at_utc TEXT NOT NULL,
    FOREIGN KEY(household_id) REFERENCES households(id),
    UNIQUE(household_id,suggestion_key)
);

CREATE INDEX IF NOT EXISTS ix_memory_suggestions_household_status
    ON memory_suggestions(household_id,status,kind,updated_at_utc DESC,id);
