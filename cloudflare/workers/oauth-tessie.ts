/**
 * oauth-tessie.ts - Cloudflare Worker Edge Handler
 * 
 * Stateless Tessie read broker for token verification and bounded history sync.
 * The user-owned token, VINs, and precise coordinates are never stored, logged,
 * or returned. No vehicle-command path is exposed.
 */

import { enforceRateLimit, opaqueKey, upstreamTimeout } from './edge-policy.ts';
import { jsonResponse, readBoundedJson, readBoundedResponseJson, stringField } from './http.ts';

type TessieVehicle = {
  vin?: unknown;
  last_state?: {
    state?: unknown; display_name?: unknown; drive_state?: { timestamp?: unknown; shift_state?: unknown };
    charge_state?: { timestamp?: unknown; battery_level?: unknown; battery_range?: unknown; charging_state?: unknown };
    vehicle_state?: { timestamp?: unknown; odometer?: unknown; vehicle_name?: unknown };
  };
};
type TessieMediaInfo = {
  now_playing_title?: unknown; now_playing_artist?: unknown; now_playing_album?: unknown;
  now_playing_source?: unknown; now_playing_station?: unknown; now_playing_duration?: unknown;
  now_playing_elapsed?: unknown; media_playback_status?: unknown;
};
type TessieFleetVehicleData = {
  response?: {
    media_info?: TessieMediaInfo;
    vehicle_state?: { media_info?: TessieMediaInfo };
    data?: { vehicle_state?: { media_info?: TessieMediaInfo } };
  };
  media_info?: TessieMediaInfo;
  vehicle_state?: { media_info?: TessieMediaInfo };
};
type TessieCharge = {
  id?: unknown; started_at?: unknown; ended_at?: unknown; location?: unknown; is_supercharger?: unknown; energy_added?: unknown;
  energy_used?: unknown; miles_added?: unknown; starting_battery?: unknown; ending_battery?: unknown; cost?: unknown;
};
type TessieDrive = {
  id?: unknown; started_at?: unknown; ended_at?: unknown; starting_location?: unknown; ending_location?: unknown;
  odometer_distance?: unknown; energy_used?: unknown; starting_battery?: unknown; ending_battery?: unknown;
};

class TessieUpstreamError extends Error {
  readonly status: number;
  constructor(status: number) { super('Tessie upstream request failed'); this.status = status; }
}

const TOKEN = /^\S{16,512}$/;
const VIN = /^[A-HJ-NPR-Z0-9]{11,20}$/i;
const MAX_WINDOW_MS = 31 * 24 * 60 * 60_000;

function clean(value: unknown, maximum = 160) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, maximum) : '';
}
function numberOrNull(value: unknown) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : null; }
function isoFromUnix(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  const date = new Date(parsed > 10_000_000_000 ? parsed : parsed * 1_000);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}
function tokenFrom(body: Record<string, unknown>) {
  const token = stringField(body, 'accessToken') ?? stringField(body, 'apiKey');
  return token && TOKEN.test(token) ? token : null;
}

async function tessieGet<T>(path: string, token: string, env: Env, maximumBytes = 2_097_152): Promise<T> {
  const response = await fetch(`https://api.tessie.com${path}`, {
    method: 'GET', headers: { authorization: `Bearer ${token}`, accept: 'application/json' },
    signal: AbortSignal.timeout(upstreamTimeout(env, 10_000)),
  });
  const payload = await readBoundedResponseJson<T>(response, maximumBytes);
  if (!response.ok || !payload) throw new TessieUpstreamError(response.status);
  return payload;
}
async function rateLimited(token: string, env: Env) {
  return enforceRateLimit(env.TESSIE_RATE_LIMITER, await opaqueKey('tessie', token), 'Try Tessie again in a minute');
}
function upstreamFailure(error: unknown) {
  if (error instanceof TessieUpstreamError && (error.status === 401 || error.status === 403)) {
    return jsonResponse({ error: 'Tessie access was not authorized' }, 401, { 'Cache-Control': 'no-store' });
  }
  return jsonResponse({ error: 'Tessie data was unavailable' }, 502, { 'Cache-Control': 'no-store', 'Retry-After': '60' });
}

function mediaInfoFrom(payload: TessieFleetVehicleData) {
  return payload.response?.vehicle_state?.media_info
    ?? payload.response?.data?.vehicle_state?.media_info
    ?? payload.response?.media_info
    ?? payload.vehicle_state?.media_info
    ?? payload.media_info
    ?? null;
}

function playingStatus(value: unknown) {
  const status = clean(value, 48);
  if (!status) return true;
  const normalized = status.toLowerCase();
  return normalized.includes('play') && !normalized.includes('pause');
}

