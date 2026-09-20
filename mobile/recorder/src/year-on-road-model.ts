/** Local recap inputs. The caller supplies the full visible archive, never a dashboard preview. */
export type YearOnRoadJourney = {
  id: string;
  startedAt: string;
  endedAt?: string | null;
  miles: number;
  durationMinutes: number | null;
  startingLocation?: string | null;
  endingLocation?: string | null;
  route?: { coordinates: [number, number][] } | null;
};
export type YearOnRoadSong = {
  id?: string;
  journeyId: string | null;
  playedAt: string | null;
  track: string;
  artist: string;
  album?: string | null;
  durationMs: number | null;
  artworkUrl?: string | null;
};
export type YearOnRoadMemory = {
  id: string;
  name: string;
  journeyIds: string[];
  photoUri?: string | null;
};
export type YearOnRoadData = {
  journeys: YearOnRoadJourney[];
  songs: YearOnRoadSong[];
  memories: YearOnRoadMemory[];
  /** Optional explanation when an integration deliberately supplies a partial archive. */
  coverageNote?: string;
};
export type RecapRank = { name: string; artist?: string; plays: number; artworkUrl: string | null };
export type YearOnRoadRecap = {
  year: number; soFar: boolean; years: number[]; journeyCount: number; miles: number;
  drivingMinutes: number; measuredDurationJourneys: number; activeDays: number;
  months: { label: string; journeys: number; miles: number }[];
  dayparts: { label: string; journeys: number }[];
  busiestMonth: string | null;
  longestJourney: YearOnRoadJourney | null;
  songPlays: number; distinctSongs: number; knownSongMinutes: number; songsWithDuration: number;
  journeysWithMusic: number; topArtists: RecapRank[]; topSongs: RecapRank[];
  memories: YearOnRoadMemory[]; firstJourneyAt: string | null; lastJourneyAt: string | null;
  coverageNote: string | null;
};

function timestamp(value: string | null | undefined) {
  if (!value) return null;
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : null;
}
function validNonnegative(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}
function clean(value: string) { return value.trim().replace(/\s+/g, ' '); }
function normalized(value: string) { return clean(value).toLocaleLowerCase(); }
function stableRanks(rows: Map<string, RecapRank>) {
  return [...rows.values()].sort((a, b) => b.plays - a.plays || a.name.localeCompare(b.name)).slice(0, 5);
}

