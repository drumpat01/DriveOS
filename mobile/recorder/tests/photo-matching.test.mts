import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import React from 'react';
import { act, create } from 'react-test-renderer';
import ts from 'typescript';
import * as model from '../src/photo-matching-model.ts';
import { themeCatalog } from '../src/theme-catalog.ts';

const journey: model.PhotoMatchJourney = { id: 'journey-a', title: 'Mountain drive', startTimeUtc: '2026-07-01T10:00:00Z', endTimeUtc: '2026-07-01T11:00:00Z', route: [
  { latitude: 20, longitude: 20, timestampUtc: '2026-07-01T10:00:00Z' },
  { latitude: 20, longitude: 20.01, timestampUtc: '2026-07-01T10:02:00Z' },
] };
const asset = (id = 'photo-a', extra: Partial<model.PhotoLibraryAsset> = {}): model.PhotoLibraryAsset => ({ id, createdAtUtc: '2026-07-01T10:01:00Z', width: 1000, height: 800, latitude: 20, longitude: 20.005, ...extra });

test('photo matching combines timestamps and route proximity, rejects distant GPS, and labels missing GPS', () => {
  const results = model.matchPhotosToJourneys([asset(), asset('far', { longitude: 30 }), asset('time', { latitude: null, longitude: null })], [journey]);
  assert.deepEqual(results.map(item => [item.asset.id, item.reason]), [['photo-a', 'time-and-place'], ['time', 'time']]);
  assert.equal(results[0].distanceMeters, 0, 'point between recorded samples follows real short segment');
});
test('photo matching never invents corridor across recording gaps or invalid coordinates', () => {
  const gapped = { ...journey, route: [{ latitude: 20, longitude: 20, timestampUtc: '2026-07-01T10:00:00Z' }, { latitude: 20, longitude: 20.03, timestampUtc: '2026-07-01T10:45:00Z' }] };
  assert.equal(model.matchPhotosToJourneys([asset('gap', { longitude: 20.015 })], [gapped]).length, 0);
  assert.equal(model.matchPhotosToJourneys([asset('invalid', { latitude: NaN })], [journey])[0].reason, 'time');
});
test('time window has explicit bounded margins and exact inclusion at edges', () => {
  const results = model.matchPhotosToJourneys([
    asset('before', { createdAtUtc: '2026-07-01T09:29:59Z' }), asset('edge', { createdAtUtc: '2026-07-01T09:30:00Z' }),
    asset('after', { createdAtUtc: '2026-07-01T11:30:01Z' }), asset('invalid', { createdAtUtc: 'not-a-date' }),
  ], [journey]);
  assert.deepEqual(results.map(item => item.asset.id), ['edge']); assert.equal(results[0].timeOffsetMinutes, 30);
});
test('duplicate photo assets and overlapping journeys return one deterministic recommendation', () => {
  const results = model.matchPhotosToJourneys([asset(), asset()], [{ ...journey, id: 'z' }, journey]);
  assert.equal(results.length, 1); assert.equal(results[0].journeyId, 'journey-a');
});
test('native metadata windows and matching share date validation and workload bounds', () => {
  const many = Array.from({ length: 60 }, (_, i) => ({ ...journey, id: `j${i}` }));
  assert.equal(model.preparePhotoMatchJourneys(many).length, 30); assert.equal(model.photoMatchWindows(many).length, 30);
  assert.equal(model.preparePhotoMatchJourneys([{ ...journey, endTimeUtc: '2026-01-01' }, { ...journey, id: 'long', endTimeUtc: '2027-01-01' }]).length, 0);
  assert.equal(model.matchPhotosToJourneys(Array.from({ length: 1000 }, (_, i) => asset(`a${i}`)), [journey]).length, 120);
});
test('dateline routes remain near their photos instead of crossing the world', () => {
  const dateline = { ...journey, route: [{ latitude: 20, longitude: 179.999 }, { latitude: 20, longitude: -179.999 }] };
  assert.equal(model.matchPhotosToJourneys([asset('date', { longitude: 180 })], [dateline])[0].reason, 'time-and-place');
});

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const require = createRequire(import.meta.url);
const deferred = <T,>() => { let resolve!: (value: T) => void; const promise = new Promise<T>(r => { resolve = r; }); return { promise, resolve }; };

