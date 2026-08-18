import { createHash } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import type { AtlasBootstrap, AtlasJourney, AtlasPattern, AtlasPlace } from "./types.js";

const SCHEMA_VERSION = 1;
const PLACE_RADIUS_MILES = 0.2;
const CELL_SIZE = 0.004;
const coordinateLabel = /^(?:(?:imported|unknown) place\s*)?-?\d{1,3}(?:\.\d+)?\s*[, ]\s*-?\d{1,3}(?:\.\d+)?$/i;
const importedLabel = /^(?:google timeline location|imported timeline locations?|imported place)/i;

function hash(kind: string, key: string) {
  return `${kind}-${createHash("sha256").update(`${kind}:${key}`).digest("hex").slice(0, 12)}`;
}

function radians(value: number) { return value * Math.PI / 180; }
function distanceMiles(a: [number, number], b: [number, number]) {
  const lat1 = radians(a[1]), lat2 = radians(b[1]);
  const dlat = lat2 - lat1, dlon = radians(b[0] - a[0]);
  const value = Math.sin(dlat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dlon / 2) ** 2;
  return 3958.8 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(Math.max(0, 1 - value)));
}

function validCoordinate(latitude: number, longitude: number) {
  return Number.isFinite(latitude) && Number.isFinite(longitude) && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180;
}

type Enrichment = { name: string; address: string; category: string; latitude: number; longitude: number; radiusMiles: number };
type MutablePlace = AtlasPlace & { journeyIds: Set<string> };
type Edge = { source: string; target: string; driveCount: number; totalMiles: number; firstSeenAt: string; lastSeenAt: string };

function safeJson<T>(value: unknown, fallback: T): T {
  try { return value ? JSON.parse(String(value)) as T : fallback; } catch { return fallback; }
}

function loadJourneys(database: DatabaseSync, householdId: string): AtlasJourney[] {
  const rows = database.prepare(`SELECT id,started_at_utc,starting_location,ending_location,starting_latitude,starting_longitude,ending_latitude,ending_longitude,distance_miles,raw_payload_json
    FROM drives WHERE household_id=? AND starting_latitude IS NOT NULL AND starting_longitude IS NOT NULL AND ending_latitude IS NOT NULL AND ending_longitude IS NOT NULL ORDER BY started_at_epoch,id`).all(householdId) as any[];
  return rows.map(row => {
    const raw = safeJson<Record<string, any>>(row.raw_payload_json, {});
    return {
      id: String(row.id), startedAt: String(row.started_at_utc || raw.started_at || ""),
      startingLocation: String(row.starting_location || raw.starting_location || ""), rawStartingLocation: String(raw.rawStartingLocation || raw.starting_location || row.starting_location || ""),
      startingLatitude: Number(row.starting_latitude), startingLongitude: Number(row.starting_longitude),
      endingLocation: String(row.ending_location || raw.ending_location || ""), rawEndingLocation: String(raw.rawEndingLocation || raw.ending_location || row.ending_location || ""),
      endingLatitude: Number(row.ending_latitude), endingLongitude: Number(row.ending_longitude), miles: Number(row.distance_miles) || 0
    };
  });
}

