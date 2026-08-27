/**
 * places-lookup.ts - Cloudflare Worker Edge Handler
 * 
 * Privacy-preserving reverse geocoding proxy to OpenStreetMap/Nominatim.
 * Fuzzes coordinates to a ~110m grid (3 decimal places) to protect user location
 * and enable 24-hour edge cache reuse.
 * Zero logs, zero analytics tracking on user locations.
 */

import { jsonResponse, readBoundedJson, stringField } from './http.ts';

const CITY_GRID_DECIMALS = 2;
const CITY_CACHE_SECONDS = 30 * 24 * 60 * 60;
const CITY_COORDINATE = /^-?\d{1,3}(?:\.\d{1,2})?$/;

export async function handlePlacesLookup(request: Request, env: Pick<Env, 'NOMINATIM_USER_AGENT'>, ctx: Pick<ExecutionContext, 'waitUntil'>): Promise<Response> {
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405, { Allow: 'POST' });
  }

  const body = await readBoundedJson(request, 1_024);
  const latStr = body ? stringField(body, 'lat') : null;
  const lngStr = body ? stringField(body, 'lng') : null;

  if (!latStr || !lngStr || !CITY_COORDINATE.test(latStr) || !CITY_COORDINATE.test(lngStr)) {
    return jsonResponse({ error: 'Coordinates must already be reduced to two decimal places' }, 400, { 'Cache-Control': 'no-store' });
  }

  const rawLat = parseFloat(latStr);
  const rawLng = parseFloat(lngStr);

  if (!Number.isFinite(rawLat) || !Number.isFinite(rawLng) || rawLat < -90 || rawLat > 90 || rawLng < -180 || rawLng > 180) {
    return jsonResponse({ error: 'Invalid coordinate bounds' }, 400, { 'Cache-Control': 'no-store' });
  }

  // Defense in depth: the iPhone reduces precision before transmission, and the
  // edge enforces the same city-level grid before calling the upstream service.
  const fuzzedLat = rawLat.toFixed(CITY_GRID_DECIMALS);
  const fuzzedLng = rawLng.toFixed(CITY_GRID_DECIMALS);
  const cacheKey = new Request(`https://journeydeck-city-cache.invalid/${fuzzedLat}/${fuzzedLng}`);
  const cached = await caches.default.match(cacheKey);
  if (cached) return cached;

  const nominatimUrl = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${fuzzedLat}&lon=${fuzzedLng}&zoom=10&addressdetails=1&accept-language=en`;
  const userAgent = env.NOMINATIM_USER_AGENT || 'JourneyDeck-Edge/1.7 (contact@journeydeck.app)';

  try {
    const geoRes = await fetch(nominatimUrl, {
      method: 'GET',
      headers: {
        'User-Agent': userAgent,
        'Accept': 'application/json',
      },
      cf: {
        cacheTtl: CITY_CACHE_SECONDS,
        cacheEverything: true,
      },
      signal: AbortSignal.timeout(8_000),
    });

    if (!geoRes.ok) {
      return jsonResponse({ error: 'Upstream geocoding service unavailable' }, 502, { 'Cache-Control': 'no-store', 'Retry-After': '60' });
    }

    const payload = await geoRes.json() as {
      name?: string;
      display_name?: string;
      address?: {
        city?: string;
        town?: string;
        village?: string;
        hamlet?: string;
        suburb?: string;
        county?: string;
        state?: string;
        country?: string;
      };
    };

    const addr = payload.address || {};
    const city = addr.city || addr.town || addr.village || addr.suburb || addr.hamlet || addr.county || 'Local Area';
    const state = addr.state || '';
    const country = addr.country || '';

    const label = state ? `${city}, ${state}` : `${city}, ${country}`;

    const response = jsonResponse({
      city,
      state,
      country,
      label,
      attribution: '© OpenStreetMap contributors',
    }, 200, { 'Cache-Control': `public, max-age=${CITY_CACHE_SECONDS}, s-maxage=${CITY_CACHE_SECONDS}` });
    ctx.waitUntil(caches.default.put(cacheKey, response.clone()));
    return response;
  } catch {
    return jsonResponse({ error: 'Geocoding request failed' }, 502, { 'Cache-Control': 'no-store', 'Retry-After': '60' });
  }
}
