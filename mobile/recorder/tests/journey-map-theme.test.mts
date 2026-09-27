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
  assert.deepEqual(journeyDeckMapPalette('midnight-canopy'), { routeGlow: '#e88937', routeShadow: '#493025', routeLine: '#f4b864' });
  assert.equal(autumn?.layers[2]?.paint?.['fill-outline-color'], '#789a92');
  assert.equal(autumn?.layers[3]?.paint?.['line-color'], '#e2ad68');
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

test('Aurora Glass map: midnight land, teal water, slate roads, and a mint route that is the only mint', async () => {
  const input = { version: 8, sources: { open: { type: 'vector' } }, layers: [
    { id: 'background', type: 'background' }, { id: 'park', type: 'fill' }, { id: 'water', type: 'fill' },
    { id: 'road-motorway', type: 'line' }, { id: 'road-minor', type: 'line' }, { id: 'place-label', type: 'symbol' },
  ] };
  const fetcher = (async () => ({ ok: true, json: async () => input })) as unknown as typeof fetch;
  const aurora = await loadJourneyDeckMapStyle(fetcher, 'aurora-glass');
  assert.notEqual(aurora, await loadJourneyDeckMapStyle(fetcher, 'redline'), 'Aurora has its own cached style');
  const paint = (i: number) => aurora?.layers[i]?.paint ?? {};
  assert.equal(paint(0)['background-color'], '#0a1124');
  assert.equal(paint(1)['fill-color'], '#0c2330');
  assert.equal(paint(2)['fill-color'], '#05202c');
  assert.equal(paint(3)['line-color'], '#34466b');
  assert.equal(paint(4)['line-color'], '#26365a');
  assert.equal(paint(5)['text-color'], '#9fb2d4');
  assert.equal(aurora?.sources, input.sources);
  const mint = themeCatalog['aurora-glass'].palette.accent;
  assert.deepEqual(journeyDeckMapPalette('aurora-glass'), { routeGlow: mint, routeShadow: '#032018', routeLine: mint });
  assert.ok(!JSON.stringify(aurora?.layers).toLowerCase().includes(mint), 'basemap never uses the route mint');
});
