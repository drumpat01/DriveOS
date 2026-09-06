import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Appearance } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as SystemUI from 'expo-system-ui';
import { ivoryPalette, themedColor, themedGradient, themedStyleSheet, type ColorRole, type ThemeMode } from './theme-palette';

const THEME_KEY = 'journeydeck.appearance.v2';

function readTheme(): ThemeMode {
  try { return SecureStore.getItem(THEME_KEY) === 'light' ? 'light' : 'dark'; }
  catch { return 'dark'; }
}

function makeTheme(mode: ThemeMode) {
  return {
    mode, isLight: mode === 'light',
    color: (value: string, role: ColorRole = 'text') => themedColor(value, mode, role),
    gradient: (colors: readonly string[]) => themedGradient(colors, mode) as [string, string, ...string[]],
  };
}
const themes = { dark: makeTheme('dark'), light: makeTheme('light') };
const ThemeContext = createContext({ theme: themes.dark, setMode: (_mode: ThemeMode) => {} });

export function AppThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setState] = useState<ThemeMode>(readTheme);
  useEffect(() => {
    Appearance.setColorScheme(mode);
    void SystemUI.setBackgroundColorAsync(mode === 'light' ? ivoryPalette.page : '#08070d').catch(() => undefined);
  }, [mode]);
  const setMode = (next: ThemeMode) => {
    // Save before switching so a failed write cannot falsely promise persistence.
    SecureStore.setItem(THEME_KEY, next);
    setState(next);
  };
  return <ThemeContext.Provider value={{ theme: themes[mode], setMode }}>{children}</ThemeContext.Provider>;
}

export function useAppTheme() { return useContext(ThemeContext).theme; }
export function useThemeChoice() { return useContext(ThemeContext); }

const lightStyles = new WeakMap<object, Record<string, any>>();
export function useThemedStyles<T extends Record<string, any>>(styles: T): T {
  const theme = useAppTheme();
  if (!theme.isLight) return styles;
  let light = lightStyles.get(styles);
  if (!light) {
    light = themedStyleSheet(styles, 'light');
    lightStyles.set(styles, light);
  }
  return light as T;
}
