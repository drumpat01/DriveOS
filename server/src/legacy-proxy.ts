import http, { type IncomingMessage } from "node:http";
import https from "node:https";
import type { FastifyReply, FastifyRequest } from "fastify";

const hop = new Set(["connection", "content-encoding", "content-length", "keep-alive", "proxy-authenticate", "proxy-authorization", "te", "trailer", "transfer-encoding", "upgrade"]);
const safeReadPostPaths = new Set(["/api/drive/map", "/api/drive/share-card", "/api/collections/attachments/list", "/api/collections/attachments/get", "/api/assistant/query"]);

export async function proxyLegacy(req: FastifyRequest, reply: FastifyReply, upstream: string, readOnly = true, forwardedOrigin = "") {
  if (!upstream) return reply.code(503).send({ error: "This API remains in the documented PowerShell compatibility boundary, but no local compatibility upstream is configured." });
  const requestPath = req.url.split("?")[0];
  if (readOnly && !["GET", "HEAD"].includes(req.method) && !req.url.startsWith("/api/auth/") && !safeReadPostPaths.has(requestPath)) return reply.code(503).send({ error: "The local compatibility adapter is read-only. This write was not sent to the production service." });
  const url = new URL(req.url, upstream), headers: Record<string, string> = {};
  for (const name of ["accept", "accept-language", "content-type", "cookie", "user-agent"]) { const value = req.headers[name]; if (value) headers[name] = String(value); }
  const trustedOrigin = forwardedOrigin || new URL(upstream).origin;
  const trustedPublicUrl = new URL(trustedOrigin);
  headers.host = trustedPublicUrl.host;
  headers["x-forwarded-proto"] = trustedPublicUrl.protocol.slice(0, -1);
  headers["x-forwarded-host"] = trustedPublicUrl.host;
  if (req.headers.origin) headers.origin = trustedOrigin; if (req.headers.referer) headers.referer = `${trustedOrigin}/`;
  const body = ["GET", "HEAD"].includes(req.method) ? undefined : JSON.stringify(req.body ?? {});
  if (body !== undefined) headers["content-length"] = String(Buffer.byteLength(body));
  const response = await new Promise<IncomingMessage>((resolve, reject) => {
    const transport = url.protocol === "https:" ? https : http;
    const outgoing = transport.request(url, { method: req.method, headers }, resolve);
    outgoing.setTimeout(60_000, () => outgoing.destroy(new Error("Compatibility upstream timed out.")));
    outgoing.on("error", reject);
    outgoing.end(body);
  });
  for (const [name, value] of Object.entries(response.headers)) if (value !== undefined && !hop.has(name.toLowerCase()) && name.toLowerCase() !== "set-cookie") reply.header(name, value);
  const cookies = response.headers["set-cookie"] || []; if (cookies.length) reply.header("set-cookie", cookies);
  reply.header("cache-control", "no-store").code(response.statusCode || 502);
  return reply.send(response);
}
