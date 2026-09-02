import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const source = (path: string) => readFile(new URL(path, root), 'utf8');

test('Build 13 compiles EAS Observe with source maps and a root performance boundary', async () => {
  const [app, packageJson, eas, observability] = await Promise.all([
    source('App.tsx'), source('package.json'), source('eas.json'), source('src/observability.ts'),
  ]);
  assert.equal(JSON.parse(packageJson).dependencies['expo-observe'], '~57.0.18');
  assert.equal(JSON.parse(eas).build.production.uploadSourceMaps, true);
  assert.match(app, /ObserveRoot\.wrap\(App\)/);
  assert.match(app, /configureJourneyDeckObservability\(\)/);
  assert.match(observability, /dispatchInDebug: false/);
  assert.match(observability, /sampleRate: 1/);
});

test('JourneyDeck diagnostics use a fixed privacy-safe vocabulary', async () => {
  const observability = await source('src/observability.ts');
  for (const event of [
    'recorder.armed', 'recorder.candidate_started', 'recorder.drive_confirmed',
    'recorder.preroll_recovered', 'recorder.journey_completed', 'recorder.completion_failed',
    'music.artwork_cached', 'cloudkit.sync_failed', 'database.recovery_started',
  ]) assert.match(observability, new RegExp(event.replace('.', '\\.')));
  assert.match(observability, /safeEventNames\.has\(event\)/);
  assert.match(observability, /\^\[a-z0-9\]/i);
  assert.doesNotMatch(observability, /latitude|longitude|address|track|artist|album|journeyId|sessionId|userId/i);
});
