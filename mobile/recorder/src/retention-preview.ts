export const DEFAULT_RETENTION_DAYS = 30;

export type RetentionJourneyCandidate = {
  id: string;
  legacyDriveId: string | null;
  provider: string | null;
  startedAt: string;
  routePointCount: number;
  matchedSongCount: number;
};

export type RetentionCount = {
  total: number;
  kept: number;
  removable: number;
};

export type LocalRetentionPreview = {
  generatedAt: string;
  cutoffAt: string;
  retentionDays: number;
  counts: {
    journeys: RetentionCount;
    routePoints: RetentionCount;
    songs: RetentionCount;
    memories: RetentionCount;
    collections: RetentionCount;
  };
  safeguards: {
    nativeJourneyDeckJourneys: number;
    collectionProtectedJourneys: number;
    recentGoogleTimelineJourneys: number;
    oldUnmatchedSpotifySongs: number;
  };
};

export type BuildRetentionPreviewInput = {
  journeys: RetentionJourneyCandidate[];
  protectedJourneyIds: ReadonlySet<string>;
  totalSongCount: number;
  oldUnmatchedSpotifySongCount: number;
  memoryCount: number;
  collectionCount: number;
  now?: Date;
  retentionDays?: number;
};

function normalized(value: string | null) {
  return value?.trim().toLocaleLowerCase().replaceAll('-', '_').replaceAll(' ', '_') ?? '';
}

export function isGoogleTimelineJourney(journey: Pick<RetentionJourneyCandidate, 'provider' | 'legacyDriveId'>) {
  const provider = normalized(journey.provider);
  const legacyId = normalized(journey.legacyDriveId);
  return provider === 'google_timeline' || legacyId.startsWith('google_timeline:');
}

export function buildRetentionPreview(input: BuildRetentionPreviewInput): LocalRetentionPreview {
  const now = input.now ?? new Date();
  const retentionDays = input.retentionDays ?? DEFAULT_RETENTION_DAYS;
  const cutoff = new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1_000);
  let removableJourneys = 0;
  let removableRoutePoints = 0;
  let removableMatchedSongs = 0;
  let totalRoutePoints = 0;
  let nativeJourneyDeckJourneys = 0;
  let collectionProtectedJourneys = 0;
  let recentGoogleTimelineJourneys = 0;

  for (const journey of input.journeys) {
    totalRoutePoints += Math.max(0, journey.routePointCount);
    if (normalized(journey.provider) === 'native_recorder') nativeJourneyDeckJourneys += 1;

    const protectedByCollection = input.protectedJourneyIds.has(journey.id)
      || Boolean(journey.legacyDriveId && input.protectedJourneyIds.has(journey.legacyDriveId));
    if (protectedByCollection) collectionProtectedJourneys += 1;

    const startedAt = Date.parse(journey.startedAt);
    const oldEnough = Number.isFinite(startedAt) && startedAt < cutoff.getTime();
    const googleTimeline = isGoogleTimelineJourney(journey);
    if (googleTimeline && !oldEnough) recentGoogleTimelineJourneys += 1;

    if (!googleTimeline || !oldEnough || protectedByCollection) continue;
    removableJourneys += 1;
    removableRoutePoints += Math.max(0, journey.routePointCount);
    removableMatchedSongs += Math.max(0, journey.matchedSongCount);
  }

  const totalSongs = Math.max(0, input.totalSongCount);
  const oldUnmatchedSpotifySongs = Math.max(0, input.oldUnmatchedSpotifySongCount);
  const removableSongs = Math.min(totalSongs, removableMatchedSongs + oldUnmatchedSpotifySongs);
  const count = (total: number, removable: number): RetentionCount => ({
    total,
    kept: Math.max(0, total - removable),
    removable: Math.max(0, removable),
  });

  return {
    generatedAt: now.toISOString(),
    cutoffAt: cutoff.toISOString(),
    retentionDays,
    counts: {
      journeys: count(input.journeys.length, removableJourneys),
      routePoints: count(totalRoutePoints, removableRoutePoints),
      songs: count(totalSongs, removableSongs),
      memories: count(Math.max(0, input.memoryCount), 0),
      collections: count(Math.max(0, input.collectionCount), 0),
    },
    safeguards: {
      nativeJourneyDeckJourneys,
      collectionProtectedJourneys,
      recentGoogleTimelineJourneys,
      oldUnmatchedSpotifySongs,
    },
  };
}
