import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';
import React from 'react';
import { act, create } from 'react-test-renderer';
import ts from 'typescript';
import { buildAtlasTravelStories } from '../src/atlas-travel-stories.ts';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const require = createRequire(import.meta.url);
const source = readFileSync(new URL('../src/primary-sections.tsx', import.meta.url), 'utf8');
const component = source.slice(source.indexOf('function AtlasTravelStoriesCards('), source.indexOf('function AtlasPulseCard('));
const code = ts.transpileModule(component + '\nexports.AtlasTravelStoriesCards = AtlasTravelStoriesCards;', { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
const module = { exports: {} as any };
const host = (name: string) => ({ children, ...props }: any) => React.createElement(name, props, children);
const cache = new Map<string, any>();
let saves = 0;
vm.runInNewContext(code, {
  module, exports: module.exports, require,
  setInterval, clearInterval,
  useState: React.useState, useMemo: React.useMemo, useEffect: React.useEffect,
  useMotionPreferences: () => ({ reduceMotion: true }),
  getCurrentUser: () => ({ id: 'profile-a' }),
  readAppCache: (key: string) => cache.get(key) ?? null,
  writeAppCache: (key: string, value: any) => cache.set(key, value),
  buildAtlasTravelStories,
  appDataClient: { async saveMemory(input: any) { saves += 1; assert.deepEqual(Array.from(input.journeyIds), ['drive']); } },
  useThemedStyles: () => new Proxy({}, { get: (_target, key) => String(key) }),
  darkStyles: {},
  View: host('view'), Text: host('text'), Pressable: host('button'), ScrollView: host('scroll'), Modal: host('modal'), TextInput: host('input'), KeyboardAvoidingView: host('keyboard-avoiding'),
  NeonWidgetOutline: host('outline'), SectionTitle: host('section'), TimelineRouteThumbnail: host('route'),
});

const endedAt = new Date(Date.now() - 30 * 60_000).toISOString();
const startedAt = new Date(Date.parse(endedAt) - 40 * 60_000).toISOString();
const drive = { journeyId: 'drive', sourceDriveId: 'drive', vehicleKey: 'vehicle', vehicleName: null,
  startedAt, endedAt, miles: 10, energyUsedKwh: null, startingLocation: 'Home', endingLocation: 'Lake',
  startingBatteryPercent: null, endingBatteryPercent: null };
const data = { tessieAtlas: { drives: [drive], charges: [] }, details: [{ id: 'drive', route: { coordinates: [[-87, 41], [-86.9, 41.1]] },
  soundtrack: [{ playedAt: new Date(Date.parse(startedAt) + 5 * 60_000).toISOString(), track: 'Road', artist: 'Artist', source: 'apple_music', artworkUrl: null }] }],
  memories: { memories: [] } };

test('Atlas travel cards keep navigation and optional Memory save under user control', async () => {
  const opened: string[] = [];
  let tree: any;
  try {
    await act(() => { tree = create(React.createElement(module.exports.AtlasTravelStoriesCards, { data, window: '30d', onJourney: (id: string) => opened.push(id), onRefresh() {} })); });
    assert.ok(tree.root.findByProps({ testID: 'atlas-song-travel' }));
    assert.ok(tree.root.findByProps({ testID: 'atlas-drive-home' }));
    assert.ok(tree.root.findByProps({ testID: 'atlas-quiet-moments' }));
    assert.ok(tree.root.findByProps({ testID: 'atlas-remember-drive' }));
    const buttons = () => tree.root.findAllByType('button');
    await act(() => buttons().find((item: any) => String(item.props.accessibilityLabel).startsWith('Open journey'))?.props.onPress());
    assert.deepEqual(opened, ['drive']);
    assert.equal(saves, 0);
    await act(() => buttons().find((item: any) => item.findAllByType('text').some((text: any) => text.props.children === 'Create Memory'))?.props.onPress());
    assert.equal(tree.root.findByType('modal').props.visible, true);
    assert.equal(tree.root.findByType('modal').props.animationType, 'none');
    assert.equal(saves, 0, 'opening the composer never saves automatically');
    await act(async () => { await buttons().find((item: any) => item.findAllByType('text').some((text: any) => text.props.children === 'Save Memory'))?.props.onPress(); });
    assert.equal(saves, 1);
    assert.deepEqual(Array.from(cache.get('atlas.remember-dismissed.profile-a.v1') ?? []), ['drive']);
    assert.equal(tree.root.findAllByType('view').filter((item: any) => item.props.testID === 'atlas-remember-drive').length, 0);
  } finally { await act(() => tree?.unmount()); }
});

test('dismissing a reflection prompt persists for this profile', async () => {
  cache.clear();
  let tree: any;
  try {
    await act(() => { tree = create(React.createElement(module.exports.AtlasTravelStoriesCards, { data, window: '30d', onJourney() {}, onRefresh() {} })); });
    const dismiss = tree.root.findAllByType('button').find((item: any) => item.findAllByType('text').some((text: any) => text.props.children === 'Dismiss'));
    await act(() => dismiss?.props.onPress());
    assert.deepEqual(Array.from(cache.get('atlas.remember-dismissed.profile-a.v1')), ['drive']);
    assert.equal(tree.root.findAllByType('view').filter((item: any) => item.props.testID === 'atlas-remember-drive').length, 0);
  } finally { await act(() => tree?.unmount()); cache.clear(); }
});

test('Atlas travel cards explain empty Tessie and music history without a reflection prompt', async () => {
  let tree: any;
  try {
    await act(() => { tree = create(React.createElement(module.exports.AtlasTravelStoriesCards, { data: null, window: '30d', onJourney() {}, onRefresh() {} })); });
    const copy = tree.root.findAllByType('text').map((item: any) => item.props.children).filter((item: any) => typeof item === 'string').join(' ');
    assert.match(copy, /Timestamped Apple Music or Last\.fm songs/);
    assert.match(copy, /Tessie records a matching outward drive/);
    assert.match(copy, /no music recorded/);
    assert.equal(tree.root.findAllByType('view').filter((item: any) => item.props.testID === 'atlas-remember-drive').length, 0);
  } finally { await act(() => tree?.unmount()); }
});
