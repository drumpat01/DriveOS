import * as SecureStore from 'expo-secure-store';
import { getCurrentUser, isIsolationTestProfile } from './auth';

const secureOptions: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY };

function profileKey(base: string, userId = getCurrentUser().id) {
  let hash = 2166136261;
  for (const character of userId) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  return `${base}.profile.${(hash >>> 0).toString(16)}`;
}

/** Reads this profile's secret and lets exactly one existing profile claim a legacy global value. */
export async function loadProfileSecret(base: string): Promise<string | null> {
  const user = getCurrentUser();
  const scoped = await SecureStore.getItemAsync(profileKey(base, user.id), secureOptions);
  if (getCurrentUser().id !== user.id) return null;
  if (scoped) return scoped;
  const ownerKey = `${base}.legacy-owner-v1`;
  const [ownerId, legacy] = await Promise.all([
    SecureStore.getItemAsync(ownerKey, secureOptions), SecureStore.getItemAsync(base, secureOptions),
  ]);
  if (getCurrentUser().id !== user.id || !legacy || isIsolationTestProfile(user) || (ownerId && ownerId !== user.id)) return null;
  await Promise.all([
    SecureStore.setItemAsync(ownerKey, user.id, secureOptions),
    SecureStore.setItemAsync(profileKey(base, user.id), legacy, secureOptions),
  ]);
  return getCurrentUser().id === user.id ? legacy : null;
}

export async function saveProfileSecret(base: string, value: string): Promise<void> {
  await SecureStore.setItemAsync(profileKey(base), value, secureOptions);
}

/** Keep a verified connection scoped to the profile that began an async request. */
export async function saveProfileSecretForUser(base: string, value: string, userId: string): Promise<void> {
  await SecureStore.setItemAsync(profileKey(base, userId), value, secureOptions);
}

export async function deleteProfileSecret(base: string): Promise<void> {
  await SecureStore.deleteItemAsync(profileKey(base), secureOptions);
}

export async function deleteProfileSecretForUser(base: string, userId: string): Promise<void> {
  await SecureStore.deleteItemAsync(profileKey(base, userId), secureOptions);
}

/** Used only by explicit account deletion; also removes a legacy value owned by this profile. */
export async function deleteProfileSecretAndOwnedLegacy(base: string, userId = getCurrentUser().id): Promise<void> {
  const ownerKey = `${base}.legacy-owner-v1`;
  const ownerId = await SecureStore.getItemAsync(ownerKey, secureOptions);
  await SecureStore.deleteItemAsync(profileKey(base, userId), secureOptions);
  if (ownerId === userId) {
    await Promise.all([
      SecureStore.deleteItemAsync(base, secureOptions),
      SecureStore.deleteItemAsync(ownerKey, secureOptions),
    ]);
  }
}
