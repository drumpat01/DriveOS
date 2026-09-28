import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { useFocusEffect } from 'expo-router';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { HomeLayoutEditorSheet } from './home-widget-grid';
import { defaultTodayLayout, moveTodayCard, normalizeTodayLayout, toggleTodayCard, TODAY_CARD_LABELS, type TodayCard, type TodayCardId } from './today-layout';
import { Image as ExpoImage } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import type { JourneyMemory } from './app-data';
import { CardDetailLink } from './card-detail-link';
import { haptics } from './haptics';
import { JourneyImage } from './journey-image';
import type { PrimaryDataState } from './primary-sections';
import {
  driveTitle, formatMilesShort, formatMinutesShort, memoryYearGroups, newestJourney, onThisDay, relativeTime,
  routeLabel, weekSummary,
} from './redesign-model';
import {
  Artwork, Kicker, LargeTitle, MemoryCoverImage, PhotoChip, PhotoScrim, RedesignPage, RouteSketch, SectionHeader,
  StatGrid, Surface, redesignStyles, SERIF, useDriveArtwork, useRedesignColors,
} from './redesign-ui';
import { TouchPressable } from './touch-feedback';

const WEEKDAY_FORMAT: Intl.DateTimeFormatOptions = { weekday: 'long', month: 'long', day: 'numeric' };

export type TodayProfile = { initials: string; avatarUri: string | null };

const LAYOUT_KEY = (userId: string) => `journeydeck.today.layout.v1.${userId.replace(/[^A-Za-z0-9._-]/g, '_')}`;

/** Today's card order and visibility, saved per profile on this iPhone. */
function useTodayLayout(userId: string, available: TodayCardId[]) {
  const key = `${userId}|${available.join(',')}`;
  const read = () => {
    try { const raw = SecureStore.getItem(LAYOUT_KEY(userId)); return normalizeTodayLayout(raw ? JSON.parse(raw) : [], available); }
    catch { return defaultTodayLayout(available); }
  };
  const [state, setState] = useState(() => ({ key, layout: read() }));
  const layout = state.key === key ? state.layout : read();
  if (state.key !== key) setState({ key, layout });
  const save = (next: TodayCard[]) => {
    setState({ key, layout: next });
    try { SecureStore.setItem(LAYOUT_KEY(userId), JSON.stringify(next)); } catch { /* keeps working for this session */ }
  };
  return { layout, save, reset: () => save(defaultTodayLayout(available)) };
}

