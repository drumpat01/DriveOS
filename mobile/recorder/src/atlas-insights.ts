import type { JourneyDetail, JourneySummary, SoundtrackTrack } from './app-data';

export type AtlasInsightWindow = '30d' | '90d' | 'all';

export type AtlasRouteDna = {
  ready: boolean;
  established: boolean;
  bidirectional: boolean;
  startLabel: string | null;
  endLabel: string | null;
  trips: number;
  averageMinutes: number | null;
  quickestMinutes: number | null;
  durationSpreadMinutes: number | null;
  averageMiles: number | null;
  route: [number, number][];
};

export type AtlasDrivingRhythms = {
  ready: boolean;
  weekdays: { label: string; journeys: number; miles: number }[];
  leadingDay: string | null;
  leadingDayJourneys: number;
  leadingTime: string | null;
};

export type AtlasExplorationScore = {
  ready: boolean;
  score: number | null;
  mappedJourneys: number;
  mappedAreas: number;
  oneJourneyAreas: number;
};

export type AtlasPlaceRelationship = {
  ready: boolean;
  startLabel: string | null;
  endLabel: string | null;
  trips: number;
  connections: { startLabel: string; endLabel: string; trips: number }[];
};

export type AtlasSoundtrackIntelligence = {
  ready: boolean;
  plays: number;
  uniqueSongs: number;
  journeysWithMusic: number;
  journeyMatchPercent: number | null;
  topArtist: string | null;
  topArtistPlays: number;
  leadingTime: string | null;
  artworkUrls: string[];
};

export type AtlasInsights = {
  window: AtlasInsightWindow;
  journeyCount: number;
  miles: number;
  mappedJourneyCount: number;
  routePointCount: number;
  songCount: number;
  activeDays: number;
  routeDna: AtlasRouteDna;
  drivingRhythms: AtlasDrivingRhythms;
  exploration: AtlasExplorationScore;
  placeRelationships: AtlasPlaceRelationship;
  soundtrack: AtlasSoundtrackIntelligence;
};

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

