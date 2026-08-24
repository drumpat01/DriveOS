import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator, Alert, Animated, AppState, Image, Pressable, SafeAreaView, ScrollView, StatusBar,
  StyleSheet, Text, TextInput, View, useWindowDimensions,
} from 'react-native';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import * as Updates from 'expo-updates';

import {
  appDataClient, type AppDashboard, type ConnectionCapabilities, type JourneyCollection, type JourneyDetail,
  type JourneyMemory, type JourneySummary, type MemoriesCatalog, type ProviderPreferences,
} from './app-data';
import {
  loadLastFmUsername, loadMusicPreferences, saveLastFmUsername, saveMusicPreferences, toApiMusicProvider,
  type MusicPreferences, type MusicProvider,
} from './music-preferences';
import {
  authorizeAppleMusic, authorizeShazamMicrophone, getMusicCapabilityStatus,
  isJourneyDeckMusicNativeAvailable, type JourneyDeckMusicCapabilityStatus,
} from '../modules/journeydeck-music';
import { syncRecentLastFmNow } from './lastfm-sync';

type Tab = 'home' | 'journeys' | 'record' | 'connections';
type LoadState<T> = { status: 'loading' | 'ready' | 'error'; data: T; message?: string };

type ProviderOption = {
  id: MusicProvider;
  name: string;
  kicker: string;
  symbol: string;
  color: string;
  tint: string;
  summary: string;
  benefits: string[];
  drawbacks: string[];
  privacy: string;
};

const providerOptions: ProviderOption[] = [
  {
    id: 'apple-music', name: 'Apple Music', kicker: 'NATIVE & PRIVATE', symbol: '♪', color: '#fa5c74', tint: '#2a121b',
    summary: 'Use your Apple Music listening history to build a soundtrack after each journey.',
    benefits: ['No microphone needed', 'Fast, familiar iPhone permission', 'Artwork and catalog details included'],
    drawbacks: ['Apple Music subscribers only', 'Some play timestamps may be approximate'],
    privacy: 'JourneyDeck reads only the music details needed for your journey soundtrack.',
  },
  {
    id: 'shazam', name: 'Auto Recognition', kicker: 'POWERED BY SHAZAMKIT', symbol: 'S', color: '#56a8ff', tint: '#101d31',
    summary: 'Briefly recognize music playing in the car—from Spotify, radio, CDs, or another phone.',
    benefits: ['Works with almost any music source', 'No music account required', 'Audio is never saved by JourneyDeck'],
    drawbacks: ['Uses the microphone and its iOS indicator', 'Road noise or low volume can cause misses'],
    privacy: 'Only recognition results and timestamps are kept. JourneyDeck never stores recordings.',
  },
  {
    id: 'lastfm', name: 'Last.fm for Spotify', kicker: 'SPOTIFY WORKAROUND', symbol: 'fm', color: '#f23d47', tint: '#2b1115',
    summary: 'Match timestamped Last.fm scrobbles from Spotify with the time of your journey.',
    benefits: ['Automatic Spotify history', 'No microphone needed', 'Works across Spotify devices'],
    drawbacks: ['Requires Spotify scrobbling through Last.fm', 'Sync can be delayed or miss tracks'],
    privacy: 'JourneyDeck reads only recent scrobbles from the public Last.fm username you provide.',
  },
];

const defaultConnections: ProviderPreferences['connections'] = {
  appleMusic: 'not_connected', shazam: 'not_enabled', lastFm: 'not_connected', tessie: 'not_connected',
};

function blankDashboard(): AppDashboard {
  return {
    generatedAt: new Date().toISOString(),
    summary: {
      allTime: { journeyCount: 0, miles: 0, minutes: 0 },
      last7Days: { journeyCount: 0, miles: 0, minutes: 0, songCount: 0 },
    },
    latestJourney: null,
    recentJourneys: [],
    providerPreferences: null,
    recorder: { connected: false, state: 'ready', queuedPoints: 0, queuedMusic: 0, capturedPoints: 0 },
    weeklyJourneys: [],
  };
}

export function JourneyDeckShell({ recorder }: { recorder: ReactNode }) {
  const updateState = Updates.useUpdates();
  const announcedUpdate = useRef<string | null>(null);
  const [tab, setTab] = useState<Tab>('home');
  const [preferences, setPreferences] = useState<MusicPreferences | null>(null);
  const [editingProvider, setEditingProvider] = useState(false);
  const [selectedJourneyId, setSelectedJourneyId] = useState<string | null>(null);
  const [detailRefresh, setDetailRefresh] = useState(0);
  const [musicCapabilities, setMusicCapabilities] = useState<JourneyDeckMusicCapabilityStatus | null>(null);
  const [connectionCapabilities, setConnectionCapabilities] = useState<ConnectionCapabilities>({ lastFmConfigured: false, tessieConfigured: false });
  const [lastFmUsername, setLastFmUsername] = useState('');
  const [editingLastFm, setEditingLastFm] = useState(false);
  const [lastFmDraft, setLastFmDraft] = useState('');
  const [savingLastFm, setSavingLastFm] = useState(false);
  const [syncingLastFm, setSyncingLastFm] = useState(false);
  const [dashboard, setDashboard] = useState<LoadState<AppDashboard>>({ status: 'loading', data: blankDashboard() });
  const [journeys, setJourneys] = useState<LoadState<JourneySummary[]>>({ status: 'loading', data: [] });
  const [journeyCursor, setJourneyCursor] = useState<string | null>(null);
  const [journeysLoadingMore, setJourneysLoadingMore] = useState(false);
  const [memories, setMemories] = useState<LoadState<MemoriesCatalog>>({ status: 'loading', data: { memories: [], collections: [] } });
  const [journeyDetail, setJourneyDetail] = useState<LoadState<JourneyDetail | null>>({ status: 'ready', data: null });
  const preferenceSyncAttempt = useRef('');

  useEffect(() => {
    if (!Updates.isEnabled || !updateState.isUpdatePending) return;
    if (dashboard.data.recorder.state === 'recording' || dashboard.data.recorder.state === 'finishing') return;
    const updateId = updateState.downloadedUpdate?.updateId ?? 'pending-update';
    if (announcedUpdate.current === updateId) return;
    announcedUpdate.current = updateId;
    Alert.alert(
      'JourneyDeck update ready',
      'A new version has finished downloading. Restart JourneyDeck now to use it?',
      [
        { text: 'Later', style: 'cancel' },
        { text: 'Restart now', onPress: () => void Updates.reloadAsync().catch(() => Alert.alert('Restart JourneyDeck', 'Close and reopen JourneyDeck to finish applying the update.')) },
      ],
    );
  }, [dashboard.data.recorder.state, updateState.downloadedUpdate?.updateId, updateState.isUpdatePending]);

  useEffect(() => {
    let alive = true;
    void loadMusicPreferences().then(value => { if (alive) setPreferences(value); });
    void loadLastFmUsername().then(value => { if (alive) { setLastFmUsername(value); setLastFmDraft(value); } });
    return () => { alive = false; };
  }, []);

  const refreshDashboard = useCallback(async () => {
    setDashboard(current => ({ ...current, status: 'loading', message: undefined }));
    try {
      const data = await appDataClient.dashboard();
      setDashboard({ status: 'ready', data });
    } catch {
      const local = await appDataClient.localDashboard();
      setDashboard({ status: 'error', data: local, message: 'Showing what is safe on this iPhone. Journey history will return when JourneyDeck is reachable.' });
    }
  }, []);

  const refreshJourneys = useCallback(async () => {
    setJourneys(current => ({ ...current, status: 'loading', message: undefined }));
    try {
      const result = await appDataClient.journeys();
      setJourneys({ status: 'ready', data: result.items });
      setJourneyCursor(result.nextCursor);
    } catch {
      setJourneys(current => ({ status: 'error', data: current.data, message: 'Journey history is unavailable right now. Your recordings are still safe.' }));
    }
  }, []);

  const refreshMemories = useCallback(async () => {
    setMemories(current => ({ ...current, status: 'loading', message: undefined }));
    try { setMemories({ status: 'ready', data: await appDataClient.memories() }); }
    catch { setMemories(current => ({ status: 'error', data: current.data, message: 'Memories could not refresh. Your saved journeys are still safe.' })); }
  }, []);

  const loadMoreJourneys = useCallback(async () => {
    if (!journeyCursor || journeysLoadingMore) return;
    setJourneysLoadingMore(true);
    try {
      const result = await appDataClient.journeys(25, journeyCursor);
      setJourneys(current => {
        const existing = new Set(current.data.map(item => item.id));
        return { status: 'ready', data: [...current.data, ...result.items.filter(item => !existing.has(item.id))] };
      });
      setJourneyCursor(result.nextCursor);
    } catch {
      setJourneys(current => ({ ...current, message: 'More journeys could not be loaded yet. Try again when JourneyDeck is connected.' }));
    } finally {
      setJourneysLoadingMore(false);
    }
  }, [journeyCursor, journeysLoadingMore]);

  useEffect(() => { if (tab === 'home' || tab === 'connections') void refreshDashboard(); }, [refreshDashboard, tab]);
  useEffect(() => { if (tab === 'journeys') { void refreshJourneys(); void refreshMemories(); } }, [refreshJourneys, refreshMemories, tab]);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') {
        void refreshDashboard();
        if (tab === 'journeys') void refreshJourneys();
      }
    });
    return () => subscription.remove();
  }, [refreshDashboard, refreshJourneys, tab]);

  useEffect(() => {
    if (!preferences?.provider || !preferences.onboardingCompleted || dashboard.status !== 'ready' || !dashboard.data.recorder.connected) return;
    const desired = toApiMusicProvider(preferences.provider), remote = dashboard.data.providerPreferences;
    if (remote?.musicProvider === desired && remote.onboardingCompleted) return;
    const attemptKey = `${desired}:${remote?.updatedAt ?? 'new'}`;
    if (preferenceSyncAttempt.current === attemptKey) return;
    preferenceSyncAttempt.current = attemptKey;
    void appDataClient.updateProviderPreferences({
      musicProvider: desired,
      onboardingCompleted: true,
      connections: remote?.connections ?? defaultConnections,
    }).then(() => refreshDashboard()).catch(() => {
      if (preferenceSyncAttempt.current === attemptKey) preferenceSyncAttempt.current = '';
    });
  }, [dashboard, preferences, refreshDashboard]);

  useEffect(() => {
    if (!selectedJourneyId) { setJourneyDetail({ status: 'ready', data: null }); return; }
    let alive = true;
    setJourneyDetail({ status: 'loading', data: null });
    void appDataClient.journey(selectedJourneyId).then(
      data => { if (alive) setJourneyDetail({ status: 'ready', data }); },
      () => { if (alive) setJourneyDetail({ status: 'error', data: null, message: 'This journey could not be loaded. Try again when JourneyDeck is connected.' }); },
    );
    return () => { alive = false; };
  }, [detailRefresh, selectedJourneyId]);

  const refreshMusicCapabilities = useCallback(async () => {
    try { setMusicCapabilities(await getMusicCapabilityStatus()); }
    catch { setMusicCapabilities(null); }
  }, []);

  const refreshConnectionCapabilities = useCallback(async () => {
    try { setConnectionCapabilities(await appDataClient.connectionCapabilities()); }
    catch { setConnectionCapabilities({ lastFmConfigured: false, tessieConfigured: false }); }
  }, []);

  useEffect(() => {
    if (tab !== 'connections') return;
    void refreshMusicCapabilities();
    void refreshConnectionCapabilities();
  }, [refreshConnectionCapabilities, refreshMusicCapabilities, tab]);

  const chooseProvider = useCallback(async (provider: MusicProvider) => {
    const next = { provider, onboardingCompleted: true };
    await saveMusicPreferences(next);
    setPreferences(next);
    setEditingProvider(false);
    const existing = await appDataClient.providerPreferences().catch(() => null);
    await appDataClient.updateProviderPreferences({
      musicProvider: toApiMusicProvider(provider),
      onboardingCompleted: true,
      connections: existing?.connections ?? defaultConnections,
    }).catch(() => null);
    void refreshDashboard();
  }, [refreshDashboard]);

  const saveConnectionState = useCallback(async (next: Partial<ProviderPreferences['connections']>, providerOverride?: MusicProvider | null, onboardingOverride?: boolean) => {
    const existing = await appDataClient.providerPreferences().catch(() => null);
    await appDataClient.updateProviderPreferences({
      musicProvider: (providerOverride ?? preferences?.provider) ? toApiMusicProvider(providerOverride ?? preferences!.provider!) : null,
      onboardingCompleted: onboardingOverride ?? Boolean(preferences?.onboardingCompleted),
      connections: { ...(existing?.connections ?? defaultConnections), ...next },
    }).catch(() => null);
    await refreshDashboard();
  }, [preferences, refreshDashboard]);

  const connectAppleMusic = useCallback(async (providerOverride?: MusicProvider) => {
    if (!isJourneyDeckMusicNativeAvailable || musicCapabilities?.appleMusicAvailable === false) {
      Alert.alert('Apple Music is not ready', 'Apple Music needs the new native JourneyDeck build and its Apple developer capability before it can ask for access.');
      return;
    }
    try {
      const status = await authorizeAppleMusic();
      await refreshMusicCapabilities();
      await saveConnectionState({ appleMusic: status === 'authorized' ? 'connected' : status === 'denied' || status === 'restricted' ? 'needs_attention' : 'not_connected' }, providerOverride, true);
      if (status !== 'authorized') Alert.alert('Apple Music not connected', 'You can keep using JourneyDeck and try Apple Music again later from Connections.');
    } catch {
      Alert.alert('Apple Music could not connect', 'Nothing changed. Recording will continue to work normally.');
    }
  }, [musicCapabilities, refreshMusicCapabilities, saveConnectionState]);

  const enableRecognition = useCallback(async () => {
    if (!isJourneyDeckMusicNativeAvailable || musicCapabilities?.shazamKitAvailable === false) {
      Alert.alert('Auto Recognition is not ready', 'ShazamKit needs the new native JourneyDeck build and its Apple developer capability before it can ask for microphone access.');
      return;
    }
    try {
      const status = await authorizeShazamMicrophone();
      await refreshMusicCapabilities();
      await saveConnectionState({ shazam: status === 'authorized' ? 'enabled' : status === 'denied' || status === 'restricted' ? 'permission_denied' : 'not_enabled' });
      Alert.alert(status === 'authorized' ? 'Auto Recognition enabled' : 'Microphone access was not enabled', status === 'authorized' ? 'When Auto Recognition is your selected method, JourneyDeck listens briefly when a journey starts or resumes. You can also tap Identify music while recording.' : 'Recording still works without music recognition.');
    } catch {
      Alert.alert('Auto Recognition could not be enabled', 'Nothing changed. Recording will continue to work normally.');
    }
  }, [musicCapabilities, refreshMusicCapabilities, saveConnectionState]);

  const saveLastFm = useCallback(async () => {
    setSavingLastFm(true);
    try {
      await saveLastFmUsername(lastFmDraft);
      const normalized = lastFmDraft.trim();
      setLastFmUsername(normalized);
      setLastFmDraft(normalized);
      setEditingLastFm(false);
      if (normalized) Alert.alert('Last.fm username saved', `JourneyDeck will try to match scrobbles for ${normalized} after your next completed journey.`);
    } catch (error) {
      Alert.alert('Check the Last.fm username', error instanceof Error ? error.message : 'That username could not be saved.');
    } finally {
      setSavingLastFm(false);
    }
  }, [lastFmDraft]);

  const syncLastFmNow = useCallback(async () => {
    setSyncingLastFm(true);
    try {
      const result = await syncRecentLastFmNow();
      if (result.succeeded > 0) {
        await saveConnectionState({ lastFm: 'connected' });
        Alert.alert('Last.fm sync finished', result.matchedTracks ? `${result.matchedTracks} ${result.matchedTracks === 1 ? 'song was' : 'songs were'} matched to recent journeys.` : 'The connection worked. No new scrobbles matched those journey times yet.');
      } else if (result.attempted === 0) {
        Alert.alert('No completed journey yet', 'Finish a journey first, then JourneyDeck can match its time with Last.fm.');
      } else {
        Alert.alert('Last.fm will retry', 'The sync did not complete. JourneyDeck will try again later; recording is unaffected.');
      }
    } finally {
      setSyncingLastFm(false);
    }
  }, [saveConnectionState]);

  const openTab = (next: Tab) => {
    setSelectedJourneyId(null);
    setTab(next);
  };

  const activePreferences = preferences?.onboardingCompleted && !editingProvider ? preferences : null;

  return (
    <View style={styles.app}>
      <ExpoStatusBar style="light" /><StatusBar barStyle="light-content" />
      <View style={styles.screenBody}>
        {!preferences && <AppLoading />}
        {preferences && !activePreferences && <ProviderPicker
          initial={preferences.provider ?? 'apple-music'}
          onContinue={async provider => {
            await chooseProvider(provider);
            if (provider === 'apple-music') await connectAppleMusic(provider);
          }}
          onCancel={preferences.onboardingCompleted ? () => setEditingProvider(false) : undefined}
        />}
        {activePreferences && tab === 'home' && <HomeScreen state={dashboard} onRecord={() => openTab('record')} onJourneys={() => openTab('journeys')} onConnections={() => openTab('connections')} onJourney={id => { setTab('journeys'); setSelectedJourneyId(id); }} onRefresh={refreshDashboard} />}
        {activePreferences && tab === 'journeys' && (selectedJourneyId
          ? <JourneyDetailScreen state={journeyDetail} onBack={() => setSelectedJourneyId(null)} onRetry={() => setDetailRefresh(value => value + 1)} />
          : <MemoriesScreen catalog={memories} journeys={journeys} hasMore={Boolean(journeyCursor)} loadingMore={journeysLoadingMore} onJourney={setSelectedJourneyId} onRefresh={() => { void refreshMemories(); void refreshJourneys(); }} onLoadMore={() => void loadMoreJourneys()} />)}
        {activePreferences && tab === 'connections' && <ConnectionsScreen dashboard={dashboard.data} provider={activePreferences.provider!} capabilities={musicCapabilities} connectionCapabilities={connectionCapabilities} lastFmUsername={lastFmUsername} editingLastFm={editingLastFm} lastFmDraft={lastFmDraft} savingLastFm={savingLastFm} syncingLastFm={syncingLastFm} onLastFmDraft={setLastFmDraft} onEditLastFm={() => setEditingLastFm(true)} onCancelLastFm={() => { setLastFmDraft(lastFmUsername); setEditingLastFm(false); }} onSaveLastFm={() => void saveLastFm()} onSyncLastFm={() => void syncLastFmNow()} onChangeProvider={() => setEditingProvider(true)} onConnectAppleMusic={() => void connectAppleMusic()} onEnableRecognition={() => void enableRecognition()} />}
        <View
          key="persistent-recorder-engine"
          accessibilityElementsHidden={!activePreferences || tab !== 'record'}
          importantForAccessibility={activePreferences && tab === 'record' ? 'auto' : 'no-hide-descendants'}
          pointerEvents={activePreferences && tab === 'record' ? 'auto' : 'none'}
          style={activePreferences && tab === 'record' ? styles.recorderVisible : styles.recorderHidden}
        >
          {recorder}
        </View>
      </View>
      {activePreferences && <SafeAreaView style={styles.navSafe}><BottomNavigation active={tab} onSelect={openTab} /></SafeAreaView>}
    </View>
  );
}