function harness() {
  let permission = 'full', themeId: keyof typeof themeCatalog = 'redline', appState: ((state: string) => void) | undefined;
  let scanWait: ReturnType<typeof deferred<any>> | null = null, exportWait: ReturnType<typeof deferred<any>> | null = null;
  const calls = { permission: 0, scan: 0, cancel: [] as string[], export: [] as string[], imported: [] as string[] };
  let failPhotoB = false;
  const bridge = {
    getStatus: async () => ({ permission, sensitivityAvailable: false }),
    requestPermission: async () => { calls.permission++; return { permission, sensitivityAvailable: false }; },
    manageLimitedSelection: async () => {}, cancel: async (id: string) => { calls.cancel.push(id); },
    scan: async (id: string) => { calls.scan++; return scanWait ? scanWait.promise : { scanId: id, assets: [asset(), asset('photo-b')], truncated: false }; },
    preview: async () => ({ status: 'ready', dataUri: 'data:image/jpeg;base64,AAAA', checkedForNudity: false }),
    export: async (_scan: string, id: string) => { calls.export.push(id); return exportWait ? exportWait.promise : { fileName: 'Photo.jpg', contentType: 'image/jpeg', dataBase64: 'AAAA' }; },
  };
  const Animated = { Value: class { stopAnimation() {} setValue() {} }, timing: () => ({ start() {}, stop() {} }), View: 'AnimatedView' };
  const mocks: Record<string, any> = {
    './photo-matching-model': model, './photo-matching-library': { photoMatchingLibrary: bridge },
    './app-theme': { useAppTheme: () => ({ ...themeCatalog[themeId], id: themeId }) },
    'expo-crypto': { randomUUID: () => `scan-${calls.permission}` },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) },
    'react-native': { View: 'View', Text: 'Text', Pressable: 'Pressable', Image: 'Image', ActivityIndicator: 'ActivityIndicator', Animated,
      AccessibilityInfo: { isReduceMotionEnabled: async () => true, addEventListener: () => ({ remove() {} }) },
      AppState: { addEventListener: (_: string, fn: (state: string) => void) => { appState = fn; return { remove() {} }; } },
      Linking: { openSettings: async () => {} }, StyleSheet: { create: (s: any) => s, hairlineWidth: 1 }, useWindowDimensions: () => ({ width: 430 }),
      FlatList: ({ ListHeaderComponent, data, renderItem }: any) => React.createElement('FlatList', null, ListHeaderComponent,
        ...data.map((item: any) => React.createElement(React.Fragment, { key: item.asset.id }, renderItem({ item })))),
    },
  };
  const module = { exports: {} as any };
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../src/photo-matching-screen.tsx', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
  }).outputText, { module, exports: module.exports, require: (id: string) => mocks[id] ?? require(id), console });
  const props = { reviewKey: 'owner/memory', memoryName: 'Summer', journeys: [journey], onClose() {}, onImport: async (_photo: unknown, match: model.PhotoMatch) => {
    if (match.asset.id === 'photo-b' && failPhotoB) throw Error('disk full'); calls.imported.push(match.asset.id);
  } };
  let tree: ReturnType<typeof create>;
  const textOf = (node: any): string => typeof node === 'string' ? node : (node?.children ?? []).map(textOf).join('');
  return {
    calls, async mount() { await act(async () => { tree = create(React.createElement(module.exports.PhotoMatchingScreen, props)); }); },
    async unmount() { await act(async () => tree.unmount()); },
    async press(text: string) { const button = tree.root.findAllByType('Pressable').find(n => textOf(n).includes(text)); assert.ok(button, text); await act(async () => { await button.props.onPress(); }); },
    async selectAll() { const boxes = tree.root.findAllByType('Pressable').filter(n => n.props.accessibilityRole === 'checkbox'); await act(async () => { boxes.forEach(n => n.props.onPress()); }); },
    text: () => textOf(tree.toJSON()),
    async background() { await act(async () => appState?.('background')); },
    async theme(id: keyof typeof themeCatalog) { themeId = id; await act(async () => tree.update(React.createElement(module.exports.PhotoMatchingScreen, props))); },
    async identity(key: string) { props.reviewKey = key; await act(async () => tree.update(React.createElement(module.exports.PhotoMatchingScreen, { ...props }))); },
    permission: (value: string) => { permission = value; }, failPhotoB: (value: boolean) => { failPhotoB = value; },
    delayScan: () => (scanWait = deferred<any>()), delayExport: () => (exportWait = deferred<any>()),
  };
}

