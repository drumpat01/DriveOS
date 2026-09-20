/** Markers survive recorder inbox acknowledgement and non-destructive route edits. */
export const JOURNEY_MARKER_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS local_journey_markers(
 id TEXT PRIMARY KEY NOT NULL,
 user_id TEXT NOT NULL REFERENCES local_users(id) ON DELETE CASCADE,
 session_id TEXT NOT NULL,
 root_journey_id TEXT NOT NULL,
 captured_at TEXT NOT NULL,
 location_at TEXT NOT NULL,
 latitude REAL NOT NULL CHECK(latitude BETWEEN -90 AND 90),
 longitude REAL NOT NULL CHECK(longitude BETWEEN -180 AND 180),
 accuracy_meters REAL NOT NULL CHECK(accuracy_meters BETWEEN 0 AND 100),
 notes TEXT NOT NULL DEFAULT '',
 deleted_at TEXT
);
CREATE INDEX IF NOT EXISTS ix_markers_journey ON local_journey_markers(user_id,root_journey_id,captured_at);
CREATE TABLE IF NOT EXISTS local_marker_media(
 id TEXT PRIMARY KEY NOT NULL,
 marker_id TEXT NOT NULL REFERENCES local_journey_markers(id) ON DELETE CASCADE,
 kind TEXT NOT NULL CHECK(kind IN ('photo','voice')),
 file_name TEXT NOT NULL,
 created_at TEXT NOT NULL
);
`;

/** Additive private-sync metadata for existing schema-8 Marker rows. */
export const JOURNEY_MARKER_SYNC_SCHEMA_SQL = `
ALTER TABLE local_journey_markers ADD COLUMN synced_to_cloud INTEGER NOT NULL DEFAULT 0;
ALTER TABLE local_journey_markers ADD COLUMN sync_revision INTEGER NOT NULL DEFAULT 1;
ALTER TABLE local_journey_markers ADD COLUMN created_at TEXT NOT NULL DEFAULT '';
ALTER TABLE local_journey_markers ADD COLUMN updated_at TEXT NOT NULL DEFAULT '';
UPDATE local_journey_markers
SET created_at=CASE WHEN created_at='' THEN captured_at ELSE created_at END,
    updated_at=CASE WHEN updated_at='' THEN COALESCE(deleted_at,captured_at) ELSE updated_at END;
CREATE INDEX IF NOT EXISTS ix_markers_cloud ON local_journey_markers(user_id,synced_to_cloud,updated_at);
CREATE TRIGGER IF NOT EXISTS trg_marker_capture_identity_immutable
BEFORE UPDATE OF id,user_id,session_id,root_journey_id,captured_at,location_at,latitude,longitude,accuracy_meters
ON local_journey_markers
BEGIN
 SELECT RAISE(ABORT,'marker capture identity is immutable');
END;

ALTER TABLE local_marker_media ADD COLUMN synced_to_cloud INTEGER NOT NULL DEFAULT 0;
ALTER TABLE local_marker_media ADD COLUMN deleted_at TEXT;
ALTER TABLE local_marker_media ADD COLUMN sync_revision INTEGER NOT NULL DEFAULT 1;
ALTER TABLE local_marker_media ADD COLUMN updated_at TEXT NOT NULL DEFAULT '';
UPDATE local_marker_media SET updated_at=created_at WHERE updated_at='';
CREATE INDEX IF NOT EXISTS ix_marker_media_cloud ON local_marker_media(marker_id,synced_to_cloud,updated_at);
CREATE TRIGGER IF NOT EXISTS trg_marker_photo_identity_immutable
BEFORE UPDATE OF id,marker_id,kind,file_name,created_at
ON local_marker_media
BEGIN
 SELECT RAISE(ABORT,'marker photo identity is immutable');
END;
`;
