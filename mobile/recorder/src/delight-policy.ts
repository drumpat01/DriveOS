import type { StatisticsData } from './primary-sections-data';
import type { RouteCoordinate } from './route-moments';

export const GRAND_TOURING_STAT_SERIES = [
  { name: 'Racing Green', color: '#2f6b57' },
  { name: 'Champagne', color: '#d4b15a' },
  { name: 'Touring Blue', color: '#6fa5f0' },
  { name: 'Chrome', color: '#b6bfcc' },
] as const;

export function statisticsPresentationKey(statistics: StatisticsData) {
  return JSON.stringify({
    current: Object.values(statistics.current).map(metric => metric.value),
    daily: statistics.dailyMiles.map(day => [day.date, day.miles]),
    monthly: statistics.monthlyArchive.map(month => [month.key, month.miles]),
  });
}

export function shouldAnimateStatistics(input: { active: boolean; reduceMotion: boolean; dataKey: string; presentedKeys: ReadonlySet<string> }) {
  return input.active && !input.reduceMotion && input.dataKey.length > 0 && !input.presentedKeys.has(input.dataKey);
}

export type DelightMaterialMode = 'glass' | 'blur' | 'opaque';

export function delightMaterialMode(input: { glassApiAvailable: boolean; liquidGlassAvailable: boolean; reduceTransparency: boolean }): DelightMaterialMode {
  if (input.reduceTransparency) return 'opaque';
  return input.glassApiAvailable && input.liquidGlassAvailable ? 'glass' : 'blur';
}

export type ProjectedRoutePoint = { x: number; y: number };

function isValidCoordinate(value: RouteCoordinate) {
  return Number.isFinite(value[0]) && Number.isFinite(value[1]) && value[0] >= -180 && value[0] <= 180 && value[1] >= -90 && value[1] <= 90;
}

export function projectPrivateRouteGeometry(coordinates: RouteCoordinate[], width: number, height: number, maximumPoints = 96): ProjectedRoutePoint[] {
  const valid = coordinates.filter(isValidCoordinate);
  if (valid.length < 2 || width <= 0 || height <= 0) return [];
  const step = Math.max(1, Math.ceil(valid.length / Math.max(2, maximumPoints)));
  const sampled = valid.filter((_, index) => index % step === 0 || index === valid.length - 1);
  const longitudes = sampled.map(point => point[0]);
  const latitudes = sampled.map(point => point[1]);
  const west = Math.min(...longitudes), east = Math.max(...longitudes);
  const south = Math.min(...latitudes), north = Math.max(...latitudes);
  const longitudeSpan = Math.max(0.00001, east - west);
  const latitudeSpan = Math.max(0.00001, north - south);
  const padding = Math.min(12, width * 0.08, height * 0.16);
  return sampled.map(([longitude, latitude]) => ({
    x: padding + ((longitude - west) / longitudeSpan) * Math.max(1, width - padding * 2),
    y: padding + (1 - (latitude - south) / latitudeSpan) * Math.max(1, height - padding * 2),
  }));
}
