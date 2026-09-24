import { TouchPressable as Pressable, SlidingSelection } from './touch-feedback';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Line } from 'react-native-svg';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import { useAppTheme } from './app-theme';
import { AdaptiveGlassSurface } from './delight-ui';
import { ivoryPalette } from './theme-palette';
import { IpadPageHeader } from './ipad-page-header';
import { CardDetailLink } from './card-detail-link';
import { journeyDisplayTitle } from './journey-title';
import type { PrimaryDataState } from './primary-sections';
import type { JourneySummary } from './app-data';
import { localAtlasClient } from './app-data';
import { getCurrentUser } from './auth';
import { tessieDirectStatus } from './tessie-direct';
import { TESSIE_INTEGRATION_ENABLED } from './release-features';
import type { TessieJourneyEnergy, TessieRouteComparison, TessieStatistics } from './tessie-statistics-model';
import { buildIpadStatistics, calendarDays, dayKey, localDay, summarize, type StatisticsRange } from './ipad-statistics-model';
import { StatisticsBar, StatisticsDayJourneys, StatisticsMotionFrame, StatisticsMotionProvider, StatisticsRollingValue, StatisticsSparkline } from './statistics-motion';
import { haptics } from './haptics';
import { useAdaptiveLayout, verticalFoldContentColumns } from './adaptive-layout';
import { useCoreMotion } from './use-core-motion';
import { IPAD_GRID_GAP, ipadGridSpan } from './device-layout';

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
function StatisticsGlass({ radius, reduceTransparency }: { radius: number; reduceTransparency: boolean }) {
  return <AdaptiveGlassSurface reduceTransparency={reduceTransparency} style={[StyleSheet.absoluteFill, { borderRadius: radius }]}><View /></AdaptiveGlassSurface>;
}
function Panel({ title, subtitle, children, accent, reduceTransparency = false, fill = false, testID }: { title: string; subtitle?: string; children: ReactNode; accent?: string; reduceTransparency?: boolean; fill?: boolean; testID?: string }) {
  const theme = useAppTheme();
  const c = useColors();
  return <StatisticsMotionFrame testID={testID} style={[styles.panel, fill && styles.fill, { borderColor: theme.id === 'midnight-canopy' ? c.line : accent ? `${accent}${c.isLight ? '88' : 'cc'}` : c.line }, accent && neonGlow(accent, c.isLight, 7)]}>
    <StatisticsGlass radius={20} reduceTransparency={reduceTransparency} />
    <Text accessibilityRole="header" style={[styles.heading, { color: theme.id === 'midnight-canopy' ? c.teal : c.text }, theme.id === 'midnight-canopy' && { borderLeftWidth: 4, borderLeftColor: theme.palette.rose, paddingLeft: 10 }]}>{title}</Text>
    {subtitle ? <Text style={[styles.caption, { color: c.muted }]}>{subtitle}</Text> : null}{children}
  </StatisticsMotionFrame>;
}
function Button({ label, onPress, selected, disabled = false, accent, grow = false, fitLabel = false }: { label: string; onPress: () => void; selected?: boolean; disabled?: boolean; accent?: string; grow?: boolean; fitLabel?: boolean }) {
  const c = useColors();
  const color = accent ?? c.accent;
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected, disabled }} disabled={disabled} onPress={onPress}
    style={[styles.button, grow && styles.growButton, { backgroundColor: 'transparent', borderColor: selected ? color : c.line, opacity: disabled ? 0.4 : 1 }, selected && neonGlow(color, c.isLight, 9)]}>
    <Text adjustsFontSizeToFit={fitLabel} minimumFontScale={fitLabel ? 0.8 : undefined} numberOfLines={fitLabel ? 1 : undefined} style={{ color: selected ? c.text : color }}>{label}</Text>
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