function AppLoading() {
  return <SafeAreaView style={styles.loadingScreen}><ExpoStatusBar style="light" /><ActivityIndicator color="#a88aff" size="large" /><Text style={styles.loadingText}>Opening JourneyDeck…</Text></SafeAreaView>;
}

function ProviderPicker({ initial, onContinue, onCancel }: { initial: MusicProvider; onContinue: (provider: MusicProvider) => Promise<void>; onCancel?: () => void }) {
  const { width } = useWindowDimensions();
  const cardWidth = Math.max(280, width - 44);
  const initialIndex = Math.max(0, providerOptions.findIndex(option => option.id === initial));
  const [index, setIndex] = useState(initialIndex);
  const [saving, setSaving] = useState(false);
  const carousel = useRef<any>(null);
  const selected = providerOptions[index];

  const finish = async () => {
    setSaving(true);
    try { await onContinue(selected.id); }
    finally { setSaving(false); }
  };

  return (
    <SafeAreaView style={styles.onboardingSafe}>
      <ExpoStatusBar style="light" /><StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={styles.onboardingContent} showsVerticalScrollIndicator={false}>
        <BrandHeader compact />
        <Text style={styles.onboardingEyebrow}>YOUR JOURNEY SOUNDTRACK</Text>
        <Text style={styles.onboardingTitle}>Choose how JourneyDeck finds your music</Text>
        <Text style={styles.onboardingBody}>Swipe through all three choices. You can change this later without affecting recording.</Text>
        <View style={styles.providerTabs}>
          {providerOptions.map((option, optionIndex) => (
            <Pressable key={option.id} onPress={() => { setIndex(optionIndex); carousel.current?.scrollTo({ x: optionIndex * (cardWidth + 12), animated: true }); }} style={[styles.providerTab, index === optionIndex && { borderColor: option.color, backgroundColor: option.tint }]}>
              <Text style={[styles.providerTabText, index === optionIndex && { color: option.color }]}>{option.symbol}</Text>
            </Pressable>
          ))}
        </View>
        <ScrollView
          ref={carousel}
          horizontal showsHorizontalScrollIndicator={false} snapToInterval={cardWidth + 12} decelerationRate="fast"
          contentOffset={{ x: initialIndex * (cardWidth + 12), y: 0 }}
          onMomentumScrollEnd={event => setIndex(Math.max(0, Math.min(providerOptions.length - 1, Math.round(event.nativeEvent.contentOffset.x / (cardWidth + 12)))))}
          contentContainerStyle={styles.providerCarousel}
        >
          {providerOptions.map(option => <ProviderCard key={option.id} option={option} width={cardWidth} />)}
        </ScrollView>
        <View style={styles.pageDots}>{providerOptions.map((option, optionIndex) => <View key={option.id} style={[styles.pageDot, index === optionIndex && { width: 24, backgroundColor: selected.color }]} />)}</View>
        <PrimaryAction label={saving ? 'Saving your choice…' : `Continue with ${selected.name}`} onPress={() => void finish()} disabled={saving} />
        {onCancel && <Pressable onPress={onCancel} style={styles.cancelButton}><Text style={styles.cancelButtonText}>Keep my current choice</Text></Pressable>}
        <Text style={styles.providerFootnote}>Music connections are optional. JourneyDeck always records your route safely, even when a music service is unavailable.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function ProviderCard({ option, width }: { option: ProviderOption; width: number }) {
  return (
    <View style={[styles.providerCard, { width, borderColor: option.color }]}>
      <View style={styles.providerCardHeader}>
        <View style={[styles.providerIcon, { backgroundColor: option.color }]}><Text style={styles.providerIconText}>{option.symbol}</Text></View>
        <View style={styles.flex}><Text style={[styles.providerKicker, { color: option.color }]}>{option.kicker}</Text><Text style={styles.providerName}>{option.name}</Text></View>
      </View>
      <Text style={styles.providerSummary}>{option.summary}</Text>
      <ProsCons title="WHY YOU MAY LOVE IT" color="#4ce1b1" items={option.benefits} symbol="+" />
      <ProsCons title="WHAT TO KNOW" color="#ffb15c" items={option.drawbacks} symbol="–" />
      <View style={[styles.privacyNote, { backgroundColor: option.tint }]}><Text style={[styles.privacyTitle, { color: option.color }]}>PRIVACY</Text><Text style={styles.privacyCopy}>{option.privacy}</Text></View>
    </View>
  );
}

function ProsCons({ title, color, items, symbol }: { title: string; color: string; items: string[]; symbol: string }) {
  return <View style={styles.prosCons}><Text style={[styles.prosConsTitle, { color }]}>{title}</Text>{items.map(item => <View style={styles.proRow} key={item}><View style={[styles.proBullet, { borderColor: color }]}><Text style={[styles.proBulletText, { color }]}>{symbol}</Text></View><Text style={styles.proText}>{item}</Text></View>)}</View>;
}

function HomeScreen({ state, onRecord, onJourneys, onConnections, onJourney, onRefresh }: { state: LoadState<AppDashboard>; onRecord: () => void; onJourneys: () => void; onConnections: () => void; onJourney: (id: string) => void; onRefresh: () => void }) {
  const { data } = state;
  const week = data.summary.last7Days;
  const allTime = data.summary.allTime;
  const latestTrack = data.latestJourney?.soundtrackPreview?.[0];
  const todayJourneys = data.recentJourneys.filter(journey => isToday(journey.startedAt));
  const todayMiles = todayJourneys.reduce((sum, journey) => sum + journey.miles, 0);
  const todayMinutes = todayJourneys.reduce((sum, journey) => sum + journey.durationMinutes, 0);
  const recentJourneys = data.recentJourneys.slice(0, 2);
  const activity = weeklyActivity(data.weeklyJourneys);
  const longestRecent = data.recentJourneys.reduce<JourneySummary | null>((longest, journey) => !longest || journey.miles > longest.miles ? journey : longest, null);
  const soundtrackedRecent = data.recentJourneys.filter(journey => journey.songCount > 0).length;
  const connections = data.providerPreferences?.connections ?? defaultConnections;
  const selectedProvider = providerOptions.find(option => toApiMusicProvider(option.id) === data.providerPreferences?.musicProvider);
  const musicConnected = connections.appleMusic === 'connected' || connections.shazam === 'enabled' || connections.lastFm === 'connected';
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.pageContent} showsVerticalScrollIndicator={false}>
        <BrandHeader />
        {state.status === 'error' && <InlineNotice message={state.message!} onRetry={onRefresh} />}
        <View style={styles.heroCard}>
          <View style={styles.heroGlowOrange} />
          <View style={styles.heroGlowPurple} />
          <OpenRoadArtwork />
          <Text style={styles.heroEyebrow}>YOUR WEEK IN MOTION</Text>
          <Text style={styles.heroTitle}>{week.journeyCount ? `${week.journeyCount} ${week.journeyCount === 1 ? 'journey' : 'journeys'}` : 'Your road is waiting'}</Text>
          <Text style={styles.heroBody}>{week.journeyCount ? `${formatMiles(week.miles)} with ${week.songCount} soundtrack ${week.songCount === 1 ? 'song' : 'songs'}.` : 'Record a drive and JourneyDeck will bring its route, vehicle, and music together.'}</Text>
          <View style={styles.heroMetrics}>
            <Metric value={formatMiles(week.miles)} label="DISTANCE" />
            <Metric value={formatDuration(week.minutes)} label="DRIVE TIME" />
            <Metric value={String(week.songCount)} label="SONGS" />
          </View>
        </View>

        <View style={styles.pulseCard}>
          <View style={styles.pulseHeader}><View><Text style={styles.pulseKicker}>JOURNEY PULSE</Text><Text style={styles.pulseTitle}>Seven days on the road</Text></View><View style={styles.livePill}><View style={styles.liveDot} /><Text style={styles.liveText}>LIVE</Text></View></View>
          <View style={styles.pulseChart}>{activity.map(day => <View key={day.key} style={styles.pulseColumn}><View style={styles.pulseTrack}><View style={[styles.pulseBar, { height: `${Math.max(7, day.ratio * 100)}%` }]}><View style={styles.pulseBarCap} /></View></View><Text style={[styles.pulseDay, day.isToday && styles.pulseDayToday]}>{day.label}</Text></View>)}</View>
          <View style={styles.pulseFooter}><Text style={styles.pulseFooterValue}>{formatMiles(week.miles)}</Text><Text style={styles.pulseFooterLabel}>across {week.journeyCount} journeys this week</Text></View>
        </View>

        <View style={styles.recorderHealth}>
          <View style={[styles.healthDot, { backgroundColor: recorderColor(data.recorder.state, data.recorder.connected) }]} />
          <View style={styles.flex}><Text style={styles.healthTitle}>{recorderTitle(data.recorder.state, data.recorder.connected)}</Text><Text style={styles.healthBody}>{recorderDetail(data.recorder.state, data.recorder.queuedPoints, data.recorder.queuedMusic)}</Text></View>
          <Text style={styles.healthPoints}>{data.recorder.capturedPoints || ''}</Text>
        </View>
        <PrimaryAction label={data.recorder.state === 'recording' ? 'Open active recording' : 'Start a journey'} onPress={onRecord} />

        <SectionHeading title="Today at a glance" />
        <View style={styles.dashboardGrid}>
          <DashboardStatCard symbol="↗" kicker="TODAY'S DRIVING" value={todayJourneys.length ? formatMiles(todayMiles) : 'No drives'} detail={todayJourneys.length ? `${todayJourneys.length} ${todayJourneys.length === 1 ? 'journey' : 'journeys'} · ${formatDuration(todayMinutes)}` : 'Your next journey starts here'} color="#ff8a68" />
          <DashboardStatCard symbol="⌁" kicker="ALL TIME" value={formatMiles(allTime.miles)} detail={`${allTime.journeyCount} journeys · ${formatDuration(allTime.minutes)}`} color="#a88aff" />
        </View>

        <View style={styles.insightStrip}>
          <View style={styles.insightCard}><View style={styles.insightRoute}><View style={styles.insightRouteLine} /><View style={styles.insightRouteStart} /><View style={styles.insightRouteEnd} /></View><Text style={styles.insightKicker}>LONGEST RECENT</Text><Text style={styles.insightValue}>{longestRecent ? formatMiles(longestRecent.miles) : '—'}</Text><Text style={styles.insightDetail} numberOfLines={1}>{longestRecent ? locationPair(longestRecent) : 'Waiting for a journey'}</Text></View>
          <View style={styles.insightCard}><View style={styles.musicRings}><View style={styles.musicRingOuter}><View style={styles.musicRingInner}><Text style={styles.musicRingNote}>♪</Text></View></View></View><Text style={styles.insightKicker}>SOUNDTRACKED</Text><Text style={styles.insightValue}>{soundtrackedRecent}</Text><Text style={styles.insightDetail}>of {data.recentJourneys.length} recent journeys</Text></View>
        </View>

        <SectionHeading title="Quick actions" />
        <View style={styles.quickActions}>
          <QuickAction symbol="●" title="Record" detail="Start a journey" onPress={onRecord} color="#ff7b54" />
          <QuickAction symbol="≋" title="Journeys" detail="Open timeline" onPress={onJourneys} color="#a88aff" />
          <QuickAction symbol="◎" title="Connect" detail="Music & vehicle" onPress={onConnections} color="#43e6ae" />
        </View>

        <SectionHeading title="Vehicle" />
        <View style={styles.vehicleCard}>
          <View style={styles.vehicleIcon}><Text style={styles.vehicleIconText}>T</Text></View>
          <View style={styles.flex}>
            <Text style={styles.vehicleKicker}>LATEST VEHICLE CONTEXT</Text>
            <Text style={styles.vehicleName}>{data.latestJourney?.vehicleName ?? 'JourneyDeck Recorder'}</Text>
            <Text style={styles.vehicleDetail}>{data.latestJourney ? `Last seen on ${formatCompactDate(data.latestJourney.startedAt)} · ${formatMiles(data.latestJourney.miles)}` : 'Vehicle details will appear after your next journey.'}</Text>
          </View>
          <View style={[styles.connectionDot, { backgroundColor: connections.tessie === 'connected' ? '#43e6ae' : '#ffb15c' }]} />
        </View>

        <SectionHeading title="Road soundtrack" action="Connections" onAction={onConnections} />
        <View style={styles.soundtrackCard}>
          {latestTrack ? <Artwork track={latestTrack} size={72} /> : <View style={styles.emptyArtwork}><Text style={styles.emptyArtworkNote}>♪</Text></View>}
          <View style={styles.flex}>
            <Text style={styles.soundtrackLabel}>{latestTrack ? 'LATEST JOURNEY SONG' : 'READY FOR YOUR NEXT DRIVE'}</Text>
            <Text style={styles.soundtrackTitle} numberOfLines={1}>{latestTrack?.track ?? 'Your soundtrack will appear here'}</Text>
            <Text style={styles.soundtrackArtist} numberOfLines={1}>{latestTrack?.artist ?? 'Apple Music, recognition, or Last.fm'}</Text>
          </View>
        </View>

        <SectionHeading title="Recent journeys" action={recentJourneys.length ? 'View all' : undefined} onAction={recentJourneys.length ? onJourneys : undefined} />
        {recentJourneys.length ? recentJourneys.map(journey => <JourneyCard key={journey.id} journey={journey} onPress={() => onJourney(journey.id)} />) : <EmptyCard title="No journeys yet" body="Your completed recordings will collect here with their soundtrack and vehicle context." />}

        <SectionHeading title="Data health" />
        <View style={styles.dataHealthCard}>
          <DashboardHealthRow label="JourneyDeck" detail={data.recorder.connected ? 'Recorder and dashboard connected' : 'This iPhone is not connected'} healthy={data.recorder.connected} />
          <DashboardHealthRow label="Music" detail={musicConnected ? `${selectedProvider?.name ?? 'Soundtrack'} is ready` : 'Choose or reconnect a music method'} healthy={musicConnected} />
          <DashboardHealthRow label="Tessie" detail={connections.tessie === 'connected' ? 'Vehicle context connected' : 'Server connection may need attention'} healthy={connections.tessie === 'connected'} />
          <DashboardHealthRow label="Local queue" detail={data.recorder.queuedPoints + data.recorder.queuedMusic ? `${data.recorder.queuedPoints + data.recorder.queuedMusic} saved items waiting` : 'Everything on this iPhone is synced'} healthy={data.recorder.queuedPoints + data.recorder.queuedMusic === 0} />
        </View>
        {state.status === 'loading' && <LoadingLine label="Refreshing your dashboard…" />}
      </ScrollView>
    </SafeAreaView>
  );
}

