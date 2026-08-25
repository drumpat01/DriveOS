import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  AccessibilityInfo, ActivityIndicator, Alert, Animated, AppState, Image, ImageBackground, Modal, PanResponder, Pressable, SafeAreaView, ScrollView, StatusBar,
  StyleSheet, Text, TextInput, View, useWindowDimensions,
} from 'react-native';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import * as Updates from 'expo-updates';
import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from 'expo-glass-effect';
import { SymbolView, type SFSymbol } from 'expo-symbols';

import {
  appDataClient, type AppDashboard, type ConnectionCapabilities, type JourneyCollection, type JourneyDetail,
  type JourneyMemory, type JourneyPhoto, type JourneySummary, type MemoriesCatalog, type ProviderPreferences,
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
import {
  loadRecordingModePreferences, saveRecordingModePreferences, type RecordingMode,
  type RecordingModePreferences,
} from './recording-mode';
import { ShareCardModal, type ShareCardPayload } from './share-card-modal';
import { MusicScreen, type MusicDashboardState } from './music-screen';
import { navigationGeometry, navigationIndexAtX, navigationIndicatorX, navigationTabX } from './navigation-motion';

type Tab = 'home' | 'journeys' | 'music' | 'record' | 'connections';
type LoadState<T> = { status: 'loading' | 'ready' | 'error'; data: T; message?: string };

const bottomNavigationItems: { id: Tab; label: string; symbol: SFSymbol; fallback: string }[] = [
  { id: 'home', label: 'Home', symbol: 'house', fallback: '⌂' },
  { id: 'journeys', label: 'Memories', symbol: 'map', fallback: '≋' },
  { id: 'music', label: 'Music', symbol: 'music.note', fallback: '♪' },
  { id: 'record', label: 'Record', symbol: 'record.circle', fallback: '●' },
  { id: 'connections', label: 'Connect', symbol: 'link', fallback: '∞' },
];

async function choosePhoto() {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) throw new Error('Allow JourneyDeck to access your selected photos in iPhone Settings.');
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: false, quality: 1 });
  if (result.canceled || !result.assets[0]) return null;
  const asset = result.assets[0], largest = Math.max(asset.width, asset.height);
  const resize = largest > 1600 ? [{ resize: asset.width >= asset.height ? { width: 1600 } : { height: 1600 } }] : [];
  let prepared = await manipulateAsync(asset.uri, resize, { base64: true, compress: 0.72, format: SaveFormat.JPEG });
  if (prepared.base64 && Math.ceil(prepared.base64.length * 0.75) > 1_572_864) {
    prepared = await manipulateAsync(asset.uri, [{ resize: asset.width >= asset.height ? { width: 1200 } : { height: 1200 } }], { base64: true, compress: 0.52, format: SaveFormat.JPEG });
  }
  if (!prepared.base64 || Math.ceil(prepared.base64.length * 0.75) > 1_572_864) throw new Error('That photo is still too large. Try a smaller image.');
  return { fileName: `journeydeck-${Date.now()}.jpg`, contentType: 'image/jpeg' as const, dataBase64: prepared.base64 };
}

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

type RecordingModeOption = {
  id: RecordingMode;
  name: string;
  tabDetail: string;
  kicker: string;
  symbol: string;
  color: string;
  tint: string;
  summary: string;
  benefits: string[];
  drawbacks: string[];
  privacy: string;
};

