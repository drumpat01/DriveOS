import { useMemo, useRef, type ReactNode } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { readingColumnStyle } from './device-layout';
import { SymbolView } from 'expo-symbols';
import type { JourneyDetail, JourneyMemory } from './app-data';
import { compactArtistCredit } from './artist-credit';
import { useDetailViewportInsets } from './detail-screen-frame';
import { JourneyMarkerRoute } from './journey-markers';
import type { ReplayPhoto } from './journey-replay-model';
import { NativeActionMenu } from './native-action-menu';
import { driveSongs, formatMilesShort, formatMinutesShort, routeLabel } from './redesign-model';
import { Artwork, Kicker, SectionHeader, StatGrid, Surface, redesignStyles, SERIF, useRedesignColors } from './redesign-ui';
import type { SongRouteMoment } from './route-moments';
import { TouchPressable } from './touch-feedback';

const WHEN: Intl.DateTimeFormatOptions = { weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' };

/** V4 iPhone journey detail: the map is the hero, then the story of the drive. */
export function JourneyDetailV4({
  journey, title, songMoments, replayPhotos, selectedSongIndex, onSelectSong, showAllTracks, onToggleTracks,
  memories, onMemory, onAddToMemory, onBack, onShare, onEditLocations, onTrim, fallback,
}: {
  journey: JourneyDetail; title: string; songMoments: SongRouteMoment[]; replayPhotos: ReplayPhoto[];
  selectedSongIndex: number | null; onSelectSong: (index: number | null) => void;
  showAllTracks: boolean; onToggleTracks: () => void;
  memories: JourneyMemory[]; onMemory: (id: string) => void; onAddToMemory: () => void;
  onBack: () => void; onShare: () => void; onEditLocations: () => void; onTrim: () => void; fallback: ReactNode;
}) {
  const colors = useRedesignColors();
  const insets = useDetailViewportInsets();
  const scroller = useRef<ScrollView>(null);
  const miles = useMemo(() => {
    const byPlay = new Map(driveSongs(journey, journey).map(song => [`${song.playedAt}|${song.track}`, song.mile]));
    return journey.soundtrack.map(track => byPlay.get(`${track.playedAt}|${track.track}`) ?? null);
  }, [journey]);
  const inMemories = memories.filter(memory => memory.journeyIds.includes(journey.id));
  const songCount = Math.max(journey.songCount, journey.soundtrack.length);
  const visible = showAllTracks ? journey.soundtrack : journey.soundtrack.slice(0, 5);
  const showSong = (index: number) => { onSelectSong(index); scroller.current?.scrollTo({ y: 0, animated: true }); };

  const header = <View style={styles.header}>
    <View style={styles.titleBlock}>
      <Kicker color={colors.accent}>{new Date(journey.startedAt).toLocaleString(undefined, WHEN)}</Kicker>
      <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>{title}</Text>
      <Text numberOfLines={2} style={[styles.route, { color: colors.textSecondary }]}>{routeLabel(journey)}</Text>
    </View>
    <StatGrid items={[
      { value: journey.miles < 100 ? journey.miles.toFixed(1) : Math.round(journey.miles).toLocaleString(), label: 'miles' },
      { value: formatMinutesShort(journey.durationMinutes), label: 'drive time' },
      { value: journey.averageSpeedMph == null ? '—' : String(Math.round(journey.averageSpeedMph)), label: 'mph avg' },
      { value: String(songCount), label: songCount === 1 ? 'song' : 'songs' },
    ]} />
  </View>;

  const middle = <>
    <View testID="journey-memories-row" style={styles.memoryRow}>
      {inMemories.length ? <Text style={[redesignStyles.caption, { color: colors.textSecondary }]}>In</Text> : null}
      {inMemories.map(memory => <TouchPressable key={memory.id} accessibilityRole="button" accessibilityLabel={`Open Memory ${memory.name}`} onPress={() => onMemory(memory.id)}
        style={({ pressed }) => [styles.chip, { backgroundColor: colors.accentSoft }, pressed && redesignStyles.pressed]}>
        <SymbolView name="photo.stack" tintColor={colors.accent} size={13} />
        <Text numberOfLines={1} style={[styles.chipText, { color: colors.accent }]}>{memory.name}</Text>
      </TouchPressable>)}
      <TouchPressable accessibilityRole="button" accessibilityLabel="Add this drive to a Memory" onPress={onAddToMemory}
        style={({ pressed }) => [styles.chip, { backgroundColor: colors.surfaceStrong }, pressed && redesignStyles.pressed]}>
        <SymbolView name="plus" tintColor={colors.text} size={12} weight="bold" />
        <Text style={[styles.chipText, { color: colors.text }]}>{inMemories.length ? 'Add to another' : 'Add to Memory'}</Text>
      </TouchPressable>
    </View>
    <View style={styles.section}>
      <SectionHeader title="Soundtrack" detail={journey.soundtrack.length ? 'Tap a song to see where it played' : undefined}
        actionLabel={journey.soundtrack.length > 5 ? showAllTracks ? 'Show less' : `View all ${journey.soundtrack.length}` : undefined} onAction={onToggleTracks} />
      {visible.length ? <Surface style={styles.list}>
        {visible.map((track, index) => {
          const number = index + 1, selected = selectedSongIndex === number, mile = miles[index];
          const when = track.playedAt ? new Date(track.playedAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : null;
          return <TouchPressable key={`${track.source}-${track.playedAt ?? track.track}-${index}`} accessibilityRole="button" accessibilityState={{ selected }}
            accessibilityLabel={`Song ${number}, ${track.track} by ${track.artist}. Show on the map`} onPress={() => showSong(number)}
            style={({ pressed }) => [styles.trackRow, index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.separator }, selected && { backgroundColor: colors.accentSoft }, pressed && redesignStyles.pressed]}>
            <Text style={[styles.rank, { color: selected ? colors.accent : colors.textTertiary }]}>{number}</Text>
            <Artwork uri={track.artworkUrl} size={44} index={index} />
            <View style={redesignStyles.flex}>
              <Text numberOfLines={1} style={[styles.trackTitle, { color: colors.text, fontWeight: selected ? '700' : '600' }]}>{track.track}</Text>
              <Text numberOfLines={1} style={[redesignStyles.caption, { color: colors.textSecondary }]}>{compactArtistCredit(track.artist)}{mile !== null ? ` · mile ${mile}` : when ? ` · ${when}` : ''}</Text>
            </View>
            <SymbolView name={selected ? 'mappin.circle.fill' : 'mappin.circle'} tintColor={selected ? colors.accent : colors.textTertiary} size={20} />
          </TouchPressable>;
        })}
      </Surface> : <Surface style={styles.emptySongs}>
        <SymbolView name="music.note" tintColor={colors.accent} size={20} />
        <View style={redesignStyles.flex}>
          <Text style={[styles.trackTitle, { color: colors.text }]}>No songs on this drive</Text>
          <Text style={[redesignStyles.caption, { color: colors.textSecondary }]}>Songs matched to the drive, or identified while recording, appear here.</Text>
        </View>
      </Surface>}
    </View>
  </>;

  const vehicle = journey.vehicleName || journey.startingBatteryPercent != null || journey.energyUsedKwh != null;
  return <View testID="journey-detail-v4" style={[styles.screen, { backgroundColor: colors.page }]}>
    <ScrollView ref={scroller} showsVerticalScrollIndicator={false} contentInsetAdjustmentBehavior="never" automaticallyAdjustContentInsets={false}
      keyboardShouldPersistTaps="handled" contentContainerStyle={[readingColumnStyle, { paddingBottom: insets.bottom + 40, paddingLeft: insets.left, paddingRight: insets.right }]}>
      <JourneyMarkerRoute key={journey.id} journeyId={journey.id} layout="v4" v4TopInset={insets.top + 64} v4Header={header} v4Middle={middle}
        coordinates={journey.route?.coordinates ?? []} routeSamples={journey.route?.points} photos={replayPhotos} songMoments={songMoments}
        totalSongCount={songCount} startedAt={journey.startedAt} endedAt={journey.endedAt}
        startingBatteryPercent={journey.startingBatteryPercent} endingBatteryPercent={journey.endingBatteryPercent}
        startLabel={journey.startingLocation} endLabel={journey.endingLocation}
        selectedSongIndex={selectedSongIndex} onSelectSong={onSelectSong} fallback={<View style={[styles.fallback, { paddingTop: insets.top + 64 }]}>{fallback}</View>} />
      {vehicle ? <View style={[styles.padded, styles.section]}>
        <SectionHeader title="Vehicle" />
        <Surface style={styles.infoList}>
          <InfoRow label="Car" value={journey.vehicleName ?? 'Connected vehicle'} first />
          {journey.startingBatteryPercent != null ? <InfoRow label="Battery" value={`${journey.startingBatteryPercent}% → ${journey.endingBatteryPercent ?? '—'}%`} /> : null}
          {journey.energyUsedKwh != null ? <InfoRow label="Energy used" value={`${journey.energyUsedKwh.toFixed(1)} kWh`} /> : null}
        </Surface>
      </View> : null}
      <Text style={[styles.attribution, { color: colors.textTertiary }]}>MapLibre · OpenFreeMap · © OpenStreetMap</Text>
    </ScrollView>
    <JourneyToolbar onBack={onBack} onShare={onShare} onEditLocations={onEditLocations} onTrim={onTrim} />
  </View>;
}

function InfoRow({ label, value, first = false }: { label: string; value: string; first?: boolean }) {
  const colors = useRedesignColors();
  return <View style={[styles.infoRow, !first && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.separator }]}>
    <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>{label}</Text>
    <Text numberOfLines={1} style={[styles.infoValue, { color: colors.text }]}>{value}</Text>
  </View>;
}