function DashboardStatCard({ symbol, kicker, value, detail, color }: { symbol: string; kicker: string; value: string; detail: string; color: string }) {
  return <View style={styles.dashboardStatCard}><View style={[styles.dashboardStatIcon, { backgroundColor: `${color}20` }]}><Text style={[styles.dashboardStatSymbol, { color }]}>{symbol}</Text></View><Text style={styles.dashboardStatKicker}>{kicker}</Text><Text style={styles.dashboardStatValue} numberOfLines={1}>{value}</Text><Text style={styles.dashboardStatDetail}>{detail}</Text></View>;
}

function QuickAction({ symbol, title, detail, onPress, color }: { symbol: string; title: string; detail: string; onPress: () => void; color: string }) {
  return <Pressable onPress={onPress} style={({ pressed }) => [styles.quickAction, pressed && styles.pressed]}><Text style={[styles.quickActionSymbol, { color }]}>{symbol}</Text><Text style={styles.quickActionTitle}>{title}</Text><Text style={styles.quickActionDetail}>{detail}</Text></Pressable>;
}

function DashboardHealthRow({ label, detail, healthy }: { label: string; detail: string; healthy: boolean }) {
  return <View style={styles.dashboardHealthRow}><View style={[styles.dashboardHealthDot, { backgroundColor: healthy ? '#43e6ae' : '#ffb15c' }]} /><View style={styles.flex}><Text style={styles.dashboardHealthLabel}>{label}</Text><Text style={styles.dashboardHealthDetail}>{detail}</Text></View><Text style={[styles.dashboardHealthState, { color: healthy ? '#43e6ae' : '#ffb15c' }]}>{healthy ? 'READY' : 'CHECK'}</Text></View>;
}

function OpenRoadArtwork() {
  return <View style={styles.openRoad} pointerEvents="none">
    <View style={styles.roadSunGlow} />
    <View style={styles.roadSun} />
    <View style={[styles.roadStar, styles.roadStarOne]} />
    <View style={[styles.roadStar, styles.roadStarTwo]} />
    <View style={[styles.roadStar, styles.roadStarThree]} />
    <View style={styles.roadHorizon} />
    <View style={styles.roadSurface} />
    <View style={[styles.roadEdge, styles.roadEdgeLeft]} />
    <View style={[styles.roadEdge, styles.roadEdgeRight]} />
    <View style={[styles.roadDash, styles.roadDashFar]} />
    <View style={[styles.roadDash, styles.roadDashMiddle]} />
    <View style={[styles.roadDash, styles.roadDashNear]} />
    <View style={styles.roadSoundwave}><View style={styles.roadSoundBarSmall} /><View style={styles.roadSoundBarTall} /><View style={styles.roadSoundBarMedium} /><View style={styles.roadSoundBarTall} /><View style={styles.roadSoundBarSmall} /></View>
    <Text style={styles.roadCaption}>OPEN ROAD  •  YOUR STORY</Text>
  </View>;
}

