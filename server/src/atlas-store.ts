import type { DatabaseSync } from "node:sqlite";
import { Worker } from "node:worker_threads";
import type { AtlasBootstrap, AtlasMapFeature, AtlasMapResponse, AtlasPattern } from "./types.js";

export class AtlasStore {
  private timer?: NodeJS.Timeout;
  private rebuilding?: Promise<void>;
  private readonly mapCache = new Map<string, AtlasMapResponse>();
  constructor(private readonly database: DatabaseSync, private readonly householdId: string, private readonly databasePath: string, private readonly root: string) {}

  close() { if (this.timer) clearTimeout(this.timer); this.timer = undefined; this.mapCache.clear(); }

  bootstrap() {
    const row = this.database.prepare("SELECT s.payload_json FROM atlas_snapshot_state st JOIN atlas_snapshots s ON s.id=st.active_snapshot_id WHERE st.household_id=? AND s.status='ready'").get(this.householdId) as { payload_json: string } | undefined;
    return row ? JSON.parse(row.payload_json) as AtlasBootstrap : null;
  }

  place(placeId: string) {
    const row = this.database.prepare("SELECT d.payload_json FROM atlas_snapshot_state st JOIN atlas_place_details d ON d.snapshot_id=st.active_snapshot_id WHERE st.household_id=? AND d.place_id=?").get(this.householdId, placeId) as { payload_json: string } | undefined;
    return row ? JSON.parse(row.payload_json) : null;
  }

  patterns(limit = 10, cursor = "") {
    const rows = this.database.prepare(`SELECT c.payload_json FROM atlas_pattern_candidates c LEFT JOIN atlas_pattern_reviews r ON r.id=c.id
      WHERE r.id IS NULL AND (?='' OR (printf('%012d',999999999-c.drive_count)||c.sort_key||c.id)>?) ORDER BY c.drive_count DESC,c.sort_key,c.id LIMIT ?`).all(cursor, cursor, Math.min(10, Math.max(1, limit))) as Array<{ payload_json: string }>;
    const items = rows.map(row => JSON.parse(row.payload_json) as AtlasPattern);
    const nextCursor = items.length ? `${String(999999999 - items.at(-1)!.driveCount).padStart(12, "0")}${items.at(-1)!.title.toLowerCase()}${items.at(-1)!.id}` : null;
    return { items, nextCursor };
  }

  journeyMap(input: { west: number; south: number; east: number; north: number; zoom: number }): AtlasMapResponse {
    const snapshotId = String((this.status() as any).snapshotId || "none"), zoom = Math.max(0, Math.min(18, input.zoom));
    const tileSize = zoom < 6 ? 2 : zoom < 9 ? 0.5 : zoom < 12 ? 0.1 : 0.02;
    const bounds = {
      west: Math.max(-180, Math.floor(input.west / tileSize) * tileSize), south: Math.max(-90, Math.floor(input.south / tileSize) * tileSize),
      east: Math.min(180, Math.ceil(input.east / tileSize) * tileSize), north: Math.min(90, Math.ceil(input.north / tileSize) * tileSize)
    };
    const mode = zoom >= 11 ? "journeys" : "corridors", cacheKey = `${snapshotId}:${mode}:${Math.floor(zoom)}:${bounds.west}:${bounds.south}:${bounds.east}:${bounds.north}`;
    const cached = this.mapCache.get(cacheKey); if (cached) return cached;
    const rows = this.database.prepare(`SELECT id,started_at_utc,starting_latitude,starting_longitude,ending_latitude,ending_longitude,distance_miles
      FROM drives WHERE household_id=? AND starting_latitude IS NOT NULL AND starting_longitude IS NOT NULL AND ending_latitude IS NOT NULL AND ending_longitude IS NOT NULL
      AND min(starting_longitude,ending_longitude)<=? AND max(starting_longitude,ending_longitude)>=? AND min(starting_latitude,ending_latitude)<=? AND max(starting_latitude,ending_latitude)>=?
      ORDER BY started_at_epoch DESC,id`).all(this.householdId, bounds.east, bounds.west, bounds.north, bounds.south) as any[];
    let features: AtlasMapFeature[] = [];
    if (mode === "journeys") {
      features = rows.slice(0, 1200).map(row => ({ type: "Feature", properties: { kind: "journey", journeyCount: 1, distanceMiles: Math.round((Number(row.distance_miles) || 0) * 10) / 10, journeyId: String(row.id), startedAt: String(row.started_at_utc || "") }, geometry: { type: "LineString", coordinates: [[Number(row.starting_longitude), Number(row.starting_latitude)], [Number(row.ending_longitude), Number(row.ending_latitude)]] } }));
    } else {
      const corridorSize = zoom < 5 ? 2 : zoom < 8 ? 0.5 : 0.12;
      const groups = new Map<string, { count: number; miles: number; start: [number, number]; end: [number, number] }>();
      for (const row of rows) {
        let start: [number, number] = [Number(row.starting_longitude), Number(row.starting_latitude)], end: [number, number] = [Number(row.ending_longitude), Number(row.ending_latitude)];
        const bucket = (point: [number, number]) => `${Math.round(point[0] / corridorSize)}:${Math.round(point[1] / corridorSize)}`;
        let startBucket = bucket(start), endBucket = bucket(end); if (startBucket > endBucket) { [start, end] = [end, start]; [startBucket, endBucket] = [endBucket, startBucket]; }
        const key = `${startBucket}>${endBucket}`, group = groups.get(key) || { count: 0, miles: 0, start: [0, 0], end: [0, 0] };
        group.count++; group.miles += Number(row.distance_miles) || 0; group.start[0] += start[0]; group.start[1] += start[1]; group.end[0] += end[0]; group.end[1] += end[1]; groups.set(key, group);
      }
      features = [...groups.values()].sort((a, b) => b.count - a.count).slice(0, 500).map(group => ({ type: "Feature", properties: { kind: "corridor", journeyCount: group.count, distanceMiles: Math.round(group.miles * 10) / 10 }, geometry: { type: "LineString", coordinates: [[Number((group.start[0] / group.count).toFixed(6)), Number((group.start[1] / group.count).toFixed(6))], [Number((group.end[0] / group.count).toFixed(6)), Number((group.end[1] / group.count).toFixed(6))]] } }));
    }
    const result: AtlasMapResponse = { mode, zoom, totalInView: rows.length, returned: features.length, truncated: mode === "journeys" ? rows.length > features.length : false, bounds, data: { type: "FeatureCollection", features } };
    this.mapCache.set(cacheKey, result); while (this.mapCache.size > 64) this.mapCache.delete(this.mapCache.keys().next().value!); return result;
  }

