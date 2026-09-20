import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Appearance, StyleSheet, View } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as SystemUI from 'expo-system-ui';
import { themedColor, themedGradient, themedStyleSheet, type ColorRole, type ThemeMode } from './theme-palette';
import { themeCatalog, parseThemeId, isCustomTheme, chartColor, type ThemeId } from './theme-catalog';
import { useWaterThemeTransition, type ThemeTransitionOrigin } from './theme-water-transition';

const THEME_KEY = 'journeydeck.appearance.v2';

function readTheme(): ThemeId {
  try { return parseThemeId(SecureStore.getItem(THEME_KEY)); }
  catch { return 'redline'; }
}

function makeTheme(id: ThemeId) {
  const { mode, name, palette } = themeCatalog[id];
  return {
    id, mode, name, palette, isLight: mode === 'light', isCustom: isCustomTheme(id),
    resolvePalette: <T extends Record<string, unknown>>(base: T): T => isCustomTheme(id) ? { ...base, ...palette } : base,
    color: (value: string, role: ColorRole = 'text') => themedColor(value, id, role),
    chartColor: (value: string) => chartColor(value, id),
    gradient: (colors: readonly string[]) => themedGradient(colors, id) as [string, string, ...string[]],
  };
}
const themes: Record<ThemeId, ReturnType<typeof makeTheme>> = {
  dark: makeTheme('dark'),
  light: makeTheme('light'),
  sakura: makeTheme('sakura'),
  redline: makeTheme('redline'),
  'midnight-canopy': makeTheme('midnight-canopy'),
};
const ThemeContext = createContext({
  theme: themes.redline,
  setMode: (_mode: ThemeMode) => {},
  setTheme: (_id: ThemeId) => {},
  transitionTheme: (_id: ThemeId, _origin?: ThemeTransitionOrigin) => {},
});

export function AppThemeProvider({ children }: { children: ReactNode }) {
  const [id, setState] = useState<ThemeId>(readTheme);
  const { transitionTheme, settleTransition, overlay } = useWaterThemeTransition(
    id, next => SecureStore.setItem(THEME_KEY, next), setState,
  );
  const theme = themes[id];
  useEffect(() => {
    Appearance.setColorScheme(theme.mode);
    void SystemUI.setBackgroundColorAsync(theme.palette.page).catch(() => undefined);
  }, [theme]);
  const setTheme = (next: ThemeId) => {
    settleTransition();
    // Save before switching so a failed write cannot falsely promise persistence.
    SecureStore.setItem(THEME_KEY, next);
    setState(next);
  };
  const setMode = (next: ThemeMode) => transitionTheme(next);
  return <ThemeContext.Provider value={{ theme, setMode, setTheme, transitionTheme }}>
    <View style={styles.root}>{children}</View>
    {overlay}
  </ThemeContext.Provider>;
}

export function useAppTheme() { return useContext(ThemeContext).theme; }
export function useThemeChoice() { return useContext(ThemeContext); }

const styleCaches = new Map<ThemeId, WeakMap<object, Record<string, any>>>();
export function useThemedStyles<T extends Record<string, any>>(styles: T): T {
  const theme = useAppTheme();
  if (theme.id === 'dark') return styles;
  let cache = styleCaches.get(theme.id);
  if (!cache) { cache = new WeakMap(); styleCaches.set(theme.id, cache); }
  let resolved = cache.get(styles);
  if (!resolved) {
    resolved = themedStyleSheet(styles, theme.id);
    cache.set(styles, resolved);
  }
  return resolved as T;
}

const styles = StyleSheet.create({ root: { flex: 1 } });
