export const US_STATES = [
  ['AL', 'Alabama'], ['AK', 'Alaska'], ['AZ', 'Arizona'], ['AR', 'Arkansas'], ['CA', 'California'],
  ['CO', 'Colorado'], ['CT', 'Connecticut'], ['DE', 'Delaware'], ['FL', 'Florida'], ['GA', 'Georgia'],
  ['HI', 'Hawaii'], ['ID', 'Idaho'], ['IL', 'Illinois'], ['IN', 'Indiana'], ['IA', 'Iowa'],
  ['KS', 'Kansas'], ['KY', 'Kentucky'], ['LA', 'Louisiana'], ['ME', 'Maine'], ['MD', 'Maryland'],
  ['MA', 'Massachusetts'], ['MI', 'Michigan'], ['MN', 'Minnesota'], ['MS', 'Mississippi'], ['MO', 'Missouri'],
  ['MT', 'Montana'], ['NE', 'Nebraska'], ['NV', 'Nevada'], ['NH', 'New Hampshire'], ['NJ', 'New Jersey'],
  ['NM', 'New Mexico'], ['NY', 'New York'], ['NC', 'North Carolina'], ['ND', 'North Dakota'], ['OH', 'Ohio'],
  ['OK', 'Oklahoma'], ['OR', 'Oregon'], ['PA', 'Pennsylvania'], ['RI', 'Rhode Island'], ['SC', 'South Carolina'],
  ['SD', 'South Dakota'], ['TN', 'Tennessee'], ['TX', 'Texas'], ['UT', 'Utah'], ['VT', 'Vermont'],
  ['VA', 'Virginia'], ['WA', 'Washington'], ['WV', 'West Virginia'], ['WI', 'Wisconsin'], ['WY', 'Wyoming'],
] as const;

export type USStateCode = typeof US_STATES[number][0];
export type FiftyStatesFilter = 'all' | 'seen' | 'remaining';

export type FiftyStatesProgress = { seen: USStateCode[]; completedAt: string | null };
const validTimestamp = (value: unknown): value is string => typeof value === 'string' && Number.isFinite(Date.parse(value));

/** Older complete checklists use their last saved date; never invent an earning date. */
export function normalizeFiftyStatesProgress(value: unknown): FiftyStatesProgress {
  const stored = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const seen = normalizeSeenStates(stored.seen);
  const completedAt = validTimestamp(stored.completedAt) ? stored.completedAt
    : seen.length === US_STATES.length && validTimestamp(stored.updatedAt) ? stored.updatedAt : null;
  return { seen, completedAt };
}

export function updateFiftyStatesProgress(previous: unknown, value: unknown, now: string) {
  const seen = normalizeSeenStates(value);
  const completedAt = normalizeFiftyStatesProgress(previous).completedAt
    ?? (seen.length === US_STATES.length && validTimestamp(now) ? now : null);
  return { seen, completedAt, updatedAt: now };
}

const stateCodes = new Set<string>(US_STATES.map(([code]) => code));
const stateOrder = new Map<string, number>(US_STATES.map(([code], index) => [code, index]));

export function normalizeSeenStates(value: unknown): USStateCode[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((code): code is USStateCode => typeof code === 'string' && stateCodes.has(code)))]
    .sort((left, right) => stateOrder.get(left)! - stateOrder.get(right)!);
}

export function toggleSeenState(seen: readonly USStateCode[], code: USStateCode): USStateCode[] {
  const next = new Set(normalizeSeenStates(seen));
  if (next.has(code)) next.delete(code); else next.add(code);
  return normalizeSeenStates([...next]);
}

export function filterUSStates(seen: readonly USStateCode[], filter: FiftyStatesFilter) {
  const selected = new Set(seen);
  return US_STATES.filter(([code]) => filter === 'all' || (filter === 'seen' ? selected.has(code) : !selected.has(code)));
}

export const FIFTY_STATES_MAP_POSITIONS: Readonly<Record<USStateCode, readonly [number, number]>> = {
  WA: [0, 0], MT: [0, 2], ND: [0, 3], MN: [0, 4], WI: [0, 5], MI: [0, 6], VT: [0, 9], NH: [0, 10], ME: [0, 11],
  OR: [1, 0], ID: [1, 1], WY: [1, 2], SD: [1, 3], IA: [1, 4], IL: [1, 5], IN: [1, 6], OH: [1, 7], PA: [1, 8], NY: [1, 9], MA: [1, 10],
  CA: [2, 0], NV: [2, 1], UT: [2, 2], CO: [2, 3], NE: [2, 4], MO: [2, 5], KY: [2, 6], WV: [2, 7], VA: [2, 8], NJ: [2, 9], CT: [2, 10], RI: [2, 11],
  AZ: [3, 1], NM: [3, 2], KS: [3, 3], OK: [3, 4], AR: [3, 5], TN: [3, 6], NC: [3, 8], DE: [3, 9], MD: [3, 10],
  TX: [4, 3], LA: [4, 5], MS: [4, 6], AL: [4, 7], GA: [4, 8], SC: [4, 9], FL: [4, 10],
  AK: [5, 0], HI: [5, 2],
};
