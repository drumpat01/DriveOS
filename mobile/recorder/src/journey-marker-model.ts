export type CapturedJourneyMarker = {
 id: string; capturedAt: string; locationAt: string;
 latitude: number; longitude: number; accuracyMeters: number;
};

export function validCapturedMarker(marker: CapturedJourneyMarker, startedAt: string, endedAt: string | null): boolean {
 const captured = Date.parse(marker.capturedAt), location = Date.parse(marker.locationAt);
 return /^marker_[0-9a-f-]{36}$/.test(marker.id)
   && Number.isFinite(captured) && Number.isFinite(location)
   && captured >= Date.parse(startedAt) && (!endedAt || captured <= Date.parse(endedAt))
   && location >= Date.parse(startedAt) && captured - location >= -5_000 && captured - location <= 30_000
   && Number.isFinite(marker.latitude) && Math.abs(marker.latitude) <= 90
   && Number.isFinite(marker.longitude) && Math.abs(marker.longitude) <= 180
   && Number.isFinite(marker.accuracyMeters) && marker.accuracyMeters >= 0 && marker.accuracyMeters <= 100;
}
