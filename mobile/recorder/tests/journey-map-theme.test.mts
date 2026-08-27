import assert from 'node:assert/strict';
import test from 'node:test';
import { themeJourneyDeckMapStyle } from '../src/journey-map-theme.ts';

test('JourneyDeck map theming transforms basemap layers without changing sources', () => {
  const source = {
    version: 8,
    sources: { open: { type: 'vector', url: 'https://example.test/style' } },
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': '#fff' } },
      { id: 'water', type: 'fill', source: 'open', paint: { 'fill-color': '#00f' } },
      { id: 'motorway', type: 'line', source: 'open', paint: { 'line-color': '#fff' } },
      { id: 'place-label', type: 'symbol', source: 'open', paint: { 'text-color': '#000' } },
    ],
  };
  const themed = themeJourneyDeckMapStyle(source);
  assert.equal(themed?.sources, source.sources);
  assert.equal(themed?.layers[0]?.paint?.['background-color'], '#010104');
  assert.equal(themed?.layers[1]?.paint?.['fill-color'], '#05091a');
  assert.equal(themed?.layers[2]?.paint?.['line-color'], '#3a1737');
  assert.equal(themed?.layers[3]?.paint?.['text-color'], '#d3c5d8');
});

test('JourneyDeck map theming rejects malformed styles', () => {
  assert.equal(themeJourneyDeckMapStyle(null), null);
  assert.equal(themeJourneyDeckMapStyle({ version: 7, layers: [] }), null);
  assert.equal(themeJourneyDeckMapStyle({ version: 8 }), null);
});
