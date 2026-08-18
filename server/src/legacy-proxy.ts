import { Readable } from "node:stream";
import type { FastifyReply, FastifyRequest } from "fastify";

const hop = new Set(["connection", "content-encoding", "content-length", "keep-alive", "proxy-authenticate", "proxy-authorization", "te", "trailer", "transfer-encoding", "upgrade"]);
const safeReadPostPaths = new Set(["/api/drive/map", "/api/drive/share-card", "/api/collections/attachments/list", "/api/collections/attachments/get", "/api/assistant/query"]);

export async function proxyLegacy(req: FastifyRequest, reply: FastifyReply, upstream: string, readOnly = true) {
  if (!upstream) return reply.code(503).send({ error: "This API remains in the documented PowerShell compatibility boundary, but no local compatibility upstream is configured." });
  const requestPath = req.url.split("?")[0];
  if (readOnly && !["GET", "HEAD"].includes(req.method) && !req.url.startsWith("/api/auth/") && !safeReadPostPaths.has(requestPath)) return reply.code(503).send({ error: "The local compatibility adapter is read-only. This write was not sent to the production service." });
  const url = new URL(req.url, upstream), headers = new Headers();
  for (const name of ["accept", "accept-language", "content-type", "cookie", "user-agent"]) { const value = req.headers[name]; if (value) headers.set(name, String(value)); }
  headers.set("x-forwarded-proto", "https"); headers.set("x-forwarded-host", String(req.headers.host || "journeydeck.local"));
  if (req.headers.origin) headers.set("origin", new URL(upstream).origin); if (req.headers.referer) headers.set("referer", `${new URL(upstream).origin}/`);
  const body = ["GET", "HEAD"].includes(req.method) ? undefined : JSON.stringify(req.body ?? {});
  const response = await fetch(url, { method: req.method, headers, body, redirect: "manual", signal: AbortSignal.timeout(60_000) });
  for (const [name, value] of response.headers) if (!hop.has(name.toLowerCase()) && name.toLowerCase() !== "set-cookie") reply.header(name, value);
  const cookies = response.headers.getSetCookie?.() || []; if (cookies.length) reply.header("set-cookie", cookies);
  reply.header("cache-control", "no-store").code(response.status);
  if (!response.body) return reply.send(); return reply.send(Readable.fromWeb(response.body as any));
}
