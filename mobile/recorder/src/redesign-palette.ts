import { journeyDeckSemanticColors } from './journeydeck-design-tokens.ts';
import type { ThemeId, ThemePalette } from './theme-catalog.ts';

export type RedesignColors = {
  page: string;
  text: string;
  textSecondary: string;
  textTertiary: string;
  accent: string;
  onAccent: string;
  accentSoft: string;
  highlight: string;
  highlightSoft: string;
  surface: string;
  surfaceStrong: string;
  border: string;
  separator: string;
  track: string;
  photoScrim: [string, string, string, string];
  photoChip: string;
  photoChipBorder: string;
  glow: string;
  shadow: string;
  danger: string;
  onDanger: string;
  dangerSoft: string;
  routes: [string, string, string, string];
  artwork: [string, string, string, string];
};

const HIGHLIGHT: Record<ThemeId, keyof ThemePalette> = {
  dark: 'amber',
  light: 'teal',
  sakura: 'teal',
  redline: 'teal',
  'midnight-canopy': 'teal',
  'aurora-glass': 'amber',
};

export function withAlpha(color: string, alpha: number) {
  if (!/^#[0-9a-f]{6}$/i.test(color)) return color;
  const channel = Math.round(Math.min(1, Math.max(0, alpha)) * 255).toString(16).padStart(2, '0');
  return `${color}${channel}`;
}

export function redesignColors(id: ThemeId, palette: ThemePalette): RedesignColors {
  const semantic = journeyDeckSemanticColors(id, palette);
  const light = id === 'light' || id === 'sakura';
  const highlight = palette[HIGHLIGHT[id]] as string;
  const ink = light ? palette.text : '#ffffff';
  return {
    page: semantic.page,
    text: semantic.text,
    textSecondary: semantic.textSecondary,
    textTertiary: withAlpha(semantic.textSecondary, light ? 0.82 : 0.72),
    accent: semantic.accent,
    onAccent: semantic.onAccent,
    accentSoft: withAlpha(semantic.accent, light ? 0.12 : 0.16),
    highlight,
    highlightSoft: withAlpha(highlight, light ? 0.16 : 0.42),
    surface: light ? withAlpha(semantic.surfaceRaised, 0.92) : withAlpha(ink, 0.07),
    surfaceStrong: light ? semantic.surfaceInset : withAlpha(ink, 0.12),
    border: light ? semantic.separator : withAlpha(ink, 0.12),
    separator: light ? withAlpha(semantic.separator, 0.8) : withAlpha(ink, 0.08),
    track: light ? withAlpha(semantic.text, 0.08) : withAlpha(ink, 0.08),
    photoScrim: [withAlpha(semantic.page, 0), withAlpha(semantic.page, 0), withAlpha(semantic.page, 0.74), withAlpha(semantic.page, 0.96)],
    photoChip: withAlpha(semantic.page, light ? 0.78 : 0.58),
    photoChipBorder: light ? withAlpha(semantic.separator, 0.9) : withAlpha(ink, 0.16),
    glow: withAlpha(palette.glow ?? semantic.accent, light ? 0.14 : 0.2),
    shadow: light ? withAlpha(semantic.text, 0.22) : '#00000073',
    danger: semantic.danger,
    onDanger: palette.onDanger,
    dangerSoft: withAlpha(semantic.danger, light ? 0.12 : 0.22),
    routes: [semantic.accent, highlight, palette.blue, palette.rose],
    artwork: [palette.coral, palette.blue, palette.teal, palette.rose],
  };
}
