import Constants from 'expo-constants';

import { requestPrivacyEdgeJson } from './network-request';
import { deleteProfileSecretAndOwnedLegacy, deleteProfileSecretForUser, loadProfileSecret, saveProfileSecretForUser } from './profile-secure-store';
import { getMembershipStatus } from '../modules/journeydeck-membership';
import { entitlementsForTestFlightMembership } from './membership-entitlements';
import { TESSIE_INTEGRATION_ENABLED, TESTFLIGHT_PLUS_UNLOCKED } from './release-features';
import { getCurrentUser } from './auth';
import { deleteAppCache, readAppCache, writeAppCache } from './storage';
import { clearTessieLocalData, readTessieLocalRoute, saveTessieLocalRoute, saveTessieLocalSnapshot } from './tessie-local-data';
import type { TessieDriveRoute, TessieDriveSnapshot, TessieSnapshot, TessieVehicleSnapshot } from './tessie-contract';
import { captureTessieJourneys } from './tessie-capture';
import { fetchTessieSnapshotAdaptive } from './tessie-window-sync';

const TESSIE_TOKEN_KEY = 'journeydeck.vehicle.tessie.token.v1';
const TESSIE_VERIFIED_VEHICLE_KEY = 'journeydeck.vehicle.tessie.verified-count.v1';
const AUTOMATIC_CAPTURE_KEY = 'tessie.automatic-capture.v1';
let automaticCaptureInFlight: Promise<void> | null = null;
let automaticCaptureProfileId: string | null = null;
const connectionRevisions = new Map<string, number>();
const syncs = new Map<string, { revision: number; task: Promise<TessieSnapshot> }>();
const credentialWrites = new Map<string, Promise<void>>();

/** A disconnect must run after any Keychain write already in progress. */
function mutateCredentials(profileId: string, work: () => Promise<void>): Promise<void> {
  const task = (credentialWrites.get(profileId) ?? Promise.resolve()).catch(() => undefined).then(work).finally(() => {
    if (credentialWrites.get(profileId) === task) credentialWrites.delete(profileId);
  });
  credentialWrites.set(profileId, task);
  return task;
}

function connectionContext() {
  const profileId = getCurrentUser().id;
  const revision = connectionRevisions.get(profileId) ?? 0;
  const current = () => getCurrentUser().id === profileId && (connectionRevisions.get(profileId) ?? 0) === revision;
  return { profileId, revision, current, check: () => {
    if (!current()) throw new Error('Tessie connection or profile changed. Refresh again.');
  } };
}

function invalidateConnection(profileId: string) {
  connectionRevisions.set(profileId, (connectionRevisions.get(profileId) ?? 0) + 1);
}

export type { TessieChargeSnapshot, TessieDriveRoute, TessieDriveSnapshot, TessieRoutePoint, TessieSnapshot, TessieVehicleSnapshot } from './tessie-contract';
export type TessieMediaSample = {
  available: boolean;
  sampledAt: string;
  reason?: 'no_active_vehicle' | 'no_track_metadata';
  isPlaying?: boolean;
  track?: string;
  artist?: string;
  album?: string | null;
  source?: string | null;
  station?: string | null;
  playbackStatus?: string | null;
  durationMs?: number | null;
  elapsedMs?: number | null;
};

function edgeUrl() {
  const edge = Constants.expoConfig?.extra?.edge as { url?: unknown } | undefined;
  return typeof edge?.url === 'string' && /^https:\/\//.test(edge.url) ? edge.url.replace(/\/$/, '') : null;
}

function validToken(value: string) { return /^\S{16,512}$/.test(value); }

async function storedToken() {
  try {
    const value = (await loadProfileSecret(TESSIE_TOKEN_KEY) ?? '').trim();
    return validToken(value) ? value : null;
  } catch { return null; }
}

async function storedVerifiedVehicleCount() {
  try {
    const count = Number(await loadProfileSecret(TESSIE_VERIFIED_VEHICLE_KEY));
    return Number.isInteger(count) && count > 0 && count <= 4 ? count : 0;
  } catch { return 0; }
}

async function paidTessieAccess() {
  if (!TESSIE_INTEGRATION_ENABLED) return false;
  try { return entitlementsForTestFlightMembership(await getMembershipStatus(), TESTFLIGHT_PLUS_UNLOCKED, true).tessieAccess; }
  catch { return false; }
}

async function invalidateExpiredConnection(error: unknown, profileId: string) {
  if (error instanceof Error && error.message === 'Tessie access was not authorized') {
    await deleteProfileSecretForUser(TESSIE_VERIFIED_VEHICLE_KEY, profileId).catch(() => undefined);
  }
}

