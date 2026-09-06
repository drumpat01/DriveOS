import type { ImageSourcePropType } from 'react-native';
import type { ThemeMode } from './theme-palette';

// Static requires let Metro bundle both themes for offline use and OTA delivery.
const lightHeaders = new Map<number, ImageSourcePropType>([
  [require('../assets/home-cinematic-hero-night-v1.png'), require('../assets/home-city-light-v1.png')],
  [require('../assets/memory-default-floating-timeline-v1.jpg'), require('../assets/memory-default-floating-timeline-light-v1.png')],
  [require('../assets/settings-header-cinematic-v1.png'), require('../assets/settings-header-light-v1.png')],
  [require('../assets/memories-header-cinematic-v1.png'), require('../assets/memories-header-light-v1.png')],
  [require('../assets/soundtracks-header-cinematic-v2.png'), require('../assets/soundtracks-header-light-v1.png')],
  [require('../assets/live-header-cinematic-v1.png'), require('../assets/live-header-light-v1.png')],
  [require('../assets/recorder-header-hero-v2.jpg'), require('../assets/recorder-header-light-v1.png')],
  [require('../assets/timeline-header-hero-v2.jpg'), require('../assets/timeline-header-light-v1.png')],
  [require('../assets/atlas-header-cinematic-v1.png'), require('../assets/atlas-header-light-v1.png')],
  [require('../assets/home-recorder-coast-v1.png'), require('../assets/home-header-light-v1.png')],
  [require('../assets/statistics-story-hero-v1.png'), require('../assets/statistics-header-light-v1.png')],
  [require('../assets/journey-detail-memory-hero-v1.jpg'), require('../assets/journey-detail-header-light-v1.png')],
  [require('../assets/atlas-globe-membership-v1.jpg'), require('../assets/atlas-globe-header-light-v1.png')],
]);

/** Theme app-owned artwork; unknown sources and dark mode remain untouched. */
export function headerImageSource(source: ImageSourcePropType, mode: ThemeMode): ImageSourcePropType {
  return mode === 'light' && typeof source === 'number' ? lightHeaders.get(source) ?? source : source;
}
