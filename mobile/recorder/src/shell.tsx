import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator, Alert, AppState, Image, Pressable, SafeAreaView, ScrollView, StatusBar,
  StyleSheet, Text, TextInput, View, useWindowDimensions,
} from 'react-native';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';

import {
  appDataClient, type AppDashboard, type ConnectionCapabilities, type JourneyDetail, type JourneySummary, type ProviderPreferences,
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
  };
}

export function JourneyDeckShell({ recorder }: { recorder: ReactNode }) {
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
  const [journeyDetail, setJourneyDetail] = useState<LoadState<JourneyDetail | null>>({ status: 'ready', data: null });
  const preferenceSyncAttempt = useRef('');

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
  useEffect(() => { if (tab === 'journeys') void refreshJourneys(); }, [refreshJourneys, tab]);
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

  const saveConnectionState = useCallback(async (next: Partial<ProviderPreferences['connections']>) => {
    const existing = await appDataClient.providerPreferences().catch(() => null);
    await appDataClient.updateProviderPreferences({
      musicProvider: preferences?.provider ? toApiMusicProvider(preferences.provider) : null,
      onboardingCompleted: Boolean(preferences?.onboardingCompleted),
      connections: { ...(existing?.connections ?? defaultConnections), ...next },
    }).catch(() => null);
    await refreshDashboard();
  }, [preferences, refreshDashboard]);

  const connectAppleMusic = useCallback(async () => {
    if (!isJourneyDeckMusicNativeAvailable || musicCapabilities?.appleMusicAvailable === false) {
      Alert.alert('Apple Music is not ready', 'Apple Music needs the new native JourneyDeck build and its Apple developer capability before it can ask for access.');
      return;
    }
    try {
      const status = await authorizeAppleMusic();
      await refreshMusicCapabilities();
      await saveConnectionState({ appleMusic: status === 'authorized' ? 'connected' : status === 'denied' || status === 'restricted' ? 'needs_attention' : 'not_connected' });
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
          onContinue={chooseProvider}
          onCancel={preferences.onboardingCompleted ? () => setEditingProvider(false) : undefined}
        />}
        {activePreferences && tab === 'home' && <HomeScreen state={dashboard} onRecord={() => openTab('record')} onConnections={() => openTab('connections')} onJourney={id => { setTab('journeys'); setSelectedJourneyId(id); }} onRefresh={refreshDashboard} />}
        {activePreferences && tab === 'journeys' && (selectedJourneyId
          ? <JourneyDetailScreen state={journeyDetail} onBack={() => setSelectedJourneyId(null)} onRetry={() => setDetailRefresh(value => value + 1)} />
          : <JourneysScreen state={journeys} hasMore={Boolean(journeyCursor)} loadingMore={journeysLoadingMore} onJourney={setSelectedJourneyId} onRefresh={refreshJourneys} onLoadMore={() => void loadMoreJourneys()} />)}
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
  const carousel = useRef<ScrollView>(null);
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

function HomeScreen({ state, onRecord, onConnections, onJourney, onRefresh }: { state: LoadState<AppDashboard>; onRecord: () => void; onConnections: () => void; onJourney: (id: string) => void; onRefresh: () => void }) {
  const { data } = state;
  const week = data.summary.last7Days;
  const latestTrack = data.latestJourney?.soundtrackPreview?.[0];
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.pageContent} showsVerticalScrollIndicator={false}>
        <BrandHeader />
        {state.status === 'error' && <InlineNotice message={state.message!} onRetry={onRefresh} />}
        <View style={styles.heroCard}>
          <Text style={styles.heroEyebrow}>YOUR WEEK IN MOTION</Text>
          <Text style={styles.heroTitle}>{week.journeyCount ? `${week.journeyCount} ${week.journeyCount === 1 ? 'journey' : 'journeys'}` : 'Your road is waiting'}</Text>
          <Text style={styles.heroBody}>{week.journeyCount ? `${formatMiles(week.miles)} with ${week.songCount} soundtrack ${week.songCount === 1 ? 'song' : 'songs'}.` : 'Record a drive and JourneyDeck will bring its route, vehicle, and music together.'}</Text>
          <View style={styles.heroMetrics}>
            <Metric value={formatMiles(week.miles)} label="DISTANCE" />
            <Metric value={formatDuration(week.minutes)} label="DRIVE TIME" />
            <Metric value={String(week.songCount)} label="SONGS" />
          </View>
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

        <SectionHeading title="Latest journey" action={data.latestJourney ? 'View' : undefined} onAction={data.latestJourney ? () => onJourney(data.latestJourney!.id) : undefined} />
        {data.latestJourney ? <JourneyCard journey={data.latestJourney} onPress={() => onJourney(data.latestJourney!.id)} /> : <EmptyCard title="No journeys yet" body="Your completed recordings will collect here with their soundtrack and vehicle context." />}

        <View style={styles.recorderHealth}>
          <View style={[styles.healthDot, { backgroundColor: recorderColor(data.recorder.state, data.recorder.connected) }]} />
          <View style={styles.flex}><Text style={styles.healthTitle}>{recorderTitle(data.recorder.state, data.recorder.connected)}</Text><Text style={styles.healthBody}>{recorderDetail(data.recorder.state, data.recorder.queuedPoints, data.recorder.queuedMusic)}</Text></View>
          <Text style={styles.healthPoints}>{data.recorder.capturedPoints || ''}</Text>
        </View>
        <PrimaryAction label={data.recorder.state === 'recording' ? 'Open active recording' : 'Start a journey'} onPress={onRecord} />
        {state.status === 'loading' && <LoadingLine label="Refreshing your dashboard…" />}
      </ScrollView>
    </SafeAreaView>
  );
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
    { id: 'journeys', label: 'Journeys', symbol: '≋' },
    { id: 'record', label: 'Record', symbol: '●' },
    { id: 'connections', label: 'Connect', symbol: '◎' },
  ];
  return <View style={styles.bottomNav}>{items.map(item => <Pressable key={item.id} onPress={() => onSelect(item.id)} accessibilityRole="tab" accessibilityState={{ selected: active === item.id }} style={styles.navItem}><Text style={[styles.navSymbol, active === item.id && styles.navActive]}>{item.symbol}</Text><Text style={[styles.navLabel, active === item.id && styles.navActive]}>{item.label}</Text></Pressable>)}</View>;
}

