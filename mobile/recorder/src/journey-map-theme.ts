import type { ThemeMode } from './theme-palette';
import type { ThemeId } from './theme-catalog';
import { themeCatalog } from './theme-catalog.ts';
const OPEN_FREE_MAP_DARK_STYLE = 'https://tiles.openfreemap.org/styles/dark';
export const OPEN_FREE_MAP_LIGHT_STYLE = 'https://tiles.openfreemap.org/styles/liberty';

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

type MapTheme = ThemeId | ThemeMode;

export type JourneyDeckMapPalette = {
  routeGlow: string;
  routeShadow: string;
  routeLine: string;
};

const AUTUMN_NEON_MAP = {
  routeGlow: '#ff7600',
  routeShadow: '#590000',
  routeLine: '#fff200',
  water: '#003c46',
  waterEdge: '#00f0d0',
  minorRoad: '#ff7600',
  majorRoad: '#ffd000',
  boundary: '#ff2d00',
} as const;

const cachedStyles: Partial<Record<ThemeId, JourneyDeckMapStyle>> = {};
const styleRequests: Partial<Record<ThemeId, Promise<JourneyDeckMapStyle | null>>> = {};

function normalizedTheme(theme: MapTheme): ThemeId {
  return theme === 'midnight-canopy' ? theme : theme === 'light' ? 'light' : theme === 'sakura' ? 'sakura' : theme === 'redline' ? 'redline' : 'dark';
}

export function journeyDeckMapPalette(theme: MapTheme): JourneyDeckMapPalette {
  if (normalizedTheme(theme) === 'midnight-canopy') {
    return {
      routeGlow: AUTUMN_NEON_MAP.routeGlow,
      routeShadow: AUTUMN_NEON_MAP.routeShadow,
      routeLine: AUTUMN_NEON_MAP.routeLine,
    };
  }
  if (normalizedTheme(theme) === 'redline') return {
    routeGlow: '#f4c94f',
    routeShadow: '#6e5518',
    routeLine: '#e5bd4f',
  };
  return { routeGlow: '#a43fff', routeShadow: '#5d236f', routeLine: '#ff6750' };
}

