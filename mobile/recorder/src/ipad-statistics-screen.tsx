import { useMemo, useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Line, Polyline } from 'react-native-svg';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import { useAppTheme } from './app-theme';
import { ivoryPalette } from './theme-palette';
import { IpadPageHeader } from './ipad-page-header';
import { CardDetailLink } from './card-detail-link';
import { journeyDisplayTitle } from './journey-title';
import type { PrimaryDataState } from './primary-sections';
import type { JourneySummary } from './app-data';
import { buildIpadStatistics, calendarDays, dayKey, localDay, summarize, type StatisticsRange } from './ipad-statistics-model';

function useColors() {
  return useAppTheme().isLight
    ? { page: ivoryPalette.page, card: ivoryPalette.surface, text: ivoryPalette.text, muted: ivoryPalette.secondary, accent: ivoryPalette.violet, line: ivoryPalette.border, inset: ivoryPalette.lilac, orange: '#ab4a16' }
    : { page: '#08070d', card: '#120d1a', text: '#fff6ed', muted: '#b6a6c1', accent: '#ba91ef', line: '#49304f', inset: '#291735', orange: '#ffae72' };
}
const number = (value: number, digits = 0) => value.toLocaleString(undefined, { maximumFractionDigits: digits });
const duration = (minutes: number) => `${Math.floor(Math.round(minutes) / 60)}h ${Math.round(minutes) % 60}m`;
const dateLabel = (date: Date) => date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
function Panel({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  const c = useColors();
  return <View style={[styles.panel, { backgroundColor: c.card, borderColor: c.line }]}>
    <Text accessibilityRole="header" style={[styles.heading, { color: c.text }]}>{title}</Text>
    {subtitle ? <Text style={[styles.caption, { color: c.muted }]}>{subtitle}</Text> : null}{children}
  </View>;
}
function Button({ label, onPress, selected, disabled = false }: { label: string; onPress: () => void; selected?: boolean; disabled?: boolean }) {
  const c = useColors();
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected, disabled }} disabled={disabled} onPress={onPress}
    style={[styles.button, { backgroundColor: selected ? c.inset : 'transparent', borderColor: selected ? c.accent : c.line, opacity: disabled ? 0.4 : 1 }]}>
    <Text style={{ color: selected ? c.text : c.accent }}>{label}</Text>
  </Pressable>;
}
function Bars({ values, labels, unit, onSelect }: { values: number[]; labels: string[]; unit: string; onSelect?: (index: number) => void }) {
  const c = useColors(), max = Math.max(1, ...values);
  return <ScrollView horizontal showsHorizontalScrollIndicator accessibilityLabel={`${unit} chart. Scroll to inspect all values.`}>
    <View style={styles.bars}>{values.map((value, i) => <Pressable key={i} disabled={!onSelect} onPress={() => onSelect?.(i)}
      accessibilityRole={onSelect ? 'button' : 'text'} accessibilityLabel={`${labels[i]}: ${number(value, 1)} ${unit}`} style={styles.barColumn}>
      <Text style={[styles.tiny, { color: c.muted }]}>{number(value, 1)}</Text>
      <View style={styles.barTrack}><View style={{ width: 17, borderRadius: 4, height: value / max * 105, backgroundColor: i % 3 === 0 ? c.orange : c.accent }} /></View>
      <Text style={[styles.tiny, { color: c.muted }]}>{labels[i]}</Text>
    </Pressable>)}</View>
  </ScrollView>;
}
function JourneyRow({ journey, onJourney }: { journey: JourneySummary; onJourney: (id: string) => void }) {
  const c = useColors();
  return <CardDetailLink kind="journey" id={journey.id} onSelect={() => onJourney(journey.id)}>
    <Pressable onPress={() => onJourney(journey.id)} accessibilityRole="button" accessibilityLabel={`Open ${journeyDisplayTitle(journey)}`}
      style={[styles.journey, { borderColor: c.line }]}>
      <View style={{ flex: 1, minWidth: 0 }}><Text style={[styles.body, { color: c.text }]}>{journeyDisplayTitle(journey)}</Text>
        <Text style={[styles.caption, { color: c.muted }]}>{new Date(journey.startedAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</Text></View>
      <Text style={[styles.caption, { color: c.accent }]}>{number(Math.max(0, journey.miles || 0), 1)} mi · {duration(Math.max(0, journey.durationMinutes || 0))} · {number(Math.max(0, journey.songCount || 0))} plays ›</Text>
    </Pressable>
  </CardDetailLink>;
}

export function IpadStatisticsScreen({ state, onRefresh, onJourney, onUpgrade, onAtlas, historyDays }: {
  state: PrimaryDataState; onRefresh: () => void | Promise<void>; onJourney: (id: string) => void; onUpgrade: () => void; onAtlas?: () => void; historyDays: number | null;
}) {
  const c = useColors(), insets = useSafeAreaInsets(), { fontScale } = useWindowDimensions();
  const [width, setWidth] = useState(0), [range, setRange] = useState<StatisticsRange>(30);
  const [selectedDay, setSelectedDay] = useState<string | null>(null), [monthKey, setMonthKey] = useState<string | null>(null);
  const [recentCount, setRecentCount] = useState(8), [dayCount, setDayCount] = useState(5);
  const [refreshing, setRefreshing] = useState(false);
  const refresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try { await onRefresh(); } finally { setRefreshing(false); }
  };
  const nowKey = dayKey(new Date());
  const effectiveRange = historyDays !== null && (range === 'all' || range > historyDays) ? 30 : range;
  const model = useMemo(() => buildIpadStatistics(state.data?.journeys ?? [], state.data?.details ?? [], effectiveRange, new Date(), historyDays), [state.data, effectiveRange, historyDays, nowKey]);
  const startKey = dayKey(model.start), endKey = dayKey(model.end);
  const focus = selectedDay && selectedDay >= startKey && selectedDay <= endKey ? selectedDay : dayKey(new Date(model.selected[0]?.startedAt ?? model.end));
  const desiredMonth = monthKey ?? focus;
  const month = localDay(desiredMonth.slice(0, 7) < startKey.slice(0, 7) ? startKey : desiredMonth.slice(0, 7) > endKey.slice(0, 7) ? endKey : desiredMonth);
  const dailyJourneys = [...(model.byDay.get(focus) ?? [])].reverse();
  const daily = useMemo(() => summarize(model.byDay.get(focus) ?? [], state.data?.details ?? []), [model, focus, state.data]);
  const wide = width / fontScale >= 960, columns = width / fontScale >= 1000 ? 6 : width / fontScale >= 550 ? 3 : width / fontScale >= 330 ? 2 : 1;
  const chooseDay = (key: string) => { setSelectedDay(key); setMonthKey(key); setDayCount(5); };
  const metrics: { key: 'miles' | 'journeys' | 'drivingMinutes' | 'plays' | 'listeningMinutes' | 'activeDays'; title: string; icon: SFSymbol; format: (n: number) => string }[] = [
    { key: 'miles', title: 'Total miles', icon: 'road.lanes', format: n => `${number(n, 1)} mi` },
    { key: 'journeys', title: 'Total journeys', icon: 'car.fill', format: n => number(n) },
    { key: 'drivingMinutes', title: 'Driving time', icon: 'clock', format: duration },
    { key: 'plays', title: 'Song plays', icon: 'music.note', format: n => number(n) },
    { key: 'listeningMinutes', title: 'Listening time', icon: 'headphones', format: duration },
    { key: 'activeDays', title: 'Active days', icon: 'calendar', format: n => number(n) },
  ];
  return <SafeAreaView edges={['left', 'right']} style={{ flex: 1, backgroundColor: c.page }}>
    <ScrollView testID="ipad-statistics" contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: 24, paddingTop: 18, paddingBottom: insets.bottom + 28 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={c.accent} />}>
      <View testID="ipad-statistics-canvas" onLayout={event => setWidth(event.nativeEvent.layout.width)} style={styles.canvas}>
        <IpadPageHeader title="Statistics" width={width} artwork={require('../assets/statistics-story-hero-v1.png')} subtitle="Every mile. Every journey. Your numbers.">
          <View style={styles.row}>{([7, 30, 90, 'all'] as const).map(value => <Button key={value} label={`${value === 'all' ? 'All' : `${value}D`}${historyDays !== null && (value === 'all' || value > historyDays) ? ' · Plus' : ''}`} selected={effectiveRange === value}
            onPress={() => { if (historyDays !== null && (value === 'all' || value > historyDays)) { onUpgrade(); return; } setRange(value); setSelectedDay(null); setMonthKey(null); setRecentCount(8); setDayCount(5); }} />)}</View>
        </IpadPageHeader>
        {state.status === 'error' ? <View accessibilityRole="alert"><Text style={{ color: c.muted }}>{state.message || 'Statistics could not refresh. Saved data remains available.'}</Text><Button label="Try again" onPress={onRefresh} /></View> : null}
        {!state.data ? state.status === 'loading' ? <ActivityIndicator accessibilityLabel="Loading statistics" color={c.accent} /> : <Text style={{ color: c.muted }}>Statistics are unavailable. Try refreshing.</Text> : <>
          <Text style={[styles.caption, { color: c.muted }]}>{dateLabel(model.start)} – {dateLabel(model.end)} · By journey start date{historyDays === null ? '' : ` · ${historyDays}-day history`}</Text>
          {!model.selected.length ? <Text style={[styles.body, { color: c.muted }]}>No journeys in this period. Your recorded journeys will populate this dashboard.</Text> : null}
          <View testID="statistics-widgets" style={styles.row}>{metrics.map(metric => {
            const value = model.totals[metric.key], previous = model.previous?.[metric.key];
            const partial = metric.key === 'listeningMinutes' && (model.totals.partialMusic || model.previous?.partialMusic);
            const comparison = partial ? 'Known song durations' : previous === undefined ? 'No comparison available' : previous === 0 ? value === 0 ? 'Unchanged from prior period' : 'Prior period: 0' : `${value >= previous ? '+' : ''}${number((value - previous) / previous * 100, 1)}% vs prior period`;
            const series = model.days.slice(-90).map(day => day[metric.key]), max = Math.max(1, ...series);
            return <View key={metric.key} style={[styles.metric, { width: width ? (width - (columns - 1) * 12) / columns : '100%', backgroundColor: c.card, borderColor: c.line }]}>
              <SymbolView name={metric.icon} tintColor={c.accent} style={{ width: 21, height: 21 }} /><Text style={[styles.caption, { color: c.muted }]}>{metric.title}</Text>
              <Text style={[styles.value, { color: c.text }]}>{metric.format(value)}</Text><Text style={[styles.tiny, { color: c.muted }]}>{comparison}</Text>
              <Svg width="100%" height={30} viewBox="0 0 160 30" accessible={false}><Polyline fill="none" stroke={c.accent} strokeWidth={2} points={series.map((n, i) => `${i / Math.max(1, series.length - 1) * 160},${28 - n / max * 25}`).join(' ')} /></Svg>
            </View>;
          })}</View>
          <Panel title="Your days, in detail" subtitle="Select a day to see its totals and journeys.">
            <View testID="statistics-calendar-layout" style={{ flexDirection: wide ? 'row' : 'column', gap: 24 }}>
              <View style={{ flex: wide ? 1.7 : undefined, minWidth: 0 }}>
                <View style={[styles.row, { justifyContent: 'space-between', marginBottom: 12 }]}><Button label="Previous month" disabled={dayKey(month).slice(0, 7) <= startKey.slice(0, 7)} onPress={() => setMonthKey(dayKey(new Date(month.getFullYear(), month.getMonth() - 1, 1)))} />
                  <Text style={[styles.body, { color: c.text }]}>{month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</Text>
                  <Button label="Next month" disabled={dayKey(month).slice(0, 7) >= endKey.slice(0, 7)} onPress={() => setMonthKey(dayKey(new Date(month.getFullYear(), month.getMonth() + 1, 1)))} /></View>
                <View style={styles.calendar}>{['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((label, i) => <Text key={`weekday-${i}`} style={[styles.weekday, { color: c.muted }]}>{label}</Text>)}
                  {calendarDays(month).map(date => {
                    const key = dayKey(date), enabled = date.getMonth() === month.getMonth() && key >= startKey && key <= endKey;
                    const entries = model.byDay.get(key) ?? [], miles = entries.reduce((sum, j) => sum + Math.max(0, j.miles || 0), 0);
                    return <Pressable key={key} testID={`day-${key}`} accessibilityRole="button" disabled={!enabled} accessibilityState={{ selected: key === focus, disabled: !enabled }}
                      accessibilityLabel={`${dateLabel(date)}: ${number(miles, 1)} miles, ${entries.length} journeys`} onPress={() => chooseDay(key)}
                      style={[styles.day, { borderColor: key === focus ? c.accent : c.line, backgroundColor: key === focus ? c.inset : 'transparent', opacity: enabled ? 1 : 0.25 }]}>
                      <Text style={{ color: c.text }}>{date.getDate()}</Text><Text style={[styles.tiny, { color: c.accent }]}>{enabled && entries.length ? `${number(miles, 1)} mi` : '—'}</Text>
                      {width / fontScale >= 480 ? <Text style={[styles.tiny, { color: c.muted }]}>{enabled ? entries.length : '—'} trips</Text> : null}
                    </Pressable>;
                  })}</View>
              </View>
              <View style={{ flex: wide ? 1 : undefined, minWidth: 0, gap: 12 }}><Text accessibilityRole="header" style={[styles.heading, { color: c.text }]}>{dateLabel(localDay(focus))}</Text>
                <View style={styles.row}>{metrics.filter(m => m.key !== 'activeDays').map(metric => <View key={metric.key} style={{ minWidth: 90, flexGrow: 1 }}><Text style={[styles.caption, { color: c.muted }]}>{metric.title}</Text><Text style={[styles.body, { color: c.text }]}>{metric.format(daily[metric.key])}</Text></View>)}</View>
                {dailyJourneys.length ? dailyJourneys.slice(0, dayCount).map(journey => <JourneyRow key={journey.id} journey={journey} onJourney={onJourney} />) : <Text style={{ color: c.muted }}>No journeys recorded this day.</Text>}
                {dailyJourneys.length > dayCount ? <Button label="More journeys this day" onPress={() => setDayCount(n => n + 10)} /> : null}
                {daily.partialMusic ? <Text style={[styles.caption, { color: c.muted }]}>Music totals include available details only.</Text> : null}
              </View>
            </View>
          </Panel>
          <View style={{ flexDirection: wide ? 'row' : 'column', gap: 16 }}><View style={{ flex: 2, minWidth: 0 }}><Panel title="Daily distance" subtitle="Miles per day · tap a bar to select its date">
            <Bars values={model.days.map(d => d.miles)} labels={model.days.map(d => localDay(d.key).toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' }))} unit="miles" onSelect={i => chooseDay(model.days[i].key)} />
          </Panel></View><View style={{ flex: 1, minWidth: 0 }}><Panel title="Distance breakdown" subtitle="Journeys by distance">
            {model.bands.map(band => <View key={band.label} style={{ gap: 7, marginVertical: 8 }}><Text style={{ color: c.text }}>{band.label} · {band.count} journeys ({number(band.count / Math.max(1, model.totals.journeys) * 100)}%)</Text><View style={{ height: 6, backgroundColor: c.inset, borderRadius: 3 }}><View style={{ height: 6, borderRadius: 3, backgroundColor: c.accent, width: `${band.count / Math.max(1, model.totals.journeys) * 100}%` }} /></View></View>)}
          </Panel></View></View>
          <View style={{ flexDirection: wide ? 'row' : 'column', gap: 16 }}><View style={{ flex: 1, minWidth: 0 }}><Panel title="Hourly departures" subtitle="Journey count by local start hour"><Bars values={model.hours} labels={model.hours.map((_, i) => `${i}:00`)} unit="journeys" /></Panel></View>
            <View style={{ flex: 1, minWidth: 0 }}><Panel title="Distance vs duration" subtitle="Each dot is one journey · miles horizontally, minutes vertically">
              <Svg width="100%" height={180} viewBox="0 0 300 180" accessibilityLabel={`${model.selected.length} journeys. Full mileage and duration are listed in Recent journeys.`} accessible>
                <Line x1={12} y1={160} x2={288} y2={160} stroke={c.line} /><Line x1={12} y1={10} x2={12} y2={160} stroke={c.line} />
                {(() => { const maxMiles = Math.max(1, ...model.selected.map(j => Number.isFinite(j.miles) ? j.miles : 0)), maxMinutes = Math.max(1, ...model.selected.map(j => Number.isFinite(j.durationMinutes) ? j.durationMinutes : 0)); return model.selected.map(j => <Circle key={j.id} cx={12 + Math.max(0, j.miles || 0) / maxMiles * 270} cy={160 - Math.max(0, j.durationMinutes || 0) / maxMinutes * 145} r={3.5} fill={c.orange} opacity={0.65} />); })()}
              </Svg><Text style={[styles.caption, { color: c.muted }]}>0–{number(Math.max(0, ...model.selected.map(j => Number.isFinite(j.miles) ? j.miles : 0)), 1)} mi · 0–{number(Math.max(0, ...model.selected.map(j => Number.isFinite(j.durationMinutes) ? j.durationMinutes : 0)))} min</Text>
            </Panel></View><View style={{ flex: 1, minWidth: 0 }}><Panel title="Music totals" subtitle="Distinct entries in saved journey soundtracks">
              {[['Unique tracks', model.totals.uniqueTracks], ['Artists', model.totals.uniqueArtists], ['Albums', model.totals.uniqueAlbums]].map(([label, value]) => <View key={label} style={[styles.row, { justifyContent: 'space-between', paddingVertical: 12 }]}><Text style={{ color: c.muted }}>{label}</Text><Text style={[styles.heading, { color: c.text }]}>{number(Number(value))}</Text></View>)}
            </Panel></View></View>
          <Panel title="Recent journeys" subtitle={`${model.selected.length} journeys in this period · newest first`}>
            {model.selected.slice(0, recentCount).map(journey => <JourneyRow key={journey.id} journey={journey} onJourney={onJourney} />)}
            {model.selected.length > recentCount ? <Button label="Show more journeys" onPress={() => setRecentCount(n => n + 20)} /> : null}
          </Panel>
          <Text style={[styles.caption, { color: c.muted }]}>Listening time sums saved song durations, not measured playback. {model.totals.partialMusic ? 'Some music details or durations are missing; listening and distinct music totals are partial. ' : ''}All music is grouped by its journey’s start date. Sparklines show up to 90 days. Comparisons use the preceding equal-length period when accessible.</Text>
          <Button label="Open Atlas" onPress={onAtlas ?? onUpgrade} />
        </>}
      </View>
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  canvas: { width: '100%', maxWidth: 1600, alignSelf: 'center', gap: 18 },
  panel: { borderWidth: 1, borderRadius: 20, padding: 18, gap: 12 },
  heading: { fontSize: 20, fontWeight: '600' }, body: { fontSize: 15, lineHeight: 22 }, caption: { fontSize: 12, lineHeight: 18 }, tiny: { fontSize: 10, lineHeight: 15 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, alignItems: 'center' },
  button: { minHeight: 44, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  metric: { padding: 14, borderWidth: 1, borderRadius: 18, gap: 8, minHeight: 190 }, value: { fontSize: 24, fontWeight: '600', fontVariant: ['tabular-nums'] },
  calendar: { flexDirection: 'row', flexWrap: 'wrap' }, weekday: { width: '14.285714%', textAlign: 'center', paddingBottom: 10 },
  day: { width: '14.285714%', minHeight: 76, paddingVertical: 7, paddingHorizontal: 2, borderWidth: 0.5, alignItems: 'center', gap: 3 },
  journey: { minHeight: 60, borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 12, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12 },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, paddingVertical: 12 }, barColumn: { width: 40, alignItems: 'center', gap: 7 }, barTrack: { height: 105, justifyContent: 'flex-end' },
});
