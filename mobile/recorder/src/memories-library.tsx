import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import type { JourneyDetail, JourneyMemory, JourneySummary } from './app-data';
import { CardDetailLink } from './card-detail-link';
import { haptics } from './haptics';
import { JourneyImage } from './journey-image';
import {
  driveTitle, formatMilesShort, formatMinutesShort, memoryYearGroups, routeLabel, smartCollections, type SmartCollection,
} from './redesign-model';
import {
  CircleButton, Kicker, LargeTitle, MemoryCoverImage, PhotoScrim, RedesignPage, RouteSketch, SectionHeader, Segmented,
  Surface, redesignStyles, SERIF, useDriveArtwork, useRedesignColors,
} from './redesign-ui';
import { TouchPressable } from './touch-feedback';

type View3 = 'memories' | 'drives' | 'map';
type DriveFilter = 'all' | 'music' | 'long';
const VIEWS: { id: View3; label: string }[] = [{ id: 'memories', label: 'Memories' }, { id: 'drives', label: 'Drives' }, { id: 'map', label: 'Map' }];
const FILTERS: { id: DriveFilter; label: string }[] = [{ id: 'all', label: 'All' }, { id: 'music', label: 'With music' }, { id: 'long', label: '10+ mi' }];
const COLLECTION_SYMBOL: Record<SmartCollection['id'], SFSymbol> = { favorites: 'point.bottomleft.forward.to.point.topright.scurvepath', night: 'moon.stars', longest: 'road.lanes' };

export function MemoriesLibraryScreen({
  memories, journeys, details, loading, error, historyLimited, onUpgrade, onCreate, onMemory, onJourney, onEdit, onShare,
  onAddToMemory, onFiftyStates, onRefresh,
}: {
  memories: JourneyMemory[]; journeys: JourneySummary[]; details: JourneyDetail[];
  loading: boolean; error?: string; historyLimited: boolean; onUpgrade: () => void;
  onCreate: () => void; onMemory: (id: string) => void; onJourney: (id: string) => void;
  onEdit: (memory: JourneyMemory) => void; onShare: (memory: JourneyMemory) => void;
  onAddToMemory: (journeyId: string) => void; onFiftyStates?: () => void; onRefresh: () => void;
}) {
  const colors = useRedesignColors();
  const [view, setView] = useState<View3>('memories');
  const [filter, setFilter] = useState<DriveFilter>('all');
  const [collection, setCollection] = useState<SmartCollection | null>(null);
  const groups = useMemo(() => memoryYearGroups(memories, journeys), [memories, journeys]);
  const collections = useMemo(() => smartCollections(journeys), [journeys]);
  const openCollection = (item: SmartCollection) => { setCollection(item); setFilter('all'); setView('drives'); };

  return <RedesignPage testID="memories-library" refreshControl={<RefreshControl refreshing={false} onRefresh={onRefresh} tintColor={colors.accent} />}>
    <LargeTitle title="Memories" trailing={<CircleButton label="New memory" symbol="plus" onPress={onCreate} />} />
    <Segmented label="Library view" options={VIEWS} value={view} onChange={setView} />
    {historyLimited ? <TouchPressable accessibilityRole="button" accessibilityLabel="Unlock every Journey and Memory" onPress={onUpgrade} style={({ pressed }) => pressed && redesignStyles.pressed}>
      <Surface style={styles.gate}>
        <View style={redesignStyles.flex}><Kicker color={colors.highlight}>Latest 45 days</Kicker><Text style={[styles.gateText, { color: colors.text }]}>Unlock every Journey and Memory</Text></View>
        <SymbolView name="chevron.right" tintColor={colors.textSecondary} size={15} weight="semibold" />
      </Surface>
    </TouchPressable> : null}
    {error ? <Surface style={styles.notice}><Text style={[redesignStyles.caption, { color: colors.textSecondary }]}>{error}</Text></Surface> : null}
    {loading && !memories.length && !journeys.length ? <Surface style={styles.notice}><ActivityIndicator color={colors.accent} /></Surface> : null}

    {view === 'memories' ? <>
      {collections.length || onFiftyStates ? <View style={styles.section}>
        <Kicker>Made for you</Kicker>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.railBleed} contentContainerStyle={styles.rail}>
          {collections.map((item, index) => <TouchPressable key={item.id} accessibilityRole="button" accessibilityLabel={`${item.title}, ${item.detail}`} onPress={() => { void haptics.selection(); openCollection(item); }} style={({ pressed }) => pressed && redesignStyles.pressed}>
            <Surface radius={20} style={styles.collection}>
              <SymbolView name={COLLECTION_SYMBOL[item.id]} tintColor={[colors.accent, colors.highlight, colors.routes[2]][index % 3]} size={22} weight="semibold" />
              <View><Text numberOfLines={1} style={[styles.collectionTitle, { color: colors.text }]}>{item.title}</Text><Text numberOfLines={1} style={[redesignStyles.caption, { color: colors.textSecondary }]}>{item.detail}</Text></View>
            </Surface>
          </TouchPressable>)}
          {onFiftyStates ? <TouchPressable accessibilityRole="button" accessibilityLabel="50 States" onPress={onFiftyStates} style={({ pressed }) => pressed && redesignStyles.pressed}>
            <Surface radius={20} style={styles.collection}>
              <SymbolView name="map" tintColor={colors.accent} size={22} weight="semibold" />
              <View><Text style={[styles.collectionTitle, { color: colors.text }]}>50 States</Text><Text style={[redesignStyles.caption, { color: colors.textSecondary }]}>Your map of the U.S.</Text></View>
            </Surface>
          </TouchPressable> : null}
        </ScrollView>
      </View> : null}
      {groups.length ? groups.map((group, groupIndex) => <View key={group.year} style={styles.section}>
        <SectionHeader title={String(group.year)} detail={`${group.items.length} ${group.items.length === 1 ? 'memory' : 'memories'} · ${formatMilesShort(group.miles)}`} />
        {group.items.map((item, index) => index === 0 ? <MemoryCard key={item.memory.id} item={item} large onMemory={onMemory} onEdit={onEdit} onShare={onShare} /> : null)}
        {group.items.length > 1 || groupIndex === 0 ? <View style={styles.grid}>
          {group.items.slice(1).map(item => <View key={item.memory.id} style={styles.gridCell}><MemoryCard item={item} onMemory={onMemory} onEdit={onEdit} onShare={onShare} /></View>)}
          {groupIndex === 0 ? <View style={styles.gridCell}><NewMemoryTile onPress={onCreate} /></View> : null}
        </View> : null}
      </View>) : !loading ? <TouchPressable accessibilityRole="button" onPress={onCreate} style={({ pressed }) => pressed && redesignStyles.pressed}>
        <Surface style={styles.empty}>
          <SymbolView name="rectangle.stack.badge.plus" tintColor={colors.accent} size={30} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>Keep drives together</Text>
          <Text style={[redesignStyles.caption, styles.center, { color: colors.textSecondary }]}>A Memory groups the drives of a trip, a season or a favorite road. Tap to create your first one.</Text>
        </Surface>
      </TouchPressable> : null}
    </> : view === 'drives' ? <DrivesView journeys={journeys} details={details} filter={filter} onFilter={setFilter}
      collection={collection} onClearCollection={() => setCollection(null)} onJourney={onJourney} onAddToMemory={onAddToMemory} />
      : <MapView journeys={journeys} details={details} />}
  </RedesignPage>;
}

