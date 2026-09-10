export type SettingsCategoryId =
  | 'appearance'
  | 'recording'
  | 'music'
  | 'account'
  | 'places'
  | 'membership';

export type SettingsCategory = {
  id: SettingsCategoryId;
  title: string;
  symbol: string;
};

export const settingsCategories: readonly SettingsCategory[] = [
  { id: 'appearance', title: 'Appearance', symbol: 'paintbrush' },
  { id: 'recording', title: 'Recording & Location', symbol: 'location' },
  { id: 'music', title: 'Music & Connections', symbol: 'music.note' },
  { id: 'account', title: 'Account & iCloud', symbol: 'icloud' },
  { id: 'places', title: 'Saved Places', symbol: 'house' },
  { id: 'membership', title: 'Membership & Support', symbol: 'checkmark.shield' },
] as const;
