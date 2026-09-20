import * as SecureStore from 'expo-secure-store';

export const HOME_GRID_COLUMNS = 12 as const;
export type HomeLayoutClass = 'compact' | 'regular';
export type HomeWidgetId = 'miles' | 'listening' | 'songs' | 'streak' | 'askJourneyDeck' | 'fiftyStates' | 'memories' | 'journeys' | 'soundtrack';
export type HomeWidgetPlacement = { id: HomeWidgetId; span: number; order: number; hidden?: boolean };

const STORAGE_KEY = 'journeydeck.home-grid.v3';
export const HOME_WIDGETS: readonly HomeWidgetId[] = ['memories', 'miles', 'listening', 'songs', 'streak', 'journeys', 'soundtrack'];
export const V3_HOME_WIDGETS: readonly HomeWidgetId[] = ['memories', 'fiftyStates', 'miles', 'listening', 'songs', 'streak', 'journeys', 'soundtrack'];
export const HOME_CONTEXT_WIDGETS: readonly HomeWidgetId[] = ['fiftyStates', 'askJourneyDeck', 'soundtrack'];
export const HOME_SUMMARY_WIDGETS: readonly HomeWidgetId[] = ['miles', 'listening', 'songs', 'streak', 'journeys'];
const allowed: Record<HomeWidgetId, readonly number[]> = {
  miles: [3, 4, 6, 12], listening: [3, 4, 6, 12], songs: [3, 4, 6, 12], streak: [3, 4, 6, 12],
  fiftyStates: [6, 8, 12],
  askJourneyDeck: [6, 8, 12],
  memories: [6, 8, 12], journeys: [6, 8, 12], soundtrack: [6, 8, 12],
};

function widgetCatalog(includeFiftyStates: boolean, includeAsk: boolean) {
  const base = includeFiftyStates ? V3_HOME_WIDGETS : HOME_WIDGETS;
  const contextEnd = includeFiftyStates ? 2 : 1;
  return includeAsk ? [...base.slice(0, contextEnd), 'askJourneyDeck' as const, ...base.slice(contextEnd)] : base;
}

function legacyWidgetCatalog(includeFiftyStates: boolean, includeAsk: boolean): readonly HomeWidgetId[] {
  const base: readonly HomeWidgetId[] = includeFiftyStates
    ? ['miles', 'listening', 'songs', 'streak', 'fiftyStates', 'memories', 'journeys', 'soundtrack']
    : ['miles', 'listening', 'songs', 'streak', 'memories', 'journeys', 'soundtrack'];
  return includeAsk ? [...base.slice(0, 4), 'askJourneyDeck', ...base.slice(4)] : base;
}

export function defaultHomeWidgetLayout(kind: HomeLayoutClass, includeFiftyStates = false, includeAsk = false): HomeWidgetPlacement[] {
  const metric = kind === 'compact' ? 6 : 3;
  return widgetCatalog(includeFiftyStates, includeAsk).map((id, order) => ({ id, order, span: id === 'askJourneyDeck' || id === 'fiftyStates' || id === 'soundtrack' ? 12 : id === 'memories' || id === 'journeys' ? (kind === 'compact' ? 12 : 6) : metric }));
}

function isLegacyDefaultLayout(value: unknown, kind: HomeLayoutClass, includeFiftyStates: boolean, includeAsk: boolean) {
  if (!Array.isArray(value)) return false;
  const metric = kind === 'compact' ? 6 : 3;
  const legacy = legacyWidgetCatalog(includeFiftyStates, includeAsk).map((id, order) => ({
    id, order, span: id === 'askJourneyDeck' || id === 'fiftyStates' || id === 'soundtrack' ? 12 : id === 'memories' || id === 'journeys' ? (kind === 'compact' ? 12 : 6) : metric,
  }));
  return value.length === legacy.length && legacy.every((item, index) => {
    const candidate = value[index];
    return candidate?.id === item.id && candidate?.order === item.order && candidate?.span === item.span && candidate?.hidden !== true;
  });
}

export function normalizeHomeWidgetLayout(value: unknown, kind: HomeLayoutClass, includeFiftyStates = false, includeAsk = false): HomeWidgetPlacement[] {
  const fallback = defaultHomeWidgetLayout(kind, includeFiftyStates, includeAsk);
  const catalog = widgetCatalog(includeFiftyStates, includeAsk);
  if (!Array.isArray(value)) return fallback;
  const seen = new Set<HomeWidgetId>();
  const parsed: HomeWidgetPlacement[] = [];
  for (const candidate of value) {
    const id = candidate?.id as HomeWidgetId;
    if (!catalog.includes(id) || seen.has(id)) continue;
    const sizes = allowed[id];
    const requested = Number(candidate?.span);
    const span = sizes.includes(requested) ? requested : fallback.find(item => item.id === id)!.span;
    const requestedOrder = Number(candidate?.order);
    parsed.push({ id, span, order: Number.isInteger(requestedOrder) && requestedOrder >= 0 ? requestedOrder : parsed.length, ...(candidate?.hidden === true ? { hidden: true } : {}) });
    seen.add(id);
  }
  parsed.sort((left, right) => left.order - right.order);
  for (const item of fallback) if (!seen.has(item.id)) parsed.splice(Math.min(item.order, parsed.length), 0, { ...item });
  return parsed.map((item, order) => ({ ...item, order }));
}

