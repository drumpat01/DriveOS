/**
 * oauth-spotify.ts - Cloudflare Worker Edge Handler
 * 
 * Stateless Spotify OAuth2 PKCE token exchange and refresh broker.
 * Operates on the Cloudflare Free Tier (100k requests/day).
 * Stores ZERO user tokens or state on the server.
 */

export interface SpotifyEnv {
  SPOTIFY_CLIENT_ID: string;
  SPOTIFY_CLIENT_SECRET?: string;
  ALLOWED_ORIGINS?: string;
}

export async function handleSpotifyTokenExchange(request: Request, env: SpotifyEnv): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await request.json() as {
      code?: string;
      code_verifier?: string;
      redirect_uri?: string;
      grant_type?: string;
      refresh_token?: string;
    };

    const grantType = body.grant_type || (body.refresh_token ? 'refresh_token' : 'authorization_code');
    const params = new URLSearchParams();
    params.set('grant_type', grantType);
    params.set('client_id', env.SPOTIFY_CLIENT_ID);

    if (grantType === 'authorization_code') {
      if (!body.code || !body.redirect_uri) {
        return new Response(JSON.stringify({ error: 'Missing code or redirect_uri' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      params.set('code', body.code);
      params.set('redirect_uri', body.redirect_uri);
      if (body.code_verifier) {
        params.set('code_verifier', body.code_verifier);
      }
    } else if (grantType === 'refresh_token') {
      if (!body.refresh_token) {
        return new Response(JSON.stringify({ error: 'Missing refresh_token' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      params.set('refresh_token', body.refresh_token);
    } else {
      return new Response(JSON.stringify({ error: 'Unsupported grant_type' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/x-www-form-urlencoded',
    };

    if (env.SPOTIFY_CLIENT_SECRET) {
      const basic = btoa(`${env.SPOTIFY_CLIENT_ID}:${env.SPOTIFY_CLIENT_SECRET}`);
      headers['Authorization'] = `Basic ${basic}`;
    }

    const spotifyRes = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers,
      body: params.toString(),
    });

    const data = await spotifyRes.text();
    return new Response(data, {
      status: spotifyRes.status,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || 'Internal Server Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
