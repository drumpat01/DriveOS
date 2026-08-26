/**
 * oauth-tessie.ts - Cloudflare Worker Edge Handler
 * 
 * Stateless Tessie API token verification broker.
 * Operates on the Cloudflare Free Tier with zero server storage.
 */

export interface TessieEnv {
  ALLOWED_ORIGINS?: string;
}

export async function handleTessieVerification(request: Request, _env: TessieEnv): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await request.json() as { apiKey?: string };
    if (!body.apiKey || typeof body.apiKey !== 'string' || body.apiKey.trim().length === 0) {
      return new Response(JSON.stringify({ error: 'Missing Tessie apiKey' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const cleanKey = body.apiKey.trim();

    // Verify token validity by requesting vehicles list from Tessie
    const tessieRes = await fetch('https://api.tessie.com/vehicles', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${cleanKey}`,
        'Accept': 'application/json',
      },
    });

    if (!tessieRes.ok) {
      return new Response(JSON.stringify({ 
        valid: false, 
        error: 'Invalid Tessie API Key or unauthorized access' 
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const payload = await tessieRes.json() as { results?: Array<{ vin?: string; display_name?: string }> };
    const vehicles = (payload.results || []).map(v => ({
      vin: v.vin || 'unknown',
      name: v.display_name || 'Tesla',
    }));

    return new Response(JSON.stringify({
      valid: true,
      vehicles,
      verifiedAt: new Date().toISOString(),
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || 'Internal Server Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
