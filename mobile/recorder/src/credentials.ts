import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { getCurrentUser } from './auth';

const SERVER_KEY = 'journeydeck.recorder.server';
const TOKEN_KEY = 'journeydeck.recorder.token';
const DEVICE_KEY = 'journeydeck.recorder.device';
const CONNECTION_OWNER_KEY = 'journeydeck.recorder.connection-owner-v1';
const secureOptions: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY };

export type Connection = { serverUrl: string; token: string; deviceId: string };

function profileKey(base: string) {
  let hash = 2166136261;
  for (const character of getCurrentUser().id) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  return `${base}.${(hash >>> 0).toString(16)}`;
}

/** A local recorder identity exists even when no legacy JourneyDeck server is configured. */
export async function loadOrCreateDeviceId(): Promise<string> {
  const savedDeviceId = await SecureStore.getItemAsync(DEVICE_KEY, secureOptions);
  if (savedDeviceId) return savedDeviceId;
  const deviceId = `iphone_${Crypto.randomUUID()}`;
  await SecureStore.setItemAsync(DEVICE_KEY, deviceId, secureOptions);
  return deviceId;
}

export async function loadConnection(): Promise<Connection | null> {
  const scopedServerKey = profileKey(SERVER_KEY), scopedTokenKey = profileKey(TOKEN_KEY);
  let [serverUrl, token] = await Promise.all([
    SecureStore.getItemAsync(scopedServerKey, secureOptions), SecureStore.getItemAsync(scopedTokenKey, secureOptions),
  ]);
  if (!serverUrl || !token) {
    const [ownerId, legacyServer, legacyToken] = await Promise.all([
      SecureStore.getItemAsync(CONNECTION_OWNER_KEY, secureOptions), SecureStore.getItemAsync(SERVER_KEY, secureOptions), SecureStore.getItemAsync(TOKEN_KEY, secureOptions),
    ]);
    if (legacyServer && legacyToken && (!ownerId || ownerId === getCurrentUser().id)) {
      serverUrl = legacyServer; token = legacyToken;
      await Promise.all([
        SecureStore.setItemAsync(CONNECTION_OWNER_KEY, getCurrentUser().id, secureOptions),
        SecureStore.setItemAsync(scopedServerKey, legacyServer, secureOptions), SecureStore.setItemAsync(scopedTokenKey, legacyToken, secureOptions),
      ]);
    }
  }
  if (!serverUrl || !token) return null;
  const deviceId = await loadOrCreateDeviceId();
  return { serverUrl, token, deviceId };
}

export async function saveConnection(value: Omit<Connection, 'deviceId'>): Promise<Connection> {
  const deviceId = await loadOrCreateDeviceId();
  await Promise.all([
    SecureStore.setItemAsync(profileKey(SERVER_KEY), value.serverUrl, secureOptions), SecureStore.setItemAsync(profileKey(TOKEN_KEY), value.token, secureOptions),
    SecureStore.setItemAsync(CONNECTION_OWNER_KEY, getCurrentUser().id, secureOptions), SecureStore.setItemAsync(DEVICE_KEY, deviceId, secureOptions),
  ]);
  return { ...value, deviceId };
}

export async function deleteCurrentProfileConnection(): Promise<void> {
  const currentUserId = getCurrentUser().id;
  const ownerId = await SecureStore.getItemAsync(CONNECTION_OWNER_KEY, secureOptions);
  await Promise.all([
    SecureStore.deleteItemAsync(profileKey(SERVER_KEY), secureOptions),
    SecureStore.deleteItemAsync(profileKey(TOKEN_KEY), secureOptions),
  ]);
  if (ownerId === currentUserId) {
    await Promise.all([
      SecureStore.deleteItemAsync(SERVER_KEY, secureOptions),
      SecureStore.deleteItemAsync(TOKEN_KEY, secureOptions),
      SecureStore.deleteItemAsync(CONNECTION_OWNER_KEY, secureOptions),
    ]);
  }
}
