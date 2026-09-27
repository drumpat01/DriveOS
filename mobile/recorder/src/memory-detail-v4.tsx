import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { router } from 'expo-router';
import { Image as ExpoImage } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { appDataClient, type JourneyDetail, type JourneyMemory, type JourneyPhoto, type JourneySummary } from './app-data';
import { compactArtistCredit } from './artist-credit';
import { useDetailViewportInsets } from './detail-screen-frame';
import { haptics } from './haptics';
import { MemoryRouteMap } from './memory-route-map';
import { useMotionPreferences } from './motion';
import { NativeActionMenu } from './native-action-menu';
import { driveTitle, formatMilesShort, formatMinutesShort, memoryStats, routeLabel } from './redesign-model';
import {
  Artwork, Kicker, MemoryCoverImage, StatGrid, Surface, redesignStyles, SERIF, useRedesignColors,
} from './redesign-ui';
import { TouchPressable } from './touch-feedback';

const HERO_HEIGHT = 392;

export function MemoryDetailV4({ memory, journeys, details, onClose, onOpenJourney, onShare, onEdit, onReady }: {
  memory: JourneyMemory; journeys: JourneySummary[]; details: JourneyDetail[];
  onClose: () => void; onOpenJourney: (id: string) => void; onShare: () => void; onEdit: () => void; onReady?: () => void;
}) {
  const colors = useRedesignColors();
  const insets = useDetailViewportInsets();
  const { width } = useWindowDimensions();
  const { reduceMotion } = useMotionPreferences();
  const scrollY = useRef(new Animated.Value(0)).current;
  const scroller = useRef<any>(null);
  const [soundtrackY, setSoundtrackY] = useState(0);
  const stats = useMemo(() => memoryStats(memory, journeys, details), [memory, journeys, details]);
  const routes = useMemo(() => {
    const byId = new Map(details.map(detail => [detail.id, detail.route?.coordinates ?? []]));
    return stats.journeys.map((journey, index) => ({ journey, coordinates: byId.get(journey.id) ?? [], color: colors.routes[index % colors.routes.length] }))
      .filter(route => route.coordinates.length > 1);
  }, [stats.journeys, details, colors.routes]);
  const otherPhotos = memory.photos.filter(photo => photo.id !== (memory.coverPhotoId ?? memory.photos[0]?.id));
  const findPhotos = () => router.push({ pathname: '/memory-photos/[id]', params: { id: memory.id } });
  const heroScale = reduceMotion ? undefined : { transform: [{ scale: scrollY.interpolate({ inputRange: [-200, 0], outputRange: [1.4, 1], extrapolate: 'clamp' }) }, { translateY: scrollY.interpolate({ inputRange: [-200, 0, 200], outputRange: [-100, 0, 40], extrapolate: 'clamp' }) }] };
  const mapWidth = width - 40;
  const tileWidth = Math.floor(width / 3);

  return <View testID="memory-detail-v4" style={[styles.screen, { backgroundColor: colors.page }]}>
    <Animated.ScrollView ref={scroller} showsVerticalScrollIndicator={false} scrollEventThrottle={16}
      contentInsetAdjustmentBehavior="never" automaticallyAdjustContentInsets={false}
      onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
      contentContainerStyle={{ paddingBottom: insets.bottom + 48 }}>
      <Animated.View style={[styles.hero, heroScale]}>
        <View style={[styles.heroMain, { backgroundColor: colors.surfaceStrong }]}><MemoryCoverImage memory={memory} onReady={onReady} /></View>
        <View style={[styles.heroSide, { width: tileWidth }]}>
          <TouchPressable accessibilityRole="button" accessibilityLabel={otherPhotos.length ? `${memory.photos.length} photos` : 'Find photos from these drives'} onPress={otherPhotos.length ? onEdit : findPhotos}
            style={[styles.heroTile, { backgroundColor: colors.surfaceStrong }]}>
            {otherPhotos[0] ? <PhotoTile photo={otherPhotos[0]} /> : <SymbolView name="photo.badge.magnifyingglass" tintColor={colors.accent} size={26} style={styles.centerIcon} />}
            {otherPhotos.length > 1 ? <View style={[StyleSheet.absoluteFill, styles.moreShade, { backgroundColor: colors.photoChip }]}><Text style={[styles.moreText, { color: colors.text }]}>+{otherPhotos.length - 1}</Text></View> : null}
          </TouchPressable>
        </View>
        <LinearGradient pointerEvents="none" colors={[colors.photoScrim[0], colors.page]} style={styles.heroFade} />
      </Animated.View>

      <View style={styles.body}>
        <View style={styles.titleBlock}>
          <Kicker color={colors.accent}>{stats.dateLabel ? `Memory · ${stats.dateLabel}` : 'Memory'}</Kicker>
          <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>{memory.name}</Text>
          {stats.places.length ? <Text numberOfLines={2} style={[styles.places, { color: colors.textSecondary }]}>{stats.places.slice(0, 4).join(' · ')}</Text> : null}
        </View>
        <StatGrid items={[
          { value: String(stats.drives), label: stats.drives === 1 ? 'drive' : 'drives' },
          { value: stats.miles < 1000 ? String(Math.round(stats.miles)) : Math.round(stats.miles).toLocaleString(), label: 'miles' },
          { value: formatMinutesShort(stats.minutes), label: 'on the road' },
          { value: String(stats.songs), label: stats.songs === 1 ? 'song' : 'songs' },
        ]} />
        <View style={styles.actions}>
          <TouchPressable accessibilityRole="button" accessibilityLabel="Relive the first drive" disabled={!stats.journeys.length}
            onPress={() => { void haptics.primaryAction(); if (stats.journeys[0]) onOpenJourney(stats.journeys[0].id); }}
            style={({ pressed }) => [styles.action, { backgroundColor: colors.accent }, !stats.journeys.length && styles.disabled, pressed && redesignStyles.pressed]}>
            <SymbolView name="play.fill" tintColor={colors.onAccent} size={14} /><Text style={[styles.actionText, { color: colors.onAccent }]}>Relive</Text>
          </TouchPressable>
          <TouchPressable accessibilityRole="button" accessibilityLabel="Jump to the soundtrack" disabled={!stats.topTracks.length}
            onPress={() => scroller.current?.scrollTo({ y: soundtrackY - 16, animated: !reduceMotion })}
            style={({ pressed }) => [styles.action, { backgroundColor: colors.surfaceStrong, borderColor: colors.border, borderWidth: StyleSheet.hairlineWidth }, !stats.topTracks.length && styles.disabled, pressed && redesignStyles.pressed]}>
            <SymbolView name="music.note" tintColor={colors.text} size={16} /><Text style={[styles.actionText, { color: colors.text }]}>Soundtrack</Text>
          </TouchPressable>
        </View>
        {memory.notes ? <Text style={[redesignStyles.body, { color: colors.text }]}>{memory.notes}</Text> : null}

        {routes.length ? <Surface style={styles.mapCard}>
          <MemoryRouteMap routes={routes.map(route => ({ id: route.journey.id, coordinates: route.coordinates, color: route.color }))} width={mapWidth} />
          <View style={[styles.legend, { borderTopColor: colors.separator }]}>
            {routes.map(route => <View key={route.journey.id} style={styles.legendItem}>
              <View style={[styles.legendInk, { backgroundColor: route.color }]} />
              <Text style={[redesignStyles.caption, { color: colors.textSecondary }]}>{new Date(route.journey.startedAt).toLocaleDateString(undefined, { weekday: 'short' })}</Text>
            </View>)}
          </View>
        </Surface> : null}

        {stats.journeys.length ? <View style={styles.section}>
          <Text accessibilityRole="header" style={[styles.sectionTitle, { color: colors.text }]}>The drives</Text>
          {stats.journeys.map((journey, index) => {
            const top = stats.topTrackByJourney[journey.id];
            const last = index === stats.journeys.length - 1;
            return <TouchPressable key={journey.id} accessibilityRole="button" accessibilityLabel={`${routeLabel(journey)}, ${driveTitle(journey.startedAt)}`} onPress={() => onOpenJourney(journey.id)}
              style={({ pressed }) => [styles.timelineRow, pressed && redesignStyles.pressed]}>
              <View style={styles.timelineRail}>
                <View style={[styles.timelineDot, { backgroundColor: colors.routes[index % 4] }]} />
                {!last ? <View style={[styles.timelineLine, { backgroundColor: colors.separator }]} /> : null}
              </View>
              <View style={[redesignStyles.flex, styles.timelineCopy, !last && styles.timelineGap]}>
                <Text style={[redesignStyles.caption, { color: colors.textSecondary }]}>{new Date(journey.startedAt).toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' })}</Text>
                <Text numberOfLines={1} style={[styles.driveTitle, { color: colors.text }]}>{routeLabel(journey)}</Text>
                <Text style={[redesignStyles.caption, { color: colors.textSecondary }]}>{formatMilesShort(journey.miles)} · {formatMinutesShort(journey.durationMinutes)}{journey.songCount ? ` · ${journey.songCount} songs` : ''}</Text>
                {top ? <View style={[styles.songChip, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <Artwork uri={top.artworkUrl} size={22} index={index} />
                  <Text numberOfLines={1} style={[styles.songChipText, { color: colors.text }]}>{top.track}{top.plays > 1 ? ` · ${top.plays} plays` : ''}</Text>
                </View> : null}
              </View>
            </TouchPressable>;
          })}
        </View> : <Surface style={styles.empty}><Text style={[redesignStyles.caption, { color: colors.textSecondary }]}>This Memory is waiting for a drive. Edit it to add one.</Text></Surface>}

        {stats.topTracks.length ? <View onLayout={event => setSoundtrackY(event.nativeEvent.layout.y + HERO_HEIGHT - 40)}>
          <Surface style={styles.soundtrack}>
            <View>
              <Text style={[styles.cardTitle, { color: colors.text }]}>Soundtrack</Text>
              <Text style={[redesignStyles.caption, { color: colors.textSecondary }]}>{stats.songs} songs across {stats.drives} {stats.drives === 1 ? 'drive' : 'drives'}</Text>
            </View>
            {stats.topTracks.slice(0, 5).map((track, index) => <View key={`${track.track}-${track.artist}`} accessible accessibilityLabel={`${track.track} by ${track.artist}, ${track.plays} plays`} style={styles.trackRow}>
              <Text style={[styles.rank, { color: colors.textTertiary }]}>{index + 1}</Text>
              <Artwork uri={track.artworkUrl} size={44} index={index} />
              <View style={redesignStyles.flex}>
                <Text numberOfLines={1} style={[styles.trackTitle, { color: colors.text }]}>{track.track}</Text>
                <Text numberOfLines={1} style={[redesignStyles.caption, { color: colors.textSecondary }]}>{compactArtistCredit(track.artist)}</Text>
              </View>
              <Text style={[redesignStyles.caption, { color: colors.textSecondary }]}>{track.plays} {track.plays === 1 ? 'play' : 'plays'}</Text>
            </View>)}
          </Surface>
        </View> : null}

        <View style={styles.section}>
          <View style={redesignStyles.row}>
            <Text accessibilityRole="header" style={[redesignStyles.flex, styles.sectionTitle, { color: colors.text }]}>Photos</Text>
            <TouchPressable accessibilityRole="button" hitSlop={8} onPress={onEdit}><Text style={[styles.link, { color: colors.accent }]}>{memory.photos.length ? 'Manage' : 'Add photos'}</Text></TouchPressable>
          </View>
          <View style={styles.photoGrid}>
            {memory.photos.slice(0, 8).map(photo => <View key={photo.id} style={[styles.photoCell, { width: (width - 48) / 3, backgroundColor: colors.surfaceStrong }]}><PhotoTile photo={photo} /></View>)}
            <TouchPressable accessibilityRole="button" accessibilityLabel="Find photos from these drives" onPress={findPhotos}
              style={({ pressed }) => [styles.photoCell, styles.findPhotos, { width: (width - 48) / 3, backgroundColor: colors.accentSoft }, pressed && redesignStyles.pressed]}>
              <SymbolView name="photo.badge.magnifyingglass" tintColor={colors.accent} size={22} />
              <Text style={[styles.findText, { color: colors.accent }]}>Find photos from these drives</Text>
            </TouchPressable>
          </View>
        </View>
      </View>
    </Animated.ScrollView>

    <View style={[styles.toolbar, { top: insets.top + 6 }]} pointerEvents="box-none">
      <TouchPressable accessibilityRole="button" accessibilityLabel="Back" onPress={onClose}
        style={({ pressed }) => [styles.toolButton, { backgroundColor: colors.photoChip, borderColor: colors.photoChipBorder }, pressed && redesignStyles.pressed]}>
        <SymbolView name="chevron.left" tintColor={colors.text} size={18} weight="semibold" />
      </TouchPressable>
      <View style={[styles.toolGroup, { backgroundColor: colors.photoChip, borderColor: colors.photoChipBorder }]}>
        <TouchPressable accessibilityRole="button" accessibilityLabel="Share memory" onPress={onShare} style={styles.toolInner}>
          <SymbolView name="square.and.arrow.up" tintColor={colors.text} size={18} weight="semibold" />
        </TouchPressable>
        <NativeActionMenu compact label="Memory actions" actions={[
          { id: 'edit', title: 'Edit Memory', image: 'pencil', onSelect: onEdit },
          { id: 'match', title: 'Find matching photos', image: 'photo.badge.magnifyingglass', onSelect: findPhotos },
          { id: 'share', title: 'Create share card', image: 'square.and.arrow.up', onSelect: onShare },
        ]} />
      </View>
    </View>
  </View>;
}

function PhotoTile({ photo }: { photo: JourneyPhoto }) {
  const [uri, setUri] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    void appDataClient.photoDataUrl(photo).then(value => { if (active) setUri(value || null); }).catch(() => undefined);
    return () => { active = false; };
  }, [photo.id]);
  return uri ? <ExpoImage source={{ uri }} contentFit="cover" cachePolicy="memory" style={StyleSheet.absoluteFill} /> : null;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  hero: { height: HERO_HEIGHT, flexDirection: 'row', gap: 3 },
  heroMain: { flex: 1, overflow: 'hidden' },
  heroSide: { gap: 3 },
  heroTile: { flex: 1, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  centerIcon: { width: 28, height: 28 },
  moreShade: { alignItems: 'center', justifyContent: 'center' },
  moreText: { fontSize: 20, fontWeight: '700' },
  heroFade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 110 },
  body: { paddingHorizontal: 20, paddingTop: 22, gap: 22 },
  titleBlock: { gap: 6 },
  title: { fontFamily: SERIF, fontSize: 38, lineHeight: 41, fontWeight: '600', letterSpacing: -0.5 },
  places: { fontSize: 15, lineHeight: 20 },
  actions: { flexDirection: 'row', gap: 10 },
  action: { flex: 1, minHeight: 50, borderRadius: 25, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  actionText: { fontSize: 16, fontWeight: '700' },
  disabled: { opacity: 0.45 },
  mapCard: { overflow: 'hidden' },
  legend: { flexDirection: 'row', gap: 16, paddingHorizontal: 14, paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendInk: { width: 12, height: 4, borderRadius: 2 },
  section: { gap: 12 },
  sectionTitle: { fontSize: 22, lineHeight: 27, fontWeight: '800', letterSpacing: -0.3 },
  timelineRow: { flexDirection: 'row', gap: 14 },
  timelineRail: { width: 14, alignItems: 'center', paddingTop: 4 },
  timelineDot: { width: 12, height: 12, borderRadius: 6 },
  timelineLine: { width: 2, flex: 1, marginTop: 4 },
  timelineCopy: { gap: 4 },
  timelineGap: { paddingBottom: 20 },
  driveTitle: { fontSize: 17, lineHeight: 22, fontWeight: '700' },
  songChip: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 5, paddingLeft: 5, paddingRight: 11, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth, maxWidth: '100%' },
  songChipText: { fontSize: 12, fontWeight: '600', flexShrink: 1 },
  empty: { padding: 18 },
  soundtrack: { padding: 16, gap: 12 },
  cardTitle: { fontSize: 17, lineHeight: 22, fontWeight: '700' },
  trackRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rank: { width: 16, fontSize: 13, fontWeight: '700', textAlign: 'center' },
  trackTitle: { fontSize: 15, fontWeight: '600' },
  link: { fontSize: 15, fontWeight: '600' },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, borderRadius: 18, overflow: 'hidden' },
  photoCell: { height: 112, overflow: 'hidden' },
  findPhotos: { alignItems: 'center', justifyContent: 'center', gap: 6, padding: 8 },
  findText: { fontSize: 12, fontWeight: '700', textAlign: 'center' },
  toolbar: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', justifyContent: 'space-between' },
  toolButton: { width: 44, height: 44, borderRadius: 22, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
  toolGroup: { flexDirection: 'row', alignItems: 'center', height: 44, borderRadius: 22, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 2 },
  toolInner: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});
