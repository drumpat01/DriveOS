import type { SoundtrackTrack } from './app-data';
import type { MusicProvider } from './music-preferences';

export function musicTrackDestination(track: Pick<SoundtrackTrack, 'track' | 'artist' | 'externalUrl'>, provider: MusicProvider) {
  const query = encodeURIComponent(`${track.track} ${track.artist}`.trim());
  if (provider === 'lastfm') {
    if (track.externalUrl?.startsWith('https://open.spotify.com/')) return track.externalUrl;
    return `https://open.spotify.com/search/${query}`;
  }
  if (provider === 'apple-music') {
    if (track.externalUrl?.startsWith('https://music.apple.com/')) return track.externalUrl;
    return `https://music.apple.com/us/search?term=${query}`;
  }
  return null;
}
