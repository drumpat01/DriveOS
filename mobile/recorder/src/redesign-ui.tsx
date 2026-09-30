import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View, type ImageSourcePropType, type RefreshControlProps, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image as ExpoImage } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import Svg, { Circle, Path } from 'react-native-svg';
import { useAppTheme } from './app-theme';
import { appDataClient, type JourneyMemory } from './app-data';
import { GlassBackdrop, useGlassCardStyle } from './glass-material';
import { highQualityAlbumArtwork } from './album-artwork';
import { subscribeLocalArchiveChanges } from './local-archive-events';
import { headerImageSource } from './header-image-sources';
import { haptics } from './haptics';
import { JourneyImage } from './journey-image';
import { redesignColors, withAlpha, type RedesignColors } from './redesign-palette';
import { TouchPressable } from './touch-feedback';

/** Serif display face: New York on iOS. */
export const SERIF = 'ui-serif';
/** Room under scrolling content for the floating tab bar and its accessory. */
export const TAB_BAR_CLEARANCE = 150;

export function useRedesignColors(): RedesignColors {
  const theme = useAppTheme();
  return useMemo(() => redesignColors(theme.id, theme.palette), [theme.id, theme.palette]);
}

const driveArtwork = {
  morning: require('../assets/cinematic-home-morning-photo-v1.jpg'),
  afternoon: require('../assets/cinematic-home-afternoon-photo-v1.jpg'),
  evening: require('../assets/cinematic-home-evening-photo-v1.jpg'),
  night: require('../assets/cinematic-home-night-photo-v1.jpg'),
} as const;

/** App-owned photo for a drive, chosen by its start time and themed like every header. */
export function useDriveArtwork(startedAt: string | null | undefined): ImageSourcePropType {
  const theme = useAppTheme();
  const date = startedAt ? new Date(startedAt) : null;
  const hour = date && !Number.isNaN(date.getTime()) ? date.getHours() : 22;
  const source = hour >= 5 && hour < 12 ? driveArtwork.morning : hour >= 12 && hour < 17 ? driveArtwork.afternoon : hour >= 17 && hour < 21 ? driveArtwork.evening : driveArtwork.night;
  return headerImageSource(source, theme.id);
}

/** Widest content column on a large canvas; keeps lines readable on a 13-inch iPad. */
export const CANVAS_MAX_WIDTH = 1120;
/** Content width at which a tab page switches from one column to a multi-column layout. */
export const CANVAS_WIDE_MIN = 680;

export type RedesignCanvas = { width: number; wide: boolean; columns: 1 | 2 | 3 };
const CanvasContext = createContext<RedesignCanvas>({ width: 0, wide: false, columns: 1 });

/** The measured content width of the enclosing tab page, so screens can adapt on iPad and in Split View. */
export function useRedesignCanvas(): RedesignCanvas { return useContext(CanvasContext); }

export function canvasForWidth(width: number): RedesignCanvas {
  return { width, wide: width >= CANVAS_WIDE_MIN, columns: width >= 980 ? 3 : width >= CANVAS_WIDE_MIN ? 2 : 1 };
}

/** Tab page: themed page color, soft accent glow, and room for the floating bar. */
/** Reading width for tabs that stay a single column on iPad. */
export const CANVAS_READING_WIDTH = 760;

/** `children` may be a function of the measured canvas, for screens that lay out by width. */
export function RedesignPage({ children, refreshControl, testID, maxWidth = CANVAS_MAX_WIDTH }: { children: ReactNode | ((canvas: RedesignCanvas) => ReactNode); refreshControl?: React.ReactElement<RefreshControlProps>; testID?: string; maxWidth?: number }) {
  const colors = useRedesignColors();
  const insets = useSafeAreaInsets();
  const [width, setWidth] = useState(0);
  const canvas = useMemo(() => canvasForWidth(Math.min(width, maxWidth)), [width, maxWidth]);
  return <View testID={testID} onLayout={event => setWidth(Math.round(event.nativeEvent.layout.width))} style={[styles.page, { backgroundColor: colors.page }]}>
    <LinearGradient pointerEvents="none" colors={[colors.glow, colors.page]} locations={[0, 1]} style={styles.glow} />
    <ScrollView refreshControl={refreshControl} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled"
      contentInsetAdjustmentBehavior="never" automaticallyAdjustContentInsets={false} automaticallyAdjustsScrollIndicatorInsets={false}
      contentContainerStyle={[styles.pageContent, canvas.wide && styles.pageContentWide, { paddingTop: insets.top + 14, paddingBottom: insets.bottom + TAB_BAR_CLEARANCE }]}>
      <CanvasContext.Provider value={canvas}><View style={[styles.canvas, { maxWidth }]}>{typeof children === 'function' ? children(canvas) : children}</View></CanvasContext.Provider>
    </ScrollView>
  </View>;
}

