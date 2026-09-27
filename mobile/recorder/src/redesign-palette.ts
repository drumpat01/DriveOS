import { journeyDeckSemanticColors } from './journeydeck-design-tokens.ts';
import type { ThemeId, ThemePalette } from './theme-catalog.ts';

/**
 * Color roles for the V4 redesign. Every value comes from the active theme,
 * so each screen follows Grand Touring, Warm Ivory, Rosewater, Cinematic Dark,
 * Autumn Drive and Aurora Glass without per-screen hex values.
 */
export type RedesignColors = {
  page: string;
  text: string;
  textSecondary: string;
  textTertiary: string;
  /** Primary action and selection ink. */
  accent: string;
  onAccent: string;
  /** Soft accent fill behind accent-colored text (chips, secondary buttons). */
  accentSoft: string;
  /** Second ink for kickers and charts, always visibly different from the accent. */
  highlight: string;
  highlightSoft: string;
  surface: string;
  surfaceStrong: string;
  border: string;
  separator: string;
  /** Unfilled track behind bars and progress. */
  track: string;
  /** Scrim over photos, transparent at the top and page-colored at the bottom. */
  photoScrim: [string, string, string, string];
  /** Chip over a photo (kickers, counts). */
  photoChip: string;
  photoChipBorder: string;
  /** Ambient glow behind a tab's title area. */
  glow: string;
  /** Drop shadow under floating artwork. */
  shadow: string;
  danger: string;
  onDanger: string;
  dangerSoft: string;
  /** Route inks for up to four drives drawn on one map. */
  routes: [string, string, string, string];
  /** Placeholder fills for missing artwork, ordered for variety. */
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

/** `#rrggbb` + alpha → `#rrggbbaa`. Other color syntaxes are returned unchanged. */
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
