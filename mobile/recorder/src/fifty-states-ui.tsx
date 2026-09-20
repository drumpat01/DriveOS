import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SymbolView } from 'expo-symbols';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { useAppTheme } from './app-theme';
import { getCurrentUser } from './auth';
import { US_STATES_MAP_VIEW_BOX, US_STATES_MAP_ASPECT_RATIO, US_STATE_PATHS } from './fifty-states-map-data';
import { filterUSStates, US_STATES, type FiftyStatesFilter, type USStateCode } from './fifty-states-model';
import { useFiftyStates } from './fifty-states-store';
import { MedallionArtworkImage } from './medallion-artwork-image';
import { V3_FIFTY_STATES_ENABLED } from './release-features';
import { haptics } from './haptics';

const FILTERS: readonly { id: FiftyStatesFilter; label: string }[] = [
  { id: 'all', label: 'All' }, { id: 'seen', label: 'Seen' }, { id: 'remaining', label: 'Remaining' },
];

function mapColors(theme: ReturnType<typeof useAppTheme>) {
  return {
    seen: theme.palette.accent,
    seenBorder: theme.palette.onAccent,
    unseen: theme.palette.inset,
    unseenBorder: theme.palette.line,
  };
}

export function FiftyStatesMap({ seen, compact = false, onToggle }: { seen: readonly USStateCode[]; compact?: boolean; onToggle?: (code: USStateCode) => void }) {
  const theme = useAppTheme();
  const selected = useMemo(() => new Set(seen), [seen]);
  const colors = mapColors(theme);
  return <View accessible={false} importantForAccessibility={compact ? 'no-hide-descendants' : 'auto'} style={[styles.map, compact && styles.mapCompact]}>
    <Svg accessibilityLabel={compact ? undefined : 'Interactive map of the United States'} viewBox={US_STATES_MAP_VIEW_BOX} width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
      {US_STATES.map(([code, name]) => {
      const checked = selected.has(code);
        return <Path
          key={code}
          accessibilityLabel={onToggle ? `${name}, ${checked ? 'seen' : 'not seen'}` : undefined}
          d={US_STATE_PATHS[code]}
          fill={checked ? colors.seen : colors.unseen}
          onPress={onToggle ? () => onToggle(code) : undefined}
          stroke={checked ? colors.seenBorder : colors.unseenBorder}
          strokeLinejoin="round"
          strokeWidth={compact ? 0.55 : 0.75}
          vectorEffect="non-scaling-stroke"
        />;
      })}
    </Svg>
  </View>;
}

