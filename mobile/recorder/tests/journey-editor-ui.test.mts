import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import React from 'react';
import { act, create } from 'react-test-renderer';
import ts from 'typescript';
import { clipEditorRoute, moveEditorHandle, sampleEditorRoute } from '../src/journey-editor-timeline.ts';
import { previewJourneyEdit } from '../src/journey-editor-model.ts';
import { themeCatalog } from '../src/theme-catalog.ts';

const require = createRequire(import.meta.url);
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const startMs = Date.parse('2026-06-01T15:00:00Z'), endMs = startMs + 600_000;
const bounds = { startMs, endMs };
test('trim handles follow finger deltas, respect minimum duration, and never cross', () => {
  assert.equal(moveEditorHandle('start', startMs, 100, 1000, bounds, bounds), startMs + 60_000);
  assert.equal(moveEditorHandle('end', endMs, -100, 1000, bounds, bounds), endMs - 60_000);
  assert.equal(moveEditorHandle('start', startMs, 2000, 1000, bounds, bounds), endMs - 10_000);
  assert.equal(moveEditorHandle('split', startMs, -100, 1000, bounds, bounds), startMs + 10_000);
  assert.equal(moveEditorHandle('end', endMs, NaN, 1000, bounds, bounds), endMs);
  assert.equal(moveEditorHandle('end', endMs, 50, 0, bounds, bounds), endMs);
});
test('preview clipping interpolates both cut edges and crosses the dateline locally', () => {
  const points = [{ time: 0, latitude: 0, longitude: 179 }, { time: 100, latitude: 1, longitude: -179 }];
  const clipped = clipEditorRoute(points, { startMs: 25, endMs: 75 });
  assert.deepEqual(clipped.map(p => p.longitude), [179.5, -179.5]);
  assert.deepEqual(clipped.map(p => p.latitude), [.25, .75]);
  const many = sampleEditorRoute(Array.from({ length: 100_000 }, (_, time) => ({ time, latitude: 0, longitude: 0 })));
  assert.equal(many.length, 900); assert.equal(many[0].time, 0); assert.equal(many.at(-1).time, 99_999);
});

const host = (name: string) => ({ children, ...props }: any) => React.createElement(name, props, children);
const snapshot: any = { userId: 'owner', rootJourneyId: 'trip', journeyId: 'trip', revision: null, versionToken: 'version', canRestore: false, splitJourneyId: 'part2', segments: [{ id: 'trip', ...bounds }],
  original: { journey: { id: 'trip', userId: 'owner', startedAt: new Date(startMs).toISOString(), endedAt: new Date(endMs).toISOString(), miles: 1, durationMinutes: 10, songCount: 0 },
    points: Array.from({ length: 11 }, (_, sequence) => ({ journeyId: 'trip', sequence, latitude: 40 + sequence / 1000, longitude: 10, recordedAt: new Date(startMs + sequence * 60_000).toISOString() })), songs: [] } };
