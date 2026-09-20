import { BottomSheet, RNHostView } from '@expo/ui';
import { useEffect, useMemo, useState } from 'react';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring } from 'react-native-reanimated';
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import { TouchPressable as Pressable } from './touch-feedback';
import { useAppTheme } from './app-theme';
import { JourneyDeckMedallion } from '../modules/journeydeck-keepsakes';
import { isApprovedMedallion } from './medallion-artwork';
import { MedallionArtworkImage } from './medallion-artwork-image';
import type { JourneyMemory, JourneySummary } from './app-data';
import { useFiftyStates } from './fifty-states-store';
import { V3_FIFTY_STATES_ENABLED } from './release-features';

type AchievementId = 'first-track' | 'long-way-home' | 'thousand-mile' | 'grand-tourer' | 'first-note' | 'long-play' | 'soundtrack-100' | 'memory-maker' | 'picture-this' | 'story-collector' | 'all-fifty';

type AchievementDefinition = {
  id: AchievementId;
  name: string;
  symbol: SFSymbol;
  how: string;
  why: string;
};

type Achievement = AchievementDefinition & {
  earned: boolean;
  earnedAt: string | null;
  earnedReason: string;
};

const definitions: AchievementDefinition[] = [
  { id: 'first-track', name: 'The First Track', symbol: 'road.lanes', how: 'Complete and save your first journey.', why: 'Every road story needs a first chapter.' },
  { id: 'long-way-home', name: 'Long Way Home', symbol: 'signpost.right.and.left.fill', how: 'Complete a journey longer than 25 miles.', why: 'One long stretch of road can turn an ordinary drive into a story worth keeping.' },
  { id: 'thousand-mile', name: 'Thousand Mile Club', symbol: 'mountain.2.fill', how: 'Record 1,000 total miles.', why: 'One thousand miles is a long-running record of where life has taken you.' },
  { id: 'grand-tourer', name: 'Grand Tourer', symbol: 'car.side.fill', how: 'Complete 100 journeys.', why: 'One hundred journeys mark a lasting life on the road.' },
  { id: 'first-note', name: 'First Note', symbol: 'music.note', how: 'Save your first song play with a journey.', why: 'The first saved song begins the soundtrack to your roads.' },
  { id: 'long-play', name: 'Long Play', symbol: 'record.circle.fill', how: 'Play 10 songs during one journey.', why: 'A ten-song journey has enough music to become a soundtrack of its own.' },
  { id: 'soundtrack-100', name: 'Soundtrack 100', symbol: 'music.note.list', how: 'Save 100 song plays with your journeys.', why: 'Your listening history becomes part of the places and moments you remember.' },
  { id: 'memory-maker', name: 'Memory Maker', symbol: 'photo.on.rectangle.angled', how: 'Create your first Memory.', why: 'A Memory keeps related journeys and photos together as one chapter.' },
  { id: 'picture-this', name: 'Picture This', symbol: 'camera.fill', how: 'Add your first photo to a Memory.', why: 'A personal photo makes a saved road story vivid and unmistakably yours.' },
  { id: 'story-collector', name: 'Story Collector', symbol: 'photo.stack.fill', how: 'Create five Memories.', why: 'Five Memories turn individual moments into a collection of road stories.' },
];

