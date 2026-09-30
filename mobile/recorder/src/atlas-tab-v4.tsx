import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import Svg, { Circle, Line } from 'react-native-svg';
import { localAtlasClient, type JourneySummary } from './app-data';
import { buildAtlasInsights, type AtlasInsights } from './atlas-insights';
import { buildAtlasStory, type AtlasStory } from './atlas-story-model';
import { loadFiftyStates } from './fifty-states-store';
import { getCurrentUser } from './auth';
import { CardDetailLink } from './card-detail-link';
import { haptics } from './haptics';
import { buildIpadStatistics, calendarDays, dayKey, localDay, summarize, type StatisticsRange } from './ipad-statistics-model';
import { journeyDisplayTitle } from './journey-title';
import type { PrimaryDataState } from './primary-sections';
import { TESSIE_INTEGRATION_ENABLED } from './release-features';
import { Artwork, Kicker, LargeTitle, RedesignPage, CANVAS_READING_WIDTH, RouteSketch, SERIF, SectionHeader, Surface, redesignStyles, useRedesignColors } from './redesign-ui';
import { withAlpha } from './redesign-palette';
import { tessieDirectStatus } from './tessie-direct';
import type { TessieStatistics } from './tessie-statistics-model';
import { IphoneRequiredCard } from './iphone-required';
import { isIpad } from './device-layout';
import { TouchPressable } from './touch-feedback';

type Section = 'overview' | 'music' | 'places' | 'rhythms' | 'days' | 'tessie';
const SECTION_LABELS: Record<Section, string> = { overview: 'Overview', music: 'Music', places: 'Places', rhythms: 'Rhythms', days: 'Days', tessie: 'Tessie' };
type Model = ReturnType<typeof buildIpadStatistics>;
const RANGES: StatisticsRange[] = [7, 30, 90, 'all'];
const number = (value: number, digits = 0) => value.toLocaleString(undefined, { maximumFractionDigits: digits });
const duration = (value: number) => { const minutes = Math.round(Math.max(0, value)); return `${Math.floor(minutes / 60)}h ${minutes % 60}m`; };
const dateLabel = (date: Date) => date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
const monthLabel = (date: Date) => date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

