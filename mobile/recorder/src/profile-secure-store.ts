import * as SecureStore from 'expo-secure-store';
import { getCurrentUser, isIsolationTestProfile } from './auth';

const secureOptions: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY };

function profileKey(base: string) {
  let hash = 2166136261;
  for (const character of getCurrentUser().id) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  return `${base}.profile.${(hash >>> 0).toString(16)}`;
}

/** Reads this profile's secret and lets exactly one existing profile claim a legacy global value. */
export async function loadProfileSecret(base: string): Promise<string | null> {
  const scoped = await SecureStore.getItemAsync(profileKey(base), secureOptions);
  if (scoped) return scoped;
  const ownerKey = `${base}.legacy-owner-v1`;
  const [ownerId, legacy] = await Promise.all([
    SecureStore.getItemAsync(ownerKey, secureOptions), SecureStore.getItemAsync(base, secureOptions),
  ]);
  if (!legacy || isIsolationTestProfile() || (ownerId && ownerId !== getCurrentUser().id)) return null;
  await Promise.all([
    SecureStore.setItemAsync(ownerKey, getCurrentUser().id, secureOptions),
    SecureStore.setItemAsync(profileKey(base), legacy, secureOptions),
  ]);
  return legacy;
}

export async function saveProfileSecret(base: string, value: string): Promise<void> {
  await SecureStore.setItemAsync(profileKey(base), value, secureOptions);
}

export async function deleteProfileSecret(base: string): Promise<void> {
  await SecureStore.deleteItemAsync(profileKey(base), secureOptions);
}
