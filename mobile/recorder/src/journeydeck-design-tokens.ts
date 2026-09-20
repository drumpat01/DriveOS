import type { TextStyle, ViewStyle } from 'react-native';
import type { ThemeId, ThemePalette } from './theme-catalog';

/** Shared, locked scales for the JourneyDeck roadbook visual language. */
export const journeyDeckSpacing = {
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  12: 48,
} as const;

export const journeyDeckRadius = {
  control: 12,
  compact: 16,
  card: 20,
  feature: 24,
  hero: 28,
  full: 999,
} as const;

export const journeyDeckTypography = {
  kicker: { fontSize: 11, lineHeight: 14, fontWeight: '800', letterSpacing: 1.1 } satisfies TextStyle,
  caption: { fontSize: 12, lineHeight: 17, fontWeight: '500' } satisfies TextStyle,
  body: { fontSize: 15, lineHeight: 21, fontWeight: '400' } satisfies TextStyle,
  label: { fontSize: 15, lineHeight: 20, fontWeight: '700' } satisfies TextStyle,
  headline: { fontSize: 19, lineHeight: 24, fontWeight: '700' } satisfies TextStyle,
  title: { fontFamily: 'Georgia', fontSize: 25, lineHeight: 29, fontWeight: '700' } satisfies TextStyle,
  metric: { fontFamily: 'Georgia', fontSize: 27, lineHeight: 31, fontWeight: '700' } satisfies TextStyle,
  screenTitle: { fontSize: 28, lineHeight: 34, fontWeight: '900', letterSpacing: 4.4 } satisfies TextStyle,
} as const;

export const journeyDeckElevation = {
  flat: { boxShadow: 'none' } satisfies ViewStyle,
  raised: { boxShadow: '0 8px 24px rgba(4, 14, 31, 0.12)' } satisfies ViewStyle,
  floating: { boxShadow: '0 14px 36px rgba(4, 14, 31, 0.18)' } satisfies ViewStyle,
} as const;

export type JourneyDeckSemanticColors = {
  page: string;
  surface: string;
  surfaceRaised: string;
  surfaceInset: string;
  text: string;
  textSecondary: string;
  separator: string;
  accent: string;
  onAccent: string;
  success: string;
  danger: string;
};

/** Grand Touring uses champagne for action; Warm Ivory uses coral, reserving plum for decorative ink. */
export function journeyDeckSemanticColors(id: ThemeId, palette: ThemePalette): JourneyDeckSemanticColors {
  if (id === 'redline') return {
    page: '#081832', surface: '#203a63', surfaceRaised: '#29456f', surfaceInset: '#132d55',
    text: '#f6f0e2', textSecondary: '#b6bfcc', separator: '#6f829d',
    accent: '#d4b15a', onAccent: '#081832', success: '#2f6b57', danger: '#8e3040',
  };
  if (id === 'light') return {
    page: '#fffaf0', surface: '#fffcf6', surfaceRaised: '#ffffff', surfaceInset: '#f3e8e1',
    text: '#291d26', textSecondary: '#685461', separator: '#d8c5ba',
    accent: '#b94f3d', onAccent: '#ffffff', success: '#58752f', danger: '#a33f32',
  };
  return {
    page: palette.page, surface: palette.card, surfaceRaised: palette.card, surfaceInset: palette.inset,
    text: palette.text, textSecondary: palette.muted, separator: palette.line,
    accent: palette.accent, onAccent: palette.onAccent, success: palette.success, danger: palette.danger,
  };
}
