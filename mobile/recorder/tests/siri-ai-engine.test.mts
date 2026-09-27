import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
const require = createRequire(import.meta.url);
const path = '../modules/journeydeck-recorder/ios/AskResources/';
const engine = require(path + 'ask-query-engine.js'), suite = require(path + 'ask-evaluation.js');

test('longest journey defaults explicitly to distance and honors explicit driving time', () => {
  const input = suite.fixture(); input.journeys[0].minutes = 180;
  for (const question of ['What is my longest drive?', 'What is my longest journey', 'What’s my longest trip?', 'Show me my longest journey by distance']) {
    // Neither model refusal nor an invented metric/period may override this complete query.
    const plan = engine.normalizeModelPlan(question, { decision: 'unsupported', metric: 'minutes', period: 'today' });
    const answer = engine.execute(plan, input);
    assert.equal(answer.status, 'answered'); assert.equal(answer.facts.value, 40);
    assert.match(answer.text, /^Longest by distance:/); assert.deepEqual(answer.context.journeyIds, ['j4']);
  }
  const duration = engine.execute(engine.directPlan('What is my longest journey by driving time?'), input);
  assert.equal(duration.facts.value, 180); assert.match(duration.text, /^Longest by driving time:/);
  assert.deepEqual(duration.context.journeyIds, ['j1']);
  for (const question of ['What is my longest drive this week?', 'What is my longest drive by duration this week?']) {
    assert.equal(engine.directPlan(question), null);
    const plan = engine.normalizeModelPlan(question, { decision: 'answer', operation: 'largest', metric: question.includes('duration') ? 'minutes' : 'miles', period: 'thisWeek' });
    assert.equal(plan.decision, 'answer'); assert.equal(plan.period, 'thisWeek');
    assert.equal(plan.metric, question.includes('duration') ? 'minutes' : 'miles');
  }
  const excluded = 'What is my longest drive without highways?';
  assert.equal(engine.directPlan(excluded), null);
  assert.equal(engine.normalizeModelPlan(excluded, { operation: 'largest', metric: 'miles' }).decision, 'unsupported');
});

test('semantic model plans execute without a second vocabulary gate; model refusals are not promoted', () => {
  const input = suite.fixture(); input.journeys[0].minutes = 180;
  const cases = [
    ['Which outing took me the furthest?', { operation: 'largest', metric: 'miles' }, 40, 'j4'],
    ['On which outing did I spend the most time behind the wheel?', { operation: 'largest', metric: 'minutes' }, 180, 'j1'],
    ['Which performer dominates my listening history?', { domain: 'music', operation: 'rank', groupBy: 'artist', limit: 1 }, 6, null],
    ['How far did I go on average this week?', { operation: 'average', metric: 'miles', period: 'thisWeek' }, 20, null],
  ] as const;
  for (const [question, intent, value, journeyId] of cases) {
    const plan = engine.resolvePlan(question, { ...engine.defaults, ...intent }, null, input.now);
    const answer = engine.execute(plan, input);
    assert.equal(answer.status, 'answered', question); assert.equal(answer.facts.value, value, question);
    if (journeyId) assert.deepEqual(answer.context.journeyIds, [journeyId]);
  }
  for (const decision of ['clarify', 'unsupported']) {
    const plan = engine.resolvePlan('Can you tell me something about my outing?', { ...engine.defaults, decision }, null, input.now);
    assert.equal(plan.decision, decision);
    // Refusals do not load or inspect any archive rows.
    const answer = engine.execute(plan, null);
    assert.equal(answer.reason, decision === 'clarify' ? 'clarificationNeeded' : 'unsupportedRequest');
    assert.equal(answer.evidence.length, 0); assert.equal(answer.context, null);
  }
  for (const raw of [{ ...engine.defaults, sql: 'SELECT secret' }, { ...engine.defaults, metric: 'fuel' }, { ...engine.defaults, limit: 500 }]) {
    assert.equal(engine.resolvePlan('Which outing took me the furthest?', raw, null, input.now), null);
  }
  for (const question of ['Which outing took me furthest excluding Monday?', 'Read my private notes', 'Delete all journeys']) {
    const plan = engine.resolvePlan(question, { ...engine.defaults, operation: 'largest', metric: 'miles' }, null, input.now);
    assert.equal(plan.decision, 'unsupported');
  }
  assert.equal(engine.resolvePlan('Count my audio clips', { ...engine.defaults, domain: 'markers', metric: 'voiceMemos' }, null, input.now).decision, 'unsupported');
});

