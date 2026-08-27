/**
 * auth.test.mts
 * 
 * Tests for the multi-user identity management and Sign in with Apple profile integration.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(resolve(__dir, '../src/auth.ts'), 'utf8');

// ============================================================
// 1. Exports
// ============================================================
assert.match(src, /export interface AppleAuthCredential/, 'exports AppleAuthCredential');
assert.match(src, /export function initializeAuth/, 'exports initializeAuth');
assert.match(src, /export function getCurrentUser/, 'exports getCurrentUser');
assert.match(src, /export function handleAppleSignInResult/, 'exports handleAppleSignInResult');
assert.match(src, /export async function signInWithApple/, 'exports the real native Apple sign-in flow');
assert.match(src, /export async function getAppleIdentityStatus/, 'exports Apple credential-state checks');
assert.match(src, /export function switchActiveUser/, 'exports switchActiveUser');

// ============================================================
// 2. Integration with local-store.ts
// ============================================================
assert.match(src, /ensureLocalUser/, 'uses ensureLocalUser from local-store');
assert.match(src, /listLocalUsers/, 'uses listLocalUsers from local-store');
assert.match(src, /getActiveLocalUserId/, 'restores the persisted active profile');
assert.match(src, /setActiveLocalUserId/, 'persists profile changes across launches');
assert.match(src, /initializeLocalStore/, 'initializes local store');
assert.match(src, /linkLocalUserToAppleIdentity\(current\.id/, 'links Apple identity onto the active local profile');
assert.match(readFileSync(resolve(__dir, '../src/local-store.ts'), 'utf8'), /localUser\.appleSubject !== input\.appleSubject[\s\S]*synced_to_cloud=0/, 're-queues local records when Apple identity changes the private cloud scope');

// ============================================================
// 3. Native Apple flow, name handling, and token privacy
// ============================================================
assert.match(src, /givenName.*familyName/, 'formats full name correctly');
assert.match(src, /AppleAuthentication\.signInAsync/, 'opens the native Apple authorization sheet');
assert.match(src, /AppleAuthentication\.getCredentialStateAsync/, 'checks revocation against Apple');
assert.match(src, /Crypto\.randomUUID\(\)/, 'binds the request to a random state value');
assert.match(src, /credential\.state !== state/, 'validates the returned state value');
assert.doesNotMatch(src, /identityToken\s*[,)]|authorizationCode\s*[,)]/, 'does not persist Apple credentials');
assert.doesNotMatch(src, /displayName: displayName \|\|/, 'preserves the existing local display name when Apple only returns a name once');

console.log('✅  auth: all checks passed.');
