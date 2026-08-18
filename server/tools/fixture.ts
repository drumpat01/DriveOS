import type { DatabaseSync } from "node:sqlite";

const HOUSEHOLD_ID = "household_primary";
const VEHICLE_ID = "vehicle_fixture";

function place(index: number) {
  const column = index % 25;
  const row = Math.floor(index / 25);
  return {
    latitude: 31.75 + row * 0.17 + (column % 3) * 0.004,
    longitude: -101.4 + column * 0.34 + (row % 3) * 0.004,
    label: index === 0 ? "Home" : index === 1 ? "Walmart - Saginaw" : `Resolved place ${String(index).padStart(3, "0")}`
  };
}

export function seedRealisticAtlasFixture(database: DatabaseSync, journeyCount = 2100) {
  const now = "2026-08-17T12:00:00.000Z";
  database.prepare("INSERT OR IGNORE INTO households(id,display_name,created_at_utc,updated_at_utc) VALUES(?,?,?,?)").run(HOUSEHOLD_ID, "JourneyDeck development", now, now);
  database.prepare(`INSERT OR IGNORE INTO vehicles(id,household_id,provider,provider_vehicle_id,display_name,observed_at_utc,raw_payload_json,created_at_utc,updated_at_utc)
    VALUES(?,?,?,?,?,?,?,?,?)`).run(VEHICLE_ID, HOUSEHOLD_ID, "fixture", "eloise-fixture", "Eloise", now, "{}", now, now);
  const insert = database.prepare(`INSERT INTO drives(id,household_id,vehicle_id,provider,provider_drive_id,legacy_drive_id,started_at_utc,ended_at_utc,started_at_epoch,ended_at_epoch,starting_location,ending_location,starting_latitude,starting_longitude,ending_latitude,ending_longitude,distance_miles,driver_profile,raw_payload_json,created_at_utc,updated_at_utc)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  database.exec("BEGIN IMMEDIATE;");
  try {
    for (let index = 0; index < journeyCount; index++) {
      const sourceIndex = index % 350;
      const targetIndex = (sourceIndex * 37 + 17) % 350;
      const source = place(sourceIndex), target = place(targetIndex);
      const started = new Date(Date.UTC(2025, 0, 1) + index * 4 * 60 * 60 * 1000);
      const ended = new Date(started.getTime() + 35 * 60 * 1000);
      const id = `fixture-journey-${String(index).padStart(4, "0")}`;
      const raw = JSON.stringify({ starting_location: source.label, ending_location: target.label, fixture: true });
      insert.run(id, HOUSEHOLD_ID, VEHICLE_ID, "fixture", id, id, started.toISOString(), ended.toISOString(), Math.floor(started.getTime() / 1000), Math.floor(ended.getTime() / 1000), source.label, target.label, source.latitude, source.longitude, target.latitude, target.longitude, 3 + ((index * 13) % 170), "Synthetic Atlas benchmark", raw, now, now);
    }
    database.exec("COMMIT;");
  } catch (error) { database.exec("ROLLBACK;"); throw error; }
  return { journeyCount, rawVisitCount: journeyCount * 2, placeCount: 350 };
}
