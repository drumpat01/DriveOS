import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const xcode = require('xcode');
const plugin = require('../plugins/with-journeydeck-siri.js');
const root = fileURLToPath(new URL('../', import.meta.url));

test('V3 marker intent is appended once and coexists with Start, Stop and Ask in one provider', () => {
  const source = readFileSync(join(root, 'siri/JourneyDeckSiriIntents.swift'), 'utf8');
  const marker = readFileSync(join(root, 'siri/JourneyDeckMarkerIntent.swift'), 'utf8');
  const output = plugin.addMarkerShortcutToSiriSource(plugin.addAskShortcutToSiriSource(source), marker);
  assert.equal(plugin.addMarkerShortcutToSiriSource(output, marker), output);
  assert.equal((output.match(/struct JourneyDeckAppShortcuts:/g) ?? []).length, 1);
  for (const intent of ['CreateJourneyMarkerIntent', 'StartJourneyIntent', 'StopJourneyIntent', 'AskJourneyDeckIntent']) {
    assert.ok(output.includes(`AppShortcut(intent: ${intent}()`));
  }
  assert.ok(output.includes('"Create a marker in \\(.applicationName)"'));
  assert.match(output, /await JourneyDeckSiriRecorder.createMarker\(\)/);
  assert.doesNotMatch(source, /CreateJourneyMarkerIntent/);
  assert.doesNotMatch(marker, /latitude|longitude|ownerUserId|controlToken/);
});

test('Siri intents are compiled in the app target exactly once', () => {
  const project = xcode.project(join(root, 'node_modules/react-native-view-shot/ios/RNViewShot.xcodeproj/project.pbxproj'));
  project.parseSync();
  const host = project.getFirstTarget().firstTarget;
  const source = 'RNViewShot/JourneyDeckSiriIntents.swift';
  plugin.addSiriSource(project, source);
  const once = project.writeSync();
  plugin.addSiriSource(project, source);
  assert.equal(project.writeSync(), once);
  const phase = project.pbxSourcesBuildPhaseObj(host.uuid);
  const siriFiles = phase.files.filter((entry: any) => entry.comment?.includes('JourneyDeckSiriIntents.swift'));
  assert.equal(siriFiles.length, 1);
  assert.ok(once.includes(source));
  assert.doesNotMatch(once, /path = undefined;/);
});

test('Siri shortcuts use the durable native recorder without exposing sensitive state', () => {
  const intents = readFileSync(join(root, 'siri/JourneyDeckSiriIntents.swift'), 'utf8');
  const facade = readFileSync(join(root, 'modules/journeydeck-recorder/ios/JourneyDeckSiriRecorder.swift'), 'utf8');
  assert.match(intents, /struct JourneyDeckAppShortcuts: AppShortcutsProvider/);
  assert.match(intents, /internal import JourneyDeckRecorder/);
  assert.match(intents, /StartJourneyIntent\(\)/);
  assert.match(intents, /StopJourneyIntent\(\)/);
  assert.match(intents, /\\\(\.applicationName\)/);
  assert.match(facade, /executeCommand\(operationID: operationID, action: "start"/);
  assert.match(facade, /@MainActor\s+public enum JourneyDeckSiriRecorder/);
  assert.match(facade, /executeCommand\(operationID: operationID, action: "finish", sessionID: sessionID/);
  assert.match(facade, /command\["state"\] as\? String == "applied"/);
  assert.doesNotMatch(intents, /controlToken|ownerUserId|latitude|longitude/);
});
