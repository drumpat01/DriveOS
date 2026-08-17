import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { Readable } from "node:stream";
import { fileURLToPath, pathToFileURL } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const webRoot = path.join(projectRoot, "web");
const MAX_BODY_BYTES = 4 * 1024 * 1024;
const MIME = new Map([
  [".css", "text/css; charset=utf-8"], [".html", "text/html; charset=utf-8"],
  [".ico", "image/x-icon"], [".jpeg", "image/jpeg"], [".jpg", "image/jpeg"],
  [".js", "text/javascript; charset=utf-8"], [".json", "application/json; charset=utf-8"],
  [".map", "application/json; charset=utf-8"], [".png", "image/png"],
  [".svg", "image/svg+xml"], [".webmanifest", "application/manifest+json; charset=utf-8"],
  [".woff", "font/woff"], [".woff2", "font/woff2"]
]);
const HOP_HEADERS = new Set(["connection", "content-encoding", "content-length", "keep-alive", "proxy-authenticate", "proxy-authorization", "te", "trailer", "transfer-encoding", "upgrade"]);
const SESSION_COOKIE_NAME = "DriveOSSession";

function hasSessionCookie(req) {
  const cookie = String(req.headers.cookie || "");
  return cookie.split(";").some(part => part.trim().startsWith(`${SESSION_COOKIE_NAME}=`));
}

function securityHeaders(res) {
  res.setHeader("Content-Security-Policy", "default-src 'self'; style-src 'self' 'unsafe-inline' https://unpkg.com; script-src 'self' https://unpkg.com; connect-src 'self' https://journeydeck.me https://*.spotify.com https://tiles.openfreemap.org; img-src 'self' data: blob: https://tiles.openfreemap.org https://i.scdn.co; font-src 'self' data: https://tiles.openfreemap.org; worker-src 'self' blob:; child-src blob:; object-src 'none'; frame-src 'none'; frame-ancestors 'none'; form-action 'self'; base-uri 'self'; manifest-src 'self'");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
}

async function readBody(req) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > MAX_BODY_BYTES) throw Object.assign(new Error("Request too large"), { statusCode: 413 });
    chunks.push(chunk);
  }
  return chunks.length ? Buffer.concat(chunks) : undefined;
}

export function createBetaLiveProxyServer({ upstreamUrl = process.env.DRIVEOS_BETA_UPSTREAM || "https://journeydeck.me" } = {}) {
  const upstream = new URL(upstreamUrl);
  if (upstream.protocol !== "https:" && !["localhost", "127.0.0.1", "::1"].includes(upstream.hostname)) {
    throw new Error("Beta upstream must use HTTPS");
  }

  return http.createServer(async (req, res) => {
    securityHeaders(res);
    const requestUrl = new URL(req.url || "/", "http://beta.local");

    if (requestUrl.pathname === "/healthz") {
      res.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
      res.end(JSON.stringify({ ok: true, mode: "live-proxy" }));
      return;
    }

    if (requestUrl.pathname.startsWith("/api/") || requestUrl.pathname === "/auth/spotify/callback") {
      const started = Date.now();
      try {
        const target = new URL(`${requestUrl.pathname}${requestUrl.search}`, upstream);
        const headers = new Headers();
        for (const name of ["accept", "accept-language", "content-type", "cookie", "user-agent"]) {
          if (req.headers[name]) headers.set(name, String(req.headers[name]));
        }
        headers.set("x-forwarded-host", String(req.headers.host || "beta.journeydeck.me"));
        headers.set("x-forwarded-proto", "https");
        const forwardedFor = String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || "");
        if (forwardedFor) headers.set("x-forwarded-for", forwardedFor);
        if (req.headers.origin) headers.set("origin", upstream.origin);
        if (req.headers.referer) headers.set("referer", `${upstream.origin}/`);

        const body = ["GET", "HEAD"].includes(req.method || "GET") ? undefined : await readBody(req);
        const response = await fetch(target, {
          method: req.method,
          headers,
          body,
          redirect: "manual",
          signal: AbortSignal.timeout(60_000)
        });

        for (const [name, value] of response.headers) {
          if (!HOP_HEADERS.has(name.toLowerCase()) && name.toLowerCase() !== "set-cookie") res.setHeader(name, value);
        }
        const cookies = response.headers.getSetCookie?.() || [];
        if (cookies.length) res.setHeader("Set-Cookie", cookies);
        const location = response.headers.get("location");
        if (location) res.setHeader("Location", location.replace(upstream.origin, ""));
        res.setHeader("Cache-Control", "no-store");
        res.writeHead(response.status);
        if (response.body) {
          const responseStream = Readable.fromWeb(response.body);
          // An upstream timeout can arrive after headers have been forwarded.
          // Always consume the stream error so one slow API response cannot
          // terminate the entire local beta preview process.
          responseStream.on("error", () => {
            if (!res.destroyed) res.destroy();
          });
          res.on("close", () => {
            if (!responseStream.destroyed) responseStream.destroy();
          });
          responseStream.pipe(res);
        } else res.end();
        console.log(`${req.method} ${requestUrl.pathname} -> ${response.status} (${Date.now() - started}ms)`);
      } catch (error) {
        const status = error.statusCode || 502;
        res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
        res.end(JSON.stringify({ error: status === 413 ? error.message : "JourneyDeck live service is temporarily unavailable." }));
      }
      return;
    }

    // Production protects the application shell and redirects anonymous users
    // to sign in. The beta serves local frontend files, so it must reproduce
    // that boundary itself or the shell loads with every API request returning
    // 401 and no way to establish a beta-host session.
    if (
      req.method === "GET" &&
      ["/", "/index.html", "/wife", "/wife.html"].includes(requestUrl.pathname) &&
      !hasSessionCookie(req)
    ) {
      res.writeHead(302, { Location: "/login", "Cache-Control": "no-store" });
      res.end();
      return;
    }

    let pathname = requestUrl.pathname;
    if (pathname === "/") pathname = "/index.html";
    if (pathname === "/login") pathname = "/login.html";
    if (pathname === "/wife") pathname = "/wife.html";
    const baseRoot = pathname === "/driveos-icon-squircle.png" ? projectRoot : webRoot;
    const relative = pathname === "/driveos-icon-squircle.png" ? pathname.slice(1) : pathname.replace(/^\/+/, "");
    const filename = path.resolve(baseRoot, relative);
    if (filename !== baseRoot && !filename.startsWith(`${baseRoot}${path.sep}`)) {
      res.writeHead(403).end("Forbidden");
      return;
    }
    try {
      const stat = await fs.promises.stat(filename);
      if (!stat.isFile()) throw new Error("not a file");
      res.writeHead(200, { "Content-Type": MIME.get(path.extname(filename).toLowerCase()) || "application/octet-stream", "Cache-Control": "no-store" });
      fs.createReadStream(filename).pipe(res);
    } catch {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not found");
    }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const host = process.env.DRIVEOS_BETA_HOST || "0.0.0.0";
  const port = Number(process.env.DRIVEOS_BETA_PORT || process.env.PORT || 10000);
  createBetaLiveProxyServer().listen(port, host, () => console.log(`JourneyDeck beta live proxy listening on ${host}:${port}`));
}
