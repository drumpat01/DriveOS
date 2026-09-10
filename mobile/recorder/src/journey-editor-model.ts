import type { LocalGpsPoint, LocalJourney, LocalMusicEntry } from './local-store';

export type JourneyEditorOriginal = { journey: LocalJourney; points: LocalGpsPoint[]; songs: LocalMusicEntry[] };
export type JourneyEditorSegment = { id: string; startMs: number; endMs: number };
export type JourneyEditSelection = { kind: 'trim'; startMs: number; endMs: number }
  | { kind: 'split'; atMs: number } | { kind: 'restore' };
export type JourneyEditorSnapshot = {
  userId: string; rootJourneyId: string; journeyId: string; revision: string | null;
  versionToken: string; original: JourneyEditorOriginal; segments: JourneyEditorSegment[];
  canRestore: boolean; splitJourneyId: string;
};
export type JourneyEditorPreviewSegment = JourneyEditorSegment & {
  points: LocalGpsPoint[]; miles: number; durationMinutes: number; songCount: number;
};
export type JourneyEditorPreview = {
  segments: JourneyEditorPreviewSegment[]; removedPointCount: number; removedSongCount: number;
};
export const MAX_EDITOR_POINTS = 100_000;
export const MAX_EDITOR_SEGMENTS = 16;
export const MIN_EDITOR_SEGMENT_MS = 10_000;

function assertTime(value: number) {
  if (!Number.isFinite(value)) throw new Error('Choose a valid time on the journey.');
}

export function editorSongSegment(segments: JourneyEditorSegment[], playedAt: string): string | null {
  const time = Date.parse(playedAt);
  // Split boundary belongs only to the later segment. A song beginning before
  // the trim is not invented inside it simply because its duration overlaps.
  return segments.find((segment, index) => time >= segment.startMs &&
    (time < segment.endMs || (index === segments.length - 1 && time === segment.endMs)))?.id ?? null;
}

function interpolate(left: LocalGpsPoint, right: LocalGpsPoint, time: number): LocalGpsPoint {
  const span = Date.parse(right.recordedAt) - Date.parse(left.recordedAt);
  const amount = span > 0 ? (time - Date.parse(left.recordedAt)) / span : 0;
  let longitudeDelta = right.longitude - left.longitude;
  if (longitudeDelta > 180) longitudeDelta -= 360;
  if (longitudeDelta < -180) longitudeDelta += 360;
  const longitude = ((left.longitude + longitudeDelta * amount + 540) % 360) - 180;
  return { ...left, recordedAt: new Date(time).toISOString(), longitude,
    latitude: left.latitude + (right.latitude - left.latitude) * amount,
    speedMps: left.speedMps != null && right.speedMps != null ? left.speedMps + (right.speedMps - left.speedMps) * amount : null };
}

export function pointsForEditorSegment(points: LocalGpsPoint[], segment: JourneyEditorSegment): LocalGpsPoint[] {
  const ordered = points.slice().sort((a, b) => Date.parse(a.recordedAt) - Date.parse(b.recordedAt) || a.sequence - b.sequence);
  const selected: LocalGpsPoint[] = [];
  for (let index = 0; index < ordered.length; index++) {
    const point = ordered[index]!, time = Date.parse(point.recordedAt), prior = ordered[index - 1];
    if (prior) {
      const before = Date.parse(prior.recordedAt);
      if (before < segment.startMs && time > segment.startMs) selected.push(interpolate(prior, point, segment.startMs));
      if (before < segment.endMs && time > segment.endMs) selected.push(interpolate(prior, point, segment.endMs));
    }
    if (time >= segment.startMs && time <= segment.endMs) selected.push(point);
  }
  return selected.sort((a, b) => Date.parse(a.recordedAt) - Date.parse(b.recordedAt))
    .map((point, sequence) => ({ ...point, journeyId: segment.id, sequence }));
}

function milesForPoints(points: LocalGpsPoint[]): number {
  let meters = 0;
  const radians = (value: number) => value * Math.PI / 180;
  for (let index = 1; index < points.length; index++) {
    const a = points[index - 1]!, b = points[index]!;
    const chord = Math.sin(radians(b.latitude - a.latitude) / 2) ** 2 +
      Math.cos(radians(a.latitude)) * Math.cos(radians(b.latitude)) * Math.sin(radians(b.longitude - a.longitude) / 2) ** 2;
    meters += 6371000 * 2 * Math.asin(Math.sqrt(Math.min(1, chord)));
  }
  return meters / 1609.344;
}

