import type { ImageSourcePropType } from 'react-native';
import type { ThemeId } from './theme-catalog';

// Static requires let Metro bundle both themes for offline use and OTA delivery.
const lightHeaders = new Map<number, ImageSourcePropType>([
  [require('../assets/cinematic-home-night-photo-v1.jpg'), require('../assets/home-city-light-v1.png')],
  [require('../assets/cinematic-memory-polaroids-photo-v1.jpg'), require('../assets/memory-default-floating-timeline-light-v1.png')],
  [require('../assets/cinematic-settings-photo-v1.jpg'), require('../assets/settings-header-light-v1.png')],
  [require('../assets/cinematic-memories-polaroids-photo-v1.jpg'), require('../assets/memories-header-light-v1.png')],
  [require('../assets/cinematic-soundtracks-photo-v1.jpg'), require('../assets/soundtracks-header-light-v1.png')],
  [require('../assets/cinematic-atlas-photo-v1.jpg'), require('../assets/atlas-header-light-v1.png')],
  [require('../assets/cinematic-home-main-photo-v1.jpg'), require('../assets/home-header-light-v1.png')],
  [require('../assets/cinematic-statistics-photo-v1.jpg'), require('../assets/statistics-header-light-v1.png')],
  [require('../assets/cinematic-journey-photo-v1.jpg'), require('../assets/journey-detail-header-light-v1.png')],
  [require('../assets/cinematic-membership-photo-v1.jpg'), require('../assets/atlas-globe-header-light-v1.png')],
]);

const customArtwork = new Set([...lightHeaders.keys(), require('../assets/cinematic-home-morning-photo-v1.jpg'), require('../assets/cinematic-home-afternoon-photo-v1.jpg'), require('../assets/cinematic-home-evening-photo-v1.jpg')]);
const memoryArtwork = new Set([require('../assets/cinematic-memory-polaroids-photo-v1.jpg'), require('../assets/cinematic-memories-polaroids-photo-v1.jpg')]);
const journeyArtwork = new Set([require('../assets/cinematic-journey-photo-v1.jpg'), require('../assets/cinematic-home-morning-photo-v1.jpg'), require('../assets/cinematic-home-afternoon-photo-v1.jpg'), require('../assets/cinematic-home-evening-photo-v1.jpg'), require('../assets/cinematic-home-night-photo-v1.jpg')]);

/** Theme app-owned artwork; unknown sources and dark mode remain untouched. */
export function headerImageSource(source: ImageSourcePropType, mode: ThemeId): ImageSourcePropType {
  if (typeof source === 'number' && customArtwork.has(source)) {
    if (mode === 'midnight-canopy' && source === require('../assets/cinematic-home-main-photo-v1.jpg')) return require('../assets/theme-autumn-home-road-v1.jpg');
    // Keep replacement registration conditional, matching the device-proven OTA.
    if (mode === 'redline') {
      if (source === require('../assets/cinematic-home-main-photo-v1.jpg')) return require('../assets/theme-grand-touring-home-v2.png');
      if (source === require('../assets/cinematic-soundtracks-photo-v1.jpg')) return require('../assets/theme-grand-touring-soundtracks-v1.png');
      if (source === require('../assets/cinematic-memories-polaroids-photo-v1.jpg')) return require('../assets/theme-grand-touring-memories-v1.png');
      if (source === require('../assets/cinematic-statistics-photo-v1.jpg')) return require('../assets/theme-grand-touring-statistics-v1.png');
      if (source === require('../assets/cinematic-settings-photo-v1.jpg')) return require('../assets/theme-grand-touring-settings-v1.png');
    }
    if (memoryArtwork.has(source)) {
      if (mode === 'sakura') return require('../assets/theme-rosewater-memory-v1.png');
      if (mode === 'redline') return require('../assets/theme-grand-touring-memories-v1.png');
    }
    if (journeyArtwork.has(source)) {
      if (mode === 'sakura') return require('../assets/theme-rosewater-journey-v1.png');
      if (mode === 'redline') return require('../assets/theme-carbon-blue-journey-v1.png');
    }
    if (mode === 'sakura') return require('../assets/theme-rosewater-road-v1.png');
    if (mode === 'redline') return require('../assets/theme-carbon-blue-road-v1.png');
  }
  return mode === 'light' && typeof source === 'number' ? lightHeaders.get(source) ?? source : source;
}
