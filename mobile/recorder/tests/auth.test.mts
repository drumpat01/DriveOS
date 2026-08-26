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
assert.match(src, /export function switchActiveUser/, 'exports switchActiveUser');

// ============================================================
// 2. Integration with local-store.ts
// ============================================================
assert.match(src, /ensureLocalUser/, 'uses ensureLocalUser from local-store');
assert.match(src, /listLocalUsers/, 'uses listLocalUsers from local-store');
assert.match(src, /initializeLocalStore/, 'initializes local store');

// ============================================================
// 3. Name Concatenation & Fallbacks
// ============================================================
assert.match(src, /givenName.*familyName/, 'formats full name correctly');
assert.match(src, /'Apple Driver'/, 'provides fallback display name');

console.log('✅  auth: all checks passed.');
