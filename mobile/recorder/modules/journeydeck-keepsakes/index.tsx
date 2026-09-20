import { useEffect, useRef, useState } from 'react';
import { requireOptionalNativeModule } from 'expo';
import { Asset } from 'expo-asset';
import { File } from 'expo-file-system';
import { ActivityIndicator, Platform, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { Easing, interpolate, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useAppTheme } from '../../src/app-theme';
import { getMedallionFrame, medallionArtwork, type ApprovedMedallionId } from '../../src/medallion-artwork';
import { MedallionArtworkImage } from '../../src/medallion-artwork-image';
import { useMotionPreferences } from '../../src/motion';
import MedallionDOM from '../../src/medallion-dom';

type MedallionProps = { achievementId: ApprovedMedallionId; name: string; style?: StyleProp<ViewStyle> };
const supportsDOM = Platform.OS === 'web' || requireOptionalNativeModule('ExpoDomWebViewModule') !== null;
// Preserve the existing export for consumers; rendering now uses Expo DOM.
export const isJourneyDeckKeepsakeNativeAvailable = supportsDOM;
const artworkCache = new Map<number, string>();
export const MEDALLION_DROP_MOTION = Object.freeze({ distance: 440, duration: 400, dampingRatio: 0.8, startScale: 0.97 });
const IPAD_PREPARATION_TIMEOUT_MS = 12_000;

export function JourneyDeckMedallion({ achievementId, name, style }: MedallionProps) {
  const theme = useAppTheme();
  const motion = useMotionPreferences();
  const warmUpInPlace = Platform.OS === 'ios' && Platform.isPad;
  const source = medallionArtwork[achievementId][theme.id];
  const frame = getMedallionFrame(achievementId, theme.id);
  const currentSource = useRef(source);
  currentSource.current = source;
  const [loaded, setLoaded] = useState<{ source: number; data: string } | null>(null);
  const [readySource, setReadySource] = useState<number | null>(null);
  const [failedSource, setFailedSource] = useState<number | null>(null);
  const blend = useSharedValue(0);
  const entrance = useSharedValue(-1);
  useEffect(() => {
    let alive = true;
    setReadySource(null); setFailedSource(null);
    if (!supportsDOM) return;
    const cached = artworkCache.get(source);
    if (cached) { setLoaded({ source, data: cached }); return; }
    void (async () => {
      const asset = await Asset.fromModule(source).downloadAsync();
      // Inline local artwork so the WebView needs no network, file URL access,
      // public/ assets or CDN, including on the first launch of an OTA bundle.
      let data: string;
      if (Platform.OS === 'web') {
        const response = await fetch(asset.uri);
        if (!response.ok) throw new Error('Artwork unavailable');
        const blob = await response.blob();
        data = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result)); reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      } else {
        if (!asset.localUri) throw new Error('Artwork unavailable');
        data = `data:image/webp;base64,${await new File(asset.localUri).base64()}`;
      }
      if (!alive) return;
      artworkCache.set(source, data);
      if (artworkCache.size > 4) artworkCache.delete(artworkCache.keys().next().value!);
      setLoaded({ source, data });
    })().catch(() => { if (alive) setFailedSource(source); });
    return () => { alive = false; };
  }, [source]);
  const ready = readySource === source && failedSource !== source;
  const showFallback = failedSource === source || !supportsDOM;
  const canEnter = ready || showFallback;
  useEffect(() => {
    if (!warmUpInPlace || ready || showFallback || !motion.isAppActive) return;
    // A stalled renderer gets a stable artwork fallback, never a late 2D-to-3D swap.
    const timeout = setTimeout(() => {
      if (currentSource.current === source) setFailedSource(source);
    }, IPAD_PREPARATION_TIMEOUT_MS);
    return () => clearTimeout(timeout);
  }, [warmUpInPlace, ready, showFallback, motion.isAppActive, source]);
  useEffect(() => {
    entrance.set(-1);
  }, [entrance, source]);
  useEffect(() => {
    blend.set(withTiming(ready ? 1 : 0, {
      duration: motion.reduceMotion ? 100 : warmUpInPlace ? 180 : 80,
      easing: Easing.bezier(0.23, 1, 0.32, 1),
    }));
  }, [blend, motion.reduceMotion, ready, warmUpInPlace]);
  useEffect(() => {
    if (warmUpInPlace || !canEnter) return;
    entrance.set(motion.reduceMotion ? withTiming(0, { duration: 100 }) : withSpring(0, {
      duration: MEDALLION_DROP_MOTION.duration,
      dampingRatio: MEDALLION_DROP_MOTION.dampingRatio,
    }));
  }, [canEnter, entrance, motion.reduceMotion, source, warmUpInPlace]);
  const fallbackTransition = useAnimatedStyle(() => ({ opacity: 1 - blend.get() }));
  const rendererTransition = useAnimatedStyle(() => ({ opacity: warmUpInPlace ? 1 : blend.get() }));
  const entranceMotion = useAnimatedStyle(() => ({
    transform: [
      { translateY: warmUpInPlace ? 0 : interpolate(entrance.get(), [-1, 0], [-MEDALLION_DROP_MOTION.distance, 0]) },
      { scale: warmUpInPlace ? 1 : interpolate(entrance.get(), [-1, 0], [MEDALLION_DROP_MOTION.startScale, 1]) },
    ],
  }));
  return <View style={[styles.frame, style]}>
    <Animated.View style={[StyleSheet.absoluteFill, styles.coinLayers, entranceMotion]}>
      {(!warmUpInPlace || showFallback) && <Animated.View pointerEvents="none" accessibilityElementsHidden={ready}
        importantForAccessibility={ready ? 'no-hide-descendants' : 'auto'}
        style={[styles.fallback, styles.loadingCoin, warmUpInPlace ? { opacity: 1 } : fallbackTransition]}>
        <MedallionArtworkImage achievementId={achievementId} themeId={theme.id} rimWidth={3}
          label={`${name} medallion artwork`} style={StyleSheet.absoluteFill} />
      </Animated.View>}
      {supportsDOM && loaded?.source === source && failedSource !== source && <Animated.View pointerEvents={ready ? 'auto' : 'none'}
        accessibilityElementsHidden={!ready} importantForAccessibility={ready ? 'auto' : 'no-hide-descendants'}
        style={[StyleSheet.absoluteFill, rendererTransition]}>
        <MedallionDOM key={source} artwork={loaded.data} name={name} frame={frame} reduceMotion={motion.reduceMotion}
          active={motion.isAppActive} waitForPaint={warmUpInPlace} onReady={async () => { if (currentSource.current === source) setReadySource(source); }}
          onError={async () => { if (currentSource.current === source) setFailedSource(source); }}
          dom={{ useExpoDOMWebView: true, scrollEnabled: false, bounces: false,
            contentInsetAdjustmentBehavior: 'never', style: styles.webview,
            containerStyle: styles.webview }} />
      </Animated.View>}
    </Animated.View>
    {warmUpInPlace && !showFallback && <MedallionLoadingCover key={source} ready={ready} name={name}
      reduceMotion={motion.reduceMotion} active={motion.isAppActive} />}
  </View>;
}

