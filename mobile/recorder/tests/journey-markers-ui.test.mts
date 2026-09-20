import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';
import React from 'react';
import { act, create } from 'react-test-renderer';
import ts from 'typescript';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const require = createRequire(import.meta.url);
const source = readFileSync(new URL('../src/journey-markers.tsx', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source + '\nexports.MarkerEditor = MarkerEditor;',
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
const host = (name: string) => ({ children, ...props }: any) => React.createElement(name, props, children);
const flush = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
const marker = { id: 'marker-test', capturedAt: '2026-09-17T12:00:00Z', locationAt: '2026-09-17T12:00:00Z', accuracyMeters: 5, notes: 'Original', sessionId: 'session', latitude: 0, longitude: 0 };

function fixture(compat = false) {
  const state = { notes: 'Original', captures: 0, imports: 0, failCapture: false, failSave: false, attachments: 0, done: 0, alerts: [] as string[], deleted: [] as string[], recording: false };
  const deps: Record<string, any> = {
    'react': React, 'react/jsx-runtime': require('react/jsx-runtime'),
    'react-native': { View: host('View'), Pressable: host('Pressable'), Text: host('Text'), TextInput: host('TextInput'), StyleSheet: { create: (s: any) => s },
      Alert: { alert: (title: string) => state.alerts.push(title) } },
    'expo-image': { Image: host('Image') },
    'expo-image-picker': { launchImageLibraryAsync: async () => ({ canceled: true }) },
    'expo-image-manipulator': { SaveFormat: { JPEG: 'jpeg' } },
    'expo-file-system/legacy': { deleteAsync: async (uri: string) => { state.deleted.push(uri); } },
    './journey-marker-compatibility': { MARKER_OTA_COMPAT: compat },
    './journey-marker-capture': { captureJourneyMarker: async (session: string) => { assert.equal(session, 'session'); state.captures++; if (state.failCapture) throw Error('Waiting for GPS'); return 'saved'; } },
    './auth': { getCurrentUser: () => ({ id: 'owner' }) }, './native-recorder-inbox': { syncNativeRecorderInbox: async () => { state.imports++; } },
    './local-archive-events': { subscribeLocalArchiveChanges: () => () => {} },
    './app-theme': { useThemedStyles: (s: any) => s, useAppTheme: () => ({ palette: { muted: '#aaa' } }) },
    './native-sheet': { NativeSheet: ({ children, footer, ...props }: any) => React.createElement('Sheet', props, children, footer) },
    './interactive-route-map': { InteractiveRouteMap: host('Map') }, './storage': { activeSession: () => state.recording ? { id: 'session' } : null },
    './release-features': { V3_MARKERS_PROTOTYPE_ENABLED: true },
    './journey-marker-store': {
      listMarkerMedia: () => [], listJourneyMarkers: () => [marker],
      saveMarkerNotes: (_owner: string, _id: string, notes: string) => { if (state.failSave) throw Error('Disk full'); state.notes = notes; },
      addMarkerMedia: async () => { if (state.failSave) throw Error('Disk full'); state.attachments++; },
    },
  };
  const exports: any = {};
  vm.runInNewContext(compiled, { exports, require: (id: string) => { assert.ok(id in deps, id); return deps[id]; }, setTimeout: () => 1, clearTimeout() {}, Date, Error, console });
  return { api: exports, state };
}
function text(node: any): string { return node.children.map((child: any) => typeof child === 'string' ? child : text(child)).join(''); }
function button(tree: any, label: string) { return tree.root.findAllByType('Pressable').find((node: any) => text(node) === label); }

test('marker editor offers notes and photos without voice recording', async () => {
  const f = fixture(true); let tree: any;
  await act(() => { tree = create(React.createElement(f.api.MarkerEditor, { userId: 'owner', marker, onClose() {} })); });
  assert.ok(button(tree, 'Save notes'));
  assert.ok(button(tree, 'Add photo'));
  assert.doesNotMatch(text(tree.root), /voice memo/i);
  await act(() => tree.unmount());
});

test('recording button prevents double tap and only confirms a durable capture', async () => {
  const f = fixture(); let tree: any;
  await act(() => { tree = create(React.createElement(f.api.CreateJourneyMarkerButton, { sessionId: 'session' })); });
  await act(async () => { const press = tree.root.findByType('Pressable').props.onPress; press(); press(); await flush(); });
  assert.equal(f.state.captures, 1); assert.equal(f.state.imports, 1);
  assert.match(text(tree.root), /Marker saved/);
  f.state.failCapture = true;
  await act(async () => { tree.root.findByType('Pressable').props.onPress(); await flush(); });
  assert.match(text(tree.root), /Waiting for GPS/); assert.equal(f.state.imports, 1);
  await act(() => tree.unmount());
});

test('notes stay dirty after failed save and become clean only after successful persistence', async () => {
  const f = fixture(); let tree: any;
  await act(() => { tree = create(React.createElement(f.api.MarkerEditor, { userId: 'owner', marker, onClose() {} })); });
  await act(() => tree.root.findByType('TextInput').props.onChangeText('Changed'));
  assert.equal(tree.root.findByType('Sheet').props.dirty, true);
  f.state.failSave = true;
  await act(async () => { button(tree, 'Save notes').props.onPress(); await flush(); });
  assert.equal(f.state.notes, 'Original'); assert.equal(tree.root.findByType('Sheet').props.dirty, true);
  f.state.failSave = false;
  await act(async () => { button(tree, 'Save notes').props.onPress(); await flush(); });
  assert.equal(f.state.notes, 'Changed'); assert.equal(tree.root.findByType('Sheet').props.dirty, false);
  await act(() => tree.unmount());
});

