import { createHmac, timingSafeEqual } from "node:crypto";
import http from "node:http";
import https from "node:https";
import type { FastifyRequest } from "fastify";
import { legacyForwardingContext } from "./legacy-forwarding.js";

export type Principal = { subject: string; role: "owner" | "wife"; mode: "full" | "wife" };
const validationCache = new Map<string, { expires: number; principal: Principal }>();

function cookie(req: FastifyRequest, name: string) {
  return String(req.headers.cookie || "").split(";").map(value => value.trim()).find(value => value.startsWith(`${name}=`))?.slice(name.length + 1);
}

function base64url(value: string) { return Buffer.from(value, "base64url"); }

async function legacySession(upstream: string, publicOrigin: string, token: string) {
  const url = new URL("/api/auth/session", upstream), forwarding = legacyForwardingContext(upstream, publicOrigin);
  return new Promise<any>((resolve, reject) => {
    const transport = url.protocol === "https:" ? https : http;
    const outgoing = transport.request(url, { method: "GET", headers: { accept: "application/json", cookie: `DriveOSSession=${token}`, host: forwarding.destinationHost, "x-forwarded-host": forwarding.forwardedHost, "x-forwarded-proto": forwarding.forwardedProtocol } }, response => {
      let body = "";
      response.setEncoding("utf8");
      response.on("data", chunk => { body += chunk; if (body.length > 65_536) outgoing.destroy(new Error("Compatibility session response was too large.")); });
      response.on("end", () => {
        if ((response.statusCode || 500) < 200 || (response.statusCode || 500) >= 300) return resolve(null);
        try { resolve(JSON.parse(body)); } catch { resolve(null); }
      });
    });
    outgoing.setTimeout(5000, () => outgoing.destroy(new Error("Compatibility session validation timed out.")));
    outgoing.on("error", reject);
    outgoing.end();
  });
}

export function authenticateScheduledSync(req: FastifyRequest, expectedSecret: string) {
  const candidate = String(req.headers["x-driveos-sync-token"] || "");
  if (req.method !== "POST" || Buffer.byteLength(expectedSecret) < 32 || !candidate || Buffer.byteLength(candidate) > 512) return false;
  const provided = Buffer.from(candidate), expected = Buffer.from(expectedSecret);
  return provided.length === expected.length && timingSafeEqual(provided, expected);
}

export function authenticateRecorder(req: FastifyRequest, expectedToken: string) {
  const authorization = String(req.headers.authorization || "");
  const candidate = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if (Buffer.byteLength(expectedToken) < 32 || !candidate || Buffer.byteLength(candidate) > 512) return false;
  const provided = Buffer.from(candidate), expected = Buffer.from(expectedToken);
  return provided.length === expected.length && timingSafeEqual(provided, expected);
}

function localToken(token: string, secret: string): Principal | null {
  try {
    const [version, payload, signature] = token.split("."); if (version !== "v1" || !payload || !signature || Buffer.byteLength(secret) < 32) return null;
    const expected = createHmac("sha256", Buffer.from(secret, "base64")).update(`${version}.${payload}`).digest(), provided = base64url(signature);
    if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) return null;
    const data = JSON.parse(base64url(payload).toString("utf8")); const now = Math.floor(Date.now() / 1000);
    if (data.exp <= now || data.iat > now + 300 || !["owner", "wife"].includes(data.role) || !["full", "wife"].includes(data.mode)) return null;
    return { subject: String(data.sub), role: data.role, mode: data.mode };
  } catch { return null; }
}

export async function authenticate(req: FastifyRequest, options: { allowTestAuth: boolean; trustTailscaleHeaders: boolean; legacyUpstream: string; publicOrigin?: string; localSessionSecret?: string }): Promise<Principal | null> {
  if (options.allowTestAuth && ["owner", "wife"].includes(String(req.headers["x-journeydeck-test-auth"]))) { const role = String(req.headers["x-journeydeck-test-auth"]) as "owner" | "wife"; return { subject: "local-test", role, mode: role === "wife" ? "wife" : "full" }; }
  const tailscale = String(req.headers["tailscale-user-login"] || "").trim();
  if (options.trustTailscaleHeaders && tailscale && tailscale.length <= 512) return { subject: tailscale.toLowerCase(), role: "owner", mode: "full" };
  const token = cookie(req, "DriveOSSession"); if (!token) return null;
  if (options.localSessionSecret) { const principal = localToken(token, options.localSessionSecret); if (principal) return principal; }
  const cached = validationCache.get(token); if (cached && cached.expires > Date.now()) return cached.principal;
  if (!options.legacyUpstream) return null;
  try {
    const session = await legacySession(options.legacyUpstream, options.publicOrigin || "", token); if (!session?.authenticated || !["owner", "wife"].includes(session.role)) return null;
    const principal: Principal = { subject: String(session.email || "legacy-session"), role: session.role, mode: session.role === "wife" ? "wife" : "full" }; validationCache.set(token, { expires: Date.now() + 300_000, principal }); return principal;
  } catch { return null; }
}