function loadEnrichments(database: DatabaseSync): Enrichment[] {
  const stateRows = database.prepare("SELECT key,value_json FROM app_state WHERE key IN ('foursquare-cache','mobility-preferences')").all() as any[];
  const byKey = new Map(stateRows.map(row => [String(row.key), safeJson<any>(row.value_json, null)]));
  const cache = byKey.get("foursquare-cache");
  const cacheItems = Array.isArray(cache) ? cache : Array.isArray(cache?.entries) ? cache.entries : [];
  const preferences = byKey.get("mobility-preferences") || {};
  const fences = Array.isArray(preferences.placeGeofences) ? preferences.placeGeofences : [];
  const labels = database.prepare("SELECT name,category,latitude,longitude,radius_feet FROM atlas_place_labels WHERE latitude IS NOT NULL AND longitude IS NOT NULL").all() as any[];
  const result: Enrichment[] = [];
  for (const item of [...cacheItems, ...fences, ...labels]) {
    const latitude = Number(item.latitude), longitude = Number(item.longitude);
    const name = String(item.name || item.businessName || item.label || "").trim();
    if (!name || !validCoordinate(latitude, longitude)) continue;
    result.push({ name, address: String(item.address || item.businessAddress || name), category: String(item.category || "other").toLowerCase(), latitude, longitude, radiusMiles: Number(item.radiusMiles) || Number(item.radiusFeet ?? item.radius_feet) / 5280 || 0.16 });
  }
  return result.sort((a, b) => (a.category === "home" ? -1 : 0) - (b.category === "home" ? -1 : 0) || a.name.localeCompare(b.name));
}

function resolveEnrichment(items: Enrichment[], latitude: number, longitude: number) {
  let closest: Enrichment | undefined, closestMiles = Infinity;
  for (const item of items) {
    const miles = distanceMiles([longitude, latitude], [item.longitude, item.latitude]);
    if (miles <= item.radiusMiles && miles < closestMiles) { closest = item; closestMiles = miles; }
  }
  return closest;
}

function cleanLabel(label: string, address: string, enrichment?: Enrichment) {
  if (enrichment) return { label: enrichment.name, address: enrichment.address, category: enrichment.category };
  const first = String(label || "").trim(), second = String(address || "").trim();
  const usable = [first, second].find(value => value && !coordinateLabel.test(value) && !importedLabel.test(value));
  return usable ? { label: usable, address: usable, category: "other" } : null;
}

function representativeLines(journeys: Array<{ journey: AtlasJourney; source: MutablePlace; target: MutablePlace }>, limit = 200): AtlasBootstrap["representativeLines"] {
  const corridors = new Map<string, { start: [number, number]; end: [number, number]; miles: number; spatial: string }>();
  for (const item of journeys) {
    if (item.source.id === item.target.id) continue;
    const start: [number, number] = [item.source.longitude, item.source.latitude], end: [number, number] = [item.target.longitude, item.target.latitude];
    const miles = distanceMiles(start, end); if (miles < 0.08) continue;
    const endpoint = (point: [number, number]) => `${point[0].toFixed(3)},${point[1].toFixed(3)}`;
    const key = [endpoint(start), endpoint(end)].sort().join("|");
    const midpoint: [number, number] = [(start[0] + end[0]) / 2, (start[1] + end[1]) / 2];
    const candidate = { start, end, miles, spatial: `${Math.floor(midpoint[0] / 0.08)}:${Math.floor(midpoint[1] / 0.08)}` };
    const prior = corridors.get(key); if (!prior || candidate.miles > prior.miles) corridors.set(key, candidate);
  }
  const ranked = [...corridors.values()].sort((a, b) => b.miles - a.miles || a.spatial.localeCompare(b.spatial));
  const selected: typeof ranked = [], used = new Set<string>();
  for (const item of ranked) if (!used.has(item.spatial) && selected.push(item) && used.add(item.spatial) && selected.length >= limit) break;
  if (selected.length < limit) for (const item of ranked) { if (selected.includes(item)) continue; selected.push(item); if (selected.length >= limit) break; }
  return { type: "FeatureCollection", features: selected.map((item, index) => ({ type: "Feature", properties: { distanceMiles: item.miles, palette: index % 3 }, geometry: { type: "LineString", coordinates: [item.start, item.end] } })) };
}

function timeBand(value: string) {
  const hour = new Date(value).getHours();
  return hour >= 5 && hour < 12 ? "morning" : hour >= 12 && hour < 17 ? "afternoon" : hour >= 17 && hour < 22 ? "evening" : "late night";
}

