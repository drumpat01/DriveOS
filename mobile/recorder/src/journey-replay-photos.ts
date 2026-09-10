import { readAppCache, writeAppCache } from './storage';
import { getCurrentUser } from './auth';
import { listMemories, listPhotos } from './local-store';
import type { ReplayPhoto } from './journey-replay-model';

type PhotoTiming = { journeyId: string; capturedAt: string };
const key = (id: string) => `replay-photo-timing:${id}`;

export function saveReplayPhotoTiming(owner: string, photoId: string, journeyId: string, capturedAt: string) {
  if (getCurrentUser().id !== owner || !Number.isFinite(Date.parse(capturedAt))) return;
  // Device-only, profile-scoped timing. No PhotoKit identifier or photo coordinates are retained or synced.
  writeAppCache(key(photoId), { journeyId, capturedAt });
}

export function loadReplayPhotos(owner: string, journeyId: string): ReplayPhoto[] {
  if (getCurrentUser().id !== owner) return [];
  const memories = new Set(listMemories(owner).filter(memory => {
    try { const ids: unknown = JSON.parse(memory.journeyIds); return Array.isArray(ids) && ids.includes(journeyId); } catch { return false; }
  }).map(memory => memory.id));
  return listPhotos(owner).flatMap(photo => {
    if (!photo.memoryId || !memories.has(photo.memoryId) || !photo.localUri) return [];
    const timing = readAppCache<PhotoTiming>(key(photo.id));
    return timing?.journeyId === journeyId && Number.isFinite(Date.parse(timing.capturedAt))
      ? [{ id: photo.id, uri: photo.localUri, capturedAt: timing.capturedAt }] : [];
  });
}
