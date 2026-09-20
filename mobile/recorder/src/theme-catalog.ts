export type ThemeId = 'dark' | 'light' | 'sakura' | 'redline' | 'midnight-canopy';
export type ThemeAppearance = 'dark' | 'light';
export type ThemePalette = {
  page: string; card: string; inset: string; text: string; muted: string;
  accent: string; onAccent: string; line: string; chrome: string;
  success: string; onSuccess: string; danger: string; onDanger: string;
  coral: string; amber: string; teal: string; blue: string; rose: string; green: string;
  glow?: string;
};

// Keep stored IDs stable so existing Sakura/Redline selections become their replacements.
export const themeCatalog: Record<ThemeId, { name: string; mode: ThemeAppearance; description: string; palette: ThemePalette; swatches?: string[] }> = {
  dark: { name: 'Cinematic Dark', mode: 'dark', description: 'Midnight plum · coral · neon', palette: {
    page: '#08070d', card: '#120d1a', inset: '#291735', text: '#fff6ed', muted: '#b6a6c1',
    accent: '#c5a0f4', onAccent: '#201428', line: '#49304f', chrome: '#b6a6c1',
    success: '#43e6ae', onSuccess: '#201428', danger: '#a72843', onDanger: '#fff6ed',
    coral: '#ff5c73', amber: '#ffb84d', teal: '#36f1cd', blue: '#55b9ff', rose: '#ff61d2', green: '#a8ff60',
  } },
  light: { name: 'Warm Ivory', mode: 'light', description: 'Ivory · plum · soft coral', palette: {
    page: '#fffaf0', card: '#fffcf6', inset: '#eee2ef', text: '#291d26', muted: '#685461',
    accent: '#754487', onAccent: '#ffffff', line: '#d8c5ba', chrome: '#d8c5ba',
    success: '#58752f', onSuccess: '#ffffff', danger: '#a33f32', onDanger: '#ffffff',
    coral: '#b94f3d', amber: '#996018', teal: '#247a70', blue: '#326d9b', rose: '#9b4d73', green: '#58752f',
  } },
  sakura: { name: 'Rosewater', mode: 'light', description: 'Blush glass · raspberry · sage', swatches: ['#b52b59', '#d895ab', '#68816a', '#986c50', '#79566f'], palette: {
    page: '#fff4f7', card: '#f5dfe7', inset: '#f9e9ee', text: '#38252b', muted: '#6c4c58',
    accent: '#b52b59', onAccent: '#ffffff', line: '#c799aa', chrome: '#fff8fb',
    success: '#456449', onSuccess: '#ffffff', danger: '#a92750', onDanger: '#ffffff',
    coral: '#b52b59', amber: '#805334', teal: '#456449', blue: '#79566f', rose: '#96506a', green: '#6f4255',
  } },
  redline: { name: 'Grand Touring', mode: 'dark', description: 'Midnight navy · champagne · racing green', swatches: ['#081832', '#203a63', '#d4b15a', '#f6f0e2', '#b6bfcc', '#2f6b57'], palette: {
    page: '#081832', card: '#203a63', inset: '#132d55', text: '#f6f0e2', muted: '#b6bfcc',
    accent: '#d4b15a', onAccent: '#081832', line: '#b6bfcc', chrome: '#b6bfcc',
    success: '#2f6b57', onSuccess: '#f6f0e2', danger: '#8e3040', onDanger: '#f6f0e2',
    coral: '#d4b15a', amber: '#f6f0e2', teal: '#9cb7d6', blue: '#6fa5f0', rose: '#e4c77a', green: '#2f6b57',
  } },
  'midnight-canopy': { name: 'Autumn Drive', mode: 'dark', description: 'Forest green · sunset orange · deep red', swatches: ['#162f13', '#206722', '#590000', '#ffd000', '#ffa600', '#ff7600', '#ffffff', '#000000'], palette: {
    // User-selected Theme Creator preset "test 4", September 17, 2026.
    // Keep the stored ID stable; photos and album artwork are not palette tokens.
    page: '#162f13', card: '#206722', inset: '#590000', text: '#ffffff', muted: '#ffffff',
    accent: '#ffa600', onAccent: '#000000', line: '#ffd000', chrome: '#590000',
    success: '#206722', onSuccess: '#ffffff', danger: '#590000', onDanger: '#ffffff',
    coral: '#590000', amber: '#ffa600', teal: '#ffa600', blue: '#590000', rose: '#590000', green: '#162f13',
    glow: '#ff7600',
  } },
};

export const FREE_THEME_IDS: readonly ThemeId[] = ['redline', 'light'];
export const PLUS_THEME_IDS: readonly ThemeId[] = ['dark', 'sakura'];
export const THEME_GRID_ORDER: readonly ThemeId[] = [...FREE_THEME_IDS, ...PLUS_THEME_IDS];

export function themeChoices(includeAutumnDrive: boolean): readonly ThemeId[] {
  return includeAutumnDrive
    ? ['dark', 'redline', 'midnight-canopy', 'light', 'sakura']
    : ['dark', 'redline', 'light', 'sakura'];
}

export function themeRequiresPlus(id: ThemeId) {
  return PLUS_THEME_IDS.includes(id);
}

export function parseThemeId(value: unknown): ThemeId {
  return typeof value === 'string' && Object.hasOwn(themeCatalog, value) ? value as ThemeId : 'redline';
}

export function isCustomTheme(id: ThemeId) { return id === 'sakura' || id === 'redline' || id === 'midnight-canopy'; }

/** Pastel chart fills use the approved swatches; small labels retain deeper readable inks. */
export function chartColor(value: string, id: ThemeId) {
  if (id !== 'sakura') return value;
  const p = themeCatalog.sakura.palette;
  return ({ [p.rose]: '#d895ab', [p.teal]: '#68816a', [p.amber]: '#986c50' } as Record<string, string>)[value] ?? value;
}
