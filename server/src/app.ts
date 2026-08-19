import Fastify from "fastify";
import http from "node:http";
import https from "node:https";
import compress from "@fastify/compress";
import staticPlugin from "@fastify/static";
import { AtlasStore } from "./atlas-store.js";
import { authenticate, authenticateScheduledSync, type Principal } from "./auth.js";
import { applyMigrations, openDatabase } from "./database.js";
import { proxyLegacy } from "./legacy-proxy.js";
import { legacyForwardingContext } from "./legacy-forwarding.js";
import { config as defaultConfig } from "./config.js";
import { atlasMapSchema, bootstrapSchema, patternQueueSchema, placeDetailSchema, savedSchema } from "./schemas.js";

declare module "fastify" { interface FastifyRequest { principal: Principal | null } }

const publicPaths = new Set(["/healthz", "/readyz", "/login", "/login.html", "/manifest.webmanifest", "/favicon.ico"]);
const publicAuthPaths = new Set(["/api/auth/login", "/api/auth/passkey/options", "/api/auth/passkey/verify"]);
const scheduledSyncPath = "/api/spotify/sync";
const securityHeaders = {
  "content-security-policy": "default-src 'self'; style-src 'self' 'unsafe-inline' https://unpkg.com; script-src 'self' https://unpkg.com; connect-src 'self' https://tiles.openfreemap.org; img-src 'self' data: blob: https://tiles.openfreemap.org https://i.scdn.co; font-src 'self' data: https://tiles.openfreemap.org; worker-src 'self' blob:; child-src blob:; object-src 'none'; frame-src 'none'; frame-ancestors 'none'; form-action 'self'; base-uri 'self'; manifest-src 'self'",
  "x-content-type-options": "nosniff", "x-frame-options": "DENY", "referrer-policy": "no-referrer",
  "permissions-policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=(), bluetooth=(), midi=(), magnetometer=(), gyroscope=(), accelerometer=()"
};

async function compatibilityReady(upstream: string, publicOrigin: string) {
  if (!upstream) return true;
  const url = new URL("/healthz", upstream), forwarding = legacyForwardingContext(upstream, publicOrigin);
  return await new Promise<boolean>(resolve => {
    const client = url.protocol === "https:" ? https : http;
    const request = client.get(url, { headers: { host: forwarding.forwardedHost, "x-forwarded-host": forwarding.forwardedHost, "x-forwarded-proto": forwarding.forwardedProtocol } }, response => {
      response.resume();
      resolve(Boolean(response.statusCode && response.statusCode >= 200 && response.statusCode < 400));
    });
    request.setTimeout(1500, () => request.destroy(new Error("Compatibility readiness timed out.")));
    request.on("error", () => resolve(false));
  });
}

export async function createApp(overrides: Partial<typeof defaultConfig> = {}) {
  const cfg = { ...defaultConfig, ...overrides }, database = openDatabase(cfg.databasePath); applyMigrations(database, cfg.root);
  const store = new AtlasStore(database, cfg.householdId, cfg.databasePath, cfg.root);
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
    if (publicAuthPaths.has(requestPath)) {
      if (!["GET", "HEAD"].includes(req.method)) { const origin = String(req.headers.origin || ""); if (origin && origin !== cfg.publicOrigin && !(cfg.allowTestAuth && origin === "http://127.0.0.1")) return reply.code(403).send({ error: "Request origin validation failed." }); }
      return;
    }
    req.principal = await authenticate(req, { allowTestAuth: cfg.allowTestAuth, trustTailscaleHeaders: cfg.trustTailscaleHeaders, legacyUpstream: cfg.legacyUpstream, publicOrigin: cfg.publicOrigin, localSessionSecret: process.env.DRIVEOS_NODE_SESSION_SECRET });
    if (!req.principal) { if (req.url.startsWith("/api/")) return reply.code(401).send({ error: "Authentication required." }); return reply.redirect("/login"); }
    if (!["GET", "HEAD"].includes(req.method)) {
      const origin = String(req.headers.origin || ""); if (origin && origin !== cfg.publicOrigin && !(cfg.allowTestAuth && origin === "http://127.0.0.1")) return reply.code(403).send({ error: "Request origin validation failed." });
      if (req.principal.role === "wife" && !req.url.startsWith("/api/wife/")) return reply.code(403).send({ error: "Full mode is required." });
    }
  });
  app.get("/healthz", async () => ({ ok: true, mode: "node-hybrid", database: "local-sqlite", legacyCompatibilityConfigured: Boolean(cfg.legacyUpstream), legacyCompatibilityReadOnly: cfg.legacyReadOnly }));
  app.get("/readyz", async (_req, reply) => {
    const atlas = store.status(), legacyCompatibilityReachable = await compatibilityReady(cfg.legacyUpstream, cfg.publicOrigin);
    const ready = atlas.ready && legacyCompatibilityReachable;
    return reply.code(ready ? 200 : 503).send({ ok: ready, atlas, legacyCompatibilityReachable });
  });
  app.get("/api/auth/session", async req => ({ authenticated: true, role: req.principal!.role, mode: req.principal!.mode }));
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
    return store.savePlace({ ...body, name, category });
  });
  app.post<{ Params: { id: string }; Body: { type?: string; customName?: string } }>("/api/atlas/patterns/:id/confirm", { schema: { body: { type: "object", additionalProperties: false, properties: { type: { type: "string", maxLength: 40 }, customName: { type: "string", maxLength: 60 } } }, response: { 200: savedSchema } } }, async (req, reply) => store.reviewPattern(req.params.id, "confirmed", req.body?.type || "frequent-route", req.body?.customName) || reply.code(404).send({ error: "Pattern was not found." }));
  app.post<{ Params: { id: string } }>("/api/atlas/patterns/:id/dismiss", { schema: { response: { 200: savedSchema } } }, async (req, reply) => store.reviewPattern(req.params.id, "dismissed") || reply.code(404).send({ error: "Pattern was not found." }));
  app.post("/api/atlas/snapshot/rebuild", async (_req, reply) => { void store.rebuildNow(); return reply.code(202).send({ accepted: true }); });
  app.all("/api/atlas/*", async (_req, reply) => reply.code(410).send({ error: "The legacy Atlas API has been retired. Use the persisted Atlas snapshot API." }));
  app.all("/api/*", async (req, reply) => proxyLegacy(req, reply, cfg.legacyUpstream, cfg.legacyReadOnly, cfg.publicOrigin));
  // Keep one sandboxed wildcard route rooted at web/. With wildcard disabled,
  // Fastify snapshots the file list during startup; a refreshed HTML shell can
  // then reference newly deployed CSS, JS, or artwork that the running process
  // has no route for. The wildcard handler resolves each request against the
  // same fixed root, so atomic web asset updates become visible immediately.
  await app.register(staticPlugin, { root: cfg.webRoot, prefix: "/", wildcard: true, index: false, decorateReply: true });
  app.get("/", async (_req, reply) => reply.sendFile("index.html")); app.get("/login", async (_req, reply) => reply.sendFile("login.html")); app.get("/wife", async (_req, reply) => reply.sendFile("wife.html"));
  app.setNotFoundHandler(async (_req, reply) => reply.code(404).send({ error: "Not found." }));
  app.addHook("onClose", async () => { store.close(); database.close(); });
  return { app, database, store, config: cfg };
}