export async function tessieAutomaticRecordingEligible() {
  const context = connectionContext();
  if (!(await paidTessieAccess())) return false;
  if (!context.current()) return false;
  const [accessToken, vehicleCount] = await Promise.all([storedToken(), storedVerifiedVehicleCount()]);
  return context.current() && Boolean(accessToken && vehicleCount > 0);
}

/** Credentials can always be removed, including after membership expires. */
export async function hasTessieCredentials() {
  const context = connectionContext();
  const token = await storedToken();
  return context.current() && Boolean(token);
}

export async function tessieDirectStatus() {
  return (await tessieAutomaticRecordingEligible()) ? 'connected' as const : 'not_connected' as const;
}

export async function connectTessieDirect(accessToken: string) {
  const profileId = getCurrentUser().id;
  invalidateConnection(profileId);
  const context = connectionContext();
  if (!TESSIE_INTEGRATION_ENABLED) throw new Error('Tessie is planned for JourneyDeck V3 and is not available in V2.');
  if (!(await paidTessieAccess())) throw new Error('An active JourneyDeck membership is required to connect Tessie.');
  context.check();
  const clean = accessToken.trim();
  if (!validToken(clean)) throw new Error('Enter the Tessie access token from Tessie developer settings.');
  const edge = edgeUrl();
  if (!edge) throw new Error('JourneyDeck privacy edge is not configured.');
  const result = await requestPrivacyEdgeJson<{ valid?: unknown; vehicleCount?: unknown }>(edge, '/api/auth/tessie/verify', { accessToken: clean }, {
    reason: 'external_import', operation: 'Tessie connection check', timeoutMs: 15_000,
  });
  if (result.valid !== true) throw new Error('Tessie did not accept that access token.');
  context.check();
  const vehicleCount = Math.max(0, Math.min(4, Math.round(Number(result.vehicleCount) || 0)));
  if (vehicleCount < 1) throw new Error('Tessie did not find an active Tesla on that account.');
  // Replacing a token must never show a previous Tessie account's cached locations.
  await mutateCredentials(profileId, async () => {
    context.check();
    await deleteProfileSecretForUser(TESSIE_VERIFIED_VEHICLE_KEY, profileId);
    context.check();
    clearTessieLocalData();
    deleteAppCache(AUTOMATIC_CAPTURE_KEY);
    deleteAppCache(`app.vehicle-intelligence.${profileId}.v1`);
    try {
      await saveProfileSecretForUser(TESSIE_TOKEN_KEY, clean, profileId);
      context.check();
      await saveProfileSecretForUser(TESSIE_VERIFIED_VEHICLE_KEY, String(vehicleCount), profileId);
      context.check();
    } catch (error) {
      await Promise.all([deleteProfileSecretForUser(TESSIE_TOKEN_KEY, profileId),
        deleteProfileSecretForUser(TESSIE_VERIFIED_VEHICLE_KEY, profileId)]).catch(() => undefined);
      throw error;
    }
  });
  context.check();
  return vehicleCount;
}

export async function disconnectTessieDirect() {
  const profileId = getCurrentUser().id;
  invalidateConnection(profileId);
  clearTessieLocalData();
  deleteAppCache(AUTOMATIC_CAPTURE_KEY);
  deleteAppCache(`app.vehicle-intelligence.${profileId}.v1`);
  await mutateCredentials(profileId, async () => {
    await Promise.all([deleteProfileSecretAndOwnedLegacy(TESSIE_TOKEN_KEY, profileId),
      deleteProfileSecretAndOwnedLegacy(TESSIE_VERIFIED_VEHICLE_KEY, profileId)]);
  });
}

export async function deleteCurrentProfileTessieSecrets(): Promise<void> {
  const profileId = getCurrentUser().id;
  invalidateConnection(profileId);
  await mutateCredentials(profileId, async () => {
    await Promise.all([deleteProfileSecretAndOwnedLegacy(TESSIE_TOKEN_KEY, profileId),
      deleteProfileSecretAndOwnedLegacy(TESSIE_VERIFIED_VEHICLE_KEY, profileId)]);
  });
}

export function syncTessieDirect(): Promise<TessieSnapshot> {
  const context = connectionContext();
  const running = syncs.get(context.profileId);
  if (running?.revision === context.revision) return running.task;
  const task = syncTessieSnapshot(context).finally(() => {
    if (syncs.get(context.profileId)?.task === task) syncs.delete(context.profileId);
  });
  syncs.set(context.profileId, { revision: context.revision, task });
  return task;
}

