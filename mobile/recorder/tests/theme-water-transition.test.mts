import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';
import React from 'react';
import { act, create } from 'react-test-renderer';
import ts from 'typescript';
import * as sessionApi from '../src/theme-water-session.ts';
import * as geometryApi from '../src/theme-water-geometry.ts';
import * as catalogApi from '../src/theme-catalog.ts';
import * as shaderApi from '../src/theme-water-shader.ts';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const require = createRequire(import.meta.url);
const code = ts.transpileModule(readFileSync(new URL('../src/theme-water-transition.tsx', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
}).outputText;

test('the transition uses the recovered Skia shader inside the stable standard modal', () => {
  const source = readFileSync(new URL('../src/theme-water-transition.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /makeImageFromView/);
  assert.doesNotMatch(source, /FullWindowOverlay|react-native-svg|<Circle/);
  assert.match(source, /captureScreen/);
  assert.match(source, /@shopify\/react-native-skia/);
  assert.match(source, /<Canvas/);
  assert.match(source, /<Shader/);
  assert.match(source, /<Modal/);
  assert.match(source, /overlay_prepare_timeout/);
  assert.match(source, /onFinished\(\)/, 'a stalled overlay must clear and apply the selected theme');
});

test('the recovered shader and timing are locked to all eight approved golden checkpoints', () => {
  assert.equal(geometryApi.WATER_RIPPLE_DURATION, 1180);
  assert.equal(geometryApi.WATER_RIPPLE_PREPARE_TIMEOUT, 650);
  assert.deepEqual(shaderApi.THEME_WATER_GOLDEN_PROGRESS, [0, 0.12, 0.23, 0.35, 0.48, 0.64, 0.8, 1]);
  for (const recoveredLine of [
    'float front = progress * (radius + 210.0) - 24.0;',
    'float decay = exp(-max(wake, 0.0) / 74.0);',
    'float tail = 1.0 - smoothstep(125.0, 195.0, wake);',
    'float settle = 1.0 - smoothstep(0.72, 1.0, progress);',
    'float phase = wake * 0.115;',
    'float displacement = wave * envelope * 11.0 * refraction;',
    'float light = dot(direction, float2(-0.55, -0.835));',
    'float glint = pow(max(normalLight, 0.0), 4.0) * 0.24;',
  ]) assert.match(shaderApi.THEME_WATER_SHADER_SOURCE, new RegExp(recoveredLine.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));

  const checkpoints = [
    ['frame-0-0.png', 'ca93ad0364e515908de0d0166990a466af68f9a35d37f9768f1f2ae1e5991248'],
    ['frame-1-12.png', '338fdbd01373ee01fc147b9559e43d6e8c933debbccadd0ab754ae3e993ea20f'],
    ['frame-2-23.png', 'b90c6466ede438af65dab341e0f54784fda89ac4259491ce015de6974b027b93'],
    ['frame-3-35.png', '5aeb5b00ff4949afe0554ac3cbaaefb89eb9ee621a196bbb41d2a2523c7eeee6'],
    ['frame-4-48.png', 'c0c873a50fa4f98b22ad04fa3812b51e78391e2aa6c6c0945741cb01b1fc2408'],
    ['frame-5-64.png', '4092c1213e959b50d86f09b113f317b45fb7c227bb737d5be056cb71186d64db'],
    ['frame-6-80.png', '8fc3fd9fca258fe627e94e90dea772a89875b9626a1fd90c86712f321e63890c'],
    ['frame-7-100.png', '4c197737c570e57c98f9f03fb6ee496a865619ec67f7bd7deef5c12763b96e51'],
  ] as const;
  for (const [name, hash] of checkpoints) {
    const png = readFileSync(new URL(`../.cache/theme-water-review/${name}`, import.meta.url));
    assert.equal(png.readUInt32BE(16), 390);
    assert.equal(png.readUInt32BE(20), 844);
    assert.equal(createHash('sha256').update(png).digest('hex'), hash);
  }
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function harness(strict = false, renderOverlay = false) {
  let control: any, tree: any, changeTheme: (id: string) => void;
  const state = {
    id: 'dark',
    saved: [] as string[],
    applied: [] as string[],
    captureThemes: [] as string[],
    captureOptions: [] as Record<string, unknown>[],
    captures: [] as ReturnType<typeof deferred<any>>[],
    loaded: [] as string[],
    released: [] as string[],
    diagnostics: [] as { event: string; attempt: number; details: Record<string, unknown> }[],
    raf: [] as (() => void)[],
    holdCommit: false,
    pending: null as string | null,
    dimensions: { width: 390, height: 844 },
    motion: { animate: true, reduceTransparency: false },
    effectSetups: 0,
    effectCleanups: 0,
    timingCompletion: null as null | ((finished: boolean) => void),
    timingStarts: 0,
    imageLoaded: false,
    prepareTimeout: null as null | (() => void),
  };
  const mocks: Record<string, any> = {
    'react-native': {
      Platform: { OS: 'ios' },
      StyleSheet: { create: (styles: any) => styles, absoluteFill: {} },
      Modal: 'Modal',
      View: 'View',
      useWindowDimensions: () => state.dimensions,
    },
    '@shopify/react-native-skia': {
      Canvas: 'Canvas', Fill: 'Fill', ImageShader: 'ImageShader', Shader: 'Shader',
      Skia: { RuntimeEffect: { Make: () => ({ kind: 'RuntimeEffect' }) } },
      useImage: () => state.imageLoaded ? { width: () => 1320, height: () => 2868 } : null,
    },
    'react-native-view-shot': {
      captureScreen: (options: Record<string, unknown>) => {
        state.captureThemes.push(state.id);
        state.captureOptions.push(options);
        const capture = deferred<any>();
        state.captures.push(capture);
        return capture.promise;
      },
      releaseCapture: (uri: string) => state.released.push(uri),
    },
    'react-native-reanimated': {
      cancelAnimation: () => undefined,
      Easing: { linear: (value: number) => value },
      useDerivedValue: (factory: () => unknown) => ({ value: factory() }),
      useSharedValue: () => React.useMemo(() => ({ get: () => 0, set: () => undefined }), []),
      withTiming: (_to: number, _config: unknown, completion?: (finished: boolean) => void) => {
        state.timingStarts++;
        state.timingCompletion = completion ?? null;
        return 1;
      },
    },
    'react-native-worklets': { scheduleOnRN: (callback: () => void) => callback() },
    './use-core-motion': { useCoreMotion: () => state.motion },
    './theme-water-session': sessionApi,
    './theme-water-geometry': geometryApi,
    './theme-water-shader': shaderApi,
    './theme-catalog': catalogApi,
    './theme-animation-diagnostics': {
      recordThemeAnimationEvent: (event: string, attempt: number, details: Record<string, unknown> = {}) => {
        state.diagnostics.push({ event, attempt, details });
      },
    },
  };
  const module = { exports: {} as any };
  vm.runInNewContext(code, {
    module, exports: module.exports,
    require: (id: string) => mocks[id] ?? require(id),
    requestAnimationFrame: (callback: () => void) => { state.raf.push(callback); return state.raf.length; },
    setTimeout: (callback: () => void, duration?: number) => {
      if (duration === geometryApi.WATER_RIPPLE_PREPARE_TIMEOUT) {
        state.prepareTimeout = callback;
        return 'prepare-timeout';
      }
      return setTimeout(callback, duration);
    },
    clearTimeout: (timer: ReturnType<typeof setTimeout> | string) => {
      if (timer === 'prepare-timeout') { state.prepareTimeout = null; return; }
      clearTimeout(timer as ReturnType<typeof setTimeout>);
    },
  });
  function Content() {
    const [id, setId] = React.useState('dark');
    state.id = id;
    changeTheme = setId;
    control = module.exports.useWaterThemeTransition(id, (next: string) => state.saved.push(next), (next: string) => {
      state.applied.push(next);
      if (state.holdCommit) state.pending = next;
      else setId(next);
    });
    React.useEffect(() => {
      state.effectSetups++;
      return () => { state.effectCleanups++; };
    }, []);
    // Read the returned overlay frame directly: native GPU drawing is outside
    // this hook integration test; readiness is deliberately under test control.
    return React.createElement(React.Fragment, null, React.createElement('root'), renderOverlay ? control.overlay : null);
  }
  const element = () => strict
    ? React.createElement(React.StrictMode, null, React.createElement(Content))
    : React.createElement(Content);
  return {
    state,
    get control() { return control; },
    get frame() { return control.overlay?.props.frame; },
    mount: () => act(async () => { tree = create(element()); }),
    start: (next = 'light') => act(async () => { control.transitionTheme(next, { x: 112, y: 224 }); }),
    resolveCapture: (index: number) => act(async () => { state.captures[index].resolve(`snapshot-${index}`); }),
    ready: () => act(async () => { control.overlay.props.frame.onReady(); }),
    commit: () => act(async () => { changeTheme(state.pending!); state.pending = null; }),
    paint: () => act(async () => { const callbacks = state.raf.splice(0); callbacks.forEach(callback => callback()); }),
    showModal: () => act(async () => { tree.root.findByType('Modal').props.onShow(); }),
    loadSnapshot: () => act(async () => { state.imageLoaded = true; tree.update(element()); }),
    expirePreparation: () => act(async () => { state.prepareTimeout?.(); }),
    completeTiming: () => act(async () => { state.timingCompletion?.(true); }),
    finish: () => act(async () => { control.overlay.props.frame.onFinished(); }),
    rerender: () => act(async () => { tree.update(element()); }),
    close: () => act(async () => { tree?.unmount(); }),
  };
}

test('StrictMode effect replay leaves the mounted theme transition usable', async () => {
  const h = harness(true);
  try {
    await h.mount();
    assert.equal(h.state.effectSetups, 2, 'this test must actually replay mounting effects');
    assert.equal(h.state.effectCleanups, 1);
    await h.start();
    assert.deepEqual(h.state.saved, ['light']);
    assert.deepEqual(h.state.captureThemes, ['dark']);
    assert.equal(JSON.stringify(h.state.captureOptions), JSON.stringify([{ format: 'png', result: 'tmpfile', width: 390, height: 844 }]));
    await h.resolveCapture(0);
    assert.ok(h.frame);
    assert.equal(h.frame.playing, false);
    assert.equal(h.frame.before.uri, 'file://snapshot-0');
  } finally { await h.close(); }
});

test('hook draws one safe whole-window capture before revealing the committed live theme', async () => {
  const h = harness();
  try {
    h.state.holdCommit = true;
    await h.mount();
    await h.start();
    await h.resolveCapture(0);
    assert.deepEqual(h.state.applied, []);
    assert.deepEqual(h.state.captureThemes, ['dark']);
    assert.deepEqual({ ...h.frame.before.frame }, { x: 0, y: 0, width: 390, height: 844 });
    assert.deepEqual({ ...h.frame.origin }, { x: 112, y: 224 });

    await h.ready();
    assert.deepEqual(h.state.applied, ['light']);
    assert.equal(h.state.id, 'dark');
    await h.paint();
    await h.paint();
    assert.deepEqual(h.state.captureThemes, ['dark'], 'paint callbacks cannot replace a React theme commit');

    await h.commit();
    assert.equal(h.state.id, 'light');
    await h.paint();
    await h.paint();
    assert.deepEqual(h.state.captureThemes, ['dark'], 'the destination is the live app, never another unsafe tagged-view snapshot');
    assert.equal(h.frame.before.uri, 'file://snapshot-0');
    assert.equal(h.frame.playing, true);
    await h.finish();
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.equal(h.control.overlay, null);
    assert.deepEqual(h.state.applied, ['light']);
    assert.deepEqual(h.state.diagnostics.map(item => item.event), [
      'request', 'preference_saved', 'animation_decision', 'capture_start', 'capture_complete',
      'cover_requested', 'theme_apply_start',
      'theme_committed', 'theme_painted', 'water_surface_requested', 'overlay_cleared',
      'temporary_file_released',
    ]);
    assert.ok(h.state.diagnostics.every(item => item.attempt === 1));
  } finally { await h.close(); }
});

test('the standard modal loads the Skia cover, reveals the live theme, and settles without native screens overlay', async () => {
  const h = harness(false, true);
  try {
    await h.mount();
    await h.start();
    await h.resolveCapture(0);
    assert.equal(h.state.diagnostics.at(-1)?.event, 'modal_mounted');
    await h.showModal();
    await h.loadSnapshot();
    await h.paint();
    await h.paint();
    assert.ok(h.state.diagnostics.some(item => item.event === 'overlay_ready'));
    assert.deepEqual(h.state.applied, ['light']);
    await h.paint();
    await h.paint();
    assert.ok(h.state.diagnostics.some(item => item.event === 'water_started'));
    assert.ok(h.state.timingCompletion);
    await h.completeTiming();
    assert.equal(h.control.overlay, null);
    assert.ok(h.state.diagnostics.some(item => item.event === 'water_finished'));
    assert.ok(h.state.diagnostics.some(item => item.event === 'modal_unmounted'));
  } finally { await h.close(); }
});

test('a stalled modal image clears promptly and still applies the selected theme', async () => {
  const h = harness(false, true);
  try {
    await h.mount();
    await h.start();
    await h.resolveCapture(0);
    assert.ok(h.control.overlay);
    await h.expirePreparation();
    assert.equal(h.control.overlay, null);
    assert.deepEqual(h.state.applied, ['light']);
    assert.ok(h.state.diagnostics.some(item => item.event === 'overlay_prepare_timeout'));
  } finally { await h.close(); }
});

test('unmount while an old screenshot is pending never applies a theme or mounts the late image', async () => {
  const h = harness();
  await h.mount();
  await h.start();
  await h.close();
  assert.deepEqual(h.state.applied, [], 'unmount must dispose before any resize cleanup can settle');
  await h.resolveCapture(0);
  assert.deepEqual(h.state.applied, []);
  assert.equal(h.control.overlay, null);
});

test('replacement snapshots receive fresh overlay identity so readiness and progress cannot leak between taps', async () => {
  const h = harness();
  try {
    await h.mount();
    await h.start();
    await h.resolveCapture(0);
    const first = h.control.overlay;
    assert.notEqual(first.key, null, 'each water surface needs an explicit transition identity');
    await act(async () => {
      first.props.frame.onFinished();
      h.control.transitionTheme('sakura', { x: 65, y: 72 });
    });
    await h.resolveCapture(1);
    assert.notEqual(h.control.overlay.key, first.key);
    assert.equal(h.frame.before.uri, 'file://snapshot-1');
    assert.equal(h.frame.playing, false);
  } finally { await h.close(); }
});

test('an actual viewport resize settles the water and ignores an outdated pending screenshot', async () => {
  const h = harness();
  try {
    await h.mount();
    await h.start();
    h.state.dimensions = { width: 844, height: 390 };
    await h.rerender();
    assert.deepEqual(h.state.applied, ['light']);
    await h.resolveCapture(0);
    assert.equal(h.control.overlay, null);
  } finally { await h.close(); }
});

test('Reduce Transparency changes the shader uniform without restarting UI-thread timing', async () => {
  const h = harness(false, true);
  try {
    await h.mount();
    await h.start();
    await h.resolveCapture(0);
    await h.showModal();
    await h.loadSnapshot();
    await h.paint();
    await h.paint();
    await h.paint();
    await h.paint();
    assert.equal(h.state.timingStarts, 1);
    h.state.motion = { animate: true, reduceTransparency: true };
    await h.rerender();
    assert.equal(h.state.timingStarts, 1, 'accessibility updates must not restart the 1.18-second animation');
  } finally { await h.close(); }
});
