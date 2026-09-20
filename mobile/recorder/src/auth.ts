/**
 * auth.ts - Multi-User Identity & Sign in with Apple
 * 
 * Manages local user identity, multi-account profiles, and Apple Sign-In
 * credential mapping to local-store SQLite tables.
 * 
 * PRIVACY INVARIANT:
 * -----------------
 * Apple subject IDs and email aliases are stored strictly on-device in SQLite.
 * No central auth server or Firebase account is required.
 */

import * as Crypto from 'expo-crypto';
import * as AppleAuthentication from 'expo-apple-authentication';
import {
  LocalUser,
  LocalUserId,
  ensureLocalUser,
  listLocalUsers,
  initializeLocalStore,
  getActiveLocalUserId,
  linkLocalUserToAppleIdentity,
  deleteLocalUserData,
  setActiveLocalUserId,
} from './local-store';
import { isInternalTestingBuild } from './internal-testing';

export { listLocalUsers };

export interface AppleAuthCredential {
  identityToken?: string | null;
  authorizationCode?: string | null;
  user: string; // Apple unique user identifier (sub)
  email?: string | null;
  fullName?: {
    givenName?: string | null;
    familyName?: string | null;
  } | null;
}

export type AuthState = {
  currentUser: LocalUser | null;
  availableUsers: LocalUser[];
  isAuthenticated: boolean;
};

export type AppleIdentityStatus = 'unavailable' | 'signed_out' | 'authorized' | 'revoked' | 'unknown';
const ISOLATION_TEST_PROFILE_PREFIX = 'Isolation Test';

let activeUser: LocalUser | null = null;

/**
 * Initializes the auth session with the most recent local user or creates a default anonymous user.
 */
export function initializeAuth(): LocalUser {
  initializeLocalStore();
  const users = listLocalUsers();
  if (users.length > 0) {
    const savedUserId = getActiveLocalUserId();
    activeUser = users.find(user => user.id === savedUserId) ?? users[0]!;
  } else {
    activeUser = ensureLocalUser({ displayName: 'Primary Driver' });
  }
  setActiveLocalUserId(activeUser.id);
  return activeUser;
}

/**
 * Returns the currently active local user.
 */
export function getCurrentUser(): LocalUser {
  if (!activeUser) {
    return initializeAuth();
  }
  return activeUser;
}

/**
 * Handles Sign in with Apple credential completion and maps it to the local user profile.
 */
export function handleAppleSignInResult(credential: AppleAuthCredential): LocalUser {
  initializeLocalStore();
  const current = getCurrentUser();
  let displayName: string | undefined;

  if (credential.fullName) {
    const parts = [credential.fullName.givenName, credential.fullName.familyName].filter(Boolean);
    if (parts.length > 0) {
      displayName = parts.join(' ');
    }
  }

  const user = linkLocalUserToAppleIdentity(current.id, {
    appleSubject: credential.user,
    email: credential.email || undefined,
    displayName,
  });

  activeUser = user;
  setActiveLocalUserId(user.id);
  return user;
}

/** Starts Apple's native authorization sheet and preserves the active profile's local data. */
export async function signInWithApple(beforeProfileCommit?: () => Promise<void>): Promise<LocalUser> {
  if (!(await AppleAuthentication.isAvailableAsync())) throw new Error('Sign in with Apple is unavailable on this device.');
  const state = Crypto.randomUUID();
  const credential = await AppleAuthentication.signInAsync({
    requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL],
    state,
  });
  if (credential.state !== state) throw new Error('Apple sign-in state validation failed.');
  await beforeProfileCommit?.();
  return handleAppleSignInResult(credential);
}

/** Rechecks Apple's credential state without deleting any local-first data. */
export async function getAppleIdentityStatus(user = getCurrentUser()): Promise<AppleIdentityStatus> {
  if (!(await AppleAuthentication.isAvailableAsync())) return 'unavailable';
  if (!user.appleSubject) return 'signed_out';
  try {
    const state = await AppleAuthentication.getCredentialStateAsync(user.appleSubject);
    if (state === AppleAuthentication.AppleAuthenticationCredentialState.AUTHORIZED) return 'authorized';
    if (state === AppleAuthentication.AppleAuthenticationCredentialState.REVOKED) return 'revoked';
    if (state === AppleAuthentication.AppleAuthenticationCredentialState.NOT_FOUND) return 'signed_out';
    return 'unknown';
  } catch {
    return 'unknown';
  }
}

/**
 * Switches the active local user (for multi-driver or shared household devices).
 */
export function switchActiveUser(userId: LocalUserId): LocalUser | null {
  initializeLocalStore();
  const users = listLocalUsers();
  const found = users.find(u => u.id === userId);
  if (found) {
    activeUser = found;
    setActiveLocalUserId(found.id);
    return found;
  }
  return null;
}

/** Creates a separate, non-destructive local profile for temporary release testing. */
export function createIsolationTestProfile(): LocalUser {
  if (!isInternalTestingBuild()) throw new Error('The Profile Test Lab is available only in internal JourneyDeck builds.');
  const suffix = new Date().toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  const user = ensureLocalUser({ displayName: `${ISOLATION_TEST_PROFILE_PREFIX} · ${suffix}` });
  activeUser = user;
  setActiveLocalUserId(user.id);
  return user;
}

export function isIsolationTestProfile(user = getCurrentUser()): boolean {
  return Boolean(user.displayName?.startsWith(ISOLATION_TEST_PROFILE_PREFIX));
}

/** Leaves an Apple-linked profile intact and enters a new empty local profile. */
export function signOutToFreshLocalProfile(): LocalUser {
  const user = ensureLocalUser({ displayName: 'Local Driver' });
  activeUser = user;
  setActiveLocalUserId(user.id);
  return user;
}

/** Called only after private-cloud, file, recorder, and Keychain deletion succeeds. */
export function finalizeActiveProfileDeletion(userId: LocalUserId): LocalUser {
  if (getCurrentUser().id !== userId) throw new Error('The active profile changed before deletion finished.');
  deleteLocalUserData(userId);
  const remaining = listLocalUsers();
  const next = remaining.find(user => !isIsolationTestProfile(user)) ?? remaining[0] ?? ensureLocalUser({ displayName: 'Local Driver' });
  activeUser = next;
  setActiveLocalUserId(next.id);
  return next;
}
