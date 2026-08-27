import Constants from 'expo-constants';

import { requestPrivacyEdgeJson } from './network-request';
import { deleteProfileSecret, deleteProfileSecretAndOwnedLegacy, loadProfileSecret, saveProfileSecret } from './profile-secure-store';

const TESSIE_TOKEN_KEY = 'journeydeck.vehicle.tessie.token.v1';

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

export async function tessieDirectStatus() { return (await storedToken()) ? 'connected' as const : 'not_connected' as const; }

export async function connectTessieDirect(accessToken: string) {
  const clean = accessToken.trim();
  if (!validToken(clean)) throw new Error('Enter the Tessie access token from Tessie developer settings.');
  const edge = edgeUrl();
  if (!edge) throw new Error('JourneyDeck privacy edge is not configured.');
  const result = await requestPrivacyEdgeJson<{ valid?: unknown; vehicleCount?: unknown }>(edge, '/api/auth/tessie/verify', { accessToken: clean }, {
    reason: 'external_import', operation: 'Tessie connection check', timeoutMs: 15_000,
  });
  if (result.valid !== true) throw new Error('Tessie did not accept that access token.');
  await saveProfileSecret(TESSIE_TOKEN_KEY, clean);
  return Math.max(0, Math.round(Number(result.vehicleCount) || 0));
}

export async function disconnectTessieDirect() {
  await deleteProfileSecret(TESSIE_TOKEN_KEY);
}

export async function deleteCurrentProfileTessieSecrets(): Promise<void> {
  await deleteProfileSecretAndOwnedLegacy(TESSIE_TOKEN_KEY);
}

export async function syncTessieDirect(): Promise<TessieSnapshot> {
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
