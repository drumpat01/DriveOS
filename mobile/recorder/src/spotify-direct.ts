import Constants from 'expo-constants';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { Linking } from 'react-native';

import { requestExternalProviderJson, requestPrivacyEdgeJson } from './network-request';
import { getSession, recentCompletedSessionIds, saveImportedMusicForCompletedSession } from './storage';

const TOKEN_KEY = 'journeydeck.music.spotify.owner-token.v1';
const PENDING_KEY = 'journeydeck.music.spotify.owner-pkce.v1';
const secureOptions: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY };

type SpotifyToken = { accessToken: string; refreshToken: string; expiresAt: number };
type SpotifyPending = { state: string; verifier: string; redirectUri: string; createdAt: number };
type SpotifyTokenResponse = { access_token?: unknown; refresh_token?: unknown; expires_in?: unknown };
type SpotifyRecentResponse = {
  items?: { played_at?: unknown; track?: { name?: unknown; duration_ms?: unknown; album?: { name?: unknown; images?: { url?: unknown }[] }; artists?: { name?: unknown }[]; external_urls?: { spotify?: unknown } } }[];
  next?: unknown;
};

function edgeUrl() {
  const edge = Constants.expoConfig?.extra?.edge as { url?: unknown } | undefined;
  return typeof edge?.url === 'string' && /^https:\/\//.test(edge.url) ? edge.url.replace(/\/$/, '') : null;
}

function text(value: unknown, maximum = 200) { return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, maximum) : ''; }
function httpsUrl(value: unknown) {
  const candidate = text(value, 2_048);
  if (!candidate) return null;
  try { return new URL(candidate).protocol === 'https:' ? candidate : null; }
  catch { return null; }
}

async function loadToken() {
  try {
    const raw = await SecureStore.getItemAsync(TOKEN_KEY, secureOptions);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SpotifyToken;
    return parsed.accessToken && parsed.refreshToken && Number.isFinite(parsed.expiresAt) ? parsed : null;
  } catch { return null; }
}

async function saveToken(payload: SpotifyTokenResponse, priorRefreshToken = '') {
  const accessToken = text(payload.access_token, 4_096), refreshToken = text(payload.refresh_token, 4_096) || priorRefreshToken;
  const expiresIn = Number(payload.expires_in);
  if (!accessToken || !refreshToken || !Number.isFinite(expiresIn)) throw new Error('Spotify did not return a complete connection.');
  const token = { accessToken, refreshToken, expiresAt: Date.now() + Math.max(60, expiresIn) * 1_000 } satisfies SpotifyToken;
  await SecureStore.setItemAsync(TOKEN_KEY, JSON.stringify(token), secureOptions);
  return token;
}

export async function spotifyDirectStatus() { return (await loadToken()) ? 'connected' as const : 'not_connected' as const; }

export async function beginSpotifyDirectConnection() {
  const edge = edgeUrl();
  if (!edge) throw new Error('JourneyDeck privacy edge is not configured.');
  const config = await requestPrivacyEdgeJson<{ clientId: string; redirectUri: string }>(edge, '/api/auth/spotify/config', {}, { reason: 'external_import', operation: 'Spotify owner connection' });
  const state = Crypto.randomUUID().replaceAll('-', ''), verifier = `${Crypto.randomUUID()}${Crypto.randomUUID()}${Crypto.randomUUID()}`.replaceAll('-', '');
  const challenge = (await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, verifier, { encoding: Crypto.CryptoEncoding.BASE64 })).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
  await SecureStore.setItemAsync(PENDING_KEY, JSON.stringify({ state, verifier, redirectUri: config.redirectUri, createdAt: Date.now() } satisfies SpotifyPending), secureOptions);
  const authorize = new URL('https://accounts.spotify.com/authorize');
  authorize.search = new URLSearchParams({ response_type: 'code', client_id: config.clientId, scope: 'user-read-recently-played', redirect_uri: config.redirectUri, state, code_challenge_method: 'S256', code_challenge: challenge }).toString();
  await Linking.openURL(authorize.toString());
}

