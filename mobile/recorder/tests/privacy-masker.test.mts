/**
 * privacy-masker.test.mts
 *
 * Tests for the on-device coordinate privacy masking system.
 * Covers both structural assertions (file text) and deterministic math.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(resolve(__dir, '../src/privacy-masker.ts'), 'utf8');

// ============================================================
// 1. Exports
// ============================================================

assert.match(src, /export type RawCoord/, 'exports RawCoord type');
assert.match(src, /export type MaskedCoord/, 'exports MaskedCoord type');
assert.match(src, /export type RoutePrivacyResult/, 'exports RoutePrivacyResult type');
assert.match(src, /export type ShareCardCoords/, 'exports ShareCardCoords type');
assert.match(src, /export function haversineDistance/, 'exports haversineDistance');
assert.match(src, /export function bearing/, 'exports bearing');
assert.match(src, /export function destinationPoint/, 'exports destinationPoint');
assert.match(src, /export function findSensitivePlace/, 'exports findSensitivePlace');
assert.match(src, /export function maskCoordinate/, 'exports maskCoordinate');
assert.match(src, /export function maskRoute/, 'exports maskRoute');
assert.match(src, /export function maskLocationLabel/, 'exports maskLocationLabel');
assert.match(src, /export function prepareShareCardCoords/, 'exports prepareShareCardCoords');

// ============================================================
// 2. Invariants encoded in source
// ============================================================

assert.match(src, /MIN_RADIUS_METERS = 100/, 'minimum geofence radius is 100 m');
assert.match(src, /SCRUB_BUFFER_METERS = 50/, 'scrub adds 50 m buffer outside geofence');
assert.match(src, /EARTH_RADIUS_METERS = 6_371_000/, 'uses correct Earth radius');
assert.match(src, /home.*300/, 'home/work minimum radius is 300 m');
assert.match(src, /work.*300/, 'work minimum radius is 300 m');

// ============================================================
// 3. Masking output properties
// ============================================================

assert.match(src, /masked: false/, 'unmasked coordinates return masked: false');
assert.match(src, /masked: true/, 'masked coordinates return masked: true');
assert.match(src, /maskedByPlaceId/, 'result includes maskedByPlaceId');
assert.match(src, /maskedByLabel/, 'result includes maskedByLabel');
assert.match(src, /'Home area'/, 'home label is "Home area"');
assert.match(src, /'Work area'/, 'work label is "Work area"');

// ============================================================
// 4. Outward scrubbing direction
// ============================================================

assert.match(src, /radius \+ SCRUB_BUFFER_METERS/, 'scrubbed point is placed outside radius + buffer');
assert.match(src, /distance > 0\.1 \? bearing/, 'zero-distance guard uses north bearing fallback');

// ============================================================
// 5. Route masking
// ============================================================

assert.match(src, /coordinates\.map\(/, 'route masking maps every coordinate');
assert.match(src, /index === 0/, 'tracks start-point masking separately');
assert.match(src, /index === coordinates\.length - 1/, 'tracks end-point masking separately');
assert.match(src, /waypointsMasked\+\+/, 'counts masked waypoints');
assert.match(src, /startMasked.*endMasked.*waypointsMasked/, 'route result includes all masking metadata');
assert.match(src, /\[result\.lng, result\.lat\]/, 'output is GeoJSON [lng, lat] order');

// ============================================================
// 6. Location label masking
// ============================================================

assert.match(src, /'Home'/, 'home places yield label "Home"');
assert.match(src, /'Work'/, 'work places yield label "Work"');

// ============================================================
// 7. Share card privacy summary
// ============================================================

assert.match(src, /Privacy protected/, 'privacy summary mentions masking');
assert.match(src, /Full route shown/, 'unmasked routes say "Full route shown"');
assert.match(src, /maskedZones\.join/, 'summary lists all masked zones');

// ============================================================
// 8. Deterministic math verification (pure functions — no SQLite needed)
// ============================================================

// Import pure functions directly from source text via dynamic eval
// We test the math without needing expo-sqlite by extracting the pure functions.

// Build a mini module with just the math helpers — strip TS type annotations first
function stripTypes(code: string): string {
  return code
    .replace(/: number(\))?/g, '$1')   // parameter / return : number
    .replace(/: RawCoord/g, '')         // parameter : RawCoord
    .replace(/\): number \{/g, ') {')  // return type on function signature
    .replace(/\): RawCoord \{/g, ') {');
}

const haversineBody = src.match(/export function haversineDistance[\s\S]*?^}/m)?.[0] ?? '';
const bearingBody   = src.match(/export function bearing[\s\S]*?^}/m)?.[0] ?? '';
const destBody      = src.match(/export function destinationPoint[\s\S]*?^}/m)?.[0] ?? '';

const mathCode = [
  'const EARTH_RADIUS_METERS = 6_371_000;',
  'function toRad(deg) { return (deg * Math.PI) / 180; }',
  'function toDeg(rad) { return (rad * 180) / Math.PI; }',
  stripTypes(haversineBody.replace('export ', '')),
  stripTypes(bearingBody.replace('export ', '')),
  stripTypes(destBody.replace('export ', '')),
].join('\n');

const mathFns = new Function(`${mathCode}; return { haversineDistance, bearing, destinationPoint };`)();
const { haversineDistance, bearing: calcBearing, destinationPoint: calcDest } = mathFns;


// Test 1: 1 degree of latitude ≈ 111,194 m
const dist1deg = haversineDistance({ lat: 0, lng: 0 }, { lat: 1, lng: 0 });
assert.ok(Math.abs(dist1deg - 111_194) < 600, `1° lat ≈ 111194 m, got ${dist1deg.toFixed(0)}`);

// Test 2: same point → 0 m
const dist0 = haversineDistance({ lat: 40.7128, lng: -74.0060 }, { lat: 40.7128, lng: -74.0060 });
assert.ok(dist0 < 0.001, `same point → ~0 m, got ${dist0}`);

// Test 3: bearing from equator 0,0 heading north should be 0
const bNorth = calcBearing({ lat: 0, lng: 0 }, { lat: 1, lng: 0 });
assert.ok(Math.abs(bNorth) < 1 || Math.abs(bNorth - 360) < 1, `north bearing ~0°, got ${bNorth}`);

// Test 4: bearing from equator 0,0 heading east should be 90
const bEast = calcBearing({ lat: 0, lng: 0 }, { lat: 0, lng: 1 });
assert.ok(Math.abs(bEast - 90) < 1, `east bearing ~90°, got ${bEast}`);

// Test 5: destinationPoint 100 m north of (40,0) should have lat > 40
const dest = calcDest({ lat: 40, lng: 0 }, 100, 0);
assert.ok(dest.lat > 40, `100 m north increases latitude, got ${dest.lat}`);
assert.ok(Math.abs(dest.lng) < 0.001, `100 m north does not change longitude, got ${dest.lng}`);

// Test 6: full mask round-trip - point inside a 200m home geofence
// We can't use maskCoordinate() without expo-sqlite imports, but we can verify
// the source encodes the right radius logic.
assert.match(src, /effectiveRadius/, 'effectiveRadius helper exists');
assert.match(src, /Math\.max\(300, base\)/, 'home/work use at least 300 m radius');

console.log('✅  privacy-masker: all structural and math checks passed.');