export function FiftyStatesHomeWidget({ userId, onPress, onLongPress, dense = false, disabled = false }: { userId: string; onPress: () => void; onLongPress?: () => void; dense?: boolean; disabled?: boolean }) {
  const theme = useAppTheme();
  const { seen } = useFiftyStates(userId);
  const remaining = 50 - seen.length;
  return <Pressable testID="fifty-states-home-widget" accessibilityRole="button" accessibilityLabel={`50 States, ${seen.length} of 50 states spotted, ${remaining} remaining`} accessibilityHint={onLongPress ? 'Opens the manual state checklist. Long press to edit Home.' : 'Opens the manual state checklist'} disabled={disabled} onPress={onPress} onLongPress={onLongPress} delayLongPress={1000}
    style={({ pressed }) => [styles.homeWidget, { backgroundColor: theme.palette.card, borderColor: theme.palette.line }, pressed && !disabled && styles.pressed]}>
    <View style={styles.homeWidgetHeader}><View><Text style={[styles.homeWidgetTitle, { color: theme.id === 'midnight-canopy' ? theme.palette.teal : theme.palette.text }]}>50 States</Text><Text style={[styles.homeWidgetSubtitle, { color: theme.palette.accent }]}>Different roads. A bigger story.</Text></View><SymbolView name="chevron.right" tintColor={theme.palette.accent} size={18} /></View>
    {dense ? <View style={styles.homeWidgetCompactBody}><View style={styles.homeWidgetMiniMap}><FiftyStatesMap seen={seen} compact /></View><View style={styles.homeWidgetProgress}><Text style={[styles.homeWidgetLabel, { color: theme.palette.muted }]}>STATES SPOTTED</Text><Text style={[styles.homeWidgetValue, { color: theme.palette.text }]}><Text style={{ color: theme.palette.accent }}>{seen.length}</Text> of 50</Text><View style={[styles.progressTrack, { backgroundColor: theme.palette.inset }]}><View style={[styles.progressFill, { width: `${seen.length * 2}%`, backgroundColor: theme.palette.accent }]} /></View></View><View style={[styles.remaining, { borderLeftColor: theme.palette.line }]}><Text style={[styles.remainingValue, { color: theme.palette.text }]}>{remaining}</Text><Text style={[styles.homeWidgetLabel, { color: theme.palette.muted }]}>remaining</Text></View></View> : <><FiftyStatesMap seen={seen} compact /><View style={styles.homeWidgetStats}><View style={styles.homeWidgetProgress}><Text style={[styles.homeWidgetLabel, { color: theme.palette.muted }]}>STATES SPOTTED</Text><Text style={[styles.homeWidgetValue, { color: theme.palette.text }]}><Text style={{ color: theme.palette.accent }}>{seen.length}</Text> of 50</Text><View style={[styles.progressTrack, { backgroundColor: theme.palette.inset }]}><View style={[styles.progressFill, { width: `${seen.length * 2}%`, backgroundColor: theme.palette.accent }]} /></View></View><View style={[styles.remaining, { borderLeftColor: theme.palette.line }]}><Text style={[styles.remainingValue, { color: theme.palette.text }]}>{remaining}</Text><Text style={[styles.homeWidgetLabel, { color: theme.palette.muted }]}>remaining</Text></View></View></>}
  </Pressable>;
}

