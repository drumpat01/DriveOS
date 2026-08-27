/**
 * places-lookup.ts - Cloudflare Worker Edge Handler
 * 
 * Privacy-preserving reverse geocoding proxy to OpenStreetMap/Nominatim.
 * Fuzzes coordinates to a ~110m grid (3 decimal places) to protect user location
 * and enable 24-hour edge cache reuse.
 * Zero logs, zero analytics tracking on user locations.
 */

export interface PlacesEnv {
  NOMINATIM_USER_AGENT?: string;
}

export async function handlePlacesLookup(request: Request, env: PlacesEnv): Promise<Response> {
  if (request.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const url = new URL(request.url);
  const latStr = url.searchParams.get('lat');
  const lngStr = url.searchParams.get('lng');

  if (!latStr || !lngStr) {
    return new Response(JSON.stringify({ error: 'Missing lat or lng query parameters' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const rawLat = parseFloat(latStr);
  const rawLng = parseFloat(lngStr);

  if (isNaN(rawLat) || isNaN(rawLng) || rawLat < -90 || rawLat > 90 || rawLng < -180 || rawLng > 180) {
    return new Response(JSON.stringify({ error: 'Invalid coordinate bounds' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Fuzz to 3 decimal places (~110m grid) for privacy and edge cache efficiency
  const fuzzedLat = rawLat.toFixed(3);
  const fuzzedLng = rawLng.toFixed(3);

  const nominatimUrl = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${fuzzedLat}&lon=${fuzzedLng}&zoom=14&addressdetails=1`;
  const userAgent = env.NOMINATIM_USER_AGENT || 'JourneyDeck-Edge/1.6 (contact@journeydeck.app)';

  try {
    const geoRes = await fetch(nominatimUrl, {
      method: 'GET',
      headers: {
        'User-Agent': userAgent,
        'Accept': 'application/json',
      },
      // Cache this at the Cloudflare edge for 24 hours (86,400 seconds)
      cf: {
        cacheTtl: 86400,
        cacheEverything: true,
      },
    } as any);

    if (!geoRes.ok) {
      return new Response(JSON.stringify({ error: 'Upstream geocoding service unavailable' }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      });
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

    return new Response(JSON.stringify({
      city,
      state,
      country,
      label,
      fuzzedLat: parseFloat(fuzzedLat),
      fuzzedLng: parseFloat(fuzzedLng),
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=86400, s-maxage=86400',
      },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || 'Geocoding request failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