export function JourneyToolbar({ onBack, onShare, onEditLocations, onTrim }: { onBack: () => void; onShare?: () => void; onEditLocations?: () => void; onTrim?: () => void }) {
  const colors = useRedesignColors();
  const insets = useDetailViewportInsets();
  return <View pointerEvents="box-none" style={[styles.toolbar, { top: insets.top + 6, left: 16 + insets.left, right: 16 + insets.right }]}>
    <TouchPressable accessibilityRole="button" accessibilityLabel="Back" onPress={onBack}
      style={({ pressed }) => [styles.toolButton, { backgroundColor: colors.photoChip, borderColor: colors.photoChipBorder }, pressed && redesignStyles.pressed]}>
      <SymbolView name="chevron.left" tintColor={colors.text} size={18} weight="semibold" />
    </TouchPressable>
    {onShare && onEditLocations && onTrim ? <View style={[styles.toolGroup, { backgroundColor: colors.photoChip, borderColor: colors.photoChipBorder }]}>
      <TouchPressable accessibilityRole="button" accessibilityLabel="Create share card" onPress={onShare} style={styles.toolInner}>
        <SymbolView name="square.and.arrow.up" tintColor={colors.text} size={18} weight="semibold" />
      </TouchPressable>
      <NativeActionMenu compact label="Journey actions" actions={[
        { id: 'share', title: 'Create share card', image: 'square.and.arrow.up', onSelect: onShare },
        { id: 'locations', title: 'Edit locations', image: 'mappin.and.ellipse', onSelect: onEditLocations },
        { id: 'trim', title: 'Trim & split', image: 'scissors', onSelect: onTrim },
      ]} />
    </View> : null}
  </View>;
}