/** V4's phone Atlas tab. The iPad Statistics canvas remains a separate layout. */
export function AtlasTabV4({ state, historyDays, onRefresh, onJourney, onUpgrade, onAtlas, onYearOnRoad }: {
  state: PrimaryDataState; historyDays: number | null; onRefresh: () => void | Promise<void>;
  onJourney: (id: string) => void; onUpgrade: () => void; onAtlas?: () => void; onYearOnRoad?: () => void;
}) {
  const colors = useRedesignColors();
  const [range, setRange] = useState<StatisticsRange>(30);
  const [section, setSection] = useState<Section>('overview');
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [connection, setConnection] = useState<'checking' | 'connected' | 'disconnected' | 'unavailable'>(TESSIE_INTEGRATION_ENABLED ? 'checking' : 'unavailable');
  const todayKey = dayKey(new Date());
  const effectiveRange = historyDays !== null && (range === 'all' || range > historyDays) ? 30 : range;
  const model = useMemo(() => buildIpadStatistics(state.data?.journeys ?? [], state.data?.details ?? [], effectiveRange, new Date(), historyDays),
    [state.data?.journeys, state.data?.details, effectiveRange, historyDays, todayKey]);
  const focus = selectedDay && model.days.some(day => day.key === selectedDay) ? selectedDay : model.selected[0] ? dayKey(new Date(model.selected[0].startedAt)) : todayKey;
  const monthStart = dayKey(model.start).slice(0, 7);
  const monthEnd = dayKey(model.end).slice(0, 7);
  const month = selectedMonth && selectedMonth >= monthStart && selectedMonth <= monthEnd ? selectedMonth : dayKey(localDay(focus)).slice(0, 7);
  const monthDate = localDay(`${month}-01`);
  const dayJourneys = [...(model.byDay.get(focus) ?? [])].reverse();
  const dayTotals = useMemo(() => summarize(model.byDay.get(focus) ?? [], state.data?.details ?? []), [model, focus, state.data?.details]);
  const sections: Section[] = TESSIE_INTEGRATION_ENABLED ? ['overview', 'music', 'places', 'rhythms', 'days', 'tessie'] : ['overview', 'music', 'places', 'rhythms', 'days'];
  const details = state.data?.details;
  const insights = useMemo(() => buildAtlasInsights(model.selected, details ?? [], 'all'), [model.selected, details]);
  const story = useMemo(() => buildAtlasStory(model.selected, state.data?.journeys ?? [], details ?? []), [model.selected, state.data?.journeys, details]);
  const tessieRange = useMemo(() => ({
    startInclusive: model.start.toISOString(),
    endExclusive: new Date(model.end.getFullYear(), model.end.getMonth(), model.end.getDate() + 1).toISOString(),
  }), [model.start, model.end]);
  const tessie = useMemo(() => TESSIE_INTEGRATION_ENABLED
    ? localAtlasClient.tessieStatistics(getCurrentUser().id, tessieRange)
    : null, [state.data, tessieRange.startInclusive, tessieRange.endExclusive]);

  useEffect(() => {
    if (!TESSIE_INTEGRATION_ENABLED) return;
    let active = true;
    void tessieDirectStatus().then(status => {
      if (active) setConnection(status === 'connected' ? 'connected' : 'disconnected');
    }).catch(() => { if (active) setConnection('unavailable'); });
    return () => { active = false; };
  }, [state.data]);

  const refresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try { await onRefresh(); } finally { setRefreshing(false); }
  };
  const chooseDay = (key: string) => {
    void haptics.selection();
    setSelectedDay(key); setSelectedMonth(key.slice(0, 7)); setSection('days');
  };
  const chooseRange = (value: StatisticsRange) => {
    if (historyDays !== null && (value === 'all' || value > historyDays)) { onUpgrade(); return; }
    if (value === effectiveRange) return;
    void haptics.selection(); setRange(value); setSelectedDay(null); setSelectedMonth(null);
  };

  return <RedesignPage maxWidth={CANVAS_READING_WIDTH} testID="atlas-tab-v4" refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={colors.accent} />}>
    <LargeTitle kicker="Your road story" title="Atlas" />
    <Text style={[styles.intro, { color: colors.textSecondary }]}>Every mile, drive and song in your private history.</Text>
    <View testID="atlas-range-filters" accessibilityRole="tablist" accessibilityLabel="Atlas time range" style={[styles.rangeRow, { backgroundColor: colors.track }]}>
      {RANGES.map(value => {
        const locked = historyDays !== null && (value === 'all' || value > historyDays);
        const active = effectiveRange === value;
        const label = value === 'all' ? 'All' : `${value}D`;
        return <TouchPressable key={value} accessibilityRole="tab" accessibilityLabel={`${label}${locked ? ', JourneyDeck Plus' : ''}`} accessibilityState={{ selected: active }} onPress={() => chooseRange(value)}
          style={({ pressed }) => [styles.rangeButton, { backgroundColor: active ? colors.surfaceStrong : colors.surface, borderColor: active ? colors.accent : colors.border }, pressed && redesignStyles.pressed]}>
          <Text numberOfLines={1} style={[styles.rangeLabel, { color: active ? colors.text : colors.textSecondary }]}>{label}</Text>
          {locked ? <SymbolView name="lock.fill" size={10} tintColor={colors.textTertiary} /> : null}
        </TouchPressable>;
      })}
    </View>
    <View testID="atlas-section-filters" accessibilityRole="tablist" accessibilityLabel="Atlas sections" style={styles.sectionFilters}>
      {sections.map(value => <TouchPressable key={value} accessibilityRole="tab" accessibilityLabel={SECTION_LABELS[value]} accessibilityState={{ selected: section === value }}
        onPress={() => { if (section !== value) { void haptics.selection(); setSection(value); } }}
        style={({ pressed }) => [styles.sectionButton, { backgroundColor: section === value ? colors.accentSoft : colors.surface, borderColor: section === value ? colors.accent : colors.border }, pressed && redesignStyles.pressed]}>
        <Text numberOfLines={1} style={[styles.sectionLabel, { color: section === value ? colors.accent : colors.textSecondary, fontWeight: section === value ? '700' : '600' }]}>{SECTION_LABELS[value]}</Text>
      </TouchPressable>)}
    </View>
    {state.status === 'error' ? <Surface style={styles.notice}><Text accessibilityRole="alert" style={[styles.body, { color: colors.textSecondary }]}>{state.message ?? 'Atlas could not refresh. Saved data remains available.'}</Text></Surface> : null}
    {!state.data ? state.status === 'loading' ? <ActivityIndicator color={colors.accent} accessibilityLabel="Loading Atlas" />
      : <Surface style={styles.notice}><Text style={[styles.body, { color: colors.textSecondary }]}>Atlas is unavailable. Pull down to try again.</Text></Surface>
      : !state.data.journeys.length && isIpad() ? <IphoneRequiredCard subject="Your Atlas, miles and places" />
      : <>
        <Text style={[styles.dateRange, { color: colors.textTertiary }]}>{dateLabel(model.start)} – {dateLabel(model.end)} · By journey start date{historyDays === null ? '' : ` · ${historyDays}-day history`}</Text>
        {section === 'overview' ? <Overview model={model} story={story} insights={insights} onDays={() => setSection('days')} onDay={chooseDay} onJourney={onJourney} onAtlas={onAtlas ?? onUpgrade} atlasLocked={!onAtlas} onYearOnRoad={onYearOnRoad} /> : null}
        {section === 'days' ? <Days model={model} month={monthDate} monthStart={monthStart} monthEnd={monthEnd} focus={focus} totals={dayTotals} journeys={dayJourneys}
          onMonth={setSelectedMonth} onDay={chooseDay} onJourney={onJourney} /> : null}
        {section === 'music' ? <Music story={story} insights={insights} /> : null}
        {section === 'places' ? <Places story={story} insights={insights} /> : null}
        {section === 'rhythms' ? <Insights model={model} insights={insights} /> : null}
        {section === 'tessie' && tessie ? <Tessie data={tessie} connection={connection} onJourney={onJourney} /> : null}
      </>}
  </RedesignPage>;
}

