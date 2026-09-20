import { createContext, useContext, type ReactNode } from 'react';
import type { JourneyDeckMembershipEntitlements } from './membership-entitlements';

export type JourneyDeckTab = 'music' | 'journeys' | 'home' | 'statistics' | 'settings';
export const tabPaths = { music: '/(tabs)/music', journeys: '/(tabs)/journeys', home: '/(tabs)', statistics: '/(tabs)/statistics', settings: '/(tabs)/settings' } as const;
type NativeNavigationContent = {
  tabs: Record<JourneyDeckTab, ReactNode>;
  memory: (id: string, onReady?: () => void) => ReactNode;
  atlas: ReactNode;
  tools: ReactNode;
  membership: JourneyDeckMembershipEntitlements;
  refreshArchive: () => Promise<void>;
  showUpgrade: () => void;
  onTabFocus: (tab: JourneyDeckTab) => void;
  tabBarHidden: boolean;
};
export const NativeNavigationContext = createContext<NativeNavigationContent | null>(null);
export function useJourneyDeckNavigation() {
  const value = useContext(NativeNavigationContext);
  if (!value) throw new Error('JourneyDeck navigation must be inside the shared app shell.');
  return value;
}