  status() {
    const row = this.database.prepare("SELECT st.dirty,st.rebuild_started_at_utc,st.rebuild_completed_at_utc,st.last_error,s.id,s.generated_at_utc,s.source_watermark,s.schema_version FROM atlas_snapshot_state st LEFT JOIN atlas_snapshots s ON s.id=st.active_snapshot_id WHERE st.household_id=?").get(this.householdId) as any;
    return row ? { ready: Boolean(row.id), dirty: Boolean(row.dirty), rebuilding: Boolean(this.rebuilding), snapshotId: row.id || null, generatedAtUtc: row.generated_at_utc || null, sourceWatermark: row.source_watermark || null, schemaVersion: row.schema_version || null, lastError: row.last_error || null } : { ready: false, dirty: true, rebuilding: false, snapshotId: null, lastError: null };
  }

  rebuildNow() {
    if (this.rebuilding) return this.rebuilding;
    this.rebuilding = new Promise<void>((resolve, reject) => {
      const extension = import.meta.url.endsWith(".ts") ? ".ts" : ".js";
      const worker = new Worker(new URL(`./snapshot-worker${extension}`, import.meta.url), { workerData: { databasePath: this.databasePath, householdId: this.householdId, root: this.root } });
      let settled = false;
      worker.once("message", (message: { ok: boolean; error?: string }) => { settled = true; if (message.ok) resolve(); else reject(new Error(message.error || "Snapshot rebuild failed")); });
      worker.once("error", error => { settled = true; reject(error); });
      worker.once("exit", code => { if (!settled && code !== 0) reject(new Error(`Snapshot worker exited with code ${code}`)); else if (!settled) resolve(); });
    }).finally(() => { this.rebuilding = undefined; this.mapCache.clear(); });
    return this.rebuilding;
  }

  scheduleRebuild(delayMs = 250) {
    this.database.prepare("INSERT INTO atlas_snapshot_state(household_id,dirty) VALUES(?,1) ON CONFLICT(household_id) DO UPDATE SET dirty=1").run(this.householdId);
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => { this.timer = undefined; void this.rebuildNow(); }, delayMs);
  }

  savePlace(input: { placeId: string; name: string; category: string; latitude?: number; longitude?: number; radiusFeet?: number }) {
    const now = new Date().toISOString();
    this.database.prepare(`INSERT INTO atlas_place_labels(place_id,name,category,latitude,longitude,radius_feet,updated_at_utc) VALUES(?,?,?,?,?,?,?)
      ON CONFLICT(place_id) DO UPDATE SET name=excluded.name,category=excluded.category,latitude=excluded.latitude,longitude=excluded.longitude,radius_feet=excluded.radius_feet,updated_at_utc=excluded.updated_at_utc`).run(input.placeId, input.name, input.category, input.latitude ?? null, input.longitude ?? null, input.radiusFeet || 200, now);
    const bootstrap = this.bootstrap();
    if (bootstrap) {
      const place = bootstrap.places.find(item => item.id === input.placeId); if (place) { place.label = input.name; place.address = input.name; place.category = input.category; }
      for (const pattern of bootstrap.patterns) { if (pattern.source === input.placeId) { pattern.sourceLabel = input.name; pattern.sourceAddress = input.name; } if (pattern.target === input.placeId) { pattern.targetLabel = input.name; pattern.targetAddress = input.name; } pattern.title = `${pattern.sourceLabel} to ${pattern.targetLabel}`; }
      this.patchBootstrap(bootstrap);
    }
    this.scheduleRebuild(); return { saved: true, updatedAtUtc: now };
  }

  reviewPattern(id: string, status: "confirmed" | "dismissed", type?: string, customName?: string) {
    const existing = this.database.prepare("SELECT id FROM atlas_pattern_candidates WHERE id=?").get(id); if (!existing) return null;
    const now = new Date().toISOString();
    this.database.prepare("INSERT INTO atlas_pattern_reviews(id,status,type,custom_name,updated_at_utc) VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET status=excluded.status,type=excluded.type,custom_name=excluded.custom_name,updated_at_utc=excluded.updated_at_utc").run(id, status, type || null, customName || null, now);
    const bootstrap = this.bootstrap(); if (bootstrap) { bootstrap.patterns = this.patterns(10).items; this.patchBootstrap(bootstrap); }
    this.scheduleRebuild(); return { saved: true, id, status, updatedAtUtc: now };
  }

  private patchBootstrap(bootstrap: AtlasBootstrap) {
    this.database.prepare("UPDATE atlas_snapshots SET payload_json=? WHERE id=(SELECT active_snapshot_id FROM atlas_snapshot_state WHERE household_id=?)").run(JSON.stringify(bootstrap), this.householdId);
  }
}