/** Loading and error states keep the same floating back button. */
export function JourneyDetailV4Placeholder({ loading, message, onBack, onRetry }: { loading: boolean; message?: string; onBack: () => void; onRetry: () => void }) {
  const colors = useRedesignColors();
  const insets = useDetailViewportInsets();
  return <View style={[styles.screen, styles.placeholder, { backgroundColor: colors.page, paddingTop: insets.top + 72 }]}>
    {loading ? <ActivityIndicator color={colors.accent} /> : <Surface style={styles.placeholderCard}>
      <Text style={[styles.trackTitle, { color: colors.text }]}>{message ?? 'This journey is unavailable.'}</Text>
      <TouchPressable accessibilityRole="button" onPress={onRetry} style={({ pressed }) => [styles.retry, { backgroundColor: colors.accent }, pressed && redesignStyles.pressed]}>
        <Text style={[styles.chipText, { color: colors.onAccent }]}>Try again</Text>
      </TouchPressable>
    </Surface>}
    <JourneyToolbar onBack={onBack} />
  </View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  padded: { paddingHorizontal: 20, paddingTop: 22 },
  header: { gap: 22, paddingTop: 4 },
  titleBlock: { gap: 6 },
  title: { fontFamily: SERIF, fontSize: 36, lineHeight: 39, fontWeight: '600', letterSpacing: -0.5 },
  route: { fontSize: 15, lineHeight: 20 },
  fallback: { paddingHorizontal: 20, paddingBottom: 22 },
  memoryRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 34, paddingHorizontal: 12, borderRadius: 17, maxWidth: '100%' },
  chipText: { fontSize: 13, fontWeight: '700', flexShrink: 1 },
  section: { gap: 12 },
  list: { paddingHorizontal: 12 },
  trackRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 12, marginHorizontal: -12 },
  rank: { width: 16, fontSize: 13, fontWeight: '800', textAlign: 'center' },
  trackTitle: { fontSize: 15, lineHeight: 20, fontWeight: '600' },
  emptySongs: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 16 },
  infoList: { paddingHorizontal: 16 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 12 },
  infoLabel: { fontSize: 14 },
  infoValue: { fontSize: 14, fontWeight: '600', flexShrink: 1 },
  attribution: { fontSize: 11, textAlign: 'center', paddingTop: 22, paddingHorizontal: 20 },
  toolbar: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', justifyContent: 'space-between' },
  toolButton: { width: 44, height: 44, borderRadius: 22, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
  toolGroup: { flexDirection: 'row', alignItems: 'center', height: 44, borderRadius: 22, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 2 },
  toolInner: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  placeholder: { paddingHorizontal: 20 },
  placeholderCard: { padding: 18, gap: 14, alignItems: 'flex-start' },
  retry: { minHeight: 40, paddingHorizontal: 16, borderRadius: 20, justifyContent: 'center' },
});