export function buildAtlasSnapshot(database: DatabaseSync, householdId: string): { bootstrap: AtlasBootstrap; details: Map<string, unknown>; candidates: AtlasPattern[] } {
  const journeys = loadJourneys(database, householdId), enrichments = loadEnrichments(database);
  const places: MutablePlace[] = [], buckets = new Map<string, MutablePlace[]>(), edges = new Map<string, Edge>();
  const mapped: Array<{ journey: AtlasJourney; source: MutablePlace; target: MutablePlace }> = [];
  const bucketKey = (lat: number, lon: number) => `${Math.floor(lat / CELL_SIZE)}:${Math.floor(lon / CELL_SIZE)}`;
  const placeFor = (journey: AtlasJourney, side: "start" | "end") => {
    const latitude = side === "start" ? journey.startingLatitude : journey.endingLatitude, longitude = side === "start" ? journey.startingLongitude : journey.endingLongitude;
    const rawLabel = side === "start" ? journey.startingLocation : journey.endingLocation, rawAddress = side === "start" ? journey.rawStartingLocation : journey.rawEndingLocation;
    const enrichment = resolveEnrichment(enrichments, latitude, longitude), identity = cleanLabel(rawLabel, rawAddress || rawLabel, enrichment);
    if (!identity) return null;
    const latCell = Math.floor(latitude / CELL_SIZE), lonCell = Math.floor(longitude / CELL_SIZE), nearby: MutablePlace[] = [];
    for (let y = -1; y <= 1; y++) for (let x = -1; x <= 1; x++) nearby.push(...(buckets.get(`${latCell + y}:${lonCell + x}`) || []));
    let place = nearby.find(item => distanceMiles([longitude, latitude], [item.longitude, item.latitude]) <= PLACE_RADIUS_MILES);
    if (!place) {
      place = { id: hash("place", `${latitude.toFixed(3)},${longitude.toFixed(3)}`), label: identity.label, address: identity.address, category: identity.category, latitude, longitude, visitCount: 0, arrivals: 0, departures: 0, firstSeenAt: journey.startedAt, lastSeenAt: journey.startedAt, journeyIds: new Set() };
      places.push(place); const key = bucketKey(latitude, longitude); buckets.set(key, [...(buckets.get(key) || []), place]);
    } else if (enrichment && (place.category !== "home" || enrichment.category === "home")) { place.label = identity.label; place.address = identity.address; place.category = identity.category; }
    place.journeyIds.add(journey.id); place.visitCount = place.journeyIds.size; place.firstSeenAt = place.firstSeenAt < journey.startedAt ? place.firstSeenAt : journey.startedAt; place.lastSeenAt = place.lastSeenAt > journey.startedAt ? place.lastSeenAt : journey.startedAt;
    if (side === "start") place.departures++; else place.arrivals++;
    return place;
  };
  for (const journey of journeys) {
    if (!validCoordinate(journey.startingLatitude, journey.startingLongitude) || !validCoordinate(journey.endingLatitude, journey.endingLongitude)) continue;
    const source = placeFor(journey, "start"), target = placeFor(journey, "end"); if (!source || !target || (source.category === "home" && target.category === "home")) continue;
    mapped.push({ journey, source, target }); const key = `${source.id}>${target.id}`;
    const edge = edges.get(key) || { source: source.id, target: target.id, driveCount: 0, totalMiles: 0, firstSeenAt: journey.startedAt, lastSeenAt: journey.startedAt };
    edge.driveCount++; edge.totalMiles += journey.miles; edge.firstSeenAt = edge.firstSeenAt < journey.startedAt ? edge.firstSeenAt : journey.startedAt; edge.lastSeenAt = edge.lastSeenAt > journey.startedAt ? edge.lastSeenAt : journey.startedAt; edges.set(key, edge);
  }
  const groups = new Map<string, typeof mapped>();
  for (const item of mapped) { const key = [item.source.id, item.target.id].sort().join("|"); groups.set(key, [...(groups.get(key) || []), item]); }
  const rawCandidates: AtlasPattern[] = [];
  for (const group of groups.values()) {
    if (group.length < 3) continue; const first = group[0], source = first.source, target = first.target;
    if (source.category === "home" && target.category === "home") continue;
    const bands = new Map<string, number>(); for (const item of group) bands.set(timeBand(item.journey.startedAt), (bands.get(timeBand(item.journey.startedAt)) || 0) + 1);
    const typical = [...bands].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] || "varied times";
    const id = hash("routine", [source.id, target.id].sort().join("|"));
    rawCandidates.push({ id, title: `${source.label} to ${target.label}`, narrative: `${group.length} journeys, usually in the ${typical}.`, source: source.id, target: target.id, sourceLabel: source.label, targetLabel: target.label, sourceAddress: source.address, targetAddress: target.address, sourceLatitude: source.latitude, sourceLongitude: source.longitude, targetLatitude: target.latitude, targetLongitude: target.longitude, driveCount: group.length, type: "frequent-route", inferredType: "frequent-route", confidenceLabel: group.length >= 5 ? "high" : "medium", confirmationStatus: "suggested" });
  }
  const identity = (label: string, address: string) => `${label}|${address}`.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const uniqueCandidates = new Map<string, AtlasPattern>();
  for (const item of rawCandidates) {
    const key = [identity(item.sourceLabel, item.sourceAddress), identity(item.targetLabel, item.targetAddress)].sort().join("|");
    const existing = uniqueCandidates.get(key);
    if (!existing) { uniqueCandidates.set(key, { ...item, id: hash("routine", key) }); continue; }
    existing.driveCount += item.driveCount;
    existing.confidenceLabel = existing.driveCount >= 5 ? "high" : "medium";
    existing.narrative = `${existing.driveCount} journeys support this recurring connection.`;
  }
  const candidates = [...uniqueCandidates.values()];
  candidates.sort((a, b) => b.driveCount - a.driveCount || a.title.localeCompare(b.title) || a.id.localeCompare(b.id));
  const reviewed = new Set((database.prepare("SELECT id FROM atlas_pattern_reviews").all() as Array<{ id: string }>).map(row => row.id));
  const patterns = candidates.filter(item => !reviewed.has(item.id)).slice(0, 10);
  const visiblePlaces = places.filter(place => !coordinateLabel.test(place.label) && !importedLabel.test(place.label)).sort((a, b) => b.visitCount - a.visitCount || a.label.localeCompare(b.label));
  const visibleIds = new Set(visiblePlaces.map(place => place.id)), visibleMapped = mapped.filter(item => visibleIds.has(item.source.id) && visibleIds.has(item.target.id));
  const details = new Map<string, unknown>();
  for (const place of visiblePlaces) {
    const connections = [...edges.values()].filter(edge => edge.source === place.id || edge.target === place.id).map(edge => ({ ...edge, otherPlaceId: edge.source === place.id ? edge.target : edge.source })).sort((a, b) => b.driveCount - a.driveCount).slice(0, 10);
    details.set(place.id, { ...place, journeyIds: undefined, connections });
  }
  const watermark = journeys.at(-1)?.startedAt || new Date(0).toISOString();
  const totalMiles = journeys.reduce((sum, item) => sum + item.miles, 0);
  const changeInsights = [
    { type: "activity", direction: "stable", title: "Your journey history is connected", narrative: `${journeys.length.toLocaleString()} journeys shape your Atlas.`, confidence: "high" },
    { type: "places", direction: "stable", title: "Your world has familiar anchors", narrative: `${visiblePlaces.length.toLocaleString()} resolved places are represented.`, confidence: "high" },
    { type: "patterns", direction: "new", title: "Recurring rhythms are ready", narrative: `${candidates.length.toLocaleString()} recurring journey patterns have enough evidence.`, confidence: "medium" }
  ];
  const minimalPlaces = visiblePlaces.map(place => ({ id: place.id, label: place.label, address: place.address, category: place.category, latitude: place.latitude, longitude: place.longitude, visitCount: place.visitCount, arrivals: place.arrivals, departures: place.departures, firstSeenAt: place.firstSeenAt, lastSeenAt: place.lastSeenAt }));
  const bootstrap: AtlasBootstrap = { schemaVersion: SCHEMA_VERSION, generatedAtUtc: new Date().toISOString(), sourceWatermark: watermark, summary: { placeCount: visiblePlaces.length, connectionCount: edges.size, journeyCount: journeys.length, totalMiles: Math.round(totalMiles * 10) / 10 }, places: minimalPlaces, representativeLines: representativeLines(visibleMapped, 200), patterns, changeInsights };
  return { bootstrap, details, candidates };
}

