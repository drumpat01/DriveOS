import type { DatabaseSync } from "node:sqlite";
import { Worker } from "node:worker_threads";
import type { AtlasBootstrap, AtlasPattern } from "./types.js";

export class AtlasStore {
  private timer?: NodeJS.Timeout;
  private rebuilding?: Promise<void>;
  constructor(private readonly database: DatabaseSync, private readonly householdId: string, private readonly databasePath: string, private readonly root: string) {}

  close() { if (this.timer) clearTimeout(this.timer); this.timer = undefined; }

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
    }).finally(() => { this.rebuilding = undefined; });
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