function BrandHeader({ compact = false }: { compact?: boolean }) {
  return <View style={[styles.brandRow, compact && styles.brandCompact]}><View style={styles.logo}><Text style={styles.logoText}>J</Text></View><View><Text style={styles.brandEyebrow}>JOURNEYDECK</Text><Text style={styles.brandTitle}>{compact ? 'Your drive, remembered.' : 'Good to see you.'}</Text></View></View>;
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
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 4 }, brandCompact: { marginBottom: 14 }, logo: { width: 46, height: 46, borderRadius: 15, backgroundColor: '#ff7b54', alignItems: 'center', justifyContent: 'center', shadowColor: '#ff7b54', shadowOpacity: 0.28, shadowRadius: 14 }, logoText: { color: '#fff', fontSize: 24, fontWeight: '900' }, brandEyebrow: { color: '#91899f', fontSize: 10, fontWeight: '900', letterSpacing: 2 }, brandTitle: { color: '#f8f4ff', fontSize: 20, fontWeight: '800', marginTop: 2 },
  pageHeader: { gap: 5, marginBottom: 4 }, pageEyebrow: { color: '#a88aff', fontSize: 10, fontWeight: '900', letterSpacing: 1.6 }, pageTitle: { color: '#f8f5ff', fontSize: 34, fontWeight: '900', letterSpacing: -1 }, pageBody: { color: '#9890a6', fontSize: 14, lineHeight: 21, maxWidth: 350 },
  heroCard: { backgroundColor: '#191221', borderWidth: 1, borderColor: '#4c3758', borderRadius: 26, padding: 20, gap: 8, overflow: 'hidden' }, heroEyebrow: { color: '#ff9a7a', fontSize: 10, fontWeight: '900', letterSpacing: 1.5 }, heroTitle: { color: '#fff', fontSize: 27, fontWeight: '900', letterSpacing: -0.6 }, heroBody: { color: '#aca3b6', fontSize: 14, lineHeight: 20 }, heroMetrics: { flexDirection: 'row', backgroundColor: '#100c16', borderRadius: 17, marginTop: 10, paddingVertical: 14 },
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
