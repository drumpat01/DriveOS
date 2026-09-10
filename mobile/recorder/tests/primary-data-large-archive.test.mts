import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import test from 'node:test';
const require = createRequire(import.meta.url), ts = require('typescript');
const source = readFileSync(new URL('../src/primary-sections-data.ts', import.meta.url), 'utf8');
const loader = source.slice(source.indexOf('export async function loadPrimarySectionsData('));
const code = ts.transpileModule(loader, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;

test('a route archive over the recorder cache limit still loads Statistics and Atlas', async () => {
  const journey = { id: 'saved', startedAt: new Date().toISOString(), miles: 12, durationMinutes: 30, songCount: 0 };
  const detail = { ...journey, route: { coordinates: Array.from({ length: 250000 }, () => [12.123456, 34.123456]) } };
  assert.ok(JSON.stringify(detail).length > 4194304);
  const exports: any = {};
  vm.runInNewContext(code, { exports, Date, Set, Promise,
    getCurrentUser: () => ({ id: 'owner' }),
    primarySectionsCacheKey: () => 'primary.sections.owner.v1',
    writeAppCache: () => { throw new Error('JourneyDeck recorder cache value is invalid or too large.'); },
    loadJourneyArchive: async () => [journey],
    membershipCanAccessDate: () => true, isVisibleJourney: () => true,
    safeEpoch: (value: string) => Date.parse(value),
    appDataClient: { dashboard: async () => ({ summary: {} }), memories: async () => ({ memories: [] }),
      musicDashboard: async () => ({}), vehicleIntelligence: async () => ({ chargingSessions: [], places: [] }),
      localOrCachedJourney: () => detail },
    getLiveRecorderSnapshot: () => ({}), buildTimeline: () => [], buildStatistics: () => ({ miles: 12 }),
    buildSearchRecords: () => [], buildAtlasPatterns: () => [], enrichJourneyEndpointPlaces: async () => {},
  });
  const data = await exports.loadPrimarySectionsData(false, { timelineHistoryDays: null, atlasAccess: true });
  assert.equal(data.journeys[0], journey);
  assert.equal(data.details[0], detail);
  assert.equal(data.dashboard.summary.allTime.miles, 12);
  assert.equal(data.statistics.miles, 12);
});
