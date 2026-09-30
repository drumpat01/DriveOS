// A small fictional library for App Review and first-look demos. It lives in its own local profile, is never
// uploaded to iCloud, and is deleted when the user leaves the sample. Places and songs are illustrative.
import {
  insertGpsPoints, upsertJourney, upsertMemory, upsertMusicEntry, upsertPlace, upsertPrivatePreference, type LocalGpsPoint, type LocalUserId,
} from './local-store';

type Waypoint = readonly [lat: number, lng: number];
type DemoSong = readonly [track: string, artist: string, album: string];

type DemoDrive = {
  key: string;
  daysAgo: number;
  hour: number;
  from: { label: string; at: Waypoint };
  to: { label: string; at: Waypoint };
  via: readonly Waypoint[];
  minutes: number;
  songs: readonly DemoSong[];
};

const SONGS: Record<string, readonly DemoSong[]> = {
  coast: [['Golden Hour Highway', 'The Marlow Set', 'Long Way Round'], ['Salt and Static', 'Halcyon Drive', 'Low Tide Radio'], ['Open Window', 'Juniper Bay', 'Afternoons'], ['Slow Light', 'Marlow & Vale', 'Long Way Round'], ['Second Wind', 'Halcyon Drive', 'Low Tide Radio']],
  city: [['Neon Overpass', 'Static Parade', 'After Hours'], ['Midnight Transit', 'Juniper Bay', 'Afternoons'], ['Blue Line', 'The Marlow Set', 'Long Way Round']],
  desert: [['Dust Road', 'Sable Fields', 'Wide Country'], ['Long Shadows', 'Halcyon Drive', 'Low Tide Radio'], ['Red Rock Radio', 'Sable Fields', 'Wide Country'], ['Horizon Line', 'Marlow & Vale', 'Long Way Round'], ['Cruise Control', 'Static Parade', 'After Hours']],
};

const DRIVES: readonly DemoDrive[] = [
  { key: 'coast-morning', daysAgo: 1, hour: 8, from: { label: 'Pacifica', at: [37.6138, -122.4869] }, to: { label: 'Half Moon Bay', at: [37.4636, -122.4286] },
    via: [[37.5921, -122.5007], [37.5563, -122.5138], [37.5241, -122.5107], [37.4931, -122.4813]], minutes: 38, songs: SONGS.coast! },
  { key: 'city-evening', daysAgo: 3, hour: 18, from: { label: 'Half Moon Bay', at: [37.4636, -122.4286] }, to: { label: 'San Francisco', at: [37.7749, -122.4194] },
    via: [[37.5206, -122.3702], [37.5915, -122.3562], [37.6899, -122.4051]], minutes: 46, songs: SONGS.city! },
  { key: 'valley-loop', daysAgo: 6, hour: 10, from: { label: 'San Francisco', at: [37.7749, -122.4194] }, to: { label: 'Sonoma', at: [38.2919, -122.4580] },
    via: [[37.8324, -122.4795], [37.9735, -122.5311], [38.1128, -122.5620], [38.2410, -122.5202]], minutes: 68, songs: SONGS.coast! },
  { key: 'big-sur-1', daysAgo: 41, hour: 9, from: { label: 'Monterey', at: [36.6002, -121.8947] }, to: { label: 'Big Sur', at: [36.2704, -121.8081] },
    via: [[36.5552, -121.9233], [36.4962, -121.9268], [36.3871, -121.9015]], minutes: 74, songs: SONGS.coast! },
  { key: 'big-sur-2', daysAgo: 40, hour: 15, from: { label: 'Big Sur', at: [36.2704, -121.8081] }, to: { label: 'San Simeon', at: [35.6438, -121.1908] },
    via: [[36.1237, -121.6754], [35.9394, -121.4717], [35.7865, -121.3283]], minutes: 96, songs: SONGS.desert! },
  { key: 'a-year-ago', daysAgo: 366, hour: 11, from: { label: 'Las Vegas', at: [36.1699, -115.1398] }, to: { label: 'Zion', at: [37.2982, -113.0263] },
    via: [[36.6001, -114.6008], [36.9827, -114.0567], [37.1041, -113.5813]], minutes: 172, songs: SONGS.desert! },
];

const MEMORIES: readonly { key: string; name: string; notes: string; drives: readonly string[] }[] = [
  { key: 'coast-weekend', name: 'Coast Highway Weekend', notes: 'Fog, fish tacos and the long way home.', drives: ['coast-morning', 'city-evening'] },
  { key: 'big-sur', name: 'Big Sur Road Trip', notes: 'Two days on Highway 1.', drives: ['big-sur-1', 'big-sur-2'] },
  { key: 'zion', name: 'Desert to Zion', notes: 'Red rock and a full tank.', drives: ['a-year-ago'] },
  { key: 'wine-country', name: 'Wine Country Day', notes: 'Vineyards and a long lunch.', drives: ['valley-loop'] },
];

