export type NativeRecorderAuthorization = 'always' | 'when_in_use' | 'denied' | 'restricted' | 'not_determined';

export type NativeRecorderStatus = {
  eventStreamId?: string;
  eventSequence?: number;
  controlToken?: string;
  commandJournalVersion?: number;
  command?: RecorderCommandOutcome;
  nativeModuleAvailable: boolean;
  /** Absent only in older native implementations; false means the inbox could not be read. */
  statusReliable?: boolean;
  configured: boolean;
  enabled: boolean;
  significantMonitoring: boolean;
  preciseTracking: boolean;
  recording: boolean;
  paused: boolean;
  sessionId: string | null;
  authorization: NativeRecorderAuthorization;
  lastEvent: 'started' | 'finished' | 'start_failed' | 'manual_started' | 'manual_finished' | 'manual_auto_finished' | null;
  lastEventAt: string | null;
  lastErrorCode: string | null;
};

export type NativeRecorderStatusEvent = {
  streamId: string;
  sequence: number;
  journeyId: string | null;
  status: 'recording' | 'paused' | 'finished' | 'failed';
  occurredAt: string;
};

export type RecorderCommandOutcome = {
  operationId?: string;
  action?: 'start' | 'pause' | 'resume' | 'finish';
  sessionId?: string;
  state: 'unknown' | 'pending' | 'applied' | 'rejected';
  errorCode?: string | null;
};

export type NativeRecorderInboxPoint = {
  sequence: number;
  recordedAt: string;
  latitude: number;
  longitude: number;
  accuracyMeters: number | null;
  altitudeMeters: number | null;
  headingDegrees: number | null;
  speedMps: number | null;
};

export type NativeRecorderInboxSession = {
  id: string;
  ownerUserId: string;
  deviceId: string;
  status: 'recording' | 'paused' | 'finishing' | 'completed';
  startedAt: string;
  endedAt: string | null;
  nextSequence: number;
  createdAt: string;
  updatedAt: string;
  points: NativeRecorderInboxPoint[];
  markers?: import('../../../src/journey-marker-model').CapturedJourneyMarker[];
};

export type NativeRecorderInboxExport = {
  sessions: NativeRecorderInboxSession[];
  errorCode: string | null;
};

export type NativeMapKitPointOfInterest = {
  name: string;
  latitude: number;
  longitude: number;
  distanceMeters: number;
  category: string | null;
};
