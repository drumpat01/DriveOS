import type { JourneyDetail, JourneySummary, SoundtrackTrack } from './app-data';

export type JourneyLibraryFilter = 'all' | 'music' | 'long' | 'efficient';
export type JourneyLibrarySort = 'newest' | 'oldest' | 'distance' | 'duration';

export type FavoriteRoute = {
  key: string;
  label: string;
  count: number;
  averageMiles: number;
  averageMinutes: number;
  latestAt: string;
  journeyIds: string[];
};

export type MusicArchiveEntry = SoundtrackTrack & {
  key: string;
  journeyId: string;
  journeyStartedAt: string;
  routeLabel: string;
};

function words(value: string | null | undefined) {
  return (value ?? '').trim().toLocaleLowerCase().replace(/\s+/g, ' ');
}

export function journeyRouteLabel(journey: JourneySummary) {
  return `${journey.startingLocation || 'Unknown start'} → ${journey.endingLocation || 'Unknown destination'}`;
}

export function filterJourneyLibrary(
  journeys: JourneySummary[], query: string, filter: JourneyLibraryFilter, sort: JourneyLibrarySort,
) {
  const needle = words(query);
  const result = journeys.filter(journey => {
    if (filter === 'music' && journey.songCount <= 0) return false;
    if (filter === 'long' && journey.miles < 10) return false;
    if (filter === 'efficient' && (journey.averageSpeedMph === null || journey.averageSpeedMph > 55)) return false;
    if (!needle) return true;
    const tracks = journey.soundtrackPreview.flatMap(track => [track.track, track.artist, track.album ?? '']);
    return words([
      journeyRouteLabel(journey), journey.vehicleName ?? '', journey.provider ?? '', journey.startedAt, ...tracks,
    ].join(' ')).includes(needle);
  });
  return result.sort((a, b) => {
    if (sort === 'oldest') return Date.parse(a.startedAt) - Date.parse(b.startedAt);
    if (sort === 'distance') return b.miles - a.miles;
    if (sort === 'duration') return b.durationMinutes - a.durationMinutes;
    return Date.parse(b.startedAt) - Date.parse(a.startedAt);
  });
}

export function favoriteRoutes(journeys: JourneySummary[]): FavoriteRoute[] {
  const groups = new Map<string, JourneySummary[]>();
  journeys.forEach(journey => {
    const start = words(journey.startingLocationKey || journey.startingLocation);
    const end = words(journey.endingLocationKey || journey.endingLocation);
    if (!start || !end) return;
    const key = `${start}::${end}`;
    groups.set(key, [...(groups.get(key) ?? []), journey]);
  });
  return [...groups.entries()].filter(([, items]) => items.length >= 2).map(([key, items]) => ({
    key,
    label: journeyRouteLabel(items[0]),
    count: items.length,
    averageMiles: items.reduce((sum, item) => sum + item.miles, 0) / items.length,
    averageMinutes: items.reduce((sum, item) => sum + item.durationMinutes, 0) / items.length,
    latestAt: items.reduce((latest, item) => Date.parse(item.startedAt) > Date.parse(latest) ? item.startedAt : latest, items[0].startedAt),
    journeyIds: items.map(item => item.id),
  })).sort((a, b) => b.count - a.count || Date.parse(b.latestAt) - Date.parse(a.latestAt));
}

export function buildMusicArchive(journeys: JourneySummary[], details: JourneyDetail[]): MusicArchiveEntry[] {
  const detailById = new Map(details.map(detail => [detail.id, detail]));
  const seen = new Set<string>();
  const entries: MusicArchiveEntry[] = [];
  journeys.forEach(journey => {
    const tracks = detailById.get(journey.id)?.soundtrack ?? journey.soundtrackPreview;
    tracks.forEach((track, index) => {
      const identity = `${journey.id}|${track.playedAt ?? ''}|${words(track.track)}|${words(track.artist)}`;
      if (seen.has(identity)) return;
      seen.add(identity);
      entries.push({ ...track, key: `${identity}|${index}`, journeyId: journey.id, journeyStartedAt: journey.startedAt, routeLabel: journeyRouteLabel(journey) });
    });
  });
  return entries.sort((a, b) => Date.parse(b.playedAt ?? b.journeyStartedAt) - Date.parse(a.playedAt ?? a.journeyStartedAt));
}

export function filterMusicArchive(entries: MusicArchiveEntry[], query: string) {
  const needle = words(query);
  if (!needle) return entries;
  return entries.filter(entry => words(`${entry.track} ${entry.artist} ${entry.album ?? ''} ${entry.routeLabel}`).includes(needle));
}

export function topArchiveTracks(entries: MusicArchiveEntry[], limit = 5) {
  const groups = new Map<string, { track: string; artist: string; artworkUrl: string | null; plays: number }>();
  entries.forEach(entry => {
    const key = `${words(entry.track)}::${words(entry.artist)}`;
    const current = groups.get(key);
    groups.set(key, current ? { ...current, plays: current.plays + 1, artworkUrl: current.artworkUrl ?? entry.artworkUrl } : { track: entry.track, artist: entry.artist, artworkUrl: entry.artworkUrl, plays: 1 });
  });
  return [...groups.values()].sort((a, b) => b.plays - a.plays || a.track.localeCompare(b.track)).slice(0, limit);
}
