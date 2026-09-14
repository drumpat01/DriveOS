import * as Crypto from 'expo-crypto';
import type { LocalUser } from './local-store';

export async function privateCloudProfileScope(user: LocalUser): Promise<string> {
  const stableIdentity = user.appleSubject ? `apple:${user.appleSubject}` : `local:${user.id}`;
  return (await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `journeydeck-profile:${stableIdentity}`)).slice(0, 48);
}
