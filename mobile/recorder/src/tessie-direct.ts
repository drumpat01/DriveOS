import Constants from 'expo-constants';

import { requestPrivacyEdgeJson } from './network-request';
import { deleteProfileSecret, deleteProfileSecretAndOwnedLegacy, loadProfileSecret, saveProfileSecret } from './profile-secure-store';
import { getMembershipStatus } from '../modules/journeydeck-membership';
import { entitlementsForVerifiedMembership } from './membership-entitlements';
import { TESSIE_INTEGRATION_ENABLED } from './release-features';

const TESSIE_TOKEN_KEY = 'journeydeck.vehicle.tessie.token.v1';
const TESSIE_VERIFIED_VEHICLE_KEY = 'journeydeck.vehicle.tessie.verified-count.v1';

export type TessieVehicleSnapshot = {
  vehicleKey: string; name: string; status: string; batteryPercent: number | null; rangeMiles: number | null;
  chargingState: string | null; odometerMiles: number | null; updatedAt: string | null;
};
export type TessieChargeSnapshot = {
  id: string; locationKey: string; location: string; vehicleKey: string; vehicleName: string; startedAt: string; endedAt: string;
  isSupercharger: boolean; energyAddedKwh: number; energyUsedKwh: number; milesAdded: number;
  startingBatteryPercent: number | null; endingBatteryPercent: number | null; recordedCost: number | null;
};
export type TessieDriveSnapshot = {
  id: string; vehicleKey: string; vehicleName: string; startedAt: string; endedAt: string; startingLocation: string; endingLocation: string;
  miles: number; energyUsedKwh: number; startingBatteryPercent: number | null; endingBatteryPercent: number | null;
};
export type TessieSnapshot = {
  generatedAt: string;
  vehicles: TessieVehicleSnapshot[];
  charges: TessieChargeSnapshot[];
  drives: TessieDriveSnapshot[];
};
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
  try { return entitlementsForVerifiedMembership(await getMembershipStatus()).tessieAccess; }
  catch { return false; }
}

export async function tessieAutomaticRecordingEligible() {
  if (!(await paidTessieAccess())) return false;
  const [accessToken, vehicleCount] = await Promise.all([storedToken(), storedVerifiedVehicleCount()]);
  return Boolean(accessToken && vehicleCount > 0);
}

export async function tessieDirectStatus() {
  return (await tessieAutomaticRecordingEligible()) ? 'connected' as const : 'not_connected' as const;
}

export async function connectTessieDirect(accessToken: string) {
  if (!TESSIE_INTEGRATION_ENABLED) throw new Error('Tessie is not available in JourneyDeck version 1.');
  if (!(await paidTessieAccess())) throw new Error('An active JourneyDeck membership is required to connect Tessie.');
  const clean = accessToken.trim();
  if (!validToken(clean)) throw new Error('Enter the Tessie access token from Tessie developer settings.');
  const edge = edgeUrl();
  if (!edge) throw new Error('JourneyDeck privacy edge is not configured.');
  const result = await requestPrivacyEdgeJson<{ valid?: unknown; vehicleCount?: unknown }>(edge, '/api/auth/tessie/verify', { accessToken: clean }, {
    reason: 'external_import', operation: 'Tessie connection check', timeoutMs: 15_000,
  });
  if (result.valid !== true) throw new Error('Tessie did not accept that access token.');
  const vehicleCount = Math.max(0, Math.min(4, Math.round(Number(result.vehicleCount) || 0)));
  if (vehicleCount < 1) throw new Error('Tessie did not find an active Tesla on that account.');
  await saveProfileSecret(TESSIE_TOKEN_KEY, clean);
  try { await saveProfileSecret(TESSIE_VERIFIED_VEHICLE_KEY, String(vehicleCount)); }
  catch (error) {
    await deleteProfileSecret(TESSIE_TOKEN_KEY).catch(() => undefined);
    throw error;
  }
  return vehicleCount;
}

export async function disconnectTessieDirect() {
  await Promise.all([
    deleteProfileSecret(TESSIE_TOKEN_KEY),
    deleteProfileSecret(TESSIE_VERIFIED_VEHICLE_KEY),
  ]);
}

export async function deleteCurrentProfileTessieSecrets(): Promise<void> {
  await Promise.all([
    deleteProfileSecretAndOwnedLegacy(TESSIE_TOKEN_KEY),
    deleteProfileSecretAndOwnedLegacy(TESSIE_VERIFIED_VEHICLE_KEY),
  ]);
}

export async function syncTessieDirect(): Promise<TessieSnapshot> {
  if (!TESSIE_INTEGRATION_ENABLED) throw new Error('Tessie is not available in JourneyDeck version 1.');
  if (!(await tessieAutomaticRecordingEligible())) throw new Error('Connect a verified Tesla with an active JourneyDeck membership first.');
  const accessToken = await storedToken();
  if (!accessToken) throw new Error('Connect Tessie in Settings first.');
  const edge = edgeUrl();
  if (!edge) throw new Error('JourneyDeck privacy edge is not configured.');
  const to = new Date(), from = new Date(to.getTime() - 30 * 24 * 60 * 60_000);
  const snapshot = await requestPrivacyEdgeJson<TessieSnapshot>(edge, '/api/vehicle/tessie/sync', {
    accessToken, from: from.toISOString(), to: to.toISOString(),
  }, { reason: 'external_import', operation: 'Tessie vehicle import', timeoutMs: 45_000 });
  if (!snapshot || !Array.isArray(snapshot.vehicles) || !Array.isArray(snapshot.charges) || !Array.isArray(snapshot.drives)) {
    throw new Error('Tessie returned an incomplete vehicle snapshot.');
  }
  return snapshot;
}

export async function sampleTessieMedia(): Promise<TessieMediaSample | null> {
  if (!(await tessieAutomaticRecordingEligible())) return null;
  const accessToken = await storedToken();
  if (!accessToken) return null;
  const edge = edgeUrl();
  if (!edge) return null;
  const sample = await requestPrivacyEdgeJson<TessieMediaSample>(edge, '/api/vehicle/tessie/media', { accessToken }, {
    reason: 'external_import', operation: 'Tessie now playing check', timeoutMs: 20_000,
  });
  if (!sample || typeof sample.available !== 'boolean' || typeof sample.sampledAt !== 'string') {
    throw new Error('Tessie returned an incomplete media sample.');
  }
  return sample;
}
