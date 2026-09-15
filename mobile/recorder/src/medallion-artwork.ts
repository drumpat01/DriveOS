import type { ThemeId } from './theme-catalog';
import type { MedallionFrame } from './medallion-surface';

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
  'first-track',
  'long-way-home',
  'thousand-mile',
  'grand-tourer',
  'first-note',
  'long-play',
  'soundtrack-100',
  'memory-maker',
  'picture-this',
  'story-collector',
];

export const medallionArtwork: Record<ApprovedMedallionId, Record<ThemeId, number>> = {
  'first-track': {
    redline: require('../assets/medallions-v2/runtime/first-track-redline.webp'),
    sakura: require('../assets/medallions-v2/runtime/first-track-sakura.webp'),
    dark: require('../assets/medallions-v2/runtime/first-track-dark.webp'),
    light: require('../assets/medallions-v2/runtime/first-track-light.webp'),
  },
  'long-way-home': {
    redline: require('../assets/medallions-v2/runtime/long-way-home-redline.webp'),
    sakura: require('../assets/medallions-v2/runtime/long-way-home-sakura.webp'),
    dark: require('../assets/medallions-v2/runtime/long-way-home-dark.webp'),
    light: require('../assets/medallions-v2/runtime/long-way-home-light.webp'),
  },
  'thousand-mile': {
    redline: require('../assets/medallions-v2/runtime/thousand-mile-redline.webp'),
    sakura: require('../assets/medallions-v2/runtime/thousand-mile-sakura.webp'),
    dark: require('../assets/medallions-v2/runtime/thousand-mile-dark.webp'),
    light: require('../assets/medallions-v2/runtime/thousand-mile-light.webp'),
  },
  'grand-tourer': {
    redline: require('../assets/medallions-v2/runtime/grand-tourer-redline.webp'),
    sakura: require('../assets/medallions-v2/runtime/grand-tourer-sakura.webp'),
    dark: require('../assets/medallions-v2/runtime/grand-tourer-dark.webp'),
    light: require('../assets/medallions-v2/runtime/grand-tourer-light.webp'),
  },
  'first-note': {
    redline: require('../assets/medallions-v2/runtime/first-note-redline.webp'),
    sakura: require('../assets/medallions-v2/runtime/first-note-sakura.webp'),
    dark: require('../assets/medallions-v2/runtime/first-note-dark.webp'),
    light: require('../assets/medallions-v2/runtime/first-note-light.webp'),
  },
  'long-play': {
    redline: require('../assets/medallions-v2/runtime/long-play-redline.webp'),
    sakura: require('../assets/medallions-v2/runtime/long-play-sakura.webp'),
    dark: require('../assets/medallions-v2/runtime/long-play-dark.webp'),
    light: require('../assets/medallions-v2/runtime/long-play-light.webp'),
  },
  'soundtrack-100': {
    redline: require('../assets/medallions-v2/runtime/soundtrack-100-redline.webp'),
    sakura: require('../assets/medallions-v2/runtime/soundtrack-100-sakura.webp'),
    dark: require('../assets/medallions-v2/runtime/soundtrack-100-dark.webp'),
    light: require('../assets/medallions-v2/runtime/soundtrack-100-light.webp'),
  },
  'memory-maker': {
    redline: require('../assets/medallions-v2/runtime/memory-maker-redline.webp'),
    sakura: require('../assets/medallions-v2/runtime/memory-maker-sakura.webp'),
    dark: require('../assets/medallions-v2/runtime/memory-maker-dark.webp'),
    light: require('../assets/medallions-v2/runtime/memory-maker-light.webp'),
  },
  'picture-this': {
    redline: require('../assets/medallions-v2/runtime/picture-this-redline.webp'),
    sakura: require('../assets/medallions-v2/runtime/picture-this-sakura.webp'),
    dark: require('../assets/medallions-v2/runtime/picture-this-dark.webp'),
    light: require('../assets/medallions-v2/runtime/picture-this-light.webp'),
  },
  'story-collector': {
    redline: require('../assets/medallions-v2/runtime/story-collector-redline.webp'),
    sakura: require('../assets/medallions-v2/runtime/story-collector-sakura.webp'),
    dark: require('../assets/medallions-v2/runtime/story-collector-dark.webp'),
    light: require('../assets/medallions-v2/runtime/story-collector-light.webp'),
  },
};

// These normalized face bounds are shared by native thumbnails and WebGL.
// Using one crop keeps the artwork centered on the physical coin in every theme.
const medallionFrames = require('../assets/medallions-v2/frames.json') as Record<`${ApprovedMedallionId}-${ThemeId}`, MedallionFrame>;

export function getMedallionFrame(id: ApprovedMedallionId, theme: ThemeId): MedallionFrame {
  return medallionFrames[`${id}-${theme}`];
}

export function isApprovedMedallion(id: string): id is ApprovedMedallionId {
  return approvedMedallionIds.includes(id as ApprovedMedallionId);
}