function TessieStatisticsPanels({ statistics, connection, onJourney, wide, span }: {
  statistics: TessieStatistics; connection: 'checking' | 'connected' | 'disconnected' | 'unavailable'; onJourney: (id: string) => void;
  wide: boolean; span: (count: number) => number | '100%';
}) {
  const c = useColors();
  const status = connection === 'connected' ? 'Tessie connected · saved locally'
    : connection === 'checking' ? 'Checking Tessie connection…'
      : connection === 'disconnected' ? 'Tessie is disconnected. Previously imported history remains available offline.'
        : 'Tessie connection status is unavailable. Saved history remains available offline.';
  const known = (value: number | null, digits = 1, unit = 'kWh') => value === null ? 'Unknown' : `${number(value, digits)} ${unit}`;
  const journeyById = new Map(statistics.energyByJourney.map(drive => [drive.journeyId, drive]));
  const openJourney = (id: string, label: string, actionLabel = 'Open ›') => <CardDetailLink key={id} kind="journey" id={id} onSelect={() => onJourney(id)}>
    <Pressable accessibilityRole="button" accessibilityLabel={`Open ${label}`} onPress={() => onJourney(id)} style={[styles.journey, { borderColor: c.line }]}>
      <View style={{ flex: 1, minWidth: 0 }}><Text style={[styles.body, { color: c.text }]} numberOfLines={2}>{label}</Text></View>
      <Text style={[styles.caption, { color: c.accent }]}>{actionLabel}</Text>
    </Pressable>
  </CardDetailLink>;
  const driveTitle = (drive: TessieJourneyEnergy) => `${drive.startingLocation} → ${drive.endingLocation}`;
  const panels = [
    <Panel key="efficiency" testID="tessie-driving-efficiency" title="Driving efficiency" subtitle={status} accent={c.teal}>
      {statistics.drivingEfficiency.whPerMile === null
        ? <Text style={[styles.value, { color: c.text }]}>Unknown</Text>
        : <Text accessibilityRole="text" accessibilityLabel={`${number(statistics.drivingEfficiency.whPerMile, 1)} watt-hours per mile`} style={[styles.value, { color: c.text }]}>{number(statistics.drivingEfficiency.whPerMile, 1)} Wh/mi</Text>}
      <StatLine label="Measured energy" value={known(statistics.drivingEfficiency.energyUsedKwh)} color={c.teal} />
      <StatLine label="Measured drives" value={`${statistics.drivingEfficiency.measuredJourneys} of ${statistics.drivingEfficiency.journeys}`} color={c.blue} />
      <StatLine label="Measured distance" value={statistics.drivingEfficiency.measuredJourneys ? `${number(statistics.drivingEfficiency.measuredMiles, 1)} mi` : '—'} color={c.coral} />
      {!statistics.drivingEfficiency.journeys ? <Text style={[styles.caption, { color: c.muted }]}>No imported Tessie drives in this period.</Text> : null}
    </Panel>,
    <Panel key="energy" testID="tessie-energy-by-journey" title="Energy by journey" subtitle="Drive energy is grouped by journey start date." accent={c.coral}>
      {statistics.energyByJourney.length ? statistics.energyByJourney.slice(0, 8).map(drive => <View key={drive.journeyId}>
        {openJourney(drive.journeyId, `Tessie journey ${driveTitle(drive)}`)}
        <Text style={[styles.caption, { color: c.muted }]}>{new Date(drive.startedAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })} · {number(drive.miles, 1)} mi · {known(drive.energyUsedKwh)} · {drive.whPerMile === null ? 'Efficiency unknown' : `${number(drive.whPerMile, 1)} Wh/mi`}</Text>
      </View>) : <Text style={[styles.body, { color: c.muted }]}>No imported Tessie journeys in this period.</Text>}
      {statistics.energyByJourney.some(drive => drive.energyUsedKwh === null) ? <Text style={[styles.caption, { color: c.muted }]}>Some drives have no measured energy. Unknown values are not counted as zero.</Text> : null}
      {statistics.energyByJourney.length > 8 ? <Text style={[styles.caption, { color: c.muted }]}>Showing the 8 most recent of {statistics.energyByJourney.length} journeys.</Text> : null}
    </Panel>,
    <Panel key="charging" testID="tessie-charging-on-road" title="Charging on the road" subtitle="Matched Supercharger stops · charge start date" accent={c.amber}>
      {statistics.chargingOnRoad.sessions ? <>
        <StatLine label="Energy added" value={known(statistics.chargingOnRoad.energyAddedKwh)} color={c.amber} />
        <StatLine label="Measured sessions" value={`${statistics.chargingOnRoad.measuredSessions} of ${statistics.chargingOnRoad.sessions}`} color={c.blue} />
        <StatLine label="Charging time" value={duration(statistics.chargingOnRoad.durationMinutes)} color={c.teal} />
        {statistics.chargingOnRoad.charges.slice(0, 6).map(charge => <View key={charge.id}>
          {openJourney(charge.journeyId, `Journey linked to charge at ${charge.location}`)}
          <Text style={[styles.caption, { color: c.muted }]}>{charge.location} · {known(charge.energyAddedKwh)} · {duration(charge.durationMinutes)}{charge.batteryGainedPercent === null ? '' : ` · ${number(charge.batteryGainedPercent, 0)} percentage points`}</Text>
        </View>)}
        {statistics.chargingOnRoad.charges.length > 6 ? <Text style={[styles.caption, { color: c.muted }]}>Showing 6 of {statistics.chargingOnRoad.charges.length} charging stops.</Text> : null}
        {statistics.chargingOnRoad.measuredSessions < statistics.chargingOnRoad.sessions ? <Text style={[styles.caption, { color: c.muted }]}>Some stops have no measured energy; they are excluded from the energy total.</Text> : null}
      </> : <Text style={[styles.body, { color: c.muted }]}>No matched on-road Supercharger stops in this period.</Text>}
    </Panel>,
    <Panel key="routes" testID="tessie-route-comparison" title="Route comparison" subtitle="Repeated routes on the same vehicle · weighted by measured miles" accent={c.blue}>
      {statistics.repeatedRoutes.length ? statistics.repeatedRoutes.slice(0, 6).map(route => <RouteComparisonRow key={`${route.vehicleKey}:${route.startingLocation}:${route.endingLocation}`} route={route} vehicleName={journeyById.get(route.journeyIds[0] ?? '')?.vehicleName ?? null} openJourney={openJourney} />)
        : <Text style={[styles.body, { color: c.muted }]}>Repeated routes appear after at least two journeys share known start and destination labels.</Text>}
    </Panel>,
  ];
  return <View testID="tessie-statistics-panels" style={[styles.row, { alignItems: 'stretch' }]}>{panels.map((panel, index) => <View key={index} style={{ width: wide ? span(3) : '100%', minWidth: 0 }}>{panel}</View>)}</View>;
}

