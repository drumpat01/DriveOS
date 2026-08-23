import { NativeModule, requireOptionalNativeModule } from 'expo';

import type {
  AppleMusicRecentSong,
  CurrentAppleMusicTrack,
  JourneyDeckMusicCapabilityStatus,
  MusicPermissionStatus,
  ShazamRecognitionResult,
} from './JourneyDeckMusic.types';

declare class JourneyDeckMusicModule extends NativeModule<{}> {
  getCapabilityStatusAsync(): Promise<JourneyDeckMusicCapabilityStatus>;
  requestAppleMusicAuthorizationAsync(): Promise<MusicPermissionStatus>;
  getAppleMusicRecentSongsAsync(limit: number): Promise<AppleMusicRecentSong[]>;
  getCurrentAppleMusicTrackAsync(): Promise<CurrentAppleMusicTrack>;
  getMicrophonePermissionStatusAsync(): Promise<MusicPermissionStatus>;
  requestMicrophonePermissionAsync(): Promise<MusicPermissionStatus>;
  recognizeMusicAsync(durationMilliseconds: number): Promise<ShazamRecognitionResult>;
}

export default requireOptionalNativeModule<JourneyDeckMusicModule>('JourneyDeckMusic');
