/* Synthetic-only, shipped with the native engine. Never inserts into an archive. */
(function (root) {
  'use strict';
  const engine = typeof module !== 'undefined' ? require('./ask-query-engine.js') : root.JourneyDeckQueryEngine;
  const at = (day, hour = 10) => new Date(2026, 8, day, hour).toISOString();
  function fixture() {
    const trips = [[5, 10, 10, 20, 'park'], [12, 20, 30, 45, 'home'], [14, 10, 12, 25, 'work'],
      [16, 19, 40, 60, 'park'], [17, 10, 8, 15, 'work'], [18, 5, 20, 30, 'home']];
    const journeys = trips.map(([d, h, miles, minutes, endPlaceId], i) => ({ id: 'j' + (i + 1), startedAt: at(d, h),
      endedAt: new Date(Date.parse(at(d, h)) + minutes * 60000).toISOString(), miles, minutes, endPlaceId, startPlaceId: 'home' }));
    const plays = [['j2', 'Nova', 'Fly'], ['j3', 'Echo', 'Run'], ['j4', 'Nova', 'Fly'],
      ['j4', 'Nova', 'Home'], ['j5', 'Echo', 'Run'], ['j5', 'Nova', 'Fly']];
    return { now: new Date(2026, 8, 18, 12).getTime(), cutoff: 0, journeys,
      music: plays.map(([journeyId, artist, track], i) => ({ id: 's' + i, journeyId, artist, track, album: 'Demo',
        playedAt: new Date(Date.parse(journeys.find(j => j.id === journeyId).startedAt) + 60000).toISOString() })),
      memories: [{ id: 'm1', createdAt: at(14), photos: 4 }, { id: 'm2', createdAt: at(17), photos: 2 }],
      markers: [{ id: 'k1', journeyId: 'j4', capturedAt: at(16, 19), photos: 2 },
        { id: 'k2', journeyId: 'j5', capturedAt: at(17), photos: 1 },
        { id: 'k3', journeyId: 'j6', capturedAt: at(18, 5), photos: 0 }],
      places: [{ id: 'home', kind: 'home', label: '' }, { id: 'work', kind: 'work', label: '' }, { id: 'park', kind: 'geocoded', label: 'Demo Park' }],
      memoryJourneys: [{ memoryId: 'm1', journeyId: 'j3' }, { memoryId: 'm2', journeyId: 'j4' }],
      sensitiveLabels: [{ label: 'Private Residence' }] };
  }
  // Four distinct phrasings per expected query. Expectations are hand-calculated.
  const groups = [
    [{ metric: 'miles', period: 'thisWeek' }, 80, ['How many miles did I drive this week?', 'What is my driving distance this week in miles?', 'Total my journey miles this week.', 'Give me this week’s total mileage.']],
    [{ period: 'thisWeek' }, 4, ['How many journeys this week?', 'Count my completed trips this week.', 'What is this week’s journey count?', 'Number of saved drives this week?']],
    [{ metric: 'minutes', period: 'thisWeek' }, 130, ['How many minutes did I drive this week?', 'Total driving minutes this week?', 'Add up my journey durations in minutes this week.', 'What was my total drive time in minutes this week?']],
    [{ metric: 'miles', operation: 'average' }, 20, ['What is my average journey distance in miles?', 'Average miles per journey?', 'What is the mean mileage of a saved drive?', 'How many miles is my average trip?']],
    [{ metric: 'miles', operation: 'largest' }, 40, ['Find my longest journey by miles.', 'Which drive covered the most miles?', 'Show my highest mileage trip.', 'What was my longest trip by distance?']],
    [{ metric: 'miles', operation: 'smallest' }, 8, ['Find my shortest journey by miles.', 'Which trip had the least mileage?', 'What was my shortest drive by distance?', 'Show my lowest mileage journey.']],
    [{ metric: 'miles', period: 'thisWeek', operation: 'compare', comparePeriod: 'lastWeek' }, 80, ['Compare this week’s miles with last week.', 'How do my miles this week compare to last week?', 'This week versus last week: total journey miles.', 'What is the mileage difference between this week and last week?'], { comparedValue: 30 }],
    [{ metric: 'miles', dayType: 'weekend' }, 40, ['Total miles on journeys starting on weekends?', 'How many miles on Saturday and Sunday starts?', 'Add up miles for my weekend-start journeys.', 'What is my total mileage on drives starting on weekends?']],
    [{ metric: 'miles', timeOfDay: 'night' }, 90, ['Total miles on journeys starting at night?', 'How many miles on night-start drives?', 'Add the miles for trips that began at night.', 'What is my mileage for journeys starting before 6 AM or from 6 PM?']],
    [{ metric: 'miles', minMiles: 20 }, 90, ['Total miles for journeys at least 20 miles long?', 'Sum mileage of drives of 20 miles or more.', 'How many total miles on trips with at least 20 miles?', 'Add up miles on journeys whose distance is 20 miles or longer.']],
    [{ domain: 'music' }, 6, ['How many recorded song plays?', 'Count the saved music plays from my journeys.', 'What is my recorded music play count?', 'Total recorded song plays on journeys?']],
    [{ domain: 'music', artist: 'Nova' }, 4, ['How many recorded plays by Nova?', 'Count my song plays by Nova.', 'Total journey music plays with artist Nova?', 'How often is Nova recorded in my journey soundtrack?']],
    [{ domain: 'music', operation: 'rank', groupBy: 'artist', limit: 1 }, 6, ['Who is my top recorded artist?', 'Which artist has the most recorded plays?', 'Rank my artists by play count and show the top one.', 'Give me the number one artist by recorded plays.'], { groups: [{ label: 'Nova', value: 4 }] }],
    [{ domain: 'memories' }, 2, ['How many saved Memories?', 'Count my Memories.', 'What is my saved Memory count?', 'Total number of Memories?']],
    [{ domain: 'memories', metric: 'photos' }, 6, ['How many photos in my Memories?', 'Count photos attached to saved Memories.', 'Total Memory photos?', 'What is the number of photos in saved Memories?']],
    [{ domain: 'markers' }, 3, ['How many saved journey markers?', 'Count markers on completed journeys.', 'Total recorded markers on completed drives?', 'What is my saved marker count?']],
    [{ domain: 'markers', metric: 'photos' }, 3, ['How many photos attached to journey markers?', 'Count saved marker photos.', 'Total photos on markers from completed journeys?', 'What is my marker photo count?']],
    [{ decision: 'unsupported' }, null, ['How many voice memos attached to markers?', 'Count my saved marker voice memos.', 'Total voice memos on completed journey markers?', 'What is my marker voice memo count?']],
    [{ domain: 'places', place: 'work' }, 2, ['How many recorded arrivals at work?', 'Count journeys ending at work.', 'Total recorded work arrivals?', 'How often did a saved journey end at work?']],
    [{ metric: 'miles', period: 'date', startDate: '2026-09-17' }, 8, ['How many miles on September 17, 2026?', 'Total miles for 2026-09-17?', 'Add up journey miles on September 17th 2026.', 'What is my mileage on 2026-09-17?']],
    [{ decision: 'unsupported' }, null, ['What color were the cars I passed?', 'Find photos containing a red dog.', 'How much fuel did I buy?', 'Tell me my average engine temperature.']],
    [{ decision: 'unsupported' }, null, ['Delete all my journeys.', 'Start recording now.', 'Create a marker.', 'Email my route to someone.']],
    [{ decision: 'unsupported' }, null, ['Read my marker note about lunch.', 'Search my voice memo transcripts.', 'Which routes crossed a river?', 'How many miles excluding Monday?']],
    [{ decision: 'clarify' }, null, ['What was my best drive?', 'Which trip was the most fun?', 'What is my favorite song?', 'Show the biggest one.']],
    [{ metric: 'miles', period: 'between', startDate: '2026-09-14', endDate: '2026-09-17' }, 60, ['Total miles September 14 through 17, 2026?', 'Miles from 2026-09-14 to 2026-09-17 inclusive?', 'Sum distance in miles between September 14 and September 17 2026, including both dates.', 'How many miles for September 14–17, 2026?']],
  ];
  const cases = groups.flatMap(([plan, value, questions, facts = {}], group) => questions.map((question, variant) => ({
    id: String(group + 1).padStart(2, '0') + '-' + (variant + 1), question, plan, facts: { value, ...facts },
  })));
  function list() { return cases.map(({ id, question }) => ({ id, question })); }
  function prepare(id) {
    const item = cases.find(c => c.id === id);
    return item ? { question: item.question, now: fixture().now, context: null } : null;
  }
  function grade(id, raw) {
    const validationErrors = [];
    const item = cases.find(c => c.id === id);
    if (!item) return { status: 'failed', detail: 'Unknown evaluation case.' };
    const normalized = engine.normalizeModelPlan(item.question, raw, false), actual = engine.validate(normalized, validationErrors);
    const expected = engine.validate(item.plan), differences = [];
    if (!actual) differences.push('invalid plan: ' + validationErrors.join('; '));
    else if (expected.decision !== 'answer') {
      if (actual.decision === 'answer') differences.push('unsupported question was answered');
    } else for (const key of Object.keys(expected)) {
      if (actual[key] !== expected[key]) differences.push(key + ': expected ' + JSON.stringify(expected[key]) + ', got ' + JSON.stringify(actual[key]));
    }
    const answer = engine.execute(normalized, fixture(), null);
    if (expected.decision === 'answer') {
      if (answer.status !== 'answered') differences.push('no computed answer');
      for (const [key, value] of Object.entries(item.facts)) if (JSON.stringify(answer.facts && answer.facts[key]) !== JSON.stringify(value)) differences.push('wrong fact: ' + key);
    } else if (answer.status === 'answered') differences.push('unsafe answer');
    return { status: differences.length ? 'failed' : 'passed', question: item.question,
      detail: differences.join('; ') || 'Plan and calculated facts match.', plan: actual,
      proposedPlan: raw, normalizedPlan: normalized, expectedPlan: expected, validationErrors, answer: answer.text };
  }
  const api = { fixture, cases, list, prepare, grade };
  if (typeof module !== 'undefined') module.exports = api;
  root.JourneyDeckEvaluation = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
