import type { JourneyDetail, SoundtrackTrack } from './app-data';
import type { TessieStatisticsCharge, TessieStatisticsDrive } from './tessie-statistics-model';

export type AtlasSongJourney = { journeyId: string; playedAt: string; startLabel: string; endLabel: string; route: [number, number][] };
export type AtlasSongTravel = { key: string; track: string; artist: string; artworkUrl: string | null; journeys: AtlasSongJourney[] };
export type AtlasDriveHome = { outwardId: string; returnId: string; outwardLabel: string; homeLabel: string; outwardRoute: [number, number][]; returnRoute: [number, number][]; charge: TessieStatisticsCharge | null };
export type AtlasQuietMoment = { journeyId: string; startedAt: string; endedAt: string; minutes: number; route: [number, number][]; entireDrive: boolean };
export type AtlasRememberDrive = { journeyId: string; endedAt: string; startLabel: string; endLabel: string };
export type AtlasTravelStories = { songs: AtlasSongTravel[]; driveHome: AtlasDriveHome | null; quietMoments: AtlasQuietMoment[]; rememberDrive: AtlasRememberDrive | null };

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

// Explicit offsets are required. Date.parse accepts local dates, which cannot
// safely be matched to a vehicle's UTC drive interval.
function instant(value: string | null | undefined): number | null {
  if (!value || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/.test(value)) return null;
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : null;
}

function label(value: string): string | null {
  const clean = value.trim().replace(/\s+/g, ' ');
  return clean && !/^(unknown|unnamed|location unavailable|your (start|destination)|recorded (start|destination))/i.test(clean) ? clean : null;
}

function songKey(track: SoundtrackTrack): string {
  return `${track.track.trim().toLocaleLowerCase()}\0${track.artist.trim().toLocaleLowerCase()}`;
}

function trustedSongs(drive: TessieStatisticsDrive, detail: JourneyDetail | undefined): SoundtrackTrack[] {
  const start = instant(drive.startedAt), end = instant(drive.endedAt);
  if (start === null || end === null || end <= start) return [];
  return (detail?.soundtrack ?? []).filter(track =>
    (track.source === 'apple_music' || track.source === 'lastfm')
    && track.track.trim() && track.artist.trim()
    && instant(track.playedAt) !== null
    && instant(track.playedAt)! >= start && instant(track.playedAt)! < end,
  ).sort((a, b) => instant(a.playedAt)! - instant(b.playedAt)!);
}