async function fetchMediaInfo(vin: string, token: string, env: Env) {
  const encodedVin = encodeURIComponent(vin);
  let fleetPayload: TessieFleetVehicleData;
  try {
    // media_info is nested inside Tesla's top-level vehicle_state block, so
    // endpoint selection must request vehicle_state rather than media_info.
    fleetPayload = await tessieGet<TessieFleetVehicleData>(`/api/1/vehicles/${encodedVin}/vehicle_data?endpoints=vehicle_state`, token, env, 524_288);
  } catch (error) {
    // Older Tessie proxy versions may not support endpoint selection. A
    // bounded full vehicle_data response is accepted only as a compatibility
    // fallback and is stripped before anything leaves the edge.
    if (!(error instanceof TessieUpstreamError) || (error.status !== 400 && error.status !== 404)) throw error;
    fleetPayload = await tessieGet<TessieFleetVehicleData>(`/api/1/vehicles/${encodedVin}/vehicle_data`, token, env, 1_048_576);
  }
  const fleetMedia = mediaInfoFrom(fleetPayload);
  if (clean(fleetMedia?.now_playing_title, 200) && clean(fleetMedia?.now_playing_artist, 200)) return fleetMedia;

  // Tessie's native state endpoint is a separate read path and has exposed
  // vehicle_state.media_info on vehicles where Fleet vehicle_data omits it.
  const tessieState = await tessieGet<TessieFleetVehicleData>(`/${encodedVin}/state`, token, env, 1_048_576);
  return mediaInfoFrom(tessieState) ?? fleetMedia;
}

export async function handleTessieVerification(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405, { Allow: 'POST', 'Cache-Control': 'no-store' });
  const body = await readBoundedJson(request, 2_048);
  const token = body ? tokenFrom(body) : null;
  if (!token) return jsonResponse({ error: 'Enter a valid Tessie access token' }, 400, { 'Cache-Control': 'no-store' });
  const limited = await rateLimited(token, env);
  if (limited) return limited;
  try {
    const payload = await tessieGet<{ results?: TessieVehicle[] }>('/vehicles?only_active=true', token, env, 1_048_576);
    return jsonResponse({ valid: true, vehicleCount: Array.isArray(payload.results) ? Math.min(payload.results.length, 4) : 0 }, 200, { 'Cache-Control': 'no-store' });
  } catch (error) { return upstreamFailure(error); }
}

export async function handleTessieSync(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405, { Allow: 'POST', 'Cache-Control': 'no-store' });
  const body = await readBoundedJson(request, 4_096);
  const token = body ? tokenFrom(body) : null;
  const from = Date.parse(body ? stringField(body, 'from') ?? '' : ''), to = Date.parse(body ? stringField(body, 'to') ?? '' : ''), now = Date.now();
  if (!token || !Number.isFinite(from) || !Number.isFinite(to) || from >= to || to - from > MAX_WINDOW_MS || to > now + 5 * 60_000 || from < now - MAX_WINDOW_MS - 5 * 60_000) {
    return jsonResponse({ error: 'Invalid Tessie sync window' }, 400, { 'Cache-Control': 'no-store' });
  }
  const limited = await rateLimited(token, env);
  if (limited) return limited;
  try {
    const vehiclePayload = await tessieGet<{ results?: TessieVehicle[] }>('/vehicles?only_active=true', token, env, 1_048_576);
    const sourceVehicles = (Array.isArray(vehiclePayload.results) ? vehiclePayload.results : []).filter(vehicle => VIN.test(clean(vehicle.vin, 24))).slice(0, 4);
    const vehicles: Record<string, unknown>[] = [], charges: Record<string, unknown>[] = [], drives: Record<string, unknown>[] = [];
    const fromSeconds = Math.floor(from / 1_000), toSeconds = Math.ceil(to / 1_000);
    for (const source of sourceVehicles) {
      const vin = clean(source.vin, 24), vehicleKey = await opaqueKey('tessie-vehicle', vin), last = source.last_state ?? {};
      const name = clean(last.display_name) || clean(last.vehicle_state?.vehicle_name) || 'Tesla';
      vehicles.push({
        vehicleKey, name, status: clean(last.state, 32) || 'unknown', batteryPercent: numberOrNull(last.charge_state?.battery_level),
        rangeMiles: numberOrNull(last.charge_state?.battery_range), chargingState: clean(last.charge_state?.charging_state, 48) || null,
        odometerMiles: numberOrNull(last.vehicle_state?.odometer),
        updatedAt: isoFromUnix(last.charge_state?.timestamp) ?? isoFromUnix(last.drive_state?.timestamp) ?? isoFromUnix(last.vehicle_state?.timestamp),
      });
      const query = `from=${fromSeconds}&to=${toSeconds}&distance_format=mi&timezone=UTC&limit=200`;
      const [chargePayload, drivePayload] = await Promise.all([
        tessieGet<{ results?: TessieCharge[] }>(`/${encodeURIComponent(vin)}/charges?${query}`, token, env),
        tessieGet<{ results?: TessieDrive[] }>(`/${encodeURIComponent(vin)}/drives?${query}`, token, env),
      ]);
      for (const charge of (Array.isArray(chargePayload.results) ? chargePayload.results : []).slice(0, 200)) {
        const startedAt = isoFromUnix(charge.started_at), endedAt = isoFromUnix(charge.ended_at), location = clean(charge.location) || 'Charging location';
        if (!startedAt || !endedAt) continue;
        charges.push({
          id: await opaqueKey('tessie-charge', vehicleKey, String(charge.id ?? startedAt)), locationKey: await opaqueKey('tessie-location', location),
          location, vehicleKey, vehicleName: name, startedAt, endedAt, isSupercharger: charge.is_supercharger === true,
          energyAddedKwh: numberOrNull(charge.energy_added) ?? 0, energyUsedKwh: numberOrNull(charge.energy_used) ?? 0,
          milesAdded: numberOrNull(charge.miles_added) ?? 0, startingBatteryPercent: numberOrNull(charge.starting_battery),
          endingBatteryPercent: numberOrNull(charge.ending_battery), recordedCost: numberOrNull(charge.cost),
        });
      }
      for (const drive of (Array.isArray(drivePayload.results) ? drivePayload.results : []).slice(0, 200)) {
        const startedAt = isoFromUnix(drive.started_at), endedAt = isoFromUnix(drive.ended_at);
        if (!startedAt || !endedAt) continue;
        drives.push({
          id: await opaqueKey('tessie-drive', vehicleKey, String(drive.id ?? startedAt)), vehicleKey, vehicleName: name, startedAt, endedAt,
          startingLocation: clean(drive.starting_location) || 'Unknown start', endingLocation: clean(drive.ending_location) || 'Unknown destination',
          miles: numberOrNull(drive.odometer_distance) ?? 0, energyUsedKwh: numberOrNull(drive.energy_used) ?? 0,
          startingBatteryPercent: numberOrNull(drive.starting_battery), endingBatteryPercent: numberOrNull(drive.ending_battery),
        });
      }
    }
    return jsonResponse({ generatedAt: new Date().toISOString(), vehicles, charges, drives }, 200, { 'Cache-Control': 'no-store, no-cache, must-revalidate' });
  } catch (error) { return upstreamFailure(error); }
}

