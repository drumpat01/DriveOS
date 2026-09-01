export type NativeRecorderAuthorization = 'always' | 'when_in_use' | 'denied' | 'restricted' | 'not_determined';

export type NativeRecorderStatus = {
  nativeModuleAvailable: boolean;
  configured: boolean;
  enabled: boolean;
  significantMonitoring: boolean;
  preciseTracking: boolean;
  recording: boolean;
  paused: boolean;
  sessionId: string | null;
  authorization: NativeRecorderAuthorization;
  lastEvent: 'started' | 'finished' | 'start_failed' | null;
  lastEventAt: string | null;
  lastErrorCode: string | null;
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
