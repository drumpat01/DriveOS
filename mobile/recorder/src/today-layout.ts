/** Which cards Today shows, in what order. Pure; storage lives in today-screen. */
export type TodayCardId = 'ask' | 'lastDrive' | 'week' | 'onThisDay' | 'memories' | 'fiftyStates' | 'yourCar' | 'journeyInProgress';
export type TodayCard = { id: TodayCardId; visible: boolean };

export const TODAY_CARD_LABELS: Record<TodayCardId, string> = {
  ask: 'Ask JourneyDeck', lastDrive: 'Last drive', week: 'This week', onThisDay: 'On this day', memories: 'Recent memories',
  fiftyStates: '50 States', yourCar: 'Your car', journeyInProgress: 'Journey in progress',
};

const DEFAULT: TodayCard[] = [
  { id: 'ask', visible: true }, { id: 'lastDrive', visible: true }, { id: 'week', visible: true }, { id: 'onThisDay', visible: true },
  { id: 'memories', visible: true }, { id: 'fiftyStates', visible: false }, { id: 'yourCar', visible: false }, { id: 'journeyInProgress', visible: false },
];

/** Keeps saved order and visibility, drops unknown or unavailable cards, and appends new ones with their defaults. */
export function normalizeTodayLayout(saved: unknown, available: readonly TodayCardId[]): TodayCard[] {
  const allowed = new Set(available);
  const result: TodayCard[] = [];
  if (Array.isArray(saved)) {
    for (const item of saved) {
      const id = (item as TodayCard)?.id;
      if (allowed.has(id) && !result.some(card => card.id === id)) result.push({ id, visible: (item as TodayCard).visible !== false });
    }
  }
  for (const card of DEFAULT) if (allowed.has(card.id) && !result.some(item => item.id === card.id)) result.push({ ...card });
  return result;
}

export function defaultTodayLayout(available: readonly TodayCardId[]) { return normalizeTodayLayout([], available); }

export function moveTodayCard(layout: TodayCard[], id: TodayCardId, delta: -1 | 1): TodayCard[] {
  const index = layout.findIndex(card => card.id === id), target = index + delta;
  if (index < 0 || target < 0 || target >= layout.length) return layout;
  const next = [...layout];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

export function toggleTodayCard(layout: TodayCard[], id: TodayCardId): TodayCard[] {
  return layout.map(card => card.id === id ? { ...card, visible: !card.visible } : card);
}
