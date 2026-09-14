import type { ThemeId } from './theme-catalog';

export type ApprovedMedallionId =
  | 'first-track'
  | 'long-way-home'
  | 'thousand-mile'
  | 'grand-tourer'
  | 'first-note'
  | 'long-play'
  | 'soundtrack-100'
  | 'memory-maker'
  | 'picture-this'
  | 'story-collector';

export const approvedMedallionIds: readonly ApprovedMedallionId[] = [
  'first-track', 'long-way-home', 'thousand-mile', 'grand-tourer', 'first-note',
  'long-play', 'soundtrack-100', 'memory-maker', 'picture-this', 'story-collector',
];

export const medallionArtwork: Record<ApprovedMedallionId, Record<ThemeId, number>> = {
  'first-track': {
    redline: require('../assets/medallion-concepts/the-first-track/option-01-theme-variants/first-track-grand-touring.png'),
    sakura: require('../assets/medallion-concepts/the-first-track/option-01-theme-variants/first-track-rosewater.png'),
    dark: require('../assets/medallion-concepts/the-first-track/option-01-theme-variants/first-track-cinematic-dark.png'),
    light: require('../assets/medallion-concepts/the-first-track/option-01-theme-variants/first-track-warm-ivory.png'),
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
  'thousand-mile': {
    redline: require('../assets/medallion-concepts/thousand-mile-club/option-02-theme-variants/thousand-mile-club-grand-touring.png'),
    sakura: require('../assets/medallion-concepts/thousand-mile-club/option-02-theme-variants/thousand-mile-club-rosewater.png'),
    dark: require('../assets/medallion-concepts/thousand-mile-club/option-02-theme-variants/thousand-mile-club-cinematic-dark.png'),
    light: require('../assets/medallion-concepts/thousand-mile-club/option-02-theme-variants/thousand-mile-club-warm-ivory.png'),
  },
  'grand-tourer': {
    redline: require('../assets/medallion-concepts/grand-tourer/option-07-theme-variants/grand-tourer-grand-touring.png'),
    sakura: require('../assets/medallion-concepts/grand-tourer/option-07-theme-variants/grand-tourer-rosewater.png'),
    dark: require('../assets/medallion-concepts/grand-tourer/option-07-theme-variants/grand-tourer-cinematic-dark.png'),
    light: require('../assets/medallion-concepts/grand-tourer/option-07-theme-variants/grand-tourer-warm-ivory.png'),
  },
  'first-note': {
    redline: require('../assets/medallion-concepts/first-note/option-01-theme-variants/first-note-grand-touring.png'),
    sakura: require('../assets/medallion-concepts/first-note/option-01-theme-variants/first-note-rosewater.png'),
    dark: require('../assets/medallion-concepts/first-note/option-01-theme-variants/first-note-cinematic-dark.png'),
    light: require('../assets/medallion-concepts/first-note/option-01-theme-variants/first-note-warm-ivory.png'),
  },
  'long-play': {
    redline: require('../assets/medallion-concepts/long-play/option-04-theme-variants/long-play-grand-touring.png'),
    sakura: require('../assets/medallion-concepts/long-play/option-04-theme-variants/long-play-rosewater.png'),
    dark: require('../assets/medallion-concepts/long-play/option-04-theme-variants/long-play-cinematic-dark.png'),
    light: require('../assets/medallion-concepts/long-play/option-04-theme-variants/long-play-warm-ivory.png'),
  },
  'memory-maker': {
    redline: require('../assets/medallion-concepts/memory-maker/option-08-theme-variants/memory-maker-grand-touring.png'),
    sakura: require('../assets/medallion-concepts/memory-maker/option-08-theme-variants/memory-maker-rosewater.png'),
    dark: require('../assets/medallion-concepts/memory-maker/option-08-theme-variants/memory-maker-cinematic-dark.png'),
    light: require('../assets/medallion-concepts/memory-maker/option-08-theme-variants/memory-maker-warm-ivory.png'),
  },
  'picture-this': {
    redline: require('../assets/medallion-concepts/picture-this/option-08-theme-variants/picture-this-grand-touring.png'),
    sakura: require('../assets/medallion-concepts/picture-this/option-08-theme-variants/picture-this-rosewater.png'),
    dark: require('../assets/medallion-concepts/picture-this/option-08-theme-variants/picture-this-cinematic-dark.png'),
    light: require('../assets/medallion-concepts/picture-this/option-08-theme-variants/picture-this-warm-ivory.png'),
  },
  'story-collector': {
    redline: require('../assets/medallion-concepts/story-collector/option-01-theme-variants/story-collector-grand-touring.png'),
    sakura: require('../assets/medallion-concepts/story-collector/option-01-theme-variants/story-collector-rosewater.png'),
    dark: require('../assets/medallion-concepts/story-collector/option-01-theme-variants/story-collector-cinematic-dark.png'),
    light: require('../assets/medallion-concepts/story-collector/option-01-theme-variants/story-collector-warm-ivory.png'),
  },
};

export function isApprovedMedallion(id: string): id is ApprovedMedallionId {
  return approvedMedallionIds.includes(id as ApprovedMedallionId);
}
