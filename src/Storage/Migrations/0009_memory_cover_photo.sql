ALTER TABLE memories ADD COLUMN cover_attachment_id TEXT;

CREATE INDEX IF NOT EXISTS ix_memories_household_cover_attachment
    ON memories(household_id,cover_attachment_id);