export function moveHomeWidget(layout: HomeWidgetPlacement[], id: HomeWidgetId, offset: number) {
  const next = [...layout], from = next.findIndex(item => item.id === id);
  if (from < 0) return next;
  const to = Math.max(0, Math.min(next.length - 1, from + offset));
  const [item] = next.splice(from, 1); next.splice(to, 0, item!); return next.map((placement, order) => ({ ...placement, order }));
}

export function cycleHomeWidgetSpan(layout: HomeWidgetPlacement[], id: HomeWidgetId) {
  return layout.map(item => {
    if (item.id !== id) return item;
    const sizes = allowed[id], index = sizes.indexOf(item.span);
    return { ...item, span: sizes[(index + 1) % sizes.length]! };
  });
}

export function toggleHomeWidget(layout: HomeWidgetPlacement[], id: HomeWidgetId) {
  return layout.map(item => item.id === id ? { ...item, hidden: !item.hidden } : item);
}

export function resizeHomeWidget(layout: HomeWidgetPlacement[], id: HomeWidgetId, span: number) {
  return layout.map(item => item.id === id && allowed[id].includes(span) ? { ...item, span } : item);
}

export function homeWidgetResizeSpan(id: HomeWidgetId, span: number, cellWidth: number, deltaX: number, edge: 'left' | 'right') {
  if (!Number.isFinite(cellWidth) || cellWidth <= 0 || !Number.isFinite(deltaX)) return span;
  const requested = span + deltaX * (edge === 'left' ? -1 : 1) / (cellWidth / span);
  return allowed[id].reduce((best, size) => Math.abs(size - requested) < Math.abs(best - requested) ? size : best, span);
}

export type HomeWidgetRow = { pane: number; placements: HomeWidgetPlacement[]; usedColumns: number };

/** Packs logical spans into rows. A vertical fold is represented as two independent
 * 12-column panes, so no placement can ever straddle the reserved region. */
export function packHomeWidgetRows(layout: HomeWidgetPlacement[], paneCount = 1): HomeWidgetRow[] {
  const visible = [...layout].sort((left, right) => left.order - right.order).filter(item => !item.hidden);
  const rows: HomeWidgetRow[] = [];
  let pane = 0;
  for (const placement of visible) {
    let row = rows.at(-1);
    if (row && row.usedColumns + placement.span > HOME_GRID_COLUMNS) pane = (pane + 1) % Math.max(1, paneCount);
    if (!row || row.usedColumns + placement.span > HOME_GRID_COLUMNS) {
      row = { pane, placements: [], usedColumns: 0 };
      rows.push(row);
    }
    row.placements.push(placement);
    row.usedColumns += placement.span;
  }
  return rows;
}

export function homeWidgetMoveOffset(deltaX: number, deltaY: number, isRTL = false) {
  if (!Number.isFinite(deltaX) || !Number.isFinite(deltaY)) return 0;
  if (Math.max(Math.abs(deltaX), Math.abs(deltaY)) < 24) return 0;
  if (Math.abs(deltaX) >= Math.abs(deltaY)) return (deltaX < 0 ? -1 : 1) * (isRTL ? -1 : 1);
  return deltaY < 0 ? -2 : 2;
}

export type HomePresentation = {
  memory?: HomeWidgetPlacement;
  context?: HomeWidgetPlacement;
  summary: HomeWidgetPlacement[];
};

/** Projects a customizable grid into Home's fixed action → story → context → summary hierarchy. */
export function selectHomePresentation(layout: HomeWidgetPlacement[]): HomePresentation {
  const visible = [...layout].sort((left, right) => left.order - right.order).filter(item => !item.hidden);
  return {
    memory: visible.find(item => item.id === 'memories'),
    context: visible.find(item => HOME_CONTEXT_WIDGETS.includes(item.id)),
    summary: visible.filter(item => HOME_SUMMARY_WIDGETS.includes(item.id)),
  };
}

export type StoredHomeLayouts = Record<HomeLayoutClass, HomeWidgetPlacement[]>;
export function loadHomeWidgetLayouts(includeFiftyStates = false, includeAsk = false): StoredHomeLayouts {
  try {
    const raw = SecureStore.getItem(STORAGE_KEY); const parsed = raw ? JSON.parse(raw) : {};
    return {
      compact: isLegacyDefaultLayout(parsed.compact, 'compact', includeFiftyStates, includeAsk) ? defaultHomeWidgetLayout('compact', includeFiftyStates, includeAsk) : normalizeHomeWidgetLayout(parsed.compact, 'compact', includeFiftyStates, includeAsk),
      regular: isLegacyDefaultLayout(parsed.regular, 'regular', includeFiftyStates, includeAsk) ? defaultHomeWidgetLayout('regular', includeFiftyStates, includeAsk) : normalizeHomeWidgetLayout(parsed.regular, 'regular', includeFiftyStates, includeAsk),
    };
  } catch { return { compact: defaultHomeWidgetLayout('compact', includeFiftyStates, includeAsk), regular: defaultHomeWidgetLayout('regular', includeFiftyStates, includeAsk) }; }
}
export function saveHomeWidgetLayouts(layouts: StoredHomeLayouts) { SecureStore.setItem(STORAGE_KEY, JSON.stringify(layouts)); }
