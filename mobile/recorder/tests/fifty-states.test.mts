import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const module = { exports: {} as any };
const modelSource = await readFile(new URL('../src/fifty-states-model.ts', import.meta.url), 'utf8');
const modelCode = ts.transpileModule(modelSource, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
vm.runInNewContext(modelCode, { module, exports: module.exports, require });
const model = module.exports;

const [screen, mapData, store, shell, ipadHome, ipadMemories, layout, config, releaseFeatures, navigation, route] = await Promise.all([
  readFile(new URL('../src/fifty-states-ui.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/fifty-states-map-data.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/fifty-states-store.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/shell.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/ipad-home.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/ipad-memories-screen.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/home-widget-layout.ts', import.meta.url), 'utf8'),
  readFile(new URL('../app.config.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/release-features.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/native-navigation.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../app/fifty-states.tsx', import.meta.url), 'utf8'),
]);

test('catalog contains exactly the fifty unique US states and repairs persisted values', () => {
  assert.equal(model.US_STATES.length, 50);
  assert.equal(new Set(model.US_STATES.map(([code]: [string]) => code)).size, 50);
  assert.deepEqual(Array.from(model.normalizeSeenStates(['TX', 'CA', 'TX', 'XX', null])), ['CA', 'TX']);
});

test('manual toggles and filters have deterministic checklist behavior', () => {
  const selected = model.toggleSeenState(['CA'], 'TX');
  assert.deepEqual(Array.from(selected), ['CA', 'TX']);
  assert.deepEqual(Array.from(model.toggleSeenState(selected, 'CA')), ['TX']);
  assert.equal(model.filterUSStates(selected, 'seen').length, 2);
  assert.equal(model.filterUSStates(selected, 'remaining').length, 48);
});

test('V3-only feature uses user-scoped local preferences and no capture stack', () => {
  assert.match(config, /fiftyStates: v3/);
  assert.match(releaseFeatures, /V3_FIFTY_STATES_ENABLED/);
  assert.match(screen, /if \(!V3_FIFTY_STATES_ENABLED\)/);
  assert.match(store, /getPrivatePreference<StoredChecklist>\(userId/);
  assert.match(store, /upsertPrivatePreference\(userId/);
  assert.match(store, /game\.fifty-states\.v1/);
  assert.doesNotMatch(screen, /expo-image-picker|expo-location|Camera|OCR|fetch\(/);
});

test('both adaptive Home surfaces expose the widget and route to the dedicated screen', () => {
  assert.match(layout, /'fiftyStates'/);
  assert.match(shell, /FiftyStatesHomeWidget/);
  assert.match(ipadHome, /FiftyStatesHomeWidget/);
  assert.match(shell, /router\.push\('\/fifty-states'\)/);
  assert.match(navigation, /name="fifty-states"/);
  assert.match(route, /FiftyStatesScreen as default/);
});

test('Memories exposes the agreed secondary Collections entry only through the V3 route', () => {
  assert.match(ipadMemories, /testID="fifty-states-collection"/);
  assert.match(ipadMemories, />COLLECTIONS</);
  assert.match(ipadMemories, />50 States</);
  assert.match(shell, /onFiftyStates=\{V3_FIFTY_STATES_ENABLED \? openFiftyStates : undefined\}/);
});

test('dedicated screen keeps the approved map, statistics, then chooser hierarchy', () => {
  const map = screen.indexOf('<FiftyStatesMap seen={seen} onToggle={toggleState} />');
  const stats = screen.indexOf('styles.statsCard', map);
  const filters = screen.indexOf('accessibilityRole="tablist"', stats);
  const chooser = screen.indexOf('styles.stateGrid', filters);
  assert.ok(map > 0 && stats > map && filters > stats && chooser > filters);
  assert.match(screen, /accessibilityRole="checkbox"/);
  assert.match(screen, /parked or as a passenger/);
});

test('map uses real state paths and derives every selection highlight from the active theme', () => {
  const mappedCodes = Array.from(mapData.matchAll(/^  ([A-Z]{2}): /gm), match => match[1]).sort();
  assert.deepEqual(mappedCodes, Array.from(model.US_STATES, ([code]: [string]) => code).sort());
  assert.match(screen, /from 'react-native-svg'/);
  assert.match(screen, /US_STATE_PATHS\[code\]/);
  assert.match(screen, /seen: theme\.palette\.accent/);
  assert.match(screen, /seenBorder: theme\.palette\.onAccent/);
  assert.doesNotMatch(screen, /FIFTY_STATES_MAP_POSITIONS/);
  assert.doesNotMatch(screen, /theme\.id === 'redline'/);
});

test('geographic state paths are projected into the visible SVG canvas', () => {
  const mapModule = { exports: {} as any };
  vm.runInNewContext(ts.transpileModule(mapData, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { module: mapModule, exports: mapModule.exports });
  const [left, top, width, height] = mapModule.exports.US_STATES_MAP_VIEW_BOX.split(' ').map(Number);
  const projected: [number, number][] = [];
  for (const [code] of model.US_STATES as [string, string][]) {
    const path: string = mapModule.exports.US_STATE_PATHS[code];
    assert.ok(path, `${code} has path data`);
    const values = Array.from(path.matchAll(/-?\d+(?:\.\d+)?/g), match => Number(match[0]));
    let area = 0;
    for (const ring of path.split('Z').filter(Boolean)) {
      const coordinates = Array.from(ring.matchAll(/-?\d+(?:\.\d+)?/g), match => Number(match[0]));
      let ringArea = 0;
      for (let i = 0; i < coordinates.length; i += 2) {
        const next = (i + 2) % coordinates.length;
        ringArea += coordinates[i] * coordinates[next + 1] - coordinates[next] * coordinates[i + 1];
      }
      area += Math.abs(ringArea / 2);
    }
    assert.ok(area > 10, `${code} has visible area, including small states and insets`);
    for (let index = 0; index < values.length; index += 2) {
      const x = values[index], y = values[index + 1];
      assert.ok(Number.isFinite(x) && Number.isFinite(y));
      assert.ok(x >= left && x <= left + width && y >= top && y <= top + height, `${code} is completely inside the map`);
      projected.push([x, y]);
    }
  }
  const xs = projected.map(([x]) => x);
  const ys = projected.map(([, y]) => y);
  assert.ok((Math.max(...xs) - Math.min(...xs)) / width > 0.98, 'map fills the canvas width');
  assert.ok((Math.max(...ys) - Math.min(...ys)) / height > 0.98, 'map fills the canvas height');
  assert.equal(mapModule.exports.US_STATES_MAP_ASPECT_RATIO, width / height);
});

test('V3 changes the Home recorder action copy without changing V2 production copy', async () => {
  assert.match(await readFile(new URL('../App.tsx', import.meta.url), 'utf8'), /V3_FIFTY_STATES_ENABLED \? 'Record Journey' : 'Start Journey'/);
});
