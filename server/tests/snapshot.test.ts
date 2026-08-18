import assert from "node:assert/strict";
import test from "node:test";
import { openDatabase } from "../src/database.js";
import { buildAtlasSnapshot } from "../src/snapshot-builder.js";
import { fixtureDatabase } from "./helpers.js";

test("snapshot is compact, deterministic, and suppresses unresolved labels", () => {
  const fixture = fixtureDatabase();
  try {
    const database = openDatabase(fixture.filename), first = buildAtlasSnapshot(database, "household_primary"), second = buildAtlasSnapshot(database, "household_primary"); database.close();
    assert.equal(first.bootstrap.summary.journeyCount, 2100);
    assert.equal(first.bootstrap.representativeLines.features.length, 200);
    assert.equal(first.bootstrap.patterns.length, 10);
    assert.equal(first.bootstrap.changeInsights.length, 3);
    assert.deepEqual(first.bootstrap.representativeLines, second.bootstrap.representativeLines);
    assert.deepEqual(first.bootstrap.patterns, second.bootstrap.patterns);
    const serialized = JSON.stringify(first.bootstrap);
    assert.doesNotMatch(serialized, /Imported place|Imported Timeline|startingLatitude|endingLatitude|raw_payload_json|journeyIds/i);
    assert.equal(first.bootstrap.patterns.some(item => /^home to home$/i.test(item.title)), false);
    assert.equal(first.bootstrap.patterns.map(item => item.id).length, new Set(first.bootstrap.patterns.map(item => item.id)).size);
    const semanticKeys = first.bootstrap.patterns.map(item => [item.sourceLabel, item.targetLabel].map(value => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()).sort().join("|"));
    assert.equal(semanticKeys.length, new Set(semanticKeys).size);
  } finally { fixture.cleanup(); }
});
