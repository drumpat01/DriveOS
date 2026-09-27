import type { JourneyDetail, JourneyMemory, JourneySummary, SoundtrackTrack } from './app-data.ts';
import type { SearchRecord } from './primary-sections-data.ts';
import { favoriteRoutes } from './library-model.ts';

/**
 * Pure derivations for the V4 redesign (Today, Memories, Memory detail,
 * Soundtrack, Search). Everything is computed from the local library; nothing
 * here reads storage, the network or React.
 */

const DAY_MS = 86_400_000;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const words = (value: string | null | undefined) => (value ?? '').trim().toLocaleLowerCase().replace(/\s+/g, ' ');
const time = (iso: string | null | undefined) => {
  const value = iso ? Date.parse(iso) : Number.NaN;
  return Number.isFinite(value) ? value : null;
};
const startOfDay = (ms: number) => { const date = new Date(ms); date.setHours(0, 0, 0, 0); return date.getTime(); };
const trackKey = (track: Pick<SoundtrackTrack, 'track' | 'artist'>) => `${words(track.track)}::${words(track.artist)}`;

/** First comma-separated part of a place label ("Pacifica, CA" → "Pacifica"). */
export function placeName(value: string | null | undefined) {
  const name = value?.split(',')[0]?.trim();
  return name ? name : null;
}

export function routeLabel(journey: Pick<JourneySummary, 'startingLocation' | 'endingLocation'>) {
  const start = placeName(journey.startingLocation), end = placeName(journey.endingLocation);
  if (start && end) return start === end ? `Around ${start}` : `${start} → ${end}`;
  if (end) return `Arrived near ${end}`;
  if (start) return `Departed ${start}`;
  return 'A recorded drive';
}

/** "Friday evening drive", from the local start time. */
export function driveTitle(startedAt: string) {
  const ms = time(startedAt);
  if (ms === null) return 'A drive worth remembering';
  const date = new Date(ms);
  const hour = date.getHours();
  const moment = hour < 5 ? 'late-night' : hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : hour < 21 ? 'evening' : 'night';
  return `${WEEKDAYS[date.getDay()]} ${moment} drive`;
}

export function relativeTime(iso: string, now: number) {
  const ms = time(iso);
  if (ms === null) return '';
  const minutes = Math.max(0, Math.round((now - ms) / 60_000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const days = Math.round((startOfDay(now) - startOfDay(ms)) / DAY_MS);
  if (days <= 0) return `${Math.round(minutes / 60)}h ago`;
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  const date = new Date(ms);
  return `${MONTHS[date.getMonth()]} ${date.getDate()}`;
}

export function formatMilesShort(miles: number) {
  if (!Number.isFinite(miles) || miles <= 0) return '0 mi';
  return miles < 100 ? `${miles.toFixed(1)} mi` : `${Math.round(miles).toLocaleString('en-US')} mi`;
}

export function formatMinutesShort(minutes: number) {
  const total = Math.max(0, Math.round(minutes));
  if (total < 60) return `${total} min`;
  const hours = Math.floor(total / 60), rest = total % 60;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}

export function newestJourney<T extends Pick<JourneySummary, 'startedAt'>>(journeys: readonly T[]): T | null {
  let newest: T | null = null;
  for (const journey of journeys) {
    if (!newest || (time(journey.startedAt) ?? 0) > (time(newest.startedAt) ?? 0)) newest = journey;
  }
  return newest;
}

/** A journey's full soundtrack when its detail is loaded, otherwise the preview. */
export function journeyTracks(journey: JourneySummary, detailById: ReadonlyMap<string, JourneyDetail>): SoundtrackTrack[] {
  const detail = detailById.get(journey.id);
  return detail?.soundtrack?.length ? detail.soundtrack : journey.soundtrackPreview;
}

// ---------------------------------------------------------------- Today

export type WeekDay = { label: string; date: string; miles: number; isToday: boolean };
export type WeekSummary = {
  days: WeekDay[]; miles: number; drives: number; minutes: number; songs: number;
  maxMiles: number; changePercent: number | null;
};

/** The seven local days ending today, with a comparison to the seven before. */
export function weekSummary(journeys: readonly JourneySummary[], now: number): WeekSummary {
  const today = startOfDay(now);
  const first = today - 6 * DAY_MS;
  const days: WeekDay[] = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(first + index * DAY_MS);
    return { label: WEEKDAYS[date.getDay()].slice(0, 1), date: date.toISOString().slice(0, 10), miles: 0, isToday: index === 6 };
  });
  let miles = 0, drives = 0, minutes = 0, songs = 0, previous = 0;
  for (const journey of journeys) {
    const ms = time(journey.startedAt);
    if (ms === null) continue;
    const day = startOfDay(ms);
    if (day >= first && day <= today) {
      const index = Math.round((day - first) / DAY_MS);
      days[index].miles += journey.miles;
      miles += journey.miles; drives += 1; minutes += journey.durationMinutes; songs += journey.songCount;
    } else if (day >= first - 7 * DAY_MS && day < first) {
      previous += journey.miles;
    }
  }
  return {
    days, miles, drives, minutes, songs,
    maxMiles: Math.max(0, ...days.map(day => day.miles)),
    changePercent: previous > 0 ? Math.round(((miles - previous) / previous) * 100) : null,
  };
}

