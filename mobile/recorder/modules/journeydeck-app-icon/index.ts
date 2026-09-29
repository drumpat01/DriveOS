import JourneyDeckAppIconModule from './src/JourneyDeckAppIconModule';
import type { JourneyDeckAppIconStatus } from './src/JourneyDeckAppIcon.types';

export type { JourneyDeckAppIconStatus } from './src/JourneyDeckAppIcon.types';

export const isJourneyDeckAppIconNativeAvailable = JourneyDeckAppIconModule !== null;

export async function getAppIconStatus(): Promise<JourneyDeckAppIconStatus> {
  if (!JourneyDeckAppIconModule) {
    return { nativeModuleAvailable: false, supported: false, iconName: null };
  }
  return JourneyDeckAppIconModule.getStatusAsync();
}

export async function setNativeAppIcon(iconName: string | null): Promise<JourneyDeckAppIconStatus> {
  if (!JourneyDeckAppIconModule) {
    throw new Error('App icons require the next JourneyDeck app build.');
  }
  return JourneyDeckAppIconModule.setIconAsync(iconName);
}

export type StartWidgetLastDrive = { miles: number; minutes: number; startedAt: string };

/** Hands the Start a Journey widget the latest drive. Builds without the widget ignore it. */
export async function setStartWidgetLastDrive(drive: StartWidgetLastDrive | null): Promise<void> {
  await JourneyDeckAppIconModule?.setWidgetSnapshotAsync?.(drive ? JSON.stringify(drive) : null).catch(() => false);
}
