// V4 Atlas story: music and place highlights for the journeys in the selected range.
// Pure so the tab and tests share it; route geometry and insights come from the caller's details.
import type { JourneyDetail, JourneySummary, SoundtrackTrack } from './app-data';

export type AtlasArtist = { artist: string; plays: number; artworkUrl: string | null };
export type AtlasFollowedSong = { track: string; artist: string; artworkUrl: string | null; drives: number };
export type AtlasStory = {
  topArtists: AtlasArtist[];
  followedSongs: AtlasFollowedSong[];
  plays: number;
  listeningMinutes: number;
  streak: number;
  newPlaces: string[];
  routes: [number, number][][];
};

const PLACEHOLDER = /^(unknown|location unavailable|unnamed|your (start|destination)|home|work)$/i;
const dayKey = (value: string | Date) => { const date = new Date(value); return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`; };

function tracksFor(journey: JourneySummary, details: Map<string, JourneyDetail>): SoundtrackTrack[] {
  const detail = details.get(journey.id);
  return detail?.soundtrack.length ? detail.soundtrack : journey.soundtrackPreview;
}

/** Consecutive days ending today (or yesterday, so a streak survives until today's drive). */
export function drivingStreak(journeys: Pick<JourneySummary, 'startedAt'>[], now = new Date()) {
  const days = new Set(journeys.map(journey => dayKey(journey.startedAt)));
  const cursor = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (!days.has(dayKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (days.has(dayKey(cursor))) { streak += 1; cursor.setDate(cursor.getDate() - 1); }
  return streak;
}

/** `selected` is the range's journeys; `all` lets places count as new only if never visited before the range. */
export function buildAtlasStory(selected: JourneySummary[], all: JourneySummary[], detailList: JourneyDetail[], now = new Date()): AtlasStory {
  const details = new Map(detailList.map(detail => [detail.id, detail]));
  const artists = new Map<string, AtlasArtist>();
  const songs = new Map<string, AtlasFollowedSong & { ids: Set<string> }>();
  let plays = 0;
  let listeningMs = 0;
  for (const journey of selected) {
    for (const track of tracksFor(journey, details)) {
      if (!track.track || !track.artist) continue;
      plays += 1;
      listeningMs += track.durationMs ?? 0;
      const artistKey = track.artist.toLocaleLowerCase();
      const artist = artists.get(artistKey) ?? { artist: track.artist, plays: 0, artworkUrl: null };
      artist.plays += 1;
      artist.artworkUrl ??= track.artworkUrl;
      artists.set(artistKey, artist);
      const songKey = `${artistKey}\0${track.track.toLocaleLowerCase()}`;
      const song = songs.get(songKey) ?? { track: track.track, artist: track.artist, artworkUrl: track.artworkUrl, drives: 0, ids: new Set<string>() };
      song.ids.add(journey.id);
      song.drives = song.ids.size;
      song.artworkUrl ??= track.artworkUrl;
      songs.set(songKey, song);
    }
  }
  const earliest = Math.min(...selected.map(journey => Date.parse(journey.startedAt)).filter(Number.isFinite));
  const before = new Set(all.filter(journey => Date.parse(journey.startedAt) < earliest)
    .flatMap(journey => [journey.startingLocation, journey.endingLocation]).map(label => label?.trim().toLocaleLowerCase()).filter(Boolean));
  const newPlaces: string[] = [];
  for (const journey of [...selected].reverse()) {
    for (const label of [journey.startingLocation, journey.endingLocation]) {
      const place = label?.trim();
      if (!place || PLACEHOLDER.test(place) || before.has(place.toLocaleLowerCase()) || newPlaces.some(seen => seen.toLocaleLowerCase() === place.toLocaleLowerCase())) continue;
      newPlaces.push(place);
    }
  }
  return {
    topArtists: [...artists.values()].sort((a, b) => b.plays - a.plays).slice(0, 5),
    followedSongs: [...songs.values()].filter(song => song.drives >= 2).sort((a, b) => b.drives - a.drives).slice(0, 5)
      .map(({ ids: _ids, ...song }) => song),
    plays,
    listeningMinutes: listeningMs / 60_000,
    streak: drivingStreak(all, now),
    newPlaces: newPlaces.slice(0, 6),
    routes: selected.map(journey => details.get(journey.id)?.route?.coordinates ?? []).filter(route => route.length >= 2).slice(0, 12) as [number, number][][],
  };
}
