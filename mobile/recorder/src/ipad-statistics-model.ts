import type { JourneySummary, JourneyDetail } from './app-data';

export type StatisticsRange = 7 | 30 | 90 | 'all';
const positive = (n: number | null | undefined) => Number.isFinite(n) ? Math.max(0, n!) : 0;
export const dayKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
export const localDay = (key: string) => new Date(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1, Number(key.slice(8, 10)));
export const shiftDay = (date: Date, days: number) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
export function calendarDays(month: Date) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const offset = (first.getDay() + 6) % 7;
  const count = Math.ceil((offset + new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()) / 7) * 7;
  return Array.from({ length: count }, (_, i) => shiftDay(first, i - offset));
}
export function summarize(journeys: JourneySummary[], details: JourneyDetail[], byId = new Map(details.map(detail => [detail.id, detail]))) {
  const tracks = new Set<string>(), artists = new Set<string>(), albums = new Set<string>();
  let listeningMinutes = 0, knownDurations = 0, savedTracks = 0, completeJourneys = 0;
  const normalize = (s: string) => s.trim().toLocaleLowerCase();
  for (const journey of journeys) {
    const detail = byId.get(journey.id);
    if (!detail) continue;
    completeJourneys++;
    const seen = new Set<string>();
    for (const song of detail.soundtrack) {
      const track = normalize(song.track), artist = normalize(song.artist), album = normalize(song.album ?? '');
      const identity = `${song.playedAt ?? ''}|${track}|${artist}`;
      if (seen.has(identity)) continue;
      seen.add(identity);
      savedTracks++;
      if (track) tracks.add(`${artist}|${track}`);
      if (artist) artists.add(artist);
      if (album) albums.add(`${artist}|${album}`);
      if (Number.isFinite(song.durationMs) && song.durationMs! > 0) {
        knownDurations++;
        listeningMinutes += song.durationMs! / 60000;
      }
    }
  }
  const plays = journeys.reduce((n, j) => n + Math.floor(positive(j.songCount)), 0);
  return {
    miles: journeys.reduce((n, j) => n + positive(j.miles), 0),
    journeys: journeys.length,
    drivingMinutes: journeys.reduce((n, j) => n + positive(j.durationMinutes), 0),
    plays, listeningMinutes, activeDays: new Set(journeys.map(j => dayKey(new Date(j.startedAt)))).size,
    uniqueTracks: tracks.size, uniqueArtists: artists.size, uniqueAlbums: albums.size,
    partialMusic: completeJourneys < journeys.length || savedTracks < plays || knownDurations < savedTracks,
  };
}
export function buildIpadStatistics(journeys: JourneySummary[], details: JourneyDetail[], range: StatisticsRange, now = new Date(), historyDays: number | null = null) {
  const cutoff = historyDays === null ? -Infinity : now.valueOf() - historyDays * 86400000;
  const seen = new Set<string>();
  const archive = journeys.filter(j => {
    const time = Date.parse(j.startedAt);
    if (!Number.isFinite(time) || time > now.valueOf() || time < cutoff || seen.has(j.id)) return false;
    seen.add(j.id); return true;
  }).map(j => ({ ...j, miles: positive(j.miles), durationMinutes: positive(j.durationMinutes), songCount: Math.floor(positive(j.songCount)) }))
    .sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt));
  const end = shiftDay(now, 1);
  const start = range === 'all' ? localDay(dayKey(new Date(archive.at(-1)?.startedAt ?? now))) : shiftDay(end, -range);
  // Defensive clamp even if an inaccessible range is passed by a caller.
  const visibleStart = new Date(Math.max(start.valueOf(), cutoff));
  const selected = archive.filter(j => Date.parse(j.startedAt) >= visibleStart.valueOf());
  const previousStart = range === 'all' ? null : shiftDay(start, -range);
  const previous = previousStart && previousStart.valueOf() >= cutoff
    ? summarize(archive.filter(j => Date.parse(j.startedAt) >= previousStart.valueOf() && Date.parse(j.startedAt) < start.valueOf()), details) : null;
  const byDay = new Map<string, JourneySummary[]>();
  const hours = Array.from({ length: 24 }, () => 0);
  const bands = [{ label: 'Under 5 mi', count: 0 }, { label: '5–15 mi', count: 0 }, { label: '15–30 mi', count: 0 }, { label: '30+ mi', count: 0 }];
  for (const journey of selected) {
    const date = new Date(journey.startedAt), key = dayKey(date);
    byDay.set(key, [...(byDay.get(key) ?? []), journey]);
    hours[date.getHours()]++;
    const miles = positive(journey.miles);
    bands[miles < 5 ? 0 : miles < 15 ? 1 : miles < 30 ? 2 : 3].count++;
  }
  const days = [];
  const detailById = new Map(details.map(detail => [detail.id, detail]));
  for (let date = localDay(dayKey(visibleStart)); date < end; date = shiftDay(date, 1)) {
    const key = dayKey(date), entries = byDay.get(key) ?? [];
    days.push({ key, ...summarize(entries, details, detailById) });
  }
  return { start: visibleStart, end: shiftDay(end, -1), selected, byDay, days, hours, bands, totals: summarize(selected, details), previous };
}
