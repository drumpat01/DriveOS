import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
const require = createRequire(import.meta.url);
const path = '../modules/journeydeck-recorder/ios/AskResources/';
const engine = require(path + 'ask-query-engine.js'), suite = require(path + 'ask-evaluation.js');

test('100 golden queries have independently calculated expected results, including refusals', () => {
  assert.equal(suite.cases.length, 100);
  for (const item of suite.cases) assert.equal(suite.grade(item.id, item.plan).status, 'passed', item.id);
  assert.equal(suite.grade('01-1', { metric: 'minutes', period: 'thisWeek' }).status, 'failed');
  assert.equal(suite.grade('21-1', {}).status, 'passed');
});
test('resource executes without Node APIs using the same global entry points as JavaScriptCore', () => {
  const context = vm.createContext({});
  for (const name of ['ask-query-engine.js', 'ask-evaluation.js']) vm.runInContext(readFileSync(new URL(path + name, import.meta.url), 'utf8'), context);
  assert.equal(vm.runInContext('JourneyDeckEvaluation.list().length', context), 100);
  assert.equal(vm.runInContext('JourneyDeckEvaluation.grade("01-1",{metric:"miles",period:"thisWeek"}).status', context), 'passed');
});

test('revision 2 phone plans normalize unused fields without weakening capability refusals', () => {
  const raw = (changes: any) => ({ ...engine.defaults, decision: 'unsupported', ...changes });
  const samples = [
    ['01-1', raw({ metric: 'miles', period: 'thisWeek', days: 7 })],
    ['03-1', raw({ metric: 'minutes', period: 'thisWeek', comparePeriod: 'thisWeek' })],
    ['05-1', raw({ operation: 'largest', metric: 'miles', startDate: '2026-09-18' })],
    ['07-1', raw({ operation: 'compare', metric: 'miles', period: 'thisWeek', days: 7, startDate: '2026-09-15', endDate: '2026-09-21', comparePeriod: 'lastWeek' })],
    ['09-1', raw({ metric: 'miles', timeOfDay: 'night', startDate: '2026-09-18' })],
    ['11-1', raw({ domain: 'music', metric: 'songPlays' })],
    ['13-1', raw({ domain: 'music', operation: 'rank', groupBy: 'artist', limit: 5 })],
    ['15-1', raw({ domain: 'memories', metric: 'photos' })],
    ['17-1', raw({ domain: 'markers', metric: 'photos', startDate: '2026-09-18' })],
    ['19-1', raw({ domain: 'places', place: 'work', startDate: '2026-09-18' })],
    ['21-1', raw({})],
    ['23-1', raw({ domain: 'markers' })],
    ['25-1', raw({ metric: 'miles', period: 'between', startDate: '2026-09-14', endDate: '2026-09-17' })],
  ];
  for (const [id, plan] of samples) assert.equal(suite.grade(id, plan).status, 'passed', String(id));
  const normalized = engine.normalizeModelPlan('How many recorded song plays?', raw({ domain: 'music', metric: 'songPlays' }));
  assert.equal(normalized.metric, 'count'); assert.equal(normalized.decision, 'answer');
  assert.equal(engine.normalizeModelPlan('Delete all my journeys.', { ...engine.defaults, decision: 'answer' }).decision, 'unsupported');
  assert.equal(engine.normalizeModelPlan('What color were the cars I passed?', { ...engine.defaults, decision: 'answer' }).decision, 'unsupported');
  assert.equal(engine.normalizeModelPlan('What was my best drive?', { ...engine.defaults, decision: 'answer' }).decision, 'clarify');
  assert.equal(engine.normalizeModelPlan('Tell me something surprising.', { ...engine.defaults, decision: 'answer' }).decision, 'unsupported');
});
test('all 100 phrasings survive constrained-model filler noise or retain their refusal', () => {
  for (const item of suite.cases) {
    const expected = engine.validate(item.plan);
    const noisy = { ...expected, decision: expected.decision === 'answer' ? 'unsupported' : 'answer' };
    if (expected.period !== 'lastDays') noisy.days = 7;
    if (!['date', 'between'].includes(expected.period)) { noisy.startDate = '2026-09-18'; noisy.endDate = '2026-09-21'; }
    if (expected.operation !== 'compare') noisy.comparePeriod = 'thisWeek';
    if (expected.operation !== 'rank') noisy.groupBy = 'artist';
    if (expected.domain === 'music' && expected.metric === 'count') noisy.metric = 'songPlays';
    if (expected.operation === 'rank' && expected.limit === 1) noisy.limit = 5;
    assert.equal(suite.grade(item.id, noisy).status, 'passed', item.id + ': ' + item.question);
  }
});
test('untrusted plans reject extra instructions, invalid ranges, unsupported metrics and dropped-condition combinations', () => {
  const invalid = [{ sql: 'DELETE FROM local_journeys' }, { version: 3 }, { minMiles: -2 }, { maxMiles: 100001 },
    { minMiles: 10, maxMiles: 5 }, { limit: 0 }, { days: 9999 }, { metric: 'fuel' }, { domain: 'memories', artist: 'Nova' },
    { operation: 'rank', groupBy: 'artist' }, { domain: 'music', metric: 'miles' }, { operation: 'compare' },
    { comparePeriod: 'lastYear' }, { place: 'x\nDELETE' }, { period: 'available', startDate: '2026-01-01' }];
  for (const plan of invalid) assert.equal(engine.validate(plan), null, JSON.stringify(plan));
  for (const startDate of ['2026-02-30', '2026-13-01', 'invalid']) assert.equal(engine.execute({ period: 'date', startDate }, suite.fixture()).status, 'clarify');
});
test('explicit old history and comparison ranges never silently truncate', () => {
  const input = suite.fixture(); input.cutoff = new Date(2026, 8, 14).getTime();
  assert.equal(engine.execute({ period: 'allTime' }, input).status, 'historyLimited');
  assert.equal(engine.execute({ period: 'thisWeek', operation: 'compare', comparePeriod: 'lastWeek' }, input).status, 'historyLimited');
  assert.equal(engine.execute({ period: 'thisWeek' }, input).facts.value, 4);
});
test('selection follow-ups resolve one selected journey, expire, and cannot inherit an arbitrary total sample', () => {
  const input = suite.fixture();
  const longest = engine.execute({ operation: 'largest', metric: 'miles' }, input);
  assert.deepEqual(longest.context.journeyIds, ['j4']);
  const plays = engine.execute({ domain: 'music', selection: 'previous' }, input, longest.context);
  assert.equal(plays.facts.value, 2); assert.deepEqual(plays.evidence.map((e: any) => e.id), ['j4']);
  assert.equal(engine.execute({ selection: 'previous' }, input, { ...longest.context, expiresAt: 0 }).status, 'clarify');
  assert.equal(engine.execute({ selection: 'previous' }, input, engine.execute({}, input).context).status, 'clarify');
  assert.doesNotMatch(JSON.stringify(engine.modelContext(longest.context, input.now)), /j4|journeyIds/);
  input.journeys = input.journeys.filter((j: any) => j.id !== 'j4');
  assert.equal(engine.execute({ domain: 'music', selection: 'previous' }, input, longest.context).facts.value, 0);
});
test('private metadata and unsafe labels cannot appear in answers or entity descriptions', () => {
  const input = suite.fixture();
  input.music.forEach((m: any) => { m.artist = 'Private Residence'; m.track = '123 Secret Road'; });
  input.places.find((p: any) => p.kind === 'home').label = 'Private Residence';
  for (const plan of [{ domain: 'music', operation: 'rank', groupBy: 'track' }, { domain: 'music', operation: 'latest' }, { domain: 'places', operation: 'rank', groupBy: 'place' }]) {
    const answer = engine.execute(plan, input);
    assert.equal(answer.status, 'answered');
    assert.doesNotMatch(answer.text, /Private Residence|123 Secret Road/);
  }
  assert.doesNotMatch(JSON.stringify(engine.entities(input)), /Private Residence|Secret Road|Nova|latitude|notes/);
});
test('empty, corrupt, oversized archives and missing values produce distinct results', () => {
  const input = suite.fixture();
  assert.equal(engine.execute({ metric: 'miles', operation: 'average' }, { ...input, journeys: [] }).facts.value, null);
  assert.equal(engine.execute({}, { ...input, journeys: Array(20001).fill(input.journeys[0]) }).status, 'unavailable');
  assert.equal(engine.execute({}, { ...input, music: null }).status, 'unavailable');
  input.markers[0].photos = null;
  assert.equal(engine.execute({ domain: 'markers', metric: 'photos' }, input).status, 'unavailable');
});
test('rankings distinguish same song titles by artist and never attach unrelated evidence', () => {
  const input = suite.fixture(); input.music.forEach((m: any) => m.track = 'Same Title');
  const answer = engine.execute({ domain: 'music', operation: 'rank', groupBy: 'track' }, input);
  assert.equal(answer.facts.groups.length, 2);
  assert.deepEqual(answer.facts.groups.map((g: any) => g.value), [4, 2]);
  assert.deepEqual(answer.evidence, []);
});
