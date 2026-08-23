import * as SecureStore from 'expo-secure-store';

const MUSIC_PREFERENCES_KEY = 'journeydeck.music.preferences.v1';
const LASTFM_USERNAME_KEY = 'journeydeck.music.lastfm.username.v1';
const secureOptions: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
};

export type MusicProvider = 'apple-music' | 'shazam' | 'lastfm';
export type ApiMusicProvider = 'apple_music' | 'shazam' | 'lastfm';

export type MusicPreferences = {
  provider: MusicProvider | null;
  onboardingCompleted: boolean;
};

const emptyPreferences: MusicPreferences = { provider: null, onboardingCompleted: false };

function isMusicProvider(value: unknown): value is MusicProvider {
  return value === 'apple-music' || value === 'shazam' || value === 'lastfm';
}

export async function loadMusicPreferences(): Promise<MusicPreferences> {
  try {
    const raw = await SecureStore.getItemAsync(MUSIC_PREFERENCES_KEY, secureOptions);
    if (!raw) return emptyPreferences;
    const parsed = JSON.parse(raw) as { provider?: unknown; onboardingCompleted?: unknown };
    return {
      provider: isMusicProvider(parsed.provider) ? parsed.provider : null,
      onboardingCompleted: parsed.onboardingCompleted === true && isMusicProvider(parsed.provider),
    };
  } catch {
    return emptyPreferences;
  }
}

export async function saveMusicPreferences(preferences: MusicPreferences) {
  await SecureStore.setItemAsync(MUSIC_PREFERENCES_KEY, JSON.stringify(preferences), secureOptions);
}

export async function loadLastFmUsername() {
  return (await SecureStore.getItemAsync(LASTFM_USERNAME_KEY, secureOptions) ?? '').trim();
}

export async function saveLastFmUsername(username: string) {
  const normalized = username.trim();
  if (!normalized) {
    await SecureStore.deleteItemAsync(LASTFM_USERNAME_KEY, secureOptions);
    return;
  }
  if (!/^[A-Za-z0-9_-]{1,32}$/.test(normalized)) {
    throw new Error('Enter a valid Last.fm username using letters, numbers, underscores, or hyphens.');
  }
  await SecureStore.setItemAsync(LASTFM_USERNAME_KEY, normalized, secureOptions);
}

export function toApiMusicProvider(provider: MusicProvider): ApiMusicProvider {
  return provider === 'apple-music' ? 'apple_music' : provider;
}

export function fromApiMusicProvider(provider: ApiMusicProvider | null | undefined): MusicProvider | null {
  return provider === 'apple_music' ? 'apple-music' : isMusicProvider(provider) ? provider : null;
}