export type OnThisDay = { memory: JourneyMemory; yearsAgo: number };

/** A Memory from this calendar week in an earlier year, nearest year first. */
export function onThisDay(memories: readonly JourneyMemory[], journeys: readonly JourneySummary[], now: number, windowDays = 3): OnThisDay | null {
  const byId = new Map(journeys.map(journey => [journey.id, journey]));
  const today = new Date(now);
  let best: (OnThisDay & { distance: number }) | null = null;
  for (const memory of memories) {
    for (const id of memory.journeyIds) {
      const ms = time(byId.get(id)?.startedAt);
      if (ms === null) continue;
      const date = new Date(ms);
      const yearsAgo = today.getFullYear() - date.getFullYear();
      if (yearsAgo < 1) continue;
      const sameYear = new Date(today.getFullYear(), date.getMonth(), date.getDate()).getTime();
      const distance = Math.abs(Math.round((sameYear - startOfDay(now)) / DAY_MS));
      if (distance > windowDays) continue;
      if (!best || yearsAgo < best.yearsAgo || (yearsAgo === best.yearsAgo && distance < best.distance)) best = { memory, yearsAgo, distance };
    }
  }
  return best ? { memory: best.memory, yearsAgo: best.yearsAgo } : null;
}

// ---------------------------------------------------------------- Memories

export function dateRangeLabel(startIso: string | null, endIso: string | null) {
  const startMs = time(startIso), endMs = time(endIso) ?? startMs;
  if (startMs === null || endMs === null) return '';
  const a = new Date(Math.min(startMs, endMs)), b = new Date(Math.max(startMs, endMs));
  const day = (date: Date) => `${MONTHS[date.getMonth()]} ${date.getDate()}`;
  if (a.getFullYear() !== b.getFullYear()) return `${day(a)}, ${a.getFullYear()} – ${day(b)}, ${b.getFullYear()}`;
  if (a.getMonth() !== b.getMonth()) return `${day(a)} – ${day(b)}, ${b.getFullYear()}`;
  if (a.getDate() !== b.getDate()) return `${day(a)}–${b.getDate()}, ${b.getFullYear()}`;
  return `${day(a)}, ${a.getFullYear()}`;
}

export type RankedTrack = {
  track: string; artist: string; album: string | null; artworkUrl: string | null; externalUrl: string | null;
  plays: number; drives: number;
};

export type MemoryStats = {
  journeys: JourneySummary[]; drives: number; miles: number; minutes: number; songs: number;
  startedAt: string | null; endedAt: string | null; dateLabel: string; places: string[];
  topTracks: RankedTrack[]; topTrackByJourney: Record<string, RankedTrack>;
};

function rankTracks(entries: { track: SoundtrackTrack; journeyId: string }[]): RankedTrack[] {
  const groups = new Map<string, RankedTrack & { journeyIds: Set<string> }>();
  for (const { track, journeyId } of entries) {
    const key = trackKey(track);
    const current = groups.get(key);
    if (current) {
      current.plays += 1; current.journeyIds.add(journeyId);
      current.artworkUrl ??= track.artworkUrl; current.externalUrl ??= track.externalUrl; current.album ??= track.album;
    } else {
      groups.set(key, { track: track.track, artist: track.artist, album: track.album, artworkUrl: track.artworkUrl, externalUrl: track.externalUrl, plays: 1, drives: 0, journeyIds: new Set([journeyId]) });
    }
  }
  return [...groups.values()]
    .map(({ journeyIds, ...item }) => ({ ...item, drives: journeyIds.size }))
    .sort((a, b) => b.plays - a.plays || b.drives - a.drives || a.track.localeCompare(b.track));
}

