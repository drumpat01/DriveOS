/**
 * oauth-tessie.ts - Cloudflare Worker Edge Handler
 * 
 * Stateless Tessie API token verification broker.
 * Operates on the Cloudflare Free Tier with zero server storage.
 */

import { jsonResponse, readBoundedJson, stringField } from './http.ts';

export async function handleTessieVerification(request: Request): Promise<Response> {
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405, { Allow: 'POST', 'Cache-Control': 'no-store' });
  }

  try {
    const body = await readBoundedJson(request, 4_096);
    const cleanKey = body ? stringField(body, 'apiKey') : null;
    if (!cleanKey) return jsonResponse({ error: 'Missing Tessie apiKey' }, 400, { 'Cache-Control': 'no-store' });

    // Verify token validity by requesting vehicles list from Tessie
    const tessieRes = await fetch('https://api.tessie.com/vehicles', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${cleanKey}`,
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(10_000),
    });

    if (!tessieRes.ok) {
      return jsonResponse({
        valid: false, 
        error: 'Invalid Tessie API Key or unauthorized access' 
      }, 401, { 'Cache-Control': 'no-store' });
    }

    const payload = await tessieRes.json() as { results?: unknown[] };
    return jsonResponse({
      valid: true,
      vehicleCount: Array.isArray(payload.results) ? payload.results.length : 0,
    }, 200, { 'Cache-Control': 'no-store' });
  } catch {
    return jsonResponse({ error: 'Tessie verification failed' }, 502, { 'Cache-Control': 'no-store' });
  }
}
