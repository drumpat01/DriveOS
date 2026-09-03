import type { PrimarySectionsData } from './primary-sections-data';
import type { SoundtrackTrack } from './app-data';

export type HomeSummary = {
  archive: { journeys: number; memories: number; places: number };
  memorySpotlight: { id: string; name: string; journeys: number; photos: number } | null;
  topTrack: { track: string; artist: string; artworkUrl: string | null; plays: number } | null;
  latestTrack: SoundtrackTrack | null;
  favoriteRoute: { label: string; count: number; averageMiles: number } | null;
  topPlace: { id: string; name: string; visits: number } | null;
  charging: { sessions: number; energyKwh: number; cost: number };
  roadScore: number | null;
  timelineEvents: number;
};

function normalized(value: string | null | undefined) {
  return (value ?? '').trim().toLocaleLowerCase().replace(/\s+/g, ' ');
}

function safeEpoch(value: string | null | undefined) {
  const epoch = Date.parse(value ?? '');
  return Number.isFinite(epoch) ? epoch : 0;
}

function latestTrackFrom(data: PrimarySectionsData): SoundtrackTrack | null {
  const candidates: SoundtrackTrack[] = [
    ...(data.live?.music ?? []),
    ...(data.music?.recentSelections ?? []),
  ];
  const latest = [...candidates].sort((left, right) => safeEpoch(right.playedAt) - safeEpoch(left.playedAt))[0] ?? null;
  if (!latest) return null;

  // Artwork may arrive shortly after the playback observation. Only borrow a
  // cached cover from an exact title + artist match so the card can never pair
  // the latest song with another track's artwork.
  const matchingArtwork = candidates.find(candidate => candidate.artworkUrl
    && normalized(candidate.track) === normalized(latest.track)
    && normalized(candidate.artist) === normalized(latest.artist));
  return { ...latest, artworkUrl: latest.artworkUrl ?? matchingArtwork?.artworkUrl ?? null };
}

function topTrackFrom(data: PrimarySectionsData) {
  const details = new Map(data.details.map(detail => [detail.id, detail]));
  const tracks = new Map<string, { track: string; artist: string; artworkUrl: string | null; plays: number }>();
  data.journeys.forEach(journey => (details.get(journey.id)?.soundtrack ?? journey.soundtrackPreview).forEach(track => {
    const key = `${normalized(track.track)}::${normalized(track.artist)}`;
    const current = tracks.get(key);
    tracks.set(key, current ? { ...current, plays: current.plays + 1, artworkUrl: current.artworkUrl ?? track.artworkUrl } : { track: track.track, artist: track.artist, artworkUrl: track.artworkUrl, plays: 1 });
  }));
  return [...tracks.values()].sort((a, b) => b.plays - a.plays || a.track.localeCompare(b.track))[0] ?? null;
}

function favoriteRouteFrom(data: PrimarySectionsData) {
  const routes = new Map<string, typeof data.journeys>();
  data.journeys.forEach(journey => {
    const start = normalized(journey.startingLocationKey || journey.startingLocation);
    const end = normalized(journey.endingLocationKey || journey.endingLocation);
    if (!start || !end) return;
    const key = `${start}::${end}`;
    routes.set(key, [...(routes.get(key) ?? []), journey]);
  });
  const group = [...routes.values()].filter(items => items.length >= 2).sort((a, b) => b.length - a.length)[0];
  if (!group) return null;
  return {
    label: `${group[0].startingLocation || 'Unknown start'} → ${group[0].endingLocation || 'Unknown destination'}`,
    count: group.length,
    averageMiles: group.reduce((sum, journey) => sum + journey.miles, 0) / group.length,
  };
}

export function buildHomeSummary(data: PrimarySectionsData): HomeSummary {
  const latestMemory = [...data.memories.memories].sort((a, b) => Date.parse(b.updatedAtUtc) - Date.parse(a.updatedAtUtc))[0] ?? null;
  const topTrack = topTrackFrom(data);
  const route = favoriteRouteFrom(data);
  const topPlace = [...data.vehicle.places].sort((a, b) => b.visitCount - a.visitCount || b.lastSeenAt.localeCompare(a.lastSeenAt))[0] ?? null;
  return {
    archive: {
      journeys: data.journeys.length,
      memories: data.memories.memories.length,
      places: data.vehicle.places.length,
    },
    memorySpotlight: latestMemory ? {
      id: latestMemory.id,
      name: latestMemory.name,
      journeys: latestMemory.journeyIds.length,
      photos: latestMemory.photos.length,
    } : null,
    topTrack,
    latestTrack: latestTrackFrom(data),
    favoriteRoute: route ? { label: route.label, count: route.count, averageMiles: route.averageMiles } : null,
    topPlace: topPlace ? { id: topPlace.id, name: topPlace.name, visits: topPlace.visitCount } : null,
    charging: {
      sessions: data.vehicle.chargingSummary30Days.sessions,
      energyKwh: data.vehicle.chargingSummary30Days.energyAddedKwh,
      cost: data.vehicle.chargingSummary30Days.cost,
    },
    roadScore: data.statistics.score,
    timelineEvents: data.timeline.reduce((sum, day) => sum + day.items.length, 0),
  };
}
