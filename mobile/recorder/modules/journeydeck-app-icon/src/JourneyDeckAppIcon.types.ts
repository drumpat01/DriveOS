export type JourneyDeckAppIconStatus = {
  nativeModuleAvailable: boolean;
  supported: boolean;
  iconName: string | null;
  /** Alternate icon names compiled into this build; absent on builds before Aurora Glass. */
  bundledIcons?: string[];
};
