/**
 * On-device Tessie contract. IDs are opaque edge hashes; VINs and tokens are
 * never part of these records. Route coordinates remain in profile-local data.
 */
export type TessieVehicleSnapshot = {
  vehicleKey: string; name: string; status: string; batteryPercent: number | null; rangeMiles: number | null;
  chargingState: string | null; odometerMiles: number | null; updatedAt: string | null;
};
export type TessieChargeSnapshot = {
  id: string; locationKey: string; location: string; vehicleKey: string; vehicleName: string; startedAt: string; endedAt: string;
  isSupercharger: boolean; energyAddedKwh: number; energyUsedKwh: number; milesAdded: number;
  energyAddedKnown?: boolean;
  startingBatteryPercent: number | null; endingBatteryPercent: number | null; recordedCost: number | null;
};
export type TessieDriveSnapshot = {
  id: string; vehicleKey: string; vehicleName: string; startedAt: string; endedAt: string;
  startingLocation: string; endingLocation: string; miles: number; energyUsedKwh: number;
  energyUsedKnown?: boolean;
  startingBatteryPercent: number | null; endingBatteryPercent: number | null;
};
export type TessieRoutePoint = {
  recordedAt: string; latitude: number; longitude: number; speedMph: number | null;
  headingDegrees: number | null; batteryPercent: number | null;
};
export type TessieDriveRoute = { driveId: string; generatedAt: string; routePoints: TessieRoutePoint[] };
export type TessieSnapshot = {
  generatedAt: string; vehicles: TessieVehicleSnapshot[]; drives: TessieDriveSnapshot[]; charges: TessieChargeSnapshot[];
};

const OPAQUE_ID = /^[a-f0-9]{32}$/;
const MAX_ROUTE_POINTS = 2_500;

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}
function text(value: unknown, max = 160): string | null {
  return typeof value === 'string' && value.trim() && value.length <= max ? value.trim() : null;
}
function id(value: unknown): string | null {
  return typeof value === 'string' && OPAQUE_ID.test(value) ? value : null;
}
function iso(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const epoch = Date.parse(value);
  return Number.isFinite(epoch) && new Date(epoch).toISOString() === value ? value : null;
}
function number(value: unknown, min: number, max: number): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max ? value : null;
}
function nullableNumber(value: unknown, min: number, max: number): number | null {
  if (value === null) return null;
  return required(number(value, min, max));
}
function observed(value: unknown, amount: number): boolean {
  if (value === undefined) return amount > 0; // Legacy cache cannot distinguish a missing value from zero.
  if (typeof value !== 'boolean') throw new Error('Tessie returned an invalid energy measurement.');
  return value;
}
function items(value: unknown, max: number): Record<string, unknown>[] {
  if (!Array.isArray(value) || value.length > max) throw new Error('Tessie returned an invalid data set.');
  return value.map(item => {
    const row = record(item);
    if (!row) throw new Error('Tessie returned an invalid data set.');
    return row;
  });
}
function required<T>(value: T | null | undefined): T {
  if (value === null || value === undefined) throw new Error('Tessie returned an incomplete data record.');
  return value;
}

export function parseTessieSnapshot(value: unknown): TessieSnapshot {
  const source = required(record(value));
  const vehicles = items(source.vehicles, 4).map(row => ({
    vehicleKey: required(id(row.vehicleKey)), name: required(text(row.name)), status: required(text(row.status, 32)),
    batteryPercent: nullableNumber(row.batteryPercent, 0, 100), rangeMiles: nullableNumber(row.rangeMiles, 0, 1_000),
    chargingState: row.chargingState === null ? null : required(text(row.chargingState, 48)),
    odometerMiles: nullableNumber(row.odometerMiles, 0, 10_000_000),
    updatedAt: row.updatedAt === null ? null : required(iso(row.updatedAt)),
  }));
  const vehicleIds = new Set(vehicles.map(vehicle => vehicle.vehicleKey));
  const drives = items(source.drives, 800).map(row => {
    const vehicleKey = required(id(row.vehicleKey));
    const startedAt = required(iso(row.startedAt)), endedAt = required(iso(row.endedAt));
    if (!vehicleIds.has(vehicleKey) || startedAt >= endedAt) throw new Error('Tessie returned an invalid drive.');
    return {
      id: required(id(row.id)), vehicleKey, vehicleName: required(text(row.vehicleName)), startedAt, endedAt,
      startingLocation: required(text(row.startingLocation)), endingLocation: required(text(row.endingLocation)),
      miles: required(number(row.miles, 0, 5_000)), energyUsedKwh: required(number(row.energyUsedKwh, 0, 1_000)),
      energyUsedKnown: observed(row.energyUsedKnown, required(number(row.energyUsedKwh, 0, 1_000))),
      startingBatteryPercent: nullableNumber(row.startingBatteryPercent, 0, 100),
      endingBatteryPercent: nullableNumber(row.endingBatteryPercent, 0, 100),
    };
  });
  const charges = items(source.charges, 800).map(row => {
    const vehicleKey = required(id(row.vehicleKey));
    const startedAt = required(iso(row.startedAt)), endedAt = required(iso(row.endedAt));
    if (!vehicleIds.has(vehicleKey) || startedAt >= endedAt || typeof row.isSupercharger !== 'boolean') throw new Error('Tessie returned an invalid charge.');
    return {
      id: required(id(row.id)), locationKey: required(id(row.locationKey)), location: required(text(row.location)),
      vehicleKey, vehicleName: required(text(row.vehicleName)), startedAt, endedAt, isSupercharger: row.isSupercharger,
      energyAddedKwh: required(number(row.energyAddedKwh, 0, 1_000)), energyUsedKwh: required(number(row.energyUsedKwh, 0, 1_000)),
      energyAddedKnown: observed(row.energyAddedKnown, required(number(row.energyAddedKwh, 0, 1_000))),
      milesAdded: required(number(row.milesAdded, 0, 5_000)),
      startingBatteryPercent: nullableNumber(row.startingBatteryPercent, 0, 100),
      endingBatteryPercent: nullableNumber(row.endingBatteryPercent, 0, 100),
      recordedCost: nullableNumber(row.recordedCost, 0, 100_000),
    };
  });
  return { generatedAt: required(iso(source.generatedAt)), vehicles, drives, charges };
}

export function parseTessieRoute(value: unknown, drive: TessieDriveSnapshot): TessieDriveRoute {
  const source = required(record(value));
  if (source.driveId !== drive.id) throw new Error('Tessie route did not match the requested drive.');
  let lastTime = '';
  const routePoints = items(source.routePoints, MAX_ROUTE_POINTS).map(row => {
    const recordedAt = required(iso(row.recordedAt));
    if (recordedAt < drive.startedAt || recordedAt > drive.endedAt || recordedAt < lastTime) throw new Error('Tessie returned an invalid route timestamp.');
    lastTime = recordedAt;
    return {
      recordedAt, latitude: required(number(row.latitude, -90, 90)), longitude: required(number(row.longitude, -180, 180)),
      speedMph: nullableNumber(row.speedMph, 0, 250),
      headingDegrees: nullableNumber(row.headingDegrees, 0, 360),
      batteryPercent: nullableNumber(row.batteryPercent, 0, 100),
    };
  });
  return { driveId: drive.id, generatedAt: required(iso(source.generatedAt)), routePoints };
}