export function memoryStats(memory: Pick<JourneyMemory, 'journeyIds'>, journeys: readonly JourneySummary[], details: readonly JourneyDetail[]): MemoryStats {
  const ids = new Set(memory.journeyIds);
  const detailById = new Map(details.map(detail => [detail.id, detail]));
  const members = journeys.filter(journey => ids.has(journey.id))
    .sort((a, b) => (time(a.startedAt) ?? 0) - (time(b.startedAt) ?? 0));
  const entries: { track: SoundtrackTrack; journeyId: string }[] = [];
  const topTrackByJourney: Record<string, RankedTrack> = {};
  const places: string[] = [];
  for (const journey of members) {
    const tracks = journeyTracks(journey, detailById);
    tracks.forEach(track => entries.push({ track, journeyId: journey.id }));
    const top = rankTracks(tracks.map(track => ({ track, journeyId: journey.id })))[0];
    if (top) topTrackByJourney[journey.id] = top;
    for (const place of [placeName(journey.startingLocation), placeName(journey.endingLocation)]) {
      if (place && !places.includes(place)) places.push(place);
    }
  }
  const startedAt = members[0]?.startedAt ?? null;
  const endedAt = members.at(-1)?.endedAt ?? members.at(-1)?.startedAt ?? null;
  return {
    journeys: members,
    drives: members.length,
    miles: members.reduce((sum, journey) => sum + journey.miles, 0),
    minutes: members.reduce((sum, journey) => sum + journey.durationMinutes, 0),
    songs: members.reduce((sum, journey) => sum + Math.max(journey.songCount, journeyTracks(journey, detailById).length), 0),
    startedAt, endedAt, dateLabel: dateRangeLabel(startedAt, endedAt), places,
    topTracks: rankTracks(entries), topTrackByJourney,
  };
}

export type MemoryYearGroup = {
  year: number; miles: number;
  items: { memory: JourneyMemory; drives: number; miles: number; startedAt: string }[];
};

/** Memories grouped by the year of their first drive (or creation), newest first. */
export function memoryYearGroups(memories: readonly JourneyMemory[], journeys: readonly JourneySummary[]): MemoryYearGroup[] {
  const byId = new Map(journeys.map(journey => [journey.id, journey]));
  const groups = new Map<number, MemoryYearGroup>();
  for (const memory of memories) {
    const members = memory.journeyIds.map(id => byId.get(id)).filter((journey): journey is JourneySummary => Boolean(journey));
    const firstMs = members.reduce<number | null>((min, journey) => {
      const ms = time(journey.startedAt);
      return ms === null ? min : min === null ? ms : Math.min(min, ms);
    }, null) ?? time(memory.createdAtUtc) ?? 0;
    const startedAt = new Date(firstMs).toISOString();
    const year = new Date(firstMs).getFullYear();
    const miles = members.reduce((sum, journey) => sum + journey.miles, 0);
    const group = groups.get(year) ?? { year, miles: 0, items: [] };
    group.miles += miles;
    group.items.push({ memory, drives: members.length, miles, startedAt });
    groups.set(year, group);
  }
  return [...groups.values()]
    .sort((a, b) => b.year - a.year)
    .map(group => ({ ...group, items: group.items.sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt)) }));
}

export type SmartCollection = { id: 'favorites' | 'night' | 'longest'; title: string; detail: string; journeyIds: string[] };

export function smartCollections(journeys: readonly JourneySummary[]): SmartCollection[] {
  const collections: SmartCollection[] = [];
  const routes = favoriteRoutes([...journeys]);
  if (routes.length) {
    const keys = new Set(routes.map(route => route.key));
    const ids = journeys.filter(journey => keys.has(`${words(journey.startingLocationKey || journey.startingLocation)}::${words(journey.endingLocationKey || journey.endingLocation)}`)).map(journey => journey.id);
    collections.push({ id: 'favorites', title: 'Roads you return to', detail: `${routes.length} ${routes.length === 1 ? 'route' : 'routes'} · ${ids.length} drives`, journeyIds: ids });
  }
  const night = journeys.filter(journey => {
    const ms = time(journey.startedAt);
    if (ms === null) return false;
    const hour = new Date(ms).getHours();
    return hour >= 20 || hour < 5;
  });
  if (night.length) collections.push({ id: 'night', title: 'Night drives', detail: `${night.length} ${night.length === 1 ? 'drive' : 'drives'}`, journeyIds: night.map(journey => journey.id) });
  if (journeys.length >= 3) {
    const longest = [...journeys].sort((a, b) => b.miles - a.miles).slice(0, 10);
    collections.push({ id: 'longest', title: 'Longest drives', detail: `Top ${longest.length}`, journeyIds: longest.map(journey => journey.id) });
  }
  return collections;
}

