import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';
import React from 'react';
import { act, create } from 'react-test-renderer';
import ts from 'typescript';

const require = createRequire(import.meta.url);
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const shell = readFileSync(new URL('../src/shell.tsx', import.meta.url), 'utf8');
const detail = shell.slice(shell.indexOf('function MemoryDetailScreen('), shell.indexOf('function OverviewMetrics('));
const host = (name: string) => ({ children, ...props }: any) => React.createElement(name, props, children);
const styles = new Proxy({}, { get: (_target, key) => String(key) });
const module = { exports: {} as any };
const navigations: any[] = [];
let adaptive: any = { fold: null, occlusionInsets: { top: 0, right: 0, bottom: 0, left: 0 } };
const code = ts.transpileModule(detail + '\nexports.MemoryDetailScreen = MemoryDetailScreen;', {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
vm.runInNewContext(code, {
  module, exports: module.exports, require,
  View: host('view'), Text: host('text'), ScrollView: host('scroll'), Pressable: host('button'),
  router: { push: (value: unknown) => navigations.push(value) },
  Reanimated: { View: host('view'), Text: host('text') },
  Animated: {
    Value: class { interpolate() { return 1; } },
    View: host('view'), ScrollView: host('scroll'), event: () => () => {},
  },
  DetailScreenFrame: ({ actions, children, ...props }: any) => React.createElement('frame', props, actions, children),
  NativeActionMenu: host('menu'), LinearGradient: host('gradient'),
  SymbolView: host('symbol'),
  StyleSheet: { absoluteFill: 'fill' }, darkStyles: styles,
  useThemedStyles: () => styles, useAppTheme: () => ({ palette: { card: '#111', line: '#555', accent: '#fc0', muted: '#aaa' }, gradient: (colors: unknown) => colors }),
  useDetailViewportInsets: () => ({ bottom: 24 }),
  useAdaptiveLayout: () => adaptive,
  verticalFoldContentColumns: (fold: any, padding: number) => fold?.axis === 'vertical' ? { beforeWidth: fold.before.width - padding, afterWidth: fold.after.width - padding, gap: fold.frame.width } : null,
  useMotionPreferences: () => ({ reduceMotion: true }),
  useRef: React.useRef,
  JourneyPhotoImage: host('photo'), MemoryArtwork: host('artwork'), EmptyCard: host('empty'),
  JourneyCard: host('journey-card'),
});

test('Memory actions share the fixed detail header and retain back/edit/share callbacks', async () => {
  let tree: any, edited = 0, shared = 0, backed = 0;
  const props = { visible: true, memory: { id: 'memory-1', name: 'A chapter', notes: 'Notes', photos: [], artworkKey: 'road-trips' },
    cover: null, journeys: [], onEdit: () => edited++, onShare: () => shared++, onClose: () => backed++ };
  await act(() => { tree = create(React.createElement(module.exports.MemoryDetailScreen, props)); });
  const frame = tree.root.findByType('frame');
  assert.equal(frame.props.title, 'Memory');
  frame.props.onBack();
  assert.equal(tree.root.findByType('menu').props.compact, true);
  const actions = tree.root.findByType('menu').props.actions;
  actions.find((a: any) => a.id === 'edit').onSelect(); actions.find((a: any) => a.id === 'share').onSelect();
  actions.find((a: any) => a.id === 'match').onSelect();
  assert.equal(navigations.at(-1).pathname, '/memory-photos/[id]');
  assert.equal(navigations.at(-1).params.id, 'memory-1');
  assert.equal(edited, 1); assert.equal(shared, 1); assert.equal(backed, 1);
  const before = tree.root.findByType('scroll').props;
  assert.equal(before.contentInsetAdjustmentBehavior, 'never');
  assert.equal(before.automaticallyAdjustContentInsets, false);
  assert.equal(before.contentContainerStyle[1].paddingTop, 16);
  const viewStyles = tree.root.findAllByType('view').map((view: any) => view.props.style);
  assert.ok(!viewStyles.includes('memoryDetailHeader'), 'no standalone action row above the artwork');
  assert.ok(!viewStyles.includes('memoryDetailSheet'), 'no legacy overlay frame inside the native page');
  await act(() => tree.update(React.createElement(module.exports.MemoryDetailScreen, { ...props, cover: { id: 'loaded-cover' } })));
  assert.deepEqual(tree.root.findByType('scroll').props.contentContainerStyle, before.contentContainerStyle,
    'loading cover artwork does not change the page inset');
  await act(() => tree.unmount());
});

test('Memory detail keeps its story and journey list in separate Duo panes without losing the open route', async () => {
  const props = { visible: true, memory: { id: 'memory-1', name: 'A chapter', notes: 'Notes', photos: [], artworkKey: 'road-trips' },
    cover: null, journeys: [{ id: 'journey-1' }], onEdit() {}, onShare() {}, onClose() {}, onOpenJourney() {} };
  let tree: any;
  try {
    adaptive = { fold: { axis: 'vertical', frame: { width: 27 }, before: { width: 634 }, after: { width: 634 } }, occlusionInsets: { top: 28, right: 0, bottom: 0, left: 0 } };
    await act(() => { tree = create(React.createElement(module.exports.MemoryDetailScreen, props)); });
    const layout = tree.root.findByProps({ testID: 'memory-detail-duo-layout' });
    assert.equal(layout.props.style.gap, 27);
    assert.equal(tree.root.findByProps({ testID: 'memory-detail-story-pane' }).props.style.width, 614);
    assert.equal(tree.root.findByProps({ testID: 'memory-detail-journeys-pane' }).props.style.width, 614);
    assert.equal(tree.root.findByType('scroll').props.contentContainerStyle[1].paddingTop, 44);
    adaptive = { fold: null, occlusionInsets: { top: 0, right: 0, bottom: 0, left: 0 } };
    await act(() => tree.update(React.createElement(module.exports.MemoryDetailScreen, props)));
    assert.equal(tree.root.findAllByType('frame').length, 1);
  } finally {
    adaptive = { fold: null, occlusionInsets: { top: 0, right: 0, bottom: 0, left: 0 } };
    await act(() => tree?.unmount());
  }
});
