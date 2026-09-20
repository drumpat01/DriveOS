/**
 * local-atlas.test.mts
 *
 * Structural tests for the on-device Atlas Analytics Engine.
 * Verifies exported functions, SQL aggregation patterns, streak logic,
 * mood bucket definitions, and the snapshot rebuild pipeline.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(resolve(__dir, '../src/local-atlas.ts'), 'utf8');

// ============================================================
// 1. Exported types and functions
// ============================================================

assert.match(src, /export type AllTimeSummary/, 'exports AllTimeSummary type');
assert.match(src, /export type Last7DaysSummary/, 'exports Last7DaysSummary type');
assert.match(src, /export type WeeklyTour/, 'exports WeeklyTour type');
assert.match(src, /export type ArtistStat/, 'exports ArtistStat type');
assert.match(src, /export type MoodStat/, 'exports MoodStat type');

assert.match(src, /export function computeAllTime/, 'exports computeAllTime');
assert.match(src, /export function computeLast7Days/, 'exports computeLast7Days');
assert.match(src, /export function computeWeeklyTour/, 'exports computeWeeklyTour');
assert.match(src, /export function computeDrivingStreak/, 'exports computeDrivingStreak');
assert.match(src, /export function computeMusicMetrics/, 'exports computeMusicMetrics');
assert.match(src, /export function computeTopArtists/, 'exports computeTopArtists');
assert.match(src, /export function computeMoodBreakdown/, 'exports computeMoodBreakdown');
assert.match(src, /export function rebuildAtlasSnapshot/, 'exports rebuildAtlasSnapshot');

// ============================================================
// 2. SQL aggregations -- journeys
// ============================================================

assert.match(src, /SUM\(miles\)/, 'sums mileage');
assert.match(src, /SUM\(duration_minutes\)/, 'sums duration');
assert.match(src, /COUNT\(\*\) AS jc/, 'counts journeys');
assert.match(src, /started_at >= \?/, 'filters by start date cutoff');

// ============================================================
// 3. Weekly tour (current vs previous week)
// ============================================================

assert.match(src, /qWeekCutoff/, 'computes current-week cutoff');
assert.match(src, /qPrevWeekCutoff/, 'computes previous-week cutoff');
assert.match(src, /changePercent/, 'computes week-over-week change %');
assert.match(src, /previous > 0/, 'guards division by zero for change percent');

// ============================================================
// 4. Driving streak logic
// ============================================================

assert.match(src, /DISTINCT DATE\(started_at\)/, 'extracts distinct calendar days');
assert.match(src, /ORDER BY day DESC LIMIT 365/, 'looks back up to 365 days for streak');
assert.match(src, /setDate\(today\.getDate\(\) - i\)/, 'checks consecutive days backwards from today');

// ============================================================
// 5. Music metrics
// ============================================================

assert.match(src, /SUM\(duration_ms\)/, 'sums duration_ms for listening hours');
assert.match(src, /3_600_000/, 'converts ms to hours via 3_600_000 divisor');
assert.match(src, /journey_id IS NOT NULL/, 'counts only road-played songs');

// ============================================================
// 6. Top artists
// ============================================================

assert.match(src, /GROUP BY LOWER\(artist\)/, 'case-insensitive artist grouping');
assert.match(src, /ORDER BY plays DESC/, 'orders artists by play count descending');
assert.match(src, /artwork_url/, 'fetches most recent artwork URL per artist');

// ============================================================
// 7. Mood breakdown time buckets
// ============================================================

assert.match(src, /MOOD_BUCKETS/, 'MOOD_BUCKETS array defined');
assert.match(src, /Morning commute/, 'morning commute bucket exists');
assert.match(src, /Evening drive/, 'evening drive bucket exists');
assert.match(src, /Late night/, 'late night bucket exists');
assert.match(src, /strftime\('%H', played_at\)/, 'extracts hour from played_at');
assert.match(src, /midnight wrap/, 'handles midnight-wrap bucket');

// ============================================================
// 8. Snapshot rebuild pipeline
// ============================================================

assert.match(src, /rebuildAtlasSnapshot/, 'rebuildAtlasSnapshot function exists');
assert.match(src, /writeAtlasSnapshot/, 'persists snapshot to local_atlas_snapshots table');
assert.match(src, /topArtistsJson: JSON\.stringify\(topArtists\)/, 'serialises top artists to JSON');
assert.match(src, /moodJson: JSON\.stringify\(mood\)/, 'serialises mood to JSON');

// ============================================================
// 9. Zero division / empty data guards
// ============================================================

assert.match(src, /if \(!rows\.length\) return 0/, 'streak returns 0 for no journey data');
assert.match(src, /if \(total === 0\) return \[\]/, 'mood returns empty for no music data');
assert.match(src, /COALESCE\(SUM\(miles\),0\)/, 'mileage coalesces null to 0');

// ============================================================
// 10. Imports from local-store
// ============================================================

assert.match(src, /from '\.\/local-store'/, 'imports from local-store');
assert.match(src, /import.*writeAtlasSnapshot.*from '\.\/local-store'/, 'imports writeAtlasSnapshot');
assert.match(src, /import type.*LocalAtlasSnapshot.*from '\.\/local-store'/, 'imports LocalAtlasSnapshot type');

// ============================================================
// 11. Mood percent calculation
// ============================================================

assert.match(src, /Math\.round\(\(b\.count \/ total\) \* 100\)/, 'mood percent rounded to integer');
assert.match(src, /\.sort\(\(a, b\) => b\.count - a\.count\)/, 'mood sorted by count descending');

// ============================================================
// 12. Top artists limit guard
// ============================================================

assert.match(src, /Math\.max\(1, Math\.min\(50,/, 'top artists limit is clamped 1-50');

// ============================================================
// 13. Expo SQLite connection safety
// ============================================================

assert.doesNotMatch(src, /PRAGMA\s+query_only/i, 'does not make Expo shared SQLite handles read-only');

console.log('✅  local-atlas: all 13 checks passed.');