/** Keep WKWebView laid out and opaque while hiding all intermediate artwork. */
function MedallionLoadingCover({ ready, name, reduceMotion, active }: {
  ready: boolean; name: string; reduceMotion: boolean; active: boolean;
}) {
  const { palette } = useAppTheme();
  const opacity = useSharedValue(1);
  useEffect(() => {
    opacity.set(ready ? withTiming(0, { duration: reduceMotion ? 100 : 180,
      easing: Easing.bezier(0.23, 1, 0.32, 1) }) : 1);
  }, [ready, reduceMotion, opacity]);
  const reveal = useAnimatedStyle(() => ({ opacity: opacity.get() }));
  return <Animated.View testID="medallion-loading-cover" pointerEvents="none"
    accessible={!ready} accessibilityLabel={`Preparing ${name} medallion`}
    accessibilityElementsHidden={ready} importantForAccessibility={ready ? 'no-hide-descendants' : 'auto'}
    style={[StyleSheet.absoluteFill, styles.cover, { backgroundColor: palette.page }, reveal]}>
    {!ready && <View style={styles.preparing}>
      {!reduceMotion && <ActivityIndicator color={palette.accent} animating={active} />}
      <Text style={[styles.preparingText, { color: palette.muted }]}>Preparing medallion…</Text>
    </View>}
  </Animated.View>;
}

export function FirstJourneyMedallion({ style }: { style?: StyleProp<ViewStyle> }) {
  return <JourneyDeckMedallion achievementId="first-track" name="The First Track" style={style} />;
}

const styles = StyleSheet.create({
  frame: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  coinLayers: { alignItems: 'center', justifyContent: 'center' },
  // Match the physical face's projected diameter (0.958 / 1.1) while loading.
  fallback: { width: '87.1%', height: '87.1%' },
  cover: { alignItems: 'center', justifyContent: 'center', zIndex: 1 },
  preparing: { alignItems: 'center', gap: 12, padding: 20 },
  preparingText: { fontSize: 13, textAlign: 'center' },
  loadingCoin: {
    position: 'absolute',
    borderRadius: 9999,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.34,
    shadowRadius: 11,
  },
  webview: { width: '100%', height: '100%', backgroundColor: 'transparent' },
});
