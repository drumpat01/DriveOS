import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const React = require('react');
const { act, create } = require('react-test-renderer');
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const source = ts.transpileModule(readFileSync(new URL('../src/year-on-road-audio.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

function fixture(options: { unavailable?: boolean; ready?: Promise<void> } = {}) {
  let loads = 0;
  const players: any[] = [], modes: any[] = [], playerOptions: any[] = [];
  const audio = {
    setAudioModeAsync: async (mode: any) => { modes.push(mode); await options.ready; },
    createAudioPlayer: (source: number, options: any) => {
      playerOptions.push(options);
      const player = { source, playCount: 0, pauseCount: 0, releaseCount: 0, seekCount: 0, volume: 0, loop: false,
        play() { this.playCount++; }, pause() { this.pauseCount++; }, release() { this.releaseCount++; },
        async seekTo(value: number) { assert.equal(value, 0); this.seekCount++; },
      };
      players.push(player); return player;
    },
  };
  const module = { exports: {} as any };
  new Function('require', 'module', 'exports', source)((name: string) => {
    if (name === 'react') return React;
    if (name === 'expo-audio') { loads++; if (options.unavailable) throw new Error('Native ExpoAudio unavailable'); return audio; }
    if (name.endsWith('.wav')) return name;
    throw new Error(`Unexpected ${name}`);
  }, module, module.exports);
  function Component(props: { enabled: boolean; playing: boolean; chapter: number; musicId?: string }) {
    return React.createElement('audio-state', { available: module.exports.useYearOnRoadAudio(props.enabled, props.playing, props.chapter, props.musicId ?? 'dark') });
  }
  return { Component, players, modes, playerOptions, loads: () => loads };
}

test('audio stays completely unloaded before opt-in and releases both players after playback', async () => {
  const f = fixture();
  let renderer: any;
  await act(async () => { renderer = create(React.createElement(f.Component, { enabled: false, playing: true, chapter: 0 })); });
  assert.equal(f.loads(), 0);
  assert.equal(f.players.length, 0);
  await act(async () => { renderer.update(React.createElement(f.Component, { enabled: true, playing: true, chapter: 0 })); });
  assert.equal(f.loads(), 1);
  assert.equal(f.players.length, 2);
  assert.equal(f.players[0].loop, true);
  assert.equal(f.players[0].playCount, 1);
  assert.equal(f.modes[0].shouldPlayInBackground, false);
  assert.equal(f.modes[0].interruptionMode, 'mixWithOthers');
  assert.deepEqual(f.playerOptions, [{ keepAudioSessionActive: true }, { keepAudioSessionActive: true }],
    'pause/completion must not deactivate Shazam’s shared audio session');
  await act(async () => { renderer.update(React.createElement(f.Component, { enabled: true, playing: false, chapter: 0 })); });
  assert.ok(f.players.every(player => player.pauseCount >= 1));
  const accentPlays = f.players[1].playCount;
  await act(async () => { renderer.update(React.createElement(f.Component, { enabled: true, playing: false, chapter: 1 })); });
  assert.equal(f.players[1].playCount, accentPlays, 'no accent while paused/backgrounded');
  await act(async () => { renderer.update(React.createElement(f.Component, { enabled: true, playing: true, chapter: 2 })); });
  assert.equal(f.players[1].seekCount, 1);
  assert.equal(f.players[1].playCount, accentPlays + 1);
  await act(async () => { renderer.update(React.createElement(f.Component, { enabled: false, playing: true, chapter: 2 })); });
  assert.ok(f.players.every(player => player.pauseCount >= 2), 'mute pauses both sound channels');
  await act(async () => renderer.unmount());
  assert.ok(f.players.every(player => player.releaseCount === 1));
});

test('an old binary lacking ExpoAudio keeps the recap alive and reports unavailable without repeated initialization', async () => {
  const f = fixture({ unavailable: true });
  let renderer: any;
  await act(async () => { renderer = create(React.createElement(f.Component, { enabled: true, playing: true, chapter: 0 })); });
  assert.equal(renderer.root.findByType('audio-state').props.available, false);
  assert.equal(f.players.length, 0);
  assert.equal(f.loads(), 1);
  await act(async () => { renderer.update(React.createElement(f.Component, { enabled: true, playing: true, chapter: 1 })); });
  assert.equal(f.loads(), 1);
  await act(async () => renderer.unmount());
});

test('closing while audio-session configuration is pending cannot start or leak players afterward', async () => {
  let finish!: () => void;
  const ready = new Promise<void>(resolve => { finish = resolve; });
  const f = fixture({ ready });
  let renderer: any;
  await act(async () => { renderer = create(React.createElement(f.Component, { enabled: true, playing: true, chapter: 0 })); });
  await act(async () => renderer.unmount());
  await act(async () => finish());
  assert.equal(f.players.length, 0);
});

test('disabling sound while audio setup is pending creates no players', async () => {
  let finish!: () => void;
  const ready = new Promise<void>(resolve => { finish = resolve; });
  const f = fixture({ ready });
  let renderer: any;
  await act(async () => { renderer = create(React.createElement(f.Component, { enabled: true, playing: true, chapter: 0 })); });
  await act(async () => { renderer.update(React.createElement(f.Component, { enabled: false, playing: true, chapter: 0 })); });
  await act(async () => finish());
  assert.equal(f.players.length, 0);
  await act(async () => renderer.unmount());
});

test('a failing native pause still releases both players during close', async () => {
  const f = fixture(); let renderer: any;
  await act(async () => { renderer = create(React.createElement(f.Component, { enabled: true, playing: true, chapter: 0 })); });
  for (const player of f.players) player.pause = () => { throw new Error('Native audio interrupted'); };
  await act(async () => renderer.unmount());
  assert.ok(f.players.every(player => player.releaseCount === 1));
});

test('changing the selected score replaces only the looping bed and continues playback', async () => {
  const f = fixture(); let renderer: any;
  await act(async () => { renderer = create(React.createElement(f.Component, { enabled: true, playing: true, chapter: 0, musicId: 'dark' })); });
  const firstBed = f.players[0], accent = f.players[1];
  assert.match(firstBed.source, /midnight-velocity/);
  await act(async () => { renderer.update(React.createElement(f.Component, { enabled: true, playing: true, chapter: 0, musicId: 'sakura' })); });
  assert.equal(f.players.length, 3);
  assert.match(f.players[2].source, /petal-rush/);
  assert.equal(f.players[2].playCount, 1);
  assert.equal(firstBed.releaseCount, 1);
  assert.equal(accent.releaseCount, 0);
  await act(async () => renderer.unmount());
  assert.equal(f.players[2].releaseCount, 1);
  assert.equal(accent.releaseCount, 1);
});
