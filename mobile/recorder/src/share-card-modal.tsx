import { forwardRef, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Sharing from 'expo-sharing';
import { captureRef } from 'react-native-view-shot';
import { LinearGradient } from 'expo-linear-gradient';
import { Canvas, ColorMatrix, Image as SkiaImage, useImage } from '@shopify/react-native-skia';
import Svg, { Circle, Defs, G, LinearGradient as SvgLinearGradient, Path, Polyline, Stop, Text as SvgText } from 'react-native-svg';

import { appDataClient, type JourneyPhoto } from './app-data';

const journeyDeckLogo = require('../assets/icon.png');

// Keep exported share maps aligned with journey-map-theme.ts: near-black land,
// deep-violet roads, and the coral-orange JourneyDeck route treatment.
const shareMapPalette = {
  background: '#05020a',
  road: '#8a4c9a',
  route: '#ff684f',
  routeWarm: '#ff9a62',
};

const mapBackgroundRgb = [0x05 / 255, 0x02 / 255, 0x0a / 255] as const;
const roadRgb = [0x8a / 255, 0x4c / 255, 0x9a / 255] as const;
const colorizedInvertedLuminanceRow = (background: number, detail: number) => {
  const range = detail - background;
  return [
    -0.2126 * range,
    -0.7152 * range,
    -0.0722 * range,
    0,
    detail,
  ];
};
const shareMapColorMatrix = [
  ...colorizedInvertedLuminanceRow(mapBackgroundRgb[0], roadRgb[0]),
  ...colorizedInvertedLuminanceRow(mapBackgroundRgb[1], roadRgb[1]),
  ...colorizedInvertedLuminanceRow(mapBackgroundRgb[2], roadRgb[2]),
  0, 0, 0, 1, 0,
];

export type ShareCardPayload = {
  kind: 'memory' | 'collection' | 'journey';
  eyebrow: string;
  title: string;
  subtitle: string;
  metrics: { label: string; value: string }[];
  photo?: JourneyPhoto | null;
  accent?: string;
  journey?: {
    startedAt: string;
    miles: number;
    durationMinutes: number;
    energyUsedKwh: number | null;
    songCount: number;
    startLocation: string | null;
    endLocation: string | null;
    routeCoordinates: [number, number][];
    routeProtected: boolean;
    routePrivacySummary: string;
    routeTrimmedStart: boolean;
    routeTrimmedEnd: boolean;
    songPoints: { index: number; coordinate: [number, number] }[];
    featured: { track: string; artist: string; artworkUrl: string | null } | null;
    topArtist: string | null;
  };
};

type JourneyShareTheme = 'cinematic' | 'electric' | 'sunset';
type JourneyShareMapStyle = 'street' | 'dim' | 'route';
type JourneyShareArtwork = 'album' | 'backdrop' | 'none';
type JourneyShareStat = 'distance' | 'duration' | 'songs' | 'artist';

const journeyThemes: Record<JourneyShareTheme, { accent: string; accent2: string; background: string; panel: string; text: string }> = {
  cinematic: { accent: '#ff725a', accent2: '#ad82ff', background: '#0c0712', panel: '#170d21', text: '#fff8fd' },
  electric: { accent: '#72e9ff', accent2: '#71f0bc', background: '#07131c', panel: '#0d202a', text: '#f4fdff' },
  sunset: { accent: '#ffb274', accent2: '#ff7e81', background: '#241025', panel: '#32152b', text: '#fff8f3' },
};

export function ShareCardModal({ payload, onClose }: { payload: ShareCardPayload | null; onClose: () => void }) {
  const cardRef = useRef<View>(null);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoLoading, setPhotoLoading] = useState(false);
  const [journeyArtworkLoading, setJourneyArtworkLoading] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [journeyTheme, setJourneyTheme] = useState<JourneyShareTheme>('cinematic');
  const [journeyMapStyle, setJourneyMapStyle] = useState<JourneyShareMapStyle>('street');
  const [journeyArtwork, setJourneyArtwork] = useState<JourneyShareArtwork>('album');
  const [journeyStats, setJourneyStats] = useState<JourneyShareStat[]>(['distance', 'duration', 'songs', 'artist']);

  useEffect(() => {
    let active = true;
    setPhotoUri(null);
    setPhotoLoading(Boolean(payload?.photo));
    if (payload?.photo) void appDataClient.photoDataUrl(payload.photo).then(uri => { if (active) setPhotoUri(uri); }).catch(() => undefined).finally(() => { if (active) setPhotoLoading(false); });
    return () => { active = false; };
  }, [payload?.photo?.id]);

  useEffect(() => {
    setJourneyTheme('cinematic');
    setJourneyMapStyle('street');
    setJourneyArtwork('album');
    setJourneyStats(['distance', 'duration', 'songs', 'artist']);
    setJourneyArtworkLoading(Boolean(payload?.journey?.featured?.artworkUrl));
  }, [payload?.journey?.startedAt]);

  const share = async () => {
    if (!payload || !cardRef.current) return;
    setSharing(true);
    try {
      if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available on this device.');
      const uri = await captureRef(cardRef, { format: 'png', quality: 1, result: 'tmpfile', width: 1080, height: payload.journey ? 1550 : 1350 });
      await Sharing.shareAsync(uri, { UTI: 'public.png', mimeType: 'image/png', dialogTitle: `Share ${payload.title}` });
    } catch (error) {
      Alert.alert('Card not shared', error instanceof Error ? error.message : 'JourneyDeck could not create this share card.');
    } finally {
      setSharing(false);
    }
  };

  const accent = payload?.accent ?? '#ff7658';
  return <Modal visible={Boolean(payload)} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
    <SafeAreaView style={styles.modalRoot}>
      <Pressable accessibilityLabel="Close share card" onPress={onClose} style={StyleSheet.absoluteFill} />
      <View style={styles.sheet}>
        <View style={styles.sheetHeader}>
          <View><Text style={styles.sheetKicker}>PRIVACY-SAFE PREVIEW</Text><Text style={styles.sheetTitle}>Share card</Text></View>
          <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} style={styles.closeButton}><Text style={styles.closeText}>×</Text></Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.previewWrap} showsVerticalScrollIndicator={false}>
          {payload?.journey
            ? <JourneySharePreview ref={cardRef} journey={payload.journey} theme={journeyTheme} mapStyle={journeyMapStyle} artwork={journeyArtwork} stats={journeyStats} onArtworkReady={() => setJourneyArtworkLoading(false)} />
            : payload && <View ref={cardRef} collapsable={false} style={styles.card}>
              {photoUri ? <Image source={{ uri: photoUri }} resizeMode="cover" style={StyleSheet.absoluteFill} /> : <View style={[StyleSheet.absoluteFill, { backgroundColor: '#120b21' }]}><View style={[styles.orb, { backgroundColor: accent }]} /><View style={[styles.route, { backgroundColor: accent }]} /><View style={[styles.route, styles.routeTwo]} /></View>}
              <View style={styles.shade} />
              <View style={styles.cardTop}><JourneyDeckShareMark /></View>
              <View style={styles.cardCopy}>
                <Text style={[styles.cardEyebrow, { color: accent }]}>{payload.eyebrow}</Text>
                <Text style={styles.cardTitle}>{payload.title}</Text>
                <Text style={styles.cardSubtitle}>{payload.subtitle}</Text>
                <View style={styles.metrics}>{payload.metrics.slice(0, 3).map(metric => <View key={metric.label} style={styles.metric}><Text style={styles.metricValue}>{metric.value}</Text><Text style={styles.metricLabel}>{metric.label}</Text></View>)}</View>
                <View style={styles.privacyLine}><Text style={styles.privacyText}>PRECISE LOCATIONS HIDDEN  •  YOUR DRIVE, REMEMBERED.</Text></View>
              </View>
            </View>}
          {payload?.journey && <JourneyShareControls theme={journeyTheme} mapStyle={journeyMapStyle} artwork={journeyArtwork} stats={journeyStats} onTheme={setJourneyTheme} onMapStyle={setJourneyMapStyle} onArtwork={value => { setJourneyArtwork(value); setJourneyArtworkLoading(value !== 'none' && Boolean(payload.journey?.featured?.artworkUrl)); }} onToggleStat={stat => setJourneyStats(current => current.includes(stat) ? current.filter(item => item !== stat) : [...current, stat])} />}
          <View style={styles.privacyNote}><Text style={styles.privacyNoteTitle}>Privacy preview · protected route</Text><Text style={styles.privacyNoteText}>{payload?.journey ? payload.journey.routeTrimmedStart || payload.journey.routeTrimmedEnd ? 'Home and Work route segments are physically removed to the farther of a one-mile boundary or the outer soundtrack moment. Hidden coordinates and song pins never enter the exported image.' : 'Street addresses and exact private coordinates never enter the exported image.' : 'The image excludes precise routes, street addresses, and private coordinates. Only the summary shown above is exported.'}</Text></View>
        </ScrollView>
        <Pressable accessibilityRole="button" onPress={() => void share()} disabled={sharing || photoLoading || journeyArtworkLoading} style={[styles.shareButton, (sharing || photoLoading || journeyArtworkLoading) && styles.disabled]}>{sharing || photoLoading || journeyArtworkLoading ? <ActivityIndicator color="#1a0907" /> : <Text style={styles.shareText}>Share image</Text>}</Pressable>
      </View>
    </SafeAreaView>
  </Modal>;
}

