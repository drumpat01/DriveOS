import { getCurrentUser } from './auth';
import { getMasterDatabase } from './database-owner';
import { getJourney, getJourneyRouteSamples, getMemoryIncludingDeleted, getPhotoIncludingDeleted, initializeLocalStore, listMemories } from './local-store';
import { isVisibleJourney } from './journey-visibility';
import type { PhotoMatchJourney } from './photo-matching-model';
import type { YearOnRoadData } from './year-on-road-model';

export function parseJourneyIds(value: string): string[] {
  try { const parsed: unknown = JSON.parse(value); return Array.isArray(parsed) ? [...new Set(parsed.filter((id): id is string => typeof id === 'string'))] : []; }
  catch { return []; }
}

export function loadPhotoMatchingMemory(userId: string, memoryId: string) {
  if (getCurrentUser().id !== userId) throw new Error('Your profile changed. Reopen this Memory.');
  const memory = getMemoryIncludingDeleted(userId, memoryId);
  if (!memory || memory.deletedAt) throw new Error('This Memory is no longer available.');
  const candidates = parseJourneyIds(memory.journeyIds).flatMap(id => { const journey = getJourney(userId, id); return journey ? [journey] : []; })
    .filter(journey => Number.isFinite(Date.parse(journey.startedAt)) && Date.parse(journey.endedAt) >= Date.parse(journey.startedAt) && Date.parse(journey.endedAt) - Date.parse(journey.startedAt) <= 30 * 86400_000)
    .sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt)).slice(0, 30);
  const journeys: PhotoMatchJourney[] = candidates.map(journey => {
    const samples = getJourneyRouteSamples(userId, journey.id);
    const stride = Math.max(1, Math.ceil(samples.length / 2000));
    return { id: journey.id, title: new Date(journey.startedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ' journey',
      startTimeUtc: journey.startedAt, endTimeUtc: journey.endedAt,
      route: samples.filter((_, index) => index % stride === 0 || index === samples.length - 1).map(p => ({ longitude: p.coordinate[0], latitude: p.coordinate[1], timestampUtc: p.recordedAt })) };
  });
  return { name: memory.name, journeys };
}

/** Full archive queries avoid both the 45-day UI window and the music dashboard's 500-play cap. */
export async function loadYearOnRoadData(userId: string, cancelled: () => boolean): Promise<YearOnRoadData> {
  initializeLocalStore();
  const assertOwner = () => { if (cancelled() || getCurrentUser().id !== userId) throw new Error('The recap was closed or your profile changed.'); };
  assertOwner(); const db = getMasterDatabase();
  let snapshot: YearOnRoadData | null = null;
  const now = Date.now();
  // The screen invokes this async boundary after its loading frame has painted.
  // No await inside: editor/sync changes cannot splice different archive versions
  // between journey totals, song links, route geometry, and Memory cover pointers.
  db.withTransactionSync(() => {
    const journeys = db.getAllSync<YearOnRoadData['journeys'][number]>(`SELECT j.id,j.started_at AS startedAt,j.ended_at AS endedAt,
      j.miles,j.duration_minutes AS durationMinutes,sp.label AS startingLocation,ep.label AS endingLocation
      FROM local_journeys j LEFT JOIN local_places sp ON sp.id=j.start_place_id AND sp.user_id=j.user_id
      LEFT JOIN local_places ep ON ep.id=j.end_place_id AND ep.user_id=j.user_id WHERE j.user_id=? ORDER BY j.started_at,j.id;`, userId);
    assertOwner();
    const songs = db.getAllSync<YearOnRoadData['songs'][number]>(`SELECT e.id,e.journey_id AS journeyId,e.played_at AS playedAt,
      COALESCE(s.title,e.track) AS track,COALESCE(s.artist,e.artist) AS artist,COALESCE(a.title,e.album) AS album,
      COALESCE(s.duration_ms,e.duration_ms) AS durationMs,COALESCE(sa.remote_url,aa.remote_url,e.artwork_url) AS artworkUrl
      FROM local_music_entries e JOIN local_journeys j ON j.id=e.journey_id AND j.user_id=e.user_id
      LEFT JOIN local_songs s ON s.id=e.song_id AND s.user_id=e.user_id
      LEFT JOIN local_albums a ON a.id=s.album_id AND a.user_id=e.user_id
      LEFT JOIN local_artworks sa ON sa.id=s.artwork_id AND sa.user_id=e.user_id
      LEFT JOIN local_artworks aa ON aa.id=a.artwork_id AND aa.user_id=e.user_id
      WHERE e.user_id=? ORDER BY e.played_at,e.id;`, userId);
    assertOwner();
    const visible = journeys.filter(j => isVisibleJourney({ startingLocation: j.startingLocation ?? null, endingLocation: j.endingLocation ?? null }));
    // Only the longest journey per year needs geometry; avoid loading every GPS recording.
    const longest = new Map<number, YearOnRoadData['journeys'][number]>();
    for (const journey of visible) {
      const started = Date.parse(journey.startedAt), year = new Date(started).getFullYear();
      if (!Number.isFinite(started) || started > now || year < 1970 || !Number.isFinite(journey.miles) || journey.miles < 0) continue;
      if (journey.miles > (longest.get(year)?.miles ?? -1)) longest.set(year, journey);
    }
    for (const journey of longest.values()) {
      assertOwner();
      // Sample in SQLite so a multi-day GPS recording does not first allocate all
      // its points on the JS heap merely to draw a small decorative silhouette.
      const maxSequence = db.getFirstSync<{ maxSequence: number | null }>(
        `SELECT MAX(p.sequence) AS maxSequence FROM local_gps_points p JOIN local_journeys j ON j.id=p.journey_id
         WHERE j.user_id=? AND j.id=?;`, userId, journey.id)?.maxSequence;
      if (maxSequence == null || !Number.isFinite(maxSequence)) { journey.route = null; continue; }
      const stride = Math.max(1, Math.ceil((maxSequence + 1) / 320));
      const points = db.getAllSync<{ latitude: number; longitude: number }>(
        `SELECT p.latitude,p.longitude FROM local_gps_points p JOIN local_journeys j ON j.id=p.journey_id
         WHERE j.user_id=? AND j.id=? AND (p.sequence % ? = 0 OR p.sequence=?) ORDER BY p.sequence;`,
        userId, journey.id, stride, maxSequence);
      journey.route = points.length ? { coordinates: points.map(point => [point.longitude, point.latitude]) } : null;
    }
    const memories = listMemories(userId).map(memory => {
      const cover = memory.coverPhotoId ? getPhotoIncludingDeleted(userId, memory.coverPhotoId) : null;
      return { id: memory.id, name: memory.name, journeyIds: parseJourneyIds(memory.journeyIds),
        photoUri: cover && !cover.deletedAt && cover.memoryId === memory.id ? cover.localUri : undefined };
    });
    assertOwner();
    snapshot = { journeys: visible, songs, memories, coverageNote: 'From journeys and music currently saved on this device. Sync another device first to include its history.' };
  });
  assertOwner();
  return snapshot!;
}