export function TodayScreen({ primary, memories, recorder, loadProfile, onJourney, onMemory, onMemories, onWeek, onProfile, onRefresh, userId = 'default', onAsk, extraCards = {} }: {
  primary: PrimaryDataState;
  userId?: string;
  /** Opens Ask JourneyDeck; omitted when Ask is unavailable. */
  onAsk?: () => void;
  /** Optional cards the user can add from Edit Today. */
  extraCards?: Partial<Record<'fiftyStates' | 'yourCar' | 'journeyInProgress', ReactNode>>;
  memories: JourneyMemory[];
  /** Inline recorder, only when the tab bar accessory is unavailable (before iOS 26). */
  recorder?: ReactNode;
  /** Read on focus, so returning from Settings shows a changed name or photo. */
  loadProfile: () => TodayProfile;
  onJourney: (id: string) => void;
  onMemory: (id: string) => void;
  onMemories: () => void;
  onWeek: () => void;
  onProfile: () => void;
  onRefresh: () => Promise<void>;
}) {
  const colors = useRedesignColors();
  const [now] = useState(Date.now);
  const [refreshing, setRefreshing] = useState(false);
  const [profile, setProfile] = useState(loadProfile);
  useFocusEffect(useCallback(() => { setProfile(loadProfile()); }, [loadProfile]));
  const journeys = primary.data?.journeys ?? [];
  const details = primary.data?.details ?? [];
  const latest = useMemo(() => newestJourney(journeys), [journeys]);
  const latestDetail = latest ? details.find(detail => detail.id === latest.id) ?? null : null;
  const week = useMemo(() => weekSummary(journeys, now), [journeys, now]);
  const resurfaced = useMemo(() => onThisDay(memories, journeys, now), [memories, journeys, now]);
  const recent = useMemo(() => memoryYearGroups(memories, journeys).flatMap(group => group.items).slice(0, 6), [memories, journeys]);
  const available = useMemo(() => (['ask', 'lastDrive', 'week', 'onThisDay', 'memories', 'fiftyStates', 'yourCar', 'journeyInProgress'] as TodayCardId[])
    .filter(id => id === 'ask' ? Boolean(onAsk) : id === 'fiftyStates' || id === 'yourCar' || id === 'journeyInProgress' ? Boolean(extraCards[id]) : true),
  [Boolean(onAsk), Boolean(extraCards.fiftyStates), Boolean(extraCards.yourCar), Boolean(extraCards.journeyInProgress)]);
  const { layout, save, reset } = useTodayLayout(userId, available);
  const [editing, setEditing] = useState(false);
  const refresh = async () => {
    setRefreshing(true);
    try { await onRefresh(); } finally { setRefreshing(false); }
  };

  const renderCard = (id: TodayCardId): ReactNode => {
    switch (id) {
      case 'ask': return onAsk ? <AskBar onPress={onAsk} /> : null;
      case 'lastDrive': return primary.status === 'loading' && !primary.data
        ? <Surface style={styles.loading}><ActivityIndicator color={colors.accent} /><Text style={[redesignStyles.caption, { color: colors.textSecondary }]}>Opening your library…</Text></Surface>
        : latest ? <LastDriveCard journey={latest} detail={latestDetail} now={now} onOpen={() => onJourney(latest.id)} /> : <FirstDriveCard />;
      case 'week': return journeys.length ? <WeekCard week={week} onPress={onWeek} /> : null;
      case 'onThisDay': return resurfaced ? <OnThisDayCard memory={resurfaced.memory} yearsAgo={resurfaced.yearsAgo} journeys={journeys} onPress={() => onMemory(resurfaced.memory.id)} /> : null;
      case 'memories': return recent.length ? <View style={styles.section}>
        <SectionHeader title="Recent memories" actionLabel="See all" onAction={onMemories} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.railBleed} contentContainerStyle={styles.rail}>
          {recent.map(item => <CardDetailLink key={item.memory.id} kind="memory" id={item.memory.id}>
            <Pressable accessibilityRole="button" accessibilityLabel={`Open ${item.memory.name}`} onPress={() => onMemory(item.memory.id)}
              style={({ pressed }) => [styles.memoryCard, { borderColor: colors.border, backgroundColor: colors.surfaceStrong }, pressed && redesignStyles.pressed]}>
              <MemoryCoverImage memory={item.memory} />
              <PhotoScrim />
              <View style={styles.memoryCardCopy}>
                <Text numberOfLines={2} style={[styles.memoryCardTitle, { color: colors.text }]}>{item.memory.name}</Text>
                <Text numberOfLines={1} style={[redesignStyles.caption, { color: colors.textSecondary }]}>{item.drives} {item.drives === 1 ? 'drive' : 'drives'} · {new Date(item.startedAt).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}</Text>
              </View>
            </Pressable>
          </CardDetailLink>)}
        </ScrollView>
      </View> : null;
      default: return extraCards[id] ?? null;
    }
  };

  return <RedesignPage testID="today-screen" refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={colors.accent} />}>
    <LargeTitle kicker={new Date(now).toLocaleDateString(undefined, WEEKDAY_FORMAT)} title="Today"
      trailing={<View style={styles.headerButtons}>
        <TouchPressable accessibilityRole="button" accessibilityLabel="Edit Today" onPress={() => { void haptics.selection(); setEditing(true); }}
          style={({ pressed }) => [styles.avatar, { backgroundColor: colors.surfaceStrong, borderColor: colors.border }, pressed && redesignStyles.pressed]}>
          <SymbolView name="slider.horizontal.3" tintColor={colors.text} size={18} weight="semibold" />
        </TouchPressable>
        <ProfileButton profile={profile} onPress={onProfile} />
      </View>} />
    {recorder ? <View testID="today-inline-recorder">{recorder}</View> : null}
    {primary.status === 'error' && !primary.data ? <Surface style={styles.notice}><Text style={[redesignStyles.caption, { color: colors.textSecondary }]}>{primary.message ?? 'Your library could not load. Pull down to try again.'}</Text></Surface> : null}
    {layout.filter(card => card.visible).map(card => <View key={card.id}>{renderCard(card.id)}</View>)}
    <HomeLayoutEditorSheet visible={editing} onClose={() => setEditing(false)} onReset={reset} noteIcon="slider.horizontal.3" note="Choose what Today shows and in what order. Changes save on this iPhone.">
      <View testID="today-layout-editor" style={styles.editor}>
        {layout.map((card, index) => <View key={card.id} style={[styles.editorRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.editorLabel, { color: colors.text }]}>{TODAY_CARD_LABELS[card.id]}</Text>
          <TouchPressable accessibilityRole="button" accessibilityLabel={`Move ${TODAY_CARD_LABELS[card.id]} up`} disabled={index === 0} hitSlop={6} onPress={() => save(moveTodayCard(layout, card.id, -1))} style={styles.editorArrow}>
            <SymbolView name="chevron.up" tintColor={index === 0 ? colors.textTertiary : colors.accent} size={15} weight="semibold" />
          </TouchPressable>
          <TouchPressable accessibilityRole="button" accessibilityLabel={`Move ${TODAY_CARD_LABELS[card.id]} down`} disabled={index === layout.length - 1} hitSlop={6} onPress={() => save(moveTodayCard(layout, card.id, 1))} style={styles.editorArrow}>
            <SymbolView name="chevron.down" tintColor={index === layout.length - 1 ? colors.textTertiary : colors.accent} size={15} weight="semibold" />
          </TouchPressable>
          <RowToggle label={`Show ${TODAY_CARD_LABELS[card.id]} on Today`} value={card.visible} onChange={() => save(toggleTodayCard(layout, card.id))} />
        </View>)}
      </View>
    </HomeLayoutEditorSheet>
  </RedesignPage>;
}