function MemoriesScreen({ catalog, journeys, hasMore, loadingMore, onJourney, onRefresh, onLoadMore }: {
  catalog: LoadState<MemoriesCatalog>; journeys: LoadState<JourneySummary[]>; hasMore: boolean; loadingMore: boolean;
  onJourney: (id: string) => void; onRefresh: () => void; onLoadMore: () => void;
}) {
  const { width } = useWindowDimensions();
  const cardWidth = Math.max(260, width - 74), cardStep = cardWidth + 14;
  const scrollX = useRef(new Animated.Value(0)).current;
  const carousel = useRef<any>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [memoryDraft, setMemoryDraft] = useState<{ id: string | null; name: string; notes: string; collectionIds: string[] } | null>(null);
  const [collectionDraft, setCollectionDraft] = useState<{ id: string | null; name: string; description: string; driveIds: string[] } | null>(null);
  const [saving, setSaving] = useState(false);
  const selectedMemory = catalog.data.memories[Math.min(selectedIndex, Math.max(0, catalog.data.memories.length - 1))] ?? null;
  const selectedCollections = selectedMemory
    ? selectedMemory.collectionIds.map(id => catalog.data.collections.find(collection => collection.id === id)).filter((collection): collection is JourneyCollection => Boolean(collection))
    : [];
  const managedCollection = collectionDraft?.id ? catalog.data.collections.find(collection => collection.id === collectionDraft.id) ?? null : null;

  useEffect(() => { if (selectedIndex >= catalog.data.memories.length && catalog.data.memories.length) setSelectedIndex(catalog.data.memories.length - 1); }, [catalog.data.memories.length, selectedIndex]);

  const editMemory = (memory: JourneyMemory | null) => setMemoryDraft({
    id: memory?.id ?? null, name: memory?.name ?? '', notes: memory?.notes ?? '', collectionIds: [...(memory?.collectionIds ?? [])],
  });
  const toggleMemoryCollection = (id: string) => setMemoryDraft(current => current ? { ...current, collectionIds: current.collectionIds.includes(id) ? current.collectionIds.filter(value => value !== id) : [...current.collectionIds, id] } : current);
  const editCollection = (collection: JourneyCollection | null) => setCollectionDraft({
    id: collection?.id ?? null, name: collection?.name ?? '', description: collection?.description ?? '', driveIds: [...(collection?.driveIds ?? [])],
  });
  const toggleCollectionJourney = async (journeyId: string) => {
    if (!collectionDraft?.id) return;
    const next = { ...collectionDraft, driveIds: collectionDraft.driveIds.includes(journeyId) ? collectionDraft.driveIds.filter(id => id !== journeyId) : [...collectionDraft.driveIds, journeyId] };
    setCollectionDraft(next);
    try {
      await appDataClient.saveCollection(next);
      onRefresh();
    } catch (error) {
      setCollectionDraft(collectionDraft);
      Alert.alert('Collection not changed', error instanceof Error ? error.message : 'JourneyDeck could not update this collection.');
    }
  };
  const saveMemory = async () => {
    if (!memoryDraft) return;
    if (!memoryDraft.name.trim()) return Alert.alert('Name this memory', 'Give the memory a short name first.');
    if (memoryDraft.collectionIds.length < 2) return Alert.alert('Choose two collections', 'A Memory brings together at least two Collections.');
    setSaving(true);
    try {
      await appDataClient.saveMemory({ ...memoryDraft, artworkKey: selectedMemory?.artworkKey ?? 'road-trips' });
      setMemoryDraft(null); onRefresh();
    } catch (error) { Alert.alert('Memory not saved', error instanceof Error ? error.message : 'JourneyDeck could not save this memory.'); }
    finally { setSaving(false); }
  };
  const saveCollection = async () => {
    if (!collectionDraft) return;
    if (!collectionDraft.name.trim()) return Alert.alert('Name this collection', 'Give the collection a short name first.');
    setSaving(true);
    try {
      const saved = await appDataClient.saveCollection(collectionDraft);
      setCollectionDraft({ ...collectionDraft, id: saved.id, driveIds: saved.driveIds }); onRefresh();
    } catch (error) { Alert.alert('Collection not saved', error instanceof Error ? error.message : 'JourneyDeck could not save this collection.'); }
    finally { setSaving(false); }
  };

  return <SafeAreaView style={styles.safe}>
    <ScrollView contentContainerStyle={styles.memoriesPage} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <View style={styles.memoryPageHeader}><PageHeader eyebrow="YOUR STORY ON THE ROAD" title="Memories" body="Memories hold Collections. Collections hold the journeys that made them." /></View>
      {(catalog.status === 'error' || journeys.status === 'error') && <InlineNotice message={catalog.message ?? journeys.message ?? 'Memories could not refresh.'} onRetry={onRefresh} />}

      <View style={styles.memorySectionHeader}><Text style={styles.memoryLevel}>MEMORIES</Text><Pressable onPress={() => editMemory(null)}><Text style={styles.memoryHeaderAction}>+ New memory</Text></Pressable></View>
      <Animated.ScrollView
        ref={carousel}
        horizontal showsHorizontalScrollIndicator={false} decelerationRate="fast" snapToInterval={cardStep}
        contentContainerStyle={styles.memoryCarouselContent}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], { useNativeDriver: true })}
        scrollEventThrottle={16}
        onMomentumScrollEnd={event => setSelectedIndex(Math.max(0, Math.min(catalog.data.memories.length - 1, Math.round(event.nativeEvent.contentOffset.x / cardStep))))}
      >
        {catalog.data.memories.map((memory, index) => {
          const inputRange = [(index - 1) * cardStep, index * cardStep, (index + 1) * cardStep];
          const scale = scrollX.interpolate({ inputRange, outputRange: [0.9, 1, 0.9], extrapolate: 'clamp' });
          const translateY = scrollX.interpolate({ inputRange, outputRange: [12, 0, 12], extrapolate: 'clamp' });
          const collectionIds = new Set(memory.collectionIds), journeyIds = new Set(catalog.data.collections.filter(collection => collectionIds.has(collection.id)).flatMap(collection => collection.driveIds));
          return <Animated.View key={memory.id} style={{ width: cardWidth, transform: [{ scale }, { translateY }] }}>
            <Pressable onPress={() => { setSelectedIndex(index); carousel.current?.scrollTo({ x: index * cardStep, animated: true }); }} style={styles.memoryHeroCard}>
              <MemoryArtwork artworkKey={memory.artworkKey} />
              <View style={styles.memoryHeroShade} />
              <Text style={styles.memoryHeroKicker}>MEMORY {String(index + 1).padStart(2, '0')}</Text>
              <Text style={styles.memoryHeroTitle}>{memory.name}</Text>
              <Text style={styles.memoryHeroMeta}>{memory.collectionIds.length} collections  •  {journeyIds.size} journeys</Text>
            </Pressable>
          </Animated.View>;
        })}
        {!catalog.data.memories.length && <Pressable onPress={() => editMemory(null)} style={[styles.memoryHeroCard, styles.memoryEmptyHero, { width: cardWidth }]}><MemoryArtwork artworkKey="road-trips" /><View style={styles.memoryHeroShade} /><Text style={styles.memoryHeroKicker}>YOUR FIRST MEMORY</Text><Text style={styles.memoryHeroTitle}>Build a chapter</Text><Text style={styles.memoryHeroMeta}>Choose two Collections to begin</Text></Pressable>}
      </Animated.ScrollView>
      <View style={styles.memoryDots}>{catalog.data.memories.map((memory, index) => <View key={memory.id} style={[styles.memoryDot, index === selectedIndex && styles.memoryDotActive]} />)}</View>

      {memoryDraft && <View style={styles.memoryEditor}>
        <Text style={styles.editorKicker}>{memoryDraft.id ? 'EDIT MEMORY' : 'NEW MEMORY'}</Text>
        <TextInput value={memoryDraft.name} onChangeText={name => setMemoryDraft(current => current ? { ...current, name } : current)} placeholder="Memory name" placeholderTextColor="#716879" maxLength={80} style={styles.editorInput} />
        <TextInput value={memoryDraft.notes} onChangeText={notes => setMemoryDraft(current => current ? { ...current, notes } : current)} placeholder="What makes this chapter special?" placeholderTextColor="#716879" maxLength={1200} multiline style={[styles.editorInput, styles.editorNotes]} />
        <Text style={styles.editorInstruction}>Choose at least two Collections</Text>
        {catalog.data.collections.map(collection => <MembershipRow key={collection.id} title={collection.name} detail={`${collection.driveIds.length} journeys`} selected={memoryDraft.collectionIds.includes(collection.id)} onPress={() => toggleMemoryCollection(collection.id)} />)}
        <View style={styles.editorActions}><Pressable onPress={() => setMemoryDraft(null)} style={styles.editorCancel}><Text style={styles.editorCancelText}>Cancel</Text></Pressable><Pressable onPress={() => void saveMemory()} disabled={saving} style={[styles.editorSave, saving && styles.pressed]}><Text style={styles.editorSaveText}>{saving ? 'Saving…' : 'Save memory'}</Text></Pressable></View>
      </View>}

      <View style={styles.memorySectionHeader}><View><Text style={styles.memoryLevel}>COLLECTIONS</Text><Text style={styles.memorySectionTitle}>{selectedMemory?.name ?? 'Saved collections'}</Text></View><View style={styles.memoryHeaderActions}>{selectedMemory && <Pressable onPress={() => editMemory(selectedMemory)}><Text style={styles.memoryHeaderAction}>Edit memory</Text></Pressable>}<Pressable onPress={() => editCollection(null)}><Text style={styles.memoryHeaderAction}>+ New</Text></Pressable></View></View>
      {(selectedCollections.length ? selectedCollections : catalog.data.collections).map((collection, index) => <CollectionCard key={collection.id} collection={collection} index={index} active={collectionDraft?.id === collection.id} onManage={() => editCollection(collection)} />)}
      {!catalog.data.collections.length && <EmptyCard title="No Collections yet" body="Create a Collection, then add the journeys that belong together." />}
      {collectionDraft && <View style={styles.collectionEditor}>
        <Text style={styles.editorKicker}>{collectionDraft.id ? 'MANAGE COLLECTION' : 'NEW COLLECTION'}</Text>
        <TextInput value={collectionDraft.name} onChangeText={name => setCollectionDraft(current => current ? { ...current, name } : current)} placeholder="Collection name" placeholderTextColor="#716879" maxLength={80} style={styles.editorInput} />
        <TextInput value={collectionDraft.description} onChangeText={description => setCollectionDraft(current => current ? { ...current, description } : current)} placeholder="Optional description" placeholderTextColor="#716879" maxLength={500} style={styles.editorInput} />
        <View style={styles.editorActions}><Pressable onPress={() => setCollectionDraft(null)} style={styles.editorCancel}><Text style={styles.editorCancelText}>Done</Text></Pressable><Pressable onPress={() => void saveCollection()} disabled={saving} style={[styles.editorSave, saving && styles.pressed]}><Text style={styles.editorSaveText}>{saving ? 'Saving…' : collectionDraft.id ? 'Save details' : 'Create collection'}</Text></Pressable></View>
      </View>}

      <View style={styles.memorySectionHeader}><View><Text style={styles.memoryLevel}>JOURNEYS</Text><Text style={styles.memorySectionTitle}>{managedCollection ? managedCollection.name : 'Your latest drives'}</Text></View>{managedCollection && <Text style={styles.managingPill}>MANAGING</Text>}</View>
      {collectionDraft?.id && <Text style={styles.journeyManageHelp}>Use Add or Remove to decide which journeys belong in this Collection. Changes save immediately.</Text>}
      {journeys.data.map(journey => <View key={journey.id} style={styles.memoryJourneyWrap}><JourneyCard journey={journey} onPress={() => onJourney(journey.id)} />{collectionDraft?.id && <Pressable onPress={() => void toggleCollectionJourney(journey.id)} style={[styles.journeyMembershipButton, collectionDraft.driveIds.includes(journey.id) && styles.journeyMembershipRemove]}><Text style={[styles.journeyMembershipText, collectionDraft.driveIds.includes(journey.id) && styles.journeyMembershipRemoveText]}>{collectionDraft.driveIds.includes(journey.id) ? 'Remove from collection' : '+ Add to collection'}</Text></Pressable>}</View>)}
      {!journeys.data.length && journeys.status !== 'loading' && <EmptyCard title="No journeys yet" body="Finish a recording and it will appear here, ready to organize." />}
      {hasMore && <Pressable onPress={onLoadMore} disabled={loadingMore} style={[styles.loadMoreButton, loadingMore && styles.pressed]}>{loadingMore ? <ActivityIndicator color="#b59cff" /> : <Text style={styles.loadMoreText}>Load more journeys</Text>}</Pressable>}
      {(catalog.status === 'loading' || journeys.status === 'loading') && <LoadingLine label="Refreshing memories…" />}
    </ScrollView>
  </SafeAreaView>;
}

function MemoryArtwork({ artworkKey }: { artworkKey: string }) {
  const night = artworkKey === 'favorite-night-drives' || artworkKey === 'golden-hour-drives';
  return <View style={[styles.memoryArtwork, night && styles.memoryArtworkNight]}><View style={styles.memoryArtworkGlow} /><View style={styles.memoryArtworkMoon} /><View style={[styles.memoryArtworkLine, styles.memoryArtworkLineLeft]} /><View style={[styles.memoryArtworkLine, styles.memoryArtworkLineRight]} /><View style={styles.memoryArtworkDashOne} /><View style={styles.memoryArtworkDashTwo} /><View style={styles.memoryArtworkDashThree} /></View>;
}

function MembershipRow({ title, detail, selected, onPress }: { title: string; detail: string; selected: boolean; onPress: () => void }) {
  return <Pressable onPress={onPress} style={[styles.membershipRow, selected && styles.membershipRowSelected]}><View style={[styles.membershipCheck, selected && styles.membershipCheckSelected]}><Text style={styles.membershipCheckText}>{selected ? '✓' : '+'}</Text></View><View style={styles.flex}><Text style={styles.membershipTitle}>{title}</Text><Text style={styles.membershipDetail}>{detail}</Text></View><Text style={[styles.membershipAction, selected && styles.membershipActionRemove]}>{selected ? 'Remove' : 'Add'}</Text></Pressable>;
}

function CollectionCard({ collection, index, active, onManage }: { collection: JourneyCollection; index: number; active: boolean; onManage: () => void }) {
  const colors = ['#ff795b', '#9b7cff', '#43e6ae'];
  const color = colors[index % colors.length];
  return <Pressable onPress={onManage} style={[styles.memoryCollectionCard, active && { borderColor: color }]}><View style={[styles.collectionArtwork, { backgroundColor: `${color}20` }]}><View style={[styles.collectionArtworkOrb, { backgroundColor: color }]} /><View style={[styles.collectionArtworkRoute, { backgroundColor: color }]} /></View><View style={styles.flex}><Text style={styles.collectionKicker}>COLLECTION</Text><Text style={styles.collectionTitle}>{collection.name}</Text><Text style={styles.collectionMeta}>{collection.driveIds.length} journeys{collection.description ? `  •  ${collection.description}` : ''}</Text></View><View style={styles.collectionManage}><Text style={styles.collectionManageText}>{active ? 'Managing' : 'Manage'}</Text></View></Pressable>;
}

function JourneysScreen({ state, hasMore, loadingMore, onJourney, onRefresh, onLoadMore }: { state: LoadState<JourneySummary[]>; hasMore: boolean; loadingMore: boolean; onJourney: (id: string) => void; onRefresh: () => void; onLoadMore: () => void }) {
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.pageContent} showsVerticalScrollIndicator={false}>
        <PageHeader eyebrow="YOUR STORY ON THE ROAD" title="Journeys" body="Routes, vehicle moments, and every soundtrack in one place." />
        {state.status === 'error' && <InlineNotice message={state.message!} onRetry={onRefresh} />}
        {state.status === 'loading' && state.data.length === 0 ? <LoadingCard /> : state.data.length
          ? state.data.map(journey => <JourneyCard key={journey.id} journey={journey} onPress={() => onJourney(journey.id)} />)
          : <EmptyCard title="Your timeline starts here" body="Finish your first recording and it will appear here automatically. Recording still works offline." />}
        {hasMore && <Pressable onPress={onLoadMore} disabled={loadingMore} style={[styles.loadMoreButton, loadingMore && styles.pressed]}>{loadingMore ? <ActivityIndicator color="#b59cff" /> : <Text style={styles.loadMoreText}>Load more journeys</Text>}</Pressable>}
      </ScrollView>
    </SafeAreaView>
  );
}

