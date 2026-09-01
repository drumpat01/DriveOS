export type ITunesSongResult = {
  wrapperType?: string;
  kind?: string;
  trackName?: string;
  artistName?: string;
  collectionName?: string;
  artworkUrl100?: string;
  trackViewUrl?: string;
};

export function canonicalMusicText(value: unknown) {
  if (typeof value !== 'string') return '';
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase()
    .replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
}

function safeHttpsUrl(value: unknown) {
  if (typeof value !== 'string') return null;
  try { return new URL(value).protocol === 'https:' ? value : null; }
  catch { return null; }
}

export function exactITunesArtworkMatch(track: string, artist: string, results: ITunesSongResult[]) {
  const expectedTrack = canonicalMusicText(track), expectedArtist = canonicalMusicText(artist);
  if (!expectedTrack || !expectedArtist) return null;
  for (const result of results) {
    if (result.wrapperType !== 'track' || (result.kind && result.kind !== 'song')) continue;
    if (canonicalMusicText(result.trackName) !== expectedTrack || canonicalMusicText(result.artistName) !== expectedArtist) continue;
    const artworkUrl = safeHttpsUrl(result.artworkUrl100), externalUrl = safeHttpsUrl(result.trackViewUrl);
    if (!artworkUrl || !externalUrl) continue;
    return {
      track: result.trackName!.trim(), artist: result.artistName!.trim(), album: result.collectionName?.trim() || null,
      artworkUrl, externalUrl,
    };
  }
  return null;
}