type MemoryItem = ReturnType<typeof memoryYearGroups>[number]['items'][number];

function MemoryCard({ item, large = false, onMemory, onEdit, onShare }: { item: MemoryItem; large?: boolean; onMemory: (id: string) => void; onEdit: (memory: JourneyMemory) => void; onShare: (memory: JourneyMemory) => void }) {
  const colors = useRedesignColors();
  const when = new Date(item.startedAt).toLocaleDateString(undefined, large ? { month: 'short', day: 'numeric' } : { month: 'short' });
  const detail = `${when} · ${item.drives} ${item.drives === 1 ? 'drive' : 'drives'}${large ? ` · ${formatMilesShort(item.miles)}` : ''}`;
  return <CardDetailLink kind="memory" id={item.memory.id} actions={[
    { id: 'edit', title: 'Edit Memory', icon: 'pencil', onPress: () => onEdit(item.memory) },
    { id: 'share', title: 'Create share card', icon: 'square.and.arrow.up', onPress: () => onShare(item.memory) },
  ]}>
    <Pressable accessibilityRole="button" accessibilityLabel={`Open ${item.memory.name}, ${detail}`} onPress={() => onMemory(item.memory.id)}
      style={({ pressed }) => [large ? styles.largeCard : styles.card, { borderColor: colors.border, backgroundColor: colors.surfaceStrong }, pressed && redesignStyles.pressed]}>
      <MemoryCoverImage memory={item.memory} />
      <PhotoScrim />
      <View style={styles.cardCopy}>
        <Kicker color={colors.textSecondary}>{detail}</Kicker>
        <Text numberOfLines={2} style={[large ? styles.largeTitle : styles.cardTitle, { color: colors.text }]}>{item.memory.name}</Text>
      </View>
    </Pressable>
  </CardDetailLink>;
}

