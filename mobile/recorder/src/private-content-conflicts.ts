export type VersionedPrivateRecord = {
  updatedAt: string;
  syncRevision: number;
  deletedAt: string | null;
};

/**
 * Conflict ordering for private user-authored content.
 *
 * Revision is authoritative so device clock skew cannot resurrect an older
 * edit. A deletion wins a same-revision tie, then updatedAt provides the final
 * deterministic ordering for two live edits or two tombstones.
 */
export function resolveVersionedPrivateConflict<T extends VersionedPrivateRecord>(local: T, remote: T): T {
  if (remote.syncRevision !== local.syncRevision) return remote.syncRevision > local.syncRevision ? remote : local;
  if (Boolean(remote.deletedAt) !== Boolean(local.deletedAt)) return remote.deletedAt ? remote : local;
  const localTime = Date.parse(local.updatedAt) || 0;
  const remoteTime = Date.parse(remote.updatedAt) || 0;
  return remoteTime >= localTime ? remote : local;
}

export function uploadAcknowledgementMatches(currentRevision: number, uploadedRevision: number): boolean {
  return Number.isInteger(currentRevision) && currentRevision === uploadedRevision;
}
