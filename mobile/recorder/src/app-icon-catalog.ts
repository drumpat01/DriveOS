export type AppIconId = 'original' | 'warm-ivory' | 'rosewater' | 'grand-touring';

export const appIconCatalog: Record<AppIconId, {
  name: string;
  description: string;
  nativeName: string | null;
}> = {
  original: {
    name: 'Original',
    description: 'JourneyDeck pulse',
    nativeName: null,
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
    description: 'Navy carbon · champagne',
    nativeName: 'JourneyDeckGrandTouring',
  },
};

export function parseAppIconId(value: unknown): AppIconId {
  return typeof value === 'string' && Object.hasOwn(appIconCatalog, value) ? value as AppIconId : 'original';
}

export function appIconIdForNativeName(value: string | null): AppIconId | undefined {
  return (Object.entries(appIconCatalog) as [AppIconId, (typeof appIconCatalog)[AppIconId]][])
    .find(([, icon]) => icon.nativeName === value)?.[0];
}