function NewMemoryTile({ onPress }: { onPress: () => void }) {
  const colors = useRedesignColors();
  return <TouchPressable accessibilityRole="button" accessibilityLabel="New memory" onPress={onPress}
    style={({ pressed }) => [styles.card, styles.newTile, { borderColor: colors.border }, pressed && redesignStyles.pressed]}>
    <SymbolView name="plus" tintColor={colors.accent} size={24} weight="semibold" />
    <Text style={[styles.collectionTitle, { color: colors.text }]}>New memory</Text>
    <Text style={[redesignStyles.caption, styles.center, { color: colors.textSecondary }]}>Group drives you want to keep together</Text>
  </TouchPressable>;
}

function DrivesView({ journeys, details, filter, onFilter, collection, onClearCollection, onJourney, onAddToMemory }: {
  journeys: JourneySummary[]; details: JourneyDetail[]; filter: DriveFilter; onFilter: (filter: DriveFilter) => void;
  collection: SmartCollection | null; onClearCollection: () => void; onJourney: (id: string) => void; onAddToMemory: (id: string) => void;
}) {
  const colors = useRedesignColors();
  const routes = useMemo(() => new Map(details.map(detail => [detail.id, detail.route?.coordinates ?? []])), [details]);
  const visible = useMemo(() => {
    const allowed = collection ? new Set(collection.journeyIds) : null;
    return [...journeys]
      .filter(journey => (!allowed || allowed.has(journey.id)) && (filter !== 'music' || journey.songCount > 0) && (filter !== 'long' || journey.miles >= 10))
      .sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt));
  }, [journeys, collection, filter]);
  const months = useMemo(() => {
    const groups: { key: string; label: string; items: JourneySummary[] }[] = [];
    for (const journey of visible) {
      const date = new Date(journey.startedAt);
      const key = `${date.getFullYear()}-${date.getMonth()}`;
      const group = groups.at(-1)?.key === key ? groups.at(-1)! : (groups.push({ key, label: date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }), items: [] }), groups.at(-1)!);
      group.items.push(journey);
    }
    return groups;
  }, [visible]);
  return <>
    <View style={styles.chips}>
      {collection ? <TouchPressable accessibilityRole="button" accessibilityLabel={`Remove filter ${collection.title}`} onPress={onClearCollection}
        style={[styles.chip, { backgroundColor: colors.accent, borderColor: colors.accent }]}>
        <Text style={[styles.chipText, { color: colors.onAccent }]}>{collection.title}</Text><SymbolView name="xmark" tintColor={colors.onAccent} size={10} weight="bold" />
      </TouchPressable> : null}
      {FILTERS.map(item => {
        const selected = item.id === filter;
        return <TouchPressable key={item.id} accessibilityRole="button" accessibilityState={{ selected }} onPress={() => onFilter(item.id)}
          style={[styles.chip, { backgroundColor: selected ? colors.accentSoft : colors.surface, borderColor: selected ? colors.accent : colors.border }]}>
          <Text style={[styles.chipText, { color: selected ? colors.accent : colors.textSecondary }]}>{item.label}</Text>
        </TouchPressable>;
      })}
    </View>
    {months.length ? months.map(month => <View key={month.key} style={styles.section}>
      <SectionHeader title={month.label} detail={`${month.items.length} ${month.items.length === 1 ? 'drive' : 'drives'} · ${formatMilesShort(month.items.reduce((sum, item) => sum + item.miles, 0))}`} />
      <Surface style={styles.driveList}>
        {month.items.map((journey, index) => <DriveRow key={journey.id} journey={journey} route={routes.get(journey.id) ?? []} divider={index > 0} onJourney={onJourney} onAddToMemory={onAddToMemory} />)}
      </Surface>
    </View>) : <Surface style={styles.empty}>
      <Text style={[styles.emptyTitle, { color: colors.text }]}>No drives match</Text>
      <Text style={[redesignStyles.caption, styles.center, { color: colors.textSecondary }]}>Finish a recording and it will appear here, ready to organize.</Text>
    </Surface>}
  </>;
}

