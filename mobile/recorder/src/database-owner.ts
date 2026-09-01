/**
 * Owns every Expo SQLite handle used by the JourneyDeck iOS runtime.
 *
 * Expo may return JavaScript wrappers backed by the same native connection for
 * repeated opens of one file. Keeping the opens here guarantees that recorder,
 * archive, and analytics code share one intentional handle per database and
 * cannot accidentally apply connection-wide PRAGMAs to an unseen sibling.
 */

import * as SQLite from 'expo-sqlite';

let masterDatabase: SQLite.SQLiteDatabase | null = null;
let recorderDatabase: SQLite.SQLiteDatabase | null = null;

export function getMasterDatabase(): SQLite.SQLiteDatabase {
  masterDatabase ??= SQLite.openDatabaseSync('journeydeck-local.db');
  return masterDatabase;
}

export function getRecorderDatabase(): SQLite.SQLiteDatabase {
  recorderDatabase ??= SQLite.openDatabaseSync('journeydeck-recorder.db');
  return recorderDatabase;
}