// ---------------------------------------------------------------- Soundtrack

export type SoundtrackRange = 'week' | 'month' | 'year' | 'all';
export const SOUNDTRACK_RANGES: { id: SoundtrackRange; label: string; period: string }[] = [
  { id: 'week', label: 'Week', period: 'this week' },
  { id: 'month', label: 'Month', period: 'this month' },
  { id: 'year', label: 'Year', period: 'this year' },
  { id: 'all', label: 'All time', period: 'of all time' },
];

export function rangeStart(range: SoundtrackRange, now: number) {
  if (range === 'all') return null;
  const days = range === 'week' ? 7 : range === 'month' ? 30 : 365;
  return startOfDay(now) - (days - 1) * DAY_MS;
}

export type Daypart = { id: 'morning' | 'afternoon' | 'evening' | 'night'; label: string; plays: number };

export function daypartOf(hour: number): Daypart['id'] {
  return hour >= 5 && hour < 12 ? 'morning' : hour >= 12 && hour < 17 ? 'afternoon' : hour >= 17 && hour < 21 ? 'evening' : 'night';
}

export type SoundtrackSummary = {
  plays: number; distinctSongs: number; drives: number;
  listeningMinutes: number | null;
  /** Share of this period's miles driven on journeys that have music, 0–100. */
  musicMilesPercent: number | null;
  anthem: (RankedTrack & { miles: number }) | null;
  topArtists: { artist: string; plays: number; artworkUrl: string | null }[];
  topTracks: RankedTrack[];
  dayparts: Daypart[];
  places: { place: string; track: string; artist: string; plays: number }[];
};

export function soundtrackSummary(journeys: readonly JourneySummary[], details: readonly JourneyDetail[], range: SoundtrackRange, now: number): SoundtrackSummary {
  const start = rangeStart(range, now);
  const detailById = new Map(details.map(detail => [detail.id, detail]));
  const inRange = journeys.filter(journey => {
    const ms = time(journey.startedAt);
    return ms !== null && (start === null || ms >= start) && ms <= now + DAY_MS;
  });
  const entries: { track: SoundtrackTrack; journeyId: string }[] = [];
  const seen = new Set<string>();
  const milesById = new Map<string, number>();
  const dayparts: Daypart[] = [
    { id: 'morning', label: 'Morning', plays: 0 }, { id: 'afternoon', label: 'Afternoon', plays: 0 },
    { id: 'evening', label: 'Evening', plays: 0 }, { id: 'night', label: 'Night', plays: 0 },
  ];
  const placeTracks = new Map<string, { track: SoundtrackTrack; journeyId: string }[]>();
  let listeningMs = 0, knownDurations = 0, totalMiles = 0, musicMiles = 0;
  for (const journey of inRange) {
    totalMiles += journey.miles;
    milesById.set(journey.id, journey.miles);
    const tracks = journeyTracks(journey, detailById);
    if (tracks.length) musicMiles += journey.miles;
    const place = placeName(journey.endingLocation) ?? placeName(journey.startingLocation);
    for (const track of tracks) {
      const identity = `${journey.id}|${track.playedAt ?? ''}|${trackKey(track)}`;
      if (seen.has(identity)) continue;
      seen.add(identity);
      entries.push({ track, journeyId: journey.id });
      if (track.durationMs && track.durationMs > 0) { listeningMs += track.durationMs; knownDurations += 1; }
      const playedMs = time(track.playedAt) ?? time(journey.startedAt);
      if (playedMs !== null) dayparts.find(part => part.id === daypartOf(new Date(playedMs).getHours()))!.plays += 1;
      if (place) placeTracks.set(place, [...(placeTracks.get(place) ?? []), { track, journeyId: journey.id }]);
    }
  }
  const ranked = rankTracks(entries);
  const anthemTrack = ranked[0] ?? null;
  const anthemMiles = anthemTrack
    ? [...new Set(entries.filter(entry => trackKey(entry.track) === trackKey(anthemTrack)).map(entry => entry.journeyId))]
      .reduce((sum, id) => sum + (milesById.get(id) ?? 0), 0)
    : 0;
  const artists = new Map<string, { artist: string; plays: number; artworkUrl: string | null }>();
  for (const { track } of entries) {
    const key = words(track.artist);
    if (!key) continue;
    const current = artists.get(key);
    if (current) { current.plays += 1; current.artworkUrl ??= track.artworkUrl; }
    else artists.set(key, { artist: track.artist, plays: 1, artworkUrl: track.artworkUrl });
  }
  const places = [...placeTracks.entries()]
    .map(([place, items]) => ({ place, total: items.length, top: rankTracks(items)[0] }))
    .filter(item => item.top)
    .sort((a, b) => b.total - a.total || a.place.localeCompare(b.place))
    .slice(0, 4)
    .map(item => ({ place: item.place, track: item.top.track, artist: item.top.artist, plays: item.top.plays }));
  return {
    plays: entries.length,
    distinctSongs: ranked.length,
    drives: inRange.length,
    listeningMinutes: knownDurations ? Math.round(listeningMs / 60_000) : null,
    musicMilesPercent: totalMiles > 0 ? Math.round((musicMiles / totalMiles) * 100) : null,
    anthem: anthemTrack ? { ...anthemTrack, miles: anthemMiles } : null,
    topArtists: [...artists.values()].sort((a, b) => b.plays - a.plays || a.artist.localeCompare(b.artist)).slice(0, 8),
    topTracks: ranked.slice(0, 5),
    dayparts,
    places,
  };
}

