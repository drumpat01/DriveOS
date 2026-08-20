import type { DatabaseSync } from "node:sqlite";
import { queryTurso } from "./turso-client.js";

type QueryTurso = typeof queryTurso;
export type AtlasPlaceLabelInput = { placeId: string; name: string; category: string; latitude?: number; longitude?: number; radiusFeet?: number };
export type AtlasPatternReviewInput = { id: string; status: "confirmed" | "dismissed"; type?: string; customName?: string };
type PlaceLabelRow = { place_id: unknown; name: unknown; category: unknown; latitude: unknown; longitude: unknown; radius_feet: unknown; updated_at_utc: unknown };
type PatternReviewRow = { id: unknown; status: unknown; type: unknown; custom_name: unknown; updated_at_utc: unknown };

const placeColumns = ["place_id", "name", "category", "latitude", "longitude", "radius_feet", "updated_at_utc"];
const reviewColumns = ["id", "status", "type", "custom_name", "updated_at_utc"];

function localState(database: DatabaseSync) {
  return {
    labels: database.prepare(`SELECT ${placeColumns.join(",")} FROM atlas_place_labels ORDER BY place_id`).all() as PlaceLabelRow[],
    reviews: database.prepare(`SELECT ${reviewColumns.join(",")} FROM atlas_pattern_reviews ORDER BY id`).all() as PatternReviewRow[]
  };
}

function replaceLocalState(database: DatabaseSync, labels: Record<string, unknown>[], reviews: Record<string, unknown>[]) {
  database.exec("BEGIN IMMEDIATE;");
  try {
    database.exec("DELETE FROM atlas_place_labels; DELETE FROM atlas_pattern_reviews;");
    const labelInsert = database.prepare(`INSERT INTO atlas_place_labels(${placeColumns.join(",")}) VALUES(?,?,?,?,?,?,?)`);
    for (const row of labels) labelInsert.run(...placeColumns.map(column => row[column] ?? null) as any[]);
    const reviewInsert = database.prepare(`INSERT INTO atlas_pattern_reviews(${reviewColumns.join(",")}) VALUES(?,?,?,?,?)`);
    for (const row of reviews) reviewInsert.run(...reviewColumns.map(column => row[column] ?? null) as any[]);
    database.exec("COMMIT;");
  } catch (error) {
    database.exec("ROLLBACK;");
    throw error;
  }
}

export async function uploadAtlasDurableState(database: DatabaseSync, runQuery: QueryTurso = queryTurso) {
  const local = localState(database);
  const writes = [
    ...local.labels.map(row => ({
      sql: `INSERT INTO atlas_place_labels(${placeColumns.join(",")}) VALUES(?,?,?,?,?,?,?) ON CONFLICT(place_id) DO UPDATE SET name=excluded.name,category=excluded.category,latitude=excluded.latitude,longitude=excluded.longitude,radius_feet=excluded.radius_feet,updated_at_utc=excluded.updated_at_utc WHERE excluded.updated_at_utc>atlas_place_labels.updated_at_utc;`,
      args: placeColumns.map(column => row[column as keyof PlaceLabelRow])
    })),
    ...local.reviews.map(row => ({
      sql: `INSERT INTO atlas_pattern_reviews(${reviewColumns.join(",")}) VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET status=excluded.status,type=excluded.type,custom_name=excluded.custom_name,updated_at_utc=excluded.updated_at_utc WHERE excluded.updated_at_utc>atlas_pattern_reviews.updated_at_utc;`,
      args: reviewColumns.map(column => row[column as keyof PatternReviewRow])
    }))
  ];
  if (writes.length) await runQuery(writes);
  return { uploadedLabels: local.labels.length, uploadedReviews: local.reviews.length };
}

export async function syncAtlasDurableState(database: DatabaseSync, runQuery: QueryTurso = queryTurso) {
  const uploaded = await uploadAtlasDurableState(database, runQuery);
  const [labels, reviews] = await runQuery([
    { sql: `SELECT ${placeColumns.join(",")} FROM atlas_place_labels ORDER BY place_id;` },
    { sql: `SELECT ${reviewColumns.join(",")} FROM atlas_pattern_reviews ORDER BY id;` }
  ]);
  replaceLocalState(database, labels, reviews);
  return { ...uploaded, durableLabels: labels.length, durableReviews: reviews.length };
}

export async function persistAtlasPlaceLabel(input: AtlasPlaceLabelInput, updatedAtUtc: string, runQuery: QueryTurso = queryTurso) {
  await runQuery([{ sql: `INSERT INTO atlas_place_labels(${placeColumns.join(",")}) VALUES(?,?,?,?,?,?,?) ON CONFLICT(place_id) DO UPDATE SET name=excluded.name,category=excluded.category,latitude=excluded.latitude,longitude=excluded.longitude,radius_feet=excluded.radius_feet,updated_at_utc=excluded.updated_at_utc;`, args: [input.placeId, input.name, input.category, input.latitude ?? null, input.longitude ?? null, input.radiusFeet || 200, updatedAtUtc] }]);
}

export async function persistAtlasPatternReview(input: AtlasPatternReviewInput, updatedAtUtc: string, runQuery: QueryTurso = queryTurso) {
  await runQuery([{ sql: `INSERT INTO atlas_pattern_reviews(${reviewColumns.join(",")}) VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET status=excluded.status,type=excluded.type,custom_name=excluded.custom_name,updated_at_utc=excluded.updated_at_utc;`, args: [input.id, input.status, input.type || null, input.customName || null, updatedAtUtc] }]);
}

export const tursoAtlasDurableState = Object.freeze({ persistPlaceLabel: persistAtlasPlaceLabel, persistPatternReview: persistAtlasPatternReview });