export function LargeTitle({ kicker, title, trailing }: { kicker?: string; title: string; trailing?: ReactNode }) {
  const colors = useRedesignColors();
  return <View style={styles.titleRow}>
    <View style={styles.flex}>
      {kicker ? <Text style={[styles.kicker, { color: colors.textSecondary }]}>{kicker.toUpperCase()}</Text> : null}
      <Text accessibilityRole="header" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={[styles.largeTitle, { color: colors.text }]}>{title}</Text>
    </View>
    {trailing}
  </View>;
}

export function CircleButton({ label, symbol, text, onPress }: { label: string; symbol?: SFSymbol; text?: string; onPress: () => void }) {
  const colors = useRedesignColors();
  const glassCard = useGlassCardStyle();
  return <TouchPressable accessibilityRole="button" accessibilityLabel={label} onPress={() => { void haptics.selection(); onPress(); }}
    style={({ pressed }) => [styles.circle, { backgroundColor: colors.surfaceStrong, borderColor: colors.border }, glassCard, pressed && styles.pressed]}>
    <GlassBackdrop role="clear" radius={22} />
    {symbol ? <SymbolView name={symbol} tintColor={colors.text} size={19} weight="semibold" /> : <Text style={[styles.circleText, { color: colors.text }]}>{text}</Text>}
  </TouchPressable>;
}

/** Card surface: tinted fill in solid themes, frosted glass in glass themes. */
export function Surface({ children, style, radius = 24, testID }: { children: ReactNode; style?: StyleProp<ViewStyle>; radius?: number; testID?: string }) {
  const colors = useRedesignColors();
  const glassCard = useGlassCardStyle();
  return <View testID={testID} style={[styles.surface, { borderRadius: radius, backgroundColor: colors.surface, borderColor: colors.border }, glassCard, style]}>
    <GlassBackdrop role="frosted" radius={radius} />
    {children}
  </View>;
}

export function SectionHeader({ title, detail, actionLabel, onAction }: { title: string; detail?: string; actionLabel?: string; onAction?: () => void }) {
  const colors = useRedesignColors();
  return <View style={styles.sectionHeader}>
    <View style={styles.flex}>
      <Text accessibilityRole="header" style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text>
      {detail ? <Text numberOfLines={1} style={[styles.caption, { color: colors.textSecondary }]}>{detail}</Text> : null}
    </View>
    {actionLabel && onAction ? <TouchPressable accessibilityRole="button" hitSlop={10} onPress={onAction} style={({ pressed }) => pressed && styles.pressed}>
      <Text style={[styles.sectionAction, { color: colors.accent }]}>{actionLabel}</Text>
    </TouchPressable> : null}
  </View>;
}

export function Segmented<T extends string>({ label, options, value, onChange }: { label: string; options: { id: T; label: string }[]; value: T; onChange: (value: T) => void }) {
  const colors = useRedesignColors();
  return <View accessibilityRole="tablist" accessibilityLabel={label} style={[styles.segmented, { backgroundColor: colors.track }]}>
    {options.map(option => {
      const selected = option.id === value;
      return <TouchPressable key={option.id} accessibilityRole="tab" accessibilityState={{ selected }}
        onPress={() => { if (!selected) { void haptics.selection(); onChange(option.id); } }}
        style={[styles.segment, selected && { backgroundColor: colors.surfaceStrong, borderColor: colors.border }]}>
        <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={[styles.segmentText, { color: selected ? colors.text : colors.textSecondary, fontWeight: selected ? '700' : '600' }]}>{option.label}</Text>
      </TouchPressable>;
    })}
  </View>;
}

export function StatGrid({ items, compact = false }: { items: { value: string; label: string }[]; compact?: boolean }) {
  const colors = useRedesignColors();
  return <View style={styles.statGrid}>
    {items.map(item => <View key={item.label} accessible accessibilityLabel={`${item.value} ${item.label}`} style={styles.stat}>
      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[compact ? styles.statValueCompact : styles.statValue, { color: colors.text }]}>{item.value}</Text>
      <Text numberOfLines={1} style={[styles.caption, { color: colors.textSecondary }]}>{item.label}</Text>
    </View>)}
  </View>;
}

export function Kicker({ children, color }: { children: string; color?: string }) {
  const colors = useRedesignColors();
  return <Text style={[styles.kicker, { color: color ?? colors.textSecondary }]}>{children.toUpperCase()}</Text>;
}