const EARTH_MILES = 3958.8;
function haversineMiles([lon1, lat1]: [number, number], [lon2, lat2]: [number, number]) {
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad, dLon = (lon2 - lon1) * rad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_MILES * Math.asin(Math.min(1, Math.sqrt(a)));
}

export type DriveSong = SoundtrackTrack & { mile: number | null };

/** A drive's songs in play order, each with the mile it started at when the route has timed samples. */
export function driveSongs(journey: JourneySummary, detail: JourneyDetail | null | undefined): DriveSong[] {
  const tracks = [...(detail?.soundtrack?.length ? detail.soundtrack : journey.soundtrackPreview)]
    .sort((a, b) => (time(a.playedAt) ?? 0) - (time(b.playedAt) ?? 0));
  const samples = (detail?.route?.points ?? [])
    .map(sample => ({ ms: time(sample.recordedAt), coordinate: sample.coordinate as [number, number] }))
    .filter((sample): sample is { ms: number; coordinate: [number, number] } => sample.ms !== null)
    .sort((a, b) => a.ms - b.ms);
  const cumulative: number[] = [];
  samples.forEach((sample, index) => {
    cumulative.push(index === 0 ? 0 : cumulative[index - 1] + haversineMiles(samples[index - 1].coordinate, sample.coordinate));
  });
  return tracks.map(track => {
    const played = time(track.playedAt);
    if (played === null || samples.length < 2 || played < samples[0].ms) return { ...track, mile: null };
    let index = 0;
    while (index + 1 < samples.length && samples[index + 1].ms <= played) index += 1;
    return { ...track, mile: Math.round(cumulative[index] * 10) / 10 };
  });
}

// ---------------------------------------------------------------- Search

const SEARCH_SECTIONS: { kind: SearchRecord['kind']; title: string }[] = [
  { kind: 'memory', title: 'Memories' },
  { kind: 'journey', title: 'Drives' },
  { kind: 'song', title: 'Songs' },
  { kind: 'artist', title: 'Artists' },
  { kind: 'place', title: 'Places' },
];

export function searchSections(records: readonly SearchRecord[]) {
  return SEARCH_SECTIONS
    .map(section => ({ ...section, records: records.filter(record => record.kind === section.kind) }))
    .filter(section => section.records.length > 0);
}

/** `memory:<id>` search records point at a Memory, not a journey. */
export function memoryIdFromSearch(record: Pick<SearchRecord, 'id' | 'kind'>) {
  return record.kind === 'memory' && record.id.startsWith('memory:') ? record.id.slice('memory:'.length) : null;
}
