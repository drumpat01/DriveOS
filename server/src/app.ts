import Fastify, { type FastifyRequest } from "fastify";
import compress from "@fastify/compress";
import staticPlugin from "@fastify/static";
import { AtlasStore } from "./atlas-store.js";
import { tursoAtlasDurableState } from "./atlas-durable-state.js";
import { authenticate, authenticateRecorder, authenticateScheduledSync, type Principal } from "./auth.js";
import { compatibilityProcessReady, compatibilityReady } from "./compatibility-readiness.js";
import { applyMigrations, openDatabase } from "./database.js";
import { proxyLegacy } from "./legacy-proxy.js";
import { config as defaultConfig } from "./config.js";
import { atlasMapSchema, bootstrapSchema, patternQueueSchema, placeDetailSchema, savedSchema } from "./schemas.js";
import { getSpotifyPlayerSession, startSpotifyPlaybackAuthorization } from "./spotify-player.js";
import { RecorderStore, type RecorderPoint } from "./recorder.js";

declare module "fastify" { interface FastifyRequest { principal: Principal | null } }

const publicPaths = new Set(["/healthz", "/readyz", "/login", "/login.html", "/manifest.webmanifest", "/favicon.ico"]);
const publicAuthPaths = new Set(["/api/auth/login", "/api/auth/passkey/options", "/api/auth/passkey/verify"]);
const scheduledSyncPath = "/api/spotify/sync";
const securityHeaders = {
  "content-security-policy": "default-src 'self'; style-src 'self' 'unsafe-inline' https://unpkg.com; script-src 'self' https://unpkg.com https://sdk.scdn.co https://open.spotify.com; connect-src 'self' https://tiles.openfreemap.org https://api.spotify.com https://*.spotify.com wss://*.spotify.com https://*.scdn.co; img-src 'self' data: blob: https://tiles.openfreemap.org https://i.scdn.co; media-src blob: https://*.scdn.co https://*.spotify.com; font-src 'self' data: https://tiles.openfreemap.org; worker-src 'self' blob:; child-src blob:; object-src 'none'; frame-src https://open.spotify.com; frame-ancestors 'none'; form-action 'self'; base-uri 'self'; manifest-src 'self'",
  "x-content-type-options": "nosniff", "x-frame-options": "DENY", "referrer-policy": "no-referrer",
  "permissions-policy": "autoplay=(self \"https://open.spotify.com\"), encrypted-media=(self \"https://open.spotify.com\"), camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=(), bluetooth=(), midi=(), magnetometer=(), gyroscope=(), accelerometer=()"
};

const loopbackHosts = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);

function requestOriginAllowed(req: FastifyRequest, publicOrigin: string) {
  const originHeader = String(req.headers.origin || "");
  if (!originHeader) return true;
  try {
    const origin = new URL(originHeader);
    if (origin.origin === new URL(publicOrigin).origin) return true;
    if (origin.protocol !== "http:" || !loopbackHosts.has(origin.hostname.toLowerCase())) return false;
    const host = String(req.headers.host || "").trim();
    if (!host || /[,\s/\\]/.test(host)) return false;
    const requestOrigin = new URL(`http://${host}`);
    return loopbackHosts.has(requestOrigin.hostname.toLowerCase()) && requestOrigin.host === origin.host;
  } catch {
    return false;
  }
}

