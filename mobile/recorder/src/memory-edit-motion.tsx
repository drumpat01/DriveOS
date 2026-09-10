import { useEffect, useRef, useState } from 'react';
import { Text, View, StyleSheet, type StyleProp, type TextStyle } from 'react-native';
import Animated, { FadeInDown, FadeOut, LinearTransition } from 'react-native-reanimated';
import { useThemedStyles } from './app-theme';
import { MOTION_DURATIONS, motionEasing, useMotionPreferences } from './motion';
import { TouchPressable } from './touch-feedback';

type JourneyChoice = { id: string; title: string; detail: string };

/** Only draft membership changes here; saving retains the existing local write boundary. */
export function MemoryJourneyEditor({ journeys, selectedIds, onToggle, disabled = false }: {
  journeys: JourneyChoice[]; selectedIds: string[]; onToggle: (id: string) => void; disabled?: boolean;
}) {
  const styles = useThemedStyles(baseStyles);
  const { reduceMotion, isAppActive } = useMotionPreferences();
  const mounted = useRef(false);
  useEffect(() => { mounted.current = true; }, []);
  const animate = !reduceMotion && isAppActive;
  const layout = animate ? LinearTransition.duration(MOTION_DURATIONS.standard).easing(motionEasing.standard) : undefined;
  const byId = new Map(journeys.map(journey => [journey.id, journey]));
  const selected = [...new Set(selectedIds)].flatMap(id => { const journey = byId.get(id); return journey ? [journey] : []; });
  const available = journeys.filter(journey => !selectedIds.includes(journey.id));
  const hiddenCount = new Set(selectedIds).size - selected.length;
  const row = (journey: JourneyChoice, included: boolean) => <Animated.View key={journey.id} collapsable={false} layout={layout}
    entering={animate && mounted.current ? FadeInDown.duration(MOTION_DURATIONS.standard).easing(motionEasing.enter).withInitialValues({ opacity: 0, transform: [{ translateY: 12 }] }) : undefined}
    exiting={animate ? FadeOut.duration(MOTION_DURATIONS.exit) : undefined}>
    <TouchPressable accessibilityRole="button" accessibilityLabel={`${included ? 'Remove' : 'Add'} ${journey.title} ${included ? 'from' : 'to'} Memory`}
      accessibilityState={{ selected: included, disabled }} disabled={disabled} onPress={() => onToggle(journey.id)} style={[styles.row, included && styles.included]}>
      <View style={styles.copy}><Text style={styles.title}>{journey.title}</Text><Text style={styles.detail}>{journey.detail}</Text></View>
      <Text accessible={false} style={styles.action}>{included ? '−' : '+'}</Text>
    </TouchPressable>
  </Animated.View>;
  return <Animated.View layout={layout} style={styles.section}>
    <Text style={styles.heading}>IN THIS MEMORY · {new Set(selectedIds).size}</Text>
    <View collapsable={false} style={styles.collection}>
      {selected.map(journey => row(journey, true))}
      {!selectedIds.length && <Animated.View layout={layout}><Text style={styles.detail}>Choose a journey below to start this collection.</Text></Animated.View>}
      {hiddenCount > 0 && <Text style={styles.detail}>{hiddenCount} older {hiddenCount === 1 ? 'journey is' : 'journeys are'} also kept in this Memory.</Text>}
    </View>
    <Animated.View layout={layout} style={styles.section}>
      <Text style={styles.heading}>ADD JOURNEYS</Text>
      {available.map(journey => row(journey, false))}
      {!available.length && <Text style={styles.detail}>All available journeys are in this Memory.</Text>}
    </Animated.View>
  </Animated.View>;
}

/** A confirmed persistence result triggers the check, never the save press itself. */
export function MemorySaveLabel({ saving, dirty, successVersion, style }: {
  saving: boolean; dirty: boolean; successVersion: number; style?: StyleProp<TextStyle>;
}) {
  const { reduceMotion, isAppActive } = useMotionPreferences();
  const [showCheck, setShowCheck] = useState(false);
  const shownVersion = useRef(0);
  useEffect(() => {
    if (!successVersion || saving || dirty || !isAppActive) { setShowCheck(false); return; }
    if (shownVersion.current === successVersion) return;
    shownVersion.current = successVersion;
    setShowCheck(true);
    const timer = setTimeout(() => setShowCheck(false), 1200);
    return () => clearTimeout(timer);
  }, [successVersion, saving, dirty, isAppActive]);
  return <View accessibilityLiveRegion="polite" accessible accessibilityLabel={saving ? 'Saving Memory' : dirty ? 'Save Memory' : 'Memory saved'}>
    {showCheck ? <Animated.Text key={successVersion} accessible={false} entering={!reduceMotion && isAppActive ? FadeInDown.duration(MOTION_DURATIONS.quick).withInitialValues({ opacity: 0, transform: [{ translateY: 5 }] }) : undefined} style={style}>✓ SAVED</Animated.Text>
      : <Text accessible={false} style={style}>{saving ? 'SAVING…' : dirty ? 'SAVE' : 'SAVED'}</Text>}
  </View>;
}

const baseStyles = StyleSheet.create({
  section: { gap: 10 }, collection: { gap: 8, paddingBottom: 8 },
  heading: { color: '#a18ab8', fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  row: { minHeight: 64, padding: 12, borderRadius: 16, borderWidth: 1, borderColor: '#33283d', backgroundColor: '#14101b', flexDirection: 'row', alignItems: 'center', gap: 12 },
  included: { borderColor: '#755293', backgroundColor: '#241731' },
  copy: { flex: 1, gap: 4 }, title: { color: '#f5eff9', fontSize: 13, fontWeight: '700' }, detail: { color: '#a69aac', fontSize: 11, lineHeight: 17 }, action: { color: '#c3a5ff', fontSize: 24, fontWeight: '600' },
});