function Overview({ model, story, insights, onDays, onDay, onJourney, onAtlas, atlasLocked, onYearOnRoad }: {
  model: Model; story: AtlasStory; insights: AtlasInsights; onDays: () => void; onDay: (key: string) => void; onJourney: (id: string) => void; onAtlas: () => void; atlasLocked: boolean; onYearOnRoad?: () => void;
}) {
  const colors = useRedesignColors();
  const [recentCount, setRecentCount] = useState(5);
  const comparison = model.previous?.miles;
  const change = comparison == null ? 'Your recorded distance in this period' : comparison === 0 ? 'No miles in the prior period'
    : `${model.totals.miles >= comparison ? '+' : ''}${number((model.totals.miles - comparison) / comparison * 100, 1)}% vs prior period`;
  const recentDays = model.days.slice(-7);
  const peak = Math.max(1, ...recentDays.map(day => day.miles));
  return <>
    <Surface testID="atlas-overview-hero" radius={28} style={styles.hero}>
      <View style={styles.heroTop}><Kicker color={colors.highlight}>PERIOD OVERVIEW</Kicker><SymbolView name="road.lanes" tintColor={colors.accent} size={24} /></View>
      {story.routes.length ? <View style={[styles.heroMap, { backgroundColor: colors.page }]} accessible={false}><RouteSketch routes={story.routes} width={300} height={130} inks={colors.routes} strokeWidth={2.5} /></View> : null}
      <TouchPressable accessibilityRole="button" accessibilityLabel="Show your days" onPress={onDays} style={styles.heroDays}>
        <Text style={[styles.heroCaption, { color: colors.textSecondary }]}>Total distance</Text>
        <Text style={[styles.caption, { color: colors.accent }]}>Your days ›</Text>
      </TouchPressable>
      <Text accessibilityRole="text" accessibilityLabel={`${number(model.totals.miles, 1)} miles`} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.65} style={[styles.heroValue, { color: colors.text }]}>{number(model.totals.miles, 1)} <Text style={styles.heroUnit}>mi</Text></Text>
      <Text style={[styles.comparison, { color: colors.textSecondary }]}>{change}</Text>
      <View style={[styles.divider, { backgroundColor: colors.separator }]} />
      <Kicker>LAST SEVEN DAYS</Kicker>
      <View testID="atlas-recent-chart" style={styles.chart}>
        {recentDays.map((day, index) => <TouchPressable key={day.key} accessibilityRole="button" accessibilityLabel={`${dateLabel(localDay(day.key))}: ${number(day.miles, 1)} miles. Show this day`}
          onPress={() => onDay(day.key)} style={styles.chartColumn}>
          <View style={[styles.chartTrack, { backgroundColor: colors.track }]}><View style={[styles.chartBar, { height: `${Math.max(day.miles ? 8 : 0, day.miles / peak * 100)}%`, backgroundColor: colors.routes[index % colors.routes.length] }]} /></View>
          <Text numberOfLines={1} style={[styles.chartDate, { color: colors.textTertiary }]}>{localDay(day.key).toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' })}</Text>
        </TouchPressable>)}
      </View>
      {!model.selected.length ? <Text style={[styles.body, { color: colors.textSecondary }]}>Your next recorded drive will begin filling this view.</Text> : null}
    </Surface>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
      <StoryCard kicker="STREAK" value={number(story.streak)} detail={story.streak === 1 ? 'day in a row' : 'days in a row'} />
      {story.topArtists[0] ? <StoryCard kicker="TOP ARTIST" value={story.topArtists[0].artist} detail={`${number(story.topArtists[0].plays)} plays`} artwork={story.topArtists[0].artworkUrl} /> : null}
      {story.followedSongs[0] ? <StoryCard kicker="ON REPEAT" value={story.followedSongs[0].track} detail={`On ${story.followedSongs[0].drives} drives`} artwork={story.followedSongs[0].artworkUrl} /> : null}
      {insights.routeDna.ready && insights.routeDna.startLabel ? <StoryCard kicker="YOUR ROUTE" value={`${insights.routeDna.startLabel} → ${insights.routeDna.endLabel}`} detail={`${insights.routeDna.trips} trips`} /> : null}
    </ScrollView>
    {insights.exploration.score !== null ? <ExplorationRing score={insights.exploration.score} areas={insights.exploration.oneJourneyAreas} /> : null}
    <View testID="atlas-metric-grid" style={styles.metricGrid}>
      <MetricTile symbol="car.fill" label="Journeys" value={number(model.totals.journeys)} />
      <MetricTile symbol="clock" label="Driving time" value={duration(model.totals.drivingMinutes)} />
      <MetricTile symbol="music.note" label="Song plays" value={number(model.totals.plays)} />
      <MetricTile symbol="headphones" label="Known listening" value={duration(model.totals.listeningMinutes)} />
      <MetricTile symbol="calendar" label="Active days" value={number(model.totals.activeDays)} wide />
    </View>
    <FeatureLink symbol="map" title="Explore your Atlas map" detail={atlasLocked ? 'JourneyDeck Plus · Routes, places and rhythms' : 'Routes, places and driving rhythms'} onPress={onAtlas} />
    <SectionHeader title="Recent drives" detail={`${model.selected.length} in this period`} />
    <Surface style={styles.listCard}>
      {model.selected.length ? model.selected.slice(0, recentCount).map(journey => <JourneyRow key={journey.id} journey={journey} onJourney={onJourney} />)
        : <Text style={[styles.body, { color: colors.textSecondary }]}>No journeys in this period.</Text>}
      {model.selected.length > recentCount ? <TouchPressable accessibilityRole="button" accessibilityLabel="Show more recent drives" onPress={() => setRecentCount(count => count + 20)} style={styles.moreButton}>
        <Text style={[styles.moreText, { color: colors.accent }]}>Show more drives</Text>
      </TouchPressable> : null}
    </Surface>
    {onYearOnRoad ? <FeatureLink symbol="play.rectangle" title="Your Year on the Road" detail="See the miles, music and moments of your year" onPress={onYearOnRoad} /> : null}
  </>;
}

function MetricTile({ symbol, label, value, wide = false }: { symbol: SFSymbol; label: string; value: string; wide?: boolean }) {
  const colors = useRedesignColors();
  return <Surface radius={20} style={[styles.metricTile, { flexBasis: wide ? '100%' : '47%' }]}>
    <View style={styles.metricTop}><SymbolView name={symbol} tintColor={colors.accent} size={17} /><Text style={[styles.metricLabel, { color: colors.textSecondary }]}>{label}</Text></View>
    <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[styles.metricValue, { color: colors.text }]}>{value}</Text>
  </Surface>;
}

function FeatureLink({ symbol, title, detail, onPress }: { symbol: SFSymbol; title: string; detail: string; onPress: () => void }) {
  const colors = useRedesignColors();
  return <TouchPressable accessibilityRole="button" accessibilityLabel={title} onPress={() => { void haptics.selection(); onPress(); }} style={({ pressed }) => pressed && redesignStyles.pressed}>
    <Surface style={styles.feature}><View style={[styles.featureIcon, { backgroundColor: colors.accentSoft }]}><SymbolView name={symbol} tintColor={colors.accent} size={20} /></View>
      <View style={redesignStyles.flex}><Text style={[styles.featureTitle, { color: colors.text }]}>{title}</Text><Text style={[styles.caption, { color: colors.textSecondary }]}>{detail}</Text></View>
      <SymbolView name="arrow.up.right" tintColor={colors.accent} size={16} />
    </Surface>
  </TouchPressable>;
}