function RouteComparisonRow({ route, vehicleName, openJourney }: { route: TessieRouteComparison; vehicleName: string | null; openJourney: (id: string, label: string, actionLabel?: string) => ReactNode }) {
  const c = useColors();
  const [showAllJourneys, setShowAllJourneys] = useState(false);
  const label = `${route.startingLocation} → ${route.endingLocation}`;
  const journeyIds = showAllJourneys ? route.journeyIds : route.journeyIds.slice(0, 2);
  return <View style={{ gap: 2 }}>
    {journeyIds.map((id, index) => openJourney(id, `Journey ${index + 1} for route ${label}`, `Drive ${index + 1} ›`))}
    <Text style={[styles.caption, { color: c.muted }]}>{vehicleName ?? 'Vehicle not identified'} · {label} · {route.journeys} journeys · {number(route.totalMiles, 1)} mi</Text>
    <Text style={[styles.caption, { color: c.muted }]}>{route.averageWhPerMile === null ? 'Efficiency unknown' : `${number(route.averageWhPerMile, 1)} Wh/mi average`}
      {route.bestWhPerMile === null ? '' : ` · ${number(route.bestWhPerMile, 1)} best`}{route.worstWhPerMile === null ? '' : ` · ${number(route.worstWhPerMile, 1)} highest`}</Text>
    {route.measuredJourneys < route.journeys ? <Text style={[styles.caption, { color: c.muted }]}>{route.measuredJourneys} of {route.journeys} drives measured</Text> : null}
    {route.journeyIds.length > 2 ? <Pressable accessibilityRole="button" accessibilityLabel={showAllJourneys ? 'Show fewer route journeys' : `Show all ${route.journeyIds.length} route journeys`}
      accessibilityState={{ expanded: showAllJourneys }} onPress={() => setShowAllJourneys(value => !value)} style={styles.button}>
      <Text style={[styles.caption, { color: c.accent }]}>{showAllJourneys ? 'Show fewer' : `Show all ${route.journeyIds.length} journeys`}</Text>
    </Pressable> : null}
  </View>;
}

