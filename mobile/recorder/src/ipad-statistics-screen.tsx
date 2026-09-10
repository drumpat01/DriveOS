import { TouchPressable as Pressable, SlidingSelection } from './touch-feedback';
import { useMemo, useState, type ReactNode } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Line } from 'react-native-svg';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import { useAppTheme } from './app-theme';
import { ThemeMaterial } from './theme-material';
import { ivoryPalette } from './theme-palette';
import { IpadPageHeader } from './ipad-page-header';
import { CardDetailLink } from './card-detail-link';
import { journeyDisplayTitle } from './journey-title';
import type { PrimaryDataState } from './primary-sections';
import type { JourneySummary } from './app-data';
import { buildIpadStatistics, calendarDays, dayKey, localDay, summarize, type StatisticsRange } from './ipad-statistics-model';
import { StatisticsBar, StatisticsDayJourneys, StatisticsMotionFrame, StatisticsMotionProvider, StatisticsRollingValue, StatisticsSparkline } from './statistics-motion';
import { haptics } from './haptics';

function useColors() {
  const theme = useAppTheme();
  return theme.resolvePalette(theme.isLight
    ? { isLight: true, page: ivoryPalette.page, card: ivoryPalette.surface, text: ivoryPalette.text, muted: ivoryPalette.secondary, accent: '#7550a8', line: '#d8c5ba', inset: '#eee5f2', coral: '#b94f3d', amber: '#996018', teal: '#247a70', blue: '#326d9b', rose: '#9b4d73', green: '#58752f' }
    : { isLight: false, page: '#07060c', card: '#110c19', text: '#fff8f0', muted: '#bbaac5', accent: '#c77dff', line: '#33273b', inset: '#24152d', coral: '#ff5c73', amber: '#ffb84d', teal: '#36f1cd', blue: '#55b9ff', rose: '#ff61d2', green: '#a8ff60' });
}
const neonGlow = (color: string, isLight: boolean, radius = 12) => isLight ? undefined : { shadowColor: color, shadowOpacity: 0.48, shadowRadius: radius, shadowOffset: { width: 0, height: 0 } };
const number = (value: number, digits = 0) => value.toLocaleString(undefined, { maximumFractionDigits: digits });
const duration = (minutes: number) => `${Math.floor(Math.round(minutes) / 60)}h ${Math.round(minutes) % 60}m`;
const dateLabel = (date: Date) => date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
function Panel({ title, subtitle, children, accent, fill = false, testID }: { title: string; subtitle?: string; children: ReactNode; accent?: string; fill?: boolean; testID?: string }) {
  const c = useColors();
  return <StatisticsMotionFrame testID={testID} style={[styles.panel, fill && styles.fill, { backgroundColor: c.card, borderColor: accent ? `${accent}${c.isLight ? '66' : 'aa'}` : c.line }, accent && neonGlow(accent, c.isLight, 10)]}>
    <ThemeMaterial />
    {accent ? <View pointerEvents="none" style={[styles.panelAccent, { backgroundColor: accent }, neonGlow(accent, c.isLight, 9)]} /> : null}
    <Text accessibilityRole="header" style={[styles.heading, { color: c.text }]}>{title}</Text>
    {subtitle ? <Text style={[styles.caption, { color: c.muted }]}>{subtitle}</Text> : null}{children}
  </StatisticsMotionFrame>;
}
function Button({ label, onPress, selected, disabled = false, accent, grow = false }: { label: string; onPress: () => void; selected?: boolean; disabled?: boolean; accent?: string; grow?: boolean }) {
  const c = useColors();
  const color = accent ?? c.accent;
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected, disabled }} disabled={disabled} onPress={onPress}
    style={[styles.button, grow && styles.growButton, { backgroundColor: 'transparent', borderColor: selected ? color : c.line, opacity: disabled ? 0.4 : 1 }, selected && neonGlow(color, c.isLight, 9)]}>
    <Text style={{ color: selected ? c.text : color }}>{label}</Text>
  </Pressable>;
}
function Bars({ values, labels, unit, onSelect, colors, keys, selectedKey }: { values: number[]; labels: string[]; unit: string; onSelect?: (index: number) => void; colors?: string[]; keys?: string[]; selectedKey?: string }) {
  const theme = useAppTheme();
  const c = useColors(), max = Math.max(1, ...values);
  const palette = (colors ?? (theme.id === 'redline' ? [c.green, c.accent, c.blue, theme.palette.chrome] : [c.coral, c.amber, c.teal, c.blue])).map(theme.chartColor);
  return <ScrollView horizontal showsHorizontalScrollIndicator accessibilityLabel={`${unit} chart. Scroll to inspect all values.`}>
    <View style={styles.bars}>{values.map((value, i) => <StatisticsMotionFrame key={keys?.[i] ?? i}><Pressable disabled={!onSelect} onPress={() => onSelect?.(i)}
      accessibilityRole={onSelect ? 'button' : 'text'} accessibilityState={onSelect ? { selected: keys?.[i] === selectedKey } : undefined} accessibilityLabel={`${labels[i]}: ${number(value, 1)} ${unit}`} style={[styles.barColumn, Boolean(onSelect) && keys?.[i] === selectedKey && { backgroundColor: c.inset, borderRadius: 8 }]}>
      <Text style={[styles.tiny, { color: c.muted }]}>{number(value, 1)}</Text>
      <View style={[styles.barTrack, { backgroundColor: `${palette[i % palette.length]}18` }]}><StatisticsBar fraction={value / max} color={palette[i % palette.length]} style={neonGlow(palette[i % palette.length], c.isLight, 7)} /></View>
      <Text style={[styles.tiny, { color: c.muted }]}>{labels[i]}</Text>
    </Pressable></StatisticsMotionFrame>)}</View>
  </ScrollView>;
}
function StatLine({ label, value, color }: { label: string; value: string; color: string }) {
  const c = useColors();
  return <View style={styles.statLine}><View style={[styles.statDot, { backgroundColor: color }, neonGlow(color, c.isLight, 7)]} /><Text style={[styles.statLabel, { color: c.muted }]}>{label}</Text><StatisticsRollingValue style={[styles.statValue, { color: c.text }]} value={value} /></View>;
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

export function IpadStatisticsScreen({ state, onRefresh, onJourney, onUpgrade, onAtlas, onYearOnRoad, historyDays, compact = false }: {
  state: PrimaryDataState; onRefresh: () => void | Promise<void>; onJourney: (id: string) => void; onUpgrade: () => void; onAtlas?: () => void; onYearOnRoad?: () => void; historyDays: number | null; compact?: boolean;
}) {
  const theme = useAppTheme();
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
  const chooseDay = (key: string) => { if (key !== focus) void haptics.selection(); setSelectedDay(key); setMonthKey(key); setDayCount(5); };
  const metrics: { key: 'miles' | 'journeys' | 'drivingMinutes' | 'plays' | 'listeningMinutes' | 'activeDays'; title: string; icon: SFSymbol; color: string; format: (n: number) => string }[] = [
    { key: 'miles', title: 'Total miles', icon: 'road.lanes', color: c.coral, format: n => `${number(n, 1)} mi` },
    { key: 'journeys', title: 'Total journeys', icon: 'car.fill', color: c.green, format: n => number(n) },
    { key: 'drivingMinutes', title: 'Driving time', icon: 'clock', color: c.teal, format: duration },
    { key: 'plays', title: 'Song plays', icon: 'music.note', color: c.rose, format: n => number(n) },
    { key: 'listeningMinutes', title: 'Listening time', icon: 'headphones', color: c.blue, format: duration },
    { key: 'activeDays', title: 'Active days', icon: 'calendar', color: c.amber, format: n => number(n) },
  ];
  const journeyCount = Math.max(1, model.totals.journeys);
  const longestDistance = model.selected.reduce<JourneySummary | null>((best, journey) => !best || Math.max(0, journey.miles || 0) > Math.max(0, best.miles || 0) ? journey : best, null);
  const longestDuration = model.selected.reduce<JourneySummary | null>((best, journey) => !best || Math.max(0, journey.durationMinutes || 0) > Math.max(0, best.durationMinutes || 0) ? journey : best, null);
  const mostMusic = model.selected.reduce<JourneySummary | null>((best, journey) => !best || Math.max(0, journey.songCount || 0) > Math.max(0, best.songCount || 0) ? journey : best, null);
  const weekendJourneys = model.selected.filter(journey => [0, 6].includes(new Date(journey.startedAt).getDay())).length;
  const weekdayJourneys = model.totals.journeys - weekendJourneys;
  const quietDays = Math.max(0, model.days.length - model.totals.activeDays);
  const rangeColors = theme.id === 'redline' ? [c.green, c.accent, c.blue, theme.palette.chrome] : [c.teal, theme.isCustom ? c.accent : c.amber, c.coral, c.blue];
  return <StatisticsMotionProvider><SafeAreaView edges={compact ? ['top', 'left', 'right'] : ['left', 'right']} style={{ flex: 1, backgroundColor: c.page }}>
    <ScrollView testID="ipad-statistics" contentInsetAdjustmentBehavior={compact ? 'never' : 'automatic'} contentContainerStyle={{ padding: compact ? 16 : 24, paddingTop: 18, paddingBottom: insets.bottom + 28 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={c.accent} />}>
      <View testID="ipad-statistics-canvas" onLayout={event => setWidth(event.nativeEvent.layout.width)} style={styles.canvas}>
        <IpadPageHeader compact={compact} title="Statistics" width={width} artwork={require('../assets/cinematic-statistics-photo-v1.jpg')} subtitle="Every mile. Every journey. Your numbers.">
          <SlidingSelection selectedIndex={([7, 30, 90, 'all'] as const).indexOf(effectiveRange)} style={[styles.row, compact && styles.rangeGrid]} itemStyle={compact ? styles.growButton : undefined} highlightStyle={{ borderRadius: 12, backgroundColor: `${rangeColors[([7, 30, 90, 'all'] as const).indexOf(effectiveRange)]}${c.isLight ? '22' : '2e'}` }}>{([7, 30, 90, 'all'] as const).map((value, index) => <Button key={value} accent={rangeColors[index]} label={`${value === 'all' ? 'All' : `${value}D`}${historyDays !== null && (value === 'all' || value > historyDays) ? ' · Plus' : ''}`} selected={effectiveRange === value}
            onPress={() => { if (historyDays !== null && (value === 'all' || value > historyDays)) { onUpgrade(); return; } if (value !== effectiveRange) void haptics.selection(); setRange(value); setSelectedDay(null); setMonthKey(null); setRecentCount(8); setDayCount(5); }} />)}</SlidingSelection>
        </IpadPageHeader>
        <Pressable accessibilityRole="button" accessibilityLabel="Open Atlas" onPress={onAtlas ?? onUpgrade}
          style={({ pressed }) => ({ borderRadius: 24, padding: 24, marginBottom: 22, borderWidth: 1, borderColor: c.accent, backgroundColor: c.card, opacity: pressed ? .75 : 1, overflow: 'hidden', gap: 8 })}>
          <ThemeMaterial />
          <Text style={{ color: c.accent, fontSize: 10, fontWeight: '800', letterSpacing: 2 }}>YOUR PRIVATE INTELLIGENCE · PLUS</Text>
          <Text style={{ color: c.text, fontSize: 25, fontWeight: '800' }}>Atlas ↗</Text>
          <Text style={{ color: c.muted, fontSize: 14 }}>Discover your routes, driving rhythms, and the places that connect them.</Text>
        </Pressable>
        {state.status === 'error' ? <View accessibilityRole="alert"><Text style={{ color: c.muted }}>{state.message || 'Statistics could not refresh. Saved data remains available.'}</Text><Button label="Try again" onPress={onRefresh} /></View> : null}
        {!state.data ? state.status === 'loading' ? <ActivityIndicator accessibilityLabel="Loading statistics" color={c.accent} /> : <Text style={{ color: c.muted }}>Statistics are unavailable. Try refreshing.</Text> : <>
          <Text style={[styles.caption, { color: c.muted }]}>{dateLabel(model.start)} – {dateLabel(model.end)} · By journey start date{historyDays === null ? '' : ` · ${historyDays}-day history`}</Text>
          {!model.selected.length ? <Text style={[styles.body, { color: c.muted }]}>No journeys in this period. Your recorded journeys will populate this dashboard.</Text> : null}
          <View testID="statistics-widgets" style={styles.row}>{metrics.map(metric => {
            const value = model.totals[metric.key], previous = model.previous?.[metric.key];
            const partial = metric.key === 'listeningMinutes' && (model.totals.partialMusic || model.previous?.partialMusic);
            const comparison = partial ? 'Known song durations' : previous === undefined ? 'No comparison available' : previous === 0 ? value === 0 ? 'Unchanged from prior period' : 'Prior period: 0' : `${value >= previous ? '+' : ''}${number((value - previous) / previous * 100, 1)}% vs prior period`;
            const series = model.days.slice(-90).map(day => day[metric.key]);
            return <View key={metric.key} style={[styles.metric, { width: width ? (width - (columns - 1) * 12) / columns : '100%', backgroundColor: c.card, borderColor: `${metric.color}${c.isLight ? '66' : 'bb'}` }, neonGlow(metric.color, c.isLight, 11)]}>
              <ThemeMaterial />
              <View pointerEvents="none" style={[styles.metricAccent, { backgroundColor: metric.color }, neonGlow(metric.color, c.isLight, 9)]} />
              <SymbolView name={metric.icon} tintColor={metric.color} style={{ width: 21, height: 21 }} /><Text style={[styles.caption, { color: c.muted }]}>{metric.title}</Text>
              <StatisticsRollingValue style={[styles.value, { color: c.text }]} value={metric.format(value)} /><Text style={[styles.tiny, { color: c.muted }]}>{comparison}</Text>
              <StatisticsSparkline values={series} color={theme.chartColor(metric.color)} style={[styles.sparkline, neonGlow(metric.color, c.isLight, 6)]} />
            </View>;
          })}</View>
          <Panel title="Your days, in detail" subtitle="Select a day to see its totals and journeys." accent={c.amber}>
            <View testID="statistics-calendar-layout" style={{ flexDirection: wide ? 'row' : 'column', gap: 24 }}>
              <View style={{ flex: wide ? 1.7 : undefined, minWidth: 0 }}>
                <View style={[styles.row, { justifyContent: 'space-between', marginBottom: 12 }]}><Button accent={c.teal} label="Previous month" disabled={dayKey(month).slice(0, 7) <= startKey.slice(0, 7)} onPress={() => setMonthKey(dayKey(new Date(month.getFullYear(), month.getMonth() - 1, 1)))} />
                  <Text style={[styles.body, { color: c.text }]}>{month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</Text>
                  <Button accent={c.teal} label="Next month" disabled={dayKey(month).slice(0, 7) >= endKey.slice(0, 7)} onPress={() => setMonthKey(dayKey(new Date(month.getFullYear(), month.getMonth() + 1, 1)))} /></View>
                <View style={styles.calendar}>{['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((label, i) => <Text key={`weekday-${i}`} style={[styles.weekday, { color: c.muted }]}>{label}</Text>)}
                  {calendarDays(month).map(date => {
                    const key = dayKey(date), inMonth = date.getMonth() === month.getMonth(), inRange = key >= startKey && key <= endKey, enabled = inMonth && inRange;
                    const entries = model.byDay.get(key) ?? [], miles = entries.reduce((sum, j) => sum + Math.max(0, j.miles || 0), 0);
                    return <Pressable key={key} testID={`day-${key}`} accessibilityRole="button" disabled={!enabled} accessibilityState={{ selected: key === focus, disabled: !enabled }}
                      accessibilityLabel={`${dateLabel(date)}: ${number(miles, 1)} miles, ${entries.length} journeys`} onPress={() => chooseDay(key)}
                      style={[styles.day, { borderColor: key === focus ? c.coral : inRange ? `${c.amber}88` : c.line, backgroundColor: key === focus ? `${c.coral}30` : inRange ? `${c.amber}${c.isLight ? '12' : '18'}` : 'transparent', opacity: inMonth ? 1 : 0.28 }, key === focus && neonGlow(c.coral, c.isLight, 8)]}>
                      <Text style={{ color: inMonth ? c.text : c.muted }}>{date.getDate()}</Text><Text style={[styles.tiny, { color: entries.length ? c.teal : c.muted }]}>{inRange && entries.length ? `${number(miles, 1)} mi` : '—'}</Text>
                      {width / fontScale >= 480 ? <Text style={[styles.tiny, { color: c.muted }]}>{inRange ? entries.length : '—'} trips</Text> : null}
                    </Pressable>;
                  })}</View>
              </View>
              <StatisticsMotionFrame style={{ flex: wide ? 1 : undefined, minWidth: 0, gap: 12 }}><Text accessibilityRole="header" style={[styles.heading, { color: c.text }]}>{dateLabel(localDay(focus))}</Text>
                <View style={styles.row}>{metrics.filter(m => m.key !== 'activeDays').map(metric => <View key={metric.key} style={{ minWidth: 90, flexGrow: 1 }}><Text style={[styles.caption, { color: c.muted }]}>{metric.title}</Text><StatisticsRollingValue style={[styles.body, { color: c.text }]} value={metric.format(daily[metric.key])} /></View>)}</View>
                <StatisticsDayJourneys selectionKey={focus}>
                {dailyJourneys.length ? dailyJourneys.slice(0, dayCount).map(journey => <JourneyRow key={journey.id} journey={journey} onJourney={onJourney} />) : <Text style={{ color: c.muted }}>No journeys recorded this day.</Text>}
                {dailyJourneys.length > dayCount ? <Button label="More journeys this day" onPress={() => setDayCount(n => n + 10)} /> : null}
                {daily.partialMusic ? <Text style={[styles.caption, { color: c.muted }]}>Music totals include available details only.</Text> : null}
                </StatisticsDayJourneys>
              </StatisticsMotionFrame>
            </View>
          </Panel>
          <StatisticsMotionFrame style={{ flexDirection: wide ? 'row' : 'column', gap: 16 }}><View style={{ flex: 2, minWidth: 0 }}><Panel title="Daily distance" subtitle="Miles per day · tap a bar to select its date" accent={theme.id === 'redline' ? c.green : c.coral} fill>
            <Bars keys={model.days.map(d => d.key)} selectedKey={focus} values={model.days.map(d => d.miles)} labels={model.days.map(d => localDay(d.key).toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' }))} unit="miles" onSelect={i => chooseDay(model.days[i].key)} />
          </Panel></View><View style={{ flex: 1, minWidth: 0 }}><Panel title="Distance breakdown" subtitle="Journeys by distance" accent={c.teal} fill>
            {model.bands.map((band, index) => <View key={band.label} style={{ gap: 7, marginVertical: 8 }}><Text style={{ color: c.text }}>{band.label} · {band.count} journeys ({number(band.count / Math.max(1, model.totals.journeys) * 100)}%)</Text><View style={{ height: 6, backgroundColor: c.inset, borderRadius: 3 }}><StatisticsBar horizontal fraction={band.count / Math.max(1, model.totals.journeys)} color={rangeColors[index]} /></View></View>)}
          </Panel></View></StatisticsMotionFrame>
          <StatisticsMotionFrame testID="statistics-analysis-row" style={{ flexDirection: wide ? 'row' : 'column', alignItems: 'stretch', gap: 16 }}><View style={{ flex: 1, minWidth: 0 }}><Panel testID="statistics-hourly-panel" title="Hourly departures" subtitle="Journey count by local start hour" accent={theme.id === 'redline' ? c.green : c.amber} fill><Bars values={model.hours} labels={model.hours.map((_, i) => `${i}:00`)} unit="journeys" colors={theme.id === 'redline' ? [c.green, c.accent, c.blue, theme.palette.chrome] : [c.amber, c.coral, c.teal, c.blue]} /></Panel></View>
            <View style={{ flex: 1, minWidth: 0 }}><Panel testID="statistics-scatter-panel" title="Distance vs duration" subtitle="Each dot is one journey · miles horizontally, minutes vertically" accent={c.coral} fill>
              <Svg width="100%" height={180} viewBox="0 0 300 180" accessibilityLabel={`${model.selected.length} journeys. Full mileage and duration are listed in Recent journeys.`} accessible>
                <Line x1={12} y1={160} x2={288} y2={160} stroke={c.line} /><Line x1={12} y1={10} x2={12} y2={160} stroke={c.line} />
                {(() => { const maxMiles = Math.max(1, ...model.selected.map(j => Number.isFinite(j.miles) ? j.miles : 0)), maxMinutes = Math.max(1, ...model.selected.map(j => Number.isFinite(j.durationMinutes) ? j.durationMinutes : 0)); return model.selected.map((j, index) => <Circle key={j.id} cx={12 + Math.max(0, j.miles || 0) / maxMiles * 270} cy={160 - Math.max(0, j.durationMinutes || 0) / maxMinutes * 145} r={3.5} fill={rangeColors[index % rangeColors.length]} opacity={0.8} />); })()}
              </Svg><Text style={[styles.caption, { color: c.muted }]}>0–{number(Math.max(0, ...model.selected.map(j => Number.isFinite(j.miles) ? j.miles : 0)), 1)} mi · 0–{number(Math.max(0, ...model.selected.map(j => Number.isFinite(j.durationMinutes) ? j.durationMinutes : 0)))} min</Text>
            </Panel></View><View style={{ flex: 1, minWidth: 0 }}><Panel testID="statistics-music-panel" title="Music totals" subtitle="Distinct entries in saved journey soundtracks" accent={c.rose} fill>
              {[['Unique tracks', model.totals.uniqueTracks, c.rose], ['Artists', model.totals.uniqueArtists, c.blue], ['Albums', model.totals.uniqueAlbums, c.teal]].map(([label, value, color]) => <StatLine key={String(label)} label={String(label)} value={number(Number(value))} color={String(color)} />)}
            </Panel></View></StatisticsMotionFrame>
          <StatisticsMotionFrame testID="statistics-bottom-layout" style={{ flexDirection: wide ? 'row' : 'column', alignItems: 'stretch', gap: 16 }}>
            <View style={{ flex: 1.75, minWidth: 0 }}><Panel title="Recent journeys" subtitle={`${model.selected.length} journeys in this period · newest first`} accent={c.blue} fill>
              {model.selected.slice(0, recentCount).map(journey => <JourneyRow key={journey.id} journey={journey} onJourney={onJourney} />)}
              {model.selected.length > recentCount ? <Button label="Show more journeys" accent={c.blue} onPress={() => setRecentCount(n => n + 20)} /> : null}
            </Panel></View>
            <View testID="statistics-bottom-widgets" style={{ flex: 1, minWidth: 0, gap: 16 }}>
              <Panel title="Journey averages" subtitle="Simple totals divided by journey count" accent={c.teal}>
                <StatLine label="Miles per journey" value={`${number(model.totals.miles / journeyCount, 1)} mi`} color={c.coral} />
                <StatLine label="Time per journey" value={duration(model.totals.drivingMinutes / journeyCount)} color={c.teal} />
                <StatLine label="Plays per journey" value={number(model.totals.plays / journeyCount, 1)} color={c.rose} />
              </Panel>
              <Panel title="Record book" subtitle="Highest recorded values in this period" accent={theme.id === 'redline' ? c.green : c.amber}>
                <StatLine label="Longest distance" value={longestDistance ? `${number(Math.max(0, longestDistance.miles || 0), 1)} mi` : '—'} color={c.coral} />
                <StatLine label="Longest drive" value={longestDuration ? duration(Math.max(0, longestDuration.durationMinutes || 0)) : '—'} color={c.amber} />
                <StatLine label="Most plays" value={mostMusic ? number(Math.max(0, mostMusic.songCount || 0)) : '—'} color={c.rose} />
              </Panel>
              <Panel title="Activity split" subtitle="Recorded days and journey counts" accent={c.green}>
                <StatLine label="Weekday journeys" value={number(weekdayJourneys)} color={c.blue} />
                <StatLine label="Weekend journeys" value={number(weekendJourneys)} color={c.green} />
                <StatLine label="Days without journeys" value={number(quietDays)} color={c.muted} />
              </Panel>
            </View>
          </StatisticsMotionFrame>
          <Text style={[styles.caption, { color: c.muted }]}>Listening time sums saved song durations, not measured playback. {model.totals.partialMusic ? 'Some music details or durations are missing; listening and distinct music totals are partial. ' : ''}All music is grouped by its journey’s start date. Sparklines show up to 90 days. Comparisons use the preceding equal-length period when accessible.</Text>
        </>}
        {onYearOnRoad && <Pressable accessibilityRole="button" accessibilityLabel="Your Year on the Road. JourneyDeck Plus" onPress={onYearOnRoad}
          style={({ pressed }) => ({ borderRadius: 24, padding: 24, marginBottom: 22, borderWidth: 1, borderColor: c.accent, backgroundColor: c.card, opacity: pressed ? .75 : 1, overflow: 'hidden', gap: 8 })}>
          <ThemeMaterial />
          <Text style={{ color: c.accent, fontSize: 10, fontWeight: '800', letterSpacing: 2 }}>YOUR PERSONAL PREMIERE · PLUS</Text>
          <Text style={{ color: c.text, fontSize: 25, fontWeight: '800' }}>Your Year on the Road ↗</Text>
          <Text style={{ color: c.muted, fontSize: 14 }}>The miles. The music. The moments. Play your story in any theme.</Text>
        </Pressable>}
      </View>
    </ScrollView>
  </SafeAreaView></StatisticsMotionProvider>;
}

const styles = StyleSheet.create({
  canvas: { width: '100%', maxWidth: 1600, alignSelf: 'center', gap: 18 },
  panel: { borderWidth: 1, borderRadius: 20, padding: 18, gap: 12 },
  panelAccent: { position: 'absolute', left: 0, top: 18, bottom: 18, width: 3, borderTopRightRadius: 3, borderBottomRightRadius: 3 },
  fill: { flex: 1 },
  heading: { fontSize: 20, fontWeight: '600' }, body: { fontSize: 15, lineHeight: 22 }, caption: { fontSize: 12, lineHeight: 18 }, tiny: { fontSize: 10, lineHeight: 15 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, alignItems: 'center' },
  button: { minHeight: 44, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  growButton: { flexBasis: '45%', flexGrow: 1 },
  rangeGrid: { width: '100%', alignItems: 'stretch' },
  metric: { height: 200, padding: 14, borderWidth: 1, borderRadius: 18, gap: 8 },
  metricAccent: { position: 'absolute', left: 0, top: 14, bottom: 14, width: 3, borderTopRightRadius: 3, borderBottomRightRadius: 3 },
  sparkline: { marginTop: 'auto' },
  value: { fontSize: 24, fontWeight: '600', fontVariant: ['tabular-nums'] },
  calendar: { flexDirection: 'row', flexWrap: 'wrap' }, weekday: { width: '14.285714%', textAlign: 'center', paddingBottom: 10 },
  day: { width: '14.285714%', minHeight: 76, paddingVertical: 7, paddingHorizontal: 2, borderWidth: 0.5, alignItems: 'center', gap: 3 },
  journey: { minHeight: 60, borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 12, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12 },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, paddingVertical: 12 }, barColumn: { width: 40, alignItems: 'center', gap: 7 }, barTrack: { width: 17, height: 105, borderRadius: 4, justifyContent: 'flex-end' },
  statLine: { minHeight: 46, flexDirection: 'row', alignItems: 'center', gap: 10 },
  statDot: { width: 8, height: 8, borderRadius: 4 },
  statLabel: { flex: 1, fontSize: 12 },
  statValue: { fontSize: 15, fontWeight: '700', fontVariant: ['tabular-nums'] },
});
