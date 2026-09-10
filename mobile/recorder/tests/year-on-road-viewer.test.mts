import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const React = require('react');
const { act, create } = require('react-test-renderer');
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const compile = (name: string) => ts.transpileModule(readFileSync(new URL(`../src/${name}`, import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
}).outputText;
const viewerSource = compile('year-on-road.tsx'), modelSource = compile('year-on-road-model.ts'), catalogSource = compile('theme-catalog.ts'), musicSource = compile('year-on-road-music.ts');

function fixture(width = 390) {
  let appStateListener: ((state: string) => void) | null = null;
  const soundStates: { enabled: boolean; playing: boolean; chapter: number; musicId: string }[] = [];
  const pendingAnimations: { duration: number; callback: (result: { finished: boolean }) => void }[] = [];
  class Value {
    value: number; listeners = new Map<string, (update: { value: number }) => void>();
    constructor(value: number) { this.value = value; }
    setValue(value: number) { this.value = value; this.listeners.forEach(fn => fn({ value })); }
    stopAnimation() {}
    interpolate(input: { outputRange: unknown[] }) { return input.outputRange[0]; }
    addListener(fn: (update: { value: number }) => void) { const id = String(this.listeners.size); this.listeners.set(id, fn); return id; }
    removeListener(id: string) { this.listeners.delete(id); }
  }
  const animation = { start() {}, stop() {} };
  const native = {
    AccessibilityInfo: { isReduceMotionEnabled: async () => true, isScreenReaderEnabled: async () => false, addEventListener: () => ({ remove() {} }) },
    Animated: { Value, createAnimatedComponent: (component: any) => component, View: 'AnimatedView', Image: 'AnimatedImage',
      timing: (_value: any, options: any) => ({ start(callback?: any) { if (callback) pendingAnimations.push({ duration: options.duration, callback }); }, stop() {} }),
      loop: () => animation, sequence: () => animation,
    },
    AppState: { currentState: 'active', addEventListener: (_name: string, listener: any) => { appStateListener = listener; return { remove() { appStateListener = null; } }; } },
    Easing: { linear: (x: number) => x, cubic: (x: number) => x, sin: (x: number) => x, out: (fn: any) => fn, inOut: (fn: any) => fn },
    Image: 'Image', Modal: 'Modal', Pressable: 'Pressable', ScrollView: 'ScrollView', Text: 'Text', View: 'View',
    StyleSheet: { create: (value: any) => value, absoluteFill: { position: 'absolute' } },
    useWindowDimensions: () => ({ width, height: width >= 760 ? 1024 : 844 }),
  };
  const cache: Record<string, any> = {};
  function load(name: string, source: string) {
    if (cache[name]) return cache[name];
    const module = { exports: {} as any };
    new Function('require', 'module', 'exports', source)((name: string) => {
      if (name === 'react' || name === 'react/jsx-runtime') return require(name);
      if (name === 'react-native') return native;
      if (name === 'react-native-safe-area-context') return { useSafeAreaInsets: () => ({ top: 20, bottom: 20 }) };
      if (name === 'expo-linear-gradient') return { LinearGradient: 'LinearGradient' };
      if (name === 'expo-status-bar') return { StatusBar: 'StatusBar' };
      if (name === 'expo-symbols') return { SymbolView: 'SymbolView' };
      if (name === 'react-native-svg') return { __esModule: true, default: 'Svg', Circle: 'Circle', Path: 'Path' };
      if (name === './year-on-road-model') return load('model', modelSource);
      if (name === './theme-catalog') return load('catalog', catalogSource);
      if (name === './year-on-road-music') return load('music', musicSource);
      if (name === './header-image-sources') return { headerImageSource: (_source: number, theme: string) => theme };
      if (name === './year-on-road-audio') return { useYearOnRoadAudio: (enabled: boolean, playing: boolean, chapter: number, musicId: string) => { soundStates.push({ enabled, playing, chapter, musicId }); return true; } };
      if (/\.png$|\.jpg$/.test(name)) return 1;
      throw new Error(`Unexpected dependency: ${name}`);
    }, module, module.exports);
    cache[name] = module.exports; return module.exports;
  }
  const { YearOnRoadViewer } = load('viewer', viewerSource);
  const year = new Date().getFullYear();
  const data = { journeys: [{ id: 'j', startedAt: new Date(year, 0, 1).toISOString(), miles: 42, durationMinutes: 55,
    route: { coordinates: [[10, 20], [10.1, 20.1]] } }], songs: [], memories: [] };
  let closes = 0, unlocks = 0;
  const props = { visible: true, data, appTheme: 'dark', premium: true, onClose: () => closes++, onUnlock: () => unlocks++ };
  return { Viewer: YearOnRoadViewer, props, soundStates, state: (value: string) => appStateListener?.(value), pendingAnimations,
    closes: () => closes, unlocks: () => unlocks, listenerAttached: () => appStateListener != null };
}

function byLabel(renderer: any, label: string) { return renderer.root.findByProps({ accessibilityLabel: label }); }
function text(renderer: any) { return renderer.root.findAllByType('Text').map((node: any) => node.children.filter((child: any) => typeof child === 'string' || typeof child === 'number').join('')).join(' '); }

test('viewer is gated for free users and an invisible viewer creates no playback/listeners', async () => {
  const f = fixture(); let renderer: any;
  await act(async () => { renderer = create(React.createElement(f.Viewer, { ...f.props, visible: false })); });
  assert.equal(f.soundStates.length, 0);
  assert.equal(f.listenerAttached(), false);
  await act(async () => { renderer.update(React.createElement(f.Viewer, { ...f.props, premium: false })); });
  assert.match(text(renderer), /A year worth reliving/);
  assert.doesNotMatch(text(renderer), /42/);
  const unlock = renderer.root.findAllByType('Pressable').find((node: any) => node.findAllByType('Text').some((n: any) => n.children.includes('Explore JourneyDeck Plus')));
  await act(async () => unlock.props.onPress());
  assert.equal(f.unlocks(), 1);
  await act(async () => renderer.unmount());
});

test('recap theme choice is independent, Match app resets it, and reopen starts from app appearance', async () => {
  const f = fixture(1024); let renderer: any;
  await act(async () => { renderer = create(React.createElement(f.Viewer, f.props)); });
  const openTheme = () => renderer.root.findAllByType('Pressable').find((node: any) => node.findAllByType('Text').some((n: any) => n.children.includes('Cinematic Dark')));
  await act(async () => openTheme().props.onPress());
  await act(async () => byLabel(renderer, 'Use Rosewater for this recap').props.onPress());
  assert.match(text(renderer), /Rosewater/);
  assert.equal(f.props.appTheme, 'dark');
  await act(async () => renderer.update(React.createElement(f.Viewer, { ...f.props, visible: false })));
  await act(async () => renderer.update(React.createElement(f.Viewer, f.props)));
  assert.match(text(renderer), /Cinematic Dark/);
  assert.doesNotMatch(text(renderer), /Rosewater/);
  await act(async () => openTheme().props.onPress());
  const match = renderer.root.findAllByType('Pressable').find((node: any) => node.findAllByType('Text').some((n: any) => n.children.some((child: any) => typeof child === 'string' && child.startsWith('Match app appearance'))));
  await act(async () => match.props.onPress());
  assert.match(text(renderer), /Cinematic Dark/);
  await act(async () => renderer.unmount());
});

test('playback navigation, background pause, recording sound guard and close work on a mounted phone viewer', async () => {
  const f = fixture(); let renderer: any;
  await act(async () => { renderer = create(React.createElement(f.Viewer, f.props)); });
  assert.equal(f.soundStates.at(-1)?.playing, false, 'autoplay is opt-in');
  await act(async () => byLabel(renderer, 'Enable original recap soundtrack').props.onPress());
  await act(async () => byLabel(renderer, 'Play recap').props.onPress());
  assert.deepEqual(f.soundStates.at(-1), { enabled: true, playing: true, chapter: 0, musicId: 'dark' });
  await act(async () => byLabel(renderer, 'Next chapter').props.onPress());
  assert.equal(f.soundStates.at(-1)?.chapter, 1);
  await act(async () => f.state('background'));
  assert.equal(f.soundStates.at(-1)?.playing, false);
  await act(async () => f.state('active'));
  assert.equal(f.soundStates.at(-1)?.playing, false, 'returning to foreground does not restart sound unexpectedly');
  await act(async () => renderer.update(React.createElement(f.Viewer, { ...f.props, soundAllowed: false })));
  assert.equal(f.soundStates.at(-1)?.enabled, false);
  assert.equal(byLabel(renderer, 'Sound is paused while journey recording is active').props.disabled, true);
  await act(async () => byLabel(renderer, 'Close year on the road').props.onPress());
  assert.equal(f.closes(), 1);
  await act(async () => renderer.update(React.createElement(f.Viewer, { ...f.props, visible: false })));
  assert.equal(f.listenerAttached(), false);
  await act(async () => renderer.unmount());
});

test('touching or scrolling holds chapter progress without interrupting the soundtrack', async () => {
  const f = fixture(); let renderer: any;
  await act(async () => { renderer = create(React.createElement(f.Viewer, f.props)); });
  await act(async () => byLabel(renderer, 'Enable original recap soundtrack').props.onPress());
  await act(async () => byLabel(renderer, 'Play recap').props.onPress());
  const story = renderer.root.findAllByType('ScrollView').find((node: any) => node.props.onTouchStart);
  await act(async () => story.props.onTouchStart());
  assert.equal(f.soundStates.at(-1)?.playing, true);
  assert.match(text(renderer), /Holding your place/);
  await act(async () => story.props.onTouchEnd());
  assert.equal(f.soundStates.at(-1)?.playing, true);
  await act(async () => renderer.unmount());
});

test('soundtrack follows recap appearance by default and a manual music choice stays independent', async () => {
  const f = fixture(); let renderer: any;
  await act(async () => { renderer = create(React.createElement(f.Viewer, f.props)); });
  assert.match(text(renderer), /Midnight Velocity/);
  const buttonWith = (label: string) => renderer.root.findAllByType('Pressable').find((node: any) => node.findAllByType('Text').some((n: any) => n.children.includes(label)));
  await act(async () => buttonWith('Cinematic Dark').props.onPress());
  await act(async () => byLabel(renderer, 'Use Rosewater for this recap').props.onPress());
  assert.match(text(renderer), /Petal Rush/);
  await act(async () => buttonWith('Petal Rush').props.onPress());
  await act(async () => byLabel(renderer, 'Use Champagne Apex for this recap').props.onPress());
  assert.match(text(renderer), /Champagne Apex/);
  await act(async () => buttonWith('Rosewater').props.onPress());
  await act(async () => byLabel(renderer, 'Use Warm Ivory for this recap').props.onPress());
  assert.match(text(renderer), /Champagne Apex/);
  assert.equal(f.soundStates.at(-1)?.musicId, 'redline');
  await act(async () => renderer.unmount());
});

test('all eight chapters render at phone and tablet sizes, with honest missing music and memory states', async () => {
  for (const width of [390, 1024]) {
    const f = fixture(width); let renderer: any;
    await act(async () => { renderer = create(React.createElement(f.Viewer, f.props)); });
    for (let chapter = 1; chapter < 8; chapter++) {
      await act(async () => byLabel(renderer, 'Next chapter').props.onPress());
      assert.equal(f.soundStates.at(-1)?.chapter, chapter);
      if (chapter === 4) assert.match(text(renderer), /No song plays have been matched/);
      if (chapter === 6) assert.match(text(renderer), /No Memories include journeys/);
    }
    await act(async () => byLabel(renderer, 'Replay from the start').props.onPress());
    assert.equal(f.soundStates.at(-1)?.chapter, 0);
    await act(async () => renderer.unmount());
  }
});
