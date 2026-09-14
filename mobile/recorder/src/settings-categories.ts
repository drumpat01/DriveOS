export type SettingsCategoryId =
  | 'appearance'
  | 'recording'
  | 'music'
  | 'achievements'
  | 'account'
  | 'places'
  | 'membership';

export type SettingsCategory = {
  id: SettingsCategoryId;
  title: string;
  symbol: string;
};

export const settingsCategories: readonly SettingsCategory[] = [
  { id: 'account', title: 'Account & iCloud', symbol: 'icloud' },
  { id: 'appearance', title: 'Appearance', symbol: 'paintbrush' },
  { id: 'achievements', title: 'Achievements', symbol: 'medal' },
  { id: 'membership', title: 'Membership & Support', symbol: 'checkmark.shield' },
  { id: 'music', title: 'Music & Connections', symbol: 'music.note' },
  { id: 'recording', title: 'Recording & Location', symbol: 'location' },
  { id: 'places', title: 'Saved Places', symbol: 'house' },
] as const;