export async function finishSpotifyDirectConnection(callbackUrl: string) {
  if (!callbackUrl.startsWith('journeydeck-recorder://spotify-callback')) return false;
  const callback = new URL(callbackUrl), raw = await SecureStore.getItemAsync(PENDING_KEY, secureOptions);
  if (!raw) throw new Error('The Spotify connection request expired. Try again.');
  const pending = JSON.parse(raw) as SpotifyPending;
  await SecureStore.deleteItemAsync(PENDING_KEY, secureOptions);
  if (Date.now() - pending.createdAt > 10 * 60_000 || callback.searchParams.get('state') !== pending.state) throw new Error('Spotify returned an invalid connection state.');
  const code = callback.searchParams.get('code');
  if (!code || callback.searchParams.get('error')) throw new Error('Spotify access was not approved.');
  const edge = edgeUrl();
  if (!edge) throw new Error('JourneyDeck privacy edge is not configured.');
  const payload = await requestPrivacyEdgeJson<SpotifyTokenResponse>(edge, '/api/auth/spotify/token', { grant_type: 'authorization_code', code, code_verifier: pending.verifier, redirect_uri: pending.redirectUri }, { reason: 'external_import', operation: 'Spotify owner connection', timeoutMs: 15_000 });
  await saveToken(payload);
  return true;
}

async function usableToken() {
  const token = await loadToken();
  if (!token) throw new Error('Connect the owner Spotify account first.');
  if (token.expiresAt > Date.now() + 60_000) return token;
  const edge = edgeUrl();
  if (!edge) throw new Error('JourneyDeck privacy edge is not configured.');
  const refreshed = await requestPrivacyEdgeJson<SpotifyTokenResponse>(edge, '/api/auth/spotify/refresh', { grant_type: 'refresh_token', refresh_token: token.refreshToken }, { reason: 'external_import', operation: 'Spotify owner token refresh', timeoutMs: 15_000 });
  return saveToken(refreshed, token.refreshToken);
}

export async function syncSpotifyDirectSession(sessionId: string) {
  const session = getSession(sessionId);
  if (!session?.ended_at || session.status !== 'completed') throw new Error('That journey has not finished.');
  let token = await usableToken();
  const start = Date.parse(session.started_at) - 120_000, end = Date.parse(session.ended_at) + 120_000;
  let next: string | null = `https://api.spotify.com/v1/me/player/recently-played?limit=50&before=${Math.max(0, end)}`;
  const tracks: Parameters<typeof saveImportedMusicForCompletedSession>[2] = [];
  for (let page = 0; page < 5 && next; page += 1) {
    let payload: SpotifyRecentResponse;
    try { payload = await requestExternalProviderJson<SpotifyRecentResponse>(next, token.accessToken, { operation: 'Spotify owner history import' }); }
    catch (error) {
      if ((error as { status?: number }).status !== 401 || page > 0) throw error;
      token = { ...token, expiresAt: 0 };
      await SecureStore.setItemAsync(TOKEN_KEY, JSON.stringify(token), secureOptions);
      token = await usableToken();
      payload = await requestExternalProviderJson<SpotifyRecentResponse>(next, token.accessToken, { operation: 'Spotify owner history import' });
    }
    const items = Array.isArray(payload.items) ? payload.items : [];
    for (const item of items) {
      const playedAt = Date.parse(text(item.played_at));
      const track = text(item.track?.name), artist = text(item.track?.artists?.[0]?.name);
      if (!Number.isFinite(playedAt) || playedAt < start || playedAt > end || !track || !artist) continue;
      tracks.push({ playedAt: new Date(playedAt).toISOString(), track, artist, album: text(item.track?.album?.name) || null,
        durationMs: Number.isFinite(Number(item.track?.duration_ms)) ? Number(item.track?.duration_ms) : null,
        artworkUrl: httpsUrl(item.track?.album?.images?.[0]?.url), externalUrl: httpsUrl(item.track?.external_urls?.spotify) });
    }
    const candidate = httpsUrl(payload.next);
    const oldest = Math.min(...items.map(item => Date.parse(text(item.played_at))).filter(Number.isFinite));
    next = candidate && Number.isFinite(oldest) && oldest >= start ? candidate : null;
  }
  return saveImportedMusicForCompletedSession(sessionId, 'spotify', tracks);
}

export async function syncRecentSpotifyDirectNow() {
  const sessions = recentCompletedSessionIds(5);
  let matchedTracks = 0, succeeded = 0;
  for (const sessionId of sessions) {
    matchedTracks += await syncSpotifyDirectSession(sessionId);
    succeeded += 1;
  }
  return { attempted: sessions.length, succeeded, matchedTracks };
}

export function syncSpotifyDirectSessionBestEffort(sessionId: string) { return syncSpotifyDirectSession(sessionId).catch(() => 0); }
