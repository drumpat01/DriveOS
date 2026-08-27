/**
 * index.ts - Cloudflare Worker Entry Point
 * 
 * Main edge router for JourneyDeck serverless utilities.
 * Handles CORS, route matching, and dispatches to sub-handlers.
 */

import { handleSpotifyConfig, handleSpotifyTokenExchange } from './oauth-spotify.ts';
import { handleTessieVerification } from './oauth-tessie.ts';
import { handlePlacesLookup } from './places-lookup.ts';
import { handleLastFmHistory } from './lastfm-history.ts';
import { jsonResponse } from './http.ts';

const CORS_HEADERS = {
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-JourneyDeck-Version',
};

function allowedOrigin(request: Request, env: Env): string | null {
  const origin = request.headers.get('Origin');
  if (!origin) return null;
  const allowed = (env.ALLOWED_ORIGINS ?? '').split(',').map(value => value.trim()).filter(Boolean);
  return allowed.includes(origin) ? origin : null;
}

function addCors(response: Response, origin: string | null): Response {
  const newHeaders = new Headers(response.headers);
  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    newHeaders.set(key, value);
  }
  if (origin) newHeaders.set('Access-Control-Allow-Origin', origin);
  newHeaders.set('Vary', 'Origin');
  newHeaders.set('Referrer-Policy', 'no-referrer');
  newHeaders.set('X-Content-Type-Options', 'nosniff');
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const startedAt = Date.now();
    const requestId = crypto.randomUUID();
    const path = new URL(request.url).pathname;
    const requestOrigin = request.headers.get('Origin');
    const corsOrigin = allowedOrigin(request, env);
    if (requestOrigin && !corsOrigin) {
      return addCors(jsonResponse({ error: 'Origin not allowed', requestId }, 403), null);
    }

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: { ...CORS_HEADERS, ...(corsOrigin ? { 'Access-Control-Allow-Origin': corsOrigin } : {}), 'Vary': 'Origin' },
      });
    }

    let response: Response;
    try {
      if (path === '/health' || path === '/readyz') {
        response = jsonResponse({ status: 'healthy', runtime: 'cloudflare-worker', environment: env.ENVIRONMENT, time: new Date().toISOString() });
      } else if (path === '/api/auth/spotify/config') {
        response = handleSpotifyConfig(request, env);
      } else if (path === '/api/auth/spotify/token' || path === '/api/auth/spotify/refresh') {
        response = await handleSpotifyTokenExchange(request, env);
      } else if (path === '/api/music/lastfm/recent') {
        response = await handleLastFmHistory(request, env);
      } else if (path === '/api/auth/tessie/verify') {
        response = await handleTessieVerification(request);
      } else if (path === '/api/places/reverse') {
        response = await handlePlacesLookup(request, env, ctx);
      } else {
        response = jsonResponse({ error: 'Not Found', requestId }, 404);
      }
    } catch {
      response = jsonResponse({ error: 'Edge request failed', requestId }, 500, { 'Cache-Control': 'no-store' });
    }
    const finalResponse = addCors(response, corsOrigin);
    finalResponse.headers.set('X-JourneyDeck-Request-Id', requestId);
    console.log(JSON.stringify({ event: 'edge_request', requestId, method: request.method, path, status: finalResponse.status, durationMs: Date.now() - startedAt }));
    return finalResponse;
  },
} satisfies ExportedHandler<Env>;
