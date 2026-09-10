import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';
import { getAppIconStatus, setNativeAppIcon } from '../modules/journeydeck-app-icon';
import { appIconCatalog, appIconIdForNativeName, parseAppIconId, type AppIconId } from './app-icon-catalog';

export const APP_ICON_KEY = 'journeydeck.app-icon.v1';
export type AppIconAvailability = 'checking' | 'ready' | 'requires-build' | 'unsupported';

function readStoredAppIcon(): AppIconId {
  try { return parseAppIconId(SecureStore.getItem(APP_ICON_KEY)); }
  catch { return 'original'; }
}

const AppIconContext = createContext({
  appIconId: 'original' as AppIconId,
  availability: 'checking' as AppIconAvailability,
  changing: false,
  setAppIcon: async (_id: AppIconId) => {},
});

export function AppIconProvider({ children }: { children: ReactNode }) {
  const [appIconId, setAppIconId] = useState<AppIconId>(readStoredAppIcon);
  const [availability, setAvailability] = useState<AppIconAvailability>('checking');
  const [changing, setChanging] = useState(false);
  const changeInFlight = useRef(false);

  useEffect(() => {
    let active = true;
    void getAppIconStatus().then(status => {
      if (!active) return;
      if (!status.nativeModuleAvailable) {
        setAvailability('requires-build');
        return;
      }
      if (!status.supported) {
        setAvailability('unsupported');
        return;
      }
      const current = appIconIdForNativeName(status.iconName);
      if (current) {
        setAppIconId(current);
        try { SecureStore.setItem(APP_ICON_KEY, current); } catch {}
      }
      setAvailability('ready');
    }).catch(() => {
      if (active) setAvailability('unsupported');
    });
    return () => { active = false; };
  }, []);

  const setAppIcon = async (next: AppIconId) => {
    if (availability === 'requires-build') throw new Error('App icons require the next JourneyDeck app build.');
    if (availability !== 'ready') throw new Error('App icon switching is not available on this device.');
    if (changeInFlight.current || next === appIconId) return;
    changeInFlight.current = true;
    setChanging(true);
    try {
      const status = await setNativeAppIcon(appIconCatalog[next].nativeName);
      const selected = appIconIdForNativeName(status.iconName);
      if (selected !== next) throw new Error('iOS did not apply the selected app icon.');
      setAppIconId(next);
      // iOS owns the applied icon. A failed preference write must not show a
      // false failure or leave the chooser disagreeing with the Home Screen.
      try { SecureStore.setItem(APP_ICON_KEY, next); } catch {}
    } finally {
      changeInFlight.current = false;
      setChanging(false);
    }
  };

  return <AppIconContext.Provider value={{ appIconId, availability, changing, setAppIcon }}>{children}</AppIconContext.Provider>;
}

export function useAppIconChoice() { return useContext(AppIconContext); }
