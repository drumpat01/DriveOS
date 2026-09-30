import { useMemo } from 'react';
import { useAppTheme } from './app-theme';
import { redesignColors } from './redesign-palette';
import { V4_REDESIGN_ENABLED } from './release-features';

/** The V4 redesign applies to iPhone and iPad; earlier variants keep their layouts. */
export const V4_PHONE = V4_REDESIGN_ENABLED;
/** Serif display face: New York on iOS. */
export const V4_SERIF = 'ui-serif';

/**
 * The active theme with its palette roles swapped for the V4 redesign roles on iPhone,
 * so palette-driven screens pick up V4 surfaces, borders and ink without other changes.
 */
export function useV4Theme(): ReturnType<typeof useAppTheme> {
  const theme = useAppTheme();
  return useMemo(() => {
    if (!V4_PHONE) return theme;
    const c = redesignColors(theme.id, theme.palette);
    return { ...theme, palette: { ...theme.palette, page: c.page, card: c.surface, inset: c.surfaceStrong, line: c.border, text: c.text, muted: c.textSecondary, accent: c.accent, onAccent: c.onAccent } };
  }, [theme]);
}

/** Merge V4 shape and type overrides into a style sheet on iPhone; returns the sheet unchanged elsewhere. */
export function v4Styles<T extends Record<string, object>>(base: T, overrides: { [K in keyof T]?: object }): T {
  if (!V4_PHONE) return base;
  const merged: Record<string, object> = { ...base };
  for (const [key, value] of Object.entries(overrides)) if (value) merged[key] = { ...(base as Record<string, object>)[key], ...value };
  return merged as T;
}