function JourneyDetailScreen({ state, onBack, onRetry }: { state: LoadState<JourneyDetail | null>; onBack: () => void; onRetry: () => void }) {
  const journey = state.data;
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.pageContent} showsVerticalScrollIndicator={false}>
        <Pressable onPress={onBack} style={styles.backButton}><Text style={styles.backButtonText}>‹  All journeys</Text></Pressable>
        {state.status === 'loading' ? <LoadingCard /> : state.status === 'error' || !journey ? <InlineNotice message={state.message ?? 'Journey unavailable.'} onRetry={onRetry} /> : (
          <>
            <Text style={styles.detailDate}>{formatFullDate(journey.startedAt)}</Text>
            <Text style={styles.detailTitle}>{locationPair(journey)}</Text>
            <RouteSketch coordinates={journey.route?.coordinates ?? []} />
            <View style={styles.detailMetrics}>
              <Metric value={formatMiles(journey.miles)} label="DISTANCE" />
              <Metric value={formatDuration(journey.durationMinutes)} label="TIME" />
              <Metric value={journey.averageSpeedMph == null ? '—' : `${Math.round(journey.averageSpeedMph)} mph`} label="AVG SPEED" />
            </View>
            <SectionHeading title="Journey soundtrack" action={`${journey.songCount} songs`} />
            {journey.soundtrack.length ? journey.soundtrack.map((track, index) => <TrackRow key={`${track.source}-${track.playedAt ?? track.track}-${index}`} track={track} index={index + 1} />) : <EmptyCard title="No songs matched yet" body="JourneyDeck may keep checking briefly after a drive, or you can choose another music connection." />}
            {(journey.vehicleName || journey.startingBatteryPercent != null || journey.energyUsedKwh != null) && <>
              <SectionHeading title="Vehicle" />
              <View style={styles.infoCard}>
                <InfoRow label="VEHICLE" value={journey.vehicleName ?? 'Connected vehicle'} />
                {journey.startingBatteryPercent != null && <InfoRow label="BATTERY" value={`${journey.startingBatteryPercent}% → ${journey.endingBatteryPercent ?? '—'}%`} />}
                {journey.energyUsedKwh != null && <InfoRow label="ENERGY USED" value={`${journey.energyUsedKwh.toFixed(1)} kWh`} />}
              </View>
            </>}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function ConnectionsScreen({
  dashboard, provider, capabilities, connectionCapabilities, lastFmUsername, editingLastFm, lastFmDraft,
  savingLastFm, syncingLastFm, onLastFmDraft, onEditLastFm, onCancelLastFm, onSaveLastFm, onSyncLastFm, onChangeProvider,
  onConnectAppleMusic, onEnableRecognition,
}: {
  dashboard: AppDashboard;
  provider: MusicProvider;
  capabilities: JourneyDeckMusicCapabilityStatus | null;
  connectionCapabilities: ConnectionCapabilities;
  lastFmUsername: string;
  editingLastFm: boolean;
  lastFmDraft: string;
  savingLastFm: boolean;
  syncingLastFm: boolean;
  onLastFmDraft: (value: string) => void;
  onEditLastFm: () => void;
  onCancelLastFm: () => void;
  onSaveLastFm: () => void;
  onSyncLastFm: () => void;
  onChangeProvider: () => void;
  onConnectAppleMusic: () => void;
  onEnableRecognition: () => void;
}) {
  const selected = providerOptions.find(option => option.id === provider)!;
  const connections = dashboard.providerPreferences?.connections ?? defaultConnections;
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.pageContent} showsVerticalScrollIndicator={false}>
        <PageHeader eyebrow="YOUR DATA, YOUR CHOICE" title="Connections" body="JourneyDeck works as a recorder on its own. Add music or vehicle context whenever you are ready." />
        <View style={[styles.selectedProvider, { borderColor: selected.color }]}>
          <View style={[styles.connectionIcon, { backgroundColor: selected.color }]}><Text style={styles.connectionIconText}>{selected.symbol}</Text></View>
          <View style={styles.flex}><Text style={styles.connectionKicker}>SELECTED MUSIC METHOD · NOT A CONNECTION</Text><Text style={styles.connectionName}>{selected.name}</Text><Text style={styles.connectionDetail}>{selected.summary}</Text></View>
          <Pressable onPress={onChangeProvider} style={styles.changeButton}><Text style={styles.changeButtonText}>Change</Text></Pressable>
        </View>

        <SectionHeading title="Music" />
        <ConnectionTile name="Apple Music" detail="Native history and artwork" symbol="♪" color="#fa5c74" status={nativeAppleStatus(capabilities, connections.appleMusic)} action={capabilities?.appleMusicAuthorizationStatus === 'authorized' ? 'Manage' : 'Connect'} onPress={onConnectAppleMusic} />
        <ConnectionTile name="Auto Recognition" detail="ShazamKit for any music source" symbol="S" color="#56a8ff" status={nativeShazamStatus(capabilities, connections.shazam)} action={capabilities?.microphonePermissionStatus === 'authorized' ? 'Enabled' : 'Enable'} onPress={onEnableRecognition} />
        <ConnectionTile name="Last.fm" detail="Timestamped Spotify scrobbles" symbol="fm" color="#f23d47" status={!connectionCapabilities.lastFmConfigured ? 'Server setup required' : connections.lastFm === 'connected' ? statusText(connections.lastFm) : lastFmUsername ? `Set for ${lastFmUsername} · pending first sync` : statusText(connections.lastFm)} action={lastFmUsername ? 'Change' : 'Set up'} onPress={onEditLastFm} />
        {editingLastFm && <View style={styles.setupCard}>
          <Text style={styles.setupTitle}>LAST.FM FOR SPOTIFY</Text>
          <Text style={styles.setupBody}>First connect Spotify scrobbling in Last.fm, then enter that public Last.fm username here. JourneyDeck uses only timestamped scrobbles around a completed journey.</Text>
          <TextInput value={lastFmDraft} onChangeText={onLastFmDraft} autoCapitalize="none" autoCorrect={false} maxLength={30} placeholder="Last.fm username" placeholderTextColor="#6f6877" style={styles.setupInput} />
          {!connectionCapabilities.lastFmConfigured && <Text style={styles.setupWarning}>The JourneyDeck server still needs its private Last.fm key before syncing can run.</Text>}
          {lastFmUsername && connectionCapabilities.lastFmConfigured && <Pressable onPress={onSyncLastFm} disabled={syncingLastFm} style={[styles.setupSync, syncingLastFm && styles.pressed]}><Text style={styles.setupSyncText}>{syncingLastFm ? 'Checking recent journeys…' : 'Sync recent journeys now'}</Text></Pressable>}
          <View style={styles.setupActions}><Pressable onPress={onCancelLastFm} style={styles.setupSecondary}><Text style={styles.setupSecondaryText}>Cancel</Text></Pressable><Pressable onPress={onSaveLastFm} disabled={savingLastFm} style={[styles.setupPrimary, savingLastFm && styles.pressed]}><Text style={styles.setupPrimaryText}>{savingLastFm ? 'Saving…' : 'Save'}</Text></Pressable></View>
        </View>}

        <SectionHeading title="Vehicle" />
        <ConnectionTile name="Tessie" detail="Tesla battery, energy, and vehicle context" symbol="T" color="#9b7cff" status={connectionCapabilities.tessieConfigured ? 'Connected on JourneyDeck' : statusText(connections.tessie)} action={connectionCapabilities.tessieConfigured ? 'Server managed' : 'Not configured'} onPress={() => Alert.alert('Tessie stays private', connectionCapabilities.tessieConfigured ? 'Tessie is connected securely on the JourneyDeck server. Its token is never copied to this iPhone.' : 'Tessie is not configured on the JourneyDeck server yet. Journey recording and music continue to work normally.')} />
        <View style={styles.securityCard}><Text style={styles.securityTitle}>PRIVATE BY DESIGN</Text><Text style={styles.securityBody}>Music and Tessie connections are optional and isolated. A connection problem never blocks recording, finishing, or the on-device point queue.</Text></View>
      </ScrollView>
    </SafeAreaView>
  );
}

function BottomNavigation({ active, onSelect }: { active: Tab; onSelect: (tab: Tab) => void }) {
  const items: { id: Tab; label: string; symbol: string }[] = [
    { id: 'home', label: 'Home', symbol: '⌂' },
    { id: 'journeys', label: 'Memories', symbol: '≋' },
    { id: 'record', label: 'Record', symbol: '●' },
    { id: 'connections', label: 'Connect', symbol: '◎' },
  ];
  return <View style={styles.bottomNav}>{items.map(item => <Pressable key={item.id} onPress={() => onSelect(item.id)} accessibilityRole="tab" accessibilityState={{ selected: active === item.id }} style={styles.navItem}><Text style={[styles.navSymbol, active === item.id && styles.navActive]}>{item.symbol}</Text><Text style={[styles.navLabel, active === item.id && styles.navActive]}>{item.label}</Text></Pressable>)}</View>;
}

function BrandHeader({ compact = false }: { compact?: boolean }) {
  return <View style={[styles.brandRow, compact && styles.brandCompact]}><View style={styles.logo}><Text style={styles.logoText}>J</Text></View><View><Text style={styles.brandEyebrow}>JOURNEYDECK</Text><Text style={styles.brandTitle}>Your drive, remembered.</Text></View></View>;
}

function PageHeader({ eyebrow, title, body }: { eyebrow: string; title: string; body: string }) {
  return <View style={styles.pageHeader}><Text style={styles.pageEyebrow}>{eyebrow}</Text><Text style={styles.pageTitle}>{title}</Text><Text style={styles.pageBody}>{body}</Text></View>;
}

function SectionHeading({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return <View style={styles.sectionHeading}><Text style={styles.sectionTitle}>{title}</Text>{action && <Pressable onPress={onAction} disabled={!onAction}><Text style={[styles.sectionAction, !onAction && styles.sectionActionMuted]}>{action}</Text></Pressable>}</View>;
}

function PrimaryAction({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return <Pressable onPress={onPress} disabled={disabled} style={({ pressed }) => [styles.primaryAction, (pressed || disabled) && styles.pressed]}><Text style={styles.primaryActionText}>{label}</Text></Pressable>;
}

function Metric({ value, label }: { value: string; label: string }) {
  return <View style={styles.metric}><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View>;
}

function JourneyCard({ journey, onPress }: { journey: JourneySummary; onPress: () => void }) {
  const track = journey.soundtrackPreview?.[0];
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.journeyCard, pressed && styles.pressed]}>
      <View style={styles.journeyTop}><View><Text style={styles.journeyDate}>{formatFullDate(journey.startedAt)}</Text><Text style={styles.journeyRoute} numberOfLines={2}>{locationPair(journey)}</Text></View><Text style={styles.journeyChevron}>›</Text></View>
      <View style={styles.journeyStats}><Text style={styles.journeyStat}>{formatMiles(journey.miles)}</Text><Text style={styles.journeyStatDot}>•</Text><Text style={styles.journeyStat}>{formatDuration(journey.durationMinutes)}</Text>{journey.vehicleName && <><Text style={styles.journeyStatDot}>•</Text><Text style={styles.journeyStat}>{journey.vehicleName}</Text></>}</View>
      <View style={styles.journeySoundtrack}>{track ? <Artwork track={track} size={42} /> : <View style={styles.miniArtwork}><Text style={styles.miniArtworkText}>♪</Text></View>}<View style={styles.flex}><Text style={styles.journeySong} numberOfLines={1}>{track?.track ?? (journey.songCount ? `${journey.songCount} soundtrack songs` : 'No soundtrack matched')}</Text><Text style={styles.journeyArtist} numberOfLines={1}>{track?.artist ?? 'Music can be added after the journey'}</Text></View>{journey.songCount > 0 && <Text style={styles.songCount}>{journey.songCount}</Text>}</View>
    </Pressable>
  );
}

function Artwork({ track, size }: { track: { artworkUrl?: string | null; track: string }; size: number }) {
  return track.artworkUrl ? <Image source={{ uri: track.artworkUrl }} accessibilityLabel={`${track.track} artwork`} style={{ width: size, height: size, borderRadius: Math.round(size * 0.22), backgroundColor: '#251d31' }} /> : <View style={[styles.artworkFallback, { width: size, height: size, borderRadius: Math.round(size * 0.22) }]}><Text style={[styles.artworkFallbackText, { fontSize: Math.round(size * 0.35) }]}>♪</Text></View>;
}

function TrackRow({ track, index }: { track: { artworkUrl?: string | null; track: string; artist: string }; index: number }) {
  return <View style={styles.trackRow}><Text style={styles.trackIndex}>{String(index).padStart(2, '0')}</Text><Artwork track={track} size={48} /><View style={styles.flex}><Text style={styles.trackTitle} numberOfLines={1}>{track.track}</Text><Text style={styles.trackArtist} numberOfLines={1}>{track.artist}</Text></View></View>;
}

function EmptyCard({ title, body }: { title: string; body: string }) {
  return <View style={styles.emptyCard}><View style={styles.emptyCircle}><Text style={styles.emptyCircleText}>J</Text></View><Text style={styles.emptyTitle}>{title}</Text><Text style={styles.emptyBody}>{body}</Text></View>;
}

function InlineNotice({ message, onRetry }: { message: string; onRetry: () => void }) {
  return <View style={styles.inlineNotice}><View style={styles.noticeDot} /><Text style={styles.inlineNoticeText}>{message}</Text><Pressable onPress={onRetry}><Text style={styles.retryText}>Retry</Text></Pressable></View>;
}

function LoadingLine({ label }: { label: string }) { return <View style={styles.loadingLine}><ActivityIndicator color="#9b7cff" /><Text style={styles.loadingLineText}>{label}</Text></View>; }
function LoadingCard() { return <View style={styles.loadingCard}><ActivityIndicator color="#9b7cff" size="large" /><Text style={styles.loadingLineText}>Loading your journeys…</Text></View>; }