export function persistAtlasSnapshot(database: DatabaseSync, householdId: string, result: ReturnType<typeof buildAtlasSnapshot>) {
  const id = hash("snapshot", `${result.bootstrap.sourceWatermark}:${result.bootstrap.generatedAtUtc}`), now = result.bootstrap.generatedAtUtc;
  database.exec("BEGIN IMMEDIATE;");
  try {
    database.prepare("INSERT INTO atlas_snapshots(id,household_id,schema_version,source_watermark,generated_at_utc,status,payload_json,error_message) VALUES(?,?,?,?,?,'ready',?,NULL)").run(id, householdId, result.bootstrap.schemaVersion, result.bootstrap.sourceWatermark, now, JSON.stringify(result.bootstrap));
    const detailInsert = database.prepare("INSERT INTO atlas_place_details(snapshot_id,place_id,payload_json) VALUES(?,?,?)"); for (const [placeId, detail] of result.details) detailInsert.run(id, placeId, JSON.stringify(detail));
    database.exec("DELETE FROM atlas_pattern_candidates"); const candidateInsert = database.prepare("INSERT INTO atlas_pattern_candidates(id,source_place_id,target_place_id,drive_count,sort_key,payload_json) VALUES(?,?,?,?,?,?)"); for (const item of result.candidates) candidateInsert.run(item.id, item.source, item.target, item.driveCount, item.title.toLowerCase(), JSON.stringify(item));
    database.prepare("INSERT INTO atlas_snapshot_state(household_id,active_snapshot_id,dirty,rebuild_completed_at_utc,last_error) VALUES(?,?,0,?,NULL) ON CONFLICT(household_id) DO UPDATE SET active_snapshot_id=excluded.active_snapshot_id,dirty=0,rebuild_completed_at_utc=excluded.rebuild_completed_at_utc,last_error=NULL").run(householdId, id, now);
    database.prepare("DELETE FROM atlas_place_details WHERE snapshot_id IN (SELECT id FROM atlas_snapshots WHERE household_id=? ORDER BY generated_at_utc DESC LIMIT -1 OFFSET 3)").run(householdId);
    database.prepare("DELETE FROM atlas_snapshots WHERE household_id=? AND id NOT IN (SELECT id FROM atlas_snapshots WHERE household_id=? ORDER BY generated_at_utc DESC LIMIT 3)").run(householdId, householdId);
    database.exec("COMMIT;"); return id;
  } catch (error) { database.exec("ROLLBACK;"); throw error; }
}

export function rebuildAtlasSnapshot(database: DatabaseSync, householdId: string) {
  database.prepare("INSERT INTO atlas_snapshot_state(household_id,dirty,rebuild_started_at_utc) VALUES(?,1,?) ON CONFLICT(household_id) DO UPDATE SET dirty=1,rebuild_started_at_utc=excluded.rebuild_started_at_utc").run(householdId, new Date().toISOString());
  try { const result = buildAtlasSnapshot(database, householdId); const snapshotId = persistAtlasSnapshot(database, householdId, result); return { snapshotId, ...result }; }
  catch (error) { database.prepare("UPDATE atlas_snapshot_state SET dirty=1,last_error=? WHERE household_id=?").run(error instanceof Error ? error.message.slice(0, 300) : "Snapshot build failed", householdId); throw error; }
}
