import { jsonResponse } from './http.ts';

export type EdgeFeature = 'lastfm' | 'spotify' | 'tessie' | 'places';

const FEATURE_FLAG: Record<EdgeFeature, keyof Env> = {
  lastfm: 'LASTFM_ENABLED',
  spotify: 'SPOTIFY_ENABLED',
  tessie: 'TESSIE_ENABLED',
  places: 'PLACES_ENABLED',
};

export function enabled(value: unknown) {
  return value === true || (typeof value === 'string' && value.trim().toLowerCase() === 'true');
}

export function featureAvailable(env: Env, feature: EdgeFeature) {
  return enabled(env.EDGE_ENABLED) && enabled(env[FEATURE_FLAG[feature]]);
}

export function unavailableFeature(feature: EdgeFeature) {
  return jsonResponse({ error: `${feature[0]!.toUpperCase()}${feature.slice(1)} is temporarily unavailable` }, 503, {
    'Cache-Control': 'no-store',
    'Retry-After': '300',
  });
}

export function upstreamTimeout(env: Pick<Env, 'UPSTREAM_TIMEOUT_MS'>, fallbackMs: number) {
  const configured = Number(env.UPSTREAM_TIMEOUT_MS);
  return Number.isFinite(configured) ? Math.min(15_000, Math.max(2_000, Math.round(configured))) : fallbackMs;
}

export async function opaqueKey(...parts: string[]) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(parts.join('\u001f').toLowerCase()));
  return [...new Uint8Array(digest)].slice(0, 16).map(byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function enforceRateLimit(limiter: RateLimit, key: string, message: string, retryAfter = 60): Promise<Response | null> {
  const outcome = await limiter.limit({ key });
  return outcome.success ? null : jsonResponse({ error: message }, 429, {
    'Cache-Control': 'no-store',
    'Retry-After': String(retryAfter),
  });
}

export async function enforceGlobalRateLimit(request: Request, env: Env) {
  const clientAddress = request.headers.get('CF-Connecting-IP') ?? 'unknown-client';
  return enforceRateLimit(env.EDGE_RATE_LIMITER, await opaqueKey('edge', clientAddress), 'JourneyDeck private edge is busy. Try again shortly.');
}
