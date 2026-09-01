/**
 * local-atlas.ts
 *
 * On-Device Atlas Analytics Engine for JourneyDeck Local-First Architecture.
 *
 * Computes all dashboard statistics purely from the on-device SQLite database.
 * No network calls, no server round-trips. Works 100% offline.
 *
 * Exported functions are pure in the sense that they take a userId + db handle
 * and return fully-typed value objects -- making them straightforward to unit test.
 */

import type { LocalUserId, LocalAtlasSnapshot } from './local-store';
import { initializeLocalStore, writeAtlasSnapshot } from './local-store';
import { getMasterDatabase } from './database-owner';

// --- Internal helpers --------------------------------------------------------

initializeLocalStore();
const db = getMasterDatabase();

function q7DaysCutoff(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - 6);
  return d.toISOString();
}

function qWeekCutoff(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();              // 0 = Sunday
  d.setDate(d.getDate() - day);        // Monday of current week
  return d.toISOString();
}

function qPrevWeekCutoff(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  d.setDate(d.getDate() - day - 7);   // Monday of previous week
  return d.toISOString();
}

// --- All-time summary --------------------------------------------------------

export type AllTimeSummary = {
  journeyCount: number;
  miles: number;
  minutes: number;
};

export function computeAllTime(userId: LocalUserId): AllTimeSummary {
  const row = db.getFirstSync<{ jc: number; miles: number; minutes: number }>(
    'SELECT COUNT(*) AS jc, COALESCE(SUM(miles),0) AS miles, COALESCE(SUM(duration_minutes),0) AS minutes FROM local_journeys WHERE user_id=?;',
    userId,
  );
  return {
    journeyCount: Number(row?.jc ?? 0),
    miles: Number(row?.miles ?? 0),
    minutes: Number(row?.minutes ?? 0),
  };
}

// --- Last 7 days summary -----------------------------------------------------

export type Last7DaysSummary = AllTimeSummary & { songCount: number };

export function computeLast7Days(userId: LocalUserId): Last7DaysSummary {
  const cutoff = q7DaysCutoff();
  const row = db.getFirstSync<{ jc: number; miles: number; minutes: number; songs: number }>(
    `SELECT COUNT(*) AS jc, COALESCE(SUM(j.miles),0) AS miles, COALESCE(SUM(j.duration_minutes),0) AS minutes,
      COALESCE(SUM(j.song_count),0) AS songs
     FROM local_journeys j WHERE j.user_id=? AND j.started_at >= ?;`,
    userId, cutoff,
  );
  return {
    journeyCount: Number(row?.jc ?? 0),
    miles: Number(row?.miles ?? 0),
    minutes: Number(row?.minutes ?? 0),
    songCount: Number(row?.songs ?? 0),
  };
}

// --- Weekly tour mileage (current vs previous week) --------------------------

export type WeeklyTour = {
  miles: number;
  changePercent: number | null;
};

export function computeWeeklyTour(userId: LocalUserId): WeeklyTour {
  const weekStart = qWeekCutoff();
  const prevStart = qPrevWeekCutoff();

  const thisWeek = db.getFirstSync<{ miles: number }>(
    'SELECT COALESCE(SUM(miles),0) AS miles FROM local_journeys WHERE user_id=? AND started_at >= ?;',
    userId, weekStart,
  );
  const prevWeek = db.getFirstSync<{ miles: number }>(
    'SELECT COALESCE(SUM(miles),0) AS miles FROM local_journeys WHERE user_id=? AND started_at >= ? AND started_at < ?;',
    userId, prevStart, weekStart,
  );

  const current = Number(thisWeek?.miles ?? 0);
  const previous = Number(prevWeek?.miles ?? 0);
  const changePercent = previous > 0
    ? Math.round(((current - previous) / previous) * 100)
    : null;

  return { miles: current, changePercent };
}

// --- Driving streak ----------------------------------------------------------

/**
 * Returns the number of consecutive calendar days (ending today) on which
 * the user completed at least one journey.
 */
export function computeDrivingStreak(userId: LocalUserId): number {
  // Pull distinct calendar days with journeys, newest first
  const rows = db.getAllSync<{ day: string }>(
    `SELECT DISTINCT DATE(started_at) AS day FROM local_journeys WHERE user_id=? ORDER BY day DESC LIMIT 365;`,
    userId,
  );
  if (!rows.length) return 0;

  let streak = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 0; i < rows.length; i++) {
    const expected = new Date(today);
    expected.setDate(today.getDate() - i);
    const expectedStr = expected.toISOString().slice(0, 10);
    if (rows[i]!.day === expectedStr) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}

// --- Listening hours & songs on road ----------------------------------------

export type MusicMetrics = {
  listeningHours: number;
  songsOnRoad: number;
};

