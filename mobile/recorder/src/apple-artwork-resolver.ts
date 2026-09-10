import { canonicalMusicText, exactITunesArtworkMatch, type ITunesSongResult } from './apple-artwork-match.ts';

export function appleSongCatalogId(value: string | null | undefined): string | null {
  try {
    const url = new URL(value ?? '');
    if (url.protocol !== 'https:' || !['music.apple.com', 'itunes.apple.com'].includes(url.hostname) || url.username || url.password) return null;
    const id = url.searchParams.get('i') ?? (/\/song\//.test(url.pathname) ? url.pathname.split('/').at(-1) : null);
    return id && /^\d{1,20}$/.test(id) && !/^0+$/.test(id) ? id : null;
  } catch { return null; }
}

type CatalogResult = ITunesSongResult & { artistId?: number; trackId?: number };
type Request = (url: string) => Promise<{ results?: CatalogResult[] }>;

/** Bounded public catalog recovery; every candidate still requires exact title + full artist credit. */
export async function resolveAppleArtwork(item: { track: string; artist: string; externalUrl?: string | null }, request: Request) {
  const match = (results: CatalogResult[]) => {
    const found = exactITunesArtworkMatch(item.track, item.artist, results);
    return found ? { ...found, track: item.track, artist: item.artist } : null;
  };
  const read = async (path: string) => { const payload = await request(`https://itunes.apple.com/${path}`); return Array.isArray(payload.results) ? payload.results : []; };
  const id = appleSongCatalogId(item.externalUrl);
  if (id) {
    try {
      const found = match((await read(`lookup?id=${id}&entity=song`)).filter(result => String(result.trackId) === id));
      if (found) return found;
    } catch { /* Retired catalog IDs can still resolve through the bounded search fallback. */ }
  }
  const query = new URLSearchParams({ term: `${item.track} ${item.artist}`, media: 'music', entity: 'song', limit: '5' });
  const found = match(await read(`search?${query}`));
  if (found) return found;
  // Apple can omit a song from search while retaining it in its artist catalog.
  const leadArtist = item.artist.split(',')[0].trim();
  const artists = await read(`search?${new URLSearchParams({ term: leadArtist, entity: 'musicArtist', attribute: 'artistTerm', limit: '5' })}`);
  const artistIds = [...new Set(artists.filter(result => result.wrapperType === 'artist' && canonicalMusicText(result.artistName) === canonicalMusicText(leadArtist) && Number.isSafeInteger(result.artistId) && result.artistId! > 0).map(result => result.artistId!))];
  if (!artistIds.length) return null;
  return match(await read(`lookup?id=${artistIds.slice(0, 5).join(',')}&entity=song&limit=200`));
}