async function syncTessieSnapshot(context: ReturnType<typeof connectionContext>): Promise<TessieSnapshot> {
  const { profileId } = context;
  if (!TESSIE_INTEGRATION_ENABLED) throw new Error('Tessie is planned for JourneyDeck V3 and is not available in V2.');
  if (!(await tessieAutomaticRecordingEligible())) throw new Error('Connect a verified Tesla with an active JourneyDeck membership first.');
  context.check();
  const accessToken = await storedToken();
  context.check();
  if (!accessToken) throw new Error('Connect Tessie in Settings first.');
  const edge = edgeUrl();
  if (!edge) throw new Error('JourneyDeck privacy edge is not configured.');
  const to = new Date(), from = new Date(to.getTime() - 30 * 24 * 60 * 60_000);
  try {
    const snapshot = await fetchTessieSnapshotAdaptive(from, to, (windowFrom, windowTo) => {
      context.check();
      return requestPrivacyEdgeJson<unknown>(edge, '/api/vehicle/tessie/sync', {
        accessToken, from: windowFrom, to: windowTo,
      }, { reason: 'external_import', operation: 'Tessie vehicle import', timeoutMs: 45_000, maxResponseBytes: 4_194_304 });
    });
    context.check();
    const saved = saveTessieLocalSnapshot(snapshot);
    await captureTessieJourneys(saved, drive => loadTessieDriveRoute(drive, true), context.current);
    context.check();
    return saved;
  } catch (error) { if (context.current()) await invalidateExpiredConnection(error, profileId); throw error; }
}

/** Foreground best effort. Manual journeys and cached data remain usable offline. */
export function syncTessieCaptureBestEffort(): Promise<void> {
  const profileId = getCurrentUser().id;
  if (automaticCaptureInFlight && automaticCaptureProfileId === profileId) return automaticCaptureInFlight;
  const task = (async () => {
    if (!(await tessieAutomaticRecordingEligible())) return;
    if (getCurrentUser().id !== profileId) return;
    const last = readAppCache<number>(AUTOMATIC_CAPTURE_KEY) ?? 0;
    if (Date.now() - last < 15 * 60_000) return;
    writeAppCache(AUTOMATIC_CAPTURE_KEY, Date.now());
    try { await syncTessieDirect(); }
    catch {
      if (getCurrentUser().id === profileId) deleteAppCache(AUTOMATIC_CAPTURE_KEY);
    }
  })().finally(() => {
    if (automaticCaptureInFlight === task) { automaticCaptureInFlight = null; automaticCaptureProfileId = null; }
  });
  automaticCaptureInFlight = task;
  automaticCaptureProfileId = profileId;
  return task;
}

export async function loadTessieDriveRoute(drive: TessieDriveSnapshot, refreshRemote = false): Promise<TessieDriveRoute> {
  const context = connectionContext(), { profileId } = context;
  if (!(await tessieAutomaticRecordingEligible())) throw new Error('Connect a verified Tesla with an active JourneyDeck membership first.');
  context.check();
  if (!refreshRemote) {
    const cached = readTessieLocalRoute(drive);
    if (cached && cached.routePoints.length >= 2) return cached;
  }
  const accessToken = await storedToken(), edge = edgeUrl();
  context.check();
  if (!accessToken || !edge) throw new Error('Tessie or the JourneyDeck privacy edge is not configured.');
  try {
    const route = await requestPrivacyEdgeJson<unknown>(edge, '/api/vehicle/tessie/route', {
      accessToken, driveId: drive.id, startedAt: drive.startedAt, endedAt: drive.endedAt,
    }, { reason: 'external_import', operation: 'Tessie drive route', timeoutMs: 25_000, maxResponseBytes: 2_097_152 });
    context.check();
    return saveTessieLocalRoute(route, drive);
  } catch (error) { if (context.current()) await invalidateExpiredConnection(error, profileId); throw error; }
}

export async function sampleTessieMedia(): Promise<TessieMediaSample | null> {
  const profileId = getCurrentUser().id;
  if (!(await tessieAutomaticRecordingEligible())) return null;
  const accessToken = await storedToken();
  if (!accessToken) return null;
  const edge = edgeUrl();
  if (!edge) return null;
  let sample: TessieMediaSample;
  try {
    sample = await requestPrivacyEdgeJson<TessieMediaSample>(edge, '/api/vehicle/tessie/media', { accessToken }, {
      reason: 'external_import', operation: 'Tessie now playing check', timeoutMs: 20_000,
    });
  } catch (error) { await invalidateExpiredConnection(error, profileId); throw error; }
  if (!sample || typeof sample.available !== 'boolean' || typeof sample.sampledAt !== 'string') {
    throw new Error('Tessie returned an incomplete media sample.');
  }
  if (getCurrentUser().id !== profileId) return null;
  return sample;
}
