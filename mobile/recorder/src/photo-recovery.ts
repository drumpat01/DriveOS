// When a saved photo's file is missing on this device but the photo is backed up in iCloud, the next iCloud sync
// re-reads every record from the start (not just changes), so iCloud's copy of each photo is downloaded again and
// the local record is pointed at it (cloudkit-sync.ts ingestRemoteRecords). Runs at most once per app session.

let requested = false;
let triggered = false;
let trigger: (() => void) | null = null;

export function requestMissingPhotoRecovery() {
  if (triggered) return;
  triggered = true;
  requested = true;
  trigger?.();
}

export function missingPhotoRecoveryRequested() {
  return requested;
}

/** Called after a sync that re-read every zone from the start. */
export function completeMissingPhotoRecovery() {
  requested = false;
}

/** icloud-sync.ts registers how to start a sync. */
export function onMissingPhotoRecovery(start: () => void) {
  trigger = start;
  if (requested) start();
}