export function FiftyStatesScreen() {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const { width, fontScale } = useWindowDimensions();
  const userId = getCurrentUser().id;
  const { seen, completedAt, toggle, reset } = useFiftyStates(userId);
  const [filter, setFilter] = useState<FiftyStatesFilter>('all');
  const states = useMemo(() => filterUSStates(seen, filter), [filter, seen]);
  const selected = useMemo(() => new Set(seen), [seen]);
  const columns = width >= 700 ? 4 : width >= 360 && fontScale <= 1.2 ? 3 : 2;
  const remaining = 50 - seen.length;
  if (!V3_FIFTY_STATES_ENABLED) return <View style={[styles.unavailable, { paddingTop: insets.top, backgroundColor: theme.palette.page }]}><Text style={{ color: theme.palette.text }}>50 States is available only in the JourneyDeck V3 preview.</Text><Pressable accessibilityRole="button" onPress={() => router.back()}><Text style={{ color: theme.palette.accent }}>Go back</Text></Pressable></View>;
  const toggleState = (code: USStateCode) => { toggle(code); void haptics.selection(); };
  return <View style={[styles.screen, { backgroundColor: theme.palette.page }]}>
    <LinearGradient colors={theme.gradient([theme.palette.page, theme.palette.card, theme.palette.page])} locations={[0, 0.42, 1]} style={StyleSheet.absoluteFill} />
    <ScrollView contentInsetAdjustmentBehavior="never" contentContainerStyle={[styles.content, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 36 }]}>
      <View style={styles.header}><Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} style={[styles.iconButton, { backgroundColor: theme.palette.card, borderColor: theme.palette.line }]}><SymbolView name="chevron.left" tintColor={theme.palette.text} size={20} /></Pressable><View style={styles.headerCopy}><Text accessibilityRole="header" style={[styles.title, { color: theme.palette.text }]}>50 States</Text><Text style={[styles.subtitle, { color: theme.palette.accent }]}>Different roads. A bigger story.</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Reset 50 States checklist" onPress={() => Alert.alert('Reset all 50 states?', 'This clears every checked state for this JourneyDeck profile.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Reset', style: 'destructive', onPress: reset }])} style={[styles.iconButton, { backgroundColor: theme.palette.card, borderColor: theme.palette.line }]}><SymbolView name="arrow.counterclockwise" tintColor={theme.palette.muted} size={19} /></Pressable></View>
      <View style={[styles.mapCard, { backgroundColor: theme.palette.card, borderColor: theme.palette.line }]}><FiftyStatesMap seen={seen} onToggle={toggleState} /></View>
      <View style={[styles.statsCard, { backgroundColor: theme.palette.card, borderColor: theme.palette.line }]}><View style={styles.statsMain}><Text style={[styles.statsLabel, { color: theme.palette.muted }]}>States Spotted</Text><Text style={[styles.statsValue, { color: theme.palette.text }]}><Text style={{ color: theme.palette.accent }}>{seen.length}</Text> of 50</Text><View style={[styles.progressTrack, { backgroundColor: theme.palette.inset }]}><View style={[styles.progressFill, { width: `${seen.length * 2}%`, backgroundColor: theme.palette.accent }]} /></View></View><View style={styles.statsSide}><View><Text style={[styles.statsCount, { color: theme.palette.text }]}>{seen.length}</Text><Text style={[styles.statsSideLabel, { color: theme.palette.muted }]}>Seen</Text></View><View style={[styles.statsDivider, { backgroundColor: theme.palette.line }]} /><View><Text style={[styles.statsCount, { color: theme.palette.text }]}>{remaining}</Text><Text style={[styles.statsSideLabel, { color: theme.palette.muted }]}>Remaining</Text></View></View></View>
      {completedAt ? <View testID="fifty-states-medallion-earned" accessibilityLiveRegion="polite" style={[styles.awardCard, { backgroundColor: theme.palette.card, borderColor: theme.palette.accent }]}>
        <MedallionArtworkImage achievementId="all-fifty" themeId={theme.id} label="All 50 medallion earned" style={{ width: 108, height: 108 }} />
        <Text accessibilityRole="header" style={[styles.awardTitle, { color: theme.palette.text }]}>All 50. A collection complete.</Text>
        <Text style={[styles.awardCopy, { color: theme.palette.muted }]}>Your All 50 medallion is now in Medallions. Earned {new Date(completedAt).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}. It stays yours when you start a new checklist.</Text>
      </View> : null}
      <View accessibilityRole="tablist" style={[styles.filters, { backgroundColor: theme.palette.card, borderColor: theme.palette.line }]}>{FILTERS.map(item => <Pressable key={item.id} accessibilityRole="tab" accessibilityState={{ selected: filter === item.id }} onPress={() => setFilter(item.id)} style={[styles.filter, filter === item.id && { backgroundColor: theme.palette.accent }]}><Text style={[styles.filterText, { color: filter === item.id ? theme.palette.onAccent : theme.palette.text }]}>{item.label}</Text></Pressable>)}</View>
      <View style={styles.stateGrid}>{states.map(([code, name]) => {
        const checked = selected.has(code);
        return <View key={code} style={{ width: `${100 / columns}%`, padding: 5 }}><Pressable accessibilityRole="checkbox" accessibilityState={{ checked }} accessibilityLabel={`${name}, ${checked ? 'seen' : 'not seen'}`} accessibilityHint="Double tap to change this state" onPress={() => toggleState(code)} style={({ pressed }) => [styles.stateCard, { backgroundColor: checked ? theme.palette.inset : theme.palette.card, borderColor: checked ? theme.palette.accent : theme.palette.line }, pressed && styles.pressed]}><View style={styles.stateCardTop}><Text style={[styles.stateCode, { color: theme.palette.text }]}>{code}</Text><View style={[styles.check, { backgroundColor: checked ? theme.palette.accent : 'transparent', borderColor: checked ? theme.palette.accent : theme.palette.muted }]}>{checked && <SymbolView name="checkmark" tintColor={theme.palette.onAccent} size={12} weight="bold" />}</View></View><Text numberOfLines={2} style={[styles.stateName, { color: checked ? theme.palette.text : theme.palette.muted }]}>{name}</Text></Pressable></View>;
      })}</View>
      <Text style={[styles.safety, { color: theme.palette.muted }]}>Update this checklist only while parked or as a passenger. JourneyDeck stores checked states and your completion date privately on this device—never a plate number, image, vehicle identity, or sighting location.</Text>
    </ScrollView>
  </View>;
}

