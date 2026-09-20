import { randomUUID } from 'expo-crypto';
import { captureNativeJourneyMarker, getNativeAutomaticRecorderStatus } from '../modules/journeydeck-recorder';
import { getCurrentUser } from './auth';
import { syncNativeRecorderInbox } from './native-recorder-inbox';
import { getLiveRecorderSnapshot } from './storage';
import { MARKER_OTA_COMPAT } from './journey-marker-compatibility';
import { saveForegroundMarker } from './journey-marker-compat-store';
import { validCapturedMarker } from './journey-marker-model';

export async function captureJourneyMarker(sessionId: string) {
  if (!MARKER_OTA_COMPAT) return captureNativeJourneyMarker(sessionId);
  const userId = getCurrentUser().id;
  await syncNativeRecorderInbox();
  const snapshot = getLiveRecorderSnapshot();
  const capturedAt = new Date().toISOString();
  // The existing native status API confirms that this exact session was still
  // recording after the capture timestamp, even if Finish follows immediately.
  const native = await getNativeAutomaticRecorderStatus();
  if (getCurrentUser().id !== userId || !native.statusReliable || !native.recording || native.sessionId !== sessionId
    || snapshot.session?.id !== sessionId || snapshot.session.status !== 'recording') throw new Error('Start or resume a journey before creating a marker.');
  const point = snapshot.lastPoint;
  if (!point || point.accuracyMeters == null) throw new Error('Waiting for a recent GPS location. Try again in a moment.');
  const marker = { id: `marker_${randomUUID()}`, sessionId, capturedAt, locationAt: point.recordedAt,
    latitude: point.latitude, longitude: point.longitude, accuracyMeters: point.accuracyMeters, notes: '' };
  if (!validCapturedMarker(marker, snapshot.session.startedAt, null)) throw new Error('Waiting for a recent GPS location. Try again in a moment.');
  saveForegroundMarker(userId, marker);
  return marker.id;
}