function RouteSketch({ coordinates }: { coordinates: [number, number][] }) {
  const { width: screenWidth } = useWindowDimensions();
  const plotWidth = Math.max(240, Math.min(480, screenWidth - 72)), plotHeight = 142;
  const valid = coordinates.filter(([longitude, latitude]) => Number.isFinite(longitude) && Number.isFinite(latitude));
  const step = Math.max(1, Math.ceil(valid.length / 28));
  const sampled = valid.filter((_, index) => index % step === 0 || index === valid.length - 1);
  const longitudes = sampled.map(point => point[0]), latitudes = sampled.map(point => point[1]);
  const minLongitude = Math.min(...longitudes), maxLongitude = Math.max(...longitudes);
  const minLatitude = Math.min(...latitudes), maxLatitude = Math.max(...latitudes);
  const longitudeSpan = Math.max(0.00001, maxLongitude - minLongitude), latitudeSpan = Math.max(0.00001, maxLatitude - minLatitude);
  const points = sampled.map(([longitude, latitude]) => ({
    x: 18 + ((longitude - minLongitude) / longitudeSpan) * (plotWidth - 36),
    y: 18 + (1 - (latitude - minLatitude) / latitudeSpan) * (plotHeight - 36),
  }));
  return <View style={styles.routeSketch}>
    <View style={styles.routeGlow} />
    {points.slice(1).map((point, index) => {
      const previous = points[index], dx = point.x - previous.x, dy = point.y - previous.y;
      const length = Math.sqrt(dx * dx + dy * dy), angle = Math.atan2(dy, dx) * 180 / Math.PI;
      return <View key={`${index}-${point.x}-${point.y}`} style={[styles.routeLine, { left: (previous.x + point.x - length) / 2, top: (previous.y + point.y) / 2 - 2, width: length, transform: [{ rotate: `${angle}deg` }] }]} />;
    })}
    {points[0] && <View style={[styles.routeStart, { left: points[0].x - 6, top: points[0].y - 6 }]} />}
    {points.at(-1) && <View style={[styles.routeEnd, { left: points.at(-1)!.x - 7, top: points.at(-1)!.y - 7 }]} />}
    <Text style={styles.routeCaption}>{points.length > 1 ? 'Recorded journey route' : 'Route preview becomes available after sync'}</Text>
  </View>;
}

function InfoRow({ label, value }: { label: string; value: string }) { return <View style={styles.infoRow}><Text style={styles.infoLabel}>{label}</Text><Text style={styles.infoValue}>{value}</Text></View>; }

function ConnectionTile({ name, detail, symbol, color, status, action, onPress }: { name: string; detail: string; symbol: string; color: string; status: string; action: string; onPress: () => void }) {
  return <Pressable onPress={onPress} style={({ pressed }) => [styles.connectionTile, pressed && styles.pressed]}><View style={[styles.connectionIcon, { backgroundColor: color }]}><Text style={styles.connectionIconText}>{symbol}</Text></View><View style={styles.flex}><Text style={styles.connectionName}>{name}</Text><Text style={styles.connectionDetail}>{detail}</Text><Text style={[styles.connectionStatus, status === 'Connected' || status === 'Enabled' ? styles.goodStatus : undefined]}>{status}</Text></View><View style={styles.connectionAction}><Text style={styles.connectionActionText}>{action}</Text></View></Pressable>;
}

function formatMiles(miles: number) { return `${miles < 10 && miles % 1 ? miles.toFixed(1) : Math.round(miles)} mi`; }
function formatDuration(minutes: number) {
  const rounded = Math.max(0, Math.round(minutes));
  return rounded >= 60 ? `${Math.floor(rounded / 60)}h ${rounded % 60}m` : `${rounded} min`;
}
function formatFullDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Journey';
  return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}
function formatCompactDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'your latest journey';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
function isToday(value: string) {
  const date = new Date(value), today = new Date();
  return !Number.isNaN(date.getTime()) && date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth() && date.getDate() === today.getDate();
}
function weeklyActivity(journeys: JourneySummary[]) {
  const today = new Date();
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today);
    date.setHours(0, 0, 0, 0);
    date.setDate(today.getDate() - (6 - index));
    return { key: date.toISOString().slice(0, 10), date, miles: 0, label: date.toLocaleDateString(undefined, { weekday: 'narrow' }), isToday: index === 6 };
  });
  for (const journey of journeys) {
    const date = new Date(journey.startedAt);
    if (Number.isNaN(date.getTime())) continue;
    const key = new Date(date.getFullYear(), date.getMonth(), date.getDate()).toISOString().slice(0, 10);
    const day = days.find(item => item.key === key);
    if (day) day.miles += journey.miles;
  }
  const maximum = Math.max(1, ...days.map(day => day.miles));
  return days.map(day => ({ ...day, ratio: day.miles / maximum }));
}
function locationPair(journey: Pick<JourneySummary, 'startingLocation' | 'endingLocation'>) {
  if (journey.startingLocation && journey.endingLocation) return `${journey.startingLocation} → ${journey.endingLocation}`;
  return journey.startingLocation || journey.endingLocation || 'Recorded journey';
}
function recorderColor(state: AppDashboard['recorder']['state'], connected: boolean) { return !connected ? '#ffb15c' : state === 'recording' ? '#43e6ae' : state === 'paused' || state === 'finishing' ? '#ffb15c' : '#9b7cff'; }
function recorderTitle(state: AppDashboard['recorder']['state'], connected: boolean) { return !connected ? 'Recorder needs connection' : state === 'recording' ? 'Recording in progress' : state === 'paused' ? 'Journey paused' : state === 'finishing' ? 'Waiting to finish' : 'Recorder ready'; }
function recorderDetail(state: AppDashboard['recorder']['state'], queued: number, queuedMusic: number) {
  const waiting = [queued ? `${queued} GPS ${queued === 1 ? 'point' : 'points'}` : '', queuedMusic ? `${queuedMusic} music ${queuedMusic === 1 ? 'item' : 'items'}` : ''].filter(Boolean);
  return waiting.length ? `${waiting.join(' and ')} safe and waiting to sync.` : state === 'recording' ? 'Background GPS is active.' : 'No saved data is waiting to sync.';
}
function statusText(status: string) { return status === 'connected' ? 'Connected' : status === 'enabled' ? 'Enabled' : status === 'needs_attention' || status === 'permission_denied' ? 'Needs attention' : status === 'not_enabled' ? 'Not enabled' : 'Not connected'; }
function nativeAppleStatus(capabilities: JourneyDeckMusicCapabilityStatus | null, stored: string) {
  if (!isJourneyDeckMusicNativeAvailable) return 'New native build required';
  if (capabilities?.appleMusicAvailable === false) return 'Apple capability unavailable';
  return capabilities?.appleMusicAuthorizationStatus === 'authorized' ? 'Connected on this iPhone' : capabilities?.appleMusicAuthorizationStatus === 'denied' || capabilities?.appleMusicAuthorizationStatus === 'restricted' ? 'Needs attention' : statusText(stored);
}
function nativeShazamStatus(capabilities: JourneyDeckMusicCapabilityStatus | null, stored: string) {
  if (!isJourneyDeckMusicNativeAvailable) return 'New native build required';
  if (capabilities?.shazamKitAvailable === false) return 'ShazamKit capability unavailable';
  return capabilities?.microphonePermissionStatus === 'authorized' ? 'Enabled on this iPhone' : capabilities?.microphonePermissionStatus === 'denied' || capabilities?.microphonePermissionStatus === 'restricted' ? 'Needs attention' : statusText(stored);
}