const EARTH_MILES = 3958.8;
const toRad = (degrees: number) => degrees * Math.PI / 180;
export function haversineMiles(a: Waypoint, b: Waypoint) {
  const dLat = toRad(b[0] - a[0]), dLng = toRad(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_MILES * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** A smooth route through the waypoints, one point about every 0.15 mile, so the map and speeds look recorded. */
export function demoRoute(path: readonly Waypoint[]): Waypoint[] {
  const points: Waypoint[] = [path[0]!];
  for (let i = 1; i < path.length; i++) {
    const from = path[i - 1]!, to = path[i]!;
    const steps = Math.max(2, Math.round(haversineMiles(from, to) / 0.15));
    for (let step = 1; step <= steps; step++) {
      const t = step / steps;
      // A gentle sideways wobble keeps straight legs from looking ruled.
      const wobble = Math.sin(t * Math.PI * 3 + i) * 0.0006;
      points.push([from[0] + (to[0] - from[0]) * t + wobble, from[1] + (to[1] - from[1]) * t - wobble]);
    }
  }
  return points;
}

export const DEMO_PROFILE_NAME = 'JourneyDeck Sample';

export function demoJourneyCount() { return DRIVES.length; }
export function demoMemoryCount() { return MEMORIES.length; }

/** Writes the sample library into `userId`. Every row is marked as already synced so it can never upload. */
/** Lets the app draw between drives, so preparing the sample in the background never freezes the screen. */
const yieldToUi = () => new Promise<void>(resolve => setTimeout(resolve, 0));

export async function seedDemoLibrary(userId: LocalUserId, nowMs = Date.now()): Promise<void> {
  const ids = new Map<string, string>();
  const placeIds = new Map<string, string>();
  const place = (label: string, at: Waypoint) => {
    const existing = placeIds.get(label);
    if (existing) return existing;
    const id = `demo_place_${placeIds.size + 1}`;
    upsertPlace({ id, userId, kind: 'geocoded', label, lat: at[0], lng: at[1], radiusMeters: 800, foursquareId: null, osmId: null, cachedUntil: null });
    placeIds.set(label, id);
    return id;
  };

  for (const drive of DRIVES) {
    await yieldToUi();
    const id = `demo_journey_${drive.key}`;
    ids.set(drive.key, id);
    const start = new Date(nowMs - drive.daysAgo * 86_400_000);
    start.setHours(drive.hour, 12, 0, 0);
    const startMs = start.getTime(), endMs = startMs + drive.minutes * 60_000;
    const route = demoRoute([drive.from.at, ...drive.via, drive.to.at]);
    let miles = 0;
    for (let i = 1; i < route.length; i++) miles += haversineMiles(route[i - 1]!, route[i]!);
    miles = Math.round(miles * 10) / 10;
    const hours = drive.minutes / 60;
    const average = Math.round(miles / hours);
    upsertJourney({
      id, userId, legacyDriveId: null, startedAt: new Date(startMs).toISOString(), endedAt: new Date(endMs).toISOString(),
      durationMinutes: drive.minutes, miles, startLat: route[0]![0], startLng: route[0]![1], endLat: route.at(-1)![0], endLng: route.at(-1)![1],
      startPlaceId: place(drive.from.label, drive.from.at), endPlaceId: place(drive.to.label, drive.to.at),
      averageSpeedMph: average, maxSpeedMph: Math.round(average * 1.45), songCount: drive.songs.length, vehicleName: null, provider: 'apple_music',
    }, { syncedToCloud: 1 });
    const points: Omit<LocalGpsPoint, 'journeyId'>[] = route.map((point, index) => ({
      sequence: index, recordedAt: new Date(startMs + (endMs - startMs) * (index / Math.max(1, route.length - 1))).toISOString(),
      latitude: point[0], longitude: point[1], accuracyMeters: 8, altitudeMeters: null, headingDegrees: null, speedMps: average * 0.44704,
    }));
    insertGpsPoints(userId, id, points);
    drive.songs.forEach(([track, artist, album], index) => {
      const playedAt = new Date(startMs + (endMs - startMs) * ((index + 0.5) / drive.songs.length)).toISOString();
      upsertMusicEntry({ id: `${id}_song_${index + 1}`, userId, journeyId: id, source: 'apple_music', playedAt, track, artist, album, durationMs: 200_000, artworkUrl: null, externalUrl: null, confidence: 1 }, { syncedToCloud: 1 });
    });
  }

  for (const memory of MEMORIES) {
    upsertMemory({
      id: `demo_memory_${memory.key}`, userId, name: memory.name, notes: memory.notes, artworkKey: null, coverPhotoId: null, coverPhotoLocalPath: null,
      journeyIds: JSON.stringify(memory.drives.map(key => ids.get(key)).filter(Boolean)),
    }, { syncedToCloud: 1 });
  }

  // The sample skips onboarding and never asks for recording or music setup.
  upsertPrivatePreference(userId, 'onboarding.first-run-v2', { stage: 'complete', recordingMode: 'manual' }, { syncedToCloud: 1 });
  upsertPrivatePreference(userId, 'recording.mode', { mode: 'manual', onboardingCompleted: true }, { syncedToCloud: 1 });
  upsertPrivatePreference(userId, 'music.capture', { provider: 'apple-music', onboardingCompleted: true }, { syncedToCloud: 1 });
}