export async function createApp(overrides: Partial<typeof defaultConfig> = {}) {
  const cfg = { ...defaultConfig, ...overrides }, database = openDatabase(cfg.databasePath); applyMigrations(database, cfg.root);
  const store = new AtlasStore(database, cfg.householdId, cfg.databasePath, cfg.root, cfg.atlasDurableTurso ? tursoAtlasDurableState : undefined);
  const recorder = new RecorderStore(database, cfg.householdId, cfg.recorderDurableTurso);
  const app = Fastify({ logger: { level: process.env.DRIVEOS_NODE_LOG_LEVEL || "info", redact: ["req.headers.cookie", "req.headers.authorization", "req.headers.x-driveos-sync-token", "req.body.password", "res.headers.set-cookie"] }, bodyLimit: 4 * 1024 * 1024, trustProxy: false });
  await app.register(compress, { global: true, threshold: 1024, encodings: ["br", "gzip", "identity"] });
  app.decorateRequest("principal", null);
  app.addHook("onSend", async (_req, reply, payload) => { for (const [name, value] of Object.entries(securityHeaders)) reply.header(name, value); return payload; });
  app.addHook("onRequest", async (req, reply) => {
    const requestPath = req.url.split("?")[0];
    if (publicPaths.has(requestPath) || req.url.startsWith("/assets/") || /\.(?:css|js|png|jpg|jpeg|svg|ico|woff2?|webmanifest)(?:\?|$)/i.test(req.url)) return;
    if (requestPath === scheduledSyncPath) {
      if (!authenticateScheduledSync(req, cfg.scheduledSyncSecret)) return reply.code(401).send({ error: "Scheduled sync authentication failed." });
      return;
    }
    if (requestPath === "/api/recorder" || requestPath.startsWith("/api/recorder/")) {
      if (!authenticateRecorder(req, cfg.recorderToken)) return reply.code(401).send({ error: "Recorder authentication failed." });
      req.principal = { subject: "journeydeck-recorder", role: "owner", mode: "full" };
      return;
    }
    if (publicAuthPaths.has(requestPath)) {
      if (!["GET", "HEAD"].includes(req.method) && !requestOriginAllowed(req, cfg.publicOrigin)) return reply.code(403).send({ error: "Request origin validation failed." });
      return;
    }
    req.principal = await authenticate(req, { allowTestAuth: cfg.allowTestAuth, trustTailscaleHeaders: cfg.trustTailscaleHeaders, legacyUpstream: cfg.legacyUpstream, publicOrigin: cfg.publicOrigin, localSessionSecret: process.env.DRIVEOS_NODE_SESSION_SECRET });
    if (!req.principal) { if (req.url.startsWith("/api/")) return reply.code(401).send({ error: "Authentication required." }); return reply.redirect("/login"); }
    if (!["GET", "HEAD"].includes(req.method)) {
      if (!requestOriginAllowed(req, cfg.publicOrigin)) return reply.code(403).send({ error: "Request origin validation failed." });
      if (req.principal.role === "wife" && !req.url.startsWith("/api/wife/")) return reply.code(403).send({ error: "Full mode is required." });
    }
  });
  app.get("/healthz", async () => ({ ok: true, mode: "node-hybrid", database: "local-sqlite", legacyCompatibilityConfigured: Boolean(cfg.legacyUpstream), legacyCompatibilityReadOnly: cfg.legacyReadOnly }));
  app.get("/readyz", async (_req, reply) => {
    const atlas = store.status(), legacyCompatibilityReachable = cfg.compatibilityReadyFile
      ? await compatibilityProcessReady(cfg.legacyUpstream, cfg.compatibilityReadyFile)
      : await compatibilityReady(cfg.legacyUpstream, cfg.publicOrigin);
    const ready = atlas.ready && legacyCompatibilityReachable;
    return reply.code(ready ? 200 : 503).send({ ok: ready, atlas, legacyCompatibilityReachable });
  });
  app.get("/api/auth/session", async req => ({ authenticated: true, role: req.principal!.role, mode: req.principal!.mode }));
  const recorderIdentifier = { type: "string", minLength: 1, maxLength: 120, pattern: "^[A-Za-z0-9._:-]+$" } as const;
  const recorderTimestamp = { type: "string", minLength: 20, maxLength: 40 } as const;
  const recorderPointSchema = {
    type: "object", additionalProperties: false,
    required: ["sequence", "recordedAt", "latitude", "longitude"],
    properties: {
      sequence: { type: "integer", minimum: 0, maximum: 10_000_000 }, recordedAt: recorderTimestamp,
      latitude: { type: "number", minimum: -90, maximum: 90 }, longitude: { type: "number", minimum: -180, maximum: 180 },
      accuracyMeters: { type: ["number", "null"], minimum: 0, maximum: 10_000 }, altitudeMeters: { type: ["number", "null"], minimum: -1000, maximum: 100_000 },
      headingDegrees: { type: ["number", "null"], minimum: 0, maximum: 360 }, speedMps: { type: ["number", "null"], minimum: 0, maximum: 150 }
    }
  } as const;
  const validTimestamp = (value: string) => Number.isFinite(Date.parse(value)) && Date.parse(value) <= Date.now() + 300_000;
  app.get("/api/recorder/status", async () => ({ ready: true, mode: "single-owner", durable: cfg.recorderDurableTurso ? "turso" : "sqlite" }));
  app.get<{ Querystring: { limit?: string } }>("/api/recorder/companion", {
    schema: { querystring: { type: "object", additionalProperties: false, properties: { limit: { type: "string", pattern: "^[0-9]{1,3}$" } } } }
  }, async req => recorder.companion(Number(req.query.limit) || 50));
  app.get<{ Params: { id: string } }>("/api/recorder/journeys/:id/route", {
    schema: { params: { type: "object", required: ["id"], properties: { id: recorderIdentifier } } }
  }, async (req, reply) => (await recorder.journeyRoute(req.params.id)) || reply.code(404).send({ error: "Journey route was not found." }));
  app.post<{ Body: { id: string; deviceId: string; startedAt: string } }>("/api/recorder/sessions", {
    schema: { body: { type: "object", additionalProperties: false, required: ["id", "deviceId", "startedAt"], properties: { id: recorderIdentifier, deviceId: recorderIdentifier, startedAt: recorderTimestamp } } }
  }, async (req, reply) => {
    if (!validTimestamp(req.body.startedAt)) return reply.code(400).send({ error: "A valid recording start time is required." });
    return reply.code(201).send(await recorder.start(req.body.id, req.body.deviceId, new Date(req.body.startedAt).toISOString()));
  });
  app.get<{ Params: { id: string }; Querystring: { deviceId?: string } }>("/api/recorder/sessions/:id", {
    schema: { params: { type: "object", required: ["id"], properties: { id: recorderIdentifier } }, querystring: { type: "object", additionalProperties: false, required: ["deviceId"], properties: { deviceId: recorderIdentifier } } }
  }, async (req, reply) => (await recorder.get(req.params.id, String(req.query.deviceId))) || reply.code(404).send({ error: "Recording was not found." }));
  app.post<{ Params: { id: string }; Body: { deviceId: string; points: RecorderPoint[] } }>("/api/recorder/sessions/:id/points", {
    schema: { params: { type: "object", required: ["id"], properties: { id: recorderIdentifier } }, body: { type: "object", additionalProperties: false, required: ["deviceId", "points"], properties: { deviceId: recorderIdentifier, points: { type: "array", minItems: 1, maxItems: 250, items: recorderPointSchema } } } }
  }, async (req, reply) => {
    if (req.body.points.some(point => !validTimestamp(point.recordedAt))) return reply.code(400).send({ error: "Every recorded point requires a valid timestamp." });
    try { return (await recorder.appendPoints(req.params.id, req.body.deviceId, req.body.points)) || reply.code(404).send({ error: "Recording was not found." }); }
    catch (error) { return reply.code(409).send({ error: error instanceof Error ? error.message : "Recorded points could not be saved." }); }
  });
  app.post<{ Params: { id: string }; Body: { deviceId: string; status: "recording" | "paused" } }>("/api/recorder/sessions/:id/state", {
    schema: { params: { type: "object", required: ["id"], properties: { id: recorderIdentifier } }, body: { type: "object", additionalProperties: false, required: ["deviceId", "status"], properties: { deviceId: recorderIdentifier, status: { type: "string", enum: ["recording", "paused"] } } } }
  }, async (req, reply) => (await recorder.setState(req.params.id, req.body.deviceId, req.body.status)) || reply.code(404).send({ error: "Recording was not found." }));
  app.post<{ Params: { id: string }; Body: { deviceId: string; endedAt: string } }>("/api/recorder/sessions/:id/complete", {
    schema: { params: { type: "object", required: ["id"], properties: { id: recorderIdentifier } }, body: { type: "object", additionalProperties: false, required: ["deviceId", "endedAt"], properties: { deviceId: recorderIdentifier, endedAt: recorderTimestamp } } }
  }, async (req, reply) => {
    if (!validTimestamp(req.body.endedAt)) return reply.code(400).send({ error: "A valid recording end time is required." });
    try { return (await recorder.complete(req.params.id, req.body.deviceId, new Date(req.body.endedAt).toISOString())) || reply.code(404).send({ error: "Recording was not found." }); }
    catch (error) { return reply.code(409).send({ error: error instanceof Error ? error.message : "Recording could not be completed." }); }
  });
  app.get("/api/atlas/bootstrap", { schema: { response: { 200: bootstrapSchema, 304: { type: "null" }, 503: { type: "object", additionalProperties: false, required: ["error"], properties: { error: { type: "string" } } } } } }, async (req, reply) => { const snapshot = store.bootstrap(); if (!snapshot) return reply.code(503).send({ error: "Atlas snapshot is not ready." }); const etag = `W/"${Buffer.from(snapshot.sourceWatermark).toString("base64url")}"`; reply.header("cache-control", "private, no-cache").header("etag", etag); if (req.headers["if-none-match"] === etag) return reply.code(304).send(); return snapshot; });
  app.get<{ Querystring: { west?: string; south?: string; east?: string; north?: string; zoom?: string } }>("/api/atlas/map", { schema: { response: { 200: atlasMapSchema } } }, async (req, reply) => {
    const west = Number(req.query.west), south = Number(req.query.south), east = Number(req.query.east), north = Number(req.query.north), zoom = Number(req.query.zoom);
    if (![west, south, east, north, zoom].every(Number.isFinite) || west < -180 || east > 180 || south < -90 || north > 90 || west >= east || south >= north || zoom < 0 || zoom > 18) return reply.code(400).send({ error: "Valid Atlas bounds and zoom are required." } as any);
    reply.header("cache-control", "private, max-age=30"); return store.journeyMap({ west, south, east, north, zoom });
  });
  app.get<{ Params: { id: string } }>("/api/atlas/places/:id", { schema: { response: { 200: placeDetailSchema } } }, async (req, reply) => { const detail = store.place(req.params.id); return detail || reply.code(404).send({ error: "Place was not found." }); });
  app.get<{ Querystring: { limit?: string; cursor?: string } }>("/api/atlas/patterns", { schema: { response: { 200: patternQueueSchema } } }, async req => store.patterns(Number(req.query.limit) || 10, String(req.query.cursor || "")));
  app.get("/api/atlas/snapshot/status", async () => store.status());
  app.post<{ Body: { placeId: string; name: string; category: string; latitude?: number; longitude?: number; radiusFeet?: number } }>("/api/atlas/places/label", { schema: { body: { type: "object", additionalProperties: false, required: ["placeId", "name", "category"], properties: { placeId: { type: "string" }, name: { type: "string", minLength: 1, maxLength: 80 }, category: { type: "string", enum: ["home", "work", "family", "errands", "dining", "wellness", "other"] }, latitude: { type: "number", minimum: -90, maximum: 90 }, longitude: { type: "number", minimum: -180, maximum: 180 }, radiusFeet: { type: "number", minimum: 25, maximum: 5280 } } }, response: { 200: savedSchema } } }, async (req, reply) => {
    const body = req.body || {} as any, name = String(body.name || "").trim(), category = String(body.category || "").toLowerCase();
    if (!/^place-[a-f0-9]{12}$/.test(String(body.placeId)) || !name || name.length > 80 || !["home", "work", "family", "errands", "dining", "wellness", "other"].includes(category)) return reply.code(400).send({ error: "A valid place label is required." });
    return await store.savePlace({ ...body, name, category });
  });
  app.post<{ Params: { id: string }; Body: { type?: string; customName?: string } }>("/api/atlas/patterns/:id/confirm", { schema: { body: { type: "object", additionalProperties: false, properties: { type: { type: "string", maxLength: 40 }, customName: { type: "string", maxLength: 60 } } }, response: { 200: savedSchema } } }, async (req, reply) => (await store.reviewPattern(req.params.id, "confirmed", req.body?.type || "frequent-route", req.body?.customName)) || reply.code(404).send({ error: "Pattern was not found." }));
  app.post<{ Params: { id: string } }>("/api/atlas/patterns/:id/dismiss", { schema: { response: { 200: savedSchema } } }, async (req, reply) => (await store.reviewPattern(req.params.id, "dismissed")) || reply.code(404).send({ error: "Pattern was not found." }));
  app.post("/api/atlas/snapshot/rebuild", async (_req, reply) => {
    void store.rebuildNow().catch(error => app.log.error({ err: error }, "Atlas snapshot rebuild failed"));
    return reply.code(202).send({ accepted: true });
  });
  app.all("/api/atlas/*", async (_req, reply) => reply.code(410).send({ error: "The legacy Atlas API has been retired. Use the persisted Atlas snapshot API." }));
  app.get("/api/spotify/player/session", async (_req, reply) => {
    reply.header("cache-control", "no-store");
    try { return await getSpotifyPlayerSession(cfg.root); }
    catch { return reply.code(503).send({ error: "Spotify playback is unavailable. Reconnect Spotify on this computer." }); }
  });
  app.get("/api/spotify/player/auth-status", async (_req, reply) => {
    reply.header("cache-control", "no-store");
    try {
      const session = await getSpotifyPlayerSession(cfg.root);
      return { authorized: true, playbackReady: session.playbackReady, missingScopes: session.missingScopes };
    } catch { return { authorized: false, playbackReady: false, missingScopes: [] }; }
  });
  app.post("/api/spotify/player/connect", async (_req, reply) => {
    if (cfg.mode === "web" || process.platform !== "win32") {
      if (!cfg.spotifyClientId) return reply.code(503).send({ error: "Spotify playback is not configured." });
      return {
        mode: "pkce",
        clientId: cfg.spotifyClientId,
        redirectUri: `${cfg.publicOrigin.replace(/\/$/, "")}/spotify-callback`
      };
    }
    try { return { started: startSpotifyPlaybackAuthorization(cfg.root) }; }
    catch { return reply.code(503).send({ error: "Spotify authorization could not be opened." }); }
  });
  app.post<{ Body: { driveId?: string } }>("/api/drive/map", async (req, reply) => {
    const driveId = String(req.body?.driveId || "");
    if (!/^\d+-\d+$/.test(driveId)) return reply.code(400).send({ error: "A valid journey identifier is required." });
    const recorded = await recorder.routeMap(driveId);
    if (recorded) return recorded;
    return proxyLegacy(req, reply, cfg.legacyUpstream, cfg.legacyReadOnly, cfg.publicOrigin);
  });
  app.all("/api/*", async (req, reply) => proxyLegacy(req, reply, cfg.legacyUpstream, cfg.legacyReadOnly, cfg.publicOrigin));
  // Keep one sandboxed wildcard route rooted at web/. With wildcard disabled,
  // Fastify snapshots the file list during startup; a refreshed HTML shell can
  // then reference newly deployed CSS, JS, or artwork that the running process
  // has no route for. The wildcard handler resolves each request against the
  // same fixed root, so atomic web asset updates become visible immediately.
  await app.register(staticPlugin, { root: cfg.webRoot, prefix: "/", wildcard: true, index: false, decorateReply: true });
  app.get("/", async (_req, reply) => reply.sendFile("index.html")); app.get("/spotify-callback", async (_req, reply) => reply.sendFile("index.html")); app.get("/login", async (_req, reply) => reply.sendFile("login.html")); app.get("/wife", async (_req, reply) => reply.sendFile("wife.html"));
  app.setNotFoundHandler(async (_req, reply) => reply.code(404).send({ error: "Not found." }));
  app.addHook("onClose", async () => { await store.close(); database.close(); });
  return { app, database, store, recorder, config: cfg };
}