/** Calendar membership follows the device's local time, matching the journey list. */
export function buildYearOnRoadRecap(data: YearOnRoadData, requestedYear: number, now = new Date()): YearOnRoadRecap {
  const currentYear = now.getFullYear();
  const year = Number.isInteger(requestedYear) && requestedYear >= 1970 && requestedYear <= currentYear ? requestedYear : currentYear;
  const start = new Date(year, 0, 1).getTime(), end = Math.min(new Date(year + 1, 0, 1).getTime(), now.getTime() + 1);
  // IDs deduplicate repeated pages. Prefer the copy with a route/more complete data;
  // never deduplicate distinct journeys just because their timestamps match.
  const unique = new Map<string, YearOnRoadJourney>();
  for (const journey of data.journeys) {
    const time = timestamp(journey.startedAt);
    if (!journey.id || time == null || time > now.getTime()) continue;
    const existing = unique.get(journey.id);
    if (!existing || (journey.route?.coordinates.length ?? 0) > (existing.route?.coordinates.length ?? 0)) unique.set(journey.id, journey);
  }
  const years = [...new Set([currentYear, ...[...unique.values()].map(j => new Date(j.startedAt).getFullYear()).filter(y => y >= 1970)])].sort((a, b) => b - a);
  const journeys = [...unique.values()].filter(j => { const t = Date.parse(j.startedAt); return t >= start && t < end; })
    .sort((a, b) => Date.parse(a.startedAt) - Date.parse(b.startedAt) || a.id.localeCompare(b.id));
  const journeyIds = new Set(journeys.map(j => j.id));
  const months = Array.from({ length: 12 }, (_, month) => ({ label: new Date(2024, month, 1).toLocaleDateString(undefined, { month: 'short' }), journeys: 0, miles: 0 }));
  const dayparts = ['Early hours', 'Morning', 'Afternoon', 'Evening'].map(label => ({ label, journeys: 0 }));
  const activeDays = new Set<string>();
  let miles = 0, drivingMinutes = 0, measuredDurationJourneys = 0;
  let longestJourney: YearOnRoadJourney | null = null;
  for (const journey of journeys) {
    const date = new Date(journey.startedAt), month = months[date.getMonth()];
    const distance = validNonnegative(journey.miles) ? journey.miles : 0;
    miles += distance; month.miles += distance; month.journeys++;
    if (validNonnegative(journey.durationMinutes)) { drivingMinutes += journey.durationMinutes; measuredDurationJourneys++; }
    activeDays.add(`${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`);
    dayparts[Math.floor(date.getHours() / 6)].journeys++;
    if (validNonnegative(journey.miles) && (!longestJourney || journey.miles > longestJourney.miles)) longestJourney = journey;
  }
  const songEvents = new Set<string>(), songIds = new Set<string>(), musicJourneys = new Set<string>();
  const songs = new Map<string, RecapRank>(), artists = new Map<string, RecapRank>();
  let songPlays = 0, knownSongMinutes = 0, songsWithDuration = 0;
  for (const song of data.songs) {
    // Year follows the associated journey's start (also for journeys crossing
    // midnight/New Year). Unlinked provider history is never claimed as driving.
    if (!song.journeyId || !journeyIds.has(song.journeyId) || !clean(song.track)) continue;
    const playedAt = timestamp(song.playedAt);
    if (playedAt != null && playedAt > now.getTime()) continue;
    const trackKey = `${normalized(song.track)}\0${normalized(song.artist)}`;
    // Cross-provider duplicates share their actual play timestamp and title.
    // Without a timestamp only a durable ID can distinguish observations.
    const eventKey = playedAt != null ? `${song.journeyId}\0${playedAt}\0${trackKey}` : song.id ? `id:${song.id}` : null;
    if (!eventKey || songEvents.has(eventKey) || (song.id && songIds.has(song.id))) continue;
    songEvents.add(eventKey); if (song.id) songIds.add(song.id);
    songPlays++; musicJourneys.add(song.journeyId);
    if (validNonnegative(song.durationMs) && song.durationMs > 0) { knownSongMinutes += song.durationMs / 60_000; songsWithDuration++; }
    const row = songs.get(trackKey) ?? { name: clean(song.track), artist: clean(song.artist) || 'Unknown artist', plays: 0, artworkUrl: song.artworkUrl || null };
    row.plays++; if (!row.artworkUrl && song.artworkUrl) row.artworkUrl = song.artworkUrl;
    songs.set(trackKey, row);
    if (clean(song.artist)) {
      const artistKey = normalized(song.artist);
      const artist = artists.get(artistKey) ?? { name: clean(song.artist), plays: 0, artworkUrl: song.artworkUrl || null };
      artist.plays++; if (!artist.artworkUrl && song.artworkUrl) artist.artworkUrl = song.artworkUrl;
      artists.set(artistKey, artist);
    }
  }
  const memories = new Map<string, YearOnRoadMemory>();
  for (const memory of data.memories) if (memory.id && memory.journeyIds.some(id => journeyIds.has(id))) {
    memories.set(memory.id, { ...memory, journeyIds: [...new Set(memory.journeyIds.filter(id => journeyIds.has(id)))] });
  }
  const busiest = months.reduce((best, month) => month.journeys > best.journeys ? month : best, months[0]);
  return {
    year, soFar: year === currentYear, years, journeyCount: journeys.length, miles, drivingMinutes, measuredDurationJourneys,
    activeDays: activeDays.size, months, dayparts, busiestMonth: busiest.journeys ? busiest.label : null, longestJourney,
    songPlays, distinctSongs: songs.size, knownSongMinutes, songsWithDuration, journeysWithMusic: musicJourneys.size,
    topArtists: stableRanks(artists), topSongs: stableRanks(songs), memories: [...memories.values()],
    firstJourneyAt: journeys[0]?.startedAt ?? null, lastJourneyAt: journeys.at(-1)?.startedAt ?? null,
    coverageNote: data.coverageNote?.trim() || null,
  };
}

/** A compact private on-screen route silhouette. It is not an export or public map. */
export function recapRoutePath(coordinates: readonly [number, number][], width = 320, height = 220): string | null {
  const valid = coordinates.filter(pair => Number.isFinite(pair[0]) && Number.isFinite(pair[1]) && Math.abs(pair[0]) <= 180 && Math.abs(pair[1]) <= 90);
  if (valid.length < 2) return null;
  const stride = Math.max(1, Math.ceil(valid.length / 160));
  const sampled = valid.filter((_point, index) => index % stride === 0 || index === valid.length - 1);
  // Unwrap the antimeridian so a short trip near ±180° does not span the world.
  let prior = sampled[0][0];
  const points = sampled.map(([longitude, latitude]) => {
    let x = longitude;
    while (x - prior > 180) x -= 360;
    while (x - prior < -180) x += 360;
    prior = x; return [x, -latitude] as [number, number];
  });
  const bounds = points.reduce((b, [x, y]) => ({ minX: Math.min(b.minX, x), maxX: Math.max(b.maxX, x), minY: Math.min(b.minY, y), maxY: Math.max(b.maxY, y) }), { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity });
  const latitudeScale = Math.max(0.05, Math.cos(sampled[0][1] * Math.PI / 180));
  const spanX = (bounds.maxX - bounds.minX) * latitudeScale, spanY = bounds.maxY - bounds.minY;
  const scale = Math.min((width - 40) / Math.max(0.00001, spanX), (height - 40) / Math.max(0.00001, spanY));
  return points.map(([x, y], i) => `${i ? 'L' : 'M'}${(((x - bounds.minX) * latitudeScale - spanX / 2) * scale + width / 2).toFixed(1)},${(((y - bounds.minY) - spanY / 2) * scale + height / 2).toFixed(1)}`).join(' ');
}
