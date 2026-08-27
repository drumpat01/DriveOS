import {
  appDataClient,
  type AppDashboard,
  type ChargingSessionSummary,
  type JourneyDetail,
  type JourneySummary,
  type MemoriesCatalog,
  type MusicDashboardData,
  type SavedPlaceIntelligence,
  type SoundtrackTrack,
  type VehicleIntelligenceData,
} from './app-data';
import { getCurrentUser } from './auth';
import { getLiveRecorderSnapshot, readAppCache, writeAppCache, type LiveRecorderSnapshot } from './storage';

export type TimelineItem = {
  id: string;
  kind: 'journey' | 'song' | 'charging' | 'vehicle';
  occurredAt: string;
  title: string;
  detail: string;
  journeyId?: string;
  artworkUrl?: string | null;
  route?: [number, number][];
};

export type TimelineDay = { key: string; label: string; items: TimelineItem[]; routes: { id: string; coordinates: [number, number][] }[] };
export type StatisticMetric = { value: number; previous: number; changePercent: number | null };
export type StatisticsData = {
  score: number | null;
  scoreDetail: string;
  current: { miles: StatisticMetric; energyKwh: StatisticMetric; journeys: StatisticMetric; songs: StatisticMetric; efficiencyWhPerMile: StatisticMetric };
  dailyMiles: { date: string; label: string; miles: number }[];
  streakDays: number;
  highlights: { label: string; value: string; journeyId?: string }[];
  monthlyArchive: { key: string; label: string; miles: number; journeys: number; energyKwh: number; songs: number }[];
};

export type SearchRecord = {
  id: string;
  kind: 'journey' | 'song' | 'artist' | 'place' | 'collection' | 'memory';
  title: string;
  subtitle: string;
  keywords: string;
  journeyId?: string;
  artworkUrl?: string | null;
};

export type AtlasPatternReview = 'confirmed' | 'dismissed' | null;
export type AtlasPattern = VehicleIntelligenceData['routeComparisons'][number] & { id: string; review: AtlasPatternReview };

export type PrimarySectionsData = {
  loadedAt: string;
  dashboard: AppDashboard;
  journeys: JourneySummary[];
  details: JourneyDetail[];
  memories: MemoriesCatalog;
  music: MusicDashboardData;
  vehicle: VehicleIntelligenceData;
  live: LiveRecorderSnapshot;
  timeline: TimelineDay[];
  statistics: StatisticsData;
  search: SearchRecord[];
  atlasPatterns: AtlasPattern[];
};

const patternReviewKey = (userId: string) => `primary.atlas-pattern-reviews.${userId}.v1`;
const primarySectionsCacheKey = (userId: string) => `primary.sections.${userId}.v1`;

function safeEpoch(value: string) {
  const epoch = Date.parse(value);
  return Number.isFinite(epoch) ? epoch : 0;
}

