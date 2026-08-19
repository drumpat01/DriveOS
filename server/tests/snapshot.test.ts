import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { openDatabase } from "../src/database.js";
import { buildAtlasSnapshot } from "../src/snapshot-builder.js";
import { fixtureDatabase } from "./helpers.js";

test("snapshot is compact, deterministic, and suppresses unresolved labels", () => {
  const fixture = fixtureDatabase();
  try {
    const database = openDatabase(fixture.filename);
    const saveHome = database.prepare("INSERT INTO atlas_place_labels(place_id,name,category,latitude,longitude,radius_feet,updated_at_utc) VALUES(?,?,'home',?,?,200,?)");
    saveHome.run("fixture-home-one", "Home", 31.75, -101.4, "2026-08-17T12:00:00.000Z");
    saveHome.run("fixture-home-two", "Home", 31.92, -101.396, "2026-08-17T12:00:00.000Z");
    const first = buildAtlasSnapshot(database, "household_primary"), second = buildAtlasSnapshot(database, "household_primary"); database.close();
    assert.equal(first.bootstrap.summary.journeyCount, 2100);
    const homePlaces = first.bootstrap.places.filter(place => place.category === "home");
    assert.ok(homePlaces.length >= 2);
    assert.ok(first.bootstrap.summary.homeJourneyCount > Math.max(...homePlaces.map(place => place.visitCount)));
    assert.ok(first.bootstrap.summary.homeJourneyCount <= first.bootstrap.summary.journeyCount);
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

test("explicit Home stays canonical while reviewed Mailbox aliases remain separate", () => {
  const fixture = fixtureDatabase();
  try {
    const database = openDatabase(fixture.filename);
    const point = (index: number) => {
      const column = index % 25, row = Math.floor(index / 25);
      return { latitude: 31.75 + row * 0.17 + (column % 3) * 0.004, longitude: -101.4 + column * 0.34 + (row % 3) * 0.004 };
    };
    const hash = (kind: string, key: string) => `${kind}-${createHash("sha256").update(`${kind}:${key}`).digest("hex").slice(0, 12)}`;
    const placeId = (index: number) => { const item = point(index); return hash("place", `${item.latitude.toFixed(3)},${item.longitude.toFixed(3)}`); };
    const routineId = (first: string, second: string) => hash("routine", [first, second].sort().join("|"));
    const home = point(0), homeId = placeId(0), mailboxIds = [placeId(17), placeId(9)];
    database.prepare("INSERT INTO atlas_place_labels(place_id,name,category,latitude,longitude,radius_feet,updated_at_utc) VALUES(?,?,'home',?,?,200,?)").run(homeId, "Home", home.latitude, home.longitude, "2026-08-19T12:00:00.000Z");
    database.prepare("INSERT INTO app_state(key,value_json,updated_at) VALUES('foursquare-cache',?,?) ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json,updated_at=excluded.updated_at").run(JSON.stringify({ entries: [{ name: "Nearby business", category: "store", latitude: home.latitude, longitude: home.longitude, radiusMiles: 0.16 }] }), "2026-08-19T12:00:00.000Z");
    const preferences = { version: 2, routines: mailboxIds.map(id => ({ routineId: routineId(homeId, id), status: "confirmed", type: "custom", customName: "Home to Mailbox" })), places: [], placeGeofences: [] };
    database.prepare("INSERT INTO app_state(key,value_json,updated_at) VALUES('mobility-preferences',?,?) ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json,updated_at=excluded.updated_at").run(JSON.stringify(preferences), "2026-08-19T12:00:00.000Z");
    const result = buildAtlasSnapshot(database, "household_primary"); database.close();
    const homes = result.bootstrap.places.filter(place => place.category === "home"), mailboxes = result.bootstrap.places.filter(place => place.label === "Mailbox");
    assert.equal(homes.length, 1);
    assert.equal(mailboxes.length, 1);
    assert.equal(mailboxes[0].id, hash("place", `mailbox:${homeId}`));
    assert.notEqual(homes[0].id, mailboxes[0].id);
    assert.equal(result.bootstrap.summary.homeJourneyCount, homes[0].visitCount);
    assert.ok(mailboxes[0].visitCount > 0);
    assert.ok(result.candidates.some(item => /^Home to Mailbox$|^Mailbox to Home$/.test(item.title)));
    assert.equal(result.candidates.some(item => /^Home to Home$/i.test(item.title)), false);
  } finally { fixture.cleanup(); }
});
