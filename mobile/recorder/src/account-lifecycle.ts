import * as FileSystem from 'expo-file-system/legacy';
import { File } from 'expo-file-system';

import { finalizeActiveProfileDeletion, getCurrentUser, signOutToFreshLocalProfile } from './auth';
import { resetAutomaticDriveState } from './automatic-drive-state';
import { deleteCurrentProfileConnection, loadOrCreateDeviceId } from './credentials';
import { deletePrivateCloudDataForUser } from './icloud-sync';
import { listPhotosIncludingDeleted, type LocalUser } from './local-store';
import { deleteCurrentProfileMusicSecrets } from './music-preferences';
import { deleteCurrentProfileSpotifySecrets } from './spotify-direct';
import { activeSession, deleteCurrentProfileRecorderData } from './storage';
import { deleteCurrentProfileTessieSecrets } from './tessie-direct';
import { stopAutomaticDetection, stopLocationTracking } from './tracking';
import { deletePrivateRouteStagingAssets } from './cloudkit-sync';
import { configureNativeAutomaticRecorder } from '../modules/journeydeck-recorder';
import { syncNativeRecorderInbox } from './native-recorder-inbox';

async function stopProfileBackgroundWork(): Promise<void> {
  // Keep Core Location task transitions serialized. Concurrent stop calls can
  // race inside expo-location on a real device during a profile handoff.
  await stopLocationTracking();
  await stopAutomaticDetection();
  await configureNativeAutomaticRecorder(false, getCurrentUser().id, await loadOrCreateDeviceId());
  resetAutomaticDriveState();
}

export async function prepareForProfileSwitch(): Promise<void> {
  await syncNativeRecorderInbox();
  if (activeSession()) throw new Error('Finish or discard the active journey before switching profiles.');
  await stopProfileBackgroundWork();
}

export async function signOutOfJourneyDeck(): Promise<LocalUser> {
  await prepareForProfileSwitch();
  return signOutToFreshLocalProfile();
}

export async function deleteCurrentJourneyDeckAccount(): Promise<LocalUser> {
  const user = getCurrentUser();
  await syncNativeRecorderInbox();
  if (activeSession()) throw new Error('Finish or discard the active journey before deleting this account.');
  const localPhotoUris = listPhotosIncludingDeleted(user.id)
    .map(photo => photo.localUri)
    .filter((uri): uri is string => Boolean(uri?.startsWith('file://')));

  // Delete the private CloudKit zone first. Failing closed prevents a local wipe
  // from leaving an inaccessible cloud copy behind.
  await stopProfileBackgroundWork();
  await deletePrivateCloudDataForUser(user);
  await deletePrivateRouteStagingAssets(user.id);
  for (const uri of [...new Set(localPhotoUris)]) {
    // Do not orphan private photos after claiming account deletion succeeded.
    // A failed file removal leaves the local profile intact so it can retry.
    const file = new File(uri);
    if (file.exists) file.delete();
  }
  await Promise.all([
    deleteCurrentProfileConnection(),
    deleteCurrentProfileMusicSecrets(),
    deleteCurrentProfileSpotifySecrets(),
    deleteCurrentProfileTessieSecrets(),
  ]);
  deleteCurrentProfileRecorderData();
  return finalizeActiveProfileDeletion(user.id);
}