const styles = StyleSheet.create({
  app: { flex: 1, backgroundColor: '#08070d' }, screenBody: { flex: 1 }, recorderVisible: { flex: 1 }, recorderHidden: { display: 'none' }, flex: { flex: 1 }, safe: { flex: 1, backgroundColor: '#08070d' },
  loadingScreen: { flex: 1, backgroundColor: '#08070d', alignItems: 'center', justifyContent: 'center', gap: 14 }, loadingText: { color: '#b8afc5', fontSize: 14 },
  pageContent: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 36, gap: 16 },
  memoriesPage: { paddingTop: 24, paddingBottom: 38, gap: 16 },
  memoryPageHeader: { marginHorizontal: 20 },
  memorySectionHeader: { marginHorizontal: 20, marginTop: 5, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }, memoryLevel: { color: '#a88aff', fontSize: 9, fontWeight: '900', letterSpacing: 1.8 }, memorySectionTitle: { color: '#f5f0fb', fontSize: 19, fontWeight: '900', marginTop: 4 }, memoryHeaderActions: { flexDirection: 'row', alignItems: 'center', gap: 12 }, memoryHeaderAction: { color: '#ff8767', fontSize: 11, fontWeight: '900' },
  memoryCarouselContent: { paddingHorizontal: 20, paddingBottom: 12, gap: 14 }, memoryHeroCard: { height: 244, borderRadius: 26, overflow: 'hidden', backgroundColor: '#14101e', borderWidth: 1, borderColor: '#4c375d', padding: 20, justifyContent: 'flex-end', shadowColor: '#9b7cff', shadowOpacity: 0.25, shadowRadius: 18 }, memoryEmptyHero: { marginHorizontal: 20 }, memoryHeroShade: { position: 'absolute', left: 0, right: 0, top: 100, bottom: 0, backgroundColor: '#09071099' }, memoryHeroKicker: { color: '#ff9b7c', fontSize: 9, fontWeight: '900', letterSpacing: 1.5 }, memoryHeroTitle: { color: '#fff8ff', fontSize: 29, lineHeight: 34, fontWeight: '900', marginTop: 7, letterSpacing: -0.7 }, memoryHeroMeta: { color: '#c2b7ca', fontSize: 12, fontWeight: '700', marginTop: 7 }, memoryDots: { minHeight: 8, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6 }, memoryDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#403748' }, memoryDotActive: { width: 24, backgroundColor: '#ff795b' },
  memoryArtwork: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: '#241433', overflow: 'hidden' }, memoryArtworkNight: { backgroundColor: '#0b1630' }, memoryArtworkGlow: { position: 'absolute', width: 210, height: 210, borderRadius: 105, backgroundColor: '#8f3957', opacity: 0.52, left: '50%', marginLeft: -105, top: -78, shadowColor: '#ff7159', shadowOpacity: 0.8, shadowRadius: 30 }, memoryArtworkMoon: { position: 'absolute', width: 58, height: 58, borderRadius: 29, backgroundColor: '#ff8463', left: '50%', marginLeft: -29, top: 35, shadowColor: '#ff8463', shadowOpacity: 1, shadowRadius: 20 }, memoryArtworkLine: { position: 'absolute', width: 3, height: 185, backgroundColor: '#9d75ff', top: 80, shadowColor: '#a88aff', shadowOpacity: 1, shadowRadius: 9 }, memoryArtworkLineLeft: { left: '50%', marginLeft: -71, transform: [{ rotate: '31deg' }] }, memoryArtworkLineRight: { right: '50%', marginRight: -71, transform: [{ rotate: '-31deg' }] }, memoryArtworkDashOne: { position: 'absolute', width: 3, height: 12, backgroundColor: '#ffd0c4', left: '50%', top: 103 }, memoryArtworkDashTwo: { position: 'absolute', width: 5, height: 24, backgroundColor: '#ff8a68', left: '50%', marginLeft: -1, top: 132 }, memoryArtworkDashThree: { position: 'absolute', width: 7, height: 45, backgroundColor: '#ff795b', left: '50%', marginLeft: -2, top: 180 },
  memoryEditor: { marginHorizontal: 20, backgroundColor: '#121019', borderRadius: 22, borderWidth: 1, borderColor: '#604779', padding: 16, gap: 10 }, collectionEditor: { marginHorizontal: 20, backgroundColor: '#111018', borderRadius: 20, borderWidth: 1, borderColor: '#4a365c', padding: 15, gap: 10 }, editorKicker: { color: '#b693ff', fontSize: 9, fontWeight: '900', letterSpacing: 1.5 }, editorInput: { minHeight: 48, borderRadius: 13, borderWidth: 1, borderColor: '#3b3148', backgroundColor: '#0c0a11', color: '#f5f0f8', fontSize: 14, paddingHorizontal: 13, paddingVertical: 11 }, editorNotes: { minHeight: 76, textAlignVertical: 'top' }, editorInstruction: { color: '#8e8497', fontSize: 11, marginTop: 3 }, editorActions: { flexDirection: 'row', gap: 9, marginTop: 4 }, editorCancel: { flex: 1, minHeight: 46, borderRadius: 13, borderWidth: 1, borderColor: '#3b3345', alignItems: 'center', justifyContent: 'center' }, editorCancelText: { color: '#b5acbd', fontSize: 12, fontWeight: '800' }, editorSave: { flex: 1.4, minHeight: 46, borderRadius: 13, backgroundColor: '#ff795b', alignItems: 'center', justifyContent: 'center' }, editorSaveText: { color: '#1b0b07', fontSize: 12, fontWeight: '900' },
  membershipRow: { minHeight: 58, borderRadius: 14, borderWidth: 1, borderColor: '#302839', backgroundColor: '#0d0b12', flexDirection: 'row', alignItems: 'center', gap: 10, padding: 11 }, membershipRowSelected: { borderColor: '#6e4f91', backgroundColor: '#191124' }, membershipCheck: { width: 27, height: 27, borderRadius: 14, borderWidth: 1, borderColor: '#5c5067', alignItems: 'center', justifyContent: 'center' }, membershipCheckSelected: { borderColor: '#43e6ae', backgroundColor: '#123128' }, membershipCheckText: { color: '#a995ba', fontWeight: '900' }, membershipTitle: { color: '#f0eaf5', fontSize: 12, fontWeight: '800' }, membershipDetail: { color: '#7e7487', fontSize: 9, marginTop: 3 }, membershipAction: { color: '#9d7de3', fontSize: 9, fontWeight: '900' }, membershipActionRemove: { color: '#ff9a7b' },
  memoryCollectionCard: { marginHorizontal: 20, minHeight: 98, borderRadius: 20, borderWidth: 1, borderColor: '#2e2738', backgroundColor: '#111018', padding: 13, flexDirection: 'row', alignItems: 'center', gap: 12 }, collectionArtwork: { width: 68, height: 68, borderRadius: 16, overflow: 'hidden' }, collectionArtworkOrb: { position: 'absolute', width: 42, height: 42, borderRadius: 21, opacity: 0.65, right: -8, top: -8, shadowOpacity: 0.8, shadowRadius: 10 }, collectionArtworkRoute: { position: 'absolute', width: 58, height: 3, borderRadius: 2, left: 5, top: 39, transform: [{ rotate: '-25deg' }] }, collectionKicker: { color: '#89779c', fontSize: 8, fontWeight: '900', letterSpacing: 1.2 }, collectionTitle: { color: '#f5eff9', fontSize: 15, fontWeight: '900', marginTop: 5 }, collectionMeta: { color: '#8b8293', fontSize: 10, lineHeight: 14, marginTop: 4 }, collectionManage: { borderRadius: 999, backgroundColor: '#251934', paddingHorizontal: 9, paddingVertical: 7 }, collectionManageText: { color: '#bc96ff', fontSize: 8, fontWeight: '900' }, managingPill: { color: '#66efc2', fontSize: 8, fontWeight: '900', letterSpacing: 1, borderWidth: 1, borderColor: '#295f4e', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 6 }, journeyManageHelp: { marginHorizontal: 20, color: '#948a9e', fontSize: 11, lineHeight: 17 }, memoryJourneyWrap: { marginHorizontal: 20, gap: 7 }, journeyMembershipButton: { minHeight: 40, borderRadius: 12, borderWidth: 1, borderColor: '#5d4380', backgroundColor: '#1b1327', alignItems: 'center', justifyContent: 'center' }, journeyMembershipRemove: { borderColor: '#704037', backgroundColor: '#29130f' }, journeyMembershipText: { color: '#c3a5ff', fontSize: 10, fontWeight: '900' }, journeyMembershipRemoveText: { color: '#ff9c80' },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 4 }, brandCompact: { marginBottom: 14 }, logo: { width: 46, height: 46, borderRadius: 15, backgroundColor: '#ff7b54', alignItems: 'center', justifyContent: 'center', shadowColor: '#ff7b54', shadowOpacity: 0.28, shadowRadius: 14 }, logoText: { color: '#fff', fontSize: 24, fontWeight: '900' }, brandEyebrow: { color: '#91899f', fontSize: 10, fontWeight: '900', letterSpacing: 2 }, brandTitle: { color: '#f8f4ff', fontSize: 20, fontWeight: '800', marginTop: 2 },
  pageHeader: { gap: 5, marginBottom: 4 }, pageEyebrow: { color: '#a88aff', fontSize: 10, fontWeight: '900', letterSpacing: 1.6 }, pageTitle: { color: '#f8f5ff', fontSize: 34, fontWeight: '900', letterSpacing: -1 }, pageBody: { color: '#9890a6', fontSize: 14, lineHeight: 21, maxWidth: 350 },
  heroCard: { backgroundColor: '#191221', borderWidth: 1, borderColor: '#654474', borderRadius: 26, padding: 20, gap: 8, overflow: 'hidden', shadowColor: '#9b7cff', shadowOpacity: 0.2, shadowRadius: 24 }, heroGlowOrange: { position: 'absolute', width: 170, height: 170, borderRadius: 85, backgroundColor: '#5a241d', opacity: 0.32, right: -70, top: -75 }, heroGlowPurple: { position: 'absolute', width: 210, height: 210, borderRadius: 105, backgroundColor: '#36205b', opacity: 0.32, left: -100, bottom: -145 }, heroEyebrow: { color: '#ff9a7a', fontSize: 10, fontWeight: '900', letterSpacing: 1.5 }, heroTitle: { color: '#fff', fontSize: 27, fontWeight: '900', letterSpacing: -0.6 }, heroBody: { color: '#aca3b6', fontSize: 14, lineHeight: 20 }, heroMetrics: { flexDirection: 'row', backgroundColor: '#100c16dd', borderRadius: 17, marginTop: 10, paddingVertical: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: '#493853' },
  openRoad: { height: 132, marginHorizontal: -20, marginTop: -20, marginBottom: 8, backgroundColor: '#0d0a16', overflow: 'hidden', borderTopLeftRadius: 25, borderTopRightRadius: 25 }, roadSunGlow: { position: 'absolute', width: 128, height: 128, borderRadius: 64, backgroundColor: '#7b2b31', opacity: 0.25, left: '50%', marginLeft: -64, top: -35, shadowColor: '#ff7257', shadowOpacity: 0.85, shadowRadius: 30 }, roadSun: { position: 'absolute', width: 44, height: 44, borderRadius: 22, backgroundColor: '#ff765a', opacity: 0.9, left: '50%', marginLeft: -22, top: 18, shadowColor: '#ff765a', shadowOpacity: 1, shadowRadius: 18 }, roadStar: { position: 'absolute', width: 3, height: 3, borderRadius: 2, backgroundColor: '#c7b5ff', shadowColor: '#b292ff', shadowOpacity: 1, shadowRadius: 5 }, roadStarOne: { left: 38, top: 25 }, roadStarTwo: { right: 54, top: 19 }, roadStarThree: { right: 95, top: 43, width: 2, height: 2 }, roadHorizon: { position: 'absolute', left: 18, right: 18, top: 58, height: 1, backgroundColor: '#764e93', opacity: 0.72, shadowColor: '#a88aff', shadowOpacity: 0.8, shadowRadius: 6 }, roadSurface: { position: 'absolute', width: 0, height: 0, borderLeftWidth: 145, borderRightWidth: 145, borderBottomWidth: 82, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: '#090810', left: '50%', marginLeft: -145, top: 54 }, roadEdge: { position: 'absolute', width: 2, height: 94, backgroundColor: '#9d70ff', top: 53, shadowColor: '#a88aff', shadowOpacity: 1, shadowRadius: 9 }, roadEdgeLeft: { left: '50%', marginLeft: -48, transform: [{ rotate: '47deg' }] }, roadEdgeRight: { right: '50%', marginRight: -48, transform: [{ rotate: '-47deg' }] }, roadDash: { position: 'absolute', left: '50%', backgroundColor: '#ff8767', shadowColor: '#ff765a', shadowOpacity: 1, shadowRadius: 8 }, roadDashFar: { width: 2, height: 7, marginLeft: -1, top: 64 }, roadDashMiddle: { width: 3, height: 13, marginLeft: -2, top: 79 }, roadDashNear: { width: 5, height: 22, marginLeft: -3, top: 105 }, roadSoundwave: { position: 'absolute', flexDirection: 'row', alignItems: 'center', gap: 3, left: 18, top: 18, height: 20 }, roadSoundBarSmall: { width: 2, height: 6, borderRadius: 2, backgroundColor: '#43e6ae' }, roadSoundBarMedium: { width: 2, height: 12, borderRadius: 2, backgroundColor: '#43e6ae' }, roadSoundBarTall: { width: 2, height: 18, borderRadius: 2, backgroundColor: '#43e6ae' }, roadCaption: { position: 'absolute', right: 17, bottom: 10, color: '#9f8ab8', fontSize: 7, fontWeight: '900', letterSpacing: 1.4 },
  pulseCard: { backgroundColor: '#0f0d15', borderRadius: 22, borderWidth: 1, borderColor: '#332943', padding: 16, shadowColor: '#9b7cff', shadowOpacity: 0.14, shadowRadius: 18 }, pulseHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, pulseKicker: { color: '#a88aff', fontSize: 8, fontWeight: '900', letterSpacing: 1.3 }, pulseTitle: { color: '#f4eff9', fontSize: 16, fontWeight: '900', marginTop: 4 }, livePill: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderColor: '#285d4c', backgroundColor: '#10251f', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 5 }, liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#43e6ae', shadowColor: '#43e6ae', shadowOpacity: 1, shadowRadius: 6 }, liveText: { color: '#70f1c5', fontSize: 7, fontWeight: '900', letterSpacing: 1 }, pulseChart: { height: 105, flexDirection: 'row', alignItems: 'flex-end', gap: 9, marginTop: 17 }, pulseColumn: { flex: 1, height: '100%', alignItems: 'center', justifyContent: 'flex-end', gap: 7 }, pulseTrack: { width: 16, flex: 1, justifyContent: 'flex-end', borderRadius: 8, backgroundColor: '#191522', overflow: 'hidden' }, pulseBar: { width: '100%', minHeight: 7, borderRadius: 8, backgroundColor: '#7c55d9', shadowColor: '#a88aff', shadowOpacity: 0.9, shadowRadius: 7 }, pulseBarCap: { height: 4, backgroundColor: '#c6b2ff', opacity: 0.9 }, pulseDay: { color: '#696171', fontSize: 8, fontWeight: '800' }, pulseDayToday: { color: '#ff8a68' }, pulseFooter: { flexDirection: 'row', alignItems: 'baseline', gap: 7, marginTop: 13, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#31293a' }, pulseFooterValue: { color: '#f5f0fb', fontSize: 17, fontWeight: '900' }, pulseFooterLabel: { color: '#7e7687', fontSize: 10 },
  dashboardGrid: { flexDirection: 'row', gap: 10 }, dashboardStatCard: { flex: 1, minHeight: 150, backgroundColor: '#121019', borderRadius: 20, borderWidth: 1, borderColor: '#2d2638', padding: 14 }, dashboardStatIcon: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center', marginBottom: 12 }, dashboardStatSymbol: { fontSize: 18, fontWeight: '900' }, dashboardStatKicker: { color: '#817789', fontSize: 8, fontWeight: '900', letterSpacing: 1 }, dashboardStatValue: { color: '#f7f2fc', fontSize: 20, fontWeight: '900', marginTop: 7 }, dashboardStatDetail: { color: '#8d8596', fontSize: 10, lineHeight: 15, marginTop: 5 },
  insightStrip: { flexDirection: 'row', gap: 10 }, insightCard: { flex: 1, minHeight: 152, backgroundColor: '#111018', borderRadius: 20, borderWidth: 1, borderColor: '#2d2638', padding: 14, overflow: 'hidden' }, insightRoute: { height: 42, marginBottom: 9 }, insightRouteLine: { position: 'absolute', width: 105, height: 3, borderRadius: 2, backgroundColor: '#9b7cff', left: 10, top: 19, transform: [{ rotate: '-12deg' }], shadowColor: '#9b7cff', shadowOpacity: 0.9, shadowRadius: 7 }, insightRouteStart: { position: 'absolute', width: 10, height: 10, borderRadius: 5, backgroundColor: '#43e6ae', left: 7, top: 27, shadowColor: '#43e6ae', shadowOpacity: 1, shadowRadius: 6 }, insightRouteEnd: { position: 'absolute', width: 11, height: 11, borderRadius: 6, backgroundColor: '#ff7b54', left: 112, top: 5, shadowColor: '#ff7b54', shadowOpacity: 1, shadowRadius: 7 }, musicRings: { height: 42, justifyContent: 'center', marginBottom: 9 }, musicRingOuter: { width: 42, height: 42, borderRadius: 21, borderWidth: 1, borderColor: '#664c9d', backgroundColor: '#1b1427', alignItems: 'center', justifyContent: 'center', shadowColor: '#a88aff', shadowOpacity: 0.5, shadowRadius: 9 }, musicRingInner: { width: 28, height: 28, borderRadius: 14, borderWidth: 1, borderColor: '#9b7cff', backgroundColor: '#281b3a', alignItems: 'center', justifyContent: 'center' }, musicRingNote: { color: '#c2aaff', fontSize: 14, fontWeight: '900' }, insightKicker: { color: '#817789', fontSize: 8, fontWeight: '900', letterSpacing: 1 }, insightValue: { color: '#f5f0fb', fontSize: 22, fontWeight: '900', marginTop: 5 }, insightDetail: { color: '#81798a', fontSize: 9, lineHeight: 14, marginTop: 4 },
  quickActions: { flexDirection: 'row', gap: 9 }, quickAction: { flex: 1, minHeight: 105, backgroundColor: '#121019', borderRadius: 18, borderWidth: 1, borderColor: '#2b2534', padding: 13, justifyContent: 'flex-end' }, quickActionSymbol: { fontSize: 21, fontWeight: '900', marginBottom: 12 }, quickActionTitle: { color: '#f0ebf5', fontSize: 13, fontWeight: '900' }, quickActionDetail: { color: '#777080', fontSize: 9, marginTop: 4 },
  vehicleCard: { flexDirection: 'row', alignItems: 'center', gap: 13, backgroundColor: '#121019', borderRadius: 20, borderWidth: 1, borderColor: '#2c2635', padding: 15 }, vehicleIcon: { width: 50, height: 50, borderRadius: 16, backgroundColor: '#2b1f40', alignItems: 'center', justifyContent: 'center' }, vehicleIconText: { color: '#b795ff', fontSize: 20, fontWeight: '900' }, vehicleKicker: { color: '#8b74c3', fontSize: 8, fontWeight: '900', letterSpacing: 1 }, vehicleName: { color: '#f4eff8', fontSize: 16, fontWeight: '900', marginTop: 5 }, vehicleDetail: { color: '#898190', fontSize: 11, lineHeight: 16, marginTop: 4 }, connectionDot: { width: 10, height: 10, borderRadius: 5 },
  dataHealthCard: { backgroundColor: '#111018', borderRadius: 20, borderWidth: 1, borderColor: '#292331', paddingHorizontal: 15 }, dashboardHealthRow: { minHeight: 62, flexDirection: 'row', alignItems: 'center', gap: 11, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#302a38' }, dashboardHealthDot: { width: 9, height: 9, borderRadius: 5 }, dashboardHealthLabel: { color: '#eee9f3', fontSize: 12, fontWeight: '800' }, dashboardHealthDetail: { color: '#7f7788', fontSize: 10, lineHeight: 14, marginTop: 3 }, dashboardHealthState: { fontSize: 8, fontWeight: '900', letterSpacing: 1 },
  metric: { flex: 1, alignItems: 'center', gap: 5 }, metricValue: { color: '#f5f0fb', fontSize: 17, fontWeight: '800', fontVariant: ['tabular-nums'] }, metricLabel: { color: '#756c82', fontSize: 8, fontWeight: '900', letterSpacing: 1 },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }, sectionTitle: { color: '#f5f1fa', fontSize: 18, fontWeight: '800' }, sectionAction: { color: '#a88aff', fontSize: 12, fontWeight: '800' }, sectionActionMuted: { color: '#777080' },
  soundtrackCard: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#121019', borderRadius: 20, borderWidth: 1, borderColor: '#2c2538', padding: 14 }, emptyArtwork: { width: 72, height: 72, borderRadius: 16, backgroundColor: '#2a1b38', alignItems: 'center', justifyContent: 'center' }, emptyArtworkNote: { color: '#b391ff', fontSize: 31, fontWeight: '800' }, soundtrackLabel: { color: '#9a7ee5', fontSize: 9, fontWeight: '900', letterSpacing: 1.1 }, soundtrackTitle: { color: '#f8f5ff', fontSize: 16, fontWeight: '800', marginTop: 5 }, soundtrackArtist: { color: '#8e8798', fontSize: 12, marginTop: 4 },
  recorderHealth: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#111018', borderRadius: 17, padding: 15, borderWidth: 1, borderColor: '#272331' }, healthDot: { width: 10, height: 10, borderRadius: 5 }, healthTitle: { color: '#eae5f0', fontSize: 14, fontWeight: '800' }, healthBody: { color: '#827b8c', fontSize: 11, lineHeight: 16, marginTop: 2 }, healthPoints: { color: '#9b7cff', fontSize: 16, fontWeight: '800' },
  primaryAction: { minHeight: 58, borderRadius: 18, backgroundColor: '#ff7b54', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 }, primaryActionText: { color: '#190b07', fontSize: 16, fontWeight: '900' }, pressed: { opacity: 0.62 },
  journeyCard: { backgroundColor: '#121019', borderRadius: 21, borderWidth: 1, borderColor: '#292334', padding: 16, gap: 11 }, journeyTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 }, journeyDate: { color: '#8f819e', fontSize: 10, fontWeight: '900', letterSpacing: 1 }, journeyRoute: { color: '#f3eef8', fontSize: 17, fontWeight: '800', marginTop: 6, maxWidth: 290 }, journeyChevron: { color: '#6f667a', fontSize: 28, lineHeight: 30 }, journeyStats: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 7 }, journeyStat: { color: '#a9a1b2', fontSize: 12, fontWeight: '600' }, journeyStatDot: { color: '#4e4657', fontSize: 10 }, journeySoundtrack: { flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#332c3d', paddingTop: 11 }, journeySong: { color: '#e7e1ed', fontSize: 13, fontWeight: '700' }, journeyArtist: { color: '#827a8c', fontSize: 11, marginTop: 3 }, songCount: { color: '#9b7cff', fontSize: 12, fontWeight: '900' }, miniArtwork: { width: 42, height: 42, borderRadius: 10, backgroundColor: '#281b36', alignItems: 'center', justifyContent: 'center' }, miniArtworkText: { color: '#aa89ff', fontSize: 18, fontWeight: '900' }, artworkFallback: { backgroundColor: '#2a1d38', alignItems: 'center', justifyContent: 'center' }, artworkFallbackText: { color: '#b694ff', fontWeight: '900' },
  emptyCard: { alignItems: 'center', backgroundColor: '#111018', borderRadius: 21, borderWidth: 1, borderColor: '#272331', padding: 24 }, emptyCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#231a30', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }, emptyCircleText: { color: '#9b7cff', fontWeight: '900', fontSize: 17 }, emptyTitle: { color: '#eee9f5', fontSize: 16, fontWeight: '800' }, emptyBody: { color: '#8b8395', fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 6, maxWidth: 300 },
  loadMoreButton: { minHeight: 50, alignItems: 'center', justifyContent: 'center', borderRadius: 15, borderWidth: 1, borderColor: '#3a3048', backgroundColor: '#15111d' }, loadMoreText: { color: '#b59cff', fontSize: 13, fontWeight: '900' },
  inlineNotice: { flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: '#21180f', borderWidth: 1, borderColor: '#714c25', borderRadius: 15, padding: 12 }, noticeDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#ffb15c' }, inlineNoticeText: { color: '#c1af9a', fontSize: 11, lineHeight: 16, flex: 1 }, retryText: { color: '#ffb15c', fontSize: 11, fontWeight: '900' }, loadingLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, minHeight: 28 }, loadingLineText: { color: '#8f8799', fontSize: 12 }, loadingCard: { minHeight: 180, alignItems: 'center', justifyContent: 'center', gap: 13, backgroundColor: '#111018', borderRadius: 20 },
  detailDate: { color: '#a88aff', fontSize: 10, fontWeight: '900', letterSpacing: 1.3 }, detailTitle: { color: '#f8f4ff', fontSize: 25, lineHeight: 31, fontWeight: '900', letterSpacing: -0.5 }, backButton: { alignSelf: 'flex-start', paddingVertical: 6 }, backButtonText: { color: '#aa8cff', fontSize: 14, fontWeight: '800' }, routeSketch: { height: 190, borderRadius: 22, overflow: 'hidden', backgroundColor: '#10121a', borderWidth: 1, borderColor: '#252c3b' }, routeGlow: { position: 'absolute', width: 180, height: 180, borderRadius: 90, backgroundColor: '#171d32', right: -35, top: -30 }, routeLine: { position: 'absolute', height: 4, borderRadius: 2, backgroundColor: '#9b7cff' }, routeStart: { position: 'absolute', width: 12, height: 12, borderRadius: 6, backgroundColor: '#43e6ae' }, routeEnd: { position: 'absolute', width: 14, height: 14, borderRadius: 7, backgroundColor: '#ff7b54' }, routeCaption: { position: 'absolute', color: '#70798d', fontSize: 10, bottom: 12, left: 16 }, detailMetrics: { flexDirection: 'row', paddingVertical: 17, borderRadius: 18, backgroundColor: '#121019' },
  trackRow: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 8 }, trackIndex: { width: 21, color: '#696272', fontSize: 10, fontWeight: '700', fontVariant: ['tabular-nums'] }, trackTitle: { color: '#eee9f3', fontSize: 13, fontWeight: '800' }, trackArtist: { color: '#837b8c', fontSize: 11, marginTop: 4 }, infoCard: { backgroundColor: '#121019', borderRadius: 18, paddingHorizontal: 16 }, infoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 15, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#302a38' }, infoLabel: { color: '#776f81', fontSize: 9, fontWeight: '900', letterSpacing: 1 }, infoValue: { color: '#ece6f1', fontSize: 13, fontWeight: '700' },
  selectedProvider: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#131019', borderWidth: 1, borderRadius: 21, padding: 15 }, connectionTile: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#121019', borderWidth: 1, borderColor: '#292333', borderRadius: 18, padding: 14 }, connectionIcon: { width: 44, height: 44, borderRadius: 13, alignItems: 'center', justifyContent: 'center' }, connectionIconText: { color: '#fff', fontSize: 16, fontWeight: '900' }, connectionKicker: { color: '#7e7489', fontSize: 8, fontWeight: '900', letterSpacing: 1.2 }, connectionName: { color: '#f1ecf6', fontSize: 15, fontWeight: '800', marginTop: 2 }, connectionDetail: { color: '#888091', fontSize: 11, lineHeight: 16, marginTop: 3 }, connectionStatus: { color: '#938999', fontSize: 10, fontWeight: '800', marginTop: 5 }, goodStatus: { color: '#43e6ae' }, connectionAction: { backgroundColor: '#211a2c', borderRadius: 10, paddingHorizontal: 9, paddingVertical: 8 }, connectionActionText: { color: '#b59cff', fontSize: 9, fontWeight: '900' }, changeButton: { paddingHorizontal: 11, paddingVertical: 8, borderRadius: 10, backgroundColor: '#211a2c' }, changeButtonText: { color: '#b59cff', fontSize: 11, fontWeight: '900' }, securityCard: { backgroundColor: '#17121b', borderLeftWidth: 3, borderLeftColor: '#9b7cff', borderRadius: 14, padding: 15, marginTop: 5 }, securityTitle: { color: '#c2b3ff', fontSize: 9, fontWeight: '900', letterSpacing: 1.2 }, securityBody: { color: '#918897', fontSize: 12, lineHeight: 18, marginTop: 5 },
  setupCard: { gap: 11, backgroundColor: '#171019', borderWidth: 1, borderColor: '#4e2831', borderRadius: 18, padding: 15 }, setupTitle: { color: '#ff7b82', fontSize: 9, fontWeight: '900', letterSpacing: 1.2 }, setupBody: { color: '#9b929f', fontSize: 12, lineHeight: 18 }, setupInput: { minHeight: 48, borderRadius: 13, borderWidth: 1, borderColor: '#3c3443', backgroundColor: '#0e0c12', color: '#f4eef8', paddingHorizontal: 14, fontSize: 15 }, setupWarning: { color: '#ffb15c', fontSize: 11, lineHeight: 16 }, setupSync: { minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderWidth: 1, borderColor: '#63313a', backgroundColor: '#281318' }, setupSyncText: { color: '#ff8c93', fontSize: 12, fontWeight: '900' }, setupActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 }, setupSecondary: { minHeight: 40, minWidth: 88, alignItems: 'center', justifyContent: 'center', borderRadius: 11, backgroundColor: '#241f29' }, setupSecondaryText: { color: '#a79daa', fontSize: 12, fontWeight: '800' }, setupPrimary: { minHeight: 40, minWidth: 88, alignItems: 'center', justifyContent: 'center', borderRadius: 11, backgroundColor: '#f23d47' }, setupPrimaryText: { color: '#fff', fontSize: 12, fontWeight: '900' },
  navSafe: { backgroundColor: '#0d0b12' }, bottomNav: { minHeight: 66, flexDirection: 'row', backgroundColor: '#0d0b12', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#2a2432' }, navItem: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3 }, navSymbol: { color: '#675f70', fontSize: 19, fontWeight: '800' }, navLabel: { color: '#675f70', fontSize: 9, fontWeight: '800' }, navActive: { color: '#a88aff' },
  onboardingSafe: { flex: 1, backgroundColor: '#08070d' }, onboardingContent: { paddingHorizontal: 22, paddingTop: 24, paddingBottom: 36 }, onboardingEyebrow: { color: '#ff8a68', fontSize: 10, fontWeight: '900', letterSpacing: 1.5, marginTop: 4 }, onboardingTitle: { color: '#f9f5ff', fontSize: 31, lineHeight: 36, fontWeight: '900', letterSpacing: -0.9, marginTop: 7 }, onboardingBody: { color: '#9b92a5', fontSize: 14, lineHeight: 21, marginTop: 9 }, providerTabs: { flexDirection: 'row', gap: 9, marginTop: 18, marginBottom: 14 }, providerTab: { flex: 1, minHeight: 42, borderRadius: 13, borderWidth: 1, borderColor: '#2c2735', backgroundColor: '#111018', alignItems: 'center', justifyContent: 'center' }, providerTabText: { color: '#777080', fontSize: 14, fontWeight: '900' }, providerCarousel: { gap: 12 }, providerCard: { backgroundColor: '#121019', borderWidth: 1, borderRadius: 24, padding: 18, gap: 15 }, providerCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 }, providerIcon: { width: 50, height: 50, borderRadius: 15, alignItems: 'center', justifyContent: 'center' }, providerIconText: { color: '#fff', fontSize: 19, fontWeight: '900' }, providerKicker: { fontSize: 8, fontWeight: '900', letterSpacing: 1.1 }, providerName: { color: '#fff', fontSize: 21, fontWeight: '900', marginTop: 3 }, providerSummary: { color: '#aaa2b4', fontSize: 13, lineHeight: 20 }, prosCons: { gap: 8 }, prosConsTitle: { fontSize: 8, fontWeight: '900', letterSpacing: 1.1 }, proRow: { flexDirection: 'row', alignItems: 'center', gap: 9 }, proBullet: { width: 20, height: 20, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' }, proBulletText: { fontSize: 12, fontWeight: '900', lineHeight: 15 }, proText: { color: '#d2cbd9', fontSize: 12, flex: 1 }, privacyNote: { borderRadius: 14, padding: 12 }, privacyTitle: { fontSize: 8, fontWeight: '900', letterSpacing: 1 }, privacyCopy: { color: '#9d94a5', fontSize: 11, lineHeight: 16, marginTop: 4 }, pageDots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginVertical: 14 }, pageDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#39313f' }, cancelButton: { alignItems: 'center', padding: 14 }, cancelButtonText: { color: '#9d91ae', fontSize: 12, fontWeight: '800' }, providerFootnote: { color: '#6e6875', fontSize: 10, lineHeight: 15, textAlign: 'center', marginTop: 12, paddingHorizontal: 12 },
});
