import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { isVisibleJourney, visibleJourneys } from '../src/journey-visibility.ts';

const testDirectory = dirname(fileURLToPath(import.meta.url));

const route = (startingLocation: string | null, endingLocation: string | null) => ({ startingLocation, endingLocation });

test('only same-anchor Home and Work journeys are ignored', () => {
  assert.equal(isVisibleJourney(route('Home', 'Home')), false);
  assert.equal(isVisibleJourney(route(' work ', 'WORK')), false);

  assert.equal(isVisibleJourney(route('Home', 'Work')), true);
  assert.equal(isVisibleJourney(route('Work', 'Home')), true);
  assert.equal(isVisibleJourney(route('Home', 'Gym')), true);
  assert.equal(isVisibleJourney(route('Gym', 'Home')), true);
  assert.equal(isVisibleJourney(route('Work', 'School')), true);
  assert.equal(isVisibleJourney(route('School', 'Work')), true);
  assert.equal(isVisibleJourney(route('School', 'School')), true);
  assert.equal(isVisibleJourney(route('Home Office', 'Home Office')), true);
  assert.equal(isVisibleJourney(route(null, null)), true);
});

test('the presentation filter preserves valid endpoint journeys and does not mutate the archive input', () => {
  const journeys = [route('Home', 'Home'), route('Home', 'Airport'), route('Work', 'Work'), route('Cafe', 'Work')];
  const visible = visibleJourneys(journeys);

  assert.deepEqual(visible, [journeys[1], journeys[3]]);
  assert.equal(journeys.length, 4);
});

test('the visibility rule is applied before dashboards, lists, memories, statistics, and Atlas are built', () => {
  const appData = readFileSync(resolve(testDirectory, '../src/app-data.ts'), 'utf8');
  const primaryData = readFileSync(resolve(testDirectory, '../src/primary-sections-data.ts'), 'utf8');
  const atlas = readFileSync(resolve(testDirectory, '../src/atlas-insights.ts'), 'utf8');
  const shell = readFileSync(resolve(testDirectory, '../src/shell.tsx'), 'utf8');

  assert.match(appData, /recentJourneys = visibleJourneys/);
  assert.match(appData, /items: visibleJourneys\(applyLocalPlaceAliasesToJourneys\(page\.items\)\)/);
  assert.match(appData, /const journeys = visibleJourneys\(localPage\.items\.length/);
  assert.match(primaryData, /journeys\.filter\(journey => isVisibleJourney\(journey\) && membershipCanAccessDate/);
  assert.match(primaryData, /journeyIds: memory\.journeyIds\.filter\(id => accessibleJourneyIds\.has\(id\)\)/);
  assert.match(primaryData, /statistics: buildStatistics\(accessibleJourneys, details\)/);
  assert.match(atlas, /isInsightVisibleJourney\(journey\)/);
  assert.match(shell, /journeyIds: memory\.journeyIds\.filter\(id => visibleJourneyIds\.has\(id\)\)/);
});