const styles = StyleSheet.create({
  awardCard: { borderRadius: 24, borderWidth: 1, padding: 20, gap: 12, alignItems: 'center' },
  awardTitle: { fontFamily: 'Georgia', fontSize: 24, textAlign: 'center' },
  awardCopy: { fontSize: 14, lineHeight: 21, textAlign: 'center', maxWidth: 520 },
  screen: { flex: 1 }, content: { paddingHorizontal: 16, gap: 14 }, unavailable: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 18, padding: 24 },
  header: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 12 }, headerCopy: { flex: 1 }, title: { fontFamily: 'Georgia', fontSize: 34, fontWeight: '700' }, subtitle: { fontSize: 14, marginTop: 2 },
  iconButton: { width: 44, height: 44, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  mapCard: { borderRadius: 24, borderWidth: 1, padding: 8, overflow: 'hidden' }, map: { width: '100%', aspectRatio: US_STATES_MAP_ASPECT_RATIO }, mapCompact: { marginVertical: 4 },
  statsCard: { minHeight: 130, borderRadius: 24, borderWidth: 1, padding: 18, flexDirection: 'row', alignItems: 'center', gap: 20 }, statsMain: { flex: 1, gap: 7 }, statsLabel: { fontSize: 15 }, statsValue: { fontFamily: 'Georgia', fontSize: 35, fontWeight: '700' }, progressTrack: { height: 8, borderRadius: 8, overflow: 'hidden' }, progressFill: { height: '100%', borderRadius: 8 },
  statsSide: { flexDirection: 'row', alignItems: 'center', gap: 16 }, statsDivider: { width: StyleSheet.hairlineWidth, height: 58 }, statsCount: { fontFamily: 'Georgia', fontSize: 28, textAlign: 'center' }, statsSideLabel: { fontSize: 11, textAlign: 'center' },
  filters: { flexDirection: 'row', padding: 4, borderRadius: 20, borderWidth: 1 }, filter: { flex: 1, minHeight: 44, borderRadius: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 }, filterText: { fontSize: 14, fontWeight: '700' },
  stateGrid: { flexDirection: 'row', flexWrap: 'wrap', margin: -5 }, stateCard: { minHeight: 102, borderRadius: 18, borderWidth: 1, padding: 13, justifyContent: 'space-between' }, stateCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, stateCode: { fontFamily: 'Georgia', fontSize: 24, fontWeight: '700' }, stateName: { fontSize: 12, lineHeight: 16 }, check: { width: 24, height: 24, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' }, safety: { fontSize: 12, lineHeight: 18, paddingHorizontal: 8, paddingTop: 8 },
  homeWidget: { borderRadius: 24, borderWidth: 1, padding: 18, gap: 10, flexGrow: 1 }, homeWidgetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }, homeWidgetTitle: { fontFamily: 'Georgia', fontSize: 25, fontWeight: '700' }, homeWidgetSubtitle: { fontSize: 12, marginTop: 2 }, homeWidgetStats: { flexDirection: 'row', alignItems: 'flex-end', gap: 14 }, homeWidgetCompactBody: { flexDirection: 'row', alignItems: 'center', gap: 12 }, homeWidgetMiniMap: { width: 104, minWidth: 104 }, homeWidgetProgress: { flex: 1, gap: 5 }, homeWidgetLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.6 }, homeWidgetValue: { fontFamily: 'Georgia', fontSize: 26, fontWeight: '700' }, remaining: { minWidth: 72, borderLeftWidth: StyleSheet.hairlineWidth, paddingLeft: 14, alignItems: 'center' }, remainingValue: { fontFamily: 'Georgia', fontSize: 28 }, pressed: { opacity: 0.72, transform: [{ scale: 0.99 }] },
});
