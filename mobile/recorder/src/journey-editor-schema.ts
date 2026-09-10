/** Additive schema 7. Edited projections are disposable; operation payloads retain originals. */
export const JOURNEY_EDITOR_SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS local_journey_edit_operations (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL REFERENCES local_users(id) ON DELETE CASCADE,
    root_id TEXT NOT NULL,
    parent_id TEXT,
    payload_json TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('applied','conflict','resolved')),
    synced_to_cloud INTEGER NOT NULL DEFAULT 0 CHECK(synced_to_cloud IN (0,1)),
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS ix_editor_sync ON local_journey_edit_operations(user_id,synced_to_cloud,created_at);
  CREATE INDEX IF NOT EXISTS ix_editor_root ON local_journey_edit_operations(user_id,root_id,created_at);
  CREATE TABLE IF NOT EXISTS local_journey_edit_heads (
    user_id TEXT NOT NULL REFERENCES local_users(id) ON DELETE CASCADE,
    root_id TEXT NOT NULL,
    operation_id TEXT NOT NULL REFERENCES local_journey_edit_operations(id) ON DELETE CASCADE,
    PRIMARY KEY(user_id,root_id)
  );
  CREATE TABLE IF NOT EXISTS local_journey_edit_members (
    journey_id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL REFERENCES local_users(id) ON DELETE CASCADE,
    root_id TEXT NOT NULL,
    active INTEGER NOT NULL CHECK(active IN (0,1))
  );
  CREATE INDEX IF NOT EXISTS ix_editor_members ON local_journey_edit_members(user_id,root_id,active);
  CREATE TABLE IF NOT EXISTS local_journey_edit_music (
    music_id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL REFERENCES local_users(id) ON DELETE CASCADE,
    root_id TEXT NOT NULL
  );
  CREATE TRIGGER IF NOT EXISTS editor_operation_immutable
  BEFORE UPDATE OF id,user_id,root_id,parent_id,payload_json,created_at ON local_journey_edit_operations
  BEGIN SELECT RAISE(ABORT,'A saved journey original or edit cannot be overwritten'); END;
  CREATE TRIGGER IF NOT EXISTS editor_operation_valid
  BEFORE INSERT ON local_journey_edit_operations
  WHEN NOT json_valid(NEW.payload_json) OR json_extract(NEW.payload_json,'$.id') IS NOT NEW.id
    OR json_extract(NEW.payload_json,'$.rootJourneyId') IS NOT NEW.root_id
    OR EXISTS(SELECT 1 FROM local_journey_edit_operations p WHERE p.id=NEW.parent_id AND (p.user_id<>NEW.user_id OR p.root_id<>NEW.root_id))
  BEGIN SELECT RAISE(ABORT,'Invalid private journey edit ownership'); END;
  CREATE TRIGGER IF NOT EXISTS editor_head_owner_insert BEFORE INSERT ON local_journey_edit_heads
  WHEN NOT EXISTS(SELECT 1 FROM local_journey_edit_operations o WHERE o.id=NEW.operation_id AND o.user_id=NEW.user_id AND o.root_id=NEW.root_id)
  BEGIN SELECT RAISE(ABORT,'Invalid private edit head ownership'); END;
  CREATE TRIGGER IF NOT EXISTS editor_head_owner_update BEFORE UPDATE ON local_journey_edit_heads
  WHEN NOT EXISTS(SELECT 1 FROM local_journey_edit_operations o WHERE o.id=NEW.operation_id AND o.user_id=NEW.user_id AND o.root_id=NEW.root_id)
  BEGIN SELECT RAISE(ABORT,'Invalid private edit head ownership'); END;
`;
