export type DatabaseSchemaDiagnostic = {
  source: 'archive' | 'legacy_recorder';
  found: number;
  supported: number;
};

/** Only schema numbers are surfaced. Never include database rows or paths. */
export function databaseSchemaDiagnostic(error: unknown): DatabaseSchemaDiagnostic | null {
  const message = error instanceof Error ? error.message : '';
  const archive = /^JourneyDeck local archive schema (\d+) is newer than this app supports\.$/.exec(message);
  if (archive) return { source: 'archive', found: Number(archive[1]), supported: MASTER_DATABASE_SCHEMA_VERSION };
  const recorder = /^The legacy recorder schema (\d+) is newer than this app supports\.$/.exec(message);
  if (recorder) return { source: 'legacy_recorder', found: Number(recorder[1]), supported: RECORDER_DATABASE_SCHEMA_VERSION };
  return null;
}
import { MASTER_DATABASE_SCHEMA_VERSION, RECORDER_DATABASE_SCHEMA_VERSION } from './database-hardening.ts';
