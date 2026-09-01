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
