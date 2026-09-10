import { themeCatalog, isCustomTheme, type ThemeId } from './theme-catalog.ts';
export type ThemeMode = 'dark' | 'light';
export type ColorRole = 'text' | 'surface' | 'border' | 'accent' | 'shadow';

// Option two: warm ivory, plum typography, peach/coral and lilac accents.
export const ivoryPalette = {
  page: '#fffaf0', surface: '#fffcf6', inset: '#f6eee4',
  text: '#291d26', secondary: '#685461', plum: '#75294f',
  coral: '#b04432', orange: '#ff8956', pink: '#ef3e82',
  lilac: '#eee2ef', peach: '#fbe4d3', border: '#d8c5ba',
  green: '#24654e', blue: '#285c85', violet: '#754487',
} as const;

function rgba(value: string): [number, number, number, number] | null {
  const hex = value.match(/^#([\da-f]{3,8})$/i)?.[1];
  if (hex) {
    const full = hex.length === 3 || hex.length === 4 ? [...hex].map(c => c + c).join('') : hex;
    if (full.length !== 6 && full.length !== 8) return null;
    return [parseInt(full.slice(0, 2), 16), parseInt(full.slice(2, 4), 16), parseInt(full.slice(4, 6), 16), full.length === 8 ? parseInt(full.slice(6), 16) / 255 : 1];
  }
  const rgb = value.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)$/i);
  return rgb ? [Number(rgb[1]), Number(rgb[2]), Number(rgb[3]), rgb[4] === undefined ? 1 : Number(rgb[4])] : null;
}

function alpha(color: string, opacity: number) {
  if (opacity === 1) return color;
  const channels = rgba(color)!;
  return `rgba(${channels[0]},${channels[1]},${channels[2]},${Number(opacity.toFixed(3))})`;
}

/** Translate existing presentation colors by role; dark values remain byte-for-byte intact. */
export function themedColor(value: string, mode: ThemeId, role: ColorRole = 'accent'): string {
  if (mode === 'dark') return value;
  const channels = rgba(value);
  if (!channels) return value; // transparent, SVG paint references, provider URLs, etc.
  const [r, g, b, a] = channels;
  if (isCustomTheme(mode)) {
    const p = themeCatalog[mode].palette, light = themeCatalog[mode].mode === 'light';
    const hi = Math.max(r, g, b), lo = Math.min(r, g, b), chroma = hi - lo;
    const colored = chroma > 45;
    const ink = r > g * 1.18 && r > b * 1.12 ? (g > b * 1.35 && g > r * 0.52 ? p.amber : p.coral)
      : g > r * 1.15 ? (b > g * 1.12 ? p.blue : p.teal)
      : b > r * 1.15 && g > r * 1.05 ? p.blue
      : r > g * 1.25 && b > g * 1.2 && r > b * 1.12 ? p.rose : p.accent;
    if (role === 'shadow') return alpha(light ? '#635275' : (colored ? ink : p.chrome), a * (light ? 0.18 : 1));
    if (role === 'surface') return alpha(hi < 32 ? p.page : hi < 90 ? p.card : p.inset, a);
    if (role === 'border') return alpha(colored && hi > 140 ? ink : p.line, a);
    if (role === 'text') return alpha(colored && hi > 100 ? ink : hi > 210 || hi < 75 ? p.text : p.muted, a);
    return alpha(hi < 70 ? p.page : colored ? ink : hi > 210 ? p.chrome : p.muted, a);
  }
  const brightness = Math.max(r, g, b);
  const spread = brightness - Math.min(r, g, b);
  const green = g > r * 1.16 && g > b * 0.95;
  const blue = b > r * 1.3 && g > r * 1.15;
  const warm = r > b * 1.12 && r > g * 1.15;
  const saturated = spread > 48;
  const ink = green ? ivoryPalette.green : blue ? ivoryPalette.blue : warm ? ivoryPalette.coral : ivoryPalette.violet;
  if (role === 'shadow') return alpha(ivoryPalette.plum, a * 0.14);
  if (role === 'border') return alpha(saturated && brightness > 130 ? (warm ? '#d4a08d' : '#c6aec6') : ivoryPalette.border, a);
  if (role === 'text') {
    return alpha(saturated ? ink : brightness > 210 || brightness < 75 ? ivoryPalette.text : ivoryPalette.secondary, a);
  }
  if (role === 'surface') {
    if (brightness < 32) return alpha(ivoryPalette.page, a);
    if (brightness < 90) return alpha(ivoryPalette.surface, a);
    return alpha(saturated ? (warm ? ivoryPalette.peach : ivoryPalette.lilac) : ivoryPalette.inset, a);
  }
  if (brightness < 90) return alpha(ivoryPalette.page, a);
  if (!saturated) return alpha(ivoryPalette.plum, a);
  return alpha(warm ? (g > b ? ivoryPalette.orange : ivoryPalette.pink) : green ? '#69a78d' : blue ? '#92b1c7' : '#ba96c5', a);
}

/** Surface fades keep their original alpha and geometry; vivid action gradients keep color. */
export function themedGradient<T extends readonly string[]>(colors: T, mode: ThemeId): T {
  return colors.map(color => themedColor(color, mode, 'accent')) as unknown as T;
}

export function themedStyleSheet<T extends Record<string, any>>(styles: T, mode: ThemeId, preserve: readonly string[] = []): T {
  if (mode === 'dark') return styles;
  return Object.fromEntries(Object.entries(styles).map(([name, style]) => {
    if (preserve.includes(name)) return [name, style];
    return [name, Object.fromEntries(Object.entries(style).map(([key, value]) => {
      if (typeof value !== 'string' || !/color$/i.test(key)) return [key, value];
      const role: ColorRole = /shadow/i.test(key) ? 'shadow' : /border/i.test(key) ? 'border' : /background/i.test(key) ? 'surface' : 'text';
      return [key, themedColor(value, mode, role)];
    }))];
  })) as T;
}