const JourneySharePreview = forwardRef<View, {
  journey: NonNullable<ShareCardPayload['journey']>;
  theme: JourneyShareTheme;
  mapStyle: JourneyShareMapStyle;
  artwork: JourneyShareArtwork;
  stats: JourneyShareStat[];
  onArtworkReady: () => void;
}>(function JourneySharePreview({ journey, theme, mapStyle, artwork, stats, onArtworkReady }, ref) {
  const palette = journeyThemes[theme], safeRoute = privacySafeJourneyRoute(journey);
  const featured = journey.featured, shownStats = selectedJourneyStats(journey, stats);
  return <View ref={ref} collapsable={false} style={[styles.card, styles.journeyShareCard, { backgroundColor: palette.background }]}>
    {featured?.artworkUrl && artwork === 'backdrop' && <Image source={{ uri: featured.artworkUrl }} resizeMode="cover" onLoadEnd={onArtworkReady} onError={onArtworkReady} style={styles.journeyShareBackdrop} />}
    <LinearGradient colors={theme === 'electric' ? ['rgba(5,18,27,0.28)', '#061017ef'] as const : theme === 'sunset' ? ['rgba(55,13,39,0.2)', '#1d0b1ce8'] as const : ['rgba(11,5,18,0.12)', '#09050fe8'] as const} style={StyleSheet.absoluteFill} />
    <View style={styles.journeyShareTop}><JourneyDeckShareMark context="JOURNEY MEMORY" /></View>
    <Text style={[styles.journeyShareEyebrow, { color: palette.accent }]}>{formatJourneyShareDate(journey.startedAt).toUpperCase()}</Text>
    <Text style={[styles.journeyShareTitle, { color: palette.text }]}>{journeyShareTitle(journey.startedAt).toUpperCase()}</Text>
    <View style={styles.journeyShareStats}>{shownStats.map(stat => <View key={stat.label} style={[styles.journeyShareStat, { borderColor: `${palette.accent}55`, backgroundColor: palette.panel }]}><Text style={[styles.journeyShareStatLabel, { color: palette.accent }]}>{stat.label}</Text><Text style={[styles.journeyShareStatValue, { color: palette.text }]} numberOfLines={1}>{stat.value}</Text></View>)}</View>
    <ShareRouteSnapshot route={safeRoute.points} songPoints={journey.songPoints} mapStyle={mapStyle} trimmedStart={safeRoute.trimmedStart} trimmedEnd={safeRoute.trimmedEnd} />
    <View style={styles.journeyShareRouteLabels}><Text style={styles.journeyShareRouteLabel} numberOfLines={1}>{safeRoute.startLabel}</Text><Text style={[styles.journeyShareRouteArrow, { color: palette.accent }]}>→</Text><Text style={styles.journeyShareRouteLabel} numberOfLines={1}>{safeRoute.endLabel}</Text></View>
    <View style={[styles.journeyShareMusic, { borderColor: `${palette.accent2}66`, backgroundColor: palette.panel }]}>
      {featured?.artworkUrl && artwork === 'album' ? <Image source={{ uri: featured.artworkUrl }} resizeMode="cover" onLoadEnd={onArtworkReady} onError={onArtworkReady} style={styles.journeyShareAlbum} /> : <View style={[styles.journeyShareAlbumFallback, { backgroundColor: `${palette.accent2}44` }]}><Text style={[styles.journeyShareAlbumNote, { color: palette.accent2 }]}>♪</Text></View>}
      <View style={styles.journeyShareMusicCopy}><Text style={[styles.journeyShareMusicLabel, { color: palette.accent }]}>JOURNEY SOUNDTRACK</Text><Text style={[styles.journeyShareTrack, { color: palette.text }]} numberOfLines={1}>{featured?.track ?? 'The road, remembered'}</Text><Text style={[styles.journeyShareArtist, { color: palette.accent2 }]} numberOfLines={1}>{featured?.artist ?? (journey.topArtist || 'JourneyDeck')}</Text></View>
    </View>
    <Text style={styles.journeySharePrivacy}>{safeRoute.trimmedStart || safeRoute.trimmedEnd ? 'REAL ROUTE · SAVED PLACE SEGMENT TRIMMED · © OPENSTREETMAP' : safeRoute.protected ? 'REAL ROUTE · PRIVATE ZONES MASKED · © OPENSTREETMAP' : 'REAL RECORDED ROUTE · STREET ADDRESSES HIDDEN · © OPENSTREETMAP'}</Text>
  </View>;
});

