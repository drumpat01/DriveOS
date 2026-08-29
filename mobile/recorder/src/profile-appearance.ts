import { getPrivatePreference, upsertPrivatePreference, type LocalUser } from './local-store';

const PROFILE_APPEARANCE_KEY = 'profile.appearance';
const MAX_AVATAR_DATA_URI_LENGTH = 420_000;

export type ProfileAppearance = {
  displayName: string;
  avatarDataUri: string | null;
};

function cleanDisplayName(value: unknown, fallback: string) {
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim().replace(/\s+/g, ' ').slice(0, 48);
  return normalized || fallback;
}

function cleanAvatarDataUri(value: unknown) {
  if (typeof value !== 'string' || value.length > MAX_AVATAR_DATA_URI_LENGTH) return null;
  return /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(value) ? value : null;
}

export function loadProfileAppearance(user: LocalUser): ProfileAppearance {
  const fallback = user.displayName?.trim() || 'Primary Driver';
  const stored = getPrivatePreference<Partial<ProfileAppearance>>(user.id, PROFILE_APPEARANCE_KEY);
  return {
    displayName: cleanDisplayName(stored?.displayName, fallback),
    avatarDataUri: cleanAvatarDataUri(stored?.avatarDataUri),
  };
}

export function saveProfileAppearance(user: LocalUser, appearance: ProfileAppearance): ProfileAppearance {
  const fallback = user.displayName?.trim() || 'Primary Driver';
  const normalized = {
    displayName: cleanDisplayName(appearance.displayName, fallback),
    avatarDataUri: cleanAvatarDataUri(appearance.avatarDataUri),
  };
  upsertPrivatePreference(user.id, PROFILE_APPEARANCE_KEY, normalized);
  return normalized;
}