export function computeMusicMetrics(userId: LocalUserId): MusicMetrics {
  const durRow = db.getFirstSync<{ total_ms: number }>(
    'SELECT COALESCE(SUM(duration_ms),0) AS total_ms FROM local_music_entries WHERE user_id=? AND duration_ms IS NOT NULL;',
    userId,
  );
  const roadRow = db.getFirstSync<{ total: number }>(
    'SELECT COUNT(*) AS total FROM local_music_entries WHERE user_id=? AND journey_id IS NOT NULL;',
    userId,
  );
  return {
    listeningHours: Math.round((Number(durRow?.total_ms ?? 0) / 3_600_000) * 10) / 10,
    songsOnRoad: Number(roadRow?.total ?? 0),
  };
}

// --- Top artists -------------------------------------------------------------

export type ArtistStat = {
  artist: string;
  plays: number;
  artworkUrl: string | null;
};

export function computeTopArtists(userId: LocalUserId, limit = 10): ArtistStat[] {
  return db.getAllSync<{ artist: string; plays: number; artwork_url: string | null }>(
    `SELECT artist, COUNT(*) AS plays,
      (SELECT artwork_url FROM local_music_entries m2 WHERE m2.user_id=m.user_id AND m2.artist=m.artist AND m2.artwork_url IS NOT NULL ORDER BY played_at DESC LIMIT 1) AS artwork_url
     FROM local_music_entries m WHERE user_id=? GROUP BY LOWER(artist) ORDER BY plays DESC LIMIT ?;`,
    userId, Math.max(1, Math.min(50, Math.trunc(limit))),
  ).map(r => ({ artist: r.artist, plays: Number(r.plays), artworkUrl: r.artwork_url ?? null }));
}

// --- Mood breakdown (listening time-of-day) ----------------------------------

const MOOD_BUCKETS: Array<{ label: string; startHour: number; endHour: number }> = [
  { label: 'Morning commute', startHour: 6, endHour: 10 },
  { label: 'Midday cruise',   startHour: 10, endHour: 14 },
  { label: 'Afternoon run',   startHour: 14, endHour: 18 },
  { label: 'Evening drive',   startHour: 18, endHour: 22 },
  { label: 'Late night',      startHour: 22, endHour: 6  },  // wraps midnight
];

export type MoodStat = {
  label: string;
  count: number;
  percent: number;
};

export function computeMoodBreakdown(userId: LocalUserId): MoodStat[] {
  // Hour extraction: SQLite strftime('%H', ...) returns 00–23 as text
  const rows = db.getAllSync<{ hour: number; count: number }>(
    `SELECT CAST(strftime('%H', played_at) AS INTEGER) AS hour, COUNT(*) AS count
     FROM local_music_entries WHERE user_id=? AND journey_id IS NOT NULL
     GROUP BY hour;`,
    userId,
  );

  const total = rows.reduce((s, r) => s + Number(r.count), 0);
  if (total === 0) return [];

  const buckets = MOOD_BUCKETS.map(bucket => {
    const count = rows.reduce((s, r) => {
      const h = Number(r.hour);
      const inBucket = bucket.startHour < bucket.endHour
        ? h >= bucket.startHour && h < bucket.endHour
        : h >= bucket.startHour || h < bucket.endHour;  // midnight wrap
      return s + (inBucket ? Number(r.count) : 0);
    }, 0);
    return { label: bucket.label, count };
  }).filter(b => b.count > 0);

  return buckets.map(b => ({
    label: b.label,
    count: b.count,
    percent: Math.round((b.count / total) * 100),
  })).sort((a, b) => b.count - a.count);
}

// --- Full snapshot computation -----------------------------------------------

/**
 * Computes the full on-device Atlas snapshot for a user and writes it to
 * local_atlas_snapshots. Call this after completing a drive, syncing music,
 * or on app foreground after a configurable debounce interval.
 */
export function rebuildAtlasSnapshot(userId: LocalUserId): LocalAtlasSnapshot {
  const allTime = computeAllTime(userId);
  const last7 = computeLast7Days(userId);
  const music = computeMusicMetrics(userId);
  const streak = computeDrivingStreak(userId);
  const tour = computeWeeklyTour(userId);
  const topArtists = computeTopArtists(userId, 10);
  const mood = computeMoodBreakdown(userId);

  const snapshot: LocalAtlasSnapshot = {
    userId,
    generatedAt: new Date().toISOString(),
    allTimeJourneyCount: allTime.journeyCount,
    allTimeMiles: allTime.miles,
    allTimeMinutes: allTime.minutes,
    last7DaysJourneyCount: last7.journeyCount,
    last7DaysMiles: last7.miles,
    last7DaysMinutes: last7.minutes,
    last7DaysSongCount: last7.songCount,
    listeningHours: music.listeningHours,
    songsOnRoad: music.songsOnRoad,
    currentStreakDays: streak,
    topArtistsJson: JSON.stringify(topArtists),
    moodJson: JSON.stringify(mood),
    weeklyTourMiles: tour.miles,
    weeklyTourChangePercent: tour.changePercent,
  };

  writeAtlasSnapshot(snapshot);
  return snapshot;
}
