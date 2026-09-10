import { themeCatalog, parseThemeId, isCustomTheme, chartColor } from '../src/theme-catalog.ts';
import { themedColor, themedGradient } from '../src/theme-palette.ts';
export function testTheme(value: boolean | string) {
  const id = parseThemeId(typeof value === 'boolean' ? value ? 'light' : 'dark' : value);
  const definition = themeCatalog[id];
  return { ...definition, id, isLight: definition.mode === 'light', isCustom: isCustomTheme(id),
    color: (color: string, role: any) => themedColor(color, id, role),
    chartColor: (color: string) => chartColor(color, id),
    gradient: (colors: string[]) => themedGradient(colors, id),
    resolvePalette: (base: any) => isCustomTheme(id) ? { ...base, ...definition.palette } : base,
  };
}