function fixture() {
  let theme: keyof typeof themeCatalog = 'redline', calls = 0, resolveSave: (() => void) | null = null;
  const gestures: any[] = [];
  const module = { exports: {} as any };
  const source = readFileSync(new URL('../src/journey-editor-screen.tsx', import.meta.url), 'utf8');
  const mocks: Record<string, any> = {
    'react-native': { View: host('view'), Text: host('text'), Pressable: host('button'), ScrollView: host('scroll'), ActivityIndicator: host('loading'),
      StyleSheet: { create: (v: any) => v, hairlineWidth: 1 }, Alert: { alert() {} },
      useWindowDimensions: () => ({ width: 1200, height: 850, fontScale: 1 }),
      AccessibilityInfo: { isReduceMotionEnabled: async () => true, addEventListener: () => ({ remove() {} }) } },
    'react-native-gesture-handler': { GestureDetector: host('detector'), Gesture: { Pan: () => {
      const config: any = {};
      const builder: any = new Proxy({}, { get: (_, name) => (...args: any[]) => { config[name] = args[0]; return builder; } });
      gestures.push(config); return builder;
    } } },
    'react-native-reanimated': { __esModule: true, default: { View: host('animated') },
      useSharedValue: (initial: number) => React.useMemo(() => { let value = initial; return { get: () => value, set: (next: number) => { value = next; } }; }, []),
      useAnimatedStyle: (fn: any) => fn(), withSpring: (v: any) => v },
    'react-native-worklets': { scheduleOnRN: (fn: any, ...args: any[]) => fn(...args) },
    'expo-router': { router: { back() {}, replace() {} }, useLocalSearchParams: () => ({ id: 'trip' }) },
    'expo-haptics': { selectionAsync: async () => {} },
    './app-theme': { useAppTheme: () => ({ ...themeCatalog[theme], id: theme }) },
    './auth': { getCurrentUser: () => ({ id: 'owner' }) },
    './detail-screen-frame': { DetailScreenFrame: host('frame'), useDetailViewportInsets: () => ({ top: 0, bottom: 0 }) },
    './native-navigation-context': { useJourneyDeckNavigation: () => ({ membership: { tier: 'paid' } }) },
    './journey-editor-map': { JourneyEditorMap: host('map') },
    './journey-editor-store': { loadJourneyEditor: () => snapshot, getJourneyEditConflictChoices: () => [],
      commitJourneyEdit: async () => { calls++; await new Promise<void>(resolve => { resolveSave = resolve; }); return { rootJourneyId: 'trip', journeyIds: ['trip'] }; } },
    './journey-editor-model': { previewJourneyEdit },
    './journey-editor-timeline': { clipEditorRoute, moveEditorHandle, sampleEditorRoute },
  };
  vm.runInNewContext(ts.transpileModule(source + '\nexports.Editor = Editor;', { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText,
    { exports: module.exports, module, require: (id: string) => mocks[id] ?? require(id), setTimeout, clearTimeout });
  return { Editor: module.exports.Editor, gestures, setTheme: (id: keyof typeof themeCatalog) => { theme = id; }, calls: () => calls, finish: () => resolveSave?.() };
}
const label = (node: any): string => node.findAllByType('text').map((t: any) => t.props.children).flat().join('');
function button(tree: any, text: string) { return tree.root.findAllByType('button').find((node: any) => label(node) === text); }

test('actual editor tracks a drag visually without committing, then commits once on release, retaining preview through all themes', async () => {
  const f = fixture(); let tree: any, saved = 0;
  const props = { snapshot, premium: true, onBack() {}, onSaved: async () => { saved++; } };
  await act(() => { tree = create(React.createElement(f.Editor, props)); });
  const layout = tree.root.findAllByType('view').find((v: any) => v.props.onLayout);
  await act(() => layout.props.onLayout({ nativeEvent: { layout: { width: 600 } } }));
  // The width change re-renders both handles, recreating their memoized gesture
  // (it depends on width); ['start', 'end'] mount in order, so the current
  // start-handle gesture is the second-to-last one created.
  const startGesture = f.gestures.at(-2);
  await act(() => { startGesture.onBegin(); startGesture.onUpdate({ translationX: 120 }); });
  assert.equal(tree.root.findByType('map').props.range.startMs, startMs, 'a live drag must not touch React state or re-render the map preview');
  assert.equal(f.calls(), 0);
  await act(() => { startGesture.onEnd(); });
  assert.equal(tree.root.findByType('map').props.range.startMs, startMs + 120_000, 'releasing commits the dragged value once');
  assert.equal(f.calls(), 0);
  for (const id of ['dark', 'light', 'sakura', 'redline'] as const) {
    f.setTheme(id); await act(() => tree.update(React.createElement(f.Editor, props)));
    assert.equal(tree.root.findByType('map').props.range.startMs, startMs + 120_000);
    assert.equal(button(tree, 'Trim').props.style({ pressed: false })[1].backgroundColor, themeCatalog[id].palette.accent);
  }
  await act(() => button(tree, 'Review changes').props.onPress());
  assert.equal(f.calls(), 0);
  const save = button(tree, 'Save changes');
  await act(() => { save.props.onPress(); save.props.onPress(); });
  assert.equal(f.calls(), 1); assert.equal(saved, 0);
  await act(async () => { f.finish(); });
  assert.equal(saved, 1);
  await act(() => tree.unmount());
});

test('free restore remains available but new trim/split edits stay disabled', async () => {
  const f = fixture(); let tree: any;
  await act(() => { tree = create(React.createElement(f.Editor, { snapshot: { ...snapshot, canRestore: true }, premium: false, onBack() {}, onSaved: async () => {} })); });
  assert.equal(button(tree, 'Trim').props.disabled, true);
  assert.equal(button(tree, 'Split').props.disabled, true);
  assert.equal(button(tree, 'Review changes').props.disabled, true);
  await act(() => button(tree, 'Restore original recording').props.onPress());
  assert.equal(button(tree, 'Restore original').props.disabled, false);
  assert.equal(f.calls(), 0);
  await act(() => tree.unmount());
});