test('100 golden queries have independently calculated expected results, including refusals', () => {
  assert.equal(suite.cases.length, 100);
  for (const item of suite.cases) assert.equal(suite.grade(item.id, item.plan).status, 'passed', item.id);
  assert.equal(suite.grade('01-1', { metric: 'minutes', period: 'thisWeek' }).status, 'failed');
  assert.equal(suite.grade('21-1', {}).status, 'passed');
});
test('offline grammar and model plans share one executor, including periods and follow-ups', () => {
  const input = suite.fixture();
  const cases = [
    ['How many miles did I drive this week?', 80],
    ['What is my longest drive this week?', 40],
    ['How many journeys on 2026-09-17?', 1],
    ['How many journeys in the last 2 days?', 3],
    ['What is my top artist this month?', 6],
  ] as const;
  for (const [question, value] of cases) {
    const offline = engine.resolvePlan(question, null, null, input.now);
    assert.ok(offline, question);
    const noisy = engine.resolvePlan(question, { ...engine.defaults, decision: 'unsupported', period: 'yesterday' }, null, input.now);
    assert.deepEqual(noisy, offline, 'a fully parsed local question does not depend on model availability');
    assert.equal(engine.execute(offline, input).facts.value, value, question);
  }
  const initial = engine.execute(engine.resolvePlan('What is my longest drive?', null, null, input.now), input);
  const followUp = engine.resolvePlan('What about last week?', null, initial.context, input.now);
  assert.equal(engine.execute(followUp, input, initial.context).facts.value, 30);
  assert.equal(engine.resolvePlan('What is my longest drive without highways?', null, null, input.now), null);
  assert.equal(engine.resolvePlan('What is my longest drive by duration this week?', null, null, input.now), null,
    'the distance-only offline grammar must not drop an explicit duration qualifier');
});

test('native JavaScriptCore resource order and all golden requests use the same plan contract', () => {
  const context = vm.createContext({});
  for (const name of ['ask-engine.js', 'ask-query-engine.js']) vm.runInContext(readFileSync(new URL(path + name, import.meta.url), 'utf8'), context);
  for (const item of suite.cases) {
    const input = suite.fixture(), raw = { ...engine.defaults, ...item.plan };
    const plan = engine.resolvePlan(item.question, raw, null, input.now);
    const nativePlan = vm.runInContext(`JourneyDeckQueryEngine.resolvePlan(${JSON.stringify(item.question)}, ${JSON.stringify(raw)}, null, ${input.now})`, context);
    assert.equal(JSON.stringify(nativePlan), JSON.stringify(plan), item.id);
    const answer = engine.execute(plan, input);
    if (raw.decision === 'answer') {
      assert.equal(answer.status, 'answered', item.question);
      for (const [key, value] of Object.entries(item.facts)) assert.deepEqual(answer.facts[key], value, item.question);
    } else assert.notEqual(answer.status, 'answered', item.question);
  }
});
test('resource executes without Node APIs using the same global entry points as JavaScriptCore', () => {
  const context = vm.createContext({});
  for (const name of ['ask-query-engine.js', 'ask-evaluation.js']) vm.runInContext(readFileSync(new URL(path + name, import.meta.url), 'utf8'), context);
  assert.equal(vm.runInContext('JourneyDeckEvaluation.list().length', context), 100);
  assert.equal(vm.runInContext('JourneyDeckEvaluation.grade("01-1",{metric:"miles",period:"thisWeek"}).status', context), 'passed');
});