function DriveRow({ journey, route, divider, onJourney, onAddToMemory }: { journey: JourneySummary; route: [number, number][]; divider: boolean; onJourney: (id: string) => void; onAddToMemory: (id: string) => void }) {
  const colors = useRedesignColors();
  const artwork = useDriveArtwork(journey.startedAt);
  const title = driveTitle(journey.startedAt);
  const meta = `${formatMilesShort(journey.miles)} · ${formatMinutesShort(journey.durationMinutes)}${journey.songCount ? ` · ${journey.songCount} songs` : ''}`;
  return <View style={[styles.driveRow, divider && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.separator }]}>
    <CardDetailLink kind="journey" id={journey.id}>
      <TouchPressable accessibilityRole="button" accessibilityLabel={`${title}, ${routeLabel(journey)}, ${meta}`} onPress={() => onJourney(journey.id)} style={({ pressed }) => [styles.driveMain, pressed && redesignStyles.pressed]}>
        <View style={[styles.driveThumb, { backgroundColor: colors.surfaceStrong }]}>
          {route.length > 1 ? <RouteSketch routes={[route]} width={56} height={56} inks={colors.routes} strokeWidth={2.4} padding={8} />
            : <JourneyImage imageIdentity={`drive-thumb-${journey.id}`} source={artwork} contentFit="cover" style={StyleSheet.absoluteFill} />}
        </View>
        <View style={[redesignStyles.flex, styles.driveCopy]}>
          <Text numberOfLines={1} style={[styles.driveTitle, { color: colors.text }]}>{routeLabel(journey)}</Text>
          <Text numberOfLines={1} style={[redesignStyles.caption, { color: colors.textSecondary }]}>{title} · {new Date(journey.startedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</Text>
          <Text numberOfLines={1} style={[redesignStyles.caption, { color: colors.textTertiary }]}>{meta}</Text>
        </View>
      </TouchPressable>
    </CardDetailLink>
    <TouchPressable accessibilityRole="button" accessibilityLabel={`Add ${routeLabel(journey)} to a Memory`} hitSlop={6} onPress={() => onAddToMemory(journey.id)}
      style={({ pressed }) => [styles.addButton, { backgroundColor: colors.accentSoft }, pressed && redesignStyles.pressed]}>
      <SymbolView name="plus" tintColor={colors.accent} size={15} weight="bold" />
    </TouchPressable>
  </View>;
}

function MapView({ journeys, details }: { journeys: JourneySummary[]; details: JourneyDetail[] }) {
  const colors = useRedesignColors();
  const { width } = useWindowDimensions();
  const routes = useMemo(() => details.map(detail => detail.route?.coordinates ?? []).filter(route => route.length > 1), [details]);
  const size = Math.max(240, width - 40);
  return <View style={styles.section}>
    <Surface style={{ height: size * 1.15 }}>
      {routes.length ? <RouteSketch routes={routes} width={size} height={size * 1.15} inks={colors.routes} strokeWidth={2.2} padding={22} />
        : <View style={styles.mapEmpty}><SymbolView name="map" tintColor={colors.textSecondary} size={28} /><Text style={[redesignStyles.caption, styles.center, { color: colors.textSecondary }]}>Routes appear here once your drives finish loading.</Text></View>}
    </Surface>
    <Text style={[redesignStyles.caption, styles.center, { color: colors.textSecondary }]}>{routes.length} of {journeys.length} drives drawn from their recorded routes. Atlas has the full interactive map.</Text>
  </View>;
}

const styles = StyleSheet.create({
  section: { gap: 12 },
  center: { textAlign: 'center' },
  gate: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  gateText: { fontSize: 15, fontWeight: '700', marginTop: 2 },
  notice: { padding: 18, alignItems: 'center' },
  railBleed: { marginHorizontal: -20 },
  rail: { gap: 10, paddingHorizontal: 20 },
  collection: { width: 156, height: 100, padding: 12, justifyContent: 'space-between' },
  collectionTitle: { fontSize: 14, lineHeight: 18, fontWeight: '700' },
  largeCard: { height: 300, borderRadius: 28, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth },
  card: { height: 220, borderRadius: 24, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth },
  cardCopy: { position: 'absolute', left: 16, right: 16, bottom: 14, gap: 4 },
  largeTitle: { fontFamily: SERIF, fontSize: 30, lineHeight: 33, fontWeight: '600', letterSpacing: -0.3 },
  cardTitle: { fontFamily: SERIF, fontSize: 20, lineHeight: 23, fontWeight: '600' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  gridCell: { width: '47.8%', flexGrow: 1 },
  newTile: { alignItems: 'center', justifyContent: 'center', gap: 8, padding: 14, borderStyle: 'dashed', borderWidth: 1.5 },
  empty: { padding: 24, alignItems: 'center', gap: 8 },
  emptyTitle: { fontSize: 17, fontWeight: '700' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 34, paddingHorizontal: 14, borderRadius: 17, borderWidth: StyleSheet.hairlineWidth },
  chipText: { fontSize: 14, fontWeight: '600' },
  driveList: { paddingHorizontal: 12 },
  driveRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  driveMain: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 12 },
  driveThumb: { width: 56, height: 56, borderRadius: 14, overflow: 'hidden' },
  driveCopy: { gap: 2 },
  driveTitle: { fontSize: 15, lineHeight: 20, fontWeight: '700' },
  addButton: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  mapEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 24 },
});
