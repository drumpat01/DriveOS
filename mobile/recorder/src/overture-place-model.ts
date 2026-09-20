// Wire contract for public Overture US packs. No user identifiers or precise
// stop coordinates are sent: matching and ambiguity checks run on the device.
export type OverturePlace = [id: string, name: string, longitude: number, latitude: number, category: string, confidence: number];
export type OvertureTile = { schema: 1; release: string; tile: string; places: OverturePlace[] };
export const OVERTURE_TILE_TTL_MS = 7 * 86_400_000;
export const OVERTURE_MAX_TILE_BYTES = 4_000_000;

export function overtureTileKey(latitude: number, longitude: number): string | null {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude <= -90 || latitude >= 90 || longitude < -180 || longitude >= 180) return null;
  return `${Math.floor((latitude + 90) * 50)}_${Math.floor((longitude + 180) * 50)}`;
}

export function parseOvertureTile(value: unknown, tile: string): OvertureTile | null {
  if (!value || typeof value !== 'object') return null;
  const data = value as Partial<OvertureTile>;
  if (data.schema !== 1 || data.tile !== tile || !/^20\d\d-\d\d-\d\d\.\d+$/.test(data.release ?? '')
    || !Array.isArray(data.places) || data.places.length > 20_000) return null;
  for (const row of data.places) {
    if (!Array.isArray(row) || row.length !== 6 || typeof row[0] !== 'string' || !/^[a-zA-Z0-9-]{1,100}$/.test(row[0])
      || typeof row[1] !== 'string' || !row[1].trim() || row[1].length > 200
      || typeof row[2] !== 'number' || !Number.isFinite(row[2]) || Math.abs(row[2]) > 180
      || typeof row[3] !== 'number' || !Number.isFinite(row[3]) || Math.abs(row[3]) > 90
      || typeof row[4] !== 'string' || row[4].length > 200
      || typeof row[5] !== 'number' || !Number.isFinite(row[5]) || row[5] < .7 || row[5] > 1) return null;
  }
  return data as OvertureTile;
}

function distance(latitude: number, longitude: number, row: OverturePlace) {
  const rad = Math.PI / 180;
  const a = Math.sin((row[3] - latitude) * rad / 2) ** 2
    + Math.cos(latitude * rad) * Math.cos(row[3] * rad) * Math.sin((row[2] - longitude) * rad / 2) ** 2;
  return 12_742_000 * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** Existence confidence is not visit confidence. A second nearby business is
 * reason to defer to MapKit/address instead of inventing certainty. */
export function selectOverturePlace(tile: OvertureTile, latitude: number, longitude: number): OverturePlace | null {
  const unique = new Map<string, { row: OverturePlace; meters: number }>();
  for (const row of tile.places) {
    const meters = distance(latitude, longitude, row);
    if (meters <= 250) unique.set(row[0], { row, meters });
  }
  const candidates = [...unique.values()].sort((a, b) => a.meters - b.meters);
  const first = candidates[0], second = candidates[1];
  if (!first || first.meters > 160) return null;
  if (second && (second.meters - first.meters < 35 || second.meters < first.meters * 1.5)) return null;
  return first.row;
}