function JourneyDeckShareMark({ context }: { context?: string }) {
  return <View style={styles.shareBrand}>
    <Image source={journeyDeckLogo} resizeMode="contain" style={styles.shareBrandLogo} />
    <View style={styles.shareBrandCopy}>
      <Text style={styles.shareBrandName}>JOURNEYDECK</Text>
      {context && <Text style={styles.shareBrandContext}>{context}</Text>}
    </View>
  </View>;
}

function JourneyShareControls({ theme, mapStyle, artwork, stats, onTheme, onMapStyle, onArtwork, onToggleStat }: {
  theme: JourneyShareTheme; mapStyle: JourneyShareMapStyle; artwork: JourneyShareArtwork; stats: JourneyShareStat[];
  onTheme: (value: JourneyShareTheme) => void; onMapStyle: (value: JourneyShareMapStyle) => void; onArtwork: (value: JourneyShareArtwork) => void; onToggleStat: (value: JourneyShareStat) => void;
}) {
  return <View style={styles.journeyShareControls}>
    <Text style={styles.controlsKicker}>BUILD YOUR CARD</Text>
    <ShareChoiceRow label="THEME" value={theme} choices={[['cinematic', 'Cinematic'], ['electric', 'Electric'], ['sunset', 'Sunset']]} onSelect={value => onTheme(value as JourneyShareTheme)} />
    <ShareChoiceRow label="MAP" value={mapStyle} choices={[['street', 'Street'], ['dim', 'Dimmed'], ['route', 'Route only']]} onSelect={value => onMapStyle(value as JourneyShareMapStyle)} />
    <ShareChoiceRow label="ARTWORK" value={artwork} choices={[['album', 'Featured album'], ['backdrop', 'Album backdrop'], ['none', 'No artwork']]} onSelect={value => onArtwork(value as JourneyShareArtwork)} />
    <Text style={[styles.controlsKicker, styles.controlsStatsKicker]}>SHOW ON CARD</Text>
    <View style={styles.statToggleGrid}>{([['distance', 'Distance'], ['duration', 'Duration'], ['songs', 'Song count'], ['artist', 'Top artist']] as const).map(([value, label]) => <Pressable key={value} accessibilityRole="checkbox" accessibilityState={{ checked: stats.includes(value) }} onPress={() => onToggleStat(value)} style={[styles.statToggle, stats.includes(value) && styles.statToggleOn]}><Text style={styles.statToggleMark}>{stats.includes(value) ? '✓' : '+'}</Text><Text style={styles.statToggleText}>{label}</Text></Pressable>)}</View>
  </View>;
}

