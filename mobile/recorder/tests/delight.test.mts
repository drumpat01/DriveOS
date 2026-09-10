import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import {
  GRAND_TOURING_STAT_SERIES,
  delightMaterialMode,
  projectPrivateRouteGeometry,
  shouldAnimateStatistics,
} from '../src/delight-policy.ts';

test('Grand Touring statistics colors stay in the approved order', () => {
  assert.deepEqual(GRAND_TOURING_STAT_SERIES.map(item => item.name), ['Racing Green', 'Champagne', 'Touring Blue', 'Chrome']);
});

test('statistics animate once only while active and motion is allowed', () => {
  const presented = new Set<string>();
  assert.equal(shouldAnimateStatistics({ active: true, reduceMotion: false, dataKey: 'snapshot-a', presentedKeys: presented }), true);
  presented.add('snapshot-a');
  assert.equal(shouldAnimateStatistics({ active: true, reduceMotion: false, dataKey: 'snapshot-a', presentedKeys: presented }), false);
  assert.equal(shouldAnimateStatistics({ active: false, reduceMotion: false, dataKey: 'snapshot-b', presentedKeys: presented }), false);
  assert.equal(shouldAnimateStatistics({ active: true, reduceMotion: true, dataKey: 'snapshot-b', presentedKeys: presented }), false);
});

test('selective material policy honors Reduce Transparency and fallbacks', () => {
  assert.equal(delightMaterialMode({ glassApiAvailable: true, liquidGlassAvailable: true, reduceTransparency: false }), 'glass');
  assert.equal(delightMaterialMode({ glassApiAvailable: false, liquidGlassAvailable: false, reduceTransparency: false }), 'blur');
  assert.equal(delightMaterialMode({ glassApiAvailable: true, liquidGlassAvailable: true, reduceTransparency: true }), 'opaque');
});

test('route projection validates, bounds, and samples private coordinates', () => {
  const coordinates = Array.from({ length: 300 }, (_, index) => [-83 + index * 0.0001, 43 + index * 0.0001] as [number, number]);
  const projected = projectPrivateRouteGeometry(coordinates, 300, 72);
  assert.ok(projected.length >= 2 && projected.length <= 96);
  assert.ok(projected.every(point => point.x >= 0 && point.x <= 300 && point.y >= 0 && point.y <= 72));
});

test('delight stays attached to replay surfaces and real statistics data', () => {
  const map = readFileSync(new URL('../src/interactive-route-map.tsx', import.meta.url), 'utf8');
  const stats = readFileSync(new URL('../src/primary-sections.tsx', import.meta.url), 'utf8');
  assert.match(map, /JOURNEY PROGRESS/);
  assert.match(map, /journeyTimelineRail/);
  assert.doesNotMatch(map, /RouteTraceMoment/);
  assert.match(map, /AdaptiveGlassSurface/);
  assert.match(stats, /statisticsPresentationKey\(statistics\)/);
  assert.match(stats, /statistics\.dailyMiles\.map/);
});