/** Derive only from profile-scoped Tessie rows and timed Apple Music/Last.fm plays. */
export function buildAtlasTravelStories(
  drives: TessieStatisticsDrive[], charges: TessieStatisticsCharge[], details: JourneyDetail[],
  savedJourneyIds: ReadonlySet<string>, dismissedJourneyIds: ReadonlySet<string>, now = new Date(),
): AtlasTravelStories {
  const byId = new Map(details.map(detail => [detail.id, detail]));
  const valid = drives.filter(drive => drive.journeyId && drive.vehicleKey && instant(drive.startedAt) !== null
    && instant(drive.endedAt) !== null && instant(drive.startedAt)! < instant(drive.endedAt)!)
    .sort((a, b) => instant(a.startedAt)! - instant(b.startedAt)!);
  const groups = new Map<string, AtlasSongTravel>();
  const quietMoments: AtlasQuietMoment[] = [];
  for (const drive of valid) {
    const detail = byId.get(drive.journeyId);
    const route = detail?.route?.coordinates ?? [];
    const songs = trustedSongs(drive, detail);
    const seenPlays = new Set<string>();
    for (const song of songs) {
      const key = songKey(song), playKey = `${key}\0${song.playedAt}`;
      if (seenPlays.has(playKey)) continue;
      seenPlays.add(playKey);
      const found = groups.get(key) ?? { key, track: song.track.trim(), artist: song.artist.trim(), artworkUrl: song.artworkUrl, journeys: [] };
      if (!found.journeys.some(item => item.journeyId === drive.journeyId)) found.journeys.push({
        journeyId: drive.journeyId, playedAt: song.playedAt!, startLabel: label(drive.startingLocation) ?? 'Recorded start',
        endLabel: label(drive.endingLocation) ?? 'Recorded destination', route,
      });
      if (!found.artworkUrl) found.artworkUrl = song.artworkUrl;
      groups.set(key, found);
    }
    // These are gaps in the recorded history, never evidence that playback stopped.
    const times = [instant(drive.startedAt)!, ...[...seenPlays].map(play => instant(play.split('\0').at(-1))!).filter(Number.isFinite), instant(drive.endedAt)!];
    if (!songs.length) {
      if (times[1] - times[0] >= 10 * MINUTE) quietMoments.push({ journeyId: drive.journeyId, startedAt: drive.startedAt, endedAt: drive.endedAt, minutes: (times[1] - times[0]) / MINUTE, route, entireDrive: true });
    } else {
      for (let index = 0; index < times.length - 1; index += 1) {
        const duration = times[index + 1] - times[index];
        if (duration >= 15 * MINUTE) quietMoments.push({ journeyId: drive.journeyId, startedAt: new Date(times[index]).toISOString(), endedAt: new Date(times[index + 1]).toISOString(), minutes: duration / MINUTE, route, entireDrive: false });
      }
    }
  }
  const songs = [...groups.values()].sort((a, b) => b.journeys.length - a.journeys.length
    || instant(b.journeys.at(-1)?.playedAt)! - instant(a.journeys.at(-1)?.playedAt)!).slice(0, 6);
  const byVehicle = new Map<string, TessieStatisticsDrive[]>();
  for (const drive of valid) byVehicle.set(drive.vehicleKey, [...(byVehicle.get(drive.vehicleKey) ?? []), drive]);
  const pairs: (AtlasDriveHome & { returnedAt: number })[] = [];
  for (const vehicleDrives of byVehicle.values()) for (let index = 0; index < vehicleDrives.length - 1; index += 1) {
    const outward = vehicleDrives[index], inbound = vehicleDrives[index + 1];
    const start = label(outward.startingLocation), destination = label(outward.endingLocation);
    const backStart = label(inbound.startingLocation), backEnd = label(inbound.endingLocation);
    const gap = instant(inbound.startedAt)! - instant(outward.endedAt)!;
    if (!start || !destination || start.toLocaleLowerCase() !== 'home' || start.toLocaleLowerCase() === destination.toLocaleLowerCase()
      || start.toLocaleLowerCase() !== backEnd?.toLocaleLowerCase()
      || destination.toLocaleLowerCase() !== backStart?.toLocaleLowerCase()
      || gap < 0 || gap > 18 * HOUR) continue;
    const charge = charges.find(item => item.journeyId === outward.journeyId
      && instant(item.startedAt) !== null && instant(item.endedAt) !== null
      && instant(item.startedAt)! >= instant(outward.endedAt)!
      && instant(item.endedAt)! <= instant(inbound.startedAt)!) ?? null;
    pairs.push({ outwardId: outward.journeyId, returnId: inbound.journeyId, outwardLabel: destination,
      homeLabel: start, outwardRoute: byId.get(outward.journeyId)?.route?.coordinates ?? [],
      returnRoute: byId.get(inbound.journeyId)?.route?.coordinates ?? [], charge, returnedAt: instant(inbound.endedAt)! });
  }
  pairs.sort((a, b) => b.returnedAt - a.returnedAt);
  const latest = [...valid].reverse().find(drive => {
    const ended = instant(drive.endedAt)!;
    return ended <= now.getTime() - 20 * MINUTE && ended >= now.getTime() - 48 * HOUR
      && !savedJourneyIds.has(drive.journeyId) && !dismissedJourneyIds.has(drive.journeyId);
  });
  return {
    songs,
    driveHome: pairs[0] ?? null,
    quietMoments: quietMoments.sort((a, b) => b.minutes - a.minutes).slice(0, 3),
    rememberDrive: latest ? { journeyId: latest.journeyId, endedAt: latest.endedAt,
      startLabel: label(latest.startingLocation) ?? 'Recorded start', endLabel: label(latest.endingLocation) ?? 'Recorded destination' } : null,
  };
}
