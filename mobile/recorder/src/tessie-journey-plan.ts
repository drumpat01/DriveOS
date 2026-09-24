import type { TessieChargeSnapshot, TessieDriveSnapshot, TessieSnapshot } from './tessie-contract';

export type TessieJourneyPlan = { drive: TessieDriveSnapshot; charges: TessieChargeSnapshot[] };

const MIN_DRIVE_MS = 30_000;
const CHARGE_ARRIVAL_GAP_MS = 45 * 60_000;
const CHARGE_DEPARTURE_GAP_MS = 2 * 60_000;

/** A drive is one journey. Duplicate provider rows never create a second journey. */
export function planTessieJourneys(snapshot: TessieSnapshot): TessieJourneyPlan[] {
  const byId = new Map<string, TessieDriveSnapshot>();
  for (const drive of snapshot.drives) {
    const duration = Date.parse(drive.endedAt) - Date.parse(drive.startedAt);
    if (duration < MIN_DRIVE_MS) continue;
    const previous = byId.get(drive.id);
    if (!previous || duration > Date.parse(previous.endedAt) - Date.parse(previous.startedAt)) byId.set(drive.id, drive);
  }
  const drives = [...byId.values()]
    .sort((a, b) => a.vehicleKey.localeCompare(b.vehicleKey) || a.startedAt.localeCompare(b.startedAt) || a.id.localeCompare(b.id));
  const accepted: TessieDriveSnapshot[] = [];
  for (const drive of drives) {
    const previous = accepted.at(-1);
    // Two opaque IDs can describe the same partial/provider-replayed drive.
    if (previous?.vehicleKey === drive.vehicleKey) {
      const overlap = Math.min(Date.parse(previous.endedAt), Date.parse(drive.endedAt))
        - Math.max(Date.parse(previous.startedAt), Date.parse(drive.startedAt));
      const shorter = Math.min(Date.parse(previous.endedAt) - Date.parse(previous.startedAt), Date.parse(drive.endedAt) - Date.parse(drive.startedAt));
      if (overlap > 0 && overlap / shorter >= 0.8) {
        // Prefer the more complete interval, retaining a stable tie break.
        if (Date.parse(drive.endedAt) - Date.parse(drive.startedAt) > Date.parse(previous.endedAt) - Date.parse(previous.startedAt)) accepted[accepted.length - 1] = drive;
        continue;
      }
    }
    accepted.push(drive);
  }
  const plans = accepted.map(drive => ({ drive, charges: [] as TessieChargeSnapshot[] }));
  const seenCharges = new Set<string>();
  for (const charge of [...snapshot.charges].sort((a, b) => a.startedAt.localeCompare(b.startedAt) || a.id.localeCompare(b.id))) {
    if (!charge.isSupercharger || seenCharges.has(charge.id)) continue;
    seenCharges.add(charge.id);
    const started = Date.parse(charge.startedAt), ended = Date.parse(charge.endedAt);
    const candidates = plans.filter(plan => plan.drive.vehicleKey === charge.vehicleKey
      && started >= Date.parse(plan.drive.endedAt)
      && started - Date.parse(plan.drive.endedAt) <= CHARGE_ARRIVAL_GAP_MS);
    const prior = candidates.at(-1);
    if (!prior) continue;
    const next = plans.find(plan => plan.drive.vehicleKey === charge.vehicleKey && Date.parse(plan.drive.startedAt) > Date.parse(prior.drive.startedAt));
    // A charging session overlapping a subsequent drive is ambiguous. Never
    // attach it to an unrelated earlier trip or another vehicle.
    if (next && (started >= Date.parse(next.drive.startedAt) || ended > Date.parse(next.drive.startedAt) + CHARGE_DEPARTURE_GAP_MS)) continue;
    prior.charges.push(charge);
  }
  return plans;
}

export function tessieJourneyId(userId: string, driveId: string): string {
  let first = 0x811c9dc5, second = 0x9e3779b9;
  for (let index = 0; index < userId.length; index++) {
    const code = userId.charCodeAt(index);
    first = Math.imul(first ^ code, 0x01000193);
    second = Math.imul(second ^ code, 0x85ebca6b);
  }
  return `tessie_${(first >>> 0).toString(16)}${(second >>> 0).toString(16)}_${driveId}`;
}
