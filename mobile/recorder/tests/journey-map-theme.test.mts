import assert from 'node:assert/strict';
import test from 'node:test';
import { themeJourneyDeckMapStyle, journeyDeckMapPalette, loadJourneyDeckMapStyle } from '../src/journey-map-theme.ts';
import { themeCatalog } from '../src/theme-catalog.ts';

test('Autumn map has its own cached style and theme-colored route without modifying source geometry', async () => {
  const input = { version: 8, sources: { open: { type: 'vector' } }, layers: [
    { id: 'background', type: 'background' }, { id: 'park', type: 'fill' },
    { id: 'water', type: 'fill' }, { id: 'road-primary', type: 'line', filter: ['==', 'class', 'primary'] },
    { id: 'place-label', type: 'symbol' },
  ] };
  const fetcher = (async () => ({ ok: true, json: async () => input })) as unknown as typeof fetch;
  const dark = await loadJourneyDeckMapStyle(fetcher, 'dark');
  const autumn = await loadJourneyDeckMapStyle(fetcher, 'midnight-canopy');
  const p = themeCatalog['midnight-canopy'].palette;
  assert.notEqual(autumn, dark);
  assert.equal(autumn?.layers[0]?.paint?.['background-color'], p.page);
  assert.equal(autumn?.layers[1]?.paint?.['fill-color'], p.card);
  assert.notEqual(autumn?.layers[2]?.paint?.['fill-color'], p.page);
  assert.equal(autumn?.layers[3]?.filter, input.layers[3]?.filter);
  assert.equal(autumn?.sources, input.sources);
  assert.equal(autumn?.layers[4]?.paint?.['text-color'], p.text);
  assert.deepEqual(journeyDeckMapPalette('midnight-canopy'), { routeGlow: '#ff7600', routeShadow: '#590000', routeLine: '#fff200' });
  assert.equal(autumn?.layers[2]?.paint?.['fill-outline-color'], '#00f0d0');
  assert.equal(autumn?.layers[3]?.paint?.['line-color'], '#ffd000');
  assert.equal(await loadJourneyDeckMapStyle(fetcher, 'dark'), dark);
});

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