const validDate = (journey: JourneySummary) => Number.isFinite(new Date(journey.startedAt).getTime());
const dated = (journeys: JourneySummary[]) => journeys.filter(validDate).sort((a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime());
const dateText = (value: string | null) => value ? new Date(value).toLocaleString(undefined, { month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'Not unlocked yet';
const routeText = (journey?: JourneySummary) => journey ? `${journey.startingLocation || 'Unknown start'} to ${journey.endingLocation || 'Unknown destination'}` : '';

export function buildAchievements(journeys: JourneySummary[], memories: JourneyMemory[] = [], fiftyStates?: { completedAt: string | null }): Achievement[] {
  const rows = dated(journeys);
  const milestone = (test: (state: { count: number; miles: number; songs: number }, journey: JourneySummary) => boolean) => {
    const state = { count: 0, miles: 0, songs: 0 };
    for (const journey of rows) {
      state.count += 1;
      state.miles += Math.max(0, Number.isFinite(journey.miles) ? journey.miles : 0);
      state.songs += Math.max(0, Number.isFinite(journey.songCount) ? journey.songCount : 0);
      if (test(state, journey)) return journey;
    }
    return undefined;
  };
  const earnedJourneyById: Partial<Record<AchievementId, JourneySummary>> = {
    'first-track': rows[0],
    'long-way-home': rows.find(journey => Number.isFinite(journey.miles) && journey.miles > 25),
    'thousand-mile': milestone(state => state.miles >= 1000),
    'grand-tourer': milestone(state => state.count >= 100),
    'first-note': rows.find(journey => Number.isFinite(journey.songCount) && journey.songCount > 0),
    'long-play': rows.find(journey => Number.isFinite(journey.songCount) && journey.songCount >= 10),
    'soundtrack-100': milestone(state => state.songs >= 100),
  };
  const memoryRows = [...memories]
    .filter(memory => Number.isFinite(new Date(memory.createdAtUtc).getTime()))
    .sort((a, b) => new Date(a.createdAtUtc).getTime() - new Date(b.createdAtUtc).getTime());
  const firstMemory = memoryRows[0];
  const fifthMemory = memoryRows[4];
  const firstPhoto = memoryRows.flatMap(memory => (memory.photos ?? [])
    .filter(photo => Number.isFinite(new Date(photo.createdAtUtc).getTime()))
    .map(photo => ({ memory, photo })))
    .sort((a, b) => new Date(a.photo.createdAtUtc).getTime() - new Date(b.photo.createdAtUtc).getTime())[0];
  const activeDefinitions: AchievementDefinition[] = fiftyStates ? [...definitions, {
    id: 'all-fifty', name: 'All 50', symbol: 'star.circle.fill',
    how: 'Check off all 50 states in your 50 States checklist.',
    why: 'Fifty states, countless roads, one complete collection.',
  }] : definitions;
  return activeDefinitions.map(definition => {
    if (definition.id === 'all-fifty') {
      const completedAt = fiftyStates?.completedAt;
      const earned = Boolean(completedAt && Number.isFinite(Date.parse(completedAt)));
      return { ...definition, earned, earnedAt: earned ? completedAt! : null,
        earnedReason: earned ? 'Earned when you completed your 50 States checklist.' : definition.how };
    }
    if (definition.id === 'memory-maker') return {
      ...definition,
      earned: Boolean(firstMemory),
      earnedAt: firstMemory?.createdAtUtc ?? null,
      earnedReason: firstMemory ? `Earned when you created ${firstMemory.name || 'your first Memory'}.` : definition.how,
    };
    if (definition.id === 'picture-this') return {
      ...definition,
      earned: Boolean(firstPhoto),
      earnedAt: firstPhoto?.photo.createdAtUtc ?? null,
      earnedReason: firstPhoto ? `Earned when you added your first photo to ${firstPhoto.memory.name || 'a Memory'}.` : definition.how,
    };
    if (definition.id === 'story-collector') return {
      ...definition,
      earned: Boolean(fifthMemory),
      earnedAt: fifthMemory?.createdAtUtc ?? null,
      earnedReason: fifthMemory ? `Earned when you created ${fifthMemory.name || 'your fifth Memory'}, your fifth Memory.` : definition.how,
    };
    const journey = earnedJourneyById[definition.id];
    return {
      ...definition,
      earned: Boolean(journey),
      earnedAt: journey?.startedAt ?? null,
      earnedReason: journey ? definition.id === 'first-track' ? `Earned when you saved ${routeText(journey)}, your first recorded journey.` : `Unlocked as ${routeText(journey)} completed this milestone.` : definition.how,
    };
  });
}

function BadgeFace({ achievement, size, muted = false }: { achievement: Achievement; size: number; muted?: boolean }) {
  const theme = useAppTheme();
  if (isApprovedMedallion(achievement.id)) return <MedallionArtworkImage achievementId={achievement.id} themeId={theme.id}
    label={`${achievement.name} medallion artwork`} style={[{ width: size, height: size }, muted && styles.locked]} />;
  return <View style={[styles.symbolCoin, { width: size, height: size, borderColor: muted ? theme.palette.muted : theme.palette.accent, backgroundColor: muted ? theme.palette.line : theme.palette.inset }, muted && styles.locked]}>
    <SymbolView name={achievement.symbol} tintColor={muted ? theme.palette.muted : theme.palette.accent} size={Math.round(size * 0.38)} />
  </View>;
}

function TurningMedallion({ achievement, size }: { achievement: Achievement; size: number }) {
  if (isApprovedMedallion(achievement.id)) return <View style={!achievement.earned && styles.locked}><JourneyDeckMedallion achievementId={achievement.id} name={achievement.name} style={[styles.detailCoin, { width: size, height: size }]} /></View>;
  return <SymbolTurningMedallion achievement={achievement} />;
}

function SymbolTurningMedallion({ achievement }: { achievement: Achievement }) {
  const reduced = useReducedMotion();
  const rotation = useSharedValue(0);
  useEffect(() => { rotation.set(0); }, [achievement.id, rotation]);
  const pan = Gesture.Pan().maxPointers(1)
    .onChange(event => { if (!reduced) rotation.set(current => current + event.changeX * 0.9); })
    .onEnd(event => {
      if (reduced) return;
      const projected = rotation.get() + event.velocityX * 0.12;
      rotation.set(withSpring(Math.round(projected / 180) * 180, { duration: 400, dampingRatio: 0.8, velocity: event.velocityX }));
    });
  const turn = useAnimatedStyle(() => ({ transform: [{ perspective: 850 }, { rotateY: `${rotation.get()}deg` }] }));
  return <GestureDetector gesture={pan}><Animated.View accessibilityRole="imagebutton" accessibilityLabel={`Turn ${achievement.name} medallion`} accessibilityHint="Drag left or right to spin the medallion" style={[styles.detailCoin, turn]}>
    <View style={styles.coinFront}><BadgeFace achievement={achievement} size={210} muted={!achievement.earned} /></View>
    <View style={[styles.coinBack, { backgroundColor: achievement.earned ? '#c9952f' : '#7d735f', borderColor: achievement.earned ? '#f4d782' : '#aaa18f' }]}>
      <SymbolView name={achievement.symbol} tintColor={achievement.earned ? '#fff0bd' : '#ded8ca'} size={66} />
      <Text numberOfLines={2} style={styles.coinBackText}>{achievement.name.toUpperCase()}</Text>
    </View>
  </Animated.View></GestureDetector>;
}

export function AchievementsOverview({ journeys, memories = [] }: { journeys: JourneySummary[]; memories?: JourneyMemory[] }) {
  const theme = useAppTheme();
  const { width, fontScale } = useWindowDimensions();
  const { completedAt } = useFiftyStates(undefined, V3_FIFTY_STATES_ENABLED);
  const achievements = useMemo(() => buildAchievements(journeys, memories, V3_FIFTY_STATES_ENABLED ? { completedAt } : undefined), [journeys, memories, completedAt]);
  const [selectedId, setSelectedId] = useState<AchievementId | null>(null);
  const [sheetHeight, setSheetHeight] = useState(0);
  const [sheetWidth, setSheetWidth] = useState(0);
  const [contentHeight, setContentHeight] = useState(0);
  // Reserve room for the title and milestone details before sizing the medal.
  // Long personal names and accessibility text can still scroll when necessary.
  const medallionSize = Math.max(112, Math.min(380, (sheetWidth || width) - 48,
    sheetHeight > 0 ? sheetHeight - 430 * Math.max(1, fontScale) : 320));
  const selected = achievements.find(item => item.id === selectedId) ?? null;
  const columns = width / Math.max(1, fontScale) >= 700 ? 4 : width / Math.max(1, fontScale) >= 360 ? 3 : 2;
  return <View testID="achievements-overview" style={styles.overview}>
    <Text style={[styles.intro, { color: theme.palette.muted }]}>Milestones from the journeys saved in your private library.</Text>
    <View style={styles.grid}>{achievements.map(achievement => <Pressable key={achievement.id} accessibilityRole="button" accessibilityLabel={`${achievement.name}. ${achievement.earned ? 'Earned' : 'Locked'}`} onPress={() => setSelectedId(achievement.id)} style={({ pressed }) => [styles.badgeTile, { width: `${100 / columns}%`, opacity: pressed ? 0.7 : 1 }]}>
      <BadgeFace achievement={achievement} size={Math.min(118, width / columns - 30)} muted={!achievement.earned} />
      <Text numberOfLines={2} style={[styles.badgeName, { color: achievement.earned ? theme.palette.text : theme.palette.muted }]}>{achievement.name}</Text>
      <Text style={[styles.badgeStatus, { color: achievement.earned ? theme.palette.accent : theme.palette.muted }]}>{achievement.earned ? 'EARNED' : 'LOCKED'}</Text>
    </Pressable>)}</View>
    <BottomSheet testID="achievement-detail-sheet" isPresented={Boolean(selected)} onDismiss={() => setSelectedId(null)} snapPoints={['full']} contentPadding={0} containerColor={theme.palette.page}>
      {selected ? <RNHostView matchContents={false}><ScrollView style={[styles.sheetScroll, { backgroundColor: theme.palette.page }]}
        onLayout={event => { setSheetHeight(event.nativeEvent.layout.height); setSheetWidth(event.nativeEvent.layout.width); }}
        onContentSizeChange={(_width, height) => setContentHeight(height)}
        scrollEnabled={sheetHeight > 0 && contentHeight > sheetHeight + 1}
        bounces={false} alwaysBounceHorizontal={false} directionalLockEnabled
        contentInsetAdjustmentBehavior="never" contentContainerStyle={styles.sheetContent}>
        <TurningMedallion achievement={selected} size={medallionSize} />
        <Text accessibilityRole="header" style={[styles.sheetTitle, { color: theme.palette.text }]}>{selected.name}</Text>
        <Text style={[styles.sheetStatus, { color: selected.earned ? theme.palette.accent : theme.palette.muted }]}>{selected.earned ? 'ACHIEVEMENT EARNED' : 'NOT YET UNLOCKED'}</Text>
        <View style={styles.detailBlock}><Text style={[styles.detailLabel, { color: theme.palette.accent }]}>HOW</Text><Text style={[styles.detailText, { color: theme.palette.text }]}>{selected.how}</Text></View>
        <View style={styles.detailBlock}><Text style={[styles.detailLabel, { color: theme.palette.accent }]}>WHEN</Text><Text style={[styles.detailText, { color: theme.palette.text }]}>{dateText(selected.earnedAt)}</Text></View>
        <View style={styles.detailBlock}><Text style={[styles.detailLabel, { color: theme.palette.accent }]}>WHY</Text><Text style={[styles.detailText, { color: theme.palette.text }]}>{selected.earned ? `${selected.earnedReason} ${selected.why}` : selected.why}</Text></View>
        <Text style={[styles.spinHint, { color: theme.palette.muted }]}>Drag the medallion left or right to turn it.</Text>
      </ScrollView></RNHostView> : null}
    </BottomSheet>
  </View>;
}

const styles = StyleSheet.create({
  overview: { gap: 16 }, intro: { fontSize: 14, lineHeight: 20 }, grid: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start' },
  badgeTile: { minHeight: 174, padding: 8, alignItems: 'center', gap: 7 }, badgeName: { fontSize: 13, lineHeight: 17, fontWeight: '800', textAlign: 'center' }, badgeStatus: { fontSize: 9, fontWeight: '900', letterSpacing: 1.2 },
  symbolCoin: { borderRadius: 999, borderWidth: 2, alignItems: 'center', justifyContent: 'center' }, locked: { opacity: 0.38 },
  sheetScroll: { flex: 1, width: '100%', alignSelf: 'stretch' }, sheetContent: { width: '100%', alignItems: 'center', paddingHorizontal: 24, paddingTop: 18, paddingBottom: 24, gap: 10 }, detailCoin: { width: 210, height: 210, alignSelf: 'center' }, coinFront: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backfaceVisibility: 'hidden' },
  coinBack: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, transform: [{ rotateY: '180deg' }], backfaceVisibility: 'hidden', borderRadius: 999, borderWidth: 4, alignItems: 'center', justifyContent: 'center', padding: 30, gap: 12 }, coinBackText: { color: '#fff6dc', fontSize: 13, lineHeight: 17, fontWeight: '900', letterSpacing: 1.4, textAlign: 'center' },
  sheetTitle: { fontSize: 28, lineHeight: 33, fontWeight: '900', textAlign: 'center' }, sheetStatus: { fontSize: 10, fontWeight: '900', letterSpacing: 1.5 }, detailBlock: { width: '100%', maxWidth: 560, gap: 5, paddingTop: 6 }, detailLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 1.5 }, detailText: { fontSize: 15, lineHeight: 22 }, spinHint: { fontSize: 12, lineHeight: 18, textAlign: 'center', paddingTop: 8 },
});
