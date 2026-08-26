/**
 * index.ts - Cloudflare Worker Entry Point
 * 
 * Main edge router for JourneyDeck serverless utilities.
 * Handles CORS, route matching, and dispatches to sub-handlers.
 */

import { handleSpotifyTokenExchange, SpotifyEnv } from './oauth-spotify';
import { handleTessieVerification, TessieEnv } from './oauth-tessie';
import { handlePlacesLookup, PlacesEnv } from './places-lookup';

export interface Env extends SpotifyEnv, TessieEnv, PlacesEnv {
  ENVIRONMENT?: string;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-JourneyDeck-Version',
};

function addCors(response: Response): Response {
  const newHeaders = new Headers(response.headers);
  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    newHeaders.set(key, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
}

export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: CORS_HEADERS,
      });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    let response: Response;

    if (path === '/health' || path === '/readyz') {
      response = new Response(JSON.stringify({ status: 'healthy', runtime: 'cloudflare-worker', time: new Date().toISOString() }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } else if (path === '/api/auth/spotify/token' || path === '/api/auth/spotify/refresh') {
      response = await handleSpotifyTokenExchange(request, env);
    } else if (path === '/api/auth/tessie/verify') {
      response = await handleTessieVerification(request, env);
    } else if (path === '/api/places/reverse') {
      response = await handlePlacesLookup(request, env);
    } else {
      response = new Response(JSON.stringify({ error: 'Not Found', path }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return addCors(response);
  },
};
