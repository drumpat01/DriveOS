import type { SoundtrackTrack } from './app-data';

export function albumCarouselLayout(width: number) {
  const viewport = Number.isFinite(width) ? Math.max(0, width) : 0;
  const cover = Math.min(220, viewport * .62);
  const stride = cover + 16;
  return { cover, stride, padding: Math.max(0, (viewport - stride) / 2) };
}

export function albumCarouselDepth(index: number, offset: number, stride: number, animate: boolean) {
  'worklet';
  if (!animate || stride <= 0) return { scale: 1, lift: 0, rotation: 0 };
  const distance = Math.max(-2, Math.min(2, (index * stride - offset) / stride));
  const magnitude = Math.abs(distance);
  return { scale: 1 - magnitude * .07, lift: -8 + magnitude * 8, rotation: -distance * 7 };
}

export function albumCarouselItems(tracks: SoundtrackTrack[]) {
  const occurrences = new Map<string, number>();
  return tracks.map(track => {
    const identity = JSON.stringify([track.playedAt, track.track, track.artist, track.album]);
    const occurrence = occurrences.get(identity) ?? 0;
    occurrences.set(identity, occurrence + 1);
    return { track, key: `${identity}:${occurrence}` };
  });
}
