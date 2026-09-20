import { NativeModule, requireOptionalNativeModule } from 'expo';

import type { JourneyDeckAppIconStatus } from './JourneyDeckAppIcon.types';

declare class JourneyDeckAppIconModule extends NativeModule<{}> {
  getStatusAsync(): Promise<JourneyDeckAppIconStatus>;
  setIconAsync(iconName: string | null): Promise<JourneyDeckAppIconStatus>;
}

export default requireOptionalNativeModule<JourneyDeckAppIconModule>('JourneyDeckAppIcon');
