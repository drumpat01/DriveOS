import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('Memories leads with personal stories and reveals organization controls progressively', () => {
  const source = read('../src/ipad-memories-screen.tsx');
  assert.match(source, /\[trayExpanded, setTrayExpanded\] = useState\(false\)/);
  assert.match(source, /\{dragged \? <View[^>]*><DropZone id="new">/);
  assert.match(source, /accessibilityLabel=\{`Open journey/);
  assert.match(source, /accessibilityRole="checkbox"/);
  assert.ok(source.indexOf('iphone-memory-grid') < source.indexOf('phoneCollectionSection'), 'Memories appear before optional collections');
});

test('Journey detail keeps actions in the header and previews the soundtrack', () => {
  const source = read('../src/shell.tsx');
  assert.match(source, /label="Journey actions"/);
  assert.match(source, /journey\.soundtrack\.slice\(0, 5\)/);
  assert.match(source, /View all \$\{journey\.soundtrack\.length\}/);
  assert.match(source, /journeyScrollRef\.current\?\.scrollTo/);
  assert.doesNotMatch(source.slice(source.indexOf('function JourneyDetailScreen'), source.indexOf('type SettingsDestination')), /styles\.journeyActions/);
});

test('Memory edit uses a persistent Save footer and checkmark membership rows', () => {
  const shell = read('../src/shell.tsx');
  const editor = read('../src/memory-edit-motion.tsx');
  assert.match(shell, /footer=\{memoryDraft \? <View style=\{styles\.editorActions\}>/);
  assert.match(shell, /title=\{memoryDraft\?\.id \? 'Edit Memory' : 'Create a Memory'\}/);
  assert.doesNotMatch(shell, /Shape this chapter/);
  assert.match(editor, /AVAILABLE JOURNEYS/);
  assert.match(editor, /name="checkmark"/);
  assert.doesNotMatch(editor, /included \? '−' : '\+'/);
});