function localDayKey(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'unknown';
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function monthKey(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'unknown';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function routeLabel(journey: JourneySummary) {
  return `${journey.startingLocation || 'Unknown start'} → ${journey.endingLocation || 'Unknown destination'}`;
}

function percentChange(value: number, previous: number) {
  if (previous === 0) return value === 0 ? 0 : null;
  return Math.round(((value - previous) / previous) * 1_000) / 10;
}

function metric(value: number, previous: number): StatisticMetric {
  return { value, previous, changePercent: percentChange(value, previous) };
}

function sum<T>(values: T[], select: (value: T) => number) {
  return values.reduce((total, value) => total + (Number.isFinite(select(value)) ? select(value) : 0), 0);
}

export function buildTimeline(
  journeys: JourneySummary[],
  details: JourneyDetail[],
  chargingSessions: ChargingSessionSummary[],
): TimelineDay[] {
  const detailById = new Map(details.map(detail => [detail.id, detail]));
  const items: TimelineItem[] = [];
  for (const journey of journeys) {
    const detail = detailById.get(journey.id);
    items.push({
      id: `journey:${journey.id}`,
      kind: 'journey',
      occurredAt: journey.startedAt,
      title: routeLabel(journey),
      detail: `${journey.miles.toFixed(1)} mi · ${Math.round(journey.durationMinutes)} min`,
      journeyId: journey.id,
      route: detail?.route?.coordinates,
    });
    const soundtrack = detail?.soundtrack.length ? detail.soundtrack : journey.soundtrackPreview;
    soundtrack.forEach((track, index) => items.push({
      id: `song:${journey.id}:${track.playedAt ?? index}:${track.track}`,
      kind: 'song',
      occurredAt: track.playedAt || journey.startedAt,
      title: track.track,
      detail: `${track.artist} · ${routeLabel(journey)}`,
      journeyId: journey.id,
      artworkUrl: track.artworkUrl,
    }));
    if (detail && (detail.startingBatteryPercent !== null || detail.endingBatteryPercent !== null)) {
      const start = detail.startingBatteryPercent === null ? '—' : `${Math.round(detail.startingBatteryPercent)}%`;
      const end = detail.endingBatteryPercent === null ? '—' : `${Math.round(detail.endingBatteryPercent)}%`;
      items.push({
        id: `vehicle:${journey.id}`,
        kind: 'vehicle',
        occurredAt: journey.endedAt,
        title: 'Vehicle journey summary',
        detail: `Battery ${start} → ${end}${detail.energyUsedKwh === null ? '' : ` · ${detail.energyUsedKwh.toFixed(1)} kWh used`}`,
        journeyId: journey.id,
      });
    }
  }
  for (const charge of chargingSessions) items.push({
    id: `charging:${charge.id}`,
    kind: 'charging',
    occurredAt: charge.startedAt,
    title: charge.isSupercharger ? 'Supercharging' : 'Charging',
    detail: `${charge.location} · ${charge.energyAddedKwh.toFixed(1)} kWh · ${Math.round(charge.durationMinutes)} min`,
  });

  const grouped = new Map<string, TimelineItem[]>();
  for (const item of items.sort((a, b) => safeEpoch(b.occurredAt) - safeEpoch(a.occurredAt))) {
    const key = localDayKey(item.occurredAt);
    grouped.set(key, [...(grouped.get(key) ?? []), item]);
  }
  return [...grouped.entries()].map(([key, dayItems]) => ({
    key,
    label: key === 'unknown' ? 'Date unavailable' : new Date(`${key}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }),
    items: dayItems,
    routes: dayItems.filter(item => item.kind === 'journey' && item.route?.length).map(item => ({ id: item.id, coordinates: item.route! })),
  }));
}

type PeriodTotals = { miles: number; energyKwh: number; journeys: number; songs: number; efficiencyWhPerMile: number };

function periodTotals(journeys: JourneySummary[], detailById: Map<string, JourneyDetail>): PeriodTotals {
  const details = journeys.map(journey => detailById.get(journey.id)).filter((value): value is JourneyDetail => Boolean(value));
  const miles = sum(journeys, journey => journey.miles);
  const energyKwh = sum(details, detail => detail.energyUsedKwh ?? 0);
  const energyMiles = sum(details.filter(detail => detail.energyUsedKwh !== null), detail => detail.miles);
  return {
    miles,
    energyKwh,
    journeys: journeys.length,
    songs: sum(journeys, journey => journey.songCount),
    efficiencyWhPerMile: energyMiles > 0 ? (energyKwh * 1_000) / energyMiles : 0,
  };
}

export function buildStatistics(journeys: JourneySummary[], details: JourneyDetail[], now = new Date()): StatisticsData {
  const detailById = new Map(details.map(detail => [detail.id, detail]));
  const currentStart = now.getTime() - 30 * 86_400_000;
  const previousStart = currentStart - 30 * 86_400_000;
  const currentJourneys = journeys.filter(journey => safeEpoch(journey.startedAt) >= currentStart);
  const previousJourneys = journeys.filter(journey => safeEpoch(journey.startedAt) >= previousStart && safeEpoch(journey.startedAt) < currentStart);
  const current = periodTotals(currentJourneys, detailById);
  const previous = periodTotals(previousJourneys, detailById);

  const dailyMiles = Array.from({ length: 30 }, (_, index) => {
    const date = new Date(now);
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() - (29 - index));
    const key = localDayKey(date.toISOString());
    return { date: key, label: date.toLocaleDateString(undefined, { weekday: 'short' }).slice(0, 1), miles: sum(journeys.filter(journey => localDayKey(journey.startedAt) === key), journey => journey.miles) };
  });

  const drivenDays = new Set(journeys.map(journey => localDayKey(journey.startedAt)));
  let streakDays = 0;
  const cursor = new Date(now); cursor.setHours(12, 0, 0, 0);
  if (!drivenDays.has(localDayKey(cursor.toISOString()))) cursor.setDate(cursor.getDate() - 1);
  while (drivenDays.has(localDayKey(cursor.toISOString()))) { streakDays += 1; cursor.setDate(cursor.getDate() - 1); }

  const speedConsistency = currentJourneys
    .filter(journey => journey.averageSpeedMph && journey.maxSpeedMph)
    .map(journey => Math.min(1, (journey.averageSpeedMph! * 1.8) / Math.max(journey.maxSpeedMph!, 1)));
  const consistencyScore = speedConsistency.length ? (sum(speedConsistency, value => value) / speedConsistency.length) * 35 : 0;
  const efficiencyScore = current.efficiencyWhPerMile > 0 ? Math.max(0, Math.min(45, 45 - Math.max(0, current.efficiencyWhPerMile - 240) * 0.15)) : 0;
  const captureScore = currentJourneys.length ? Math.min(20, (details.filter(detail => currentJourneys.some(journey => journey.id === detail.id)).length / currentJourneys.length) * 20) : 0;
  const score = speedConsistency.length || current.efficiencyWhPerMile > 0 ? Math.round(consistencyScore + efficiencyScore + captureScore) : null;

  const longest = [...journeys].sort((a, b) => b.miles - a.miles)[0];
  const musical = [...journeys].sort((a, b) => b.songCount - a.songCount)[0];
  const efficient = details.filter(detail => detail.energyUsedKwh && detail.miles > 0).sort((a, b) => (a.energyUsedKwh! / a.miles) - (b.energyUsedKwh! / b.miles))[0];
  const monthly = new Map<string, { key: string; label: string; miles: number; journeys: number; energyKwh: number; songs: number }>();
  for (const journey of journeys) {
    const key = monthKey(journey.startedAt), existing = monthly.get(key);
    const energy = detailById.get(journey.id)?.energyUsedKwh ?? 0;
    if (existing) { existing.miles += journey.miles; existing.journeys += 1; existing.energyKwh += energy; existing.songs += journey.songCount; }
    else monthly.set(key, { key, label: new Date(`${key}-15T12:00:00`).toLocaleDateString(undefined, { month: 'long', year: 'numeric' }), miles: journey.miles, journeys: 1, energyKwh: energy, songs: journey.songCount });
  }

  return {
    score,
    scoreDetail: 'Efficiency, speed consistency, and capture quality · not a safety rating',
    current: {
      miles: metric(current.miles, previous.miles), energyKwh: metric(current.energyKwh, previous.energyKwh),
      journeys: metric(current.journeys, previous.journeys), songs: metric(current.songs, previous.songs),
      efficiencyWhPerMile: metric(current.efficiencyWhPerMile, previous.efficiencyWhPerMile),
    },
    dailyMiles,
    streakDays,
    highlights: [
      ...(longest ? [{ label: 'Longest drive', value: `${longest.miles.toFixed(1)} mi · ${routeLabel(longest)}`, journeyId: longest.id }] : []),
      ...(musical?.songCount ? [{ label: 'Most musical', value: `${musical.songCount} songs · ${routeLabel(musical)}`, journeyId: musical.id }] : []),
      ...(efficient ? [{ label: 'Most efficient', value: `${Math.round((efficient.energyUsedKwh! * 1_000) / efficient.miles)} Wh/mi · ${routeLabel(efficient)}`, journeyId: efficient.id }] : []),
    ],
    monthlyArchive: [...monthly.values()].sort((a, b) => b.key.localeCompare(a.key)).map(value => ({ ...value, miles: Math.round(value.miles * 10) / 10, energyKwh: Math.round(value.energyKwh * 10) / 10 })),
  };
}

function pushTrack(records: SearchRecord[], seen: Set<string>, track: SoundtrackTrack, journeyId?: string) {
  const songKey = `${track.track.toLocaleLowerCase()}\0${track.artist.toLocaleLowerCase()}`;
  if (!seen.has(`song:${songKey}`)) {
    seen.add(`song:${songKey}`);
    records.push({ id: `song:${songKey}`, kind: 'song', title: track.track, subtitle: track.artist, keywords: `${track.track} ${track.artist} ${track.album ?? ''}`, journeyId, artworkUrl: track.artworkUrl });
  }
  const artistKey = track.artist.toLocaleLowerCase();
  if (!seen.has(`artist:${artistKey}`)) {
    seen.add(`artist:${artistKey}`);
    records.push({ id: `artist:${artistKey}`, kind: 'artist', title: track.artist, subtitle: 'Artist in your journey archive', keywords: track.artist, artworkUrl: track.artworkUrl });
  }
}

export function buildSearchRecords(journeys: JourneySummary[], details: JourneyDetail[], memories: MemoriesCatalog, places: SavedPlaceIntelligence[]): SearchRecord[] {
  const records: SearchRecord[] = [], seen = new Set<string>();
  const detailById = new Map(details.map(detail => [detail.id, detail]));
  for (const journey of journeys) {
    records.push({ id: `journey:${journey.id}`, kind: 'journey', title: routeLabel(journey), subtitle: `${new Date(journey.startedAt).toLocaleDateString()} · ${journey.miles.toFixed(1)} mi`, keywords: `${routeLabel(journey)} ${journey.vehicleName ?? ''} ${journey.provider ?? ''}`, journeyId: journey.id });
    const tracks = detailById.get(journey.id)?.soundtrack ?? journey.soundtrackPreview;
    tracks.forEach(track => pushTrack(records, seen, track, journey.id));
  }
  for (const place of places) records.push({ id: `place:${place.id}`, kind: 'place', title: place.name, subtitle: `${place.visitCount} visits · ${place.category}`, keywords: `${place.name} ${place.category}` });
  for (const collection of memories.collections) records.push({ id: `collection:${collection.id}`, kind: 'collection', title: collection.name, subtitle: `${collection.driveIds.length} journeys`, keywords: `${collection.name} ${collection.description}` });
  for (const memory of memories.memories) records.push({ id: `memory:${memory.id}`, kind: 'memory', title: memory.name, subtitle: memory.notes || 'Memory', keywords: `${memory.name} ${memory.notes}` });
  return records;
}

export function searchPrimarySections(records: SearchRecord[], query: string) {
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return records.slice(0, 18);
  return records.map(record => {
    const title = record.title.toLocaleLowerCase(), haystack = `${title} ${record.subtitle} ${record.keywords}`.toLocaleLowerCase();
    if (!terms.every(term => haystack.includes(term))) return null;
    const score = terms.reduce((total, term) => total + (title === term ? 6 : title.startsWith(term) ? 4 : title.includes(term) ? 2 : 1), 0);
    return { record, score };
  }).filter((value): value is { record: SearchRecord; score: number } => Boolean(value)).sort((a, b) => b.score - a.score || a.record.title.localeCompare(b.record.title)).slice(0, 60).map(value => value.record);
}

function localPatternPlaceId(label: string) {
  let hash = 2166136261;
  for (const character of label.trim().toLocaleLowerCase()) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  return `place_pattern_${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

export function buildAtlasPatterns(journeys: JourneySummary[], vehicle: VehicleIntelligenceData): AtlasPattern[] {
  const reviews = readAppCache<Record<string, AtlasPatternReview>>(patternReviewKey(getCurrentUser().id)) ?? {};
  const remote = vehicle.routeComparisons.filter(route => route.trips >= 2);
  const remoteKeys = new Set(remote.map(route => `${route.startLabel.trim().toLocaleLowerCase()}\0${route.endLabel.trim().toLocaleLowerCase()}`));
  const grouped = new Map<string, { startLabel: string; endLabel: string; trips: number; miles: number }>();
  for (const journey of journeys) {
    const startLabel = journey.startingLocation?.trim(), endLabel = journey.endingLocation?.trim();
    if (!startLabel || !endLabel) continue;
    const key = `${startLabel.toLocaleLowerCase()}\0${endLabel.toLocaleLowerCase()}`;
    const existing = grouped.get(key);
    if (existing) { existing.trips += 1; existing.miles += journey.miles; }
    else grouped.set(key, { startLabel, endLabel, trips: 1, miles: journey.miles });
  }
  const local: VehicleIntelligenceData['routeComparisons'] = [...grouped.entries()]
    .filter(([key, value]) => value.trips >= 2 && !remoteKeys.has(key))
    .map(([, value]) => ({
      startPlaceId: localPatternPlaceId(value.startLabel), endPlaceId: localPatternPlaceId(value.endLabel),
      startLabel: value.startLabel, endLabel: value.endLabel, trips: value.trips, miles: value.miles,
      energyKwh: 0, cost: 0, averageWhPerMile: 0, bestWhPerMile: 0, worstWhPerMile: 0,
    }));
  return [...remote, ...local].sort((a, b) => b.trips - a.trips || b.miles - a.miles).map(route => {
    const id = `${route.startPlaceId}:${route.endPlaceId}`;
    return { ...route, id, review: reviews[id] ?? null };
  });
}

export function saveAtlasPatternReview(patternId: string, review: Exclude<AtlasPatternReview, null>) {
  const key = patternReviewKey(getCurrentUser().id), reviews = readAppCache<Record<string, AtlasPatternReview>>(key) ?? {};
  writeAppCache(key, { ...reviews, [patternId]: review });
}

async function loadJourneyArchive(maxPages = 8, refreshRemote = false) {
  const journeys: JourneySummary[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < maxPages; page += 1) {
    const result = await appDataClient.journeys(50, cursor, refreshRemote);
    const existing = new Set(journeys.map(journey => journey.id));
    journeys.push(...result.items.filter(journey => !existing.has(journey.id)));
    if (!result.nextCursor || result.items.length === 0) break;
    cursor = result.nextCursor;
  }
  return journeys;
}

export async function loadPrimarySectionsData(forceRefresh = false): Promise<PrimarySectionsData> {
  const cacheKey = primarySectionsCacheKey(getCurrentUser().id);
  const [dashboard, journeys, memories, music, vehicle] = await Promise.all([
    appDataClient.dashboard(forceRefresh).catch(() => appDataClient.localDashboard()),
    loadJourneyArchive(8, forceRefresh), appDataClient.memories(forceRefresh), appDataClient.musicDashboard(false), appDataClient.vehicleIntelligence(forceRefresh),
  ]);
  const detailCandidates = journeys.slice(0, 18);
  const details = (await Promise.all(detailCandidates.map(journey => {
    const local = appDataClient.localOrCachedJourney(journey.id);
    return local ? Promise.resolve(local) : appDataClient.journey(journey.id).catch(() => null);
  })))
    .filter((detail): detail is JourneyDetail => Boolean(detail));
  const data: PrimarySectionsData = {
    loadedAt: new Date().toISOString(), dashboard, journeys, details, memories, music, vehicle,
    live: getLiveRecorderSnapshot(),
    timeline: buildTimeline(journeys, details, vehicle.chargingSessions),
    statistics: buildStatistics(journeys, details),
    search: buildSearchRecords(journeys, details, memories, vehicle.places),
    atlasPatterns: buildAtlasPatterns(journeys, vehicle),
  };
  writeAppCache(cacheKey, data);
  return data;
}
