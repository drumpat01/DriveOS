import type { ThemeId } from './theme-catalog';

export type YearOnRoadMusicId = ThemeId;

export const yearOnRoadMusic: Record<YearOnRoadMusicId, {
  name: string;
  description: string;
  tempo: number;
}> = {
  dark: { name: 'Midnight Velocity', description: 'Neon synthwave', tempo: 116 },
  light: { name: 'Sunlit Coast', description: 'Bright coastal groove', tempo: 108 },
  redline: { name: 'Champagne Apex', description: 'Polished racing pulse', tempo: 124 },
  sakura: { name: 'Petal Rush', description: 'Sparkling future pop', tempo: 120 },
};

export function musicForTheme(themeId: ThemeId): YearOnRoadMusicId {
  return themeId;
}
