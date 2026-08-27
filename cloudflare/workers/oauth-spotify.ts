/**
 * oauth-spotify.ts - Cloudflare Worker Edge Handler
 * 
 * Stateless Spotify OAuth2 PKCE token exchange and refresh broker.
 * Operates on the Cloudflare Free Tier (100k requests/day).
 * Stores ZERO user tokens or state on the server.
 */

import { jsonResponse, readBoundedJson, readBoundedResponseJson, stringField } from './http.ts';

export function handleSpotifyConfig(request: Request, env: Env): Response {
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405, { Allow: 'POST', 'Cache-Control': 'no-store' });
  const clientId = env.SPOTIFY_CLIENT_ID?.trim();
  const redirectUri = env.SPOTIFY_REDIRECT_URIS.split(',').map(value => value.trim()).find(value => value.startsWith('journeydeck-recorder://'));
  if (!clientId || clientId === 'replace-with-spotify-client-id' || !redirectUri) return jsonResponse({ error: 'Spotify is not configured' }, 503, { 'Cache-Control': 'no-store' });
  return jsonResponse({ clientId, redirectUri }, 200, { 'Cache-Control': 'private, max-age=300' });
}

export async function handleSpotifyTokenExchange(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405, { Allow: 'POST', 'Cache-Control': 'no-store' });
  }

  try {
    const body = await readBoundedJson(request);
    if (!body) return jsonResponse({ error: 'Invalid JSON body' }, 400, { 'Cache-Control': 'no-store' });
    const allowed = await env.SPOTIFY_RATE_LIMITER.limit({ key: 'owner-token-broker' });
    if (!allowed.success) return jsonResponse({ error: 'Try Spotify again in a minute' }, 429, { 'Cache-Control': 'no-store', 'Retry-After': '60' });
    const clientId = env.SPOTIFY_CLIENT_ID?.trim();
    if (!clientId || clientId === 'replace-with-spotify-client-id') {
      return jsonResponse({ error: 'Spotify is not configured' }, 503, { 'Cache-Control': 'no-store' });
    }

    const refreshToken = stringField(body, 'refresh_token');
    const grantType = stringField(body, 'grant_type') || (refreshToken ? 'refresh_token' : 'authorization_code');
    const params = new URLSearchParams();
    params.set('grant_type', grantType);
    params.set('client_id', clientId);

    if (grantType === 'authorization_code') {
      const code = stringField(body, 'code');
      const verifier = stringField(body, 'code_verifier');
      const redirectUri = stringField(body, 'redirect_uri');
      const allowedRedirects = env.SPOTIFY_REDIRECT_URIS.split(',').map(value => value.trim()).filter(Boolean);
      if (!code || !verifier || !redirectUri || !allowedRedirects.includes(redirectUri)) {
        return jsonResponse({ error: 'Missing or unapproved PKCE authorization fields' }, 400, { 'Cache-Control': 'no-store' });
      }
      params.set('code', code);
      params.set('redirect_uri', redirectUri);
      params.set('code_verifier', verifier);
    } else if (grantType === 'refresh_token') {
      if (!refreshToken) {
        return jsonResponse({ error: 'Missing refresh_token' }, 400, { 'Cache-Control': 'no-store' });
      }
      params.set('refresh_token', refreshToken);
    } else {
      return jsonResponse({ error: 'Unsupported grant_type' }, 400, { 'Cache-Control': 'no-store' });
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/x-www-form-urlencoded',
    };

    const spotifyRes = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers,
      body: params.toString(),
      signal: AbortSignal.timeout(10_000),
    });

    const data = await readBoundedResponseJson<Record<string, unknown>>(spotifyRes, 65_536);
    if (!data) return jsonResponse({ error: 'Spotify returned an invalid token response' }, 502, { 'Cache-Control': 'no-store' });
    return jsonResponse(data, spotifyRes.status, { 'Cache-Control': 'no-store, no-cache, must-revalidate' });
  } catch {
    return jsonResponse({ error: 'Spotify token request failed' }, 502, { 'Cache-Control': 'no-store' });
  }
}
