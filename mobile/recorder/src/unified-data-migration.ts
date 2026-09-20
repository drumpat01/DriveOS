import {
  RECORDER_DATABASE_APPLICATION_ID,
  RECORDER_DATABASE_SCHEMA_VERSION,
} from './database-hardening';
import { getMasterDatabase, openLegacyRecorderDatabaseForMigration } from './database-owner';
import { legacyRecorderImportSql } from './legacy-recorder-import';

export const LEGACY_RECORDER_MIGRATION_KEY = 'phase2.legacy-recorder.v2';

/**
 * Copies the former recorder file into the unified master database. The source
 * is never written, renamed, or deleted. The marker and all copied rows commit
 * together, making a terminated migration safe to retry.
 */
export function migrateLegacyRecorderIntoUnifiedDatabase(): boolean {
  const master = getMasterDatabase();
  const completed = master.getFirstSync<{ status: string }>(
    'SELECT status FROM local_migration_state WHERE key=?;', LEGACY_RECORDER_MIGRATION_KEY,
  );
  if (completed?.status === 'completed') return false;

  const legacy = openLegacyRecorderDatabaseForMigration();
  if (!legacy) return false;
  const legacyPath = legacy.databasePath;
  let applicationId = 0;
  let schemaVersion = 0;
  let quickCheck = '';
  let tables = new Set<string>();
  try {
    applicationId = Number(legacy.getFirstSync<{ application_id: number }>('PRAGMA application_id;')?.application_id ?? 0);
    schemaVersion = Number(legacy.getFirstSync<{ user_version: number }>('PRAGMA user_version;')?.user_version ?? 0);
    const quickRow = legacy.getFirstSync<Record<string, unknown>>('PRAGMA quick_check(1);');
    quickCheck = String(Object.values(quickRow ?? {})[0] ?? '').toLocaleLowerCase();
    tables = new Set(legacy.getAllSync<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type='table';",
    ).map(row => row.name));
  } finally {
    legacy.closeSync();
  }

  if (applicationId !== 0 && applicationId !== RECORDER_DATABASE_APPLICATION_ID) {
    throw new Error('The legacy recorder file has an unexpected SQLite application id.');
  }
  if (schemaVersion > RECORDER_DATABASE_SCHEMA_VERSION) {
    throw new Error(`The legacy recorder schema ${schemaVersion} is newer than this app supports.`);
  }
  if (quickCheck !== 'ok' || !tables.has('recording_sessions') || !tables.has('recording_points')) {
    throw new Error('The legacy recorder file did not pass its preservation check.');
  }

  master.runSync('ATTACH DATABASE ? AS legacy_recorder;', legacyPath);
  try {
    const counts = {
      sessions: Number(master.getFirstSync<{ n: number }>('SELECT COUNT(*) AS n FROM legacy_recorder.recording_sessions;')?.n ?? 0),
      points: Number(master.getFirstSync<{ n: number }>('SELECT COUNT(*) AS n FROM legacy_recorder.recording_points;')?.n ?? 0),
      music: tables.has('recording_music_observations')
        ? Number(master.getFirstSync<{ n: number }>('SELECT COUNT(*) AS n FROM legacy_recorder.recording_music_observations;')?.n ?? 0) : 0,
      lastFm: tables.has('recording_lastfm_sync')
        ? Number(master.getFirstSync<{ n: number }>('SELECT COUNT(*) AS n FROM legacy_recorder.recording_lastfm_sync;')?.n ?? 0) : 0,
      cache: tables.has('recording_app_cache')
        ? Number(master.getFirstSync<{ n: number }>('SELECT COUNT(*) AS n FROM legacy_recorder.recording_app_cache;')?.n ?? 0) : 0,
      jobs: tables.has('recording_jobs')
        ? Number(master.getFirstSync<{ n: number }>('SELECT COUNT(*) AS n FROM legacy_recorder.recording_jobs;')?.n ?? 0) : 0,
    };
    const migratedAt = new Date().toISOString();
    master.withTransactionSync(() => {
      master.execSync(legacyRecorderImportSql(tables));

      const preserved = {
        sessions: Number(master.getFirstSync<{ n: number }>(`SELECT COUNT(*) AS n FROM recording_sessions r
          WHERE EXISTS(SELECT 1 FROM legacy_recorder.recording_sessions l WHERE l.id=r.id);`)?.n ?? 0),
        points: Number(master.getFirstSync<{ n: number }>(`SELECT COUNT(*) AS n FROM recording_points r
          WHERE EXISTS(SELECT 1 FROM legacy_recorder.recording_points l
            WHERE l.session_id=r.session_id AND l.sequence=r.sequence);`)?.n ?? 0),
        music: tables.has('recording_music_observations')
          ? Number(master.getFirstSync<{ n: number }>(`SELECT COUNT(*) AS n FROM recording_music_observations r
            WHERE EXISTS(SELECT 1 FROM legacy_recorder.recording_music_observations l
              WHERE l.session_id=r.session_id AND l.observation_id=r.observation_id);`)?.n ?? 0) : 0,
        lastFm: tables.has('recording_lastfm_sync')
          ? Number(master.getFirstSync<{ n: number }>(`SELECT COUNT(*) AS n FROM recording_lastfm_sync r
            WHERE EXISTS(SELECT 1 FROM legacy_recorder.recording_lastfm_sync l WHERE l.session_id=r.session_id);`)?.n ?? 0) : 0,
        cache: tables.has('recording_app_cache')
          ? Number(master.getFirstSync<{ n: number }>(`SELECT COUNT(*) AS n FROM recording_app_cache r
            WHERE EXISTS(SELECT 1 FROM legacy_recorder.recording_app_cache l WHERE l.key=r.key);`)?.n ?? 0) : 0,
        jobs: tables.has('recording_jobs')
          ? Number(master.getFirstSync<{ n: number }>(`SELECT COUNT(*) AS n FROM recording_jobs r
            WHERE EXISTS(SELECT 1 FROM legacy_recorder.recording_jobs l WHERE l.id=r.id);`)?.n ?? 0) : 0,
      };
      for (const key of Object.keys(counts) as Array<keyof typeof counts>) {
        if (preserved[key] !== counts[key]) {
          throw new Error(`Legacy recorder preservation check failed for ${key}: ${preserved[key]}/${counts[key]}.`);
        }
      }

      master.runSync(`INSERT INTO local_migration_state(
          key,status,source_application_id,source_schema_version,source_counts_json,migrated_at
        ) VALUES(?,'completed',?,?,?,?)
        ON CONFLICT(key) DO UPDATE SET status='completed',source_application_id=excluded.source_application_id,
          source_schema_version=excluded.source_schema_version,source_counts_json=excluded.source_counts_json,
          migrated_at=excluded.migrated_at;`,
      LEGACY_RECORDER_MIGRATION_KEY, applicationId, schemaVersion, JSON.stringify(counts), migratedAt);
    });
  } finally {
    master.execSync('DETACH DATABASE legacy_recorder;');
  }
  return true;
}