function epoch(value: string | null | undefined) {
  const parsed = Date.parse(value ?? '');
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizedPlace(value: string | null | undefined) {
  const label = value?.trim();
  if (!label || /^(unknown|location unavailable|unnamed|your (start|destination))/i.test(label)) return null;
  return label;
}

function isInsightVisibleJourney(journey: Pick<JourneySummary, 'startingLocation' | 'endingLocation'>) {
  const start = journey.startingLocation?.trim().toLocaleLowerCase().replace(/\s+/g, ' ') ?? '';
  const end = journey.endingLocation?.trim().toLocaleLowerCase().replace(/\s+/g, ' ') ?? '';
  return !((start === 'home' && end === 'home') || (start === 'work' && end === 'work'));
}

function routeKey(startLabel: string, endLabel: string) {
  return `${startLabel.toLocaleLowerCase()}\0${endLabel.toLocaleLowerCase()}`;
}

function corridorKey(startLabel: string, endLabel: string) {
  return [startLabel.toLocaleLowerCase(), endLabel.toLocaleLowerCase()].sort().join('\0');
}

function localDay(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function timeBucket(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  const hour = date.getHours();
  if (hour >= 5 && hour < 10) return 'Morning';
  if (hour >= 10 && hour < 16) return 'Midday';
  if (hour >= 16 && hour < 21) return 'Evening';
  return 'Night';
}

function selectJourneys(journeys: JourneySummary[], window: AtlasInsightWindow, now: Date) {
  if (window === 'all') return journeys.filter(journey => isInsightVisibleJourney(journey) && epoch(journey.startedAt) > 0);
  const days = window === '30d' ? 30 : 90;
  const cutoff = now.getTime() - days * 86_400_000;
  return journeys.filter(journey => isInsightVisibleJourney(journey) && epoch(journey.startedAt) >= cutoff);
}

function journeyTracks(journey: JourneySummary, detailById: Map<string, JourneyDetail>): SoundtrackTrack[] {
  const detail = detailById.get(journey.id);
  return detail?.soundtrack.length ? detail.soundtrack : journey.soundtrackPreview;
}

function buildRouteDna(journeys: JourneySummary[], detailById: Map<string, JourneyDetail>): AtlasRouteDna {
  const grouped = new Map<string, { journeys: JourneySummary[]; directions: Set<string> }>();
  for (const journey of journeys) {
    const startLabel = normalizedPlace(journey.startingLocation);
    const endLabel = normalizedPlace(journey.endingLocation);
    if (!startLabel || !endLabel) continue;
    const key = corridorKey(startLabel, endLabel);
    const group = grouped.get(key);
    if (group) {
      group.journeys.push(journey);
      group.directions.add(routeKey(startLabel, endLabel));
    } else {
      grouped.set(key, { journeys: [journey], directions: new Set([routeKey(startLabel, endLabel)]) });
    }
  }
  const strongest = [...grouped.values()]
    .sort((a, b) => b.journeys.length - a.journeys.length
      || b.journeys.reduce((total, journey) => total + journey.miles, 0) - a.journeys.reduce((total, journey) => total + journey.miles, 0))[0];
  const selectedJourneys = strongest?.journeys ?? (journeys[0] ? [journeys[0]] : []);
  if (!selectedJourneys.length) return { ready: false, established: false, bidirectional: false, startLabel: null, endLabel: null, trips: 0, averageMinutes: null, quickestMinutes: null, durationSpreadMinutes: null, averageMiles: null, route: [] };

  const representative = [...selectedJourneys].sort((a, b) => epoch(b.startedAt) - epoch(a.startedAt))[0];
  const startLabel = normalizedPlace(representative.startingLocation) ?? 'Recorded start';
  const endLabel = normalizedPlace(representative.endingLocation) ?? 'Recorded destination';

  const durations = selectedJourneys.map(journey => journey.durationMinutes).filter(value => Number.isFinite(value) && value > 0);
  const miles = selectedJourneys.map(journey => journey.miles).filter(value => Number.isFinite(value) && value >= 0);
  const route = [...selectedJourneys]
    .sort((a, b) => epoch(b.startedAt) - epoch(a.startedAt))
    .map(journey => detailById.get(journey.id)?.route?.coordinates ?? [])
    .find(coordinates => coordinates.length >= 2) ?? [];
  const quickestMinutes = durations.length ? Math.min(...durations) : null;
  const slowestMinutes = durations.length ? Math.max(...durations) : null;
  return {
    ready: true,
    established: selectedJourneys.length >= 2,
    bidirectional: (strongest?.directions.size ?? 0) > 1,
    startLabel,
    endLabel,
    trips: selectedJourneys.length,
    averageMinutes: durations.length ? durations.reduce((total, value) => total + value, 0) / durations.length : null,
    quickestMinutes,
    durationSpreadMinutes: quickestMinutes !== null && slowestMinutes !== null ? Math.max(0, slowestMinutes - quickestMinutes) : null,
    averageMiles: miles.length ? miles.reduce((total, value) => total + value, 0) / miles.length : null,
    route,
  };
}

function buildDrivingRhythms(journeys: JourneySummary[]): AtlasDrivingRhythms {
  const weekdays = DAY_LABELS.map(label => ({ label, journeys: 0, miles: 0 }));
  const timeCounts = new Map<string, number>();
  for (const journey of journeys) {
    const date = new Date(journey.startedAt);
    if (!Number.isFinite(date.getTime())) continue;
    weekdays[date.getDay()].journeys += 1;
    weekdays[date.getDay()].miles += Number.isFinite(journey.miles) ? journey.miles : 0;
    const bucket = timeBucket(journey.startedAt);
    if (bucket) timeCounts.set(bucket, (timeCounts.get(bucket) ?? 0) + 1);
  }
  const leading = [...weekdays].sort((a, b) => b.journeys - a.journeys || b.miles - a.miles)[0];
  const leadingTime = [...timeCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  return {
    ready: journeys.length >= 3,
    weekdays,
    leadingDay: leading?.journeys ? leading.label : null,
    leadingDayJourneys: leading?.journeys ?? 0,
    leadingTime,
  };
}

function routeAreaKey([longitude, latitude]: [number, number]) {
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return null;
  // A roughly 150–220 m grid is broad enough to absorb ordinary GPS drift.
  return `${Math.round(latitude / 0.002)}:${Math.round(longitude / 0.002)}`;
}

function buildExploration(journeys: JourneySummary[], detailById: Map<string, JourneyDetail>): AtlasExplorationScore {
  const areaVisits = new Map<string, number>();
  let mappedJourneys = 0;
  for (const journey of journeys) {
    const coordinates = detailById.get(journey.id)?.route?.coordinates ?? [];
    const journeyAreas = new Set(coordinates.map(routeAreaKey).filter((value): value is string => Boolean(value)));
    if (journeyAreas.size < 2) continue;
    mappedJourneys += 1;
    for (const area of journeyAreas) areaVisits.set(area, (areaVisits.get(area) ?? 0) + 1);
  }
  const mappedAreas = areaVisits.size;
  const oneJourneyAreas = [...areaVisits.values()].filter(visits => visits === 1).length;
  const ready = mappedJourneys >= 2 && mappedAreas >= 10;
  return {
    ready,
    score: ready ? Math.round((oneJourneyAreas / mappedAreas) * 100) : null,
    mappedJourneys,
    mappedAreas,
    oneJourneyAreas,
  };
}

function buildPlaceRelationships(journeys: JourneySummary[]): AtlasPlaceRelationship {
  const edges = new Map<string, { startLabel: string; endLabel: string; trips: number }>();
  for (const journey of journeys) {
    const startLabel = normalizedPlace(journey.startingLocation);
    const endLabel = normalizedPlace(journey.endingLocation);
    if (!startLabel || !endLabel) continue;
    const key = routeKey(startLabel, endLabel);
    const edge = edges.get(key);
    if (edge) edge.trips += 1;
    else edges.set(key, { startLabel, endLabel, trips: 1 });
  }
  const connections = [...edges.values()].sort((a, b) => b.trips - a.trips || a.startLabel.localeCompare(b.startLabel)).slice(0, 4);
  const strongest = connections[0];
  return {
    ready: Boolean(strongest && (strongest.trips >= 2 || connections.length >= 2)),
    startLabel: strongest?.startLabel ?? null,
    endLabel: strongest?.endLabel ?? null,
    trips: strongest?.trips ?? 0,
    connections,
  };
}

function buildSoundtrack(journeys: JourneySummary[], detailById: Map<string, JourneyDetail>): AtlasSoundtrackIntelligence {
  const tracks = journeys.flatMap(journey => journeyTracks(journey, detailById));
  const journeysWithMusic = journeys.filter(journey => journeyTracks(journey, detailById).length > 0).length;
  const artists = new Map<string, { label: string; plays: number }>();
  const songKeys = new Set<string>();
  const timeCounts = new Map<string, number>();
  const artworkUrls: string[] = [];
  for (const track of tracks) {
    const artist = track.artist.trim();
    if (artist) {
      const key = artist.toLocaleLowerCase();
      const current = artists.get(key);
      artists.set(key, { label: current?.label ?? artist, plays: (current?.plays ?? 0) + 1 });
    }
    songKeys.add(`${track.track.trim().toLocaleLowerCase()}\0${artist.toLocaleLowerCase()}`);
    const bucket = timeBucket(track.playedAt ?? '');
    if (bucket) timeCounts.set(bucket, (timeCounts.get(bucket) ?? 0) + 1);
    if (track.artworkUrl && !artworkUrls.includes(track.artworkUrl)) artworkUrls.push(track.artworkUrl);
  }
  const topArtist = [...artists.values()].sort((a, b) => b.plays - a.plays || a.label.localeCompare(b.label))[0];
  const leadingTime = [...timeCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  return {
    ready: tracks.length >= 2,
    plays: tracks.length,
    uniqueSongs: songKeys.size,
    journeysWithMusic,
    journeyMatchPercent: journeys.length ? Math.round((journeysWithMusic / journeys.length) * 100) : null,
    topArtist: topArtist?.label ?? null,
    topArtistPlays: topArtist?.plays ?? 0,
    leadingTime,
    artworkUrls: artworkUrls.slice(0, 4),
  };
}

export function buildAtlasInsights(
  journeys: JourneySummary[],
  details: JourneyDetail[],
  window: AtlasInsightWindow = '30d',
  now = new Date(),
): AtlasInsights {
  const selectedJourneys = selectJourneys(journeys, window, now).sort((a, b) => epoch(b.startedAt) - epoch(a.startedAt));
  const selectedIds = new Set(selectedJourneys.map(journey => journey.id));
  const selectedDetails = details.filter(detail => selectedIds.has(detail.id));
  const detailById = new Map(selectedDetails.map(detail => [detail.id, detail]));
  const tracks = selectedJourneys.flatMap(journey => journeyTracks(journey, detailById));
  const routeDetails = selectedDetails.filter(detail => (detail.route?.coordinates.length ?? 0) >= 2);
  return {
    window,
    journeyCount: selectedJourneys.length,
    miles: selectedJourneys.reduce((total, journey) => total + (Number.isFinite(journey.miles) ? journey.miles : 0), 0),
    mappedJourneyCount: routeDetails.length,
    routePointCount: routeDetails.reduce((total, detail) => total + (detail.route?.coordinates.length ?? 0), 0),
    songCount: tracks.length,
    activeDays: new Set(selectedJourneys.map(journey => localDay(journey.startedAt)).filter(Boolean)).size,
    routeDna: buildRouteDna(selectedJourneys, detailById),
    drivingRhythms: buildDrivingRhythms(selectedJourneys),
    exploration: buildExploration(selectedJourneys, detailById),
    placeRelationships: buildPlaceRelationships(selectedJourneys),
    soundtrack: buildSoundtrack(selectedJourneys, detailById),
  };
}
