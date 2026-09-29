import { NativeModule, requireOptionalNativeModule } from 'expo';

import type { JourneyDeckAppIconStatus } from './JourneyDeckAppIcon.types';

declare class JourneyDeckAppIconModule extends NativeModule<{}> {
  getStatusAsync(): Promise<JourneyDeckAppIconStatus>;
  setIconAsync(iconName: string | null): Promise<JourneyDeckAppIconStatus>;
  setWidgetSnapshotAsync?(json: string | null): Promise<boolean>;
}

export default requireOptionalNativeModule<JourneyDeckAppIconModule>('JourneyDeckAppIcon');