function AskBar({ onPress }: { onPress: () => void }) {
  const colors = useRedesignColors();
  return <TouchPressable testID="today-ask" accessibilityRole="button" accessibilityLabel="Ask JourneyDeck about your drives" onPress={() => { void haptics.selection(); onPress(); }}
    style={({ pressed }) => pressed && redesignStyles.pressed}>
    <Surface radius={26} style={styles.askBar}>
      <View style={[styles.askIcon, { backgroundColor: colors.accentSoft }]}><SymbolView name="sparkles" tintColor={colors.accent} size={17} /></View>
      <Text numberOfLines={1} style={[styles.askText, { color: colors.textSecondary }]}>Ask about your drives</Text>
      <SymbolView name="arrow.up.circle.fill" tintColor={colors.accent} size={24} />
    </Surface>
  </TouchPressable>;
}

function ProfileButton({ profile, onPress }: { profile: TodayProfile; onPress: () => void }) {
  const colors = useRedesignColors();
  return <TouchPressable accessibilityRole="button" accessibilityLabel="Profile and settings" onPress={() => { void haptics.selection(); onPress(); }}
    style={({ pressed }) => [styles.avatar, { backgroundColor: colors.surfaceStrong, borderColor: colors.border }, pressed && redesignStyles.pressed]}>
    {profile.avatarUri ? <ExpoImage source={profile.avatarUri} contentFit="cover" style={StyleSheet.absoluteFill} /> : <Text style={[styles.avatarText, { color: colors.text }]}>{profile.initials}</Text>}
  </TouchPressable>;
}

