import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { getPrivatePreference, upsertPrivatePreference } from './local-store';
import { appLinkDigestInputs, CONNECTOR_APP_LINK_KEY, encodeAppLinkSecret, isAppLinkSecret, parseAppLink } from './connector-connections-model';

/**
 * The secret that lets this iPhone manage the profile's connected assistants
 * (connector-connections-model.ts). It stays in the Keychain on this device;
 * only its SHA-256 digests sync to iCloud, where the connector reads them.
 * Another iPhone on the same account makes its own secret and takes over the
 * link; the earlier phone gets "not linked" until it opens this screen again.
 */
const secretKey = (profileId: string) => `journeydeck.connector-link.${profileId.replace(/[^A-Za-z0-9._-]/g, '_')}`;

async function digest(text: string): Promise<string> {
  return (await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, text)).toLowerCase();
}

/** Returns the secret, creating it and saving its digests as a private preference (synced on the next iCloud sync). */
export async function ensureConnectorAppLink(profileId: string): Promise<string> {
  let secret = await SecureStore.getItemAsync(secretKey(profileId)).catch(() => null);
  if (!isAppLinkSecret(secret)) {
    secret = encodeAppLinkSecret(Crypto.getRandomBytes(32));
    await SecureStore.setItemAsync(secretKey(profileId), secret, { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY });
  }
  const inputs = appLinkDigestInputs(secret);
  const link = { id: await digest(inputs.id), verifier: await digest(inputs.verifier) };
  const saved = parseAppLink(getPrivatePreference<unknown>(profileId, CONNECTOR_APP_LINK_KEY));
  if (saved?.id !== link.id || saved.verifier !== link.verifier) upsertPrivatePreference(profileId, CONNECTOR_APP_LINK_KEY, link);
  return secret;
}
