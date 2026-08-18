import { Readable } from "node:stream";
import type { FastifyReply, FastifyRequest } from "fastify";

const hop = new Set(["connection", "content-encoding", "content-length", "keep-alive", "proxy-authenticate", "proxy-authorization", "te", "trailer", "transfer-encoding", "upgrade"]);
const safeReadPostPaths = new Set(["/api/drive/map", "/api/drive/share-card", "/api/collections/attachments/list", "/api/collections/attachments/get", "/api/assistant/query"]);

export async function proxyLegacy(req: FastifyRequest, reply: FastifyReply, upstream: string, readOnly = true, forwardedOrigin = "") {
  if (!upstream) return reply.code(503).send({ error: "This API remains in the documented PowerShell compatibility boundary, but no local compatibility upstream is configured." });
  const requestPath = req.url.split("?")[0];
  if (readOnly && !["GET", "HEAD"].includes(req.method) && !req.url.startsWith("/api/auth/") && !safeReadPostPaths.has(requestPath)) return reply.code(503).send({ error: "The local compatibility adapter is read-only. This write was not sent to the production service." });
  const url = new URL(req.url, upstream), headers: Record<string, string> = {};
  for (const name of ["accept", "accept-language", "content-type", "cookie", "user-agent", "x-driveos-sync-token"]) { const value = req.headers[name]; if (value) headers[name] = String(value); }
  const trustedOrigin = new URL(upstream).origin;
  const trustedPublicUrl = new URL(forwardedOrigin || trustedOrigin);
  headers["x-forwarded-proto"] = trustedPublicUrl.protocol.slice(0, -1);
  headers["x-forwarded-host"] = trustedPublicUrl.host;
  if (req.headers.origin) headers.origin = trustedOrigin; if (req.headers.referer) headers.referer = `${trustedOrigin}/`;
  const body = ["GET", "HEAD"].includes(req.method) ? undefined : JSON.stringify(req.body ?? {});
  if (body !== undefined) headers["content-length"] = String(Buffer.byteLength(body));
  const response = await fetch(url, { method: req.method, headers, body, redirect: "manual", signal: AbortSignal.timeout(60_000) });
  for (const [name, value] of response.headers.entries()) if (!hop.has(name.toLowerCase()) && name.toLowerCase() !== "set-cookie") reply.header(name, value);
  const responseHeaders = response.headers as Headers & { getSetCookie?: () => string[] };
  const cookies = responseHeaders.getSetCookie?.() || (response.headers.get("set-cookie") ? [response.headers.get("set-cookie")!] : []);
  if (cookies.length) reply.header("set-cookie", cookies);
  reply.header("cache-control", "no-store").code(response.status);
  return reply.send(response.body ? Readable.fromWeb(response.body as any) : null);
}
