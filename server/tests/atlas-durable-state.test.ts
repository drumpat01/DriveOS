import assert from "node:assert/strict";
import test from "node:test";
import { AtlasStore } from "../src/atlas-store.js";
import { openDatabase } from "../src/database.js";
import { persistAtlasPatternReview, persistAtlasPlaceLabel, syncAtlasDurableState } from "../src/atlas-durable-state.js";
import { fixtureDatabase, root } from "./helpers.js";

test("Atlas durable state uploads disk records and replaces the cache from Turso", async () => {
  const fixture = fixtureDatabase(), database = openDatabase(fixture.filename);
  try {
    database.prepare("INSERT INTO atlas_place_labels(place_id,name,category,latitude,longitude,radius_feet,updated_at_utc) VALUES(?,?,?,?,?,?,?)").run("place-local", "Local", "other", 1, 2, 200, "2026-08-18T00:00:00.000Z");
    database.prepare("INSERT INTO atlas_pattern_reviews(id,status,type,custom_name,updated_at_utc) VALUES(?,?,?,?,?)").run("pattern-local", "dismissed", null, null, "2026-08-18T00:00:00.000Z");
    const calls: Array<Array<{ sql: string; args?: unknown[] }>> = [];
    const query = async (statements: Array<{ sql: string; args?: unknown[] }>) => {
      calls.push(statements);
      if (calls.length === 1) return statements.map(() => []);
      return [
        [{ place_id: "place-durable", name: "Durable", category: "home", latitude: "3", longitude: "4", radius_feet: "250", updated_at_utc: "2026-08-19T00:00:00.000Z" }],
        [{ id: "pattern-durable", status: "confirmed", type: "commute", custom_name: "Morning", updated_at_utc: "2026-08-19T00:00:00.000Z" }]
      ];
    };
    const result = await syncAtlasDurableState(database, query);
    assert.deepEqual(result, { uploadedLabels: 1, uploadedReviews: 1, durableLabels: 1, durableReviews: 1 });
    assert.equal(calls[0].length, 2);
    assert.match(calls[0][0].sql, /ON CONFLICT\(place_id\).*updated_at_utc>atlas_place_labels\.updated_at_utc/);
    assert.match(calls[0][1].sql, /ON CONFLICT\(id\).*updated_at_utc>atlas_pattern_reviews\.updated_at_utc/);
    assert.deepEqual([...database.prepare("SELECT place_id,name FROM atlas_place_labels").all()].map(row => ({ ...row })), [{ place_id: "place-durable", name: "Durable" }]);
    assert.deepEqual([...database.prepare("SELECT id,status FROM atlas_pattern_reviews").all()].map(row => ({ ...row })), [{ id: "pattern-durable", status: "confirmed" }]);
  } finally {
    database.close(); fixture.cleanup();
  }
});

test("Atlas writes are sent to Turso before the local cache is mutated", async () => {
  const statements: Array<{ sql: string; args?: unknown[] }> = [];
  const query = async (batch: Array<{ sql: string; args?: unknown[] }>) => { statements.push(...batch); return batch.map(() => []); };
  await persistAtlasPlaceLabel({ placeId: "place-1", name: "Home", category: "home", latitude: 1, longitude: 2, radiusFeet: 200 }, "2026-08-19T00:00:00.000Z", query);
  await persistAtlasPatternReview({ id: "pattern-1", status: "confirmed", type: "commute", customName: "Morning" }, "2026-08-19T00:00:01.000Z", query);
  assert.match(statements[0].sql, /INSERT INTO atlas_place_labels/);
  assert.deepEqual(statements[0].args?.slice(0, 3), ["place-1", "Home", "home"]);
  assert.match(statements[1].sql, /INSERT INTO atlas_pattern_reviews/);
  assert.deepEqual(statements[1].args?.slice(0, 4), ["pattern-1", "confirmed", "commute", "Morning"]);

  const fixture = fixtureDatabase(), database = openDatabase(fixture.filename);
  const store = new AtlasStore(database, "household_primary", fixture.filename, root, {
    persistPlaceLabel: async () => { throw new Error("Turso unavailable"); },
    persistPatternReview: async () => { throw new Error("Turso unavailable"); }
  });
  try {
    await assert.rejects(store.savePlace({ placeId: "place-new", name: "Never local", category: "other" }), /Turso unavailable/);
    assert.equal(database.prepare("SELECT COUNT(*) AS count FROM atlas_place_labels WHERE place_id='place-new'").get()!.count, 0);
  } finally {
    store.close(); database.close(); fixture.cleanup();
  }
});