export function validateEditorSegments(original: JourneyEditorOriginal, segments: JourneyEditorSegment[]): void {
  const start = Date.parse(original.journey.startedAt), end = Date.parse(original.journey.endedAt);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start || original.points.length < 2 || original.points.length > MAX_EDITOR_POINTS) {
    throw new Error('This journey needs a complete timestamped route before it can be edited.');
  }
  if (!segments.length || segments.length > MAX_EDITOR_SEGMENTS || new Set(segments.map(s => s.id)).size !== segments.length) {
    throw new Error('This journey has too many parts or repeated identifiers.');
  }
  let priorEnd = start;
  for (const segment of segments) {
    assertTime(segment.startMs); assertTime(segment.endMs);
    if (!segment.id || segment.startMs < start || segment.endMs > end || segment.startMs < priorEnd || segment.endMs <= segment.startMs) {
      throw new Error('Journey parts must stay within the original recording and cannot overlap.');
    }
    priorEnd = segment.endMs;
  }
}

export function previewJourneyEdit(snapshot: JourneyEditorSnapshot, selection: JourneyEditSelection): JourneyEditorPreview {
  const original = snapshot.original;
  let segments = snapshot.segments.map(segment => ({ ...segment }));
  const index = segments.findIndex(segment => segment.id === snapshot.journeyId);
  if (index < 0) throw new Error('This part of the journey has changed. Reopen the editor.');
  const selected = segments[index]!;
  if (selection.kind === 'restore') {
    segments = [{ id: snapshot.rootJourneyId, startMs: Date.parse(original.journey.startedAt), endMs: Date.parse(original.journey.endedAt) }];
  } else if (selection.kind === 'trim') {
    assertTime(selection.startMs); assertTime(selection.endMs);
    if (selection.startMs < selected.startMs || selection.endMs > selected.endMs || selection.endMs - selection.startMs < MIN_EDITOR_SEGMENT_MS) {
      throw new Error('Keep at least ten seconds inside the selected journey. Restore the original to bring trimmed sections back.');
    }
    segments[index] = { ...selected, startMs: selection.startMs, endMs: selection.endMs };
  } else {
    assertTime(selection.atMs);
    if (selection.atMs - selected.startMs < MIN_EDITOR_SEGMENT_MS || selected.endMs - selection.atMs < MIN_EDITOR_SEGMENT_MS) {
      throw new Error('Leave at least ten seconds on each side of the split.');
    }
    segments.splice(index, 1, { ...selected, endMs: selection.atMs },
      { id: snapshot.splitJourneyId, startMs: selection.atMs, endMs: selected.endMs });
  }
  const preview = previewEditorSegments(original, segments);
  if (selection.kind === 'restore') {
    preview.segments[0] = { ...preview.segments[0]!, miles: original.journey.miles,
      durationMinutes: original.journey.durationMinutes, songCount: original.songs.length };
    preview.removedPointCount = 0; preview.removedSongCount = 0;
  }
  return preview;
}

export function previewEditorSegments(original: JourneyEditorOriginal, segments: JourneyEditorSegment[]): JourneyEditorPreview {
  validateEditorSegments(original, segments);
  const preview = segments.map(segment => {
    const points = pointsForEditorSegment(original.points, segment);
    if (points.length < 2) throw new Error('The selected section needs at least two route points.');
    return { ...segment, points, miles: milesForPoints(points), durationMinutes: (segment.endMs - segment.startMs) / 60_000,
      songCount: original.songs.filter(song => editorSongSegment(segments, song.playedAt) === segment.id).length };
  });
  return { segments: preview,
    removedPointCount: original.points.filter(point => !segments.some(s => Date.parse(point.recordedAt) >= s.startMs && Date.parse(point.recordedAt) <= s.endMs)).length,
    removedSongCount: original.songs.filter(song => !editorSongSegment(segments, song.playedAt)).length };
}