/** Bottom-weighted scrim so text over a photo reads in light and dark themes. */
export function PhotoScrim() {
  const colors = useRedesignColors();
  return <LinearGradient pointerEvents="none" colors={colors.photoScrim} locations={[0, 0.34, 0.66, 1]} style={StyleSheet.absoluteFill} />;
}

export function PhotoChip({ symbol, text, style }: { symbol?: SFSymbol; text: string; style?: StyleProp<ViewStyle> }) {
  const colors = useRedesignColors();
  return <View style={[styles.photoChip, { backgroundColor: colors.photoChip, borderColor: colors.photoChipBorder }, style]}>
    {symbol ? <SymbolView name={symbol} tintColor={colors.accent} size={13} weight="semibold" /> : null}
    <Text numberOfLines={1} style={[styles.kicker, { color: colors.text }]}>{text.toUpperCase()}</Text>
  </View>;
}

/** Album art, or a palette-tinted tile with a note when a track has none. */
export function Artwork({ uri, size, index = 0, round = false, label }: { uri: string | null | undefined; size: number; index?: number; round?: boolean; label?: string }) {
  const colors = useRedesignColors();
  const radius = round ? size / 2 : Math.round(size * 0.2);
  // Large artwork asks Apple's CDN for 800 px instead of the saved 256 px thumbnail; if that size is missing, fall back.
  const sharp = size >= 120 ? highQualityAlbumArtwork(uri ?? null) : uri;
  const [failed, setFailed] = useState<string | null>(null);
  const source = sharp && sharp !== failed ? sharp : uri;
  if (source) return <ExpoImage accessibilityLabel={label} source={{ uri: source }} cachePolicy="memory-disk" contentFit="cover" transition={120}
    onError={() => { if (source !== uri) setFailed(source); }}
    style={{ width: size, height: size, borderRadius: radius, backgroundColor: colors.surfaceStrong }} />;
  const tint = colors.artwork[index % colors.artwork.length];
  return <View accessible={Boolean(label)} accessibilityLabel={label} style={{ width: size, height: size, borderRadius: radius, backgroundColor: withAlpha(tint, 0.2), borderWidth: StyleSheet.hairlineWidth, borderColor: withAlpha(tint, 0.4), alignItems: 'center', justifyContent: 'center' }}>
    <SymbolView name="music.note" tintColor={tint} size={Math.round(size * 0.38)} weight="semibold" />
  </View>;
}

type Coordinate = [number, number];

/**
 * Route shapes drawn to fit a box. Coordinates are [longitude, latitude];
 * shapes keep their proportions and share one frame so several drives line up.
 */
