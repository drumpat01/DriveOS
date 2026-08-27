import { getCurrentUser } from './auth';
import { getPrivatePreference, upsertPrivatePreference } from './local-store';
import { deleteProfileSecret, deleteProfileSecretAndOwnedLegacy, loadProfileSecret, saveProfileSecret } from './profile-secure-store';

const MUSIC_PREFERENCES_KEY = 'journeydeck.music.preferences.v1';
const LASTFM_USERNAME_KEY = 'journeydeck.music.lastfm.username.v1';
const LASTFM_CONNECTED_USERNAME_KEY = 'journeydeck.music.lastfm.connected-username.v1';
export type MusicProvider = 'apple-music' | 'shazam' | 'lastfm' | 'spotify-direct';
export type ApiMusicProvider = 'apple_music' | 'shazam' | 'lastfm';

export type MusicPreferences = {
  provider: MusicProvider | null;
  onboardingCompleted: boolean;
};

const emptyPreferences: MusicPreferences = { provider: null, onboardingCompleted: false };

function isMusicProvider(value: unknown): value is MusicProvider {
  return value === 'apple-music' || value === 'shazam' || value === 'lastfm' || value === 'spotify-direct';
}

export async function loadMusicPreferences(): Promise<MusicPreferences> {
  try {
    const local = getPrivatePreference<Partial<MusicPreferences>>(getCurrentUser().id, 'music.capture');
    if (local) return {
      provider: isMusicProvider(local.provider) ? local.provider : null,
      onboardingCompleted: local.onboardingCompleted === true && isMusicProvider(local.provider),
    };
    const raw = await loadProfileSecret(MUSIC_PREFERENCES_KEY);
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
  await saveProfileSecret(MUSIC_PREFERENCES_KEY, JSON.stringify(preferences));
  upsertPrivatePreference(getCurrentUser().id, 'music.capture', preferences);
}

export async function loadLastFmUsername() {
  return (await loadProfileSecret(LASTFM_USERNAME_KEY) ?? '').trim();
}

export async function saveLastFmUsername(username: string) {
  const normalized = username.trim();
  if (!normalized) {
    await Promise.all([deleteProfileSecret(LASTFM_USERNAME_KEY), deleteProfileSecret(LASTFM_CONNECTED_USERNAME_KEY)]);
    return;
  }
  if (!/^[A-Za-z0-9_-]{1,32}$/.test(normalized)) {
    throw new Error('Enter a valid Last.fm username using letters, numbers, underscores, or hyphens.');
  }
  const connected = await loadProfileSecret(LASTFM_CONNECTED_USERNAME_KEY);
  await saveProfileSecret(LASTFM_USERNAME_KEY, normalized);
  if (connected && connected.toLowerCase() !== normalized.toLowerCase()) await deleteProfileSecret(LASTFM_CONNECTED_USERNAME_KEY);
}

export async function markLastFmConnected(username: string) {
  const normalized = username.trim();
  if (/^[A-Za-z0-9_-]{1,32}$/.test(normalized)) await saveProfileSecret(LASTFM_CONNECTED_USERNAME_KEY, normalized);
}

export async function isLastFmConnected(username: string) {
  const connected = await loadProfileSecret(LASTFM_CONNECTED_USERNAME_KEY);
  return Boolean(username && connected && username.toLowerCase() === connected.toLowerCase());
}

export async function deleteCurrentProfileMusicSecrets(): Promise<void> {
  await Promise.all([
    deleteProfileSecretAndOwnedLegacy(MUSIC_PREFERENCES_KEY),
    deleteProfileSecretAndOwnedLegacy(LASTFM_USERNAME_KEY),
    deleteProfileSecretAndOwnedLegacy(LASTFM_CONNECTED_USERNAME_KEY),
  ]);
}

export function toApiMusicProvider(provider: MusicProvider): ApiMusicProvider | null {
  return provider === 'spotify-direct' ? null : provider === 'apple-music' ? 'apple_music' : provider;
}

export function fromApiMusicProvider(provider: ApiMusicProvider | null | undefined): MusicProvider | null {
  return provider === 'apple_music' ? 'apple-music' : isMusicProvider(provider) ? provider : null;
}
