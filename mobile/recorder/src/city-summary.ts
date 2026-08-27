export type CityGridCoordinate = { key: string; latitude: string; longitude: string };
export type CitySongLocation = { coordinate: [number, number]; songs: number };

function cityGridValue(value: number) {
  const fixed = value.toFixed(2);
  return fixed === '-0.00' ? '0.00' : fixed;
}

export function cityGridCoordinate(coordinate: [number, number]): CityGridCoordinate | null {
  const [longitude, latitude] = coordinate;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;
  const reducedLatitude = cityGridValue(latitude);
  const reducedLongitude = cityGridValue(longitude);
  return { key: `${reducedLatitude},${reducedLongitude}`, latitude: reducedLatitude, longitude: reducedLongitude };
}

export function nearestRecordedCoordinate(
  samples: { recordedAt: string; coordinate: [number, number] }[],
  playedAt: string,
): [number, number] | null {
  if (!samples.length) return null;
  const target = Date.parse(playedAt);
  if (!Number.isFinite(target)) return samples[0]?.coordinate ?? null;
  let nearest = samples[0];
  let distance = Math.abs(Date.parse(nearest.recordedAt) - target);
  for (let index = 1; index < samples.length; index += 1) {
    const candidate = samples[index];
    const candidateDistance = Math.abs(Date.parse(candidate.recordedAt) - target);
    if (candidateDistance < distance) { nearest = candidate; distance = candidateDistance; }
  }
  return nearest.coordinate;
}

export function summarizeCitySongs(
  locations: CitySongLocation[],
  labels: Record<string, string>,
  limit = 8,
): { label: string; songs: number }[] {
  const totals = new Map<string, number>();
  for (const location of locations) {
    const grid = cityGridCoordinate(location.coordinate);
    const label = grid ? labels[grid.key] : null;
    if (!label) continue;
    totals.set(label, (totals.get(label) ?? 0) + Math.max(0, Math.trunc(location.songs)));
  }
  return [...totals.entries()]
    .map(([label, songs]) => ({ label, songs }))
    .sort((left, right) => right.songs - left.songs || left.label.localeCompare(right.label))
    .slice(0, Math.max(1, limit));
}
