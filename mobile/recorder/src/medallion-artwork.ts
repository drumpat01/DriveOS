import type { ThemeId } from './theme-catalog';

export type ApprovedMedallionId =
  | 'first-track'
  | 'road-regular'
  | 'century-road'
  | 'soundtrack-100'
  | 'long-way-home'
  | 'memory-maker';

export const approvedMedallionIds: readonly ApprovedMedallionId[] = [
  'first-track', 'road-regular', 'century-road', 'soundtrack-100', 'long-way-home', 'memory-maker',
];

export const medallionArtwork: Record<ApprovedMedallionId, Record<ThemeId, number>> = {
  'first-track': {
    redline: require('../assets/medallion-concepts/the-first-track/option-01-theme-variants/first-track-grand-touring.png'),
    sakura: require('../assets/medallion-concepts/the-first-track/option-01-theme-variants/first-track-rosewater.png'),
    dark: require('../assets/medallion-concepts/the-first-track/option-01-theme-variants/first-track-cinematic-dark.png'),
    light: require('../assets/medallion-concepts/the-first-track/option-01-theme-variants/first-track-warm-ivory.png'),
  },
  'road-regular': {
    redline: require('../assets/medallion-concepts/road-regular/option-06-theme-variants/road-regular-grand-touring.png'),
    sakura: require('../assets/medallion-concepts/road-regular/option-06-theme-variants/road-regular-rosewater.png'),
    dark: require('../assets/medallion-concepts/road-regular/option-06-theme-variants/road-regular-cinematic-dark.png'),
    light: require('../assets/medallion-concepts/road-regular/option-06-theme-variants/road-regular-warm-ivory.png'),
  },
  'century-road': {
    redline: require('../assets/medallion-concepts/century-road/option-01-theme-variants/century-road-grand-touring.png'),
    sakura: require('../assets/medallion-concepts/century-road/option-01-theme-variants/century-road-rosewater.png'),
    dark: require('../assets/medallion-concepts/century-road/option-01-theme-variants/century-road-cinematic-dark.png'),
    light: require('../assets/medallion-concepts/century-road/option-01-theme-variants/century-road-warm-ivory.png'),
  },
  'soundtrack-100': {
    redline: require('../assets/medallion-concepts/soundtrack-100/option-01-theme-variants/soundtrack-100-grand-touring.png'),
    sakura: require('../assets/medallion-concepts/soundtrack-100/option-01-theme-variants/soundtrack-100-rosewater.png'),
    dark: require('../assets/medallion-concepts/soundtrack-100/option-01-theme-variants/soundtrack-100-cinematic-dark.png'),
    light: require('../assets/medallion-concepts/soundtrack-100/option-01-theme-variants/soundtrack-100-warm-ivory.png'),
  },
  'long-way-home': {
    redline: require('../assets/medallion-concepts/long-way-home/option-07-theme-variants/long-way-home-grand-touring.png'),
    sakura: require('../assets/medallion-concepts/long-way-home/option-07-theme-variants/long-way-home-rosewater.png'),
    dark: require('../assets/medallion-concepts/long-way-home/option-07-theme-variants/long-way-home-cinematic-dark.png'),
    light: require('../assets/medallion-concepts/long-way-home/option-07-theme-variants/long-way-home-warm-ivory.png'),
  },
  'memory-maker': {
    redline: require('../assets/medallion-concepts/memory-maker/option-08-theme-variants/memory-maker-grand-touring.png'),
    sakura: require('../assets/medallion-concepts/memory-maker/option-08-theme-variants/memory-maker-rosewater.png'),
    dark: require('../assets/medallion-concepts/memory-maker/option-08-theme-variants/memory-maker-cinematic-dark.png'),
    light: require('../assets/medallion-concepts/memory-maker/option-08-theme-variants/memory-maker-warm-ivory.png'),
  },
};

export function isApprovedMedallion(id: string): id is ApprovedMedallionId {
  return approvedMedallionIds.includes(id as ApprovedMedallionId);
}