function LastDriveCard({ journey, detail, now, onOpen }: {
  journey: PrimaryJourney; detail: PrimaryDetail | null; now: number; onOpen: () => void;
}) {
  const colors = useRedesignColors();
  const artwork = useDriveArtwork(journey.startedAt);
  const tracks = detail?.soundtrack?.length ? detail.soundtrack : journey.soundtrackPreview;
  const route = detail?.route?.coordinates ?? [];
  const title = driveTitle(journey.startedAt);
  return <CardDetailLink kind="journey" id={journey.id}>
    <TouchPressable testID="today-last-drive" accessibilityRole="button" accessibilityLabel={`Open ${title}, ${routeLabel(journey)}`} onPress={onOpen}
      style={({ pressed }) => [styles.hero, { borderColor: colors.border, backgroundColor: colors.surfaceStrong }, pressed && redesignStyles.pressed]}>
      <JourneyImage imageIdentity={`today-drive-${journey.id}`} source={artwork} contentFit="cover" style={StyleSheet.absoluteFill} />
      <PhotoScrim />
      <PhotoChip symbol="clock" text={`Last drive · ${relativeTime(journey.startedAt, now)}`} style={styles.heroChip} />
      {route.length > 1 ? <View style={[styles.heroRoute, { backgroundColor: colors.photoChip, borderColor: colors.photoChipBorder }]}>
        <RouteSketch routes={[route]} width={64} height={64} inks={colors.routes} strokeWidth={2.6} padding={9} />
      </View> : null}
      <View style={styles.heroBody}>
        <View style={styles.heroTitleBlock}>
          <Text numberOfLines={2} style={[styles.heroTitle, { color: colors.text }]}>{title}</Text>
          <Text numberOfLines={1} style={[styles.heroRouteLabel, { color: colors.textSecondary }]}>{routeLabel(journey)}</Text>
        </View>
        <StatGrid items={[
          { value: formatMilesShort(journey.miles), label: 'Distance' },
          { value: formatMinutesShort(journey.durationMinutes), label: 'Time' },
          { value: String(Math.max(journey.songCount, tracks.length)), label: tracks.length === 1 ? 'Song' : 'Songs' },
        ]} />
        {tracks.length ? <View style={[styles.soundStrip, { backgroundColor: colors.photoChip, borderColor: colors.photoChipBorder }]}>
          <View style={styles.stack}>{tracks.slice(0, 3).map((track, index) => <View key={`${track.track}-${index}`} style={[styles.stackItem, index > 0 && styles.stackOverlap, { borderColor: colors.page }]}><Artwork uri={track.artworkUrl} size={34} index={index} /></View>)}</View>
          <View style={redesignStyles.flex}>
            <Text numberOfLines={1} style={[styles.soundTitle, { color: colors.text }]}>{tracks[0].track}{tracks.length > 1 ? ` + ${tracks.length - 1} more` : ''}</Text>
            <Text numberOfLines={1} style={[redesignStyles.caption, { color: colors.textSecondary }]}>The drive's soundtrack</Text>
          </View>
          <View style={[styles.relive, { backgroundColor: colors.accent }]}><SymbolView name="play.fill" tintColor={colors.onAccent} size={12} /><Text style={[styles.reliveText, { color: colors.onAccent }]}>Relive</Text></View>
        </View> : null}
      </View>
    </TouchPressable>
  </CardDetailLink>;
}

type PrimaryJourney = NonNullable<PrimaryDataState['data']>['journeys'][number];
type PrimaryDetail = NonNullable<PrimaryDataState['data']>['details'][number];

function FirstDriveCard() {
  const colors = useRedesignColors();
  const artwork = useDriveArtwork(null);
  return <View testID="today-first-drive" style={[styles.hero, styles.heroEmpty, { borderColor: colors.border, backgroundColor: colors.surfaceStrong }]}>
    <JourneyImage imageIdentity="today-first-drive" source={artwork} contentFit="cover" style={StyleSheet.absoluteFill} />
    <PhotoScrim />
    <View style={styles.heroBody}>
      <Kicker color={colors.accent}>Your first drive</Kicker>
      <Text style={[styles.heroTitle, { color: colors.text }]}>The road remembers</Text>
      <Text style={[redesignStyles.body, { color: colors.textSecondary }]}>Start a journey from the bar below. Your route, time and soundtrack will appear here.</Text>
    </View>
  </View>;
}

