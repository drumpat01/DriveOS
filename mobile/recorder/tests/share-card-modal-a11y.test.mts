import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../src/share-card-modal.tsx', import.meta.url), 'utf8');
const modal = source.slice(source.indexOf('export function ShareCardModal'), source.indexOf('const SummaryShareCard'));
const sheets = [...modal.matchAll(/<Modal\b[\s\S]*?<\/Modal>/g)].map(match => match[0]);

test('V4 and legacy share-card sheets trap VoiceOver and keep dismiss reachable', () => {
  assert.equal(sheets.length, 2, 'ShareCardModal still has V4 and legacy modal trees');
  for (const sheet of sheets) {
    assert.match(sheet, /<SafeAreaView [^>]*accessibilityViewIsModal/);
    assert.match(sheet, /accessibilityRole="button" accessibilityLabel="Close share card"/);
    assert.match(sheet, /accessibilityRole="button" accessibilityLabel="Close"/);
    assert.match(sheet, /accessibilityRole="button" accessibilityLabel="Share image"/);
    assert.doesNotMatch(sheet, /presentationStyle=/);
  }
});