export async function handleTessieMedia(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405, { Allow: 'POST', 'Cache-Control': 'no-store' });
  const body = await readBoundedJson(request, 2_048);
  const token = body ? tokenFrom(body) : null;
  if (!token) return jsonResponse({ error: 'Tessie is not connected' }, 400, { 'Cache-Control': 'no-store' });
  const limited = await rateLimited(token, env);
  if (limited) return limited;

  try {
    const vehiclePayload = await tessieGet<{ results?: TessieVehicle[] }>('/vehicles?only_active=true', token, env, 1_048_576);
    const vehicles = (Array.isArray(vehiclePayload.results) ? vehiclePayload.results : [])
      .filter(vehicle => VIN.test(clean(vehicle.vin, 24)))
      .sort((left, right) => {
        const moving = (vehicle: TessieVehicle) => ['d', 'r', 'n'].includes(clean(vehicle.last_state?.drive_state?.shift_state, 4).toLowerCase()) ? 1 : 0;
        return moving(right) - moving(left);
      })
      .slice(0, 4);

    for (const vehicle of vehicles) {
      const vin = clean(vehicle.vin, 24);
      const media = await fetchMediaInfo(vin, token, env);
      if (!media) continue;
      const track = clean(media.now_playing_title, 200);
      const artist = clean(media.now_playing_artist, 200);
      if (!track || !artist) continue;
      const playbackStatus = clean(media.media_playback_status, 48) || null;
      return jsonResponse({
        available: true,
        sampledAt: new Date().toISOString(),
        isPlaying: playingStatus(media.media_playback_status),
        track,
        artist,
        album: clean(media.now_playing_album, 200) || null,
        source: clean(media.now_playing_source, 80) || null,
        station: clean(media.now_playing_station, 120) || null,
        playbackStatus,
        durationMs: numberOrNull(media.now_playing_duration),
        elapsedMs: numberOrNull(media.now_playing_elapsed),
      }, 200, { 'Cache-Control': 'no-store, no-cache, must-revalidate' });
    }

    return jsonResponse({
      available: false,
      sampledAt: new Date().toISOString(),
      reason: vehicles.length ? 'no_track_metadata' : 'no_active_vehicle',
    }, 200, { 'Cache-Control': 'no-store, no-cache, must-revalidate' });
  } catch (error) { return upstreamFailure(error); }
}
