export type AppIconId = 'original' | 'warm-ivory' | 'rosewater' | 'grand-touring';

export const appIconCatalog: Record<AppIconId, {
  name: string;
  description: string;
  nativeName: string | null;
}> = {
  original: {
    name: 'Cinematic',
    description: 'JourneyDeck pulse',
    nativeName: 'JourneyDeckCinematic',
  },
  'warm-ivory': {
    name: 'Warm Ivory',
    description: 'Ivory glass · plum pulse',
    nativeName: 'JourneyDeckWarmIvory',
  },
  rosewater: {
    name: 'Rosewater',
    description: 'Blush glass · raspberry',
    nativeName: 'JourneyDeckRosewater',
  },
  'grand-touring': {
    name: 'Grand Touring',
    description: 'Blue gradient · champagne trim',
    nativeName: 'JourneyDeckGrandTouring',
  },
};

export const FREE_APP_ICON_IDS: readonly AppIconId[] = ['grand-touring', 'warm-ivory'];
export const PLUS_APP_ICON_IDS: readonly AppIconId[] = ['original', 'rosewater'];
export const APP_ICON_GRID_ORDER: readonly AppIconId[] = [...FREE_APP_ICON_IDS, ...PLUS_APP_ICON_IDS];

export function appIconRequiresPlus(id: AppIconId) {
  return PLUS_APP_ICON_IDS.includes(id);
}

export function parseAppIconId(value: unknown): AppIconId {
  return typeof value === 'string' && Object.hasOwn(appIconCatalog, value) ? value as AppIconId : 'grand-touring';
}

export function appIconIdForNativeName(value: string | null): AppIconId | undefined {
  // The primary icon is Grand Touring. Keep its alternate name for existing
  // installations that already selected it before it became the default.
  if (value === null) return 'grand-touring';
  return (Object.entries(appIconCatalog) as [AppIconId, (typeof appIconCatalog)[AppIconId]][])
    .find(([, icon]) => icon.nativeName === value)?.[0];
}
