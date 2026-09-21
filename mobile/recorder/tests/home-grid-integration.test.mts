import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../src/', import.meta.url);
const shell = await readFile(new URL('shell.tsx', root), 'utf8');
const ipadHome = await readFile(new URL('ipad-home.tsx', root), 'utf8');
const sharedGrid = await readFile(new URL('home-widget-grid.tsx', root), 'utf8');

test('compact and regular Home persist through the same widget-layout store, with iPad keeping the full twelve-column editor', () => {
  assert.match(shell, /useHomeWidgetLayout\('compact', Boolean\(onFiftyStates\), V3_ASK_JOURNEYDECK_ENABLED\)/);
  assert.match(ipadHome, /useHomeWidgetLayout\(layoutClass, Boolean\(onFiftyStates\), V3_ASK_JOURNEYDECK_ENABLED\)/);
  assert.match(shell, /testID="compact-home-widget-grid"/);
  assert.match(ipadHome, /placement\.span \/ 12/, 'iPad Home still renders a real free-form grid, so span still matters there');
  assert.doesNotMatch(shell, /placement\.span \/ 12/, 'phone Home no longer has a resizable grid to size');
  assert.match(sharedGrid, /HomeLayoutEditorSheet/);
  assert.match(sharedGrid, /<NativeSheet/);
  assert.match(sharedGrid, /Restore default Home layout/);
});

test('phone Home replaces the twelve-column editor with a curated customize sheet', () => {
  assert.match(shell, /const renderCustomizeSheet = \(\) => \{/);
  assert.doesNotMatch(shell, /HomeGridCell|compactHomeMetric|compactHomeGrid|compactHomeJourneySummary/, 'the old free-grid tiles and cell component are gone from phone Home');
  assert.match(shell, /LATEST MEMORY/);
  assert.match(shell, /FEATURED WIDGET/);
  assert.match(shell, /ROAD SUMMARY/);
  assert.match(shell, /gridLayout\.selectContext\(choice\.id\)/);
  assert.match(shell, /gridLayout\.moveSummary\(item\.id, -1\)/);
  assert.match(shell, /gridLayout\.moveSummary\(item\.id, 1\)/);
  assert.match(shell, /gridLayout\.toggle\('memories'\)/);
});

test('recorder and UIKit navigation remain outside the customizable grid', () => {
  const recorder = shell.indexOf('{recorder}', shell.indexOf('function HomeScreen'));
  const grid = shell.indexOf('testID="compact-home-widget-grid"', recorder);
  assert.ok(recorder > 0 && grid > recorder);
  assert.doesNotMatch(sharedGrid, /NativeTabs|sidebarAdaptable|NativeNavigation/);
});

test('both Home layouts route their V3 question widget to the same native prompt', () => {
  assert.match(ipadHome, /placement.id === 'askJourneyDeck' && V3_ASK_JOURNEYDECK_ENABLED/);
  assert.match(ipadHome, /<AskJourneyDeckWidget onPress=\{\(\) => router.push\('\/ask-journeydeck'\)\}[^>]*disabled/);
  assert.match(shell, /: presentation\.context\?\.id === 'askJourneyDeck'\s*\n\s*\? <AskJourneyDeckWidget onPress=\{\(\) => router\.push\('\/ask-journeydeck'\)\} onLongPress=\{openEditor\} \/>/);
  assert.match(shell, /V3_ASK_JOURNEYDECK_ENABLED \? \{ id: 'askJourneyDeck', label: 'Ask JourneyDeck', icon: 'sparkles' \} : null/);
});

test('drag commits only after successful completion and exposes equivalent VoiceOver actions', () => {
  assert.match(sharedGrid, /Gesture\.Pan\(\)/);
  assert.match(sharedGrid, /\.onEnd\(\(event, success\) => \{ if \(success\)/);
  assert.match(sharedGrid, /\.onFinalize\(\(\) =>/);
  assert.equal(sharedGrid.match(/scheduleOnRN\(commitMove/g)?.length, 1);
  for (const label of ['Move earlier', 'Move later', 'Resize', 'Show', 'Hide']) assert.match(sharedGrid, new RegExp(label));
  assert.match(sharedGrid, /ReduceMotion\.System/);
});

test('hidden widgets remain mounted so their local state survives hide and show', () => {
  assert.match(sharedGrid, /placement\.hidden && !editing && styles\.hidden/);
  assert.match(sharedGrid, /hidden: \{ display: 'none' \}/);
  assert.doesNotMatch(sharedGrid, /if \(placement\.hidden/);
});

test('Home keeps the recorder fixed and moves customization into a native editor sheet', () => {
  assert.doesNotMatch(sharedGrid, /12-column adaptive Home grid/);
  for (const source of [shell, ipadHome]) {
    assert.match(source, /testID="home-fixed-recorder"[^>]*>\{recorder\}<\/View>/);
    assert.match(source, /<HomeLayoutEditorSheet/);
    assert.doesNotMatch(source, /<HomeLayoutToolbar/);
  }
  assert.ok(shell.indexOf('styles.approvedHomeScenicSpace, recorderActive') < shell.indexOf('testID="home-fixed-recorder"'));
  assert.match(sharedGrid, /styles.resizeGrip, \{ \[edge\]: 0/);
});

test('phone Home renders action, latest memory, one context, then a consolidated road summary', () => {
  const home = shell.slice(shell.indexOf('function HomeScreen'), shell.indexOf('function PreviousCinematicHomeScreen'));
  assert.ok(home.indexOf('testID="home-fixed-recorder"') < home.indexOf('presentation.memory'));
  assert.ok(home.indexOf('presentation.memory') < home.indexOf('{contextualWidget}'));
  assert.ok(home.indexOf('{contextualWidget}') < home.indexOf('testID="home-road-summary"'));
  assert.match(home, /selectHomePresentation\(gridLayout\.placements\)/);
});
