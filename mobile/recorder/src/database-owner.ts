/**
 * Owns every Expo SQLite handle used by the JourneyDeck iOS runtime.
 *
 * Expo may return JavaScript wrappers backed by the same native connection for
 * repeated opens of one file. Phase 2 gives recorder, archive, artwork, places,
 * and analytics one intentional journeydeck-local.db handle so connection-wide
 * PRAGMAs and transactions have one unambiguous owner.
 */

import * as SQLite from 'expo-sqlite';
import { File } from 'expo-file-system';

let masterDatabase: SQLite.SQLiteDatabase | null = null;
const LEGACY_RECORDER_DATABASE_NAME = 'journeydeck-recorder.db';

export function getMasterDatabase(): SQLite.SQLiteDatabase {
  masterDatabase ??= SQLite.openDatabaseSync('journeydeck-local.db');
  return masterDatabase;
}

export function getRecorderDatabase(): SQLite.SQLiteDatabase {
  return getMasterDatabase();
}

/**
 * Opens the pre-Phase-2 recorder file only for the one-time, read-only import.
 * Fresh installs never create the legacy file, and normal runtime code never
 * receives this handle.
 */
export function openLegacyRecorderDatabaseForMigration(): SQLite.SQLiteDatabase | null {
  const directory = getMasterDatabase().databasePath.replace(/[^/\\]+$/, '');
  const path = `${directory}${LEGACY_RECORDER_DATABASE_NAME}`;
  const file = new File(path);
  if (!file.exists) return null;
  return SQLite.openDatabaseSync(LEGACY_RECORDER_DATABASE_NAME, { useNewConnection: true });
}
