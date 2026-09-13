import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View, type ImageStyle, type StyleProp } from 'react-native';
import { Image, type ImageProps } from 'expo-image';
import { useAppTheme } from './app-theme';
import { useMotionPreferences } from './motion';
import { diskCacheLookupKey, imageTransitionDuration, stableImageIdentity } from './image-loading-model';

type LoadPhase = 'checking' | 'fresh' | 'ready';
type LoadState = Readonly<{ identity: string; phase: LoadPhase }>;

const displayedImages = new Set<string>();
const MAX_REMEMBERED_IMAGES = 512;

function rememberDisplayed(identity: string) {
  displayedImages.add(identity);
  if (displayedImages.size <= MAX_REMEMBERED_IMAGES) return;
  const oldest = displayedImages.values().next().value;
  if (oldest) displayedImages.delete(oldest);
}

export type JourneyImageProps = Omit<ImageProps, 'source' | 'style' | 'transition' | 'recyclingKey' | 'cachePolicy'> & {
  source: ImageProps['source'];
  imageIdentity: string;
  style?: StyleProp<ImageStyle>;
  cachePolicy?: ImageProps['cachePolicy'];
  crossfadeDuration?: number;
  placeholderColor?: string;
};

/** Shared JourneyDeck image surface. It keeps a themed paint beneath every
 * bitmap, checks the persistent cache before animating, and gives recycled
 * native views a source-specific identity. */
export function JourneyImage({
  source,
  imageIdentity,
  style,
  cachePolicy = 'memory-disk',
  crossfadeDuration = 140,
  placeholderColor,
  placeholder,
  placeholderContentFit,
  contentFit = 'cover',
  onDisplay,
  onError,
  ...imageProps
}: JourneyImageProps) {
  const theme = useAppTheme();
  const { reduceMotion } = useMotionPreferences();
  const identity = useMemo(() => stableImageIdentity(imageIdentity, source), [imageIdentity, source]);
  const lookupKey = useMemo(() => diskCacheLookupKey(source), [source]);
  const immediatelyReady = !lookupKey || displayedImages.has(identity);
  const [load, setLoad] = useState<LoadState>(() => ({ identity, phase: immediatelyReady ? 'ready' : 'checking' }));
  const phase = load.identity === identity ? load.phase : immediatelyReady ? 'ready' : 'checking';

  useEffect(() => {
    let active = true;
    if (!lookupKey || displayedImages.has(identity)) {
      setLoad({ identity, phase: 'ready' });
      return () => { active = false; };
    }
    setLoad({ identity, phase: 'checking' });
    void Image.getCachePathAsync(lookupKey)
      .then(path => { if (active) setLoad({ identity, phase: path ? 'ready' : 'fresh' }); })
      .catch(() => { if (active) setLoad({ identity, phase: 'fresh' }); });
    return () => { active = false; };
  }, [identity, lookupKey]);

  return <View pointerEvents="box-none" style={[styles.frame, { backgroundColor: placeholderColor ?? theme.palette.inset }, style]}>
    <Image
      {...imageProps}
      source={phase === 'checking' ? null : source}
      placeholder={placeholder}
      placeholderContentFit={placeholderContentFit ?? contentFit}
      contentFit={contentFit}
      cachePolicy={cachePolicy}
      recyclingKey={identity}
      transition={imageTransitionDuration({ reduceMotion, alreadyReady: phase === 'ready', duration: crossfadeDuration })}
      onDisplay={() => {
        rememberDisplayed(identity);
        setLoad({ identity, phase: 'ready' });
        onDisplay?.();
      }}
      onError={event => {
        setLoad({ identity, phase: 'ready' });
        onError?.(event);
      }}
      style={StyleSheet.absoluteFill}
    />
  </View>;
}

const styles = StyleSheet.create({
  frame: { overflow: 'hidden' },
});
