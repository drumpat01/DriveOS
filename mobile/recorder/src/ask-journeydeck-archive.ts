import { getMasterDatabase } from './database-owner';
import { MASTER_DATABASE_APPLICATION_ID, MASTER_DATABASE_SCHEMA_VERSION } from './database-hardening';

// These are the same fixed, parameterized statements used by the Siri reader.
// Metro bundles this copy for OTA updates; the native bundle remains frozen until a build.
const basicQueries = require('../modules/journeydeck-recorder/ios/AskResources/ask-queries.json') as Record<string, string>;
const analysisQueries = require('../modules/journeydeck-recorder/ios/AskResources/ask-analysis-queries.json') as Record<string, string>;

export type AskProfile = { id: string; epoch: string };
export type AskSnapshot = {
  now: number;
  cutoff: number;
  journeys: Record<string, unknown>[];
  memories: Record<string, unknown>[];
  music: Record<string, unknown>[];
  sensitiveLabels: Record<string, unknown>[];
  markers?: Record<string, unknown>[];
  memoryJourneys?: Record<string, unknown>[];
  places?: Record<string, unknown>[];
};

const MAX_ROWS = 20_000;
const MAX_TEXT_BYTES = 8_000_000;

function utf8Length(value: string) {
  let bytes = 0;
  for (const character of value) {
    const codepoint = character.codePointAt(0)!;
    bytes += codepoint <= 0x7f ? 1 : codepoint <= 0x7ff ? 2 : codepoint <= 0xffff ? 3 : 4;
  }
  return bytes;
}

function boundedRows(sql: string, values: string[]): Record<string, unknown>[] {
  if (!/^\s*SELECT\b/i.test(sql) || /;/.test(sql)) throw new Error('Ask query is not read-only.');
  const rows = getMasterDatabase().getAllSync<Record<string, unknown>>(sql, ...values);
  if (rows.length > MAX_ROWS) throw new Error('Ask archive exceeds the row limit.');
  let bytes = 0;
  for (const row of rows) {
    for (const value of Object.values(row)) {
      if (typeof value !== 'string') continue;
      const length = utf8Length(value);
      bytes += length;
      if (length > 1024 || bytes > MAX_TEXT_BYTES) throw new Error('Ask archive exceeds the text limit.');
    }
  }
  return rows;
}

export function currentAskProfile(): AskProfile | null {
  const db = getMasterDatabase();
  if (db.getFirstSync<{ application_id: number }>('PRAGMA application_id')?.application_id !== MASTER_DATABASE_APPLICATION_ID) return null;
  const version = db.getFirstSync<{ user_version: number }>('PRAGMA user_version')?.user_version;
  if (version === undefined || version < 9 || version > MASTER_DATABASE_SCHEMA_VERSION) return null;
  const row = db.getFirstSync<AskProfile>(basicQueries.profile);
  return row?.id && row.epoch ? row : null;
}

export function readAskSnapshot(expectedUserID: string, cutoff: number, now: number, analysis = false) {
  const db = getMasterDatabase();
  let result: { input: AskSnapshot; profile: AskProfile } | null = null;
  db.withTransactionSync(() => {
    const profile = currentAskProfile();
    if (!profile || profile.id !== expectedUserID) throw new Error('The active profile changed. Ask again.');
    const values = [profile.id, new Date(cutoff).toISOString(), new Date(now).toISOString()];
    const queries = analysis ? analysisQueries : basicQueries;
    const input: AskSnapshot = {
      now, cutoff,
      journeys: boundedRows(queries.journeys, values),
      memories: boundedRows(queries.memories, values),
      music: boundedRows(queries.music, values),
      sensitiveLabels: boundedRows(basicQueries.sensitiveLabels, [profile.id]),
    };
    if (analysis) {
      input.markers = boundedRows(queries.markers, values);
      input.memoryJourneys = boundedRows(queries.memoryJourneys, values);
      input.places = boundedRows(queries.places, [profile.id]);
    }
    const after = currentAskProfile();
    if (!after || after.id !== profile.id || after.epoch !== profile.epoch) throw new Error('The active profile changed. Ask again.');
    result = { input, profile };
  });
  if (!result) throw new Error('Ask archive could not be read.');
  return result;
}
