export type MusicPermissionStatus =
  | 'not_determined'
  | 'denied'
  | 'restricted'
  | 'authorized'
  | 'unknown';

export type JourneyDeckMusicCapabilityStatus = {
  nativeModuleAvailable: boolean;
  appleMusicAvailable: boolean;
  appleMusicAuthorizationStatus: MusicPermissionStatus;
  shazamKitAvailable: boolean;
  microphonePermissionStatus: MusicPermissionStatus;
  minimumRecognitionMilliseconds: number;
  maximumRecognitionMilliseconds: number;
  requiresAppleMusicAppService: boolean;
  requiresShazamKitAppService: boolean;
};

export type AppleMusicRecentSong = {
  id: string;
  title: string;
  artist: string;
  album?: string;
  durationSeconds?: number;
  lastPlayedAt?: string;
  retrievedAt: string;
  genres: string[];
  isrc?: string;
  artworkUrl?: string;
  appleMusicUrl?: string;
};

export type CurrentAppleMusicTrack = {
  available: boolean;
  reason?: 'not_authorized' | 'nothing_playing';
  sampledAt: string;
  estimatedStartedAt?: string;
  playbackState:
    | 'stopped'
    | 'playing'
    | 'paused'
    | 'interrupted'
    | 'seeking_forward'
    | 'seeking_backward'
    | 'unknown';
  isPlaying: boolean;
  persistentId?: string;
  appleMusicId?: string;
  title?: string;
  artist?: string;
  album?: string;
  durationSeconds?: number;
  playbackTimeSeconds?: number;
  lastPlayedAt?: string;
  artworkUrl?: string;
  appleMusicUrl?: string;
};

export type ShazamRecognitionResult =
  | {
      status: 'no_match';
      recognizedAt: string;
    }
  | {
      status: 'matched';
      recognizedAt: string;
      title?: string;
      artist?: string;
      genres: string[];
      isrc?: string;
      shazamId?: string;
      appleMusicId?: string;
      artworkUrl?: string;
      appleMusicUrl?: string;
      shazamUrl?: string;
    };