export function IpadStatisticsScreen({ state, onRefresh, onJourney, onUpgrade, onAtlas, onYearOnRoad, historyDays, compact = false }: {
  state: PrimaryDataState; onRefresh: () => void | Promise<void>; onJourney: (id: string) => void; onUpgrade: () => void; onAtlas?: () => void; onYearOnRoad?: () => void; historyDays: number | null; compact?: boolean;
}) {
  const theme = useAppTheme();
  const motion = useCoreMotion();
  const c = useColors(), insets = useSafeAreaInsets(), { fontScale } = useWindowDimensions();
  const adaptiveLayout = useAdaptiveLayout();
  const [width, setWidth] = useState(0), [range, setRange] = useState<StatisticsRange>(30);
  const [compactSection, setCompactSection] = useState<'overview' | 'days' | 'insights' | 'tessie'>('overview');
  const [tessieConnection, setTessieConnection] = useState<'checking' | 'connected' | 'disconnected' | 'unavailable'>(TESSIE_INTEGRATION_ENABLED ? 'checking' : 'unavailable');
  const [selectedDay, setSelectedDay] = useState<string | null>(null), [monthKey, setMonthKey] = useState<string | null>(null);
  const [recentCount, setRecentCount] = useState(compact ? 3 : 8), [dayCount, setDayCount] = useState(5);
  const [refreshing, setRefreshing] = useState(false);
  const refresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try { await onRefresh(); } finally { setRefreshing(false); }
  };
  const nowKey = dayKey(new Date());
  const effectiveRange = historyDays !== null && (range === 'all' || range > historyDays) ? 30 : range;
  const model = useMemo(() => buildIpadStatistics(state.data?.journeys ?? [], state.data?.details ?? [], effectiveRange, new Date(), historyDays), [state.data, effectiveRange, historyDays, nowKey]);
  const tessieRange = useMemo(() => {
    const startOfDisplayedDay = new Date(model.start.getFullYear(), model.start.getMonth(), model.start.getDate()).valueOf();
    const start = historyDays === null ? startOfDisplayedDay : Math.max(startOfDisplayedDay, Date.now() - historyDays * 86_400_000);
    const end = new Date(model.end.getFullYear(), model.end.getMonth(), model.end.getDate() + 1).valueOf();
    return { startInclusive: new Date(start).toISOString(), endExclusive: new Date(end).toISOString() };
  }, [model.start, model.end, historyDays, nowKey]);
  const tessieStatistics = useMemo(() => TESSIE_INTEGRATION_ENABLED
    ? localAtlasClient.tessieStatistics(getCurrentUser().id, tessieRange)
    : null, [tessieRange, state.data, nowKey]);
  useEffect(() => {
    let active = true;
    if (!TESSIE_INTEGRATION_ENABLED) { setTessieConnection('unavailable'); return () => { active = false; }; }
    setTessieConnection('checking');
    void tessieDirectStatus().then(status => {
      if (active) setTessieConnection(status === 'connected' ? 'connected' : 'disconnected');
    }).catch(() => { if (active) setTessieConnection('unavailable'); });
    return () => { active = false; };
  }, [state.data, nowKey]);
  const startKey = dayKey(model.start), endKey = dayKey(model.end);
  const focus = selectedDay && selectedDay >= startKey && selectedDay <= endKey ? selectedDay : dayKey(new Date(model.selected[0]?.startedAt ?? model.end));
  const desiredMonth = monthKey ?? focus;
  const month = localDay(desiredMonth.slice(0, 7) < startKey.slice(0, 7) ? startKey : desiredMonth.slice(0, 7) > endKey.slice(0, 7) ? endKey : desiredMonth);
  const dailyJourneys = [...(model.byDay.get(focus) ?? [])].reverse();
  const daily = useMemo(() => summarize(model.byDay.get(focus) ?? [], state.data?.details ?? []), [model, focus, state.data]);
  const foldColumns = verticalFoldContentColumns(adaptiveLayout.fold, compact ? 16 : 24);
  const headerFoldColumns = verticalFoldContentColumns(adaptiveLayout.fold, (compact ? 16 : 24) + 24);
  const wide = Boolean(foldColumns) || width / fontScale >= 960, columns = width / fontScale >= 1000 ? 6 : width / fontScale >= 550 ? 3 : width / fontScale >= 330 ? 2 : 1;
  const singleRowRanges = compact && fontScale <= 1.2;
  const span = (count: number) => width ? ipadGridSpan(width, count) : '100%';
  const panelContentWidth = Math.max(0, width - 38);
  const panelSpan = (count: number) => panelContentWidth ? ipadGridSpan(panelContentWidth, count) : '100%';
  const beforePane = foldColumns ? { width: foldColumns.beforeWidth, flexGrow: 0, flexShrink: 0, minWidth: 0 } : undefined;
  const afterPane = foldColumns ? { width: foldColumns.afterWidth, flexGrow: 0, flexShrink: 0, minWidth: 0 } : undefined;
  const paneGap = foldColumns?.gap;
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
  const rangeColors = theme.id === 'midnight-canopy' ? [c.amber, c.accent, c.amber, c.amber] : theme.id === 'redline' ? [c.green, c.accent, c.blue, theme.palette.chrome] : [c.teal, theme.isCustom ? c.accent : c.amber, c.coral, c.blue];
  const rangeFilterColors = [rangeColors[1], rangeColors[1], rangeColors[2], rangeColors[3]];
  const rangeSelector = <SlidingSelection selectedIndex={([7, 30, 90, 'all'] as const).indexOf(effectiveRange)} style={[styles.row, compact && styles.rangeGrid, singleRowRanges && styles.rangeRow]} itemStyle={compact ? (singleRowRanges ? styles.rangeButton : styles.growButton) : undefined} highlightStyle={{ borderRadius: 12, backgroundColor: `${rangeFilterColors[([7, 30, 90, 'all'] as const).indexOf(effectiveRange)]}${c.isLight ? '22' : '2e'}` }}>{([7, 30, 90, 'all'] as const).map((value, index) => <Button key={value} accent={rangeFilterColors[index]} fitLabel={singleRowRanges} label={`${value === 'all' ? 'All' : `${value}D`}${historyDays !== null && (value === 'all' || value > historyDays) ? ' · Plus' : ''}`} selected={effectiveRange === value}
    onPress={() => { if (historyDays !== null && (value === 'all' || value > historyDays)) { onUpgrade(); return; } if (value !== effectiveRange) void haptics.selection(); setRange(value); setSelectedDay(null); setMonthKey(null); setRecentCount(compact ? 3 : 8); setDayCount(5); }} />)}</SlidingSelection>;
  const compactSections = TESSIE_INTEGRATION_ENABLED ? ['overview', 'days', 'insights', 'tessie'] as const : ['overview', 'days', 'insights'] as const;
  const wrapCompactSections = width / fontScale < 360;
  const compactSectionSelector = <SlidingSelection selectedIndex={compactSections.indexOf(compactSection as never)} style={[styles.sectionSelector, wrapCompactSections && { flexWrap: 'wrap' }]} itemStyle={[styles.sectionButton, wrapCompactSections && { flexBasis: '45%' }]}
    highlightStyle={{ borderRadius: 12, backgroundColor: `${c.accent}${c.isLight ? '20' : '30'}` }}>
    {compactSections.map(section => <Button key={section} grow label={section[0].toUpperCase() + section.slice(1)} selected={compactSection === section}
      onPress={() => { if (section !== compactSection) void haptics.selection(); setCompactSection(section); }} />)}
  </SlidingSelection>;
  const metricComparison = (metric: typeof metrics[number]) => {
    const value = model.totals[metric.key], previous = model.previous?.[metric.key];
    const partial = metric.key === 'listeningMinutes' && (model.totals.partialMusic || model.previous?.partialMusic);
    return partial ? 'Known song durations' : previous === undefined ? 'No comparison available' : previous === 0 ? value === 0 ? 'Unchanged from prior period' : 'Prior period: 0' : `${value >= previous ? '+' : ''}${number((value - previous) / previous * 100, 1)}% vs prior period`;
  };
  const metricCard = (metric: typeof metrics[number], cardWidth: number | '100%') => {
    const value = model.totals[metric.key], comparison = metricComparison(metric);
    const series = model.days.slice(-90).map(day => day[metric.key]);
    const autumn = theme.id === 'midnight-canopy';
    const highlight = autumn ? (['miles', 'drivingMinutes', 'listeningMinutes'].includes(metric.key) ? c.accent : c.amber) : metric.color;
    return <View key={metric.key} testID={`statistics-metric-${metric.key}`} style={[styles.metric, { width: cardWidth, backgroundColor: c.card, borderColor: highlight }, !autumn && neonGlow(metric.color, c.isLight, 11)]}>
      {!autumn && <StatisticsGlass radius={18} reduceTransparency={motion.reduceTransparency} />}
      <View style={autumn ? { alignSelf: 'flex-start', padding: 4, borderRadius: 8, backgroundColor: c.rose } : undefined}><SymbolView name={metric.icon} tintColor={autumn ? c.text : metric.color} style={{ width: 21, height: 21 }} /></View><Text style={[styles.caption, { color: theme.id === 'midnight-canopy' ? c.teal : c.muted }]}>{metric.title}</Text>
      <StatisticsRollingValue style={[styles.value, { color: theme.id === 'midnight-canopy' ? theme.palette.amber : c.text }]} value={metric.format(value)} /><Text style={[styles.tiny, { color: c.muted }]}>{comparison}</Text>
      <StatisticsSparkline values={series} color={autumn ? highlight : theme.chartColor(metric.color)} style={[styles.sparkline, !autumn && neonGlow(metric.color, c.isLight, 6)]} />
    </View>;
  };
  const compactMetricCard = (metric: typeof metrics[number], cardWidth: number | '100%') => <View key={metric.key} testID={`statistics-metric-${metric.key}`}
    style={[styles.compactMetric, { width: cardWidth, backgroundColor: c.card, borderColor: `${metric.color}${c.isLight ? '70' : 'bb'}` }]}>
    <View style={styles.compactMetricTop}><SymbolView name={metric.icon} tintColor={metric.color} style={{ width: 18, height: 18 }} />
      <Text numberOfLines={1} style={[styles.caption, { color: c.muted }]}>{metric.title}</Text></View>
    <StatisticsRollingValue style={[styles.compactValue, { color: c.text }]} value={metric.format(model.totals[metric.key])} />
  </View>;
  const foldMetricColumns = Math.max(1, Math.min(3, Math.floor(((Math.min(foldColumns?.beforeWidth ?? 0, foldColumns?.afterWidth ?? 0) / fontScale) + 12) / 180)));
  const foldMetricPane = (items: typeof metrics, paneWidth: number) => <View style={[styles.row, { width: paneWidth, flexGrow: 0, flexShrink: 0 }]}>{items.map(metric => metricCard(metric, (paneWidth - (foldMetricColumns - 1) * 12) / foldMetricColumns))}</View>;
  const hourlyPanel = <Panel testID="statistics-hourly-panel" title="Hourly departures" subtitle="Journey count by local start hour" accent={theme.id === 'redline' ? c.green : c.amber} fill><Bars values={model.hours} labels={model.hours.map((_, i) => `${i}:00`)} unit="journeys" colors={theme.id === 'redline' ? [c.green, c.accent, c.blue, theme.palette.chrome] : [c.amber, c.coral, c.teal, c.blue]} /></Panel>;
  const scatterPanel = <Panel testID="statistics-scatter-panel" title="Distance vs duration" subtitle="Each dot is one journey · miles horizontally, minutes vertically" accent={c.coral} fill>
    <Svg width="100%" height={180} viewBox="0 0 300 180" accessibilityLabel={`${model.selected.length} journeys. Full mileage and duration are listed in Recent journeys.`} accessible>
      <Line x1={12} y1={160} x2={288} y2={160} stroke={c.line} /><Line x1={12} y1={10} x2={12} y2={160} stroke={c.line} />
      {(() => { const maxMiles = Math.max(1, ...model.selected.map(j => Number.isFinite(j.miles) ? j.miles : 0)), maxMinutes = Math.max(1, ...model.selected.map(j => Number.isFinite(j.durationMinutes) ? j.durationMinutes : 0)); return model.selected.map((j, index) => <Circle key={j.id} cx={12 + Math.max(0, j.miles || 0) / maxMiles * 270} cy={160 - Math.max(0, j.durationMinutes || 0) / maxMinutes * 145} r={3.5} fill={rangeColors[index % rangeColors.length]} opacity={0.8} />); })()}
    </Svg><Text style={[styles.caption, { color: c.muted }]}>0–{number(Math.max(0, ...model.selected.map(j => Number.isFinite(j.miles) ? j.miles : 0)), 1)} mi · 0–{number(Math.max(0, ...model.selected.map(j => Number.isFinite(j.durationMinutes) ? j.durationMinutes : 0)))} min</Text>
  </Panel>;
  const musicPanel = <Panel testID="statistics-music-panel" title="Music totals" subtitle="Distinct entries in saved journey soundtracks" accent={c.rose} fill>
    {[['Unique tracks', model.totals.uniqueTracks, c.rose], ['Artists', model.totals.uniqueArtists, c.blue], ['Albums', model.totals.uniqueAlbums, c.teal]].map(([label, value, color]) => <StatLine key={String(label)} label={String(label)} value={number(Number(value))} color={String(color)} />)}
  </Panel>;
  const atlasCard = <Pressable accessibilityRole="button" accessibilityLabel="Open Atlas" onPress={onAtlas ?? onUpgrade}
    style={({ pressed }) => [styles.featureCard, compact && styles.compactFeatureCard, { borderColor: `${c.accent}${c.isLight ? '88' : 'cc'}`, opacity: pressed ? .75 : 1 }, neonGlow(c.accent, c.isLight, 7)]}>
    <StatisticsGlass radius={compact ? 20 : 24} reduceTransparency={motion.reduceTransparency} />
    <Text style={[styles.featureEyebrow, { color: c.accent }]}>YOUR PRIVATE INTELLIGENCE · PLUS</Text>
    <Text style={[styles.featureTitle, compact && styles.compactFeatureTitle, { color: c.text }]}>Atlas ↗</Text>
    <Text style={[styles.featureBody, { color: c.muted }]}>Discover your routes, driving rhythms, and the places that connect them.</Text>
  </Pressable>;
  const yearCard = onYearOnRoad ? <Pressable accessibilityRole="button" accessibilityLabel="Your Year on the Road. JourneyDeck Plus" onPress={onYearOnRoad}
    style={({ pressed }) => [styles.featureCard, compact && styles.compactFeatureCard, { borderColor: `${c.accent}${c.isLight ? '88' : 'cc'}`, opacity: pressed ? .75 : 1 }, neonGlow(c.accent, c.isLight, 7)]}>
    <StatisticsGlass radius={compact ? 20 : 24} reduceTransparency={motion.reduceTransparency} />
    <Text style={[styles.featureEyebrow, { color: c.accent }]}>YOUR PERSONAL PREMIERE · PLUS</Text>
    <Text style={[styles.featureTitle, compact && styles.compactFeatureTitle, { color: c.text }]}>Your Year on the Road ↗</Text>
    <Text style={[styles.featureBody, { color: c.muted }]}>The miles. The music. The moments. Play your story in any theme.</Text>
  </Pressable> : null;
  return <StatisticsMotionProvider><SafeAreaView edges={compact ? ['top', 'left', 'right'] : ['left', 'right']} style={{ flex: 1, backgroundColor: c.page }}>
    <ScrollView testID="ipad-statistics" contentInsetAdjustmentBehavior={compact ? 'never' : 'automatic'} contentContainerStyle={{ padding: compact ? 16 : 24, paddingTop: 18, paddingBottom: insets.bottom + (compact ? 112 : 28) }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={c.accent} />}>
      <View testID="ipad-statistics-canvas" onLayout={event => setWidth(event.nativeEvent.layout.width)} style={styles.canvas}>
        <IpadPageHeader compact={compact} title="Statistics" width={width} artwork={compact ? undefined : require('../assets/cinematic-statistics-photo-v1.jpg')} subtitle={compact ? undefined : 'Every mile. Every journey. Your numbers.'} split={compact ? undefined : headerFoldColumns}>{compact ? undefined : rangeSelector}</IpadPageHeader>
        {compact ? rangeSelector : null}
        {compact ? compactSectionSelector : atlasCard}
        {state.status === 'error' ? <View accessibilityRole="alert"><Text style={{ color: c.muted }}>{state.message || 'Statistics could not refresh. Saved data remains available.'}</Text><Button label="Try again" onPress={onRefresh} /></View> : null}
        {!state.data ? state.status === 'loading' ? <ActivityIndicator accessibilityLabel="Loading statistics" color={c.accent} /> : <Text style={{ color: c.muted }}>Statistics are unavailable. Try refreshing.</Text> : <>
          <Text style={[styles.caption, { color: c.muted }]}>{dateLabel(model.start)} – {dateLabel(model.end)} · By journey start date{historyDays === null ? '' : ` · ${historyDays}-day history`}</Text>
          {!model.selected.length ? <Text style={[styles.body, { color: c.muted }]}>No journeys in this period. Your recorded journeys will populate this dashboard.</Text> : null}
          {compact && compactSection === 'overview' ? <>
            <Panel testID="statistics-overview-hero" title="Period overview" subtitle={model.selected.length ? metricComparison(metrics[0]) : 'Ready for your next recorded journey'} accent={c.coral}>
              <View testID="statistics-metric-miles" style={styles.heroMetric}><View><Text style={[styles.caption, { color: c.muted }]}>Total miles</Text>
                <StatisticsRollingValue style={[styles.heroValue, { color: c.text }]} value={metrics[0].format(model.totals.miles)} /></View>
                <SymbolView name="road.lanes" tintColor={c.coral} style={{ width: 28, height: 28 }} /></View>
              {model.selected.length ? <Bars keys={model.days.map(d => d.key)} selectedKey={focus} values={model.days.map(d => d.miles)} labels={model.days.map(d => localDay(d.key).toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' }))} unit="miles" onSelect={i => { chooseDay(model.days[i].key); setCompactSection('days'); }} />
                : <Text style={[styles.caption, { color: c.muted }]}>Daily distance will appear here after a journey is saved.</Text>}
            </Panel>
            <View testID="statistics-widgets" style={styles.row}>{metrics.slice(1).map(metric => compactMetricCard(metric, width ? (width - 12) / 2 : '100%'))}</View>
            {atlasCard}
          </> : !compact ? <View testID="statistics-widgets" style={foldColumns ? { flexDirection: 'row', gap: foldColumns.gap, alignItems: 'flex-start' } : styles.row}>{foldColumns
            ? <>{foldMetricPane(metrics.slice(0, 3), foldColumns.beforeWidth)}{foldMetricPane(metrics.slice(3), foldColumns.afterWidth)}</>
            : metrics.map(metric => metricCard(metric, width ? (width - (columns - 1) * 12) / columns : '100%'))}</View> : null}
          {(!compact || compactSection === 'days') ? <Panel title="Your days, in detail" subtitle="Select a day to see its totals and journeys." accent={c.amber}>
            <View testID="statistics-calendar-layout" style={{ flexDirection: wide ? 'row' : 'column', gap: paneGap ?? IPAD_GRID_GAP }}>
              <View testID="statistics-calendar-panel" style={foldColumns ? beforePane : { width: wide ? panelSpan(4) : '100%', minWidth: 0 }}>
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
              <StatisticsMotionFrame testID="statistics-day-panel" style={foldColumns ? [afterPane, { gap: 12 }] : { width: wide ? panelSpan(2) : '100%', minWidth: 0, gap: 12 }}><Text accessibilityRole="header" style={[styles.heading, { color: theme.id === 'midnight-canopy' ? c.teal : c.text }, theme.id === 'midnight-canopy' && { borderLeftWidth: 4, borderLeftColor: theme.palette.rose, paddingLeft: 10 }]}>{dateLabel(localDay(focus))}</Text>
                <View style={styles.row}>{metrics.filter(m => m.key !== 'activeDays').map(metric => <View key={metric.key} style={{ minWidth: 90, flexGrow: 1 }}><Text style={[styles.caption, { color: theme.id === 'midnight-canopy' ? c.teal : c.muted }]}>{metric.title}</Text><StatisticsRollingValue style={[styles.body, { color: c.text }]} value={metric.format(daily[metric.key])} /></View>)}</View>
                <StatisticsDayJourneys selectionKey={focus}>
                {dailyJourneys.length ? dailyJourneys.slice(0, dayCount).map(journey => <JourneyRow key={journey.id} journey={journey} onJourney={onJourney} />) : <Text style={{ color: c.muted }}>No journeys recorded this day.</Text>}
                {dailyJourneys.length > dayCount ? <Button label="More journeys this day" onPress={() => setDayCount(n => n + 10)} /> : null}
                {daily.partialMusic ? <Text style={[styles.caption, { color: c.muted }]}>Music totals include available details only.</Text> : null}
                </StatisticsDayJourneys>
              </StatisticsMotionFrame>
            </View>
          </Panel> : null}
          {!compact ? <StatisticsMotionFrame testID="statistics-distance-layout" style={{ flexDirection: wide ? 'row' : 'column', gap: paneGap ?? IPAD_GRID_GAP }}><View testID="statistics-distance-panel" style={foldColumns ? beforePane : { width: wide ? span(4) : '100%', minWidth: 0 }}><Panel title="Daily distance" subtitle="Miles per day · tap a bar to select its date" accent={theme.id === 'redline' ? c.green : c.coral} fill>
            <Bars keys={model.days.map(d => d.key)} selectedKey={focus} values={model.days.map(d => d.miles)} labels={model.days.map(d => localDay(d.key).toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' }))} unit="miles" onSelect={i => chooseDay(model.days[i].key)} />
          </Panel></View><View testID="statistics-breakdown-panel" style={foldColumns ? afterPane : { width: wide ? span(2) : '100%', minWidth: 0 }}><Panel title="Distance breakdown" subtitle="Journeys by distance" accent={c.teal} fill>
            {model.bands.map((band, index) => <View key={band.label} style={{ gap: 7, marginVertical: 8 }}><Text style={{ color: c.text }}>{band.label} · {band.count} journeys ({number(band.count / Math.max(1, model.totals.journeys) * 100)}%)</Text><View style={{ height: 6, backgroundColor: c.inset, borderRadius: 3 }}><StatisticsBar horizontal fraction={band.count / Math.max(1, model.totals.journeys)} color={rangeColors[index]} /></View></View>)}
          </Panel></View></StatisticsMotionFrame> : compactSection === 'insights' ? <Panel testID="statistics-breakdown-panel" title="Distance breakdown" subtitle="Journeys by distance" accent={c.teal}>
            {model.bands.map((band, index) => <View key={band.label} style={{ gap: 7, marginVertical: 8 }}><Text style={{ color: c.text }}>{band.label} · {band.count} journeys ({number(band.count / Math.max(1, model.totals.journeys) * 100)}%)</Text><View style={{ height: 6, backgroundColor: c.inset, borderRadius: 3 }}><StatisticsBar horizontal fraction={band.count / Math.max(1, model.totals.journeys)} color={rangeColors[index]} /></View></View>)}
          </Panel> : null}
          {(!compact || compactSection === 'insights') ? <StatisticsMotionFrame testID="statistics-analysis-row" style={{ flexDirection: wide ? 'row' : 'column', alignItems: 'stretch', gap: paneGap ?? IPAD_GRID_GAP }}>
            <View style={foldColumns ? beforePane : { width: wide ? span(2) : '100%', minWidth: 0 }}>{hourlyPanel}</View>
            {foldColumns ? <View style={[afterPane, { gap: 16 }]}><View>{scatterPanel}</View><View>{musicPanel}</View></View>
              : <><View style={{ width: wide ? span(2) : '100%', minWidth: 0 }}>{scatterPanel}</View><View style={{ width: wide ? span(2) : '100%', minWidth: 0 }}>{musicPanel}</View></>}
          </StatisticsMotionFrame> : null}
          {(!compact || compactSection === 'overview' || compactSection === 'insights') ? <StatisticsMotionFrame testID="statistics-bottom-layout" style={{ flexDirection: wide ? 'row' : 'column', alignItems: 'stretch', gap: paneGap ?? IPAD_GRID_GAP }}>
            {(!compact || compactSection === 'overview') ? <View testID="statistics-recent-panel" style={foldColumns ? beforePane : { width: wide ? span(4) : '100%', minWidth: 0 }}><Panel title="Recent journeys" subtitle={`${model.selected.length} journeys in this period · newest first`} accent={c.blue} fill>
              {model.selected.slice(0, recentCount).map(journey => <JourneyRow key={journey.id} journey={journey} onJourney={onJourney} />)}
              {model.selected.length > recentCount ? <Button label="Show more journeys" accent={c.blue} onPress={() => setRecentCount(n => n + 20)} /> : null}
            </Panel></View> : null}
            <View testID="statistics-bottom-widgets" style={foldColumns ? [afterPane, { gap: 16 }] : { width: wide ? span(2) : '100%', minWidth: 0, gap: IPAD_GRID_GAP }}>
              {(!compact || compactSection === 'insights') ? <Panel title="Journey averages" subtitle="Simple totals divided by journey count" accent={c.teal}>
                <StatLine label="Miles per journey" value={`${number(model.totals.miles / journeyCount, 1)} mi`} color={c.coral} />
                <StatLine label="Time per journey" value={duration(model.totals.drivingMinutes / journeyCount)} color={c.teal} />
                <StatLine label="Plays per journey" value={number(model.totals.plays / journeyCount, 1)} color={c.rose} />
              </Panel> : null}
              <Panel title="Record book" subtitle="Highest recorded values in this period" accent={theme.id === 'redline' ? c.green : c.amber} reduceTransparency={motion.reduceTransparency}>
                <StatLine label="Longest distance" value={longestDistance ? `${number(Math.max(0, longestDistance.miles || 0), 1)} mi` : '—'} color={c.coral} />
                <StatLine label="Longest drive" value={longestDuration ? duration(Math.max(0, longestDuration.durationMinutes || 0)) : '—'} color={c.amber} />
                <StatLine label="Most plays" value={mostMusic ? number(Math.max(0, mostMusic.songCount || 0)) : '—'} color={c.rose} />
              </Panel>
              {(!compact || compactSection === 'insights') ? <Panel title="Activity split" subtitle="Recorded days and journey counts" accent={c.green} reduceTransparency={motion.reduceTransparency}>
                <StatLine label="Weekday journeys" value={number(weekdayJourneys)} color={c.blue} />
                <StatLine label="Weekend journeys" value={number(weekendJourneys)} color={c.green} />
                <StatLine label="Days without journeys" value={number(quietDays)} color={c.muted} />
              </Panel> : null}
            </View>
          </StatisticsMotionFrame> : null}
          {(!compact || compactSection === 'insights') ? <Text style={[styles.caption, { color: c.muted }]}>Listening time sums saved song durations, not measured playback. {model.totals.partialMusic ? 'Some music details or durations are missing; listening and distinct music totals are partial. ' : ''}All music is grouped by its journey’s start date. Sparklines show up to 90 days. Comparisons use the preceding equal-length period when accessible.</Text> : null}
        </>}
        {TESSIE_INTEGRATION_ENABLED && tessieStatistics && (!compact || compactSection === 'tessie')
          ? <TessieStatisticsPanels statistics={tessieStatistics} connection={tessieConnection} onJourney={onJourney} wide={wide} span={span} /> : null}
        {(!compact || compactSection === 'overview') ? yearCard : null}
      </View>
    </ScrollView>
  </SafeAreaView></StatisticsMotionProvider>;
}

const styles = StyleSheet.create({
  canvas: { width: '100%', maxWidth: 1600, alignSelf: 'center', gap: 18 },
  canvasCompact: { gap: 16 },
  panel: { borderWidth: 1, borderRadius: 20, padding: 18, gap: 12 },
  fill: { flex: 1 },
  heading: { fontSize: 20, fontWeight: '600' }, body: { fontSize: 15, lineHeight: 22 }, caption: { fontSize: 12, lineHeight: 18 }, tiny: { fontSize: 10, lineHeight: 15 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, alignItems: 'center' },
  button: { minHeight: 44, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  growButton: { flexBasis: '45%', flexGrow: 1 },
  rangeGrid: { width: '100%', alignItems: 'stretch' },
  rangeRow: { flexWrap: 'nowrap', gap: 8 },
  rangeButton: { flex: 1, minWidth: 0 },
  sectionSelector: { width: '100%', flexDirection: 'row', flexWrap: 'nowrap', gap: 8, alignItems: 'stretch' },
  sectionButton: { flex: 1, minWidth: 0 },
  metric: { height: 200, padding: 14, borderWidth: 1, borderRadius: 18, gap: 8 },
  compactMetric: { minHeight: 102, padding: 14, borderWidth: 1, borderRadius: 18, gap: 10, justifyContent: 'space-between' },
  compactMetricTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  compactValue: { fontSize: 22, fontWeight: '700', fontVariant: ['tabular-nums'] },
  heroMetric: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroValue: { fontSize: 36, lineHeight: 42, fontWeight: '700', fontVariant: ['tabular-nums'] },
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
  featureCard: { borderRadius: 24, padding: 24, borderWidth: 1, overflow: 'hidden', gap: 8 },
  compactFeatureCard: { borderRadius: 20, padding: 18 },
  featureEyebrow: { fontSize: 10, fontWeight: '800', letterSpacing: 2 },
  featureTitle: { fontSize: 25, fontWeight: '800' },
  compactFeatureTitle: { fontSize: 21 },
  featureBody: { fontSize: 14, lineHeight: 20 },
});