function ShareChoiceRow({ label, value, choices, onSelect }: { label: string; value: string; choices: readonly (readonly [string, string])[]; onSelect: (value: string) => void }) {
  return <View style={styles.choiceRow}><Text style={styles.choiceLabel}>{label}</Text><View style={styles.choiceChips}>{choices.map(([choice, title]) => <Pressable key={choice} onPress={() => onSelect(choice)} style={[styles.choiceChip, value === choice && styles.choiceChipActive]}><Text style={[styles.choiceChipText, value === choice && styles.choiceChipTextActive]}>{title}</Text></Pressable>)}</View></View>;
}

function JourneyDeckMapTile({ uri, left, top, width, height }: { uri: string; left: number; top: number; width: number; height: number }) {
  const image = useImage(uri);
  const [size, setSize] = useState({ width: 0, height: 0 });
  return <View
    pointerEvents="none"
    onLayout={event => {
      const { width, height } = event.nativeEvent.layout;
      setSize(current => current.width === width && current.height === height ? current : { width, height });
    }}
    style={[styles.shareRouteTile, { left: `${left}%`, top: `${top}%`, width: `${width}%`, height: `${height}%` }]}
  >
    {image && size.width > 0 && size.height > 0 && <Canvas style={StyleSheet.absoluteFill}>
      <SkiaImage image={image} x={0} y={0} width={size.width} height={size.height} fit="fill">
        <ColorMatrix matrix={shareMapColorMatrix} />
      </SkiaImage>
    </Canvas>}
  </View>;
}

