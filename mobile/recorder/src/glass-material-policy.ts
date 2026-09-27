import { delightMaterialMode, type DelightMaterialMode } from './delight-policy.ts';
import type { ThemePalette } from './theme-catalog.ts';

/**
 * Material roles for glass themes (V4 Aurora Glass), from the approved matched-screen mockups:
 * - clear: floating controls over scenery (header buttons, map controls, recorder dock)
 * - frosted: dense information (metric tiles, lists, grouped settings)
 * - sheet: large bottom sheets and detail panels
 * - primary: the single mint action per screen
 * Native tab bars and navigation stay system-owned and never use these roles.
 */
export type GlassRole = 'clear' | 'frosted' | 'sheet' | 'primary';

export type GlassMaterialSpec = {
  mode: DelightMaterialMode;
  glassEffectStyle: 'clear' | 'regular';
  /** Tint over native glass or blur; unused when opaque. */
  tintColor: string;
  blurIntensity: number;
  /** Solid surface used for Reduce Transparency. */
  fallbackColor: string;
  borderColor: string;
  /** Top sheen, fading to transparent by mid-height. */
  highlight: readonly [string, string];
  /** Foreground color for text and symbols on this material. */
  contentColor: string;
};

export type GlassEnvironment = {
  glassApiAvailable: boolean;
  liquidGlassAvailable: boolean;
  reduceTransparency: boolean;
  increaseContrast?: boolean;
};

function withAlpha(hex: string, opacity: number) {
  if (!/^#[\da-f]{6}$/i.test(hex)) return hex;
  return `${hex}${Math.round(Math.max(0, Math.min(1, opacity)) * 255).toString(16).padStart(2, '0')}`;
}
const white = (opacity: number) => withAlpha('#ffffff', opacity);

const ROLE = {
  clear: { style: 'clear', tint: 0.22, blur: 24, border: 0.28, sheen: 0.18 },
  frosted: { style: 'regular', tint: 0.56, blur: 48, border: 0.12, sheen: 0.06 },
  sheet: { style: 'regular', tint: 0.66, blur: 60, border: 0.14, sheen: 0.05 },
  primary: { style: 'clear', tint: 0.85, blur: 20, border: 0.55, sheen: 0.4 },
} as const;

export function glassMaterialSpec(role: GlassRole, palette: ThemePalette, environment: GlassEnvironment): GlassMaterialSpec {
  const r = ROLE[role];
  const mode = delightMaterialMode(environment);
  const contrast = environment.increaseContrast === true;
  const base = role === 'primary' ? palette.accent : role === 'clear' || role === 'sheet' ? palette.page : palette.card;
  return {
    mode,
    glassEffectStyle: r.style,
    // Increase Contrast pushes tints toward opaque so text never depends on the backdrop.
    tintColor: withAlpha(base, contrast ? Math.max(r.tint, 0.82) : r.tint),
    blurIntensity: r.blur,
    fallbackColor: role === 'primary' ? palette.accent : role === 'clear' ? palette.inset : palette.card,
    borderColor: white(contrast ? Math.max(r.border, 0.5) : r.border),
    highlight: [white(mode === 'opaque' ? r.sheen / 2 : r.sheen), white(0)],
    contentColor: role === 'primary' ? palette.onAccent : palette.text,
  };
}
