import { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useIsFocused } from 'expo-router';
import Animated, { useAnimatedScrollHandler, useAnimatedStyle, useSharedValue, type SharedValue } from 'react-native-reanimated';
import { useAppTheme } from './app-theme';
import { MOTION_DURATIONS, useMotionPreferences } from './motion';
import type { SoundtrackTrack } from './app-data';
import { albumCarouselDepth, albumCarouselItems, albumCarouselLayout } from './album-carousel-model';
import { highQualityAlbumArtwork } from './album-artwork';

type AlbumItem = ReturnType<typeof albumCarouselItems>[number];

function AlbumCover({ item, index, cover, stride, offset, enabled, active, animate, onTrack }: {
  item: AlbumItem; index: number; cover: number; stride: number; offset: SharedValue<number>;
  enabled: boolean; active: boolean; animate: boolean; onTrack: (track: SoundtrackTrack) => void;
}) {
  const theme = useAppTheme();
  const [pressed, setPressed] = useState(false);
  const [failedSources, setFailedSources] = useState<string[]>([]);
  const { track } = item;
  const preferredArtwork = highQualityAlbumArtwork(track.artworkUrl);
  const artwork = [preferredArtwork, track.artworkUrl].find(uri => uri && !failedSources.includes(uri));
  useEffect(() => { setPressed(false); }, [active, enabled]);
  useEffect(() => { setFailedSources([]); }, [track.artworkUrl]);
  const depth = useAnimatedStyle(() => {
    const frame = albumCarouselDepth(index, offset.get(), stride, animate);
    return { transform: [{ perspective: 900 }, { translateY: frame.lift }, { rotateY: `${frame.rotation}deg` }, { scale: frame.scale }] };
  });
  return <View style={{ width: stride, paddingHorizontal: 8 }}>
    <Animated.View testID={`album-depth-${index}`} style={depth}>
      <Pressable accessibilityRole="button" accessibilityLabel={`Open ${track.track} by ${track.artist}`}
        accessibilityState={{ disabled: !enabled }} disabled={!enabled} pressRetentionOffset={12}
        onPressIn={() => { if (enabled && active) setPressed(true); }} onPressOut={() => setPressed(false)}
        onPress={() => { if (enabled && active) onTrack(track); }}>
        <Animated.View testID={`album-press-${index}`} style={{ transform: [{ scale: pressed && animate ? .97 : 1 }],
          transitionProperty: 'transform', transitionDuration: animate ? MOTION_DURATIONS.feedback : 0, transitionTimingFunction: 'ease-out' }}>
          <View style={[styles.coverShadow, { shadowColor: theme.palette.accent }]}>
            <View style={[styles.cover, { width: cover, height: cover, backgroundColor: theme.palette.inset, borderColor: theme.palette.line }]}>
              {artwork ? <Image source={{ uri: artwork }} style={StyleSheet.absoluteFill}
                placeholder={artwork !== track.artworkUrl && track.artworkUrl ? { uri: track.artworkUrl } : undefined} placeholderContentFit="cover"
                contentFit="cover" cachePolicy="memory-disk" recyclingKey={`${item.key}:${artwork}`}
                onError={() => setFailedSources(previous => previous.includes(artwork) ? previous : [...previous, artwork])} />
                : <Text accessible={false} style={{ color: theme.palette.accent, fontSize: 44 }}>♪</Text>}
            </View>
          </View>
          <View style={styles.caption}>
            <Text numberOfLines={2} style={[styles.title, { color: theme.palette.text }]}>{track.track}</Text>
            <Text numberOfLines={2} style={[styles.artist, { color: theme.palette.muted }]}>{track.artist}</Text>
          </View>
        </Animated.View>
      </Pressable>
    </Animated.View>
  </View>;
}

export function AlbumCarousel({ tracks, enabled, onTrack }: { tracks: SoundtrackTrack[]; enabled: boolean; onTrack: (track: SoundtrackTrack) => void }) {
  const { reduceMotion, isAppActive } = useMotionPreferences();
  const focused = useIsFocused();
  const active = focused && isAppActive, animate = active && !reduceMotion;
  const [width, setWidth] = useState(0);
  const layout = albumCarouselLayout(width);
  const items = useMemo(() => albumCarouselItems(tracks), [tracks]);
  const signature = JSON.stringify(items.map(item => item.key));
  const offset = useSharedValue(0);
  const list = useRef<FlatList<AlbumItem>>(null);
  const prior = useRef({ stride: layout.stride, keys: [] as string[] });
  const scroll = useAnimatedScrollHandler({ onScroll: event => { offset.set(event.contentOffset.x); } });

  // Preserve the centered selection across rotation, refresh and inserted songs.
  // The current scroll position is sampled only here, never by React per frame.
  useEffect(() => {
    if (!width) return;
    const previous = prior.current;
    const oldIndex = Math.max(0, Math.round(offset.get() / previous.stride));
    const keys = JSON.parse(signature) as string[];
    const retained = keys.indexOf(previous.keys[oldIndex]);
    const index = Math.max(0, Math.min(keys.length - 1, retained < 0 ? oldIndex : retained));
    const nextOffset = index * layout.stride;
    offset.set(nextOffset);
    list.current?.scrollToOffset({ offset: nextOffset, animated: false });
    prior.current = { stride: layout.stride, keys };
  }, [width, layout.stride, signature, offset]);

  return <View testID="soundtrack-carousel" onLayout={event => setWidth(event.nativeEvent.layout.width)}>
    {width > 0 && <Animated.FlatList ref={list} testID="soundtrack-carousel-list" horizontal data={items}
      renderItem={({ item, index }) => <AlbumCover item={item} index={index} cover={layout.cover} stride={layout.stride}
        offset={offset} enabled={enabled} active={active} animate={animate} onTrack={onTrack} />}
      keyExtractor={item => item.key} extraData={`${enabled}:${active}:${animate}:${width}`}
      getItemLayout={(_, index) => ({ length: layout.stride, offset: layout.padding + layout.stride * index, index })}
      contentContainerStyle={{ paddingHorizontal: layout.padding, paddingTop: 20, paddingBottom: 16 }}
      onScroll={scroll} scrollEventThrottle={16} showsHorizontalScrollIndicator={false} directionalLockEnabled
      snapToInterval={layout.stride} decelerationRate="fast" disableIntervalMomentum
      contentInsetAdjustmentBehavior="never" automaticallyAdjustContentInsets={false}
      initialNumToRender={5} maxToRenderPerBatch={5} windowSize={5} removeClippedSubviews={false}
    />}
  </View>;
}

const styles = StyleSheet.create({
  coverShadow: { shadowOpacity: .22, shadowRadius: 10, shadowOffset: { width: 0, height: 5 } },
  cover: { borderRadius: 16, borderWidth: 1, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  caption: { paddingTop: 10, gap: 3 },
  title: { fontSize: 14, lineHeight: 20, fontWeight: '700', textAlign: 'center' },
  artist: { fontSize: 12, lineHeight: 18, textAlign: 'center' },
});