function JourneyRow({ journey, onJourney }: { journey: JourneySummary; onJourney: (id: string) => void }) {
  const colors = useRedesignColors();
  return <CardDetailLink kind="journey" id={journey.id} onSelect={() => onJourney(journey.id)}><TouchPressable accessibilityRole="button" accessibilityLabel={`Open ${journeyDisplayTitle(journey)}`}
    onPress={() => onJourney(journey.id)} style={({ pressed }) => [styles.journeyRow, { borderBottomColor: colors.separator }, pressed && redesignStyles.pressed]}>
    <View style={redesignStyles.flex}><Text numberOfLines={1} style={[styles.journeyTitle, { color: colors.text }]}>{journeyDisplayTitle(journey)}</Text>
      <Text style={[styles.caption, { color: colors.textSecondary }]}>{new Date(journey.startedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} · {number(journey.miles ?? 0, 1)} mi · {duration(journey.durationMinutes ?? 0)}</Text></View>
    <SymbolView name="chevron.right" tintColor={colors.textTertiary} size={13} />
  </TouchPressable></CardDetailLink>;
}

function Days({ model, month, monthStart, monthEnd, focus, totals, journeys, onMonth, onDay, onJourney }: {
  model: Model; month: Date; monthStart: string; monthEnd: string; focus: string; totals: Model['totals']; journeys: JourneySummary[];
  onMonth: (month: string) => void; onDay: (day: string) => void; onJourney: (id: string) => void;
}) {
  const colors = useRedesignColors();
  const monthKey = dayKey(month).slice(0, 7);
  const previous = dayKey(new Date(month.getFullYear(), month.getMonth() - 1, 1)).slice(0, 7);
  const next = dayKey(new Date(month.getFullYear(), month.getMonth() + 1, 1)).slice(0, 7);
  return <>
    <SectionHeader title="Your days" detail="Tap a date to see its drives" />
    <Surface testID="atlas-calendar" style={styles.calendarCard}>
      <View style={styles.monthRow}>
        <TouchPressable accessibilityRole="button" accessibilityLabel="Previous month" accessibilityState={{ disabled: previous < monthStart }} disabled={previous < monthStart} onPress={() => onMonth(previous)} style={styles.monthArrow}><SymbolView name="chevron.left" tintColor={previous < monthStart ? colors.textTertiary : colors.accent} size={17} /></TouchPressable>
        <Text accessibilityRole="header" style={[styles.monthTitle, { color: colors.text }]}>{monthLabel(month)}</Text>
        <TouchPressable accessibilityRole="button" accessibilityLabel="Next month" accessibilityState={{ disabled: next > monthEnd }} disabled={next > monthEnd} onPress={() => onMonth(next)} style={styles.monthArrow}><SymbolView name="chevron.right" tintColor={next > monthEnd ? colors.textTertiary : colors.accent} size={17} /></TouchPressable>
      </View>
      <View style={styles.calendarGrid}>{['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((label, index) => <Text key={index} style={[styles.weekday, { color: colors.textTertiary }]}>{label}</Text>)}
        {calendarDays(month).map(date => {
          const key = dayKey(date), inMonth = date.getMonth() === month.getMonth(), enabled = inMonth && key >= dayKey(model.start) && key <= dayKey(model.end);
          const entries = model.byDay.get(key) ?? [];
          return <TouchPressable key={key} accessibilityRole="button" accessibilityLabel={`${date.toLocaleDateString()}: ${entries.length} journeys`} accessibilityState={{ selected: key === focus, disabled: !enabled }} disabled={!enabled}
            onPress={() => onDay(key)} style={[styles.day, { backgroundColor: key === focus ? colors.accentSoft : colors.surfaceStrong, borderColor: key === focus ? colors.accent : colors.border, opacity: inMonth ? 1 : 0.35 }]}>
            <Text style={[styles.dayNumber, { color: key === focus ? colors.accent : colors.text }]}>{date.getDate()}</Text>
            <View style={[styles.dayDot, { backgroundColor: entries.length ? colors.highlight : 'transparent' }]} />
          </TouchPressable>;
        })}
      </View>
    </Surface>
    <SectionHeader title={localDay(focus).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })} detail={`${journeys.length} ${journeys.length === 1 ? 'drive' : 'drives'}`} />
    <View style={styles.dayTotals}><MetricTile symbol="road.lanes" label="Miles" value={`${number(totals.miles, 1)} mi`} /><MetricTile symbol="clock" label="Driving" value={duration(totals.drivingMinutes)} /><MetricTile symbol="music.note" label="Song plays" value={number(totals.plays)} /><MetricTile symbol="car.fill" label="Journeys" value={number(totals.journeys)} /></View>
    <Surface style={styles.listCard}>{journeys.length ? journeys.map(journey => <JourneyRow key={journey.id} journey={journey} onJourney={onJourney} />)
      : <Text style={[styles.body, { color: colors.textSecondary }]}>No journeys recorded this day.</Text>}</Surface>
  </>;
}

function Insights({ model, insights }: { model: Model; insights: AtlasInsights }) {
  const colors = useRedesignColors();
  const count = Math.max(1, model.totals.journeys);
  const longest = model.selected.reduce<JourneySummary | null>((best, journey) => !best || journey.miles > best.miles ? journey : best, null);
  const longestTime = model.selected.reduce<JourneySummary | null>((best, journey) => !best || journey.durationMinutes > best.durationMinutes ? journey : best, null);
  const mostMusic = model.selected.reduce<JourneySummary | null>((best, journey) => !best || journey.songCount > best.songCount ? journey : best, null);
  const weekdayJourneys = model.selected.filter(journey => ![0, 6].includes(new Date(journey.startedAt).getDay())).length;
  const peakHour = Math.max(1, ...model.hours);
  const maxMiles = Math.max(1, ...model.selected.map(journey => journey.miles));
  const maxMinutes = Math.max(1, ...model.selected.map(journey => journey.durationMinutes));
  return <>
    <SectionHeader title="Driving patterns" detail="How your journeys add up" />
    <Surface style={styles.insightCard}>
      <Kicker>DISTANCE BREAKDOWN</Kicker>
      {model.bands.map((band, index) => <View key={band.label} style={styles.bandRow}>
        <View style={styles.bandLabels}><Text style={[styles.body, { color: colors.text }]}>{band.label}</Text><Text style={[styles.caption, { color: colors.textSecondary }]}>{band.count} drives</Text></View>
        <View style={[styles.bandTrack, { backgroundColor: colors.track }]}><View style={[styles.bandFill, { width: `${band.count / count * 100}%`, backgroundColor: colors.routes[index] }]} /></View>
      </View>)}
    </Surface>
    <View style={styles.metricGrid}><MetricTile symbol="road.lanes" label="Miles per drive" value={`${number(model.totals.miles / count, 1)} mi`} /><MetricTile symbol="clock" label="Time per drive" value={duration(model.totals.drivingMinutes / count)} />
      <MetricTile symbol="music.note" label="Plays per drive" value={number(model.totals.plays / count, 1)} /><MetricTile symbol="calendar" label="Active days" value={number(model.totals.activeDays)} /></View>
    <Heatmap rhythms={insights.drivingRhythms} />
    <SectionHeader title="When you drive" detail="Starts by local hour" />
    <Surface style={styles.insightCard}>
      <View accessible accessibilityLabel={`Hourly departures. ${model.totals.journeys} journeys across 24 local hours.`} style={styles.hoursChart}>
        {model.hours.map((value, hour) => <View key={hour} style={[styles.hourTrack, { backgroundColor: colors.track }]}><View style={[styles.hourBar, { height: `${value ? Math.max(8, value / peakHour * 100) : 0}%`, backgroundColor: colors.routes[Math.floor(hour / 6)] }]} /></View>)}
      </View>
      <View style={styles.hourLabels}>{['12 AM', '6 AM', '12 PM', '6 PM', '12 AM'].map((label, index) => <Text key={index} style={[styles.chartDate, { color: colors.textTertiary }]}>{label}</Text>)}</View>
    </Surface>
    <SectionHeader title="Distance & time" detail="Each dot is a recorded drive" />
    <Surface style={styles.insightCard}>
      <Svg width="100%" height={160} viewBox="0 0 320 160" accessible accessibilityLabel={`${model.selected.length} drives. Distance runs from 0 to ${number(maxMiles, 1)} miles; duration from 0 to ${number(maxMinutes)} minutes.`}>
        <Line x1={18} y1={144} x2={310} y2={144} stroke={colors.separator} /><Line x1={18} y1={12} x2={18} y2={144} stroke={colors.separator} />
        {model.selected.map((journey, index) => <Circle key={journey.id} cx={18 + journey.miles / maxMiles * 286} cy={144 - journey.durationMinutes / maxMinutes * 126} r={3.5} fill={colors.routes[index % colors.routes.length]} />)}
      </Svg>
      <Text style={[styles.caption, { color: colors.textSecondary }]}>0–{number(maxMiles, 1)} mi · 0–{number(maxMinutes)} min</Text>
    </Surface>
    <SectionHeader title="Record book" detail="Best of this period" />
    <Surface style={styles.insightCard}><InsightLine label="Longest distance" value={longest ? `${number(longest.miles, 1)} mi` : '—'} /><InsightLine label="Longest drive" value={longestTime ? duration(longestTime.durationMinutes) : '—'} />
      <InsightLine label="Most song plays" value={mostMusic ? number(mostMusic.songCount) : '—'} /></Surface>
    <SectionHeader title="Music in your drives" detail="Saved soundtrack details" />
    <Surface style={styles.insightCard}><InsightLine label="Unique tracks" value={number(model.totals.uniqueTracks)} /><InsightLine label="Artists" value={number(model.totals.uniqueArtists)} />
      <InsightLine label="Albums" value={number(model.totals.uniqueAlbums)} /><InsightLine label="Known listening time" value={duration(model.totals.listeningMinutes)} /></Surface>
    <SectionHeader title="Activity split" detail="Recorded days and drives" />
    <Surface style={styles.insightCard}><InsightLine label="Weekday drives" value={number(weekdayJourneys)} /><InsightLine label="Weekend drives" value={number(model.totals.journeys - weekdayJourneys)} />
      <InsightLine label="Days without a drive" value={number(Math.max(0, model.days.length - model.totals.activeDays))} /></Surface>
    <Text style={[styles.caption, { color: colors.textTertiary }]}>Listening time sums saved song durations. {model.totals.partialMusic ? 'Some music details or durations are missing, so music totals are partial.' : 'Music is grouped by its journey start date.'}</Text>
  </>;
}

function StoryCard({ kicker, value, detail, artwork }: { kicker: string; value: string; detail: string; artwork?: string | null }) {
  const colors = useRedesignColors();
  return <Surface radius={20} style={styles.storyCard}>
    <Kicker>{kicker}</Kicker>
    <View style={styles.storyRow}>
      {artwork !== undefined ? <Artwork uri={artwork} size={40} label={value} /> : null}
      <Text numberOfLines={2} style={[styles.storyValue, { color: colors.text, fontSize: artwork !== undefined || value.length > 6 ? 17 : 30 }]}>{value}</Text>
    </View>
    <Text numberOfLines={1} style={[styles.caption, { color: colors.textSecondary }]}>{detail}</Text>
  </Surface>;
}

const RING = 2 * Math.PI * 22;
function ExplorationRing({ score, areas }: { score: number; areas: number }) {
  const colors = useRedesignColors();
  return <Surface style={styles.feature}>
    <View accessible accessibilityLabel={`Exploration score ${score} out of 100`} style={styles.ring}>
      <Svg width={54} height={54} style={StyleSheet.absoluteFill}>
        <Circle cx={27} cy={27} r={22} stroke={colors.track} strokeWidth={5} fill="none" />
        <Circle cx={27} cy={27} r={22} stroke={colors.accent} strokeWidth={5} fill="none" strokeLinecap="round" strokeDasharray={[RING * score / 100, RING]} transform="rotate(-90 27 27)" />
      </Svg>
      <Text style={[styles.ringValue, { color: colors.text }]}>{score}</Text>
    </View>
    <View style={redesignStyles.flex}><Text style={[styles.featureTitle, { color: colors.text }]}>Exploration score</Text>
      <Text style={[styles.caption, { color: colors.textSecondary }]}>{number(areas)} stretches of road driven only once</Text></View>
  </Surface>;
}

function Music({ story, insights }: { story: AtlasStory; insights: AtlasInsights }) {
  const colors = useRedesignColors();
  const peak = Math.max(1, story.topArtists[0]?.plays ?? 1);
  if (!story.plays) return <Surface style={styles.notice}><Text style={[styles.body, { color: colors.textSecondary }]}>Songs played while driving will build your soundtrack here.</Text></Surface>;
  return <>
    <SectionHeader title="Top artists" detail="Most played on your drives" />
    <Surface style={styles.insightCard}>{story.topArtists.map((artist, index) => <View key={artist.artist} style={styles.artistRow}>
      <Artwork uri={artist.artworkUrl} size={44} index={index} label={artist.artist} />
      <View style={redesignStyles.flex}>
        <View style={styles.bandLabels}><Text numberOfLines={1} style={[styles.journeyTitle, { color: colors.text, flexShrink: 1 }]}>{artist.artist}</Text><Text style={[styles.caption, { color: colors.textSecondary }]}>{number(artist.plays)}</Text></View>
        <View style={[styles.bandTrack, { backgroundColor: colors.track }]}><View style={[styles.bandFill, { width: `${artist.plays / peak * 100}%`, backgroundColor: colors.accent }]} /></View>
      </View>
    </View>)}</Surface>
    {story.followedSongs.length ? <>
      <SectionHeader title="Songs that followed you" detail="Played on more than one drive" />
      <Surface style={styles.listCard}>{story.followedSongs.map((song, index) => <View key={`${song.artist}:${song.track}`} style={[styles.journeyRow, { borderBottomColor: colors.separator }]}>
        <Artwork uri={song.artworkUrl} size={40} index={index} label={song.track} />
        <View style={redesignStyles.flex}><Text numberOfLines={1} style={[styles.journeyTitle, { color: colors.text }]}>{song.track}</Text><Text numberOfLines={1} style={[styles.caption, { color: colors.textSecondary }]}>{song.artist}</Text></View>
        <Text style={[styles.insightValue, { color: colors.accent }]}>{song.drives} drives</Text>
      </View>)}</Surface>
    </> : null}
    <View style={styles.metricGrid}>
      <MetricTile symbol="music.note" label="Song plays" value={number(story.plays)} />
      <MetricTile symbol="headphones" label="Listening" value={duration(story.listeningMinutes)} />
      <MetricTile symbol="music.mic" label="Unique songs" value={number(insights.soundtrack.uniqueSongs)} />
      <MetricTile symbol="car.fill" label="Drives with music" value={insights.soundtrack.journeyMatchPercent === null ? number(insights.soundtrack.journeysWithMusic) : `${number(insights.soundtrack.journeyMatchPercent)}%`} />
    </View>
  </>;
}

function Places({ story, insights }: { story: AtlasStory; insights: AtlasInsights }) {
  const colors = useRedesignColors();
  const dna = insights.routeDna;
  const states = useMemo(() => loadFiftyStates(getCurrentUser().id).length, []);
  return <>
    {dna.ready && dna.startLabel ? <>
      <SectionHeader title="Your route" detail={dna.bidirectional ? 'Driven both ways' : 'Your most repeated drive'} />
      <Surface style={styles.insightCard}>
        <Text style={[styles.routeTitle, { color: colors.text }]}>{dna.startLabel} {dna.bidirectional ? '⇄' : '→'} {dna.endLabel}</Text>
        {dna.route.length >= 2 ? <View style={[styles.heroMap, { backgroundColor: colors.page }]}><RouteSketch routes={[dna.route]} width={300} height={110} inks={[colors.accent]} /></View> : null}
        <View style={styles.routeStats}>
          <RouteStat label="Trips" value={number(dna.trips)} />
          <RouteStat label="Average" value={dna.averageMinutes === null ? '—' : `${number(dna.averageMinutes)} min`} />
          <RouteStat label="Best" value={dna.quickestMinutes === null ? '—' : `${number(dna.quickestMinutes)} min`} accent />
        </View>
      </Surface>
    </> : null}
    <SectionHeader title="Most connected" detail="Places you drive between" />
    <Surface style={styles.insightCard}>{insights.placeRelationships.connections.length
      ? insights.placeRelationships.connections.slice(0, 5).map(link => <InsightLine key={`${link.startLabel}:${link.endLabel}`} label={`${link.startLabel} → ${link.endLabel}`} value={`${link.trips} trips`} />)
      : <Text style={[styles.body, { color: colors.textSecondary }]}>Connections appear once drives share named places.</Text>}</Surface>
    <View style={styles.metricGrid}>
      <MetricTile symbol="flag.fill" label="States" value={`${states} of 50`} />
      <MetricTile symbol="mappin.and.ellipse" label="New places" value={number(story.newPlaces.length)} />
    </View>
    {story.newPlaces.length ? <>
      <SectionHeader title="New this period" detail="First visits" />
      <Surface style={styles.insightCard}><Text style={[styles.body, { color: colors.text }]}>{story.newPlaces.join(' · ')}</Text></Surface>
    </> : null}
  </>;
}

function RouteStat({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  const colors = useRedesignColors();
  return <View><Text style={[styles.caption, { color: colors.textSecondary }]}>{label}</Text><Text style={[styles.insightValue, { color: accent ? colors.accent : colors.text }]}>{value}</Text></View>;
}

const HEAT_DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
function Heatmap({ rhythms }: { rhythms: AtlasInsights['drivingRhythms'] }) {
  const colors = useRedesignColors();
  const peak = Math.max(1, ...rhythms.weekdayTwoHourBuckets.flat());
  if (!rhythms.journeyCount) return null;
  return <>
    <SectionHeader title="Your driving week" detail={rhythms.leadingDay ? `Busiest: ${rhythms.leadingDay}${rhythms.leadingTime ? ` · ${rhythms.leadingTime}` : ''}` : 'Day and time of each start'} />
    <Surface style={styles.insightCard}>
      <View accessible accessibilityLabel={`Weekly driving heatmap. Busiest day ${rhythms.leadingDay ?? 'unknown'}.`} style={styles.heatmap}>
        {rhythms.weekdayTwoHourBuckets.map((buckets, day) => <View key={day} style={styles.heatRow}>
          <Text style={[styles.heatDay, { color: colors.textTertiary }]}>{HEAT_DAYS[day]}</Text>
          {buckets.map((value, index) => <View key={index} style={[styles.heatCell, { backgroundColor: value ? withAlpha(colors.accent, 0.2 + 0.8 * value / peak) : colors.track }]} />)}
        </View>)}
      </View>
      <View style={styles.hourLabels}>{['12 AM', '6 AM', '12 PM', '6 PM', '12 AM'].map((label, index) => <Text key={index} style={[styles.chartDate, { color: colors.textTertiary }]}>{label}</Text>)}</View>
    </Surface>
  </>;
}

function InsightLine({ label, value }: { label: string; value: string }) {
  const colors = useRedesignColors();
  return <View style={[styles.insightLine, { borderBottomColor: colors.separator }]}><Text style={[styles.body, { color: colors.textSecondary }]}>{label}</Text><Text style={[styles.insightValue, { color: colors.text }]}>{value}</Text></View>;
}

function Tessie({ data, connection, onJourney }: { data: TessieStatistics; connection: 'checking' | 'connected' | 'disconnected' | 'unavailable'; onJourney: (id: string) => void }) {
  const colors = useRedesignColors();
  const known = (value: number | null, unit: string) => value === null ? 'Unknown' : `${number(value, 1)} ${unit}`;
  const status = connection === 'connected' ? 'Connected · saved locally' : connection === 'checking' ? 'Checking connection…'
    : connection === 'disconnected' ? 'Disconnected · saved history remains available' : 'Connection unavailable · saved history remains available';
  return <>
    <SectionHeader title="Vehicle insights" detail={status} />
    <View style={styles.metricGrid}><MetricTile symbol="bolt.fill" label="Efficiency" value={known(data.drivingEfficiency.whPerMile, 'Wh/mi')} />
      <MetricTile symbol="car.fill" label="Measured drives" value={`${data.drivingEfficiency.measuredJourneys} of ${data.drivingEfficiency.journeys}`} />
      <MetricTile symbol="bolt.car.fill" label="Energy used" value={known(data.drivingEfficiency.energyUsedKwh, 'kWh')} />
      <MetricTile symbol="bolt" label="Charging added" value={known(data.chargingOnRoad.energyAddedKwh, 'kWh')} /></View>
    <SectionHeader title="Energy by drive" detail="Measured Tessie history" />
    <Surface style={styles.listCard}>{data.energyByJourney.length ? data.energyByJourney.slice(0, 8).map(drive => <CardDetailLink key={drive.journeyId} kind="journey" id={drive.journeyId} onSelect={() => onJourney(drive.journeyId)}>
      <TouchPressable accessibilityRole="button" accessibilityLabel={`Open Tessie journey ${drive.startingLocation} to ${drive.endingLocation}`} onPress={() => onJourney(drive.journeyId)} style={[styles.journeyRow, { borderBottomColor: colors.separator }]}>
        <View style={redesignStyles.flex}><Text numberOfLines={2} style={[styles.journeyTitle, { color: colors.text }]}>{drive.startingLocation} → {drive.endingLocation}</Text><Text style={[styles.caption, { color: colors.textSecondary }]}>{number(drive.miles, 1)} mi · {known(drive.energyUsedKwh, 'kWh')} · {known(drive.whPerMile, 'Wh/mi')}</Text></View>
        <SymbolView name="chevron.right" tintColor={colors.textTertiary} size={13} />
      </TouchPressable></CardDetailLink>) : <Text style={[styles.body, { color: colors.textSecondary }]}>No imported Tessie drives in this period.</Text>}</Surface>
    <SectionHeader title="Charging on the road" detail={`${data.chargingOnRoad.sessions} matched stops`} />
    <Surface style={styles.insightCard}><InsightLine label="Energy added" value={known(data.chargingOnRoad.energyAddedKwh, 'kWh')} /><InsightLine label="Charging time" value={duration(data.chargingOnRoad.durationMinutes)} />
      {data.chargingOnRoad.charges.slice(0, 6).map(charge => <TouchPressable key={charge.id} accessibilityRole="button" accessibilityLabel={`Open journey linked to charge at ${charge.location}`} onPress={() => onJourney(charge.journeyId)} style={styles.routeLink}>
        <Text style={[styles.body, { color: colors.accent }]}>{charge.location} · {known(charge.energyAddedKwh, 'kWh')} →</Text>
      </TouchPressable>)}</Surface>
    <SectionHeader title="Repeated routes" detail="Same vehicle and endpoints" />
    <Surface style={styles.insightCard}>{data.repeatedRoutes.length ? data.repeatedRoutes.slice(0, 6).map(route => <RouteGroup key={`${route.vehicleKey}:${route.startingLocation}:${route.endingLocation}`} route={route} onJourney={onJourney} />)
      : <Text style={[styles.body, { color: colors.textSecondary }]}>Recurring routes appear after at least two drives share known endpoints.</Text>}</Surface>
    {data.drivingEfficiency.measuredJourneys < data.drivingEfficiency.journeys ? <Text style={[styles.caption, { color: colors.textTertiary }]}>Drives without measured energy are excluded from efficiency totals.</Text> : null}
  </>;
}

function RouteGroup({ route, onJourney }: { route: TessieStatistics['repeatedRoutes'][number]; onJourney: (id: string) => void }) {
  const colors = useRedesignColors();
  const [expanded, setExpanded] = useState(false);
  return <View style={styles.routeRow}>
    <Text style={[styles.journeyTitle, { color: colors.text }]}>{route.startingLocation} → {route.endingLocation}</Text>
    <Text style={[styles.caption, { color: colors.textSecondary }]}>{route.journeys} drives · {number(route.totalMiles, 1)} mi · {route.averageWhPerMile === null ? 'Efficiency unknown' : `${number(route.averageWhPerMile, 1)} Wh/mi`}</Text>
    {(expanded ? route.journeyIds : route.journeyIds.slice(0, 2)).map((id, index) => <TouchPressable key={id} accessibilityRole="button" accessibilityLabel={`Open route drive ${index + 1}`} onPress={() => onJourney(id)} style={styles.routeLink}><Text style={[styles.caption, { color: colors.accent }]}>Open drive {index + 1} →</Text></TouchPressable>)}
    {route.journeyIds.length > 2 ? <TouchPressable accessibilityRole="button" accessibilityLabel={expanded ? 'Show fewer route drives' : `Show all ${route.journeyIds.length} route drives`} onPress={() => setExpanded(value => !value)} style={styles.routeLink}>
      <Text style={[styles.caption, { color: colors.accent }]}>{expanded ? 'Show fewer' : `Show all ${route.journeyIds.length} drives`}</Text>
    </TouchPressable> : null}
  </View>;
}

const styles = StyleSheet.create({
  intro: { fontSize: 15, lineHeight: 21, marginTop: -12 },
  rangeRow: { flexDirection: 'row', gap: 7, padding: 4, borderRadius: 17 },
  rangeButton: { flex: 1, minWidth: 0, minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3, borderRadius: 13, borderWidth: StyleSheet.hairlineWidth },
  rangeLabel: { fontSize: 14, fontWeight: '700' },
  sectionFilters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  sectionButton: { flexBasis: '30%', flexGrow: 1, minWidth: 0, minHeight: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 7, paddingVertical: 8, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth },
  sectionLabel: { fontSize: 14, textAlign: 'center' },
  dateRange: { fontSize: 12, lineHeight: 18, marginTop: -5 },
  notice: { padding: 18 },
  body: { fontSize: 14, lineHeight: 21 },
  caption: { fontSize: 12, lineHeight: 18 },
  hero: { padding: 22, gap: 10 },
  heroMap: { borderRadius: 16, overflow: 'hidden', alignItems: 'center' },
  heroDays: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 10 },
  strip: { gap: 10, paddingRight: 4 },
  storyCard: { width: 158, minHeight: 124, padding: 14, gap: 8, justifyContent: 'space-between' },
  storyRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  storyValue: { flexShrink: 1, fontFamily: SERIF, fontWeight: '600' },
  ring: { width: 54, height: 54, alignItems: 'center', justifyContent: 'center' },
  ringValue: { fontFamily: SERIF, fontSize: 17, fontWeight: '600' },
  artistRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  routeTitle: { fontFamily: SERIF, fontSize: 20, fontWeight: '600' },
  routeStats: { flexDirection: 'row', justifyContent: 'space-between' },
  heatmap: { gap: 4 },
  heatRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  heatDay: { width: 14, fontSize: 10, fontWeight: '700' },
  heatCell: { flex: 1, aspectRatio: 1, borderRadius: 4 },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heroCaption: { fontSize: 14 },
  heroValue: { fontSize: 43, lineHeight: 52, fontWeight: '800', fontVariant: ['tabular-nums'], letterSpacing: -1 },
  heroUnit: { fontSize: 24, fontWeight: '600' },
  comparison: { fontSize: 13, lineHeight: 19 },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 9 },
  chart: { height: 116, flexDirection: 'row', alignItems: 'flex-end', gap: 7 },
  chartColumn: { flex: 1, minWidth: 0, alignItems: 'center', gap: 7 },
  chartTrack: { width: '100%', height: 88, borderRadius: 8, justifyContent: 'flex-end', overflow: 'hidden' },
  chartBar: { width: '100%', borderRadius: 8 },
  chartDate: { fontSize: 10, lineHeight: 14, textAlign: 'center' },
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  metricTile: { flexGrow: 1, minWidth: 0, minHeight: 108, padding: 16, justifyContent: 'space-between', gap: 12 },
  metricTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  metricLabel: { fontSize: 12, lineHeight: 16, flexShrink: 1 },
  metricValue: { fontSize: 23, lineHeight: 28, fontWeight: '800', fontVariant: ['tabular-nums'] },
  feature: { flexDirection: 'row', alignItems: 'center', gap: 13, padding: 16 },
  featureIcon: { width: 43, height: 43, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  featureTitle: { fontSize: 15, lineHeight: 20, fontWeight: '700' },
  listCard: { paddingHorizontal: 16, paddingVertical: 6 },
  journeyRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 63, paddingVertical: 11, borderBottomWidth: StyleSheet.hairlineWidth },
  journeyTitle: { fontSize: 14, lineHeight: 19, fontWeight: '700' },
  moreButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  moreText: { fontSize: 14, fontWeight: '700' },
  calendarCard: { padding: 14, gap: 14 },
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  monthArrow: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  monthTitle: { fontSize: 17, lineHeight: 22, fontWeight: '700' },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 5 },
  weekday: { width: '14.285714%', textAlign: 'center', fontSize: 11, fontWeight: '700', marginBottom: 4 },
  day: { width: '14.285714%', minHeight: 48, alignItems: 'center', justifyContent: 'center', gap: 3, borderWidth: StyleSheet.hairlineWidth, borderRadius: 11 },
  dayNumber: { fontSize: 14, fontWeight: '600' },
  dayDot: { width: 4, height: 4, borderRadius: 2 },
  dayTotals: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  insightCard: { padding: 18, gap: 12 },
  bandRow: { gap: 7 },
  bandLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  bandTrack: { height: 8, borderRadius: 4, overflow: 'hidden' },
  bandFill: { height: '100%', borderRadius: 4 },
  hoursChart: { height: 96, flexDirection: 'row', alignItems: 'flex-end', gap: 3 },
  hourTrack: { flex: 1, minWidth: 0, height: '100%', borderRadius: 3, justifyContent: 'flex-end', overflow: 'hidden' },
  hourBar: { width: '100%', borderRadius: 3 },
  hourLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  insightLine: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 9, borderBottomWidth: StyleSheet.hairlineWidth },
  insightValue: { fontSize: 14, fontWeight: '700', fontVariant: ['tabular-nums'] },
  routeRow: { gap: 7, paddingVertical: 10 },
  routeLink: { minHeight: 34, justifyContent: 'center' },
});
