import assert from 'node:assert/strict';
import test from 'node:test';

import { databaseSchemaDiagnostic } from '../src/database-schema-diagnostic.ts';

test('startup identifies the main archive version without reading or changing data', () => {
  assert.deepEqual(databaseSchemaDiagnostic(new Error('JourneyDeck local archive schema 12 is newer than this app supports.')),
    { source: 'archive', found: 12, supported: 11 });
});

test('startup distinguishes an old recorder file and excludes unrelated errors', () => {
  assert.deepEqual(databaseSchemaDiagnostic(new Error('The legacy recorder schema 4 is newer than this app supports.')),
    { source: 'legacy_recorder', found: 4, supported: 2 });
  assert.equal(databaseSchemaDiagnostic(new Error('database is locked')), null);
});
