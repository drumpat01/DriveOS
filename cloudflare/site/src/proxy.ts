const HOP_BY_HOP = new Set([
  "connection", "keep-alive", "proxy-authenticate", "proxy-authorization", "proxy-connection", "te", "trailer", "transfer-encoding", "upgrade"
]);

const STRIPPED_REQUEST_HEADERS = new Set(["tailscale-user-login", "x-journeydeck-test-auth"]);

export const RENDER_ORIGIN = "https://driveos.onrender.com";

export function assertProxyOrigin(raw: string) {
  let url: URL;
  try { url = new URL(raw); }
  catch { throw new Error("Proxy origin is not a valid URL."); }
  const host = url.hostname.toLowerCase();
  if (host === "journeydeck.me" || host.endsWith(".journeydeck.me")) throw new Error("Refusing to proxy to journeydeck.me.");
  const loopback = host === "127.0.0.1" || host === "localhost" || host === "::1";
  const render = url.protocol === "https:" && host === "driveos.onrender.com" && url.port === "";
  const local = (url.protocol === "http:" || url.protocol === "https:") && loopback;
  if (!render && !local) throw new Error("Proxy origin must be https://driveos.onrender.com.");
  if (url.username || url.password || (url.pathname !== "/" && url.pathname !== "") || url.search || url.hash) throw new Error("Proxy origin must not include credentials or a path.");
  return url;
}

export function proxyTarget(requestUrl: URL, origin: URL) {
  if (!requestUrl.pathname.startsWith("/") || requestUrl.pathname.includes("\\") || requestUrl.pathname.startsWith("//")) {
    throw new Error("Refusing to proxy a non-local path.");
  }
  const target = new URL(`${requestUrl.pathname}${requestUrl.search}`, origin);
  if (target.origin !== origin.origin) throw new Error("Refusing to proxy outside the Render origin.");
  return target;
}

function isDroppedRequestHeader(lower: string) {
  return HOP_BY_HOP.has(lower) || lower === "host" || STRIPPED_REQUEST_HEADERS.has(lower) || lower.startsWith("cf-") || lower === "cdn-loop" || lower === "x-real-ip";
}

export function forwardRequestHeaders(request: Request, target: URL) {
  const headers = new Headers();
  request.headers.forEach((value, name) => {
    if (isDroppedRequestHeader(name.toLowerCase())) return;
    headers.append(name, value);
  });
  const incoming = new URL(request.url);
  // Host is the Render origin. Proto and X-Forwarded-Host describe the request
  // the visitor made to this Worker, not the hop from the Worker to Render.
  headers.set("host", target.host);
  headers.set("x-forwarded-proto", incoming.protocol.replace(":", ""));
  headers.set("x-forwarded-host", request.headers.get("host") || incoming.host);
  // driveos.onrender.com is behind Cloudflare, so this fetch is cross-zone.
  // Cloudflare rewrites CF-Connecting-IP to the Worker egress address (for
  // example 2a06:98c0:3600::103), and Render appends its own X-Forwarded-For
  // hop. PR #302's one-hop rule therefore selects the Worker address, and
  // logins likely share one throttle bucket. Spoofing stays blocked. Appending
  // the inbound CF-Connecting-IP does not change which address that rule picks.
  // Do not set TRUST_PROXY=2. A request sent straight to Render could then spoof
  // its IP. The phase 2 fix is a signed header that #302 trusts, using a shared
  // key (a Worker secret and a Render env var). It needs Patrick's yes and is
  // not implemented here.
  const clientIp = request.headers.get("cf-connecting-ip");
  if (clientIp) {
    const prior = request.headers.get("x-forwarded-for");
    headers.set("x-forwarded-for", prior ? `${prior}, ${clientIp}` : clientIp);
  }
  return headers;
}

export function forwardResponseHeaders(source: Headers) {
  const headers = new Headers();
  source.forEach((value, name) => {
    const lower = name.toLowerCase();
    if (lower === "set-cookie" || HOP_BY_HOP.has(lower)) return;
    headers.append(name, value);
  });
  const cookies = typeof source.getSetCookie === "function" ? source.getSetCookie() : [];
  if (cookies.length) {
    for (const cookie of cookies) headers.append("set-cookie", cookie);
  } else {
    const single = source.get("set-cookie");
    if (single) headers.append("set-cookie", single);
  }
  return headers;
}

export async function proxyToRender(request: Request, origin: string, doFetch: typeof fetch = fetch) {
  let target: URL;
  try {
    const requestUrl = new URL(request.url);
    target = proxyTarget(requestUrl, assertProxyOrigin(origin));
  } catch (error) {
    const message = error instanceof Error ? error.message : "The origin could not be reached.";
    return new Response(JSON.stringify({ error: message }), { status: 502, headers: { "content-type": "application/json; charset=utf-8" } });
  }
  const method = request.method.toUpperCase();
  const hasBody = method !== "GET" && method !== "HEAD";
  const init: RequestInit & { duplex?: "half" } = {
    method,
    headers: forwardRequestHeaders(request, target),
    redirect: "manual",
    body: hasBody ? request.body : undefined
  };
  if (hasBody) init.duplex = "half";
  let upstream: Response;
  try { upstream = await doFetch(target, init); }
  catch { return new Response(JSON.stringify({ error: "The origin could not be reached." }), { status: 502, headers: { "content-type": "application/json; charset=utf-8" } }); }
  return new Response(upstream.body, { status: upstream.status, statusText: upstream.statusText, headers: forwardResponseHeaders(upstream.headers) });
}