function WeekCard({ week, onPress }: { week: ReturnType<typeof weekSummary>; onPress: () => void }) {
  const colors = useRedesignColors();
  const change = week.changePercent === null ? 'Your week on the road'
    : week.changePercent === 0 ? 'Same miles as last week'
    : `${week.changePercent > 0 ? '↑' : '↓'} ${Math.abs(week.changePercent)}% ${week.changePercent > 0 ? 'more' : 'fewer'} miles than last week`;
  return <TouchPressable testID="today-week" accessibilityRole="button" accessibilityLabel={`This week: ${formatMilesShort(week.miles)}, ${week.drives} drives. ${change}. Opens Atlas.`} onPress={onPress}
    style={({ pressed }) => pressed && redesignStyles.pressed}>
    <Surface style={styles.weekCard}>
      <View style={redesignStyles.row}>
        <View style={redesignStyles.flex}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>This week</Text>
          <Text style={[redesignStyles.caption, { color: week.changePercent !== null && week.changePercent > 0 ? colors.accent : colors.textSecondary }]}>{change}</Text>
        </View>
        <SymbolView name="chevron.right" tintColor={colors.textSecondary} size={15} weight="semibold" />
      </View>
      <View style={styles.bars} accessible={false}>
        {week.days.map(day => {
          const height = week.maxMiles > 0 ? Math.max(4, Math.round((day.miles / week.maxMiles) * 48)) : 4;
          const active = day.miles > 0;
          return <View key={day.date} style={styles.barColumn}>
            <View style={[styles.bar, { height, backgroundColor: day.isToday && active ? colors.accent : active ? colors.accentSoft : colors.track }]} />
            <Text style={[styles.barLabel, { color: day.isToday ? colors.text : colors.textTertiary, fontWeight: day.isToday ? '800' : '600' }]}>{day.label}</Text>
          </View>;
        })}
      </View>
      <View style={[styles.weekStats, { borderTopColor: colors.separator }]}>
        <StatGrid compact items={[
          { value: week.miles < 100 ? week.miles.toFixed(1) : Math.round(week.miles).toLocaleString(), label: 'miles' },
          { value: String(week.drives), label: week.drives === 1 ? 'drive' : 'drives' },
          { value: formatMinutesShort(week.minutes), label: 'on the road' },
          { value: String(week.songs), label: week.songs === 1 ? 'song' : 'songs' },
        ]} />
      </View>
    </Surface>
  </TouchPressable>;
}

function OnThisDayCard({ memory, yearsAgo, journeys, onPress }: { memory: JourneyMemory; yearsAgo: number; journeys: PrimaryJourney[]; onPress: () => void }) {
  const colors = useRedesignColors();
  const members = journeys.filter(journey => memory.journeyIds.includes(journey.id));
  const miles = members.reduce((sum, journey) => sum + journey.miles, 0);
  const songs = members.reduce((sum, journey) => sum + journey.songCount, 0);
  const when = yearsAgo === 1 ? '1 year ago' : `${yearsAgo} years ago`;
  return <CardDetailLink kind="memory" id={memory.id}>
    <Pressable testID="today-on-this-day" accessibilityRole="button" accessibilityLabel={`On this day, ${when}: ${memory.name}`} onPress={onPress} style={({ pressed }) => pressed && redesignStyles.pressed}>
      <Surface style={styles.onThisDay}>
        <View style={[styles.onThisDayPhoto, { backgroundColor: colors.surfaceStrong }]}><MemoryCoverImage memory={memory} /></View>
        <View style={[redesignStyles.flex, styles.onThisDayCopy]}>
          <Kicker color={colors.highlight}>{`On this day · ${when}`}</Kicker>
          <Text numberOfLines={1} style={[styles.onThisDayTitle, { color: colors.text }]}>{memory.name}</Text>
          <Text numberOfLines={1} style={[redesignStyles.caption, { color: colors.textSecondary }]}>{members.length} {members.length === 1 ? 'drive' : 'drives'} · {formatMilesShort(miles)}{songs ? ` · ${songs} ${songs === 1 ? 'song' : 'songs'}` : ''}</Text>
        </View>
        <SymbolView name="chevron.right" tintColor={colors.textSecondary} size={15} weight="semibold" />
      </Surface>
    </Pressable>
  </CardDetailLink>;
}

