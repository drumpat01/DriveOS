import { touchFeedbackMock } from './touch-feedback-fixture.mts';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';
import React from 'react';
import { act, create } from 'react-test-renderer';
import ts from 'typescript';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const nodeRequire = createRequire(import.meta.url);
const host = (name: string) => ({ children, ...props }: any) => React.createElement(name, props, children);
const gesture = () => {
  const value: any = {};
  for (const key of ['maxPointers', 'onChange', 'onEnd']) value[key] = () => value;
  return value;
};
const source = readFileSync(new URL('../src/achievements-overview.tsx', import.meta.url), 'utf8');
const module = { exports: {} as any };
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
const palette = { page: '#081832', text: '#fff', muted: '#888', accent: '#fc0', card: '#123', line: '#345', inset: '#234' };
vm.runInNewContext(code, {
  module,
  exports: module.exports,
  require: (id: string) => ({
    react: React,
    'react/jsx-runtime': nodeRequire('react/jsx-runtime'),
    '@expo/ui': { BottomSheet: host('BottomSheet'), RNHostView: host('RNHostView') },
    'expo-symbols': { SymbolView: host('SymbolView') },
    'react-native': { View: host('View'), Text: host('Text'), ScrollView: host('ScrollView'), StyleSheet: { create: (value: any) => value }, useWindowDimensions: () => ({ width: 390, height: 844, fontScale: 1 }) },
    'react-native-gesture-handler': { Gesture: { Pan: gesture }, GestureDetector: host('GestureDetector') },
    'react-native-reanimated': { __esModule: true, default: { View: host('AnimatedView') }, useReducedMotion: () => false, useSharedValue: (initial: any) => { let value = initial; return { get: () => value, set: (next: any) => { value = typeof next === 'function' ? next(value) : next; } }; }, useAnimatedStyle: (fn: any) => fn(), withSpring: (value: any) => value },
    './touch-feedback': touchFeedbackMock,
    './fifty-states-store': { useFiftyStates: () => ({ completedAt: null }) },
    './release-features': { V3_FIFTY_STATES_ENABLED: false },
    './app-theme': { useAppTheme: () => ({ id: 'redline', palette }) },
    './medallion-artwork-image': { MedallionArtworkImage: host('MedallionArtworkImage') },
    './medallion-artwork': {
      isApprovedMedallion: (id: string) => ['first-track', 'long-way-home', 'thousand-mile', 'grand-tourer', 'first-note', 'long-play', 'soundtrack-100', 'memory-maker', 'picture-this', 'story-collector'].includes(id),
      medallionArtwork: Object.fromEntries(['first-track', 'long-way-home', 'thousand-mile', 'grand-tourer', 'first-note', 'long-play', 'soundtrack-100', 'memory-maker', 'picture-this', 'story-collector'].map(id => [id, { redline: `${id}-redline` }])),
    },
    '../modules/journeydeck-keepsakes': {
      JourneyDeckMedallion: ({ name, ...props }: any) => React.createElement('JourneyDeckMedallion', { ...props, accessibilityRole: 'imagebutton', accessibilityLabel: `Turn ${name} medallion` }),
    },
  } as Record<string, any>)[id] ?? (id.startsWith('../assets/') ? id : (() => { throw new Error(`Unexpected import ${id}`); })()),
});

const { AchievementsOverview, buildAchievements } = module.exports;
test('All 50 is V3 opt-in and uses the persisted completion date', () => {
  assert.equal(buildAchievements([]).length, 10);
  const locked = buildAchievements([], [], { completedAt: null }).at(-1);
  assert.equal(locked.id, 'all-fifty');
  assert.equal(locked.earned, false);
  const completedAt = '2026-09-18T12:00:00Z';
  const earned = buildAchievements([], [], { completedAt }).at(-1);
  assert.equal(earned.earned, true);
  assert.equal(earned.earnedAt, completedAt);
  assert.equal(buildAchievements([], [], { completedAt: 'invalid' }).at(-1).earned, false);
});
const journeys = Array.from({ length: 10 }, (_, index) => ({
  id: `j${index + 1}`,
  startedAt: `2026-09-${String(index + 1).padStart(2, '0')}T12:00:00Z`,
  startingLocation: 'Home',
  endingLocation: `Place ${index % 5}`,
  miles: 10,
  durationMinutes: 20,
  songCount: 10,
  soundtrackPreview: [],
}));
const memories = [{ id: 'm1', name: 'Lake Weekend', notes: '', artworkKey: 'road-trips', coverPhotoId: null, photos: [], journeyIds: ['j1'], createdAtUtc: '2026-09-12T18:00:00Z', updatedAtUtc: '2026-09-12T18:00:00Z' }];

test('achievement milestones retain their earning journey and locked state', () => {
  const byId = Object.fromEntries(buildAchievements(journeys, memories).map((item: any) => [item.id, item]));
  assert.equal(byId['first-track'].earnedAt, journeys[0].startedAt);
  assert.equal(byId['first-note'].earnedAt, journeys[0].startedAt);
  assert.equal(byId['long-play'].earnedAt, journeys[0].startedAt);
  assert.equal(byId['soundtrack-100'].earnedAt, journeys[9].startedAt);
  assert.equal(byId['thousand-mile'].earned, false);
  assert.equal(byId['memory-maker'].earnedAt, memories[0].createdAtUtc);
  assert.equal(byId['picture-this'].earned, false);
  assert.equal(byId['story-collector'].earned, false);
  assert.equal(byId['grand-tourer'].earned, false);
  assert.equal(byId['long-way-home'].earned, false);
});

