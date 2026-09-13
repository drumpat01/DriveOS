import type { ImageProps } from 'expo-image';

type StableImageSource = ImageProps['source'];

function sourceUri(source: StableImageSource) {
  if (typeof source === 'string') return source;
  if (!source || typeof source !== 'object' || Array.isArray(source) || !('uri' in source)) return undefined;
  return typeof source.uri === 'string' ? source.uri : undefined;
}

/** A view identity must change with the actual bitmap so recycled native views
 * cannot retain artwork from a previous theme, album, or Memory. */
export function stableImageIdentity(identity: string, source: StableImageSource): string {
  if (Array.isArray(source)) return `${identity}:set-${source.map(item => stableImageIdentity('item', item)).join('|')}`;
  return `${identity}:${typeof source === 'number' ? `asset-${source}` : sourceUri(source) ?? 'empty'}`;
}

/** Only remote images need an asynchronous disk-cache lookup. Bundled, file,
 * and data images can be handed to the native image view immediately. */
export function diskCacheLookupKey(source: StableImageSource) {
  const uri = sourceUri(source);
  return uri && /^https:\/\//i.test(uri)
    ? source && typeof source === 'object' && !Array.isArray(source) && 'cacheKey' in source && source.cacheKey ? source.cacheKey : uri
    : null;
}

export function imageTransitionDuration({ reduceMotion, alreadyReady, duration = 140 }: {
  reduceMotion: boolean; alreadyReady: boolean; duration?: number;
}) {
  return reduceMotion || alreadyReady ? 0 : duration;
}
