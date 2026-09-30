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
  listJourneys,
  listMemories,
  listPhotos,
  setActiveLocalUserId,
} from './local-store';
import { isInternalTestingBuild } from './internal-testing';
import { DEMO_PROFILE_NAME, demoJourneyCount, demoMemoryCount, seedDemoLibrary } from './demo-library';
import { notifyLocalArchiveChanged } from './local-archive-events';
import { DEMO_PHOTO_COUNT, seedDemoPhotos } from './demo-photos';
import { isDirectJourneyMemoryId } from './memory-model';
import * as FileSystem from 'expo-file-system/legacy';

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
/** The sample lives for one launch: a demo profile left over from an earlier launch is removed at startup. */
let demoOpenedThisLaunch = false;

/**
 * Initializes the auth session with the most recent local user or creates a default anonymous user.
 */
export function initializeAuth(): LocalUser {
  initializeLocalStore();
  const users = listLocalUsers();
  if (users.length > 0) {
    const savedUserId = getActiveLocalUserId();
    activeUser = users.find(user => user.id === savedUserId) ?? users.find(user => !isDemoProfile(user)) ?? users[0]!;
    if (isDemoProfile(activeUser) && !demoOpenedThisLaunch) {
      // Real data can only sync into the real profile, so a sample left open from an earlier launch steps aside.
      // Its data stays prepared, so turning it on again is instant.
      activeUser = users.find(user => !isDemoProfile(user)) ?? ensureLocalUser({ displayName: 'Primary Driver' });
    }
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

/** The sample library's profile: separate from the real one, never synced, deleted when the user leaves it. */
export function isDemoProfile(user: LocalUser = getCurrentUser()): boolean {
  return user.displayName === DEMO_PROFILE_NAME && !user.appleSubject;
}

/** Profiles that must never touch iCloud or the Keychain-backed legacy stores. */
export function isSandboxProfile(user = getCurrentUser()): boolean {
  return isIsolationTestProfile(user) || isDemoProfile(user);
}

/** A sample built long ago would show stale dates (Today, This week), so it is rebuilt in the background after a day. */
const DEMO_STALE_MS = 20 * 60 * 60 * 1000;

function completeDemoProfile(candidate: LocalUser | undefined): boolean {
  return Boolean(candidate && Date.now() - Date.parse(candidate.createdAt) < DEMO_STALE_MS
    && listJourneys(candidate.id, { limit: 100 }).items.length >= demoJourneyCount()
    // Count only Memories the app actually shows; an older sample with unreadable ids is rebuilt.
    && listMemories(candidate.id).filter(memory => isDirectJourneyMemoryId(memory.id)).length >= demoMemoryCount()
    && listPhotos(candidate.id).length >= DEMO_PHOTO_COUNT);
}

/** True when the sample is already built and fresh, so turning it on is instant. */
export function isDemoProfileReady(): boolean {
  return completeDemoProfile(listLocalUsers().find(candidate => isDemoProfile(candidate)));
}

let demoPreparation: Promise<void> | null = null;

/**
 * Builds the sample library, its photos and Memories ahead of time in its own profile, without opening it. The real
 * profile stays active; a failure is thrown so it is reported rather than shown half-empty.
 */
export function prepareDemoProfile(): Promise<void> {
  demoPreparation ??= (async () => {
    const existing = listLocalUsers().find(candidate => isDemoProfile(candidate));
    if (completeDemoProfile(existing) || (existing && getCurrentUser().id === existing.id)) return;
    if (existing) removeDemoProfileData(existing.id);
    const created = ensureLocalUser({ displayName: DEMO_PROFILE_NAME });
    try { await seedDemoLibrary(created.id); await seedDemoPhotos(created.id); }
    catch (error) { removeDemoProfileData(created.id); throw error; }
  })().finally(() => { demoPreparation = null; });
  return demoPreparation;
}

/** Opens the sample library. It is normally already prepared, so this only switches profiles. */
export async function enterDemoProfile(): Promise<LocalUser> {
  if (!isDemoProfile()) await prepareDemoProfile();
  const user = listLocalUsers().find(candidate => isDemoProfile(candidate));
  if (!user) throw new Error('The sample library could not be prepared.');
  activeUser = user;
  demoOpenedThisLaunch = true;
  setActiveLocalUserId(user.id);
  return user;
}

function removeDemoProfileData(userId: LocalUserId): void {
  deleteLocalUserData(userId);
  const base = FileSystem.documentDirectory;
  if (base) void FileSystem.deleteAsync(`${base}journeydeck-private-photos/${encodeURIComponent(userId)}/`, { idempotent: true }).catch(() => undefined);
}

/** Returns to the real profile. The sample stays prepared so it can be turned on again instantly. */
export function exitDemoProfile(): LocalUser {
  const demo = getCurrentUser();
  if (!isDemoProfile(demo)) return demo;
  const next = listLocalUsers().find(candidate => !isDemoProfile(candidate)) ?? ensureLocalUser({ displayName: 'Local Driver' });
  activeUser = next;
  setActiveLocalUserId(next.id);
  return next;
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
  // After deleting an account, land on a real profile, never the prepared sample or a test profile.
  const next = remaining.find(user => !isSandboxProfile(user)) ?? ensureLocalUser({ displayName: 'Local Driver' });
  activeUser = next;
  setActiveLocalUserId(next.id);
  return next;
}
