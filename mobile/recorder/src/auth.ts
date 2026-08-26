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
import {
  LocalUser,
  LocalUserId,
  ensureLocalUser,
  listLocalUsers,
  initializeLocalStore,
  getActiveLocalUserId,
  setActiveLocalUserId,
} from './local-store';

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
  let displayName: string | undefined;

  if (credential.fullName) {
    const parts = [credential.fullName.givenName, credential.fullName.familyName].filter(Boolean);
    if (parts.length > 0) {
      displayName = parts.join(' ');
    }
  }

  const user = ensureLocalUser({
    appleSubject: credential.user,
    email: credential.email || undefined,
    displayName: displayName || 'Apple Driver',
  });

  activeUser = user;
  setActiveLocalUserId(user.id);
  return user;
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
