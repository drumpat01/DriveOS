import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, ZoomIn, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Image } from 'expo-image';
import { useAppTheme } from './app-theme';
import { TouchPressable } from './touch-feedback';
import { highQualityAlbumArtwork } from './album-artwork';
import { compactArtistCredit } from './artist-credit';
import type { ReplayPhoto, ReplayStop } from './journey-replay-model';
import type { SongRouteMoment } from './route-moments';

/** The moment and transport stay beside the moving route, rather than below the fold. */
export function JourneyReplayStage({ playing, complete, animate, timestamp, song, photo, stop, progress, onToggle, onRestart, onExplore, onPhotoError, onSeek }: {
  playing: boolean; complete: boolean; animate: boolean; timestamp: number; song: SongRouteMoment | null;
  photo: ReplayPhoto | null | undefined; stop: ReplayStop | null; progress: number;
  onToggle: () => void; onRestart: () => void; onExplore: () => void; onPhotoError: () => void; onSeek: (progress: number) => void;
}) {
  const { palette: c } = useAppTheme();
  const [railWidth, setRailWidth] = useState(1);
  const clock = new Date(timestamp).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  const arrival = complete ? 'Journey complete' : stop ? 'A pause along the way' : photo ? 'A moment from your journey' : song ? 'Your soundtrack here' : 'On the road';
  const momentKey = complete ? 'complete' : photo ? `photo-${photo.id}` : stop ? stop.id : song ? `song-${song.index}-${song.playedAt}` : 'road';
  return <View testID="journey-replay-stage" style={[s.stage, { backgroundColor: c.page, borderColor: c.line }]}>
    <View style={s.heading}><Text style={[s.eyebrow, { color: c.accent }]}>{clock} · {Math.round(progress * 100)}%</Text><TouchPressable accessibilityRole="button" accessibilityLabel="Exit replay and explore map" onPress={onExplore} style={s.close}><Text style={{ color: c.muted }}>Explore map ↗</Text></TouchPressable></View>
    <Animated.View key={momentKey} entering={animate ? FadeInDown.duration(340).withInitialValues({ opacity: 0, transform: [{ translateY: 16 }] }) : undefined} style={s.moment}>
      {photo && !complete ? <Image source={{ uri: photo.uri }} onError={onPhotoError} accessibilityLabel="Photo from this moment" contentFit="contain" cachePolicy="memory-disk" style={[s.photo, { backgroundColor: c.inset }]} /> :
        song && !complete && !stop ? <ReplayCover uri={song.artworkUrl} /> : <Animated.View entering={animate ? ZoomIn.duration(260) : undefined} style={[s.badge, { backgroundColor: c.inset }]}><Text style={{ color: c.accent, fontSize: 32 }}>{complete ? '✓' : stop ? 'Ⅱ' : '➤'}</Text></Animated.View>}
      <View style={s.copy}><Text style={[s.eyebrow, { color: c.accent }]}>{arrival}</Text>
        <Text numberOfLines={2} style={[s.title, { color: c.text }]}>{complete ? 'You’ve arrived' : stop ? `${Math.max(1, Math.round((stop.end - stop.at) / 60_000))} minute stop` : song?.track ?? 'Watch your journey unfold'}</Text>
        <Text numberOfLines={2} accessibilityLabel={song?.artist} style={[s.detail, { color: c.muted }]}>{song && !complete ? compactArtistCredit(song.artist) : complete ? 'Every mile, now a memory.' : 'Following your saved route'}</Text>
      </View>
    </Animated.View>
    <TouchPressable onLayout={event => setRailWidth(Math.max(1, event.nativeEvent.layout.width))} onPress={event => onSeek(Math.max(0, Math.min(1, event.nativeEvent.locationX / railWidth)))}
      accessibilityRole="adjustable" accessibilityLabel="Journey story position" accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }} accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={event => onSeek(Math.max(0, Math.min(1, progress + (event.nativeEvent.actionName === 'increment' ? .05 : -.05))))} style={{ minHeight: 30, justifyContent: 'center' }}>
      <View style={[s.rail, { backgroundColor: c.inset }]}><Animated.View style={{ height: 4, backgroundColor: c.accent, width: `${Math.max(0, Math.min(1, progress)) * 100}%`, transitionProperty: 'width', transitionDuration: animate && playing ? 100 : 0, transitionTimingFunction: 'linear' }} /></View>
    </TouchPressable>
    <View style={s.transport}><TouchPressable accessibilityRole="button" accessibilityLabel="Restart journey story" onPress={onRestart} style={s.restart}><Text style={{ color: c.text, fontSize: 23 }}>↺</Text></TouchPressable>
      <TouchPressable accessibilityRole="button" accessibilityLabel={complete ? 'Replay journey story' : playing ? 'Pause journey story' : 'Resume journey story'} onPress={onToggle} style={[s.play, { backgroundColor: c.accent }]}><Text style={{ color: c.onAccent, fontWeight: '800' }}>{complete ? '↺  Replay' : playing ? 'Ⅱ  Pause' : '▶  Continue'}</Text></TouchPressable>
    </View>
  </View>;
}