const recordingModeOptions: RecordingModeOption[] = [
  {
    id: 'automatic', name: 'Automatic Drive Detection', tabDetail: 'Drive Detection', kicker: 'HANDS-FREE', symbol: '◎', color: '#62dfbe', tint: '#0d2421',
    summary: 'Starts a journey after sustained driving speed is detected.',
    benefits: ['Starts without opening the app', 'Shazam checks music automatically when selected', 'Stops after you have been parked'],
    drawbacks: ['Requires Always Allow location', 'Uses more battery in the background', 'Can start late or mistake passenger travel', 'Background recognition depends on iOS'],
    privacy: 'Location is used to detect and record journeys. JourneyDeck never saves microphone audio.',
  },
  {
    id: 'manual', name: 'Manual Recording', tabDetail: 'Start and Finish', kicker: "YOU'RE IN CONTROL", symbol: '●', color: '#9b6cff', tint: '#211536',
    summary: 'Tap Start when your journey begins and Finish when you are done.',
    benefits: ['Every journey starts only when you choose', 'Lower background battery use', 'Simple and predictable controls'],
    drawbacks: ['You can forget to press Start', 'Route and music before Start are missed', 'Requires safe interaction with the phone'],
    privacy: 'Location and music recognition run only while you are recording.',
  },
];

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
  const [recordingPreferences, setRecordingPreferences] = useState<RecordingModePreferences | null>(null);
  const [editingRecordingMode, setEditingRecordingMode] = useState(false);
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
  const [musicDashboard, setMusicDashboard] = useState<MusicDashboardState>({ status: 'loading', data: null });
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
    setRecordingPreferences(loadRecordingModePreferences());
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

  const refreshMusicDashboard = useCallback(async () => {
    setMusicDashboard(current => ({ ...current, status: 'loading', message: undefined }));
    try { setMusicDashboard({ status: 'ready', data: await appDataClient.musicDashboard() }); }
    catch (error) { setMusicDashboard(current => ({ status: 'error', data: current.data, message: error instanceof Error ? error.message : 'Your music archive could not be loaded.' })); }
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

  const refreshJourneyLocations = useCallback(async () => {
    setDetailRefresh(value => value + 1);
    await Promise.all([refreshJourneys(), refreshDashboard()]);
  }, [refreshDashboard, refreshJourneys]);

  useEffect(() => { if (tab === 'home' || tab === 'connections') void refreshDashboard(); }, [refreshDashboard, tab]);
  useEffect(() => { if (tab === 'journeys') { void refreshJourneys(); void refreshMemories(); } }, [refreshJourneys, refreshMemories, tab]);
  useEffect(() => { if (tab === 'music') void refreshMusicDashboard(); }, [refreshMusicDashboard, tab]);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') {
        void refreshDashboard();
        if (tab === 'journeys') void refreshJourneys();
        if (tab === 'music') void refreshMusicDashboard();
      }
    });
    return () => subscription.remove();
  }, [refreshDashboard, refreshJourneys, refreshMusicDashboard, tab]);

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

  const chooseRecordingMode = useCallback(async (mode: RecordingMode) => {
    const next = saveRecordingModePreferences({ mode, onboardingCompleted: true });
    setRecordingPreferences(next);
    setEditingRecordingMode(false);
    if (mode !== 'automatic') return;
    try {
      let foreground = await Location.getForegroundPermissionsAsync();
      if (foreground.status !== 'granted') foreground = await Location.requestForegroundPermissionsAsync();
      if (foreground.status !== 'granted') throw new Error('Location While Using the App was not enabled.');
      const background = await Location.requestBackgroundPermissionsAsync();
      if (background.status !== 'granted') throw new Error('Always Allow location was not enabled.');
      if (!(await TaskManager.isAvailableAsync())) throw new Error('Automatic detection requires the installed JourneyDeck build.');
    } catch (error) {
      Alert.alert(
        'Automatic detection needs location access',
        `${error instanceof Error ? error.message : 'Background location is not ready.'} Manual Start remains available, and you can enable location from the Record screen.`,
      );
    }
  }, []);

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

  const enableRecognition = useCallback(async (providerOverride?: MusicProvider) => {
    if (!isJourneyDeckMusicNativeAvailable || musicCapabilities?.shazamKitAvailable === false) {
      Alert.alert('Auto Recognition is not ready', 'ShazamKit needs the new native JourneyDeck build and its Apple developer capability before it can ask for microphone access.');
      return;
    }
    try {
      const status = await authorizeShazamMicrophone();
      await refreshMusicCapabilities();
      await saveConnectionState({ shazam: status === 'authorized' ? 'enabled' : status === 'denied' || status === 'restricted' ? 'permission_denied' : 'not_enabled' }, providerOverride, true);
      Alert.alert(status === 'authorized' ? 'Auto Recognition enabled' : 'Microphone access was not enabled', status === 'authorized' ? 'When Auto Recognition is your selected method, JourneyDeck listens briefly when a journey starts and about once per minute while it continues.' : 'Recording still works without music recognition.');
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
  const activeRecordingPreferences = recordingPreferences?.onboardingCompleted && !editingRecordingMode ? recordingPreferences : null;
  const appReady = Boolean(activePreferences && activeRecordingPreferences);

  return (
    <View style={styles.app}>
      <ExpoStatusBar style="light" /><StatusBar barStyle="light-content" />
      <View style={styles.screenBody}>
        {(!preferences || !recordingPreferences) && <AppLoading />}
        {recordingPreferences && !activeRecordingPreferences && <RecordingModePicker
          initial={recordingPreferences.mode ?? 'automatic'}
          onContinue={chooseRecordingMode}
          onCancel={recordingPreferences.onboardingCompleted ? () => setEditingRecordingMode(false) : undefined}
        />}
        {activeRecordingPreferences && preferences && !activePreferences && <ProviderPicker
          initial={preferences.provider ?? 'apple-music'}
          onContinue={async provider => {
            await chooseProvider(provider);
            if (provider === 'apple-music') await connectAppleMusic(provider);
            if (provider === 'shazam') await enableRecognition(provider);
          }}
          onCancel={preferences.onboardingCompleted ? () => setEditingProvider(false) : undefined}
        />}
        {appReady && tab === 'home' && <HomeScreen state={dashboard} recordingMode={activeRecordingPreferences!.mode!} onRecord={() => openTab('record')} onJourneys={() => openTab('journeys')} onConnections={() => openTab('connections')} onJourney={id => { setTab('journeys'); setSelectedJourneyId(id); }} onRefresh={refreshDashboard} />}
        {appReady && tab === 'journeys' && <MemoriesScreen catalog={memories} journeys={journeys} hasMore={Boolean(journeyCursor)} loadingMore={journeysLoadingMore} onJourney={setSelectedJourneyId} onRefresh={() => { void refreshMemories(); void refreshJourneys(); }} onLoadMore={() => void loadMoreJourneys()} />}
        {appReady && tab === 'music' && <MusicScreen state={musicDashboard} provider={activePreferences!.provider!} onRefresh={() => void refreshMusicDashboard()} />}
        {appReady && tab === 'connections' && <ConnectionsScreen dashboard={dashboard.data} provider={activePreferences!.provider!} recordingMode={activeRecordingPreferences!.mode!} capabilities={musicCapabilities} connectionCapabilities={connectionCapabilities} lastFmUsername={lastFmUsername} editingLastFm={editingLastFm} lastFmDraft={lastFmDraft} savingLastFm={savingLastFm} syncingLastFm={syncingLastFm} onLastFmDraft={setLastFmDraft} onEditLastFm={() => setEditingLastFm(true)} onCancelLastFm={() => { setLastFmDraft(lastFmUsername); setEditingLastFm(false); }} onSaveLastFm={() => void saveLastFm()} onSyncLastFm={() => void syncLastFmNow()} onChangeRecordingMode={() => setEditingRecordingMode(true)} onChangeProvider={() => setEditingProvider(true)} onConnectAppleMusic={() => void connectAppleMusic()} onEnableRecognition={() => void enableRecognition()} />}
        <View
          key="persistent-recorder-engine"
          accessibilityElementsHidden={!appReady || tab !== 'record'}
          importantForAccessibility={appReady && tab === 'record' ? 'auto' : 'no-hide-descendants'}
          pointerEvents={appReady && tab === 'record' ? 'auto' : 'none'}
          style={appReady && tab === 'record' ? styles.recorderVisible : styles.recorderHidden}
        >
          {recorder}
        </View>
      </View>
      {appReady && <SafeAreaView style={styles.navSafe}><BottomNavigation active={tab} onSelect={openTab} /></SafeAreaView>}
      <JourneyDetailModal visible={Boolean(selectedJourneyId)} state={journeyDetail} onClose={() => setSelectedJourneyId(null)} onRetry={() => setDetailRefresh(value => value + 1)} onLocationsSaved={refreshJourneyLocations} />
    </View>
  );
}

function AppLoading() {
  return <SafeAreaView style={styles.loadingScreen}><ExpoStatusBar style="light" /><ActivityIndicator color="#a88aff" size="large" /><Text style={styles.loadingText}>Opening JourneyDeck…</Text></SafeAreaView>;
}

function RecordingModePicker({ initial, onContinue, onCancel }: { initial: RecordingMode; onContinue: (mode: RecordingMode) => Promise<void>; onCancel?: () => void }) {
  const { width } = useWindowDimensions();
  const cardWidth = Math.max(280, width - 44);
  const initialIndex = Math.max(0, recordingModeOptions.findIndex(option => option.id === initial));
  const [index, setIndex] = useState(initialIndex);
  const [saving, setSaving] = useState(false);
  const carousel = useRef<any>(null);
  const selected = recordingModeOptions[index];

  const finish = async () => {
    setSaving(true);
    try { await onContinue(selected.id); }
    finally { setSaving(false); }
  };

  return (
    <SafeAreaView style={styles.onboardingSafe}>
      <ExpoStatusBar style="light" /><StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={styles.onboardingContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.onboardingEyebrow}>HOW SHOULD JOURNEYS BEGIN</Text>
        <Text style={styles.onboardingTitle}>Choose how JourneyDeck starts recording</Text>
        <Text style={styles.onboardingBody}>You can change this later. Manual Start and Finish always remain available.</Text>
        <View style={styles.recordingModeTabs}>
          {recordingModeOptions.map((option, optionIndex) => (
            <Pressable key={option.id} onPress={() => { setIndex(optionIndex); carousel.current?.scrollTo({ x: optionIndex * (cardWidth + 12), animated: true }); }} style={[styles.recordingModeTab, index === optionIndex && { borderColor: option.color, backgroundColor: option.tint }]}>
              <Text style={[styles.recordingModeTabTitle, index === optionIndex && { color: option.color }]}>{option.id === 'automatic' ? 'Automatic' : 'Manual'}</Text>
              <Text style={styles.recordingModeTabDetail}>{option.tabDetail}</Text>
            </Pressable>
          ))}
        </View>
        <ScrollView
          ref={carousel}
          horizontal showsHorizontalScrollIndicator={false} snapToInterval={cardWidth + 12} decelerationRate="fast"
          contentOffset={{ x: initialIndex * (cardWidth + 12), y: 0 }}
          onMomentumScrollEnd={event => setIndex(Math.max(0, Math.min(recordingModeOptions.length - 1, Math.round(event.nativeEvent.contentOffset.x / (cardWidth + 12)))))}
          contentContainerStyle={styles.providerCarousel}
        >
          {recordingModeOptions.map(option => <RecordingModeCard key={option.id} option={option} width={cardWidth} />)}
        </ScrollView>
        <View style={styles.pageDots}>{recordingModeOptions.map((option, optionIndex) => <View key={option.id} style={[styles.pageDot, index === optionIndex && { width: 24, backgroundColor: selected.color }]} />)}</View>
        <PrimaryAction label={saving ? 'Saving your choice…' : selected.id === 'automatic' ? 'Use Automatic Detection' : 'Use Manual Recording'} onPress={() => void finish()} disabled={saving} />
        {onCancel && <Pressable onPress={onCancel} style={styles.cancelButton}><Text style={styles.cancelButtonText}>Keep my current choice</Text></Pressable>}
        <Text style={styles.providerFootnote}>{selected.id === 'automatic' ? 'Open the Recorder anytime to check detection or finish an active journey.' : 'Automatic detection can be enabled later from Connections.'}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function RecordingModeCard({ option, width }: { option: RecordingModeOption; width: number }) {
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

function HomeScreen({ state, recordingMode, onRecord, onJourneys, onConnections, onJourney, onRefresh }: { state: LoadState<AppDashboard>; recordingMode: RecordingMode; onRecord: () => void; onJourneys: () => void; onConnections: () => void; onJourney: (id: string) => void; onRefresh: () => void }) {
  const { data } = state;
  const week = data.summary.last7Days;
  const allTime = data.summary.allTime;
  const latestTrack = data.latestJourney?.soundtrackPreview?.[0];
  const todayJourneys = data.recentJourneys.filter(journey => isToday(journey.startedAt));
  const todayMiles = todayJourneys.reduce((sum, journey) => sum + journey.miles, 0);
  const todayMinutes = todayJourneys.reduce((sum, journey) => sum + journey.durationMinutes, 0);
  const recentJourneys = data.recentJourneys.slice(0, 2);
  const activity = weeklyActivity(data.weeklyJourneys);
  const todayBars = hourlyDrivingActivity(todayJourneys);
  const connections = data.providerPreferences?.connections ?? defaultConnections;
  const selectedProvider = providerOptions.find(option => toApiMusicProvider(option.id) === data.providerPreferences?.musicProvider);
  const musicConnected = connections.appleMusic === 'connected' || connections.shazam === 'enabled' || connections.lastFm === 'connected';
  const recorderHealthy = data.recorder.connected && data.recorder.queuedPoints + data.recorder.queuedMusic === 0;
  const automaticMode = recordingMode === 'automatic';
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.webDashboardPage} showsVerticalScrollIndicator={false}>
        {state.status === 'error' && <InlineNotice message={state.message!} onRetry={onRefresh} />}
        <View style={styles.webDashboardShell}>
          <ImageBackground source={require('../assets/dashboard-neon-road-v2.png')} style={styles.webHero} imageStyle={styles.webHeroImage}>
            <View style={styles.webHeroShade} />
            <View style={styles.webHeroTop}>
              <View><Text style={styles.webHeroKicker}>YOUR ROAD</Text><Text style={styles.webHeroScript}>In motion</Text></View>
              <View style={styles.webLivePill}><View style={[styles.webLiveDot, { backgroundColor: recorderColor(data.recorder.state, data.recorder.connected) }]} /><Text style={styles.webLiveText}>{data.recorder.state === 'recording' ? 'RECORDING' : automaticMode ? 'WATCHING' : 'READY'}</Text></View>
            </View>
            <View style={styles.webHeroBottom}>
              <Text style={styles.webHeroWeekLabel}>LAST 7 DAYS</Text>
              <Text style={styles.webHeroWeekValue}>{formatMiles(week.miles)}</Text>
              <Text style={styles.webHeroWeekDetail}>{week.journeyCount} journeys  ·  {formatDuration(week.minutes)}  ·  {week.songCount} songs</Text>
              <View style={styles.webHeroMetricRail}>
                <Metric value={String(week.journeyCount)} label="JOURNEYS" />
                <Metric value={formatDuration(week.minutes)} label="ROAD TIME" />
                <Metric value={String(week.songCount)} label="SONGS" />
              </View>
            </View>
          </ImageBackground>

          <View style={styles.webMusicCard}>
            <View style={styles.webMusicGlow} />
            {latestTrack ? <Artwork track={latestTrack} size={92} /> : <View style={styles.webEmptyAlbum}><Text style={styles.webEmptyAlbumWord}>JOURNEY{`\n`}DECK</Text><Text style={styles.webEmptyAlbumNote}>♪</Text></View>}
            <View style={styles.webTrackCopy}>
              <Text style={styles.webCardKicker}>{latestTrack ? 'LATEST ROAD SOUNDTRACK' : 'READY FOR YOUR SOUNDTRACK'}</Text>
              <Text style={styles.webTrackTitle} numberOfLines={1}>{latestTrack?.track ?? 'Your next song belongs here'}</Text>
              <Text style={styles.webTrackArtist} numberOfLines={1}>{latestTrack?.artist ?? selectedProvider?.name ?? 'Choose a music connection'}</Text>
              <DashboardWaveform />
              <View style={styles.webTrackTime}><Text style={styles.webTrackTimeText}>{latestTrack ? 'MATCHED' : 'LISTENING READY'}</Text><Text style={styles.webTrackTimeText}>{data.latestJourney ? formatCompactDate(data.latestJourney.startedAt) : 'NEXT DRIVE'}</Text></View>
            </View>
          </View>

          <View style={styles.webDrivingCard}>
            <View style={styles.webDrivingGlow} />
            <View style={styles.webDrivingHeading}><Text style={styles.webCardKicker}>TODAY'S DRIVING</Text><Text style={styles.webDrivingValue}>{todayJourneys.length ? formatNumber(todayMiles) : '0'}<Text style={styles.webDrivingUnit}> mi</Text></Text></View>
            <View style={styles.webDrivingFacts}><View><Text style={styles.webFactValue}>{todayJourneys.length}</Text><Text style={styles.webFactLabel}>journeys</Text></View><View><Text style={styles.webFactValue}>{formatDuration(todayMinutes)}</Text><Text style={styles.webFactLabel}>road time</Text></View></View>
            <View style={styles.webHourlyChart}>{todayBars.map((height, index) => <View key={index} style={[styles.webHourlyBar, { height: `${Math.max(4, height * 100)}%` }]} />)}</View>
            <View style={styles.webChartAxis}><Text style={styles.webChartAxisText}>12 AM</Text><Text style={styles.webChartAxisText}>6 AM</Text><Text style={styles.webChartAxisText}>NOON</Text><Text style={styles.webChartAxisText}>6 PM</Text><Text style={styles.webChartAxisText}>12 AM</Text></View>
            <View style={styles.webScoreRing}><View style={styles.webScoreRingInner}><Text style={styles.webScoreIcon}>⌁</Text><Text style={styles.webScoreValue}>{todayJourneys.length ? Math.min(99, 70 + todayJourneys.length * 4) : '—'}</Text><Text style={styles.webScoreLabel}>PULSE</Text></View></View>
          </View>

          <Pressable onPress={onRecord} style={({ pressed }) => [styles.webRecorderStrip, pressed && styles.pressed]}>
            <View style={[styles.webRecorderBeacon, { borderColor: recorderColor(data.recorder.state, data.recorder.connected) }]}><View style={[styles.webRecorderBeaconCore, { backgroundColor: recorderColor(data.recorder.state, data.recorder.connected) }]} /></View>
            <View style={styles.flex}><Text style={styles.webRecorderTitle}>{automaticMode && data.recorder.state === 'ready' ? 'Automatic detection is watching' : recorderTitle(data.recorder.state, data.recorder.connected)}</Text><Text style={styles.webRecorderDetail}>{automaticMode && data.recorder.state === 'ready' ? 'JourneyDeck will begin after sustained driving speed.' : recorderDetail(data.recorder.state, data.recorder.queuedPoints, data.recorder.queuedMusic)}</Text></View>
            <Text style={styles.webRecorderChevron}>›</Text>
          </Pressable>
          {(recordingMode === 'manual' || data.recorder.state === 'recording') && <PrimaryAction label={data.recorder.state === 'recording' ? 'Open active recording' : 'Start a journey'} onPress={onRecord} />}

          <View style={styles.webActions}>
            <WebAction symbol="↻" title="Sync" detail="Latest data" color="#ff645d" onPress={onRefresh} />
            <WebAction symbol="▶" title="Replay" detail="Latest journey" color="#a75cff" onPress={data.latestJourney ? () => onJourney(data.latestJourney!.id) : onJourneys} />
            <WebAction symbol="≋" title="Journeys" detail="Your archive" color="#45bdf4" onPress={onJourneys} />
            <WebAction symbol="◎" title="Connect" detail="Music & car" color="#ff9a5d" onPress={onConnections} />
          </View>

          <View style={styles.webBottomGrid}>
            <View style={styles.webJourneysPanel}>
              <View style={styles.webPanelHeader}><Text style={styles.webPanelTitle}>RECENT JOURNEYS</Text><Pressable onPress={onJourneys}><Text style={styles.webPanelAction}>View all  ›</Text></Pressable></View>
              {recentJourneys.length ? recentJourneys.map(journey => <CompactJourneyRow key={journey.id} journey={journey} onPress={() => onJourney(journey.id)} />) : <Text style={styles.webPanelEmpty}>Your completed journeys will appear here.</Text>}
            </View>
            <View style={styles.webHealthPanel}>
              <View style={styles.webPanelHeader}><Text style={[styles.webPanelTitle, { color: '#45c6f0' }]}>DATA HEALTH</Text></View>
              <CompactHealthRow symbol="J" label="JourneyDeck" detail={data.recorder.connected ? 'Connected' : 'Offline'} healthy={data.recorder.connected} />
              <CompactHealthRow symbol="♪" label="Music" detail={musicConnected ? 'Ready' : 'Check'} healthy={musicConnected} />
              <CompactHealthRow symbol="T" label="Tessie" detail={connections.tessie === 'connected' ? 'Connected' : 'Check'} healthy={connections.tessie === 'connected'} />
            </View>
          </View>

          <View style={styles.webWeekCard}>
            <View style={styles.webPanelHeader}><View><Text style={styles.webPanelTitle}>THIS WEEK</Text><Text style={styles.webWeekSubtitle}>Seven days on the road</Text></View><View style={styles.livePill}><View style={styles.liveDot} /><Text style={styles.liveText}>LIVE</Text></View></View>
            <View style={styles.webWeekChart}>{activity.map(day => <View key={day.key} style={styles.webWeekColumn}><View style={styles.webWeekTrack}><View style={[styles.webWeekBar, { height: `${Math.max(6, day.ratio * 100)}%` }]} /></View><Text style={[styles.webWeekDay, day.isToday && styles.pulseDayToday]}>{day.label}</Text></View>)}</View>
            <View style={styles.webWeekStats}><View><Text style={styles.webWeekStatValue}>{formatMiles(week.miles)}</Text><Text style={styles.webWeekStatLabel}>MILES DRIVEN</Text></View><View><Text style={styles.webWeekStatValue}>{week.journeyCount}</Text><Text style={styles.webWeekStatLabel}>JOURNEYS</Text></View><View><Text style={styles.webWeekStatValue}>{week.songCount}</Text><Text style={styles.webWeekStatLabel}>SONGS MATCHED</Text></View></View>
          </View>

          <View style={styles.webAllTimeRail}><View><Text style={styles.webAllTimeKicker}>YOUR JOURNEYDECK</Text><Text style={styles.webAllTimeTitle}>The road so far</Text></View><View style={styles.webAllTimeMetric}><Text style={styles.webAllTimeMetricValue}>{formatMiles(allTime.miles)}</Text><Text style={styles.webAllTimeMetricLabel}>ALL-TIME DISTANCE</Text></View><View style={styles.webAllTimeMetric}><Text style={styles.webAllTimeMetricValue}>{allTime.journeyCount}</Text><Text style={styles.webAllTimeMetricLabel}>JOURNEYS</Text></View></View>
          {!recorderHealthy && <Text style={styles.webQueueNote}>{data.recorder.queuedPoints + data.recorder.queuedMusic} items are safely waiting to sync on this iPhone.</Text>}
        </View>
        {state.status === 'loading' && <LoadingLine label="Refreshing your dashboard…" />}
      </ScrollView>
    </SafeAreaView>
  );
}

function DashboardWaveform() {
  const bars = [8, 16, 27, 13, 31, 20, 38, 17, 29, 42, 20, 34, 14, 27, 37, 18, 31, 11, 24, 35, 16, 27, 9, 20];
  return <View style={styles.webWaveform}>{bars.map((height, index) => <View key={index} style={[styles.webWaveBar, { height }]} />)}</View>;
}

function WebAction({ symbol, title, detail, color, onPress }: { symbol: string; title: string; detail: string; color: string; onPress: () => void }) {
  return <Pressable onPress={onPress} style={({ pressed }) => [styles.webAction, { borderColor: `${color}55`, backgroundColor: `${color}18` }, pressed && styles.pressed]}><View style={[styles.webActionGlow, { backgroundColor: color }]} /><Text style={[styles.webActionSymbol, { color }]}>{symbol}</Text><Text style={styles.webActionTitle}>{title}</Text><Text style={styles.webActionDetail}>{detail}</Text></Pressable>;
}

function CompactJourneyRow({ journey, onPress }: { journey: JourneySummary; onPress: () => void }) {
  return <Pressable onPress={onPress} style={({ pressed }) => [styles.webJourneyRow, pressed && styles.pressed]}><View style={styles.webPlaceIcon}><Text>⌂</Text></View><View style={styles.flex}><Text style={styles.webJourneyOrigin} numberOfLines={1}>{journey.startingLocation ?? 'Journey start'}</Text><Text style={styles.webJourneyDestination} numberOfLines={1}>{journey.endingLocation ?? 'Recorded destination'}</Text><Text style={styles.webJourneyMeta}>{formatMiles(journey.miles)} · {formatDuration(journey.durationMinutes)}</Text></View><View style={styles.webRouteThumb}><View style={styles.webRouteThumbLine} /><View style={styles.webRouteThumbStart} /><View style={styles.webRouteThumbEnd} /></View></Pressable>;
}

function CompactHealthRow({ symbol, label, detail, healthy }: { symbol: string; label: string; detail: string; healthy: boolean }) {
  return <View style={styles.webCompactHealth}><View style={[styles.webServiceIcon, { backgroundColor: healthy ? '#2589c8' : '#62334c' }]}><Text style={styles.webServiceIconText}>{symbol}</Text></View><View style={styles.flex}><Text style={styles.webServiceName} numberOfLines={1}>{label}</Text><Text style={styles.webServiceDetail} numberOfLines={1}>{detail}</Text></View><View style={[styles.webHealthCheck, { backgroundColor: healthy ? '#2caeea' : '#ff9a5d' }]}><Text style={styles.webHealthCheckText}>{healthy ? '✓' : '!'}</Text></View></View>;
}

function hourlyDrivingActivity(journeys: JourneySummary[]) {
  const bins = Array.from({ length: 16 }, () => 0);
  journeys.forEach(journey => {
    const startedAt = new Date(journey.startedAt);
    if (Number.isNaN(startedAt.getTime())) return;
    const index = Math.min(15, Math.floor((startedAt.getHours() + startedAt.getMinutes() / 60) / 1.5));
    bins[index] += Math.max(0.2, journey.miles);
  });
  const maximum = Math.max(1, ...bins);
  return bins.map(value => value / maximum);
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
  const [memoryOverview, setMemoryOverview] = useState<JourneyMemory | null>(null);
  const [collectionOverview, setCollectionOverview] = useState<JourneyCollection | null>(null);
  const [shareCard, setShareCard] = useState<ShareCardPayload | null>(null);
  const [memoryDraft, setMemoryDraft] = useState<{ id: string | null; name: string; notes: string; collectionIds: string[]; coverPhotoId: string | null; photos: JourneyPhoto[] } | null>(null);
  const [collectionDraft, setCollectionDraft] = useState<{ id: string | null; name: string; description: string; driveIds: string[]; photos: JourneyPhoto[] } | null>(null);
  const [saving, setSaving] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const selectedMemory = catalog.data.memories[Math.min(selectedIndex, Math.max(0, catalog.data.memories.length - 1))] ?? null;
  const selectedCollections = selectedMemory
    ? selectedMemory.collectionIds.map(id => catalog.data.collections.find(collection => collection.id === id)).filter((collection): collection is JourneyCollection => Boolean(collection))
    : [];
  const availableMemoryPhotos = memoryDraft ? [
    ...memoryDraft.photos.filter(photo => photo.source === 'memory'),
    ...memoryDraft.collectionIds.flatMap(id => catalog.data.collections.find(collection => collection.id === id)?.photos ?? []),
  ].filter((photo, index, photos) => photos.findIndex(candidate => candidate.id === photo.id) === index) : [];

  useEffect(() => { if (selectedIndex >= catalog.data.memories.length && catalog.data.memories.length) setSelectedIndex(catalog.data.memories.length - 1); }, [catalog.data.memories.length, selectedIndex]);

  const editMemory = (memory: JourneyMemory | null) => {
    setMemoryOverview(null);
    setMemoryDraft({ id: memory?.id ?? null, name: memory?.name ?? '', notes: memory?.notes ?? '', collectionIds: [...(memory?.collectionIds ?? [])], coverPhotoId: memory?.coverPhotoId ?? null, photos: [...(memory?.photos ?? [])] });
  };
  const toggleMemoryCollection = (id: string) => setMemoryDraft(current => {
    if (!current) return current;
    const collectionIds = current.collectionIds.includes(id) ? current.collectionIds.filter(value => value !== id) : [...current.collectionIds, id];
    const allowed = new Set([...current.photos.filter(photo => photo.source === 'memory').map(photo => photo.id), ...collectionIds.flatMap(collectionId => catalog.data.collections.find(collection => collection.id === collectionId)?.photos.map(photo => photo.id) ?? [])]);
    return { ...current, collectionIds, coverPhotoId: current.coverPhotoId && allowed.has(current.coverPhotoId) ? current.coverPhotoId : null };
  });
  const editCollection = (collection: JourneyCollection | null) => {
    setCollectionOverview(null);
    setCollectionDraft({ id: collection?.id ?? null, name: collection?.name ?? '', description: collection?.description ?? '', driveIds: [...(collection?.driveIds ?? [])], photos: [...(collection?.photos ?? [])] });
  };
  const toggleCollectionJourney = async (journeyId: string) => {
    if (!collectionDraft?.id) return;
    const next = { ...collectionDraft, driveIds: collectionDraft.driveIds.includes(journeyId) ? collectionDraft.driveIds.filter(id => id !== journeyId) : [...collectionDraft.driveIds, journeyId] };
    setCollectionDraft(next);
    try {
      await appDataClient.saveCollection({ id: next.id, name: next.name, description: next.description, driveIds: next.driveIds });
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
      await appDataClient.saveMemory({ id: memoryDraft.id, name: memoryDraft.name, notes: memoryDraft.notes, collectionIds: memoryDraft.collectionIds, coverPhotoId: memoryDraft.coverPhotoId, artworkKey: selectedMemory?.artworkKey ?? 'road-trips' });
      setMemoryDraft(null); onRefresh();
    } catch (error) { Alert.alert('Memory not saved', error instanceof Error ? error.message : 'JourneyDeck could not save this memory.'); }
    finally { setSaving(false); }
  };
  const saveCollection = async () => {
    if (!collectionDraft) return;
    if (!collectionDraft.name.trim()) return Alert.alert('Name this collection', 'Give the collection a short name first.');
    setSaving(true);
    try {
      const saved = await appDataClient.saveCollection({ id: collectionDraft.id, name: collectionDraft.name, description: collectionDraft.description, driveIds: collectionDraft.driveIds });
      setCollectionDraft({ ...collectionDraft, id: saved.id, driveIds: saved.driveIds, photos: saved.photos }); onRefresh();
    } catch (error) { Alert.alert('Collection not saved', error instanceof Error ? error.message : 'JourneyDeck could not save this collection.'); }
    finally { setSaving(false); }
  };
  const uploadMemoryPhoto = async () => {
    if (!memoryDraft?.id) return Alert.alert('Save this Memory first', 'Create the Memory, then open Edit memory to add photos.');
    setPhotoBusy(true);
    try {
      const selected = await choosePhoto(); if (!selected) return;
      const uploaded = await appDataClient.uploadMemoryPhoto(memoryDraft.id, selected);
      setMemoryDraft(current => current ? { ...current, photos: [...current.photos, uploaded], coverPhotoId: current.coverPhotoId ?? uploaded.id } : current);
      onRefresh();
    } catch (error) { Alert.alert('Photo not added', error instanceof Error ? error.message : 'JourneyDeck could not upload this photo.'); }
    finally { setPhotoBusy(false); }
  };
  const uploadCollectionPhoto = async () => {
    if (!collectionDraft?.id) return Alert.alert('Save this Collection first', 'Create the Collection, then open Manage to add photos.');
    setPhotoBusy(true);
    try {
      const selected = await choosePhoto(); if (!selected) return;
      const uploaded = await appDataClient.uploadCollectionPhoto(collectionDraft.id, selected);
      setCollectionDraft(current => current ? { ...current, photos: [...current.photos, uploaded] } : current);
      onRefresh();
    } catch (error) { Alert.alert('Photo not added', error instanceof Error ? error.message : 'JourneyDeck could not upload this photo.'); }
    finally { setPhotoBusy(false); }
  };
  const removePhoto = (photo: JourneyPhoto, owner: 'memory' | 'collection') => Alert.alert('Remove photo?', owner === 'collection' ? 'This removes the photo from this Collection and every Memory that inherits it.' : 'This removes the photo from this Memory.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Remove', style: 'destructive', onPress: () => void (async () => {
      setPhotoBusy(true);
      try {
        await appDataClient.removePhoto(photo.id);
        if (owner === 'memory') setMemoryDraft(current => current ? { ...current, photos: current.photos.filter(item => item.id !== photo.id), coverPhotoId: current.coverPhotoId === photo.id ? null : current.coverPhotoId } : current);
        else setCollectionDraft(current => current ? { ...current, photos: current.photos.filter(item => item.id !== photo.id) } : current);
        onRefresh();
      } catch (error) { Alert.alert('Photo not removed', error instanceof Error ? error.message : 'JourneyDeck could not remove this photo.'); }
      finally { setPhotoBusy(false); }
    })() },
  ]);

  const overviewCollections = memoryOverview ? memoryOverview.collectionIds.map(id => catalog.data.collections.find(collection => collection.id === id)).filter((collection): collection is JourneyCollection => Boolean(collection)) : [];
  const overviewJourneyIds = new Set(overviewCollections.flatMap(collection => collection.driveIds));
  const memoryCover = memoryOverview?.coverPhotoId ? memoryOverview.photos.find(photo => photo.id === memoryOverview.coverPhotoId) ?? null : null;
  const openMemoryShare = (memory: JourneyMemory) => {
    const collections = memory.collectionIds.map(id => catalog.data.collections.find(collection => collection.id === id)).filter((collection): collection is JourneyCollection => Boolean(collection));
    const journeyIds = new Set(collections.flatMap(collection => collection.driveIds));
    setMemoryOverview(null);
    setShareCard({ kind: 'memory', eyebrow: 'A JOURNEYDECK MEMORY', title: memory.name, subtitle: memory.notes || 'A chapter made from the roads, music, and moments worth keeping.', metrics: [{ label: 'COLLECTIONS', value: String(collections.length) }, { label: 'JOURNEYS', value: String(journeyIds.size) }, { label: 'PHOTOS', value: String(memory.photos.length) }], photo: memory.coverPhotoId ? memory.photos.find(photo => photo.id === memory.coverPhotoId) ?? null : null, accent: '#ff6a68' });
  };
  const openCollectionShare = (collection: JourneyCollection) => {
    setCollectionOverview(null);
    setShareCard({ kind: 'collection', eyebrow: 'A JOURNEY COLLECTION', title: collection.name, subtitle: collection.description || 'A set of drives that belong together.', metrics: [{ label: 'JOURNEYS', value: String(collection.driveIds.length) }, { label: 'PHOTOS', value: String(collection.photos.length) }, { label: 'STORY', value: 'SAVED' }], photo: collection.photos[0] ?? null, accent: '#9b7cff' });
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
            <Pressable onPress={() => { setSelectedIndex(index); carousel.current?.scrollTo({ x: index * cardStep, animated: true }); setMemoryOverview(memory); }} style={styles.memoryHeroCard}>
              <MemoryArtwork artworkKey={memory.artworkKey} photo={memory.coverPhotoId ? memory.photos.find(photo => photo.id === memory.coverPhotoId) ?? null : null} />
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

      <View style={styles.memorySectionHeader}><View><Text style={styles.memoryLevel}>COLLECTIONS</Text><Text style={styles.memorySectionTitle}>{selectedMemory?.name ?? 'Saved collections'}</Text></View><View style={styles.memoryHeaderActions}>{selectedMemory && <Pressable onPress={() => editMemory(selectedMemory)}><Text style={styles.memoryHeaderAction}>Edit memory</Text></Pressable>}<Pressable onPress={() => editCollection(null)}><Text style={styles.memoryHeaderAction}>+ New</Text></Pressable></View></View>
      {(selectedCollections.length ? selectedCollections : catalog.data.collections).map((collection, index) => <CollectionCard key={collection.id} collection={collection} index={index} onOpen={() => setCollectionOverview(collection)} />)}
      {!catalog.data.collections.length && <EmptyCard title="No Collections yet" body="Create a Collection, then add the journeys that belong together." />}
      <View style={styles.memorySectionHeader}><View><Text style={styles.memoryLevel}>JOURNEYS</Text><Text style={styles.memorySectionTitle}>Your latest drives</Text></View></View>
      <View style={styles.memoryJourneyList}>{journeys.data.map(journey => <JourneyCard key={journey.id} journey={journey} compact onPress={() => onJourney(journey.id)} />)}</View>
      {!journeys.data.length && journeys.status !== 'loading' && <EmptyCard title="No journeys yet" body="Finish a recording and it will appear here, ready to organize." />}
      {hasMore && <Pressable onPress={onLoadMore} disabled={loadingMore} style={[styles.loadMoreButton, loadingMore && styles.pressed]}>{loadingMore ? <ActivityIndicator color="#b59cff" /> : <Text style={styles.loadMoreText}>Load more journeys</Text>}</Pressable>}
      {(catalog.status === 'loading' || journeys.status === 'loading') && <LoadingLine label="Refreshing memories…" />}
    </ScrollView>

    <OverlayModal visible={Boolean(memoryOverview)} kicker="MEMORY OVERVIEW" title={memoryOverview?.name ?? 'Memory'} onClose={() => setMemoryOverview(null)}>
      {memoryOverview && <>
        <View style={styles.overviewHero}><MemoryArtwork artworkKey={memoryOverview.artworkKey} photo={memoryCover} /><View style={styles.memoryHeroShade} /><View style={styles.overviewHeroCopy}><Text style={styles.overviewEyebrow}>YOUR STORY, REMEMBERED</Text><Text style={styles.overviewHeroTitle}>{memoryOverview.name}</Text></View></View>
        <OverviewMetrics items={[{ label: 'COLLECTIONS', value: String(overviewCollections.length) }, { label: 'JOURNEYS', value: String(overviewJourneyIds.size) }, { label: 'PHOTOS', value: String(memoryOverview.photos.length) }]} />
        {memoryOverview.notes ? <Text style={styles.overviewBody}>{memoryOverview.notes}</Text> : <Text style={styles.overviewBodyMuted}>Add notes to remember what made this chapter special.</Text>}
        <Text style={styles.overviewSectionLabel}>COLLECTIONS IN THIS MEMORY</Text>
        {overviewCollections.map(collection => <Pressable key={collection.id} onPress={() => { setMemoryOverview(null); setCollectionOverview(collection); }} style={styles.overviewListRow}><Text style={styles.overviewListTitle}>{collection.name}</Text><Text style={styles.overviewListMeta}>{collection.driveIds.length} journeys  ›</Text></Pressable>)}
        <View style={styles.overviewActions}><Pressable onPress={() => openMemoryShare(memoryOverview)} style={styles.overviewShare}><Text style={styles.overviewShareText}>Share card</Text></Pressable><Pressable onPress={() => editMemory(memoryOverview)} style={styles.overviewPrimary}><Text style={styles.overviewPrimaryText}>Edit memory</Text></Pressable></View>
      </>}
    </OverlayModal>

    <OverlayModal visible={Boolean(collectionOverview)} kicker="COLLECTION OVERVIEW" title={collectionOverview?.name ?? 'Collection'} onClose={() => setCollectionOverview(null)}>
      {collectionOverview && <>
        <View style={styles.overviewCollectionHero}>{collectionOverview.photos[0] ? <JourneyPhotoImage photo={collectionOverview.photos[0]} style={styles.overviewCollectionImage} /> : <View style={[styles.overviewCollectionImage, styles.overviewCollectionFallback]}><View style={[styles.collectionArtworkOrb, { backgroundColor: '#9b7cff' }]} /><View style={[styles.collectionArtworkRoute, { backgroundColor: '#43e6ae' }]} /></View>}<View style={styles.memoryHeroShade} /><View style={styles.overviewHeroCopy}><Text style={styles.overviewEyebrow}>ROADS THAT BELONG TOGETHER</Text><Text style={styles.overviewHeroTitle}>{collectionOverview.name}</Text></View></View>
        <OverviewMetrics items={[{ label: 'JOURNEYS', value: String(collectionOverview.driveIds.length) }, { label: 'PHOTOS', value: String(collectionOverview.photos.length) }, { label: 'MEMORIES', value: String(catalog.data.memories.filter(memory => memory.collectionIds.includes(collectionOverview.id)).length) }]} />
        {collectionOverview.description ? <Text style={styles.overviewBody}>{collectionOverview.description}</Text> : <Text style={styles.overviewBodyMuted}>Add a description to give this Collection more context.</Text>}
        <Text style={styles.overviewSectionLabel}>JOURNEYS IN THIS COLLECTION</Text>
        {journeys.data.filter(journey => collectionOverview.driveIds.includes(journey.id)).slice(0, 6).map(journey => <Pressable key={journey.id} onPress={() => { setCollectionOverview(null); onJourney(journey.id); }} style={styles.overviewListRow}><View style={styles.flex}><Text style={styles.overviewListTitle}>{locationPair(journey)}</Text><Text style={styles.overviewListMeta}>{formatCompactDate(journey.startedAt)}  •  {formatMiles(journey.miles)}</Text></View><Text style={styles.overviewChevron}>›</Text></Pressable>)}
        {!collectionOverview.driveIds.length && <Text style={styles.overviewBodyMuted}>No journeys have been added yet.</Text>}
        <View style={styles.overviewActions}><Pressable onPress={() => openCollectionShare(collectionOverview)} style={styles.overviewShare}><Text style={styles.overviewShareText}>Share card</Text></Pressable><Pressable onPress={() => editCollection(collectionOverview)} style={styles.overviewPrimary}><Text style={styles.overviewPrimaryText}>Manage collection</Text></Pressable></View>
      </>}
    </OverlayModal>

    <OverlayModal visible={Boolean(memoryDraft)} kicker={memoryDraft?.id ? 'EDIT MEMORY' : 'NEW MEMORY'} title={memoryDraft?.id ? 'Shape this chapter' : 'Create a Memory'} onClose={() => setMemoryDraft(null)}>
      {memoryDraft && <View style={styles.modalEditorBody}>
        <TextInput value={memoryDraft.name} onChangeText={name => setMemoryDraft(current => current ? { ...current, name } : current)} placeholder="Memory name" placeholderTextColor="#716879" maxLength={80} style={styles.editorInput} />
        <TextInput value={memoryDraft.notes} onChangeText={notes => setMemoryDraft(current => current ? { ...current, notes } : current)} placeholder="What makes this chapter special?" placeholderTextColor="#716879" maxLength={1200} multiline style={[styles.editorInput, styles.editorNotes]} />
        <View style={styles.photoEditorHeader}><View style={styles.flex}><Text style={styles.editorInstruction}>MEMORY PHOTOS</Text><Text style={styles.photoEditorHelp}>Add your own or choose an inherited Collection photo as the card image.</Text></View><Pressable onPress={() => void uploadMemoryPhoto()} disabled={photoBusy || !memoryDraft.id} style={[styles.photoAddButton, (!memoryDraft.id || photoBusy) && styles.photoAddDisabled]}><Text style={styles.photoAddText}>{photoBusy ? 'Working…' : '+ Add'}</Text></Pressable></View>
        {!memoryDraft.id && <Text style={styles.photoSaveFirst}>Save the Memory once before adding its own photos.</Text>}
        {availableMemoryPhotos.length ? <View style={styles.photoGrid}>{availableMemoryPhotos.map(photo => <PhotoTile key={photo.id} photo={photo} selected={memoryDraft.coverPhotoId === photo.id} label={photo.source === 'collection' ? 'COLLECTION' : 'MEMORY'} onPress={() => setMemoryDraft(current => current ? { ...current, coverPhotoId: photo.id } : current)} onRemove={photo.source === 'memory' ? () => removePhoto(photo, 'memory') : undefined} />)}</View> : <View style={styles.photoEmpty}><Text style={styles.photoEmptyTitle}>No photos yet</Text><Text style={styles.photoEmptyBody}>Photos added to selected Collections will appear here automatically.</Text></View>}
        <Text style={styles.editorInstruction}>CHOOSE AT LEAST TWO COLLECTIONS</Text>
        {catalog.data.collections.map(collection => <MembershipRow key={collection.id} title={collection.name} detail={`${collection.driveIds.length} journeys`} selected={memoryDraft.collectionIds.includes(collection.id)} onPress={() => toggleMemoryCollection(collection.id)} />)}
        <View style={styles.editorActions}><Pressable onPress={() => setMemoryDraft(null)} style={styles.editorCancel}><Text style={styles.editorCancelText}>Cancel</Text></Pressable><Pressable onPress={() => void saveMemory()} disabled={saving} style={[styles.editorSave, saving && styles.pressed]}><Text style={styles.editorSaveText}>{saving ? 'Saving…' : 'Save memory'}</Text></Pressable></View>
      </View>}
    </OverlayModal>

    <OverlayModal visible={Boolean(collectionDraft)} kicker={collectionDraft?.id ? 'MANAGE COLLECTION' : 'NEW COLLECTION'} title={collectionDraft?.id ? 'Curate this collection' : 'Create a Collection'} onClose={() => setCollectionDraft(null)}>
      {collectionDraft && <View style={styles.modalEditorBody}>
        <TextInput value={collectionDraft.name} onChangeText={name => setCollectionDraft(current => current ? { ...current, name } : current)} placeholder="Collection name" placeholderTextColor="#716879" maxLength={80} style={styles.editorInput} />
        <TextInput value={collectionDraft.description} onChangeText={description => setCollectionDraft(current => current ? { ...current, description } : current)} placeholder="Optional description" placeholderTextColor="#716879" maxLength={500} style={styles.editorInput} />
        <View style={styles.photoEditorHeader}><View style={styles.flex}><Text style={styles.editorInstruction}>COLLECTION PHOTOS</Text><Text style={styles.photoEditorHelp}>These photos automatically appear in every Memory containing this Collection.</Text></View><Pressable onPress={() => void uploadCollectionPhoto()} disabled={photoBusy || !collectionDraft.id} style={[styles.photoAddButton, (!collectionDraft.id || photoBusy) && styles.photoAddDisabled]}><Text style={styles.photoAddText}>{photoBusy ? 'Working…' : '+ Add'}</Text></Pressable></View>
        {!collectionDraft.id && <Text style={styles.photoSaveFirst}>Create the Collection once before adding photos.</Text>}
        {collectionDraft.photos.length ? <View style={styles.photoGrid}>{collectionDraft.photos.map(photo => <PhotoTile key={photo.id} photo={photo} label="COLLECTION" onPress={() => undefined} onRemove={() => removePhoto(photo, 'collection')} />)}</View> : <View style={styles.photoEmpty}><Text style={styles.photoEmptyTitle}>No photos yet</Text><Text style={styles.photoEmptyBody}>Add the views, stops, and moments that made these journeys memorable.</Text></View>}
        <Text style={styles.editorInstruction}>JOURNEYS IN THIS COLLECTION</Text>
        {journeys.data.map(journey => <MembershipRow key={journey.id} title={locationPair(journey)} detail={`${formatCompactDate(journey.startedAt)}  •  ${formatMiles(journey.miles)}`} selected={collectionDraft.driveIds.includes(journey.id)} onPress={() => void toggleCollectionJourney(journey.id)} />)}
        <View style={styles.editorActions}><Pressable onPress={() => setCollectionDraft(null)} style={styles.editorCancel}><Text style={styles.editorCancelText}>Done</Text></Pressable><Pressable onPress={() => void saveCollection()} disabled={saving} style={[styles.editorSave, saving && styles.pressed]}><Text style={styles.editorSaveText}>{saving ? 'Saving…' : collectionDraft.id ? 'Save details' : 'Create collection'}</Text></Pressable></View>
      </View>}
    </OverlayModal>
    <ShareCardModal payload={shareCard} onClose={() => setShareCard(null)} />
  </SafeAreaView>;
}

function OverlayModal({ visible, kicker, title, onClose, children }: { visible: boolean; kicker: string; title: string; onClose: () => void; children: ReactNode }) {
  return <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
    <SafeAreaView style={styles.overlayRoot}>
      <Pressable accessibilityLabel="Close" onPress={onClose} style={StyleSheet.absoluteFill} />
      <View style={styles.overlaySheet}>
        <View style={styles.overlayHeader}><View style={styles.flex}><Text style={styles.overlayKicker}>{kicker}</Text><Text style={styles.overlayTitle} numberOfLines={1}>{title}</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} style={styles.overlayClose}><Text style={styles.overlayCloseText}>×</Text></Pressable></View>
        <ScrollView contentContainerStyle={styles.overlayContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">{children}</ScrollView>
      </View>
    </SafeAreaView>
  </Modal>;
}

function OverviewMetrics({ items }: { items: { label: string; value: string }[] }) {
  return <View style={styles.overviewMetrics}>{items.map(item => <View key={item.label} style={styles.overviewMetric}><Text style={styles.overviewMetricValue}>{item.value}</Text><Text style={styles.overviewMetricLabel}>{item.label}</Text></View>)}</View>;
}

function MemoryArtwork({ artworkKey, photo }: { artworkKey: string; photo?: JourneyPhoto | null }) {
  const night = artworkKey === 'favorite-night-drives' || artworkKey === 'golden-hour-drives';
  return photo ? <JourneyPhotoImage photo={photo} style={styles.memoryArtwork} /> : <View style={[styles.memoryArtwork, night && styles.memoryArtworkNight]}><View style={styles.memoryArtworkGlow} /><View style={styles.memoryArtworkMoon} /><View style={[styles.memoryArtworkLine, styles.memoryArtworkLineLeft]} /><View style={[styles.memoryArtworkLine, styles.memoryArtworkLineRight]} /><View style={styles.memoryArtworkDashOne} /><View style={styles.memoryArtworkDashTwo} /><View style={styles.memoryArtworkDashThree} /></View>;
}

function JourneyPhotoImage({ photo, style }: { photo: JourneyPhoto; style?: any }) {
  const [uri, setUri] = useState<string | null>(null);
  useEffect(() => { let active = true; void appDataClient.photoDataUrl(photo).then(value => { if (active) setUri(value); }).catch(() => undefined); return () => { active = false; }; }, [photo.id]);
  return uri ? <Image source={{ uri }} resizeMode="cover" style={style} /> : <View style={[style, styles.photoLoading]}><ActivityIndicator color="#b693ff" /></View>;
}

function PhotoTile({ photo, selected = false, label, onPress, onRemove }: { photo: JourneyPhoto; selected?: boolean; label: string; onPress: () => void; onRemove?: () => void }) {
  return <View style={[styles.photoTile, selected && styles.photoTileSelected]}><Pressable onPress={onPress} style={styles.photoTileImage}><JourneyPhotoImage photo={photo} style={styles.photoTileImage} /><View style={styles.photoTileShade} /><Text style={styles.photoTileLabel}>{selected ? '✓ COVER' : label}</Text></Pressable>{onRemove && <Pressable onPress={onRemove} style={styles.photoRemove}><Text style={styles.photoRemoveText}>×</Text></Pressable>}</View>;
}

function MembershipRow({ title, detail, selected, onPress }: { title: string; detail: string; selected: boolean; onPress: () => void }) {
  return <Pressable onPress={onPress} style={[styles.membershipRow, selected && styles.membershipRowSelected]}><View style={[styles.membershipCheck, selected && styles.membershipCheckSelected]}><Text style={styles.membershipCheckText}>{selected ? '✓' : '+'}</Text></View><View style={styles.flex}><Text style={styles.membershipTitle}>{title}</Text><Text style={styles.membershipDetail}>{detail}</Text></View><Text style={[styles.membershipAction, selected && styles.membershipActionRemove]}>{selected ? 'Remove' : 'Add'}</Text></Pressable>;
}

function CollectionCard({ collection, index, onOpen }: { collection: JourneyCollection; index: number; onOpen: () => void }) {
  const colors = ['#ff795b', '#9b7cff', '#43e6ae'];
  const color = colors[index % colors.length];
  return <Pressable onPress={onOpen} style={styles.memoryCollectionCard}>{collection.photos[0] ? <JourneyPhotoImage photo={collection.photos[0]} style={styles.collectionArtwork} /> : <View style={[styles.collectionArtwork, { backgroundColor: `${color}20` }]}><View style={[styles.collectionArtworkOrb, { backgroundColor: color }]} /><View style={[styles.collectionArtworkRoute, { backgroundColor: color }]} /></View>}<View style={styles.flex}><Text style={styles.collectionKicker}>COLLECTION</Text><Text style={styles.collectionTitle}>{collection.name}</Text><Text style={styles.collectionMeta}>{collection.driveIds.length} journeys  •  {collection.photos.length} photos{collection.description ? `  •  ${collection.description}` : ''}</Text></View><View style={styles.collectionManage}><Text style={styles.collectionManageText}>Open</Text></View></Pressable>;
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

function JourneyDetailModal({ visible, state, onClose, onRetry, onLocationsSaved }: { visible: boolean; state: LoadState<JourneyDetail | null>; onClose: () => void; onRetry: () => void; onLocationsSaved: () => Promise<void> }) {
  const journey = state.data;
  const rawStartingLocation = journey?.rawStartingLocation || journey?.startingLocation || 'Unknown start';
  const rawEndingLocation = journey?.rawEndingLocation || journey?.endingLocation || 'Unknown destination';
  const startingLocationKey = journey?.startingLocationKey || rawStartingLocation;
  const endingLocationKey = journey?.endingLocationKey || rawEndingLocation;
  const [shareCard, setShareCard] = useState<ShareCardPayload | null>(null);
  const [editingLocations, setEditingLocations] = useState(false);
  const [startingName, setStartingName] = useState('');
  const [endingName, setEndingName] = useState('');
  const [savingLocations, setSavingLocations] = useState(false);

  useEffect(() => {
    if (!visible) { setEditingLocations(false); return; }
    if (!journey) return;
    setStartingName(journey.startingLocation && journey.startingLocation !== rawStartingLocation ? journey.startingLocation : '');
    setEndingName(journey.endingLocation && journey.endingLocation !== rawEndingLocation ? journey.endingLocation : '');
  }, [journey, visible]);

  const saveLocations = async () => {
    if (!journey) return;
    const start = startingName.trim(), end = endingName.trim();
    if (startingLocationKey === endingLocationKey && start !== end) {
      Alert.alert('Use one name for this place', 'This journey starts and ends at the same saved place. Give both endpoints the same name.');
      return;
    }
    setSavingLocations(true);
    try {
      await appDataClient.savePlaceAlias(startingLocationKey, start);
      if (endingLocationKey !== startingLocationKey) await appDataClient.savePlaceAlias(endingLocationKey, end);
      await onLocationsSaved();
      setEditingLocations(false);
    } catch (error) {
      Alert.alert('Location names were not saved', error instanceof Error ? error.message : 'JourneyDeck could not save these location names.');
    } finally {
      setSavingLocations(false);
    }
  };

  return <>
    <OverlayModal visible={visible} kicker="JOURNEY OVERVIEW" title={journey ? formatCompactDate(journey.startedAt) : 'Journey'} onClose={onClose}>
      {state.status === 'loading' ? <LoadingCard /> : state.status === 'error' || !journey ? <InlineNotice message={state.message ?? 'Journey unavailable.'} onRetry={onRetry} /> : <>
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
            {editingLocations && <View style={styles.locationEditor}>
              <Text style={styles.locationEditorKicker}>NAME THE PLACES IN THIS JOURNEY</Text>
              <Text style={styles.locationEditorHelp}>Names are reused whenever the same place appears. Leave a name blank to restore the original location.</Text>
              <View style={styles.locationField}><Text style={styles.locationFieldLabel}>START</Text><TextInput value={startingName} onChangeText={setStartingName} placeholder="Home, Work, School…" placeholderTextColor="#716879" maxLength={64} returnKeyType="next" style={styles.editorInput} /><Text style={styles.locationRaw} numberOfLines={2}>{rawStartingLocation}</Text></View>
              <View style={styles.locationField}><Text style={styles.locationFieldLabel}>DESTINATION</Text><TextInput value={endingName} onChangeText={setEndingName} placeholder="Home, Work, School…" placeholderTextColor="#716879" maxLength={64} returnKeyType="done" style={styles.editorInput} /><Text style={styles.locationRaw} numberOfLines={2}>{rawEndingLocation}</Text></View>
              <View style={styles.editorActions}><Pressable onPress={() => setEditingLocations(false)} disabled={savingLocations} style={styles.editorCancel}><Text style={styles.editorCancelText}>Cancel</Text></Pressable><Pressable onPress={() => void saveLocations()} disabled={savingLocations} style={[styles.editorSave, savingLocations && styles.pressed]}><Text style={styles.editorSaveText}>{savingLocations ? 'Saving…' : 'Save names'}</Text></Pressable></View>
            </View>}
            {!editingLocations && <View style={styles.journeyActions}>
              <Pressable onPress={() => { onClose(); setShareCard({ kind: 'journey', eyebrow: 'A JOURNEY REMEMBERED', title: formatFullDate(journey.startedAt), subtitle: 'A privacy-safe recap of time on the road—without precise locations.', metrics: [{ label: 'DISTANCE', value: formatMiles(journey.miles) }, { label: 'DRIVE TIME', value: formatDuration(journey.durationMinutes) }, { label: 'SONGS', value: String(journey.songCount) }], accent: '#43e6ae' }); }} style={styles.journeyShareButton}><Text style={styles.journeyShareButtonText}>Create share card</Text></Pressable>
              <Pressable onPress={() => setEditingLocations(true)} style={styles.journeyEditButton}><Text style={styles.journeyEditButtonText}>Edit locations</Text></Pressable>
            </View>}
          </>}
    </OverlayModal>
    <ShareCardModal payload={shareCard} onClose={() => setShareCard(null)} />
  </>;
}

function ConnectionsScreen({
  dashboard, provider, recordingMode, capabilities, connectionCapabilities, lastFmUsername, editingLastFm, lastFmDraft,
  savingLastFm, syncingLastFm, onLastFmDraft, onEditLastFm, onCancelLastFm, onSaveLastFm, onSyncLastFm, onChangeProvider,
  onChangeRecordingMode, onConnectAppleMusic, onEnableRecognition,
}: {
  dashboard: AppDashboard;
  provider: MusicProvider;
  recordingMode: RecordingMode;
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
  onChangeRecordingMode: () => void;
  onChangeProvider: () => void;
  onConnectAppleMusic: () => void;
  onEnableRecognition: () => void;
}) {
  const selected = providerOptions.find(option => option.id === provider)!;
  const selectedRecordingMode = recordingModeOptions.find(option => option.id === recordingMode)!;
  const connections = dashboard.providerPreferences?.connections ?? defaultConnections;
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.pageContent} showsVerticalScrollIndicator={false}>
        <PageHeader eyebrow="YOUR DATA, YOUR CHOICE" title="Connections" body="JourneyDeck works as a recorder on its own. Add music or vehicle context whenever you are ready." />
        <SectionHeading title="Recording" />
        <View style={[styles.selectedProvider, { borderColor: selectedRecordingMode.color }]}>
          <View style={[styles.connectionIcon, { backgroundColor: selectedRecordingMode.color }]}><Text style={styles.connectionIconText}>{selectedRecordingMode.symbol}</Text></View>
          <View style={styles.flex}><Text style={styles.connectionKicker}>SELECTED JOURNEY START METHOD</Text><Text style={styles.connectionName}>{selectedRecordingMode.name}</Text><Text style={styles.connectionDetail}>{selectedRecordingMode.summary}</Text></View>
          <Pressable onPress={onChangeRecordingMode} style={styles.changeButton}><Text style={styles.changeButtonText}>Change</Text></Pressable>
        </View>

        <SectionHeading title="Soundtrack method" />
        <View style={[styles.selectedProvider, { borderColor: selected.color }]}>
          <View style={[styles.connectionIcon, { backgroundColor: selected.color }]}><Text style={styles.connectionIconText}>{selected.symbol}</Text></View>
          <View style={styles.flex}><Text style={styles.connectionKicker}>SELECTED MUSIC METHOD · NOT A CONNECTION</Text><Text style={styles.connectionName}>{selected.name}</Text><Text style={styles.connectionDetail}>{selected.summary}</Text></View>
          <Pressable onPress={onChangeProvider} style={styles.changeButton}><Text style={styles.changeButtonText}>Change</Text></Pressable>
        </View>

        <SectionHeading title="Music connections" />
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
  const navigationPadding = 6;
  const navigationGap = 4;
  const navRef = useRef<View>(null);
  const navX = useRef(0);
  const navWidth = useRef(0);
  const indicatorWidthRef = useRef(0);
  const indicatorX = useRef(new Animated.Value(0)).current;
  const [indicatorWidth, setIndicatorWidth] = useState(0);
  const activeRef = useRef(active);
  const dragging = useRef(false);
  const lastDraggedTab = useRef<Tab | null>(null);
  const [reduceTransparency, setReduceTransparency] = useState(false);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  activeRef.current = active;

  function tabIndex(tab: Tab) {
    return Math.max(0, bottomNavigationItems.findIndex(item => item.id === tab));
  }

  function snapToTab(tab: Tab) {
    if (navWidth.current <= 0) return;
    Animated.spring(indicatorX, {
      toValue: navigationTabX(tabIndex(tab), navWidth.current, bottomNavigationItems.length, navigationPadding, navigationGap),
      speed: 24,
      bounciness: 5,
      useNativeDriver: true,
    }).start();
  }

  function moveIndicator(locationX: number) {
    if (navWidth.current <= 0 || indicatorWidthRef.current <= 0) return;
    indicatorX.setValue(navigationIndicatorX(locationX, navWidth.current, bottomNavigationItems.length, navigationPadding, navigationGap));
  }

  function selectAt(locationX: number) {
    if (navWidth.current <= 0) return;
    const index = navigationIndexAtX(locationX, navWidth.current, bottomNavigationItems.length, navigationPadding, navigationGap);
    const next = bottomNavigationItems[index].id;
    if (lastDraggedTab.current === next) return;
    lastDraggedTab.current = next;
    onSelectRef.current(next);
  }

  function moveAtScreenX(screenX: number) {
    const locationX = screenX - navX.current;
    moveIndicator(locationX);
    selectAt(locationX);
  }

  function finishDrag() {
    const finalTab = lastDraggedTab.current ?? activeRef.current;
    dragging.current = false;
    lastDraggedTab.current = null;
    snapToTab(finalTab);
  }

  const dragResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_event, gesture) => Math.abs(gesture.dx) > 4 && Math.abs(gesture.dx) > Math.abs(gesture.dy),
    onPanResponderGrant: (_event, gesture) => { dragging.current = true; moveAtScreenX(gesture.moveX); },
    onPanResponderMove: (_event, gesture) => moveAtScreenX(gesture.moveX),
    onPanResponderRelease: (_event, gesture) => { moveAtScreenX(gesture.moveX); finishDrag(); },
    onPanResponderTerminate: finishDrag,
  })).current;

  useEffect(() => {
    if (!dragging.current) snapToTab(active);
  }, [active, indicatorX]);

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceTransparencyEnabled().then(enabled => {
      if (mounted) setReduceTransparency(enabled);
    });
    const subscription = AccessibilityInfo.addEventListener('reduceTransparencyChanged', setReduceTransparency);
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  function measureNavigation() {
    navRef.current?.measureInWindow((x, _y, width) => {
      navX.current = x;
      navWidth.current = width;
      const nextWidth = navigationGeometry(width, bottomNavigationItems.length, navigationPadding, navigationGap).itemWidth;
      indicatorWidthRef.current = nextWidth;
      setIndicatorWidth(previous => Math.abs(previous - nextWidth) < 0.5 ? previous : nextWidth);
      indicatorX.setValue(navigationTabX(tabIndex(activeRef.current), width, bottomNavigationItems.length, navigationPadding, navigationGap));
    });
  }

  const navigationItems = bottomNavigationItems.map(item => {
    const selected = active === item.id;
    return (
      <Pressable
        key={item.id}
        onPress={() => onSelect(item.id)}
        accessibilityRole="tab"
        accessibilityLabel={`${item.label} tab`}
        accessibilityState={{ selected }}
        hitSlop={4}
        style={({ pressed }) => [styles.navItem, pressed && styles.navItemPressed]}
      >
        <View style={[styles.navSymbolFrame, selected && styles.navSymbolFrameActive]}>
          <SymbolView
            name={item.symbol}
            fallback={<Text style={[styles.navSymbolFallback, selected && styles.navActive]}>{item.fallback}</Text>}
            size={25}
            weight={selected ? 'semibold' : 'medium'}
            tintColor={selected ? '#ff8b4f' : '#a78db8'}
            style={styles.navSymbol}
          />
        </View>
        <Text style={[styles.navLabel, selected && styles.navActive]}>{item.label}</Text>
        {selected && <View style={styles.navActiveLine} />}
      </Pressable>
    );
  });
  const navigationTrack = <View
    ref={navRef}
    style={styles.navTrack}
    onLayout={measureNavigation}
    {...dragResponder.panHandlers}
  >
    <View pointerEvents="none" style={styles.navGlassSheen} />
    {indicatorWidth > 0 && <Animated.View pointerEvents="none" style={[styles.navGlidingIndicator, { width: indicatorWidth, transform: [{ translateX: indicatorX }] }]}>
      <View style={styles.navGlidingFill}><View style={styles.navGlidingVioletWash} /></View>
    </Animated.View>}
    {navigationItems}
  </View>;
  const hasNativeLiquidGlass = !reduceTransparency && isLiquidGlassAvailable() && isGlassEffectAPIAvailable();
  return (
    <View style={styles.navDockFrame}>
      <View pointerEvents="none" style={styles.navDockAura} />
      <View style={styles.bottomNav}>
        {hasNativeLiquidGlass
          ? <GlassView pointerEvents="none" glassEffectStyle="clear" colorScheme="dark" tintColor="rgba(46, 18, 58, 0.14)" style={styles.navMaterial} />
          : <View pointerEvents="none" style={[styles.navMaterial, styles.bottomNavFallback]} />}
        <View pointerEvents="none" style={styles.navSurfaceTint} />
        <View pointerEvents="none" style={styles.navSurfaceWarmWash} />
        {navigationTrack}
      </View>
    </View>
  );
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