/**
 * A theme-colored on/off toggle with a fixed size. The iOS 26 native switch draws larger than
 * the box React Native reserves for it, which pushed it off-center in these rows.
 */
function RowToggle({ label, value, onChange }: { label: string; value: boolean; onChange: () => void }) {
  const colors = useRedesignColors();
  return <Pressable accessibilityRole="switch" accessibilityLabel={label} accessibilityState={{ checked: value }} hitSlop={8}
    onPress={() => { void haptics.selection(); onChange(); }}
    style={[styles.toggle, { backgroundColor: value ? colors.accent : colors.track, borderColor: value ? colors.accent : colors.border }]}>
    <View style={[styles.toggleKnob, { alignSelf: value ? 'flex-end' : 'flex-start', backgroundColor: value ? colors.onAccent : colors.text }]} />
  </Pressable>;
}

const styles = StyleSheet.create({
  toggle: { width: 50, height: 30, borderRadius: 15, borderWidth: StyleSheet.hairlineWidth, padding: 2, justifyContent: 'center' },
  toggleKnob: { width: 25, height: 25, borderRadius: 12.5 },
  section: { gap: 12 },
  headerButtons: { flexDirection: 'row', gap: 10 },
  askBar: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 54, paddingLeft: 10, paddingRight: 14 },
  askIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  askText: { flex: 1, fontSize: 16 },
  editor: { gap: 8 },
  editorRow: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 54, paddingLeft: 14, paddingRight: 10, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth },
  editorLabel: { flex: 1, fontSize: 15, fontWeight: '600' },
  editorArrow: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  notice: { padding: 16 },
  loading: { padding: 24, alignItems: 'center', gap: 10 },
  avatar: { width: 44, height: 44, borderRadius: 22, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 15, fontWeight: '700' },
  hero: { height: 440, borderRadius: 30, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth },
  heroEmpty: { height: 360 },
  heroChip: { position: 'absolute', top: 16, left: 16 },
  heroRoute: { position: 'absolute', top: 14, right: 14, width: 64, height: 64, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  heroBody: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 18, gap: 14 },
  heroTitleBlock: { gap: 4 },
  heroTitle: { fontFamily: SERIF, fontSize: 32, lineHeight: 36, fontWeight: '600', letterSpacing: -0.4 },
  heroRouteLabel: { fontSize: 15, lineHeight: 20 },
  soundStrip: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingLeft: 12, paddingRight: 10, borderRadius: 20, borderWidth: StyleSheet.hairlineWidth },
  stack: { flexDirection: 'row' },
  stackItem: { borderRadius: 9, borderWidth: 2 },
  stackOverlap: { marginLeft: -14 },
  soundTitle: { fontSize: 14, lineHeight: 18, fontWeight: '600' },
  relive: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 36, paddingHorizontal: 14, borderRadius: 18 },
  reliveText: { fontSize: 14, fontWeight: '700' },
  weekCard: { padding: 18, gap: 16 },
  cardTitle: { fontSize: 17, lineHeight: 22, fontWeight: '700' },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, height: 68 },
  barColumn: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 6 },
  bar: { width: '100%', borderRadius: 6 },
  barLabel: { fontSize: 11 },
  weekStats: { paddingTop: 14, borderTopWidth: StyleSheet.hairlineWidth },
  onThisDay: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 12 },
  onThisDayPhoto: { width: 76, height: 76, borderRadius: 16, overflow: 'hidden' },
  onThisDayCopy: { gap: 3 },
  onThisDayTitle: { fontFamily: SERIF, fontSize: 20, lineHeight: 25, fontWeight: '600' },
  railBleed: { marginHorizontal: -20 },
  rail: { gap: 12, paddingHorizontal: 20 },
  memoryCard: { width: 190, height: 238, borderRadius: 22, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth },
  memoryCardCopy: { position: 'absolute', left: 14, right: 14, bottom: 14, gap: 2 },
  memoryCardTitle: { fontFamily: SERIF, fontSize: 20, lineHeight: 23, fontWeight: '600' },
});