function ReplayCover({ uri }: { uri: string | null }) {
  const { palette: c } = useAppTheme();
  const [failed, setFailed] = useState<string[]>([]);
  const source = [highQualityAlbumArtwork(uri), uri].find(value => value && !failed.includes(value));
  return source ? <Image source={{ uri: source }} onError={() => setFailed(old => [...old, source])} contentFit="cover" cachePolicy="memory-disk" style={s.cover} /> : <View style={[s.badge, { backgroundColor: c.inset }]}><Text style={{ color: c.accent, fontSize: 32 }}>♪</Text></View>;
}

export function ReplayPosition({ heading, playing, animate }: { heading: number; playing: boolean; animate: boolean }) {
  const { palette: c } = useAppTheme();
  const bearing = useSharedValue(heading);
  useEffect(() => {
    const from = bearing.get();
    const next = from + ((heading - from + 540) % 360 + 360) % 360 - 180;
    bearing.set(animate ? withTiming(next, { duration: 100 }) : next);
  }, [heading, animate, bearing]);
  const turn = useAnimatedStyle(() => ({ transform: [{ rotate: `${bearing.get()}deg` }] }));
  return <View style={s.position}>
    <Animated.View style={[s.halo, { borderColor: c.accent, backgroundColor: `${c.accent}22` }, animate && playing ? { animationName: { '0%': { transform: [{ scale: 1 }], opacity: .7 }, '100%': { transform: [{ scale: 1.45 }], opacity: 0 } }, animationDuration: 1500, animationIterationCount: 'infinite' } : undefined]} />
    <View style={[s.puck, { backgroundColor: c.accent, borderColor: c.page }]}><Animated.View style={turn}><Text style={{ color: c.onAccent, fontSize: 24, fontWeight: '900' }}>▲</Text></Animated.View></View>
  </View>;
}

const s = StyleSheet.create({
  stage: { borderWidth: 1, borderRadius: 22, padding: 14, gap: 10 }, heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  eyebrow: { fontSize: 10, fontWeight: '800', letterSpacing: .8 }, close: { minHeight: 32, justifyContent: 'center' }, moment: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  copy: { flex: 1, minWidth: 0, gap: 5 }, title: { fontSize: 19, lineHeight: 23, fontWeight: '800' }, detail: { fontSize: 12, lineHeight: 16 },
  cover: { width: 88, height: 88, borderRadius: 15 }, photo: { width: 112, height: 120, borderRadius: 14 }, badge: { width: 64, height: 64, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  rail: { height: 4, borderRadius: 2, overflow: 'hidden' }, transport: { flexDirection: 'row', gap: 12, alignItems: 'center' }, restart: { width: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }, play: { flex: 1, minHeight: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  position: { width: 64, height: 64, alignItems: 'center', justifyContent: 'center' }, halo: { position: 'absolute', width: 48, height: 48, borderRadius: 24, borderWidth: 2 }, puck: { width: 38, height: 38, borderRadius: 19, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
});
