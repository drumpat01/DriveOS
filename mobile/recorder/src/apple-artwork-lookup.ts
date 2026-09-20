import { getCurrentUser } from './auth';
import { resolveAppleArtwork } from './apple-artwork-resolver';
import { enrichMusicEntriesWithArtwork, listMusicEntries, listMusicEntriesForJourney } from './local-store';
import { notifyLocalArchiveChanged } from './local-archive-events';
import { requestAppleCatalogJson } from './network-request';
import { readAppCache, writeAppCache } from './storage';

const MAX_LOOKUPS_PER_REFRESH = 15;
const RETRY_AFTER_MS = 24 * 60 * 60_000;
const ATTEMPT_CACHE_KEY = 'apple-music.artwork-search-attempts.v2';


function lookupIdentity(track: string, artist: string) {
  return `${track.trim().toLocaleLowerCase()}\0${artist.trim().toLocaleLowerCase()}`;
}

export async function resolveMissingAppleMusicArtwork(limit = MAX_LOOKUPS_PER_REFRESH, options: { force?: boolean; journeyId?: string } = {}) {
  const userId = getCurrentUser().id;
  const attempts = readAppCache<Record<string, number>>(ATTEMPT_CACHE_KEY) ?? {};
  const cutoff = Date.now() - RETRY_AFTER_MS;
  const unique = new Map<string, { track: string; artist: string; externalUrl: string | null }>();
  const entries = options.journeyId ? listMusicEntriesForJourney(userId, options.journeyId) : listMusicEntries(userId, 500);
  for (const entry of entries) {
    if (entry.source !== 'apple_music' || entry.artworkUrl) continue;
    const identity = lookupIdentity(entry.track, entry.artist);
    if ((!options.force && (attempts[identity] ?? 0) > cutoff) || unique.has(identity)) continue;
    unique.set(identity, { track: entry.track, artist: entry.artist, externalUrl: entry.externalUrl });
  }

  let enriched = 0, failed = 0;
  const bounded = [...unique.entries()].slice(0, Math.max(1, Math.min(MAX_LOOKUPS_PER_REFRESH, Math.trunc(limit))));
  await Promise.all(bounded.map(async ([identity, item]) => {
    try {
      const match = await resolveAppleArtwork(item, url => requestAppleCatalogJson(url, {
        operation: 'Apple artwork lookup', timeoutMessage: 'Apple artwork lookup took too long.',
      }));
      if (getCurrentUser().id !== userId) return;
      attempts[identity] = Date.now();
      if (match) enriched += enrichMusicEntriesWithArtwork(userId, [match]);
    } catch {
      failed += 1;
    }
  }));
  if (getCurrentUser().id !== userId) return { attempted: bounded.length, enriched, failed };
  writeAppCache(ATTEMPT_CACHE_KEY, attempts);
  if (enriched > 0) notifyLocalArchiveChanged();
  return { attempted: bounded.length, enriched, failed };
}
