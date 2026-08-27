export type TimedRouteCoordinate = {
  recordedAtEpochMs: number;
  coordinate: [number, number];
  speedMph?: number | null;
  headingDegrees?: number | null;
  batteryPercent?: number | null;
};

type TessieState = {
  timestamp?: unknown;
  latitude?: unknown;
  longitude?: unknown;
  speed?: unknown;
  heading?: unknown;
  battery_level?: unknown;
};

function validCoordinate(longitude: number, latitude: number) {
  return Number.isFinite(longitude) && Number.isFinite(latitude)
    && longitude >= -180 && longitude <= 180 && latitude >= -90 && latitude <= 90;
}

function optionalNumber(value: unknown, minimum: number, maximum: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= minimum && parsed <= maximum ? parsed : null;
}

export async function loadTessieRouteCoordinates(
  input: { vin: string; startedAtEpoch: number; endedAtEpoch: number },
  token: string,
  fetchImpl: typeof fetch = fetch,
): Promise<TimedRouteCoordinate[]> {
  if (!input.vin || !Number.isSafeInteger(input.startedAtEpoch) || !Number.isSafeInteger(input.endedAtEpoch) || input.endedAtEpoch <= input.startedAtEpoch) return [];
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    const url = new URL(`https://api.tessie.com/${encodeURIComponent(input.vin)}/states`);
    url.searchParams.set('from', String(Math.max(0, input.startedAtEpoch - 60)));
    url.searchParams.set('to', String(input.endedAtEpoch + 60));
    url.searchParams.set('interval', '1');
    url.searchParams.set('condense', 'false');
    url.searchParams.set('distance_format', 'mi');
    url.searchParams.set('temperature_format', 'f');
    const response = await fetchImpl(url, {
      headers: { authorization: `Bearer ${token}`, accept: 'application/json' },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Tessie historical states returned ${response.status}.`);
    const payload = await response.json() as { results?: unknown };
    if (!Array.isArray(payload.results)) return [];
    return (payload.results as TessieState[]).flatMap(state => {
      const timestamp = Number(state.timestamp), latitude = Number(state.latitude), longitude = Number(state.longitude);
      return Number.isSafeInteger(timestamp) && validCoordinate(longitude, latitude)
        ? [{
          recordedAtEpochMs: timestamp * 1000,
          coordinate: [longitude, latitude] as [number, number],
          speedMph: optionalNumber(state.speed, 0, 250),
          headingDegrees: optionalNumber(state.heading, 0, 360),
          batteryPercent: optionalNumber(state.battery_level, 0, 100),
        }]
        : [];
    }).sort((a, b) => a.recordedAtEpochMs - b.recordedAtEpochMs);
  } finally {
    clearTimeout(timeout);
  }
}
