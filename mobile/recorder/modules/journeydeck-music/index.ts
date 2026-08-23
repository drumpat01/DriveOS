import JourneyDeckMusicModule from './src/JourneyDeckMusicModule';

export type {
  AppleMusicRecentSong,
  CurrentAppleMusicTrack,
  JourneyDeckMusicCapabilityStatus,
  MusicPermissionStatus,
  ShazamRecognitionResult,
} from './src/JourneyDeckMusic.types';

const unavailableStatus = {
  nativeModuleAvailable: false,
  appleMusicAvailable: false,
  appleMusicAuthorizationStatus: 'unknown',
  shazamKitAvailable: false,
  microphonePermissionStatus: 'unknown',
  minimumRecognitionMilliseconds: 3_000,
  maximumRecognitionMilliseconds: 15_000,
  requiresAppleMusicAppService: true,
  requiresShazamKitAppService: true,
} as const;

export const isJourneyDeckMusicNativeAvailable = JourneyDeckMusicModule !== null;

export async function getMusicCapabilityStatus() {
  return JourneyDeckMusicModule?.getCapabilityStatusAsync() ?? unavailableStatus;
}

export async function authorizeAppleMusic() {
  if (!JourneyDeckMusicModule) throw new Error('Apple Music requires a new native JourneyDeck build.');
  return JourneyDeckMusicModule.requestAppleMusicAuthorizationAsync();
}

export async function getAppleMusicRecentSongs(limit = 25) {
  if (!JourneyDeckMusicModule) throw new Error('Apple Music requires a new native JourneyDeck build.');
  return JourneyDeckMusicModule.getAppleMusicRecentSongsAsync(limit);
}

export async function getCurrentAppleMusicTrack() {
  if (!JourneyDeckMusicModule) throw new Error('Apple Music requires a new native JourneyDeck build.');
  return JourneyDeckMusicModule.getCurrentAppleMusicTrackAsync();
}

export async function getMicrophonePermissionStatus() {
  if (!JourneyDeckMusicModule) return 'unknown' as const;
  return JourneyDeckMusicModule.getMicrophonePermissionStatusAsync();
}

export async function authorizeShazamMicrophone() {
  if (!JourneyDeckMusicModule) throw new Error('Automatic recognition requires a new native JourneyDeck build.');
  return JourneyDeckMusicModule.requestMicrophonePermissionAsync();
}

export async function recognizeMusic(durationMilliseconds = 10_000) {
  if (!JourneyDeckMusicModule) throw new Error('Automatic recognition requires a new native JourneyDeck build.');
  return JourneyDeckMusicModule.recognizeMusicAsync(durationMilliseconds);
}
