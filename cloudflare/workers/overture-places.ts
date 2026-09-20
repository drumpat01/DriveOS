import { jsonResponse, readBoundedJson, stringField } from './http.ts';

type PlaceEnv = { OVERTURE_ENABLED?: string; OVERTURE_RELEASE?: string; OVERTURE_CACHE_NAMESPACE?: string; ENVIRONMENT?: string; PUBLIC_PLACES?: R2Bucket };
type Manifest = { schema: number; release: string; country: string; bands: Record<string, { bytes: number; indexSha256: string }> };
const immutableHeaders = { 'Cache-Control': 'public, max-age=604800', 'Content-Type': 'application/json; charset=utf-8' };
const unavailable = () => jsonResponse({ error: 'Public place directory unavailable' }, 503, { 'Cache-Control': 'no-store', 'Retry-After': '300' });

async function publicJson<T>(bucket: R2Bucket, key: string, scope: string, ctx: Pick<ExecutionContext, 'waitUntil'>, maxBytes: number): Promise<T | null> {
  const cacheKey = new Request(`https://journeydeck-public-places.invalid/${scope}/${key}`);
  const cached = await caches.default.match(cacheKey);
  if (cached) return await cached.json() as T;
  const object = await bucket.get(key);
  if (!object || object.size > maxBytes) return null;
  const text = await object.text();
  const data = JSON.parse(text) as T;
  ctx.waitUntil(caches.default.put(cacheKey, new Response(text, { headers: immutableHeaders })));
  return data;
}

/** Read-only public directory: no account token, exact coordinates, history,
 * arbitrary keys, uploads, or user records are accepted by this endpoint. */
export async function handleOverturePlaces(request: Request, env: PlaceEnv, ctx: Pick<ExecutionContext, 'waitUntil'>): Promise<Response> {
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405, { Allow: 'POST' });
  const body = await readBoundedJson(request, 128);
  const tile = body ? stringField(body, 'tile') : null;
  if (!body || Object.keys(body).length !== 1 || !tile || !/^(0|[1-9]\d{0,3})_(0|[1-9]\d{0,4})$/.test(tile)) {
    return jsonResponse({ error: 'A public area tile ID is required' }, 400, { 'Cache-Control': 'no-store' });
  }
  const [y, x] = tile.split('_').map(Number);
  if (y >= 9000 || x >= 18000) return jsonResponse({ error: 'Invalid public area' }, 400, { 'Cache-Control': 'no-store' });
  const release = env.OVERTURE_RELEASE ?? '';
  if (env.OVERTURE_ENABLED !== 'true' || !env.PUBLIC_PLACES || !/^20\d\d-\d\d-\d\d\.\d+$/.test(release)) return unavailable();
  const root = `us/v1/${release}`;
  // Separate canary/national data and environments, including after deployments.
  const scope = `${env.ENVIRONMENT ?? 'unknown'}/${env.OVERTURE_CACHE_NAMESPACE ?? 'national-v1'}`;
  try {
    const manifest = await publicJson<Manifest>(env.PUBLIC_PLACES, `${root}/manifest.json`, scope, ctx, 128_000);
    if (!manifest || manifest.schema !== 1 || manifest.release !== release || manifest.country !== 'US' || !manifest.bands) return unavailable();
    const band = String(Math.floor(y / 50));
    const empty = () => jsonResponse({ schema: 1, release, tile, places: [] }, 200, { 'Cache-Control': 'no-store' });
    if (!Object.hasOwn(manifest.bands, band)) return empty();
    const index = await publicJson<Record<string, [number, number]>>(env.PUBLIC_PLACES, `${root}/bands/${band}.json`, scope, ctx, 4_000_000);
    if (!index) return unavailable();
    if (!Object.hasOwn(index, tile)) return empty();
    const [offset, length] = index[tile];
    if (!Number.isSafeInteger(offset) || offset < 0 || !Number.isSafeInteger(length) || length < 1 || length > 4_000_000
      || offset + length > manifest.bands[band].bytes) return unavailable();
    const cacheKey = new Request(`https://journeydeck-public-places.invalid/${scope}/${root}/tiles/${tile}`);
    const cached = await caches.default.match(cacheKey);
    if (cached) return cached;
    const object = await env.PUBLIC_PLACES.get(`${root}/bands/${band}.bin`, { range: { offset, length } });
    if (!object) return unavailable();
    // Decode this one member before entering the edge cache. Cloudflare can
    // then negotiate gzip/Brotli normally, without re-encoding stored gzip.
    const response = new Response(object.body.pipeThrough(new DecompressionStream('gzip')), { headers: immutableHeaders });
    ctx.waitUntil(caches.default.put(cacheKey, response.clone()));
    return response;
  } catch {
    return unavailable();
  }
}
