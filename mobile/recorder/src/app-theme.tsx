import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Appearance, StyleSheet, View } from 'react-native';
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

function makeTheme(id: ThemeId, opaqueSurfaces = false) {
  const { mode, name, palette } = themeCatalog[id];
  return {
    id, mode, name, palette, isLight: mode === 'light', isCustom: isCustomTheme(id),
    /** Glass themes draw translucent surfaces unless Reduce Transparency asks for solid ones. */
    isGlass: id === 'aurora-glass', opaqueSurfaces,
    styleKey: opaqueSurfaces ? `${id}:opaque` : id,
    resolvePalette: <T extends Record<string, unknown>>(base: T): T => isCustomTheme(id) ? { ...base, ...palette } : base,
    color: (value: string, role: ColorRole = 'text') => themedColor(value, id, role, opaqueSurfaces),
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
  'aurora-glass': makeTheme('aurora-glass'),
};
const opaqueAurora = makeTheme('aurora-glass', true);

/** Reduce Transparency and Increase Contrast, subscribed once for the whole app. */
function useSurfaceAccessibility() {
  const [state, setState] = useState({ reduceTransparency: false, increaseContrast: false });
  useEffect(() => {
    const info = AccessibilityInfo;
    if (!info?.addEventListener) return;
    let mounted = true;
    const update = (key: 'reduceTransparency' | 'increaseContrast') => (value: boolean) => {
      if (mounted) setState(current => current[key] === value ? current : { ...current, [key]: value });
    };
    const subscriptions = [
      info.addEventListener('reduceTransparencyChanged', update('reduceTransparency')),
      info.addEventListener('darkerSystemColorsChanged', update('increaseContrast')),
    ];
    void info.isReduceTransparencyEnabled?.().then(update('reduceTransparency')).catch(() => undefined);
    void info.isDarkerSystemColorsEnabled?.().then(update('increaseContrast')).catch(() => undefined);
    return () => { mounted = false; subscriptions.forEach(subscription => subscription?.remove()); };
  }, []);
  return state;
}
const ThemeContext = createContext({
  theme: themes.redline,
  surfaces: { reduceTransparency: false, increaseContrast: false },
  setMode: (_mode: ThemeMode) => {},
  setTheme: (_id: ThemeId) => {},
  transitionTheme: (_id: ThemeId, _origin?: ThemeTransitionOrigin) => {},
});

export function AppThemeProvider({ children }: { children: ReactNode }) {
  const [id, setState] = useState<ThemeId>(readTheme);
  const { transitionTheme, settleTransition, overlay } = useWaterThemeTransition(
    id, next => SecureStore.setItem(THEME_KEY, next), setState,
  );
  const surfaces = useSurfaceAccessibility();
  const theme = id === 'aurora-glass' && surfaces.reduceTransparency ? opaqueAurora : themes[id];
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
  return <ThemeContext.Provider value={{ theme, surfaces, setMode, setTheme, transitionTheme }}>
    <View style={styles.root}>{children}</View>
    {overlay}
  </ThemeContext.Provider>;
}

export function useAppTheme() { return useContext(ThemeContext).theme; }
export function useThemeChoice() { return useContext(ThemeContext); }
/** System transparency and contrast preferences, for glass materials. */
export function useSurfacePreferences() { return useContext(ThemeContext).surfaces; }

const styleCaches = new Map<string, WeakMap<object, Record<string, any>>>();
export function useThemedStyles<T extends Record<string, any>>(styles: T): T {
  const theme = useAppTheme();
  if (theme.id === 'dark') return styles;
  let cache = styleCaches.get(theme.styleKey);
  if (!cache) { cache = new WeakMap(); styleCaches.set(theme.styleKey, cache); }
  let resolved = cache.get(styles);
  if (!resolved) {
    resolved = themedStyleSheet(styles, theme.id, [], theme.opaqueSurfaces);
    cache.set(styles, resolved);
  }
  return resolved as T;
}

const styles = StyleSheet.create({ root: { flex: 1 } });