function themedPaint(layer: MapStyleLayer, theme: MapTheme) {
  const paint = { ...(layer.paint ?? {}) };
  const name = String(layer.id ?? '').toLocaleLowerCase();
  const id = normalizedTheme(theme);

  if (id === 'midnight-canopy') {
    const palette = themeCatalog[id].palette;
    const water = /water|ocean|river|lake/.test(name);
    const park = /park|grass|wood|forest|landcover|landuse/.test(name);
    if (layer.type === 'background') return { ...paint, 'background-color': palette.page, 'background-opacity': 1 };
    if (layer.type === 'fill') return { ...paint, 'fill-color': water ? AUTUMN_NEON_MAP.water : park ? palette.card : palette.page,
      'fill-outline-color': water ? AUTUMN_NEON_MAP.waterEdge : '#52a83d', 'fill-opacity': 0.96 };
    if (layer.type === 'fill-extrusion') return { ...paint, 'fill-extrusion-color': '#365c30', 'fill-extrusion-opacity': 0.82 };
    if (layer.type === 'line') {
      const road = /road|street|motorway|trunk|primary|highway|secondary|tertiary|transportation/.test(name);
      const major = /motorway|trunk|primary|highway/.test(name);
      const boundary = /boundary|admin/.test(name);
      return { ...paint, 'line-color': water ? AUTUMN_NEON_MAP.waterEdge : road ? (major ? AUTUMN_NEON_MAP.majorRoad : AUTUMN_NEON_MAP.minorRoad) : boundary ? AUTUMN_NEON_MAP.boundary : '#52a83d',
        'line-opacity': road ? (major ? 1 : 0.84) : boundary ? 0.8 : 0.68 };
    }
    if (layer.type === 'symbol') return { ...paint, 'text-color': palette.text, 'text-halo-color': palette.page, 'text-halo-width': 1.35, 'icon-opacity': 0.8 };
    return paint;
  }

  if (id === 'light' || id === 'sakura') {
    if (layer.type === 'background') return { ...paint, 'background-color': '#fffaf0', 'background-opacity': 1 };
    if (layer.type === 'fill') return { ...paint, 'fill-color': /water|ocean|river|lake/.test(name) ? '#c8dce2' : /park|grass|wood|forest|landcover|landuse/.test(name) ? '#e5e9d6' : '#f3e8d9', 'fill-outline-color': '#d9cbbc', 'fill-opacity': 0.96 };
    if (layer.type === 'fill-extrusion') return { ...paint, 'fill-extrusion-color': '#dfcfbf', 'fill-extrusion-opacity': 0.82 };
    if (layer.type === 'line') return { ...paint, 'line-color': /motorway|trunk|primary|highway/.test(name) ? '#c79a83' : /water|river/.test(name) ? '#8aafc0' : '#d1bdae', 'line-opacity': 0.9 };
    if (layer.type === 'symbol') return { ...paint, 'text-color': '#685461', 'text-halo-color': '#fffaf0', 'text-halo-width': 1.2, 'icon-opacity': 0.8 };
    if (layer.type === 'raster') return { ...paint, 'raster-brightness-min': 0, 'raster-brightness-max': 1, 'raster-saturation': -0.25, 'raster-contrast': 0 };
    return paint;
  }

  if (id === 'redline') {
    if (layer.type === 'background') return { ...paint, 'background-color': '#081832', 'background-opacity': 1 };
    if (layer.type === 'fill') {
      const water = /water|ocean|river|lake/.test(name);
      const park = /park|grass|wood|forest|landcover|landuse/.test(name);
      return {
        ...paint,
        'fill-color': water ? '#07152c' : park ? '#0c2342' : '#081832',
        'fill-outline-color': water ? '#203a63' : '#29466d',
        'fill-opacity': 0.97,
      };
    }
    if (layer.type === 'fill-extrusion') return { ...paint, 'fill-extrusion-color': '#132d55', 'fill-extrusion-opacity': 0.82 };
    if (layer.type === 'line') {
      const road = /road|street|motorway|trunk|primary|highway|secondary|tertiary|transportation/.test(name);
      const major = /motorway|trunk|primary|highway/.test(name);
      const water = /water|river/.test(name);
      const boundary = /boundary|admin/.test(name);
      return {
        ...paint,
        'line-color': road ? (major ? '#f6f0e2' : '#b6bfcc') : water ? '#31527c' : boundary ? '#55749a' : '#29466d',
        'line-opacity': road ? (major ? 0.9 : 0.68) : 0.62,
      };
    }
    if (layer.type === 'symbol') return {
      ...paint,
      'text-color': '#f6f0e2',
      'text-halo-color': '#081832',
      'text-halo-width': 1.35,
      'icon-opacity': 0.8,
    };
    if (layer.type === 'raster') return {
      ...paint,
      'raster-brightness-min': 0.05,
      'raster-brightness-max': 0.42,
      'raster-saturation': -0.72,
      'raster-contrast': 0.34,
      'raster-hue-rotate': 195,
    };
    return paint;
  }

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

/** Recolors basemap layers while preserving source data and geometry. */
export function themeJourneyDeckMapStyle(input: unknown, theme: MapTheme = 'dark'): JourneyDeckMapStyle | null {
  if (!input || typeof input !== 'object') return null;
  const style = input as Partial<JourneyDeckMapStyle>;
  if (style.version !== 8 || !Array.isArray(style.layers)) return null;
  return {
    ...style,
    version: 8,
    layers: style.layers.map(layer => ({ ...layer, paint: themedPaint(layer, theme) })),
  } as JourneyDeckMapStyle;
}

/** Fetches once per app process; MapLibre still falls back to OpenFreeMap's dark URL if this fails. */
export async function loadJourneyDeckMapStyle(fetchImpl: typeof fetch = fetch, theme: MapTheme = 'dark'): Promise<JourneyDeckMapStyle | null> {
  const id = normalizedTheme(theme);
  if (cachedStyles[id]) return cachedStyles[id]!;
  if (!styleRequests[id]) {
    styleRequests[id] = fetchImpl(OPEN_FREE_MAP_DARK_STYLE, { headers: { accept: 'application/json' } })
      .then(async response => response.ok ? themeJourneyDeckMapStyle(await response.json(), id) : null)
      .then(style => {
        if (style) cachedStyles[id] = style;
        return style;
      })
      .catch(() => null)
      .finally(() => { delete styleRequests[id]; });
  }
  return styleRequests[id]!;
}

export { OPEN_FREE_MAP_DARK_STYLE };
