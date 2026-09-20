import type { MusicDashboardData } from './app-data';
import type { MusicArchiveEntry } from './library-model';

// Calendar days in the user's local timezone, including DST transitions.
// This is saved song duration, not inferred microphone or playback activity.
export function ipadListeningDays(archive: MusicArchiveEntry[], now = new Date()): MusicDashboardData['daily'] {
  const starts = Array.from({ length: 8 }, (_, i) => new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6 + i));
  return starts.slice(0, 7).map((start, i) => {
    const tracks = archive.filter(entry => {
      const time = Date.parse(entry.playedAt ?? entry.journeyStartedAt);
      return time >= start.getTime() && time < starts[i + 1].getTime() && time <= now.getTime();
    });
    return {
      date: start.toISOString(), label: start.toLocaleDateString(undefined, { weekday: 'short' }), count: tracks.length,
      minutes: tracks.reduce((total, entry) => total + (Number.isFinite(entry.durationMs) && (entry.durationMs ?? 0) > 0 ? entry.durationMs! : 0), 0) / 60_000,
    };
  });
}
