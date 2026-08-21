import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

const SERVER_KEY = 'journeydeck.recorder.server';
const TOKEN_KEY = 'journeydeck.recorder.token';
const DEVICE_KEY = 'journeydeck.recorder.device';
const secureOptions: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY };

export type Connection = { serverUrl: string; token: string; deviceId: string };

export async function loadConnection(): Promise<Connection | null> {
  const [serverUrl, token, savedDeviceId] = await Promise.all([
    SecureStore.getItemAsync(SERVER_KEY, secureOptions), SecureStore.getItemAsync(TOKEN_KEY, secureOptions), SecureStore.getItemAsync(DEVICE_KEY, secureOptions),
  ]);
  if (!serverUrl || !token) return null;
  const deviceId = savedDeviceId || `iphone_${Crypto.randomUUID()}`;
  if (!savedDeviceId) await SecureStore.setItemAsync(DEVICE_KEY, deviceId, secureOptions);
  return { serverUrl, token, deviceId };
}

export async function saveConnection(value: Omit<Connection, 'deviceId'>): Promise<Connection> {
  let deviceId = await SecureStore.getItemAsync(DEVICE_KEY, secureOptions);
  if (!deviceId) deviceId = `iphone_${Crypto.randomUUID()}`;
  await Promise.all([
    SecureStore.setItemAsync(SERVER_KEY, value.serverUrl, secureOptions), SecureStore.setItemAsync(TOKEN_KEY, value.token, secureOptions), SecureStore.setItemAsync(DEVICE_KEY, deviceId, secureOptions),
  ]);
  return { ...value, deviceId };
}
