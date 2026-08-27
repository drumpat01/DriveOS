import { jsonResponse, readBoundedJson, readBoundedResponseJson, stringField } from './http.ts';

type LastFmTrack = {
  name?: unknown;
  artist?: { '#text'?: unknown };
  album?: { '#text'?: unknown };
  url?: unknown;
  date?: { uts?: unknown };
  '@attr'?: { nowplaying?: unknown };
};

type LastFmResponse = {
  recenttracks?: { track?: LastFmTrack[] | LastFmTrack; '@attr'?: { totalPages?: unknown } };
  error?: unknown;
};

const USERNAME = /^[A-Za-z0-9_-]{1,32}$/;
const MAX_WINDOW_MS = 24 * 60 * 60_000 + 4 * 60_000;

function clean(value: unknown, maximum = 200) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, maximum) : '';
}

function cleanHttpsUrl(value: unknown) {
  const candidate = clean(value, 2_048);
  if (!candidate) return null;
  try { return new URL(candidate).protocol === 'https:' ? candidate : null; }
  catch { return null; }
}

async function limiterKey(username: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(username.toLowerCase()));
  return [...new Uint8Array(digest)].slice(0, 12).map(byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function handleLastFmHistory(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405, { Allow: 'POST', 'Cache-Control': 'no-store' });
  const body = await readBoundedJson(request);
  if (!body) return jsonResponse({ error: 'Invalid JSON body' }, 400, { 'Cache-Control': 'no-store' });
  const username = stringField(body, 'username');
  const from = Date.parse(stringField(body, 'from') ?? '');
  const to = Date.parse(stringField(body, 'to') ?? '');
  if (!username || !USERNAME.test(username) || !Number.isFinite(from) || !Number.isFinite(to) || from >= to || to - from > MAX_WINDOW_MS) {
    return jsonResponse({ error: 'Invalid Last.fm history window' }, 400, { 'Cache-Control': 'no-store' });
  }
  const apiKey = env.LASTFM_API_KEY?.trim();
  if (!apiKey || apiKey === 'replace-with-lastfm-api-key') {
    return jsonResponse({ error: 'Last.fm is not configured' }, 503, { 'Cache-Control': 'no-store' });
  }
  const allowed = await env.LASTFM_RATE_LIMITER.limit({ key: await limiterKey(username) });
  if (!allowed.success) return jsonResponse({ error: 'Try Last.fm again in a minute' }, 429, { 'Cache-Control': 'no-store', 'Retry-After': '60' });

  const tracks: { playedAt: string; track: string; artist: string; album: string | null; externalUrl: string | null }[] = [];
  const paddedFrom = Math.floor((from - 120_000) / 1_000);
  const paddedTo = Math.ceil((to + 120_000) / 1_000);
  for (let page = 1; page <= 5; page += 1) {
    const url = new URL('https://ws.audioscrobbler.com/2.0/');
    url.search = new URLSearchParams({ method: 'user.getRecentTracks', user: username, api_key: apiKey, format: 'json', from: String(paddedFrom), to: String(paddedTo), limit: '200', page: String(page) }).toString();
    const upstream = await fetch(url, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(10_000) });
    if (upstream.status === 429) return jsonResponse({ error: 'Last.fm is temporarily busy' }, 429, { 'Cache-Control': 'no-store', 'Retry-After': upstream.headers.get('retry-after') ?? '60' });
    const payload = await readBoundedResponseJson<LastFmResponse>(upstream);
    if (!upstream.ok || !payload || payload.error) return jsonResponse({ error: 'Last.fm history was unavailable' }, 502, { 'Cache-Control': 'no-store' });
    const pageTracks = payload.recenttracks?.track;
    const values = Array.isArray(pageTracks) ? pageTracks : pageTracks ? [pageTracks] : [];
    for (const value of values) {
      if (value['@attr']?.nowplaying) continue;
      const playedSeconds = Number(value.date?.uts);
      const track = clean(value.name), artist = clean(value.artist?.['#text']);
      if (!Number.isFinite(playedSeconds) || !track || !artist) continue;
      const playedAt = playedSeconds * 1_000;
      if (playedAt < from - 120_000 || playedAt > to + 120_000) continue;
      tracks.push({ playedAt: new Date(playedAt).toISOString(), track, artist, album: clean(value.album?.['#text']) || null, externalUrl: cleanHttpsUrl(value.url) });
    }
    const totalPages = Math.max(1, Number(payload.recenttracks?.['@attr']?.totalPages) || 1);
    if (page >= totalPages || values.length < 200) break;
  }
  tracks.sort((left, right) => Date.parse(left.playedAt) - Date.parse(right.playedAt));
  return jsonResponse({ tracks, attribution: 'Listening history supplied by Last.fm' }, 200, { 'Cache-Control': 'private, max-age=60' });
}