function JourneyCard({ journey, onPress, compact = false }: { journey: JourneySummary; onPress: () => void; compact?: boolean }) {
  const track = journey.soundtrackPreview?.[0];
  if (compact) return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.journeyCardCompact, pressed && styles.pressed]}>
      <View style={styles.journeyCompactTop}>
        <View style={styles.flex}>
          <Text style={styles.journeyDateCompact}>{formatFullDate(journey.startedAt)}</Text>
          <Text style={styles.journeyRouteCompact} numberOfLines={1}>{locationPair(journey)}</Text>
          <View style={styles.journeyStatsCompact}><Text style={styles.journeyStatCompact}>{formatMiles(journey.miles)}</Text><Text style={styles.journeyStatDot}>•</Text><Text style={styles.journeyStatCompact}>{formatDuration(journey.durationMinutes)}</Text></View>
        </View>
        <Text style={styles.journeyChevronCompact}>›</Text>
      </View>
      <View style={styles.journeySoundtrackCompact}>
        {track ? <Artwork track={track} size={30} /> : <View style={styles.miniArtworkCompact}><Text style={styles.miniArtworkTextCompact}>♪</Text></View>}
        <Text style={styles.journeySongCompact} numberOfLines={1}>{track ? `${track.track}  ·  ${track.artist}` : (journey.songCount ? `${journey.songCount} soundtrack songs` : 'No soundtrack matched')}</Text>
        {journey.songCount > 0 && <Text style={styles.songCountCompact}>{journey.songCount}</Text>}
      </View>
    </Pressable>
  );
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
function formatNumber(value: number) { return value < 10 && value % 1 ? value.toFixed(1) : String(Math.round(value)); }
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
  app: { flex: 1, backgroundColor: '#08070d' }, screenBody: { flex: 1 }, recorderVisible: { flex: 1, paddingBottom: 104 }, recorderHidden: { display: 'none' }, flex: { flex: 1 }, safe: { flex: 1, backgroundColor: '#08070d' },
  loadingScreen: { flex: 1, backgroundColor: '#08070d', alignItems: 'center', justifyContent: 'center', gap: 14 }, loadingText: { color: '#b8afc5', fontSize: 14 },
  pageContent: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 128, gap: 16 },
  webDashboardPage: { paddingHorizontal: 6, paddingTop: 6, paddingBottom: 116, gap: 8 },
  webDashboardShell: { gap: 8, padding: 8, borderRadius: 30, borderWidth: 1, borderColor: '#34204f', backgroundColor: '#05040e', shadowColor: '#000', shadowOpacity: 0.7, shadowRadius: 28, overflow: 'hidden' },
  webHero: { height: 318, padding: 16, justifyContent: 'space-between', overflow: 'hidden', borderTopLeftRadius: 22, borderTopRightRadius: 22, borderBottomLeftRadius: 9, borderBottomRightRadius: 9 },
  webHeroImage: { borderTopLeftRadius: 22, borderTopRightRadius: 22, borderBottomLeftRadius: 9, borderBottomRightRadius: 9 },
  webHeroShade: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: '#03020a44' },
  webHeroTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  webHeroKicker: { color: '#ff7557', fontSize: 27, fontWeight: '900', letterSpacing: 1.8, textShadowColor: '#441525', textShadowRadius: 18 },
  webHeroScript: { color: '#ff5365', fontSize: 36, lineHeight: 39, fontWeight: '800', fontStyle: 'italic', marginTop: -2, textShadowColor: '#5f1829', textShadowRadius: 20 },
  webLivePill: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 34, paddingHorizontal: 11, borderRadius: 12, borderWidth: 1, borderColor: '#ff596044', backgroundColor: '#090816c9' },
  webLiveDot: { width: 7, height: 7, borderRadius: 4, shadowColor: '#ff5960', shadowOpacity: 1, shadowRadius: 8 }, webLiveText: { color: '#f3ebf4', fontSize: 8, fontWeight: '900', letterSpacing: 1.1 },
  webHeroBottom: { gap: 2 }, webHeroWeekLabel: { color: '#ff7966', fontSize: 8, fontWeight: '900', letterSpacing: 1.5 }, webHeroWeekValue: { color: '#fff8ff', fontSize: 38, lineHeight: 42, fontWeight: '900', letterSpacing: -1.4, textShadowColor: '#05040e', textShadowRadius: 12 }, webHeroWeekDetail: { color: '#c0b7c9', fontSize: 10, fontWeight: '700', textShadowColor: '#05040e', textShadowRadius: 8 },
  webHeroMetricRail: { flexDirection: 'row', marginTop: 10, paddingVertical: 12, borderRadius: 14, borderWidth: 1, borderColor: '#5a326077', backgroundColor: '#090714dd' },
  webMusicCard: { minHeight: 124, flexDirection: 'row', alignItems: 'center', gap: 13, padding: 13, overflow: 'hidden', borderRadius: 18, borderWidth: 1, borderColor: '#5f347b66', backgroundColor: '#100920', shadowColor: '#5d20a3', shadowOpacity: 0.25, shadowRadius: 14 }, webMusicGlow: { position: 'absolute', width: 180, height: 180, borderRadius: 90, right: -50, bottom: -95, backgroundColor: '#562093', opacity: 0.22 }, webEmptyAlbum: { width: 92, height: 92, borderRadius: 12, padding: 9, justifyContent: 'space-between', backgroundColor: '#38133e', borderWidth: 1, borderColor: '#7a385e', shadowColor: '#ff526c', shadowOpacity: 0.35, shadowRadius: 12 }, webEmptyAlbumWord: { color: '#ff8a79', fontSize: 8, lineHeight: 9, fontWeight: '900' }, webEmptyAlbumNote: { color: '#f0b7ff', fontSize: 33, fontWeight: '900', alignSelf: 'center' },
  webTrackCopy: { flex: 1, minWidth: 0 }, webCardKicker: { color: '#ff5f67', fontSize: 8, fontWeight: '900', letterSpacing: 1.1 }, webTrackTitle: { color: '#f8f3fb', fontSize: 19, lineHeight: 22, fontWeight: '800', marginTop: 3 }, webTrackArtist: { color: '#a15df1', fontSize: 12, fontWeight: '700', marginTop: 2 }, webWaveform: { height: 40, flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 5, overflow: 'hidden' }, webWaveBar: { flex: 1, maxWidth: 3, borderRadius: 2, backgroundColor: '#d34cf3', shadowColor: '#ff4e70', shadowOpacity: 0.8, shadowRadius: 4 }, webTrackTime: { flexDirection: 'row', justifyContent: 'space-between' }, webTrackTimeText: { color: '#8b8196', fontSize: 6, fontWeight: '800', letterSpacing: 0.6 },
  webDrivingCard: { height: 174, overflow: 'hidden', borderRadius: 18, borderWidth: 1, borderColor: '#5f347b66', backgroundColor: '#0e0a1c', padding: 14 }, webDrivingGlow: { position: 'absolute', width: 160, height: 160, borderRadius: 80, left: -85, bottom: -110, backgroundColor: '#ff3b6c', opacity: 0.15 }, webDrivingHeading: { position: 'absolute', left: 14, top: 13 }, webDrivingValue: { color: '#fff8ff', fontSize: 36, lineHeight: 42, fontWeight: '900', letterSpacing: -1.4 }, webDrivingUnit: { color: '#b8b0c1', fontSize: 14, fontWeight: '700' }, webDrivingFacts: { position: 'absolute', left: '53%', top: 18, flexDirection: 'row', gap: 22 }, webFactValue: { color: '#f4eff7', fontSize: 14, fontWeight: '900' }, webFactLabel: { color: '#80788b', fontSize: 8, marginTop: 2 },
  webHourlyChart: { position: 'absolute', left: 14, right: 77, bottom: 28, height: 58, flexDirection: 'row', alignItems: 'flex-end', gap: 3, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#393049' }, webHourlyBar: { flex: 1, minHeight: 3, borderTopLeftRadius: 2, borderTopRightRadius: 2, backgroundColor: '#d74483', shadowColor: '#ff4b72', shadowOpacity: 0.5, shadowRadius: 4 }, webChartAxis: { position: 'absolute', left: 14, right: 76, bottom: 11, flexDirection: 'row', justifyContent: 'space-between' }, webChartAxisText: { color: '#6f6779', fontSize: 5.5, fontWeight: '700' },
  webScoreRing: { position: 'absolute', right: 10, bottom: 24, width: 60, height: 60, borderRadius: 30, padding: 5, borderWidth: 5, borderColor: '#ff694f', shadowColor: '#ff694f', shadowOpacity: 0.4, shadowRadius: 8 }, webScoreRingInner: { flex: 1, borderRadius: 25, backgroundColor: '#160e21', alignItems: 'center', justifyContent: 'center' }, webScoreIcon: { color: '#ff7a58', fontSize: 10, fontWeight: '900' }, webScoreValue: { color: '#a25cff', fontSize: 14, fontWeight: '900' }, webScoreLabel: { color: '#777081', fontSize: 5, fontWeight: '900', letterSpacing: 0.8 },
  webRecorderStrip: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 13, borderRadius: 16, borderWidth: 1, borderColor: '#442c58', backgroundColor: '#0d0a18' }, webRecorderBeacon: { width: 30, height: 30, borderRadius: 15, borderWidth: 1, alignItems: 'center', justifyContent: 'center', shadowColor: '#9b7cff', shadowOpacity: 0.7, shadowRadius: 8 }, webRecorderBeaconCore: { width: 9, height: 9, borderRadius: 5 }, webRecorderTitle: { color: '#eee8f4', fontSize: 12, fontWeight: '900' }, webRecorderDetail: { color: '#847b8e', fontSize: 9, lineHeight: 13, marginTop: 3 }, webRecorderChevron: { color: '#8f72b5', fontSize: 28, lineHeight: 30 },
  webActions: { height: 96, flexDirection: 'row', gap: 6 }, webAction: { flex: 1, minWidth: 0, overflow: 'hidden', borderRadius: 15, borderWidth: 1, padding: 8, alignItems: 'center', justifyContent: 'flex-end' }, webActionGlow: { position: 'absolute', width: 74, height: 74, borderRadius: 37, top: -47, opacity: 0.28, shadowOpacity: 0.8, shadowRadius: 16 }, webActionSymbol: { fontSize: 22, fontWeight: '900', marginBottom: 8, textShadowColor: '#000', textShadowRadius: 4 }, webActionTitle: { color: '#f3edf6', fontSize: 10, fontWeight: '900' }, webActionDetail: { color: '#918899', fontSize: 6.5, marginTop: 2 },
  webBottomGrid: { minHeight: 200, flexDirection: 'row', gap: 7 }, webJourneysPanel: { flex: 1.45, overflow: 'hidden', borderRadius: 17, borderWidth: 1, borderColor: '#4b2d6566', backgroundColor: '#0c0918' }, webHealthPanel: { flex: 1, overflow: 'hidden', borderRadius: 17, borderWidth: 1, borderColor: '#4b2d6566', backgroundColor: '#0c0918' }, webPanelHeader: { minHeight: 38, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 11 }, webPanelTitle: { color: '#ff5969', fontSize: 7, fontWeight: '900', letterSpacing: 0.9 }, webPanelAction: { color: '#91889b', fontSize: 7, fontWeight: '700' }, webPanelEmpty: { color: '#81798a', fontSize: 9, lineHeight: 14, padding: 12 },
  webJourneyRow: { minHeight: 79, flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#382643' }, webPlaceIcon: { width: 27, height: 27, borderRadius: 14, backgroundColor: '#481b33', alignItems: 'center', justifyContent: 'center' }, webJourneyOrigin: { color: '#8d8298', fontSize: 6.5 }, webJourneyDestination: { color: '#f0eaf3', fontSize: 9, fontWeight: '900', marginTop: 2 }, webJourneyMeta: { color: '#756c7e', fontSize: 6.5, marginTop: 3 }, webRouteThumb: { width: 45, height: 34, borderRadius: 6, backgroundColor: '#0a0a1c', borderWidth: 1, borderColor: '#35264e', overflow: 'hidden' }, webRouteThumbLine: { position: 'absolute', width: 42, height: 2, borderRadius: 1, backgroundColor: '#ff694f', left: 2, top: 17, transform: [{ rotate: '-18deg' }], shadowColor: '#ff4e60', shadowOpacity: 1, shadowRadius: 4 }, webRouteThumbStart: { position: 'absolute', width: 5, height: 5, borderRadius: 3, backgroundColor: '#9746f5', left: 3, top: 21 }, webRouteThumbEnd: { position: 'absolute', width: 5, height: 5, borderRadius: 3, backgroundColor: '#ffc2af', right: 2, top: 9 },
  webCompactHealth: { flex: 1, minHeight: 50, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#382643' }, webServiceIcon: { width: 25, height: 25, borderRadius: 13, alignItems: 'center', justifyContent: 'center' }, webServiceIconText: { color: '#edf8ff', fontSize: 9, fontWeight: '900' }, webServiceName: { color: '#f0eaf4', fontSize: 8, fontWeight: '900' }, webServiceDetail: { color: '#81788a', fontSize: 6.5, marginTop: 2 }, webHealthCheck: { width: 17, height: 17, borderRadius: 9, alignItems: 'center', justifyContent: 'center' }, webHealthCheckText: { color: '#0d0920', fontSize: 8, fontWeight: '900' },
  webWeekCard: { minHeight: 225, borderRadius: 18, borderWidth: 1, borderColor: '#51336a77', backgroundColor: '#0c0918', padding: 13 }, webWeekSubtitle: { color: '#f0eaf5', fontSize: 14, fontWeight: '900', marginTop: 4 }, webWeekChart: { height: 96, flexDirection: 'row', alignItems: 'flex-end', gap: 10, marginTop: 10 }, webWeekColumn: { flex: 1, height: '100%', alignItems: 'center', gap: 5 }, webWeekTrack: { width: 15, flex: 1, borderRadius: 8, backgroundColor: '#171221', overflow: 'hidden', justifyContent: 'flex-end' }, webWeekBar: { width: '100%', minHeight: 5, borderRadius: 8, backgroundColor: '#8554e6', shadowColor: '#9d63ff', shadowOpacity: 0.8, shadowRadius: 6 }, webWeekDay: { color: '#6d6475', fontSize: 7, fontWeight: '900' }, webWeekStats: { minHeight: 47, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#392943' }, webWeekStatValue: { color: '#f8f2fb', fontSize: 13, fontWeight: '900' }, webWeekStatLabel: { color: '#756c7e', fontSize: 5.5, fontWeight: '900', letterSpacing: 0.7, marginTop: 3 },
  webAllTimeRail: { minHeight: 84, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 13, borderRadius: 17, borderWidth: 1, borderColor: '#4c305f66', backgroundColor: '#100a1c' }, webAllTimeKicker: { color: '#ff6b67', fontSize: 7, fontWeight: '900', letterSpacing: 1 }, webAllTimeTitle: { color: '#f4eef8', fontSize: 15, fontWeight: '900', marginTop: 4 }, webAllTimeMetric: { flex: 1, alignItems: 'flex-end' }, webAllTimeMetricValue: { color: '#f7f1fb', fontSize: 13, fontWeight: '900' }, webAllTimeMetricLabel: { color: '#716878', fontSize: 5.5, fontWeight: '900', letterSpacing: 0.6, marginTop: 3 }, webQueueNote: { color: '#ffbb73', fontSize: 9, textAlign: 'center', padding: 8 },
  memoriesPage: { paddingTop: 24, paddingBottom: 128, gap: 16 },
  overlayRoot: { flex: 1, justifyContent: 'flex-end', backgroundColor: '#030106cc' }, overlaySheet: { maxHeight: '94%', margin: 8, overflow: 'hidden', borderRadius: 28, borderWidth: 1, borderColor: '#5d4273', backgroundColor: '#0a0710', shadowColor: '#000', shadowOpacity: 0.85, shadowRadius: 30, shadowOffset: { width: 0, height: -8 } }, overlayHeader: { minHeight: 74, flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 18, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#382641' }, overlayKicker: { color: '#ff795b', fontSize: 8, fontWeight: '900', letterSpacing: 1.5 }, overlayTitle: { color: '#f7f1fa', fontSize: 21, fontWeight: '900', marginTop: 3 }, overlayClose: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#4b3758', backgroundColor: '#17101f' }, overlayCloseText: { color: '#d7c9df', fontSize: 27, lineHeight: 29 }, overlayContent: { padding: 16, paddingBottom: 26, gap: 14 },
  overviewHero: { height: 260, overflow: 'hidden', borderRadius: 22, borderWidth: 1, borderColor: '#593c70', backgroundColor: '#171021' }, overviewCollectionHero: { height: 230, overflow: 'hidden', borderRadius: 22, borderWidth: 1, borderColor: '#593c70', backgroundColor: '#171021' }, overviewCollectionImage: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }, overviewCollectionFallback: { backgroundColor: '#241433' }, overviewHeroCopy: { position: 'absolute', left: 20, right: 20, bottom: 19 }, overviewEyebrow: { color: '#ff9a79', fontSize: 8, fontWeight: '900', letterSpacing: 1.4 }, overviewHeroTitle: { color: '#fff8ff', fontSize: 29, lineHeight: 33, fontWeight: '900', letterSpacing: -0.7, marginTop: 6 }, overviewMetrics: { flexDirection: 'row', overflow: 'hidden', borderRadius: 17, borderWidth: 1, borderColor: '#352b40', backgroundColor: '#111018' }, overviewMetric: { flex: 1, minHeight: 70, alignItems: 'center', justifyContent: 'center', borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: '#342b3d' }, overviewMetricValue: { color: '#f7f2fb', fontSize: 19, fontWeight: '900' }, overviewMetricLabel: { color: '#81758b', fontSize: 7, fontWeight: '900', letterSpacing: 1, marginTop: 5 }, overviewBody: { color: '#c7bdce', fontSize: 13, lineHeight: 20 }, overviewBodyMuted: { color: '#857d8d', fontSize: 12, lineHeight: 18, fontStyle: 'italic' }, overviewSectionLabel: { color: '#a88aff', fontSize: 8, fontWeight: '900', letterSpacing: 1.4, marginTop: 3 }, overviewListRow: { minHeight: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingHorizontal: 13, borderRadius: 14, borderWidth: 1, borderColor: '#30283a', backgroundColor: '#111018' }, overviewListTitle: { color: '#eee8f3', fontSize: 13, fontWeight: '800' }, overviewListMeta: { color: '#8c8295', fontSize: 10, marginTop: 3 }, overviewChevron: { color: '#a88aff', fontSize: 24 }, overviewActions: { flexDirection: 'row', gap: 9, marginTop: 4 }, overviewShare: { flex: 1, minHeight: 50, alignItems: 'center', justifyContent: 'center', borderRadius: 15, borderWidth: 1, borderColor: '#65468a', backgroundColor: '#20152e' }, overviewShareText: { color: '#c2a7ff', fontSize: 12, fontWeight: '900' }, overviewPrimary: { flex: 1.25, minHeight: 50, alignItems: 'center', justifyContent: 'center', borderRadius: 15, backgroundColor: '#ff795b' }, overviewPrimaryText: { color: '#1b0b07', fontSize: 12, fontWeight: '900' }, modalEditorBody: { gap: 12 }, journeyActions: { flexDirection: 'row', gap: 9, marginTop: 6 }, journeyShareButton: { flex: 1, minHeight: 54, alignItems: 'center', justifyContent: 'center', borderRadius: 16, borderWidth: 1, borderColor: '#65468a', backgroundColor: '#20152e' }, journeyShareButtonText: { color: '#c7adff', fontSize: 12, fontWeight: '900', textAlign: 'center' }, journeyEditButton: { flex: 1, minHeight: 54, alignItems: 'center', justifyContent: 'center', borderRadius: 16, backgroundColor: '#ff795b' }, journeyEditButtonText: { color: '#1b0b07', fontSize: 12, fontWeight: '900' }, locationEditor: { gap: 11, marginTop: 6, padding: 14, borderRadius: 18, borderWidth: 1, borderColor: '#4e3b60', backgroundColor: '#100d16' }, locationEditorKicker: { color: '#b99cff', fontSize: 9, fontWeight: '900', letterSpacing: 1.4 }, locationEditorHelp: { color: '#9b91a4', fontSize: 11, lineHeight: 17 }, locationField: { gap: 5 }, locationFieldLabel: { color: '#ff9a79', fontSize: 8, fontWeight: '900', letterSpacing: 1.2 }, locationRaw: { color: '#6f6877', fontSize: 9, lineHeight: 13, paddingHorizontal: 3 },
  memoryPageHeader: { marginHorizontal: 20 },
  memorySectionHeader: { marginHorizontal: 20, marginTop: 5, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }, memoryLevel: { color: '#a88aff', fontSize: 9, fontWeight: '900', letterSpacing: 1.8 }, memorySectionTitle: { color: '#f5f0fb', fontSize: 19, fontWeight: '900', marginTop: 4 }, memoryHeaderActions: { flexDirection: 'row', alignItems: 'center', gap: 12 }, memoryHeaderAction: { color: '#ff8767', fontSize: 11, fontWeight: '900' },
  memoryCarouselContent: { paddingHorizontal: 20, paddingBottom: 12, gap: 14 }, memoryHeroCard: { height: 244, borderRadius: 26, overflow: 'hidden', backgroundColor: '#14101e', borderWidth: 1, borderColor: '#4c375d', padding: 20, justifyContent: 'flex-end', shadowColor: '#9b7cff', shadowOpacity: 0.25, shadowRadius: 18 }, memoryEmptyHero: { marginHorizontal: 20 }, memoryHeroShade: { position: 'absolute', left: 0, right: 0, top: 100, bottom: 0, backgroundColor: '#09071099' }, memoryHeroKicker: { color: '#ff9b7c', fontSize: 9, fontWeight: '900', letterSpacing: 1.5 }, memoryHeroTitle: { color: '#fff8ff', fontSize: 29, lineHeight: 34, fontWeight: '900', marginTop: 7, letterSpacing: -0.7 }, memoryHeroMeta: { color: '#c2b7ca', fontSize: 12, fontWeight: '700', marginTop: 7 }, memoryDots: { minHeight: 8, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6 }, memoryDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#403748' }, memoryDotActive: { width: 24, backgroundColor: '#ff795b' },
  memoryArtwork: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: '#241433', overflow: 'hidden' }, memoryArtworkNight: { backgroundColor: '#0b1630' }, memoryArtworkGlow: { position: 'absolute', width: 210, height: 210, borderRadius: 105, backgroundColor: '#8f3957', opacity: 0.52, left: '50%', marginLeft: -105, top: -78, shadowColor: '#ff7159', shadowOpacity: 0.8, shadowRadius: 30 }, memoryArtworkMoon: { position: 'absolute', width: 58, height: 58, borderRadius: 29, backgroundColor: '#ff8463', left: '50%', marginLeft: -29, top: 35, shadowColor: '#ff8463', shadowOpacity: 1, shadowRadius: 20 }, memoryArtworkLine: { position: 'absolute', width: 3, height: 185, backgroundColor: '#9d75ff', top: 80, shadowColor: '#a88aff', shadowOpacity: 1, shadowRadius: 9 }, memoryArtworkLineLeft: { left: '50%', marginLeft: -71, transform: [{ rotate: '31deg' }] }, memoryArtworkLineRight: { right: '50%', marginRight: -71, transform: [{ rotate: '-31deg' }] }, memoryArtworkDashOne: { position: 'absolute', width: 3, height: 12, backgroundColor: '#ffd0c4', left: '50%', top: 103 }, memoryArtworkDashTwo: { position: 'absolute', width: 5, height: 24, backgroundColor: '#ff8a68', left: '50%', marginLeft: -1, top: 132 }, memoryArtworkDashThree: { position: 'absolute', width: 7, height: 45, backgroundColor: '#ff795b', left: '50%', marginLeft: -2, top: 180 },
  memoryEditor: { marginHorizontal: 20, backgroundColor: '#121019', borderRadius: 22, borderWidth: 1, borderColor: '#604779', padding: 16, gap: 10 }, collectionEditor: { marginHorizontal: 20, backgroundColor: '#111018', borderRadius: 20, borderWidth: 1, borderColor: '#4a365c', padding: 15, gap: 10 }, editorKicker: { color: '#b693ff', fontSize: 9, fontWeight: '900', letterSpacing: 1.5 }, editorInput: { minHeight: 48, borderRadius: 13, borderWidth: 1, borderColor: '#3b3148', backgroundColor: '#0c0a11', color: '#f5f0f8', fontSize: 14, paddingHorizontal: 13, paddingVertical: 11 }, editorNotes: { minHeight: 76, textAlignVertical: 'top' }, editorInstruction: { color: '#8e8497', fontSize: 11, marginTop: 3 }, editorActions: { flexDirection: 'row', gap: 9, marginTop: 4 }, editorCancel: { flex: 1, minHeight: 46, borderRadius: 13, borderWidth: 1, borderColor: '#3b3345', alignItems: 'center', justifyContent: 'center' }, editorCancelText: { color: '#b5acbd', fontSize: 12, fontWeight: '800' }, editorSave: { flex: 1.4, minHeight: 46, borderRadius: 13, backgroundColor: '#ff795b', alignItems: 'center', justifyContent: 'center' }, editorSaveText: { color: '#1b0b07', fontSize: 12, fontWeight: '900' },
  photoEditorHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 5 }, photoEditorHelp: { color: '#8e8497', fontSize: 10, lineHeight: 15, marginTop: 4 }, photoAddButton: { minHeight: 36, borderRadius: 999, backgroundColor: '#281b39', borderWidth: 1, borderColor: '#684b8c', paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' }, photoAddDisabled: { opacity: 0.42 }, photoAddText: { color: '#c5a5ff', fontSize: 9, fontWeight: '900' }, photoSaveFirst: { color: '#ffad7f', fontSize: 10, lineHeight: 14 }, photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 }, photoTile: { width: '31%', aspectRatio: 0.86, borderRadius: 14, overflow: 'visible', borderWidth: 2, borderColor: 'transparent' }, photoTileSelected: { borderColor: '#ff795b', shadowColor: '#ff795b', shadowOpacity: 0.4, shadowRadius: 8 }, photoTileImage: { width: '100%', height: '100%', borderRadius: 12, overflow: 'hidden' }, photoTileShade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 38, backgroundColor: '#08060bbb' }, photoTileLabel: { position: 'absolute', left: 7, right: 7, bottom: 8, color: '#fff5fb', fontSize: 7, fontWeight: '900', letterSpacing: 0.7 }, photoRemove: { position: 'absolute', right: -7, top: -7, width: 24, height: 24, borderRadius: 12, backgroundColor: '#32151b', borderWidth: 1, borderColor: '#ff795b', alignItems: 'center', justifyContent: 'center' }, photoRemoveText: { color: '#ff9c89', fontSize: 18, lineHeight: 20, fontWeight: '700' }, photoLoading: { backgroundColor: '#1b1524', alignItems: 'center', justifyContent: 'center' }, photoEmpty: { minHeight: 72, borderRadius: 14, borderWidth: 1, borderStyle: 'dashed', borderColor: '#3b3148', backgroundColor: '#0c0a11', padding: 12, justifyContent: 'center' }, photoEmptyTitle: { color: '#d3c6dc', fontSize: 11, fontWeight: '800' }, photoEmptyBody: { color: '#7f7488', fontSize: 9, lineHeight: 14, marginTop: 4 },
  membershipRow: { minHeight: 58, borderRadius: 14, borderWidth: 1, borderColor: '#302839', backgroundColor: '#0d0b12', flexDirection: 'row', alignItems: 'center', gap: 10, padding: 11 }, membershipRowSelected: { borderColor: '#6e4f91', backgroundColor: '#191124' }, membershipCheck: { width: 27, height: 27, borderRadius: 14, borderWidth: 1, borderColor: '#5c5067', alignItems: 'center', justifyContent: 'center' }, membershipCheckSelected: { borderColor: '#43e6ae', backgroundColor: '#123128' }, membershipCheckText: { color: '#a995ba', fontWeight: '900' }, membershipTitle: { color: '#f0eaf5', fontSize: 12, fontWeight: '800' }, membershipDetail: { color: '#7e7487', fontSize: 9, marginTop: 3 }, membershipAction: { color: '#9d7de3', fontSize: 9, fontWeight: '900' }, membershipActionRemove: { color: '#ff9a7b' },
  memoryCollectionCard: { marginHorizontal: 20, minHeight: 98, borderRadius: 20, borderWidth: 1, borderColor: '#2e2738', backgroundColor: '#111018', padding: 13, flexDirection: 'row', alignItems: 'center', gap: 12 }, collectionArtwork: { width: 68, height: 68, borderRadius: 16, overflow: 'hidden' }, collectionArtworkOrb: { position: 'absolute', width: 42, height: 42, borderRadius: 21, opacity: 0.65, right: -8, top: -8, shadowOpacity: 0.8, shadowRadius: 10 }, collectionArtworkRoute: { position: 'absolute', width: 58, height: 3, borderRadius: 2, left: 5, top: 39, transform: [{ rotate: '-25deg' }] }, collectionKicker: { color: '#89779c', fontSize: 8, fontWeight: '900', letterSpacing: 1.2 }, collectionTitle: { color: '#f5eff9', fontSize: 15, fontWeight: '900', marginTop: 5 }, collectionMeta: { color: '#8b8293', fontSize: 10, lineHeight: 14, marginTop: 4 }, collectionManage: { borderRadius: 999, backgroundColor: '#251934', paddingHorizontal: 9, paddingVertical: 7 }, collectionManageText: { color: '#bc96ff', fontSize: 8, fontWeight: '900' }, managingPill: { color: '#66efc2', fontSize: 8, fontWeight: '900', letterSpacing: 1, borderWidth: 1, borderColor: '#295f4e', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 6 }, journeyManageHelp: { marginHorizontal: 20, color: '#948a9e', fontSize: 11, lineHeight: 17 }, memoryJourneyList: { marginHorizontal: 20, gap: 8 }, journeyMembershipButton: { minHeight: 40, borderRadius: 12, borderWidth: 1, borderColor: '#5d4380', backgroundColor: '#1b1327', alignItems: 'center', justifyContent: 'center' }, journeyMembershipRemove: { borderColor: '#704037', backgroundColor: '#29130f' }, journeyMembershipText: { color: '#c3a5ff', fontSize: 10, fontWeight: '900' }, journeyMembershipRemoveText: { color: '#ff9c80' },
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
  journeyCardCompact: { backgroundColor: '#121019', borderRadius: 16, borderWidth: 1, borderColor: '#292334', paddingHorizontal: 12, paddingVertical: 10, gap: 7 }, journeyCompactTop: { flexDirection: 'row', alignItems: 'center', gap: 8 }, journeyDateCompact: { color: '#8f819e', fontSize: 8, fontWeight: '900', letterSpacing: 0.8 }, journeyRouteCompact: { color: '#f3eef8', fontSize: 13, lineHeight: 17, fontWeight: '800', marginTop: 3 }, journeyChevronCompact: { color: '#6f667a', fontSize: 22, lineHeight: 24 }, journeyStatsCompact: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 }, journeyStatCompact: { color: '#928a9c', fontSize: 9, fontWeight: '700' }, journeySoundtrackCompact: { minHeight: 31, flexDirection: 'row', alignItems: 'center', gap: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#2b2633', paddingTop: 7 }, journeySongCompact: { flex: 1, color: '#bdb5c5', fontSize: 10, fontWeight: '700' }, songCountCompact: { minWidth: 18, color: '#9b7cff', fontSize: 10, fontWeight: '900', textAlign: 'right' }, miniArtworkCompact: { width: 30, height: 30, borderRadius: 7, backgroundColor: '#281b36', alignItems: 'center', justifyContent: 'center' }, miniArtworkTextCompact: { color: '#aa89ff', fontSize: 13, fontWeight: '900' },
  emptyCard: { alignItems: 'center', backgroundColor: '#111018', borderRadius: 21, borderWidth: 1, borderColor: '#272331', padding: 24 }, emptyCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#231a30', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }, emptyCircleText: { color: '#9b7cff', fontWeight: '900', fontSize: 17 }, emptyTitle: { color: '#eee9f5', fontSize: 16, fontWeight: '800' }, emptyBody: { color: '#8b8395', fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 6, maxWidth: 300 },
  loadMoreButton: { minHeight: 50, alignItems: 'center', justifyContent: 'center', borderRadius: 15, borderWidth: 1, borderColor: '#3a3048', backgroundColor: '#15111d' }, loadMoreText: { color: '#b59cff', fontSize: 13, fontWeight: '900' },
  inlineNotice: { flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: '#21180f', borderWidth: 1, borderColor: '#714c25', borderRadius: 15, padding: 12 }, noticeDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#ffb15c' }, inlineNoticeText: { color: '#c1af9a', fontSize: 11, lineHeight: 16, flex: 1 }, retryText: { color: '#ffb15c', fontSize: 11, fontWeight: '900' }, loadingLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, minHeight: 28 }, loadingLineText: { color: '#8f8799', fontSize: 12 }, loadingCard: { minHeight: 180, alignItems: 'center', justifyContent: 'center', gap: 13, backgroundColor: '#111018', borderRadius: 20 },
  detailDate: { color: '#a88aff', fontSize: 10, fontWeight: '900', letterSpacing: 1.3 }, detailTitle: { color: '#f8f4ff', fontSize: 25, lineHeight: 31, fontWeight: '900', letterSpacing: -0.5 }, backButton: { alignSelf: 'flex-start', paddingVertical: 6 }, backButtonText: { color: '#aa8cff', fontSize: 14, fontWeight: '800' }, routeSketch: { height: 190, borderRadius: 22, overflow: 'hidden', backgroundColor: '#10121a', borderWidth: 1, borderColor: '#252c3b' }, routeGlow: { position: 'absolute', width: 180, height: 180, borderRadius: 90, backgroundColor: '#171d32', right: -35, top: -30 }, routeLine: { position: 'absolute', height: 4, borderRadius: 2, backgroundColor: '#9b7cff' }, routeStart: { position: 'absolute', width: 12, height: 12, borderRadius: 6, backgroundColor: '#43e6ae' }, routeEnd: { position: 'absolute', width: 14, height: 14, borderRadius: 7, backgroundColor: '#ff7b54' }, routeCaption: { position: 'absolute', color: '#70798d', fontSize: 10, bottom: 12, left: 16 }, detailMetrics: { flexDirection: 'row', paddingVertical: 17, borderRadius: 18, backgroundColor: '#121019' },
  trackRow: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 8 }, trackIndex: { width: 21, color: '#696272', fontSize: 10, fontWeight: '700', fontVariant: ['tabular-nums'] }, trackTitle: { color: '#eee9f3', fontSize: 13, fontWeight: '800' }, trackArtist: { color: '#837b8c', fontSize: 11, marginTop: 4 }, infoCard: { backgroundColor: '#121019', borderRadius: 18, paddingHorizontal: 16 }, infoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 15, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#302a38' }, infoLabel: { color: '#776f81', fontSize: 9, fontWeight: '900', letterSpacing: 1 }, infoValue: { color: '#ece6f1', fontSize: 13, fontWeight: '700' },
  selectedProvider: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#131019', borderWidth: 1, borderRadius: 21, padding: 15 }, connectionTile: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#121019', borderWidth: 1, borderColor: '#292333', borderRadius: 18, padding: 14 }, connectionIcon: { width: 44, height: 44, borderRadius: 13, alignItems: 'center', justifyContent: 'center' }, connectionIconText: { color: '#fff', fontSize: 16, fontWeight: '900' }, connectionKicker: { color: '#7e7489', fontSize: 8, fontWeight: '900', letterSpacing: 1.2 }, connectionName: { color: '#f1ecf6', fontSize: 15, fontWeight: '800', marginTop: 2 }, connectionDetail: { color: '#888091', fontSize: 11, lineHeight: 16, marginTop: 3 }, connectionStatus: { color: '#938999', fontSize: 10, fontWeight: '800', marginTop: 5 }, goodStatus: { color: '#43e6ae' }, connectionAction: { backgroundColor: '#211a2c', borderRadius: 10, paddingHorizontal: 9, paddingVertical: 8 }, connectionActionText: { color: '#b59cff', fontSize: 9, fontWeight: '900' }, changeButton: { paddingHorizontal: 11, paddingVertical: 8, borderRadius: 10, backgroundColor: '#211a2c' }, changeButtonText: { color: '#b59cff', fontSize: 11, fontWeight: '900' }, securityCard: { backgroundColor: '#17121b', borderLeftWidth: 3, borderLeftColor: '#9b7cff', borderRadius: 14, padding: 15, marginTop: 5 }, securityTitle: { color: '#c2b3ff', fontSize: 9, fontWeight: '900', letterSpacing: 1.2 }, securityBody: { color: '#918897', fontSize: 12, lineHeight: 18, marginTop: 5 },
  setupCard: { gap: 11, backgroundColor: '#171019', borderWidth: 1, borderColor: '#4e2831', borderRadius: 18, padding: 15 }, setupTitle: { color: '#ff7b82', fontSize: 9, fontWeight: '900', letterSpacing: 1.2 }, setupBody: { color: '#9b929f', fontSize: 12, lineHeight: 18 }, setupInput: { minHeight: 48, borderRadius: 13, borderWidth: 1, borderColor: '#3c3443', backgroundColor: '#0e0c12', color: '#f4eef8', paddingHorizontal: 14, fontSize: 15 }, setupWarning: { color: '#ffb15c', fontSize: 11, lineHeight: 16 }, setupSync: { minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderWidth: 1, borderColor: '#63313a', backgroundColor: '#281318' }, setupSyncText: { color: '#ff8c93', fontSize: 12, fontWeight: '900' }, setupActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 }, setupSecondary: { minHeight: 40, minWidth: 88, alignItems: 'center', justifyContent: 'center', borderRadius: 11, backgroundColor: '#241f29' }, setupSecondaryText: { color: '#a79daa', fontSize: 12, fontWeight: '800' }, setupPrimary: { minHeight: 40, minWidth: 88, alignItems: 'center', justifyContent: 'center', borderRadius: 11, backgroundColor: '#f23d47' }, setupPrimaryText: { color: '#fff', fontSize: 12, fontWeight: '900' },
  navSafe: { position: 'absolute', right: 0, bottom: 0, left: 0, zIndex: 40, backgroundColor: 'transparent', paddingHorizontal: 12, paddingTop: 6 },
  navDockFrame: { marginBottom: 10, borderRadius: 25, borderWidth: 1, borderColor: 'rgba(206,82,255,0.42)', shadowColor: '#000', shadowOpacity: 0.52, shadowRadius: 21, shadowOffset: { width: 0, height: 11 } },
  navDockAura: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, borderRadius: 25, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(206,82,255,0.28)', shadowColor: '#b837ff', shadowOpacity: 0.17, shadowRadius: 18, shadowOffset: { width: 0, height: 0 } },
  bottomNav: { minHeight: 76, borderRadius: 24, overflow: 'hidden' },
  navMaterial: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, borderRadius: 24 },
  bottomNavFallback: { backgroundColor: 'rgba(22,10,31,0.94)' },
  navSurfaceTint: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(16,7,25,0.78)' },
  navSurfaceWarmWash: { position: 'absolute', top: 0, right: 0, bottom: 0, width: '42%', backgroundColor: 'rgba(96,27,42,0.08)' },
  navTrack: { flex: 1, minHeight: 76, flexDirection: 'row', gap: 4, padding: 6 },
  navGlassSheen: { position: 'absolute', zIndex: 3, top: 1, right: 16, left: 16, height: StyleSheet.hairlineWidth, borderRadius: 1, backgroundColor: 'rgba(255,255,255,0.16)' },
  navGlidingIndicator: { position: 'absolute', zIndex: 0, top: 6, bottom: 6, left: 0, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,113,56,0.78)', shadowColor: '#ff5b2d', shadowOpacity: 0.72, shadowRadius: 11, shadowOffset: { width: 0, height: 0 } },
  navGlidingFill: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, overflow: 'hidden', borderRadius: 17, backgroundColor: 'rgba(255,112,55,0.17)' },
  navGlidingVioletWash: { position: 'absolute', top: 0, right: 0, bottom: 0, width: '54%', backgroundColor: 'rgba(122,38,137,0.16)' },
  navItem: { position: 'relative', zIndex: 1, flex: 1, minHeight: 64, alignItems: 'center', justifyContent: 'center', gap: 3, paddingVertical: 6, borderRadius: 18 },
  navItemPressed: { transform: [{ scale: 0.98 }], backgroundColor: 'rgba(255,255,255,0.04)' },
  navSymbolFrame: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  navSymbolFrameActive: { shadowColor: '#ff6730', shadowOpacity: 0.92, shadowRadius: 6, shadowOffset: { width: 0, height: 0 } },
  navSymbol: { width: 25, height: 25 },
  navSymbolFallback: { color: '#a78db8', fontSize: 21, lineHeight: 24, fontWeight: '800' },
  navLabel: { color: '#a78db8', fontSize: 10, fontWeight: '800', letterSpacing: 0.05 },
  navActive: { color: '#ff8b4f', textShadowColor: 'rgba(255,95,47,0.95)', textShadowRadius: 7 },
  navActiveLine: { position: 'absolute', right: '24%', bottom: 3, left: '24%', height: 3, borderRadius: 2, backgroundColor: '#ff7138', shadowColor: '#ff5f2f', shadowOpacity: 1, shadowRadius: 7, shadowOffset: { width: 0, height: 0 } },
  onboardingSafe: { flex: 1, backgroundColor: '#08070d' }, onboardingContent: { paddingHorizontal: 22, paddingTop: 24, paddingBottom: 36 }, onboardingEyebrow: { color: '#ff8a68', fontSize: 10, fontWeight: '900', letterSpacing: 1.5, marginTop: 4 }, onboardingTitle: { color: '#f9f5ff', fontSize: 31, lineHeight: 36, fontWeight: '900', letterSpacing: -0.9, marginTop: 7 }, onboardingBody: { color: '#9b92a5', fontSize: 14, lineHeight: 21, marginTop: 9 }, recordingModeTabs: { flexDirection: 'row', gap: 10, marginTop: 18, marginBottom: 14 }, recordingModeTab: { flex: 1, minHeight: 64, borderRadius: 15, borderWidth: 1, borderColor: '#2c2735', backgroundColor: '#111018', alignItems: 'center', justifyContent: 'center' }, recordingModeTabTitle: { color: '#eee9f5', fontSize: 14, fontWeight: '900' }, recordingModeTabDetail: { color: '#777080', fontSize: 10, fontWeight: '700', marginTop: 4 }, providerTabs: { flexDirection: 'row', gap: 9, marginTop: 18, marginBottom: 14 }, providerTab: { flex: 1, minHeight: 42, borderRadius: 13, borderWidth: 1, borderColor: '#2c2735', backgroundColor: '#111018', alignItems: 'center', justifyContent: 'center' }, providerTabText: { color: '#777080', fontSize: 14, fontWeight: '900' }, providerCarousel: { gap: 12 }, providerCard: { backgroundColor: '#121019', borderWidth: 1, borderRadius: 24, padding: 18, gap: 15 }, providerCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 }, providerIcon: { width: 50, height: 50, borderRadius: 15, alignItems: 'center', justifyContent: 'center' }, providerIconText: { color: '#fff', fontSize: 19, fontWeight: '900' }, providerKicker: { fontSize: 8, fontWeight: '900', letterSpacing: 1.1 }, providerName: { color: '#fff', fontSize: 21, fontWeight: '900', marginTop: 3 }, providerSummary: { color: '#aaa2b4', fontSize: 13, lineHeight: 20 }, prosCons: { gap: 8 }, prosConsTitle: { fontSize: 8, fontWeight: '900', letterSpacing: 1.1 }, proRow: { flexDirection: 'row', alignItems: 'center', gap: 9 }, proBullet: { width: 20, height: 20, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' }, proBulletText: { fontSize: 12, fontWeight: '900', lineHeight: 15 }, proText: { color: '#d2cbd9', fontSize: 12, flex: 1 }, privacyNote: { borderRadius: 14, padding: 12 }, privacyTitle: { fontSize: 8, fontWeight: '900', letterSpacing: 1 }, privacyCopy: { color: '#9d94a5', fontSize: 11, lineHeight: 16, marginTop: 4 }, pageDots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginVertical: 14 }, pageDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#39313f' }, cancelButton: { alignItems: 'center', padding: 14 }, cancelButtonText: { color: '#9d91ae', fontSize: 12, fontWeight: '800' }, providerFootnote: { color: '#6e6875', fontSize: 10, lineHeight: 15, textAlign: 'center', marginTop: 12, paddingHorizontal: 12 },
});