export function RouteSketch({ routes, width, height, inks, strokeWidth = 3.5, padding = 14 }: {
  routes: Coordinate[][]; width: number; height: number; inks: string[]; strokeWidth?: number; padding?: number;
}) {
  const colors = useRedesignColors();
  const paths = useMemo(() => {
    const points = routes.flat().filter(point => Number.isFinite(point?.[0]) && Number.isFinite(point?.[1]));
    if (points.length < 2 || width <= 0 || height <= 0) return [];
    const lons = points.map(point => point[0]), lats = points.map(point => point[1]);
    const minLon = Math.min(...lons), maxLon = Math.max(...lons), minLat = Math.min(...lats), maxLat = Math.max(...lats);
    const midLat = ((minLat + maxLat) / 2) * Math.PI / 180;
    const spanX = Math.max((maxLon - minLon) * Math.cos(midLat), 1e-6), spanY = Math.max(maxLat - minLat, 1e-6);
    const scale = Math.min((width - padding * 2) / spanX, (height - padding * 2) / spanY);
    const offsetX = (width - spanX * scale) / 2, offsetY = (height - spanY * scale) / 2;
    const project = ([lon, lat]: Coordinate) => [offsetX + (lon - minLon) * Math.cos(midLat) * scale, height - (offsetY + (lat - minLat) * scale)] as const;
    return routes.map(route => {
      const step = Math.max(1, Math.floor(route.length / 240));
      const sampled = route.filter((_, index) => index % step === 0 || index === route.length - 1).map(project);
      return { d: sampled.map(([x, y], index) => `${index ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' '), start: sampled[0], end: sampled.at(-1) };
    }).filter(path => path.start && path.end);
  }, [routes, width, height, padding]);
  if (!paths.length) return null;
  return <Svg width={width} height={height} accessible={false}>
    {paths.map((path, index) => <Path key={`route-${index}`} d={path.d} stroke={inks[index % inks.length]} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" fill="none" />)}
    <Circle cx={paths[0].start![0]} cy={paths[0].start![1]} r={strokeWidth + 1.5} fill={colors.page} stroke={inks[0]} strokeWidth={2.5} />
    <Circle cx={paths.at(-1)!.end![0]} cy={paths.at(-1)!.end![1]} r={strokeWidth + 1} fill={colors.text} />
  </Svg>;
}

/** A Memory's cover photo, or the themed default artwork. */
export function MemoryCoverImage({ memory, onReady }: { memory: Pick<JourneyMemory, 'coverPhotoId' | 'photos' | 'id'>; onReady?: () => void }) {
  const theme = useAppTheme();
  const photo = memory.coverPhotoId ? memory.photos.find(item => item.id === memory.coverPhotoId) ?? memory.photos[0] : memory.photos[0];
  const [uri, setUri] = useState<string | null>(null);
  // A cover whose file was missing loads again once iCloud restores it (photo-recovery.ts notifies the archive).
  const [archiveVersion, setArchiveVersion] = useState(0);
  useEffect(() => subscribeLocalArchiveChanges(() => setArchiveVersion(version => version + 1)), []);
  const ready = useRef(onReady);
  ready.current = onReady;
  const shownPhotoId = useRef<string | null>(null);
  useEffect(() => {
    let active = true;
    if (!photo) { setUri(null); return; }
    if (shownPhotoId.current !== photo.id) { shownPhotoId.current = photo.id; setUri(null); }
    void appDataClient.photoDataUrl(photo).then(value => { if (active) { setUri(value || null); if (!value) ready.current?.(); } }).catch(() => { if (active) ready.current?.(); });
    return () => { active = false; };
  }, [photo?.id, archiveVersion]);
  if (photo && uri) return <ExpoImage source={{ uri }} contentFit="cover" cachePolicy="memory" transition={140} onDisplay={onReady} style={StyleSheet.absoluteFill} />;
  if (photo) return <View style={[StyleSheet.absoluteFill, { backgroundColor: theme.palette.inset }]} />;
  return <JourneyImage imageIdentity={`memory-cover-${theme.id}`} source={headerImageSource(require('../assets/cinematic-memory-polaroids-photo-v1.jpg'), theme.id)}
    contentFit="cover" onDisplay={onReady} onError={onReady} style={StyleSheet.absoluteFill} />;
}

export const redesignStyles = StyleSheet.create({
  pressed: { opacity: 0.72, transform: [{ scale: 0.985 }] },
  caption: { fontSize: 13, lineHeight: 17, fontWeight: '500' },
  body: { fontSize: 16, lineHeight: 24 },
  serifTitle: { fontFamily: SERIF, fontWeight: '600', letterSpacing: -0.3 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  flex: { flex: 1, minWidth: 0 },
});

const styles = StyleSheet.create({
  page: { flex: 1 },
  glow: { position: 'absolute', top: 0, left: 0, right: 0, height: 420 },
  pageContent: { paddingHorizontal: 20 },
  pageContentWide: { paddingHorizontal: 32 },
  canvas: { width: '100%', alignSelf: 'center', gap: 22 },
  flex: { flex: 1, minWidth: 0 },
  pressed: redesignStyles.pressed,
  titleRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 12 },
  kicker: { fontSize: 11, lineHeight: 14, fontWeight: '700', letterSpacing: 1 },
  largeTitle: { fontSize: 34, lineHeight: 40, fontWeight: '800', letterSpacing: -0.6 },
  circle: { width: 44, height: 44, borderRadius: 22, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  circleText: { fontSize: 15, fontWeight: '700' },
  surface: { borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  sectionHeader: { flexDirection: 'row', alignItems: 'flex-end', gap: 12 },
  sectionTitle: { fontSize: 22, lineHeight: 27, fontWeight: '800', letterSpacing: -0.3 },
  sectionAction: { fontSize: 15, fontWeight: '600', paddingBottom: 2 },
  caption: redesignStyles.caption,
  segmented: { flexDirection: 'row', padding: 3, borderRadius: 12 },
  segment: { flex: 1, minHeight: 34, borderRadius: 9, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6, borderWidth: StyleSheet.hairlineWidth, borderColor: 'transparent' },
  segmentText: { fontSize: 14 },
  statGrid: { flexDirection: 'row', gap: 8 },
  stat: { flex: 1, minWidth: 0, gap: 2 },
  statValue: { fontSize: 20, lineHeight: 25, fontWeight: '700', fontVariant: ['tabular-nums'] },
  statValueCompact: { fontSize: 17, lineHeight: 22, fontWeight: '700', fontVariant: ['tabular-nums'] },
  photoChip: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingHorizontal: 11, paddingVertical: 7, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth },
});
