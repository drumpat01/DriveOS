import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

function integer(name: string, fallback: number) {
  const value = Number(process.env[name] || fallback);
  if (!Number.isInteger(value) || value < 1 || value > 65535) throw new Error(`${name} must be a valid port`);
  return value;
}

export const config = Object.freeze({
  root,
  webRoot: path.join(root, "web"),
  host: process.env.DRIVEOS_NODE_HOST || "127.0.0.1",
  port: integer("DRIVEOS_NODE_PORT", 8791),
  databasePath: path.resolve(process.env.DRIVEOS_NODE_DATABASE || path.join(root, "data", "atlas-node-dev", "driveos.db")),
  legacyUpstream: process.env.DRIVEOS_NODE_LEGACY_UPSTREAM || "",
  legacyReadOnly: process.env.DRIVEOS_NODE_LEGACY_READ_ONLY !== "false",
  compatibilityReadyFile: process.env.DRIVEOS_COMPATIBILITY_READY_FILE || "",
  atlasDurableTurso: process.env.DRIVEOS_ATLAS_DURABLE_TURSO === "true",
  atlasLegacyDatabasePath: process.env.DRIVEOS_ATLAS_LEGACY_DATABASE || "",
  publicOrigin: process.env.DRIVEOS_NODE_PUBLIC_ORIGIN || "https://superredux.tail1babbd.ts.net:8443",
  scheduledSyncSecret: process.env.DRIVEOS_SPOTIFY_SYNC_SECRET || "",
  spotifyClientId: process.env.SPOTIFY_CLIENT_ID || "",
  mode: process.env.DRIVEOS_MODE || "desktop",
  allowTestAuth: process.env.DRIVEOS_NODE_TEST_AUTH === "true",
  trustTailscaleHeaders: process.env.DRIVEOS_NODE_TRUST_TAILSCALE_HEADERS === "true",
  householdId: process.env.DRIVEOS_NODE_HOUSEHOLD_ID || "household_primary",
  recorderToken: process.env.JOURNEYDECK_RECORDER_TOKEN || "",
  lastFmApiKey: process.env.LASTFM_API_KEY || "",
  tessieToken: process.env.TESSIE_TOKEN || "",
  recorderDurableTurso: process.env.JOURNEYDECK_RECORDER_DURABLE_TURSO === "true" || process.env.DRIVEOS_ATLAS_DURABLE_TURSO === "true"
});
