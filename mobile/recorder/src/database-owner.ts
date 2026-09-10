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
let masterDatabaseOpen: Promise<SQLite.SQLiteDatabase> | null = null;
const LEGACY_RECORDER_DATABASE_NAME = 'journeydeck-recorder.db';

/**
 * The one supported way to open JourneyDeck's live database. App startup and
 * headless background tasks await the same promise, so an OTA reload cannot
 * create competing JavaScript connections while the schema is being checked.
 */
export function openMasterDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (masterDatabase) return Promise.resolve(masterDatabase);
  masterDatabaseOpen ??= SQLite.openDatabaseAsync('journeydeck-local.db')
    .then(database => {
      masterDatabase = database;
      return database;
    })
    .catch(error => {
      masterDatabaseOpen = null;
      throw error;
    });
  return masterDatabaseOpen;
}

/** Returns the controlled handle only after the asynchronous startup gate. */
export function getMasterDatabase(): SQLite.SQLiteDatabase {
  if (!masterDatabase) {
    throw new Error('JourneyDeck local storage is not ready. Await database startup before reading or writing.');
  }
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