function ShareRouteSnapshot({ route, songPoints, mapStyle, trimmedStart, trimmedEnd }: { route: [number, number][]; songPoints: { index: number; coordinate: [number, number] }[]; mapStyle: JourneyShareMapStyle; trimmedStart: boolean; trimmedEnd: boolean }) {
  const valid = route.filter(([longitude, latitude]) => Number.isFinite(longitude) && Number.isFinite(latitude));
  if (valid.length < 2) return <View style={[styles.shareRouteSnapshot, styles.shareRouteFallback]}><Text style={styles.shareRouteFallbackText}>{trimmedStart || trimmedEnd ? 'PRIVATE HOME OR WORK ROUTE HIDDEN' : 'ROUTE PREVIEW UNAVAILABLE'}</Text></View>;
  const tileSize = 256, snapshotWidth = tileSize * 7, snapshotHeight = tileSize * 3;
  const SHARE_ROUTE_WIDTH_FILL = 0.84, SHARE_ROUTE_HEIGHT_FILL = 0.76;
  const mercatorPoint = ([longitude, latitude]: [number, number], zoom: number) => {
    const scale = tileSize * (2 ** zoom), clippedLatitude = Math.max(-85.05112878, Math.min(85.05112878, latitude));
    return { x: ((longitude + 180) / 360) * scale, y: (1 - Math.asinh(Math.tan(clippedLatitude * Math.PI / 180)) / Math.PI) * scale / 2 };
  };
  const basePoints = valid.map(point => mercatorPoint(point, 0));
  const baseWidth = Math.max(1e-9, Math.max(...basePoints.map(point => point.x)) - Math.min(...basePoints.map(point => point.x)));
  const baseHeight = Math.max(1e-9, Math.max(...basePoints.map(point => point.y)) - Math.min(...basePoints.map(point => point.y)));
  const fractionalZoom = Math.max(3, Math.min(18, Math.log2(Math.min(
    snapshotWidth * SHARE_ROUTE_WIDTH_FILL / baseWidth,
    snapshotHeight * SHARE_ROUTE_HEIGHT_FILL / baseHeight,
  ))));
  const tileZoom = Math.floor(fractionalZoom), tileRenderScale = 2 ** (fractionalZoom - tileZoom), tileCount = 2 ** tileZoom;
  const points = valid.map(point => mercatorPoint(point, tileZoom));
  const centerX = (Math.min(...points.map(point => point.x)) + Math.max(...points.map(point => point.x))) / 2;
  const centerY = (Math.min(...points.map(point => point.y)) + Math.max(...points.map(point => point.y))) / 2;
  const viewWidth = snapshotWidth / tileRenderScale, viewHeight = snapshotHeight / tileRenderScale;
  const viewLeft = centerX - viewWidth / 2, viewTop = centerY - viewHeight / 2;
  const firstTileX = Math.floor(viewLeft / tileSize), lastTileX = Math.floor((viewLeft + viewWidth) / tileSize);
  const firstTileY = Math.floor(viewTop / tileSize), lastTileY = Math.floor((viewTop + viewHeight) / tileSize);
  const tiles = [] as { key: string; uri: string; left: number; top: number; width: number; height: number }[];
  for (let sourceY = firstTileY; sourceY <= lastTileY; sourceY += 1) {
    if (sourceY < 0 || sourceY >= tileCount) continue;
    for (let sourceX = firstTileX; sourceX <= lastTileX; sourceX += 1) {
      const wrappedX = ((sourceX % tileCount) + tileCount) % tileCount;
      tiles.push({
        key: `${tileZoom}-${sourceX}-${sourceY}`,
        uri: `https://tile.openstreetmap.org/${tileZoom}/${wrappedX}/${sourceY}.png`,
        left: ((sourceX * tileSize - viewLeft) * tileRenderScale / snapshotWidth) * 100,
        top: ((sourceY * tileSize - viewTop) * tileRenderScale / snapshotHeight) * 100,
        width: (tileSize * tileRenderScale / snapshotWidth) * 100,
        height: (tileSize * tileRenderScale / snapshotHeight) * 100,
      });
    }
  }
  const screenPoints = points.map(point => ({ x: (point.x - viewLeft) * tileRenderScale, y: (point.y - viewTop) * tileRenderScale }));
  const first = screenPoints[0]!, last = screenPoints.at(-1)!;
  const fadePointCount = Math.min(Math.max(2, Math.ceil(screenPoints.length * 0.12)), Math.max(2, Math.floor(screenPoints.length / 3)));
  const coreStart = trimmedStart ? Math.min(screenPoints.length - 1, fadePointCount - 1) : 0;
  const coreEnd = trimmedEnd ? Math.max(0, screenPoints.length - fadePointCount) : screenPoints.length - 1;
  const asPolyline = (values: { x: number; y: number }[]) => values.map(point => `${point.x},${point.y}`).join(' ');
  const corePolyline = asPolyline(screenPoints.slice(coreStart, coreEnd + 1));
  const startFadePoints = trimmedStart ? screenPoints.slice(0, coreStart + 1) : [];
  const endFadePoints = trimmedEnd ? screenPoints.slice(coreEnd) : [];
  const startFadePolyline = asPolyline(startFadePoints), endFadePolyline = asPolyline(endFadePoints);
  const markers = songPoints
    .filter(point => Number.isFinite(point.coordinate[0]) && Number.isFinite(point.coordinate[1]))
    .map(point => ({ ...point, projected: mercatorPoint(point.coordinate, tileZoom) }));
  return <View style={styles.shareRouteSnapshot}>
    {mapStyle !== 'route' && tiles.map(tile => <JourneyDeckMapTile key={tile.key} uri={tile.uri} left={tile.left} top={tile.top} width={tile.width} height={tile.height} />)}
    <View style={[styles.shareRouteTint, { backgroundColor: mapStyle === 'dim' ? 'rgba(5,2,10,0.32)' : mapStyle === 'route' ? shareMapPalette.background : 'rgba(5,2,10,0.02)' }]} />
    <Svg width="100%" height="100%" viewBox={`0 0 ${snapshotWidth} ${snapshotHeight}`}>
      <Defs><SvgLinearGradient id="shareRouteGradient" x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor={shareMapPalette.routeWarm} /><Stop offset="0.55" stopColor={shareMapPalette.route} /><Stop offset="1" stopColor="#ff4f38" /></SvgLinearGradient>{trimmedStart && <SvgLinearGradient id="shareStartPrivacyFade" gradientUnits="userSpaceOnUse" x1={first.x} y1={first.y} x2={startFadePoints.at(-1)!.x} y2={startFadePoints.at(-1)!.y}><Stop offset="0" stopColor={shareMapPalette.routeWarm} stopOpacity="0" /><Stop offset="1" stopColor={shareMapPalette.routeWarm} stopOpacity="1" /></SvgLinearGradient>}{trimmedEnd && <SvgLinearGradient id="shareEndPrivacyFade" gradientUnits="userSpaceOnUse" x1={endFadePoints[0]!.x} y1={endFadePoints[0]!.y} x2={last.x} y2={last.y}><Stop offset="0" stopColor={shareMapPalette.route} stopOpacity="1" /><Stop offset="1" stopColor={shareMapPalette.route} stopOpacity="0" /></SvgLinearGradient>}</Defs>
      {corePolyline && <><Polyline points={corePolyline} fill="none" stroke={shareMapPalette.route} strokeWidth="22" strokeLinecap="round" strokeLinejoin="round" opacity="0.22" /><Polyline points={corePolyline} fill="none" stroke="#09020a" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round" opacity="0.92" /><Polyline points={corePolyline} fill="none" stroke="url(#shareRouteGradient)" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" /></>}
      {trimmedStart && <><Polyline points={startFadePolyline} fill="none" stroke="url(#shareStartPrivacyFade)" strokeWidth="20" strokeLinecap="round" strokeLinejoin="round" opacity="0.2" /><Polyline points={startFadePolyline} fill="none" stroke="url(#shareStartPrivacyFade)" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" /></>}
      {trimmedEnd && <><Polyline points={endFadePolyline} fill="none" stroke="url(#shareEndPrivacyFade)" strokeWidth="20" strokeLinecap="round" strokeLinejoin="round" opacity="0.2" /><Polyline points={endFadePolyline} fill="none" stroke="url(#shareEndPrivacyFade)" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" /></>}
      {!trimmedStart && <Circle cx={first.x} cy={first.y} r="9" fill={shareMapPalette.routeWarm} stroke="#fff3eb" strokeWidth="2" />}
      {!trimmedEnd && <Circle cx={last.x} cy={last.y} r="9" fill={shareMapPalette.route} stroke="#fff3eb" strokeWidth="2" />}
      {trimmedStart && <PrivateRouteCutMarker point={first} neighbor={screenPoints[1]!} />}
      {trimmedEnd && <PrivateRouteCutMarker point={last} neighbor={screenPoints.at(-2)!} />}
      {markers.map(marker => { const cx = (marker.projected.x - viewLeft) * tileRenderScale, cy = (marker.projected.y - viewTop) * tileRenderScale; return <G key={`share-song-${marker.index}`}><Circle cx={cx} cy={cy} r="18" fill="#8f45e8" stroke="#f5eaff" strokeWidth="3" /><SvgText x={cx} y={cy + 6} fill="#ffffff" fontSize="17" fontWeight="900" textAnchor="middle">{marker.index}</SvgText></G>; })}
    </Svg>
  </View>;
}

function PrivateRouteCutMarker({ point, neighbor }: { point: { x: number; y: number }; neighbor: { x: number; y: number } }) {
  const dx = point.x - neighbor.x, dy = point.y - neighbor.y, length = Math.max(1, Math.hypot(dx, dy));
  const marker = { x: point.x + dx / length * 38, y: point.y + dy / length * 38 };
  return <G><Circle cx={marker.x} cy={marker.y + 1} r="28" fill="#36defa" opacity="0.2" /><Path d={`M ${marker.x} ${marker.y - 19} L ${marker.x + 16} ${marker.y - 12} L ${marker.x + 14} ${marker.y + 9} Q ${marker.x} ${marker.y + 25} ${marker.x - 14} ${marker.y + 9} L ${marker.x - 16} ${marker.y - 12} Z`} fill="#07303a" stroke="#36defa" strokeWidth="4" /><Circle cx={marker.x} cy={marker.y - 3} r="4.5" fill="none" stroke="#d9fbff" strokeWidth="2.5" /><Path d={`M ${marker.x} ${marker.y + 1.5} L ${marker.x} ${marker.y + 9}`} stroke="#d9fbff" strokeWidth="2.5" strokeLinecap="round" /></G>;
}

function privacySafeJourneyRoute(journey: NonNullable<ShareCardPayload['journey']>) {
  const safeLabel = (value: string | null) => {
    const parts = (value ?? '').split(',').map(part => part.trim()).filter(Boolean);
    if (parts.length >= 3) return `${parts[1]}, ${stateAbbreviation(parts[2])}`;
    if (parts.length === 2) return `${parts[0]}, ${stateAbbreviation(parts[1])}`;
    return 'Drive location';
  };
  const valid = journey.routeCoordinates.filter(([longitude, latitude]) => Number.isFinite(longitude) && Number.isFinite(latitude));
  return { points: sampleRoute(valid, 96), startLabel: journey.routeTrimmedStart ? '' : safeLabel(journey.startLocation), endLabel: journey.routeTrimmedEnd ? '' : safeLabel(journey.endLocation), protected: journey.routeProtected, privacySummary: journey.routePrivacySummary, trimmedStart: journey.routeTrimmedStart, trimmedEnd: journey.routeTrimmedEnd };
}

function sampleRoute(points: [number, number][], limit: number): [number, number][] {
  if (points.length <= limit) return points;
  const step = Math.ceil(points.length / limit), sampled = points.filter((_, index) => index % step === 0);
  if (sampled.at(-1) !== points.at(-1)) sampled.push(points.at(-1)!);
  return sampled;
}

function stateAbbreviation(value: string) { const normalized = value.replace(/\d/g, '').trim(); return normalized.toLowerCase() === 'texas' ? 'TX' : normalized.length > 2 ? normalized.slice(0, 2).toUpperCase() : normalized.toUpperCase(); }
function formatJourneyShareDate(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? 'A JOURNEY REMEMBERED' : date.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' }); }
function journeyShareTitle(value: string) { const date = new Date(value), hour = date.getHours(), moment = hour < 5 ? 'Late Night' : hour < 12 ? 'Morning' : hour < 17 ? 'Afternoon' : hour < 21 ? 'Evening' : 'Night'; return `${Number.isNaN(date.getTime()) ? 'Open Road' : date.toLocaleDateString(undefined, { weekday: 'long' })} ${moment} Drive`; }
function selectedJourneyStats(journey: NonNullable<ShareCardPayload['journey']>, selected: JourneyShareStat[]) {
  const values: Record<JourneyShareStat, { label: string; value: string }> = { distance: { label: 'DISTANCE', value: `${journey.miles < 10 ? journey.miles.toFixed(1) : Math.round(journey.miles)} mi` }, duration: { label: 'DURATION', value: `${Math.max(0, Math.round(journey.durationMinutes))} min` }, songs: { label: 'SOUNDTRACK', value: `${journey.songCount} songs` }, artist: { label: 'TOP ARTIST', value: journey.topArtist || '—' } };
  return selected.map(item => values[item]).slice(0, 5);
}

const styles = StyleSheet.create({
  modalRoot: { flex: 1, justifyContent: 'flex-end', backgroundColor: '#030106cc' },
  sheet: { maxHeight: '94%', margin: 8, overflow: 'hidden', borderRadius: 28, borderWidth: 1, borderColor: '#704d8b', backgroundColor: '#0a0710', shadowColor: '#000', shadowOpacity: 0.8, shadowRadius: 28, shadowOffset: { width: 0, height: -8 } },
  sheetHeader: { minHeight: 72, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#3b2946' },
  sheetKicker: { color: '#ff795b', fontSize: 9, fontWeight: '900', letterSpacing: 1.5 }, sheetTitle: { color: '#f8f3fa', fontSize: 22, fontWeight: '900', marginTop: 3 },
  closeButton: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#4e3a5b', backgroundColor: '#17101f' }, closeText: { color: '#d6c7df', fontSize: 27, lineHeight: 29 },
  previewWrap: { alignItems: 'center', padding: 18, gap: 14 },
  journeyShareMusicCopy: { flex: 1, minWidth: 0 },
  card: { width: 324, height: 405, overflow: 'hidden', borderRadius: 24, backgroundColor: '#120b21', borderWidth: 1, borderColor: '#ffffff22' },
  orb: { position: 'absolute', width: 280, height: 280, borderRadius: 140, opacity: 0.2, right: -90, top: -55 },
  route: { position: 'absolute', width: 410, height: 5, borderRadius: 3, left: -70, top: 170, opacity: 0.75, transform: [{ rotate: '-20deg' }] }, routeTwo: { top: 225, left: 65, opacity: 0.32, transform: [{ rotate: '25deg' }] },
  shade: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: '#08040aa8' },
  cardTop: { position: 'absolute', left: 23, right: 23, top: 23, flexDirection: 'row', alignItems: 'center' }, shareBrand: { flexDirection: 'row', alignItems: 'center', gap: 9 }, shareBrandLogo: { width: 34, height: 34, borderRadius: 11 }, shareBrandCopy: { justifyContent: 'center', gap: 2 }, shareBrandName: { color: '#f8f4fa', fontSize: 10, fontWeight: '900', letterSpacing: 2.1 }, shareBrandContext: { color: '#ff896d', fontSize: 6.2, fontWeight: '900', letterSpacing: 1.35 },
  cardCopy: { position: 'absolute', left: 23, right: 23, bottom: 22 }, cardEyebrow: { fontSize: 9, fontWeight: '900', letterSpacing: 1.6 }, cardTitle: { color: '#fff', fontSize: 33, lineHeight: 35, fontWeight: '900', letterSpacing: -1, marginTop: 8 }, cardSubtitle: { color: '#d2c8d8', fontSize: 13, lineHeight: 19, marginTop: 9 },
  metrics: { flexDirection: 'row', marginTop: 18, overflow: 'hidden', borderRadius: 15, borderWidth: 1, borderColor: '#ffffff1f', backgroundColor: '#08050bcc' }, metric: { flex: 1, minHeight: 64, alignItems: 'center', justifyContent: 'center', borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: '#ffffff20' }, metricValue: { color: '#fff', fontSize: 17, fontWeight: '900' }, metricLabel: { color: '#9e91a7', fontSize: 7, fontWeight: '900', letterSpacing: 1.1, marginTop: 5 },
  privacyLine: { marginTop: 13 }, privacyText: { color: '#958a9e', fontSize: 6.5, fontWeight: '800', letterSpacing: 0.7 },
  privacyNote: { width: '100%', padding: 14, borderRadius: 16, borderWidth: 1, borderColor: '#285b4e', backgroundColor: '#0c201b' }, privacyNoteTitle: { color: '#5ce0b6', fontSize: 12, fontWeight: '900' }, privacyNoteText: { color: '#9db6ad', fontSize: 10, lineHeight: 15, marginTop: 4 },
  shareButton: { minHeight: 56, margin: 14, marginTop: 0, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: '#ff795b' }, shareText: { color: '#1a0907', fontSize: 15, fontWeight: '900' }, disabled: { opacity: 0.55 },
  journeyShareCard: { height: 465, paddingHorizontal: 17, paddingTop: 15, borderColor: '#ffffff2a' }, journeyShareBackdrop: { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, opacity: 0.35, transform: [{ scale: 1.14 }] }, journeyShareTop: { flexDirection: 'row', alignItems: 'center' }, journeyShareEyebrow: { fontSize: 8, fontWeight: '900', letterSpacing: 1.1, marginTop: 13 }, journeyShareTitle: { fontSize: 24, lineHeight: 25, fontWeight: '900', letterSpacing: -0.8, marginTop: 4 }, journeyShareStats: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 11 }, journeyShareStat: { minWidth: '30%', flexGrow: 1, minHeight: 42, borderWidth: 1, borderRadius: 9, paddingHorizontal: 7, paddingVertical: 6, justifyContent: 'center' }, journeyShareStatLabel: { fontSize: 6.5, fontWeight: '900', letterSpacing: 0.7 }, journeyShareStatValue: { fontSize: 11, fontWeight: '900', marginTop: 3 }, shareRouteSnapshot: { height: 126, overflow: 'hidden', borderRadius: 15, marginTop: 10, backgroundColor: '#05020a', borderWidth: StyleSheet.hairlineWidth, borderColor: '#673675' }, shareRouteFallback: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#765389' }, shareRouteFallbackText: { color: '#c4a8dc', fontSize: 8, fontWeight: '900', letterSpacing: 1 }, shareRouteTile: { position: 'absolute', overflow: 'hidden', backgroundColor: '#05020a' }, shareRouteTint: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }, journeyShareRouteLabels: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 7, marginTop: 7 }, journeyShareRouteLabel: { flex: 1, color: '#d8cadf', fontSize: 8, fontWeight: '800', textAlign: 'center' }, journeyShareRouteArrow: { fontSize: 14, fontWeight: '900' }, journeyShareMusic: { minHeight: 59, flexDirection: 'row', alignItems: 'center', gap: 9, borderRadius: 14, borderWidth: 1, padding: 8, marginTop: 9 }, journeyShareAlbum: { width: 42, height: 42, borderRadius: 9 }, journeyShareAlbumFallback: { width: 42, height: 42, borderRadius: 9, alignItems: 'center', justifyContent: 'center' }, journeyShareAlbumNote: { fontSize: 19, fontWeight: '900' }, journeyShareMusicLabel: { fontSize: 6.5, fontWeight: '900', letterSpacing: 1 }, journeyShareTrack: { fontSize: 11, fontWeight: '900', marginTop: 3 }, journeyShareArtist: { fontSize: 8.5, fontWeight: '800', marginTop: 2 }, journeySharePrivacy: { color: '#a294aa', fontSize: 6.3, fontWeight: '900', letterSpacing: 0.5, textAlign: 'center', marginTop: 8 }, journeyShareControls: { width: '100%', gap: 11, padding: 14, borderRadius: 18, borderWidth: 1, borderColor: '#49345d', backgroundColor: '#120d1a' }, controlsKicker: { color: '#ff886a', fontSize: 9, fontWeight: '900', letterSpacing: 1.2 }, controlsStatsKicker: { marginTop: 2 }, choiceRow: { gap: 6 }, choiceLabel: { color: '#a99baa', fontSize: 8, fontWeight: '900', letterSpacing: 0.9 }, choiceChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 }, choiceChip: { minHeight: 29, borderRadius: 9, borderWidth: 1, borderColor: '#42304f', backgroundColor: '#191020', justifyContent: 'center', paddingHorizontal: 9 }, choiceChipActive: { borderColor: '#ff8566', backgroundColor: '#3a1923' }, choiceChipText: { color: '#b0a2b6', fontSize: 9, fontWeight: '800' }, choiceChipTextActive: { color: '#ffe0d4' }, statToggleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 }, statToggle: { width: '48.8%', minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: 10, borderWidth: 1, borderColor: '#3d3048', backgroundColor: '#17111e', paddingHorizontal: 8 }, statToggleOn: { borderColor: '#9d6dff', backgroundColor: '#25163a' }, statToggleMark: { width: 16, color: '#c8adff', fontSize: 13, fontWeight: '900', textAlign: 'center' }, statToggleText: { color: '#ded3e5', fontSize: 9, fontWeight: '800' },
});
