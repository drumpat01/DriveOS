const OPEN_FREE_MAP_DARK_STYLE = 'https://tiles.openfreemap.org/styles/dark';

type MapStyleLayer = {
  id?: string;
  type?: string;
  source?: unknown;
  paint?: Record<string, unknown>;
  [key: string]: unknown;
};

export type JourneyDeckMapStyle = {
  version: number;
  layers: MapStyleLayer[];
  [key: string]: unknown;
};

let cachedStyle: JourneyDeckMapStyle | null = null;
let styleRequest: Promise<JourneyDeckMapStyle | null> | null = null;

function themedPaint(layer: MapStyleLayer) {
  const paint = { ...(layer.paint ?? {}) };
  const name = String(layer.id ?? '').toLocaleLowerCase();

  if (layer.type === 'background') return { ...paint, 'background-color': '#010104', 'background-opacity': 1 };
  if (layer.type === 'fill') {
    const water = /water|ocean|river|lake/.test(name);
    const park = /park|grass|wood|forest|landcover|landuse/.test(name);
    return {
      ...paint,
      'fill-color': water ? '#05091a' : park ? '#090711' : '#040309',
      'fill-outline-color': water ? '#15213e' : '#171020',
      'fill-opacity': water ? 0.9 : 0.96,
    };
  }
  if (layer.type === 'fill-extrusion') return { ...paint, 'fill-extrusion-color': '#0d0a14', 'fill-extrusion-opacity': 0.82 };
  if (layer.type === 'line') {
    const boundary = /boundary|admin/.test(name);
    const transit = /rail|transit/.test(name);
    const major = /motorway|trunk|primary|highway/.test(name);
    const minor = /road|street|secondary|tertiary/.test(name);
    const water = /water|river/.test(name);
    return {
      ...paint,
      'line-color': boundary ? '#371b54' : transit ? '#2b1642' : major ? '#3a1737' : minor ? '#221429' : water ? '#172849' : '#17101f',
      'line-opacity': major ? 0.92 : 0.72,
    };
  }
  if (layer.type === 'symbol') {
    const road = /road|street|highway/.test(name);
    const place = /poi|place|label/.test(name);
    return {
      ...paint,
      'text-color': road ? '#a493ae' : place ? '#d3c5d8' : '#9d8ba8',
      'text-halo-color': '#020105',
      'text-halo-width': 1.2,
      'icon-opacity': 0.72,
    };
  }
  if (layer.type === 'raster') return {
    ...paint,
    'raster-brightness-min': 0,
    'raster-brightness-max': 0.23,
    'raster-saturation': -0.65,
    'raster-contrast': 0.22,
  };
  return paint;
}

/** Applies the same dark-violet layer palette used by the JourneyDeck web map. */
export function themeJourneyDeckMapStyle(input: unknown): JourneyDeckMapStyle | null {
  if (!input || typeof input !== 'object') return null;
  const style = input as Partial<JourneyDeckMapStyle>;
  if (style.version !== 8 || !Array.isArray(style.layers)) return null;
  return {
    ...style,
    version: 8,
    layers: style.layers.map(layer => ({ ...layer, paint: themedPaint(layer) })),
  } as JourneyDeckMapStyle;
}

/** Fetches once per app process; MapLibre still falls back to OpenFreeMap's dark URL if this fails. */
export async function loadJourneyDeckMapStyle(fetchImpl: typeof fetch = fetch): Promise<JourneyDeckMapStyle | null> {
  if (cachedStyle) return cachedStyle;
  if (!styleRequest) {
    styleRequest = fetchImpl(OPEN_FREE_MAP_DARK_STYLE, { headers: { accept: 'application/json' } })
      .then(async response => response.ok ? themeJourneyDeckMapStyle(await response.json()) : null)
      .then(style => {
        cachedStyle = style;
        return style;
      })
      .catch(() => null)
      .finally(() => { styleRequest = null; });
  }
  return styleRequest;
}

export { OPEN_FREE_MAP_DARK_STYLE };