test('Long Way Home unlocks on the first journey over 25 miles', () => {
  const longJourneys = [
    { ...journeys[0], id: 'short', miles: 25 },
    { ...journeys[1], id: 'first-long', miles: 25.1 },
    { ...journeys[2], id: 'later-long', miles: 80 },
  ];
  const achievement = buildAchievements(longJourneys).find((item: any) => item.id === 'long-way-home');
  assert.equal(achievement.earnedAt, longJourneys[1].startedAt);
});

test('Long Play requires 10 songs in one journey instead of a cumulative total', () => {
  const musicalJourneys = [
    { ...journeys[0], id: 'six-songs-one', songCount: 6 },
    { ...journeys[1], id: 'six-songs-two', songCount: 6 },
    { ...journeys[2], id: 'ten-songs', songCount: 10 },
  ];
  const achievement = buildAchievements(musicalJourneys).find((item: any) => item.id === 'long-play');
  assert.equal(achievement.earnedAt, musicalJourneys[2].startedAt);
});

test('photo and collection achievements retain the first photo and fifth Memory dates', () => {
  const memoryRows = Array.from({ length: 5 }, (_, index) => ({
    ...memories[0],
    id: `m${index + 1}`,
    name: `Memory ${index + 1}`,
    createdAtUtc: `2026-09-${String(index + 1).padStart(2, '0')}T18:00:00Z`,
    updatedAtUtc: `2026-09-${String(index + 1).padStart(2, '0')}T18:00:00Z`,
    photos: index === 2 ? [{ id: 'p1', fileName: 'road.jpg', contentType: 'image/jpeg', byteLength: 1200, createdAtUtc: '2026-09-03T19:00:00Z' }] : [],
  }));
  const byId = Object.fromEntries(buildAchievements([], memoryRows).map((item: any) => [item.id, item]));
  assert.equal(byId['picture-this'].earnedAt, memoryRows[2].photos[0].createdAtUtc);
  assert.equal(byId['story-collector'].earnedAt, memoryRows[4].createdAtUtc);
});

test('achievement overview opens a native detail sheet with turnable earned context', async () => {
  let tree: any;
  await act(() => { tree = create(React.createElement(AchievementsOverview, { journeys, memories })); });
  const badges = tree.root.findAllByType('Pressable');
  assert.equal(badges.length, 10);
  const artworkImages = tree.root.findAllByType('MedallionArtworkImage');
  assert.equal(artworkImages.length, 10, 'all badge faces use the shared circular crop');
  for (const artwork of artworkImages) {
    assert.equal(artwork.props.themeId, 'redline');
    assert.ok(artwork.props.achievementId);
    const style = Object.assign({}, ...artwork.props.style.filter(Boolean));
    assert.equal(style.width, style.height, 'the shared artwork component supplies the consistent physical rim');
  }
  assert.ok(badges.some((badge: any) => /Locked/.test(badge.props.accessibilityLabel)));
  await act(() => badges[0].props.onPress());
  const sheet = tree.root.findByType('BottomSheet');
  assert.equal(sheet.props.isPresented, true);
  assert.deepEqual(Array.from(sheet.props.snapPoints), ['full']);
  assert.equal(sheet.props.containerColor, palette.page);
  assert.equal(tree.root.findByType('RNHostView').props.matchContents, false, 'use the presented sheet dimensions, not the underlying screen');
  const medallion = tree.root.findByProps({ accessibilityLabel: 'Turn The First Track medallion' });
  assert.equal(medallion.props.accessibilityRole, 'imagebutton');
  assert.equal((Array.isArray(medallion.props.style) ? medallion.props.style[0] : medallion.props.style).alignSelf, 'center');
  const scroll = tree.root.findByType('ScrollView');
  assert.equal(scroll.props.style[0].width, '100%');
  assert.equal(scroll.props.bounces, false);
  await act(() => {
    scroll.props.onLayout({ nativeEvent: { layout: { width: 390, height: 740 } } });
    scroll.props.onContentSizeChange(390, 660);
  });
  assert.equal(scroll.props.scrollEnabled, false, 'fitting content does not scroll');
  await act(() => scroll.props.onContentSizeChange(390, 900));
  assert.equal(scroll.props.scrollEnabled, true, 'large accessibility text remains reachable');
  await act(() => scroll.props.onLayout({ nativeEvent: { layout: { width: 320, height: 550 } } }));
  assert.equal(medallion.props.style[1].height, 120, 'short sheets reserve room for milestone text');
  await act(() => scroll.props.onLayout({ nativeEvent: { layout: { width: 540, height: 900 } } }));
  assert.equal(medallion.props.style[1].height, 380, 'larger sheets use the available space for a prominent medal');
  const text = tree.root.findAllByType('Text').flatMap((node: any) => node.children).join(' ');
  for (const label of ['HOW', 'WHEN', 'WHY', 'ACHIEVEMENT EARNED']) assert.match(text, new RegExp(label));
  await act(() => sheet.props.onDismiss());
  assert.equal(tree.root.findByType('BottomSheet').props.isPresented, false);
});
