import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  areJourneyDeckRequestsBlocked,
  beginNetworkActivity,
  classifyJourneyDeckRequest,
  getNetworkActivitySnapshot,
  recordBlockedJourneyDeckRequest,
  resetNetworkActivity,
  setJourneyDeckRequestsBlocked,
} from '../src/network-activity.ts';

const sourceRoot = new URL('../src/', import.meta.url);

async function sourceFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(entry => {
    const filename = path.join(directory, entry.name);
    return entry.isDirectory() ? sourceFiles(filename) : /\.(?:ts|tsx)$/.test(entry.name) ? [filename] : [];
  }));
  return nested.flat();
}

test('JourneyDeck request classification is stable and redacts record identifiers and query values', () => {
  assert.deepEqual(classifyJourneyDeckRequest('/api/recorder/journeys/private-drive-id?deviceId=private-device'), {
    operation: 'Archive refresh', reason: 'archive_refresh',
  });
  assert.deepEqual(classifyJourneyDeckRequest('/api/recorder/sessions/private-session/points', 'POST'), {
    operation: 'Recorder mirror', reason: 'recorder_mirror',
  });
  assert.deepEqual(classifyJourneyDeckRequest('/api/recorder/sessions/private-session/lastfm/sync', 'POST'), {
    operation: 'Spotify history import', reason: 'external_import',
  });
  assert.deepEqual(classifyJourneyDeckRequest('/api/recorder/memories', 'PUT'), {
    operation: 'Memory content', reason: 'user_content',
  });
});

test('the shared request boundary measures bytes and never retains URLs, tokens, bodies, or identifiers', () => {
  resetNetworkActivity();
  setJourneyDeckRequestsBlocked(false);
  const activity = beginNetworkActivity({ category: 'journeydeck_server', reason: 'archive_refresh', operation: 'Archive refresh', method: 'POST', uploadBytes: 41 });
  activity.finish({ outcome: 'succeeded', statusCode: 200, downloadBytes: 18 });
  const snapshot = getNetworkActivitySnapshot();
  assert.equal(snapshot.totalOperations, 1);
  assert.equal(snapshot.succeededOperations, 1);
  assert.equal(snapshot.uploadBytes, 41);
  assert.equal(snapshot.downloadBytes, 18);
  const serialized = JSON.stringify(snapshot);
  assert.doesNotMatch(serialized, /private\.example|server-secret-token|private-drive-id|private-device|privateCoordinate/);
});

test('session totals remain exact after the bounded recent-event window rolls over', () => {
  resetNetworkActivity();
  for (let index = 0; index < 100; index += 1) {
    const activity = beginNetworkActivity({ category: 'journeydeck_server', reason: 'connection_check', operation: 'Connection status', method: 'GET' });
    activity.finish({ outcome: 'succeeded', statusCode: 200, downloadBytes: 2 });
  }
  const activity = getNetworkActivitySnapshot();
  assert.equal(activity.totalOperations, 100);
  assert.equal(activity.succeededOperations, 100);
  assert.equal(activity.downloadBytes, 200);
  assert.equal(activity.recentEvents.length, 12);
});

test('local-only test mode records blocked JourneyDeck work without retaining request details', async () => {
  resetNetworkActivity();
  setJourneyDeckRequestsBlocked(true);
  assert.equal(areJourneyDeckRequestsBlocked(), true);
  recordBlockedJourneyDeckRequest({ operation: 'Archive refresh', reason: 'archive_refresh', method: 'GET' });
  try {
    const activity = getNetworkActivitySnapshot();
    assert.equal(activity.blockedOperations, 1);
    assert.equal(activity.byReason.archive_refresh, 1);
    const requestSource = await readFile(new URL('../src/network-request.ts', import.meta.url), 'utf8');
    assert.ok(requestSource.indexOf('if (areJourneyDeckRequestsBlocked())') < requestSource.indexOf('await fetch('));
  } finally {
    setJourneyDeckRequestsBlocked(false);
  }
});

test('all JavaScript JourneyDeck traffic crosses one auditable request boundary', async () => {
  const files = await sourceFiles(fileURLToPath(sourceRoot));
  const rawFetchFiles: string[] = [];
  for (const filename of files) {
    const source = await readFile(filename, 'utf8');
    if (/\bfetch\s*\(/.test(source)) rawFetchFiles.push(path.basename(filename));
  }
  assert.deepEqual(rawFetchFiles, ['network-request.ts']);
});

test('network measurement avoids response-body rescans and hidden Data Health redraws', async () => {
  const requestSource = await readFile(new URL('../src/network-request.ts', import.meta.url), 'utf8');
  const primarySections = await readFile(new URL('../src/primary-sections.tsx', import.meta.url), 'utf8');
  const shell = await readFile(new URL('../src/shell.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(requestSource, /response\.text\(\)|JSON\.parse\(body\)/);
  assert.match(requestSource, /headers\.get\('content-length'\)/);
  assert.match(primarySections, /active \? subscribeNetworkActivity\(setNetwork\) : undefined/);
  assert.match(shell, /active=\{tab === 'more'\}/);
});

test('normal navigation surfaces remain free of direct network access and expose local-only diagnostics', async () => {
  const primarySections = await readFile(new URL('../src/primary-sections.tsx', import.meta.url), 'utf8');
  const homeSummary = await readFile(new URL('../src/home-summary.ts', import.meta.url), 'utf8');
  const libraryModel = await readFile(new URL('../src/library-model.ts', import.meta.url), 'utf8');
  for (const source of [primarySections, homeSummary, libraryModel]) {
    assert.doesNotMatch(source, /\bfetch\s*\(|requestJourneyDeckJson|loadConnection/);
  }
  assert.match(primarySections, /Test without JourneyDeck server/);
  assert.match(primarySections, /setJourneyDeckRequestsBlocked/);
  assert.match(primarySections, /Tokens, record contents, coordinates, URLs, and personal identifiers are never recorded/);
});
