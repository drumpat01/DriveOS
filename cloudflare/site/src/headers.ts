// Header values copied from the live Fastify onSend hook and @fastify/static.
// HTML cache-control is exactly "public, max-age=0" with no must-revalidate.

export const SECURITY_HEADERS = {
  "content-security-policy": "default-src 'self'; style-src 'self' 'unsafe-inline' https://unpkg.com; script-src 'self' https://unpkg.com https://sdk.scdn.co https://open.spotify.com https://cloud.umami.is https://static.cloudflareinsights.com; connect-src 'self' https://tiles.openfreemap.org https://api.spotify.com https://*.spotify.com wss://*.spotify.com https://*.scdn.co https://gateway.umami.is https://cloudflareinsights.com; img-src 'self' data: blob: https://tiles.openfreemap.org https://i.scdn.co https://tools.launchllama.co; media-src blob: https://*.scdn.co https://*.spotify.com; font-src 'self' data: https://tiles.openfreemap.org; worker-src 'self' blob:; child-src blob:; object-src 'none'; frame-src https://open.spotify.com; frame-ancestors 'none'; form-action 'self'; base-uri 'self'; manifest-src 'self'",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "referrer-policy": "no-referrer",
  "permissions-policy": "autoplay=(self \"https://open.spotify.com\"), encrypted-media=(self \"https://open.spotify.com\"), camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=(), bluetooth=(), midi=(), magnetometer=(), gyroscope=(), accelerometer=()"
} as const;

export const HSTS = "max-age=31536000";

export const HOMEPAGE_LINKS = [
  "</.well-known/api-catalog>; rel=\"api-catalog\"",
  "</openapi.json>; rel=\"service-desc\"; type=\"application/vnd.oai.openapi+json\"",
  "</api-docs>; rel=\"service-doc\"; type=\"text/html\"",
  "</openapi.json>; rel=\"describedby\"; type=\"application/vnd.oai.openapi+json\""
].join(", ");

export const VERSIONED_IMMUTABLE = "public, max-age=31536000, immutable";

const versionedStaticPattern = /\.(?:css|js|mjs|map|png|jpe?g|gif|webp|svg|ico|avif|woff2?|ttf|otf|eot)$/i;

const mimeByExtension: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/vnd.microsoft.icon",
  ".gif": "image/gif",
  ".avif": "image/avif",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml",
  ".md": "text/markdown; charset=utf-8",
  ".webmanifest": "application/manifest+json",
  ".mp4": "video/mp4"
};

const headerNamesWeOwn = new Set([
  "cache-control",
  "content-security-policy",
  "content-type",
  "link",
  "permissions-policy",
  "referrer-policy",
  "strict-transport-security",
  "x-content-type-options",
  "x-frame-options",
  "x-robots-tag"
]);

export function extensionOf(path: string) {
  const clean = path.split("?")[0] || "";
  const dot = clean.lastIndexOf(".");
  return dot >= 0 ? clean.slice(dot).toLowerCase() : "";
}

export function mimeForPath(path: string) {
  return mimeByExtension[extensionOf(path)] || "";
}

export function versionedCache(url: URL) {
  return url.searchParams.has("v") && versionedStaticPattern.test(url.pathname);
}

export function applySecurityHeaders(headers: Headers) {
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) headers.set(name, value);
  headers.set("strict-transport-security", HSTS);
}

export function jsonResponse(status: number, body: unknown, extra?: HeadersInit) {
  const headers = new Headers(extra);
  headers.set("content-type", "application/json; charset=utf-8");
  applySecurityHeaders(headers);
  return new Response(JSON.stringify(body), { status, headers });
}

export function withOwnedHeaders(response: Response, mutate: (headers: Headers) => void) {
  const headers = new Headers();
  response.headers.forEach((value, name) => {
    if (headerNamesWeOwn.has(name.toLowerCase())) return;
    headers.append(name, value);
  });
  mutate(headers);
  applySecurityHeaders(headers);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