test('photo screen asks only after explicit action; denied permission never queries metadata', async () => {
  const h = harness(); h.permission('denied'); await h.mount();
  try { assert.equal(h.calls.permission, 0); assert.equal(h.calls.scan, 0); await h.press('Check access again'); assert.equal(h.calls.permission, 1); assert.equal(h.calls.scan, 0); }
  finally { await h.unmount(); }
});
test('photo import waits for selection and partial retry never repeats successful photos', async () => {
  const h = harness(); await h.mount();
  try {
    await h.press('Find matching photos'); assert.equal(h.calls.export.length, 0); await h.selectAll(); h.failPhotoB(true);
    await h.press('Add 2 selected photos'); assert.deepEqual(h.calls.imported, ['photo-a']);
    h.failPhotoB(false); await h.press('Add 1 selected photo');
    assert.deepEqual(h.calls.imported, ['photo-a', 'photo-b']); assert.deepEqual(h.calls.export, ['photo-a', 'photo-b', 'photo-b']);
  } finally { await h.unmount(); }
});
test('all four themes retain selected photos without rescanning or importing', async () => {
  const h = harness(); await h.mount();
  try { await h.press('Find matching photos'); await h.selectAll(); for (const id of ['dark', 'light', 'sakura', 'redline'] as const) { await h.theme(id); assert.match(h.text(), /2 of 24 selected/); } assert.equal(h.calls.scan, 1); assert.equal(h.calls.imported.length, 0); }
  finally { await h.unmount(); }
});
test('a backgrounded screen cannot import an export response that arrives late', async () => {
  const h = harness(); await h.mount();
  try {
    await h.press('Find matching photos'); await h.selectAll(); const pending = h.delayExport();
    // Button begins asynchronously; press() only awaits the void UI handler.
    await h.press('Add 2 selected photos'); await h.background();
    await act(async () => pending.resolve({ fileName: 'Photo.jpg', contentType: 'image/jpeg', dataBase64: 'AAAA' }));
    assert.equal(h.calls.imported.length, 0); assert.ok(h.calls.cancel.length > 0);
  } finally { await h.unmount(); }
});

test('changing the owner/Memory identity clears previews and blocks the old pending import', async () => {
  const h = harness(); await h.mount();
  try {
    await h.press('Find matching photos'); await h.selectAll(); const pending = h.delayExport();
    await h.press('Add 2 selected photos'); await h.identity('different-owner/other-memory');
    assert.doesNotMatch(h.text(), /2 of 24 selected/);
    await act(async () => pending.resolve({ fileName: 'Photo.jpg', contentType: 'image/jpeg', dataBase64: 'AAAA' }));
    assert.equal(h.calls.imported.length, 0); assert.ok(h.calls.cancel.length > 0);
  } finally { await h.unmount(); }
});

test('an older native build reports unavailable without requiring PhotoKit at startup', async () => {
  const module = { exports: {} as any };
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../src/photo-matching-library.ts', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { module, exports: module.exports, require: (id: string) => id === 'expo-modules-core' ? { requireOptionalNativeModule: () => null } : require(id) });
  assert.equal((await module.exports.photoMatchingLibrary.getStatus()).permission, 'unavailable');
  await module.exports.photoMatchingLibrary.cancel('old');
  assert.throws(() => module.exports.photoMatchingLibrary.scan('old', []), /next JourneyDeck app build/);
});

test('PhotoKit bridge enforces hidden/access/session/offline boundaries and strips image metadata', () => {
  const source = readFileSync(new URL('../modules/journeydeck-photo-library/ios/JourneyDeckPhotoLibraryModule.swift', import.meta.url), 'utf8');
  const podspec = readFileSync(new URL('../modules/journeydeck-photo-library/ios/JourneyDeckPhotoLibrary.podspec', import.meta.url), 'utf8');
  assert.match(source, /^import PhotosUI$/m, 'limited-library picker extension requires PhotosUI');
  assert.match(podspec, /s\.frameworks = .*'PhotosUI'/, 'links the picker framework in the native build');
  assert.match(source, /requestAuthorization\(for: \.readWrite\)/);
  assert.match(source, /includeHiddenAssets = false/); assert.match(source, /!asset\.isHidden/);
  assert.match(source, /allowedAssets\.contains\(assetID\), canRead\(\)/);
  assert.match(source, /isNetworkAccessAllowed = false/); assert.match(source, /fetchLimit = 401/);
  assert.match(source, /processingImages < 12/);
  assert.match(source, /cancelImageRequest/); assert.match(source, /UIGraphicsImageRenderer/);
  assert.match(source, /guard sensitive != true/); assert.match(source, /analysisPolicy != \.disabled/);
  assert.doesNotMatch(source, /performChanges|requestLocation|startUpdatingLocation|URLSession|write\(to/);
});
