export type EditorRange = { startMs: number; endMs: number };
export type EditorHandle = 'start' | 'end' | 'split';

/** Gesture deltas use the measured track, never a coordinate relative to a moving handle. */
export function moveEditorHandle(handle: EditorHandle, initial: number, deltaX: number, width: number,
  bounds: EditorRange, range: EditorRange, minimumMs = 10_000): number {
  if (!Number.isFinite(deltaX) || !Number.isFinite(width) || width <= 0) return initial;
  const next = initial + deltaX / width * (bounds.endMs - bounds.startMs);
  const min = handle === 'end' ? range.startMs + minimumMs : handle === 'split' ? bounds.startMs + minimumMs : bounds.startMs;
  const max = handle === 'start' ? range.endMs - minimumMs : handle === 'split' ? bounds.endMs - minimumMs : bounds.endMs;
  if (max < min) return initial;
  return Math.round(Math.max(min, Math.min(max, next)));
}

export type EditorDrawPoint = { time: number; longitude: number; latitude: number };
export function sampleEditorRoute(points: EditorDrawPoint[], max = 900): EditorDrawPoint[] {
  const ordered = points.filter(p => Number.isFinite(p.time) && Number.isFinite(p.longitude) && Number.isFinite(p.latitude))
    .sort((a, b) => a.time - b.time);
  if (ordered.length <= max) return ordered;
  return Array.from({ length: max }, (_, index) => ordered[Math.round(index * (ordered.length - 1) / (max - 1))]!);
}

export function clipEditorRoute(points: EditorDrawPoint[], range: EditorRange): EditorDrawPoint[] {
  const result: EditorDrawPoint[] = [];
  for (let i = 0; i < points.length; i++) {
    const p = points[i]!, before = points[i - 1];
    if (before && p.time > before.time) {
      for (const time of [range.startMs, range.endMs]) {
        if (before.time < time && p.time > time) {
          const amount = (time - before.time) / (p.time - before.time);
          let delta = p.longitude - before.longitude;
          if (delta > 180) delta -= 360;
          if (delta < -180) delta += 360;
          result.push({ time, latitude: before.latitude + (p.latitude - before.latitude) * amount,
            longitude: ((before.longitude + delta * amount + 540) % 360) - 180 });
        }
      }
    }
    if (p.time >= range.startMs && p.time <= range.endMs) result.push(p);
  }
  return result.sort((a, b) => a.time - b.time);
}