test('model plans normalize irrelevant fields without weakening capability refusals', () => {
  const raw = (changes: any) => ({ ...engine.defaults, decision: 'answer', ...changes });
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
  assert.equal(engine.normalizeModelPlan('Tell me something surprising.', { ...engine.defaults, decision: 'unsupported' }).decision, 'unsupported');
});
test('all 100 phrasings survive irrelevant filler while capability refusals remain blocked', () => {
  for (const item of suite.cases) {
    const expected = engine.validate(item.plan);
    const noisy = { ...expected, decision: 'answer' }; // adversarial answer for denied capabilities
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

test('rank requests preserve an explicit top count and refuse counts beyond the supported limit', () => {
  const raw = { ...engine.defaults, domain: 'music', operation: 'rank', groupBy: 'artist' };
  const plan = engine.normalizeModelPlan('What are my top 5 artists?', raw);
  assert.equal(plan.limit, 5);
  assert.equal(engine.normalizeModelPlan('What are my top five artists?', raw).limit, 5);
  assert.equal(engine.execute(plan, suite.fixture()).facts.groups.length, 2);
  assert.equal(engine.normalizeModelPlan('What is my top artist?', raw).limit, 1);
  assert.equal(engine.validate(engine.normalizeModelPlan('What are my top 30 artists?', raw)), null);
});

test('standalone Siri rankings cannot inherit or invent a period, artist, or previous selection', () => {
  const raw = { ...engine.defaults, domain: 'journeys', operation: 'total', metric: 'miles', groupBy: 'none',
    period: 'thisMonth', artist: 'Olivia Rodrigo', selection: 'previous' };
  const plan = engine.normalizeModelPlan('What is my most played artist?', raw, true,
    engine.execute({ domain: 'music', operation: 'rank', groupBy: 'artist' }, suite.fixture()).context,
    suite.fixture().now);
  assert.equal(plan.period, 'available');
  assert.equal(plan.artist, '');
  assert.equal(plan.selection, 'history');
  assert.equal(plan.domain, 'music');
  assert.equal(plan.operation, 'rank');
  assert.equal(plan.metric, 'count');
  assert.equal(plan.groupBy, 'artist');
  assert.equal(plan.limit, 1);
  assert.match(engine.execute(plan, suite.fixture()).text, /Nova: 4 recorded song plays in your available history/);

  const explicit = engine.normalizeModelPlan('What was my most played artist Olivia Rodrigo this month?', raw, true);
  assert.equal(explicit.period, 'thisMonth');
  assert.equal(explicit.artist, 'Olivia Rodrigo');
});

test('plain top-artist questions use one local plan and do not consume Siri context', () => {
  const service = readFileSync(new URL('../modules/journeydeck-recorder/ios/JourneyDeckAskService.swift', import.meta.url), 'utf8');
  for (const question of ['What is my most played artist?', 'Who was my top artist?', 'My top artist']) {
    assert.equal(engine.isContextualQuestion(question), false);
    const plan = engine.directPlan(question);
    assert.deepEqual(plan, { ...engine.defaults, domain: 'music', operation: 'rank', groupBy: 'artist', limit: 1 });
    assert.match(engine.execute(plan, suite.fixture()).text, /Nova: 4 recorded song plays in your available history/);
  }
  assert.equal(engine.directPlan('Who was my top artist this month?'), null);
  assert.equal(engine.isContextualQuestion('What about last week?'), true);
  assert.equal(engine.isContextualQuestion('How many songs were on that journey?'), true);
  assert.match(service, /let previousTicket = \(contextual \? token : nil\)\.flatMap/);
  assert.match(service, /var selectedPlan: \[String: Any\]\? = savedPlan/);
  assert.match(service, /selectedPlan = try Self\.engine\("resolvePlan"/);
  assert.match(service, /if selectedPlan == nil, JourneyDeckAIPlanner\.availability/);
});

test('period follow-ups preserve the previous metric and filters even when the model is unavailable or proposes a different query', () => {
  const input = suite.fixture();
  const previous = engine.execute({ metric: 'miles', period: 'thisWeek' }, input).context;
  const plan = engine.followUpPlan('What about last week?', previous, input.now);
  assert.equal(plan.metric, 'miles'); assert.equal(plan.period, 'lastWeek');
  assert.deepEqual(engine.execute(plan, input, previous).facts,
    engine.execute({ metric: 'miles', period: 'lastWeek' }, input).facts);
  assert.deepEqual(engine.normalizeModelPlan('What about last week?', engine.defaults, true, previous, input.now), plan);
  assert.equal(engine.followUpPlan('What about the weather?', previous, input.now), null);
  assert.equal(engine.followUpPlan('What about last week?', { ...previous, expiresAt: input.now - 1 }, input.now), null);
  const sessionContext = { ...previous, expiresAt: 64092211200000 };
  assert.equal(engine.followUpPlan('What about last week?', sessionContext, input.now + 3600000).metric, 'miles');
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
