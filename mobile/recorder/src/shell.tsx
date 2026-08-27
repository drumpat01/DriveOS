import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  AccessibilityInfo, ActivityIndicator, Alert, Animated, AppState, Image, ImageBackground, Linking, Modal, PanResponder, Pressable, SafeAreaView, ScrollView, StatusBar,
  StyleSheet, Text, TextInput, View, useWindowDimensions,
} from 'react-native';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import * as Updates from 'expo-updates';
import * as ImagePicker from 'expo-image-picker';
import * as AppleAuthentication from 'expo-apple-authentication';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from 'expo-glass-effect';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import { BlurView } from 'expo-blur';
import { Image as ExpoImage } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import PagerView from 'react-native-pager-view';
import Svg, { Circle, Defs, LinearGradient as SvgLinearGradient, Path, Polyline, RadialGradient as SvgRadialGradient, Rect, Stop } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Reanimated, { Easing, FadeIn, FadeInDown, FadeInUp, FadeOut, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';

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
import { getAppleIdentityStatus, getCurrentUser, signInWithApple, type AppleIdentityStatus } from './auth';
import { getSensitivePlaces, upsertPlace, type LocalUser } from './local-store';
import { InteractiveRouteMap } from './interactive-route-map';
import { buildSongRouteMoments } from './route-moments';
import { isPrivateICloudNativeAvailable, syncCurrentUserWithPrivateICloud } from './icloud-sync';
import { VehicleIntelligenceScreen } from './vehicle-intelligence-screen';
import { favoriteRoutes, filterJourneyLibrary, type JourneyLibraryFilter, type JourneyLibrarySort } from './library-model';
import { PrimaryMobilityMap } from './primary-mobility-map';
import { buildHomeSummary } from './home-summary';
import { loadPrimarySectionsData } from './primary-sections-data';
import { subscribeLocalArchiveChanges } from './local-archive-events';
import {
  AtlasScreen, LiveScreen, MoreScreen, type MoreDestination, type PrimaryDataState,
} from './primary-sections';

type Tab = 'home' | 'live' | 'journeys' | 'atlas' | 'more';
type LoadState<T> = { status: 'loading' | 'ready' | 'error'; data: T; message?: string };
type PrivateCloudUiState = { status: 'unavailable' | 'idle' | 'syncing' | 'synced' | 'needs_icloud' | 'error'; detail: string };

const bottomNavigationItems: { id: Tab; label: string; symbol: SFSymbol; fallback: string }[] = [
  { id: 'home', label: 'Home', symbol: 'house', fallback: '⌂' },
  { id: 'live', label: 'Live', symbol: 'antenna.radiowaves.left.and.right', fallback: '◉' },
  { id: 'journeys', label: 'Memories', symbol: 'map', fallback: '≋' },
  { id: 'atlas', label: 'Atlas', symbol: 'globe.americas', fallback: '◎' },
  { id: 'more', label: 'More', symbol: 'square.grid.2x2', fallback: '▦' },
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
  brand: ProviderBrand;
  color: string;
  tint: string;
  summary: string;
  benefits: string[];
  drawbacks: string[];
  privacy: string;
};

type ProviderBrand = 'apple-music' | 'shazam' | 'spotify';

const providerBrandImages = {
  'apple-music': require('../assets/apple-music-icon.png'),
  shazam: require('../assets/shazam-icon.png'),
  spotify: require('../assets/spotify-icon-white.png'),
} as const;

const tessieBrandImages = {
  white: require('../assets/tessie-logo-white.png'),
  black: require('../assets/tessie-logo-black.png'),
} as const;

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
    id: 'apple-music', name: 'Apple Music', kicker: 'NATIVE & PRIVATE', symbol: '♪', brand: 'apple-music', color: '#fa5c74', tint: '#2a121b',
    summary: 'Use your Apple Music listening history to build a soundtrack after each journey.',
    benefits: ['No microphone needed', 'Fast, familiar iPhone permission', 'Artwork and catalog details included'],
    drawbacks: ['Apple Music subscribers only', 'Some play timestamps may be approximate'],
    privacy: 'JourneyDeck reads only the music details needed for your journey soundtrack.',
  },
  {
    id: 'shazam', name: 'Auto Recognition', kicker: 'POWERED BY SHAZAMKIT', symbol: 'S', brand: 'shazam', color: '#56a8ff', tint: '#101d31',
    summary: 'Briefly recognize music playing in the car—from Spotify, radio, CDs, or another phone.',
    benefits: ['Works with almost any music source', 'No music account required', 'Audio is never saved by JourneyDeck'],
    drawbacks: ['Uses the microphone and its iOS indicator', 'Road noise or low volume can cause misses'],
    privacy: 'Only recognition results and timestamps are kept. JourneyDeck never stores recordings.',
  },
  {
    id: 'lastfm', name: 'Spotify history', kicker: 'IMPORTED VIA LAST.FM', symbol: '↻', brand: 'spotify', color: '#1ed760', tint: '#0d2116',
    summary: 'Import timestamped Spotify listening history through your Last.fm account.',
    benefits: ['Automatic Spotify history', 'No microphone needed', 'Works across Spotify devices'],
    drawbacks: ['Requires a Last.fm account with Spotify scrobbling', 'Sync can be delayed or miss tracks'],
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
  const tabRef = useRef<Tab>('home');
  const requestedTabRef = useRef<Tab>('home');
  const pagerRef = useRef<PagerView>(null);
  const [preferences, setPreferences] = useState<MusicPreferences | null>(null);
  const [recordingPreferences, setRecordingPreferences] = useState<RecordingModePreferences | null>(null);
  const [editingRecordingMode, setEditingRecordingMode] = useState(false);
  const [editingProvider, setEditingProvider] = useState(false);
  const [selectedJourneyId, setSelectedJourneyId] = useState<string | null>(null);
  const [musicCapabilities, setMusicCapabilities] = useState<JourneyDeckMusicCapabilityStatus | null>(null);
  const [connectionCapabilities, setConnectionCapabilities] = useState<ConnectionCapabilities>({ lastFmConfigured: false, tessieConfigured: false });
  const [lastFmUsername, setLastFmUsername] = useState('');
  const [editingLastFm, setEditingLastFm] = useState(false);
  const [lastFmDraft, setLastFmDraft] = useState('');
  const [savingLastFm, setSavingLastFm] = useState(false);
  const [syncingLastFm, setSyncingLastFm] = useState(false);
  const [currentUser, setCurrentUser] = useState(() => getCurrentUser());
  const [appleIdentityStatus, setAppleIdentityStatus] = useState<AppleIdentityStatus>('unknown');
  const [signingInWithApple, setSigningInWithApple] = useState(false);
  const [privateCloud, setPrivateCloud] = useState<PrivateCloudUiState>(() => isPrivateICloudNativeAvailable()
    ? { status: 'idle', detail: 'Ready to sync privately through iCloud.' }
    : { status: 'unavailable', detail: 'Available after installing JourneyDeck 1.7.' });
  const [dashboard, setDashboard] = useState<LoadState<AppDashboard>>({ status: 'loading', data: blankDashboard() });
  const [journeys, setJourneys] = useState<LoadState<JourneySummary[]>>({ status: 'loading', data: [] });
  const [journeyCursor, setJourneyCursor] = useState<string | null>(null);
  const [journeysLoadingMore, setJourneysLoadingMore] = useState(false);
  const [memories, setMemories] = useState<LoadState<MemoriesCatalog>>({ status: 'loading', data: { memories: [], collections: [] } });
  const [musicDashboard, setMusicDashboard] = useState<MusicDashboardState>({ status: 'loading', data: null });
  const [journeyDetail, setJourneyDetail] = useState<LoadState<JourneyDetail | null>>({ status: 'ready', data: null });
  const [primarySections, setPrimarySections] = useState<PrimaryDataState>({ status: 'loading', data: null });
  const [moreDestination, setMoreDestination] = useState<MoreDestination>('menu');
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

  const refreshDashboard = useCallback(async (refreshRemote = false) => {
    setDashboard(current => ({ ...current, status: 'loading', message: undefined }));
    try {
      const data = await appDataClient.dashboard(refreshRemote);
      setDashboard({ status: 'ready', data });
    } catch {
      const local = await appDataClient.localDashboard();
      setDashboard({ status: 'error', data: local, message: 'Showing what is safe on this iPhone. Journey history will return when JourneyDeck is reachable.' });
    }
  }, []);

  const refreshJourneys = useCallback(async (refreshRemote = false) => {
    setJourneys(current => ({ ...current, status: 'loading', message: undefined }));
    try {
      const result = await appDataClient.journeys(25, undefined, refreshRemote);
      setJourneys({ status: 'ready', data: result.items });
      setJourneyCursor(result.nextCursor);
    } catch {
      setJourneys(current => ({ status: 'error', data: current.data, message: 'Journey history is unavailable right now. Your recordings are still safe.' }));
    }
  }, []);

  const refreshMemories = useCallback(async (refreshRemote = false) => {
    setMemories(current => ({ ...current, status: 'loading', message: undefined }));
    try { setMemories({ status: 'ready', data: await appDataClient.memories(refreshRemote) }); }
    catch { setMemories(current => ({ status: 'error', data: current.data, message: 'Memories could not refresh. Your saved journeys are still safe.' })); }
  }, []);

  const refreshMusicDashboard = useCallback(async (refreshRemote = false, details: JourneyDetail[] = []) => {
    setMusicDashboard(current => ({ ...current, status: 'loading', message: undefined }));
    try { setMusicDashboard({ status: 'ready', data: await appDataClient.musicDashboard(refreshRemote, details) }); }
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
    const [, , detail] = await Promise.all([
      refreshJourneys(true),
      refreshDashboard(true),
      selectedJourneyId ? appDataClient.journey(selectedJourneyId, true).catch(() => null) : Promise.resolve(null),
    ]);
    if (detail) setJourneyDetail({ status: 'ready', data: detail });
  }, [refreshDashboard, refreshJourneys, selectedJourneyId]);

  const refreshAppleIdentity = useCallback(async () => {
    setAppleIdentityStatus(await getAppleIdentityStatus(getCurrentUser()));
  }, []);

  const refreshPrimarySections = useCallback(async (forceRefresh = false) => {
    setPrimarySections(current => ({ ...current, status: 'loading', message: undefined }));
    try {
      const data = await loadPrimarySectionsData(forceRefresh);
      setPrimarySections({ status: 'ready', data });
      setDashboard({ status: 'ready', data: data.dashboard });
      setJourneys({ status: 'ready', data: data.journeys });
      setJourneyCursor(null);
      setMemories({ status: 'ready', data: data.memories });
      setMusicDashboard({ status: 'ready', data: data.music });
    } catch (error) {
      setPrimarySections(current => ({ status: 'error', data: current.data, message: error instanceof Error ? error.message : 'Some JourneyDeck data could not refresh.' }));
    }
  }, []);

  const syncPrivateCloud = useCallback(async (announce = false) => {
    if (!isPrivateICloudNativeAvailable()) {
      setPrivateCloud({ status: 'unavailable', detail: 'Available after installing JourneyDeck 1.7.' });
      return;
    }
    setPrivateCloud({ status: 'syncing', detail: 'Checking this profile’s private iCloud zone…' });
    try {
      const result = await syncCurrentUserWithPrivateICloud({ force: announce });
      if (result.accountStatus !== 'available') {
        const detail = result.accountStatus === 'no_account' ? 'Sign into iCloud in iPhone Settings to enable private sync.' : 'Private iCloud is unavailable right now; local data remains safe.';
        setPrivateCloud({ status: 'needs_icloud', detail });
        if (announce) Alert.alert('Private iCloud is not available', detail);
        return;
      }
      const detail = `${result.uploaded} uploaded · ${result.downloaded} downloaded${result.failedUploads ? ` · ${result.failedUploads} will retry` : ''}`;
      setPrivateCloud({ status: result.failedUploads ? 'error' : 'synced', detail });
      if (announce) Alert.alert('Private iCloud sync finished', detail);
      await Promise.all([refreshDashboard(), refreshJourneys(), refreshMemories(), refreshMusicDashboard()]);
    } catch {
      const detail = 'Sync will retry later. Everything remains saved on this iPhone.';
      setPrivateCloud({ status: 'error', detail });
      if (announce) Alert.alert('Private iCloud will retry', detail);
    }
  }, [refreshDashboard, refreshJourneys, refreshMemories, refreshMusicDashboard]);

  const connectAppleIdentity = useCallback(async () => {
    setSigningInWithApple(true);
    try {
      const user = await signInWithApple();
      setCurrentUser(user);
      setAppleIdentityStatus('authorized');
      await syncPrivateCloud(false);
    } catch (error) {
      if ((error as { code?: string }).code !== 'ERR_REQUEST_CANCELED') {
        Alert.alert('Apple sign-in did not finish', error instanceof Error ? error.message : 'Try again from Settings. Your local data was not changed.');
      }
    } finally {
      setSigningInWithApple(false);
    }
  }, [syncPrivateCloud]);

  useEffect(() => { if (tab === 'home' || tab === 'more') void refreshDashboard(); }, [refreshDashboard, tab]);
  useEffect(() => { void refreshPrimarySections(false); }, [refreshPrimarySections]);
  useEffect(() => subscribeLocalArchiveChanges(() => { void refreshPrimarySections(false); }), [refreshPrimarySections]);
  useEffect(() => { void refreshAppleIdentity(); void syncPrivateCloud(false); }, [refreshAppleIdentity, syncPrivateCloud]);
  useEffect(() => { if (tab === 'journeys') { void refreshJourneys(); void refreshMemories(); } }, [refreshJourneys, refreshMemories, tab]);
  useEffect(() => { if (tab === 'more' && moreDestination === 'music') void refreshMusicDashboard(); }, [moreDestination, refreshMusicDashboard, tab]);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') {
        void refreshAppleIdentity();
        void syncPrivateCloud(false);
        void refreshDashboard();
        if (tab === 'journeys') void refreshJourneys();
        if (tab === 'more' && moreDestination === 'music') void refreshMusicDashboard();
      }
    });
    return () => subscription.remove();
  }, [moreDestination, refreshAppleIdentity, refreshDashboard, refreshJourneys, refreshMusicDashboard, syncPrivateCloud, tab]);

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
    }).then(() => refreshDashboard(true)).catch(() => {
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
  }, [selectedJourneyId]);

  const refreshMusicCapabilities = useCallback(async () => {
    try { setMusicCapabilities(await getMusicCapabilityStatus()); }
    catch { setMusicCapabilities(null); }
  }, []);

  const refreshConnectionCapabilities = useCallback(async () => {
    try { setConnectionCapabilities(await appDataClient.connectionCapabilities()); }
    catch { setConnectionCapabilities({ lastFmConfigured: false, tessieConfigured: false }); }
  }, []);

  useEffect(() => {
    if (tab !== 'more') return;
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
    void refreshDashboard(true);
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
    await refreshDashboard(true);
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
    if (next === tabRef.current) return;
    setSelectedJourneyId(null);
    requestedTabRef.current = next;
    tabRef.current = next;
    setTab(next);
    pagerRef.current?.setPage(bottomNavigationItems.findIndex(item => item.id === next));
    void Haptics.selectionAsync().catch(() => undefined);
  };

  const openMore = (destination: MoreDestination) => {
    setMoreDestination(destination);
    openTab('more');
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
        {appReady && <PagerView
          ref={pagerRef}
          style={styles.pager}
          initialPage={0}
          scrollEnabled={false}
          overdrag
          offscreenPageLimit={1}
          onPageSelected={event => {
            const selected = bottomNavigationItems[event.nativeEvent.position]?.id;
            if (!selected || selected !== requestedTabRef.current) return;
            tabRef.current = selected;
            setTab(selected);
          }}
        >
          <View key="home" collapsable={false} style={styles.tabLayer}>
            <HomeScreen state={dashboard} primary={primarySections} recordingMode={activeRecordingPreferences!.mode!} onRecord={() => openMore('record')} onJourneys={() => openTab('journeys')} onLive={() => openTab('live')} onAtlas={() => openTab('atlas')} onMore={openMore} onConnections={() => openMore('settings')} onJourney={id => { openTab('journeys'); setSelectedJourneyId(id); }} onRefresh={() => void refreshPrimarySections(true)} />
          </View>
          <View key="live" collapsable={false} style={styles.tabLayer}>
            <LiveScreen state={primarySections} active={tab === 'live'} onRefresh={() => void refreshPrimarySections(true)} onRecord={() => openMore('record')} onJourney={setSelectedJourneyId} />
          </View>
          <View key="journeys" collapsable={false} style={styles.tabLayer}>
            <MemoriesScreen catalog={memories} journeys={primarySections.data?.journeys?.length ? { status: 'ready', data: primarySections.data.journeys } : journeys} details={primarySections.data?.details ?? []} onJourney={setSelectedJourneyId} onRefresh={() => void refreshPrimarySections(true)} />
          </View>
          <View key="atlas" collapsable={false} style={styles.tabLayer}>
            <AtlasScreen state={primarySections} onRefresh={() => void refreshPrimarySections(true)} onJourney={setSelectedJourneyId} />
          </View>
          <View key="more" collapsable={false} style={styles.tabLayer}>
            <MoreScreen
              active={tab === 'more'} requested={moreDestination} onRequestedChange={setMoreDestination} state={primarySections} dashboard={dashboard.data}
              privateCloud={privateCloud} appleIdentityStatus={appleIdentityStatus} onRefresh={() => void refreshPrimarySections(true)} onCloudSync={() => void syncPrivateCloud(true)} onJourney={setSelectedJourneyId}
              music={<MusicScreen state={musicDashboard} provider={activePreferences!.provider!} journeys={primarySections.data?.journeys ?? journeys.data} details={primarySections.data?.details ?? []} onJourney={setSelectedJourneyId} onRefresh={() => refreshMusicDashboard(true, primarySections.data?.details ?? [])} />}
              recorder={recorder}
              settings={<ConnectionsScreen dashboard={dashboard.data} provider={activePreferences!.provider!} recordingMode={activeRecordingPreferences!.mode!} capabilities={musicCapabilities} connectionCapabilities={connectionCapabilities} currentUser={currentUser} appleIdentityStatus={appleIdentityStatus} signingInWithApple={signingInWithApple} privateCloud={privateCloud} lastFmUsername={lastFmUsername} editingLastFm={editingLastFm} lastFmDraft={lastFmDraft} savingLastFm={savingLastFm} syncingLastFm={syncingLastFm} onAppleSignIn={() => void connectAppleIdentity()} onPrivateCloudSync={() => void syncPrivateCloud(true)} onLastFmDraft={setLastFmDraft} onEditLastFm={() => setEditingLastFm(true)} onCancelLastFm={() => { setLastFmDraft(lastFmUsername); setEditingLastFm(false); }} onSaveLastFm={() => void saveLastFm()} onSyncLastFm={() => void syncLastFmNow()} onChangeRecordingMode={() => setEditingRecordingMode(true)} onChangeProvider={() => setEditingProvider(true)} onConnectAppleMusic={() => void connectAppleMusic()} onEnableRecognition={() => void enableRecognition()} />}
            />
          </View>
        </PagerView>}
      </View>
      {appReady && <SafeAreaView style={styles.navSafe}><BottomNavigation active={tab} onSelect={openTab} /></SafeAreaView>}
      <JourneyDetailModal visible={Boolean(selectedJourneyId)} state={journeyDetail} onClose={() => setSelectedJourneyId(null)} onRetry={() => {
        if (!selectedJourneyId) return;
        setJourneyDetail({ status: 'loading', data: null });
        void appDataClient.journey(selectedJourneyId, true).then(
          data => setJourneyDetail({ status: 'ready', data }),
          () => setJourneyDetail({ status: 'error', data: null, message: 'This journey could not be loaded. Try again when JourneyDeck is connected.' }),
        );
      }} onLocationsSaved={refreshJourneyLocations} />
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
              <ProviderMark brand={option.brand} size={28} />
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
        <ProviderMark brand={option.brand} size={50} />
        <View style={styles.flex}><Text style={[styles.providerKicker, { color: option.color }]}>{option.kicker}</Text><Text style={styles.providerName}>{option.name}</Text></View>
      </View>
      <Text style={styles.providerSummary}>{option.summary}</Text>
      <ProsCons title="WHY YOU MAY LOVE IT" color="#4ce1b1" items={option.benefits} symbol="+" />
      <ProsCons title="WHAT TO KNOW" color="#ffb15c" items={option.drawbacks} symbol="–" />
      <View style={[styles.privacyNote, { backgroundColor: option.tint }]}><Text style={[styles.privacyTitle, { color: option.color }]}>PRIVACY</Text><Text style={styles.privacyCopy}>{option.privacy}</Text></View>
    </View>
  );
}

function ProviderMark({ brand, size }: { brand: ProviderBrand; size: number }) {
  if (brand === 'spotify') {
    return <View style={[styles.spotifyMarkFrame, { width: size, height: size, borderRadius: size / 2 }]}><Image source={providerBrandImages.spotify} resizeMode="contain" style={{ width: size / 2, height: size / 2 }} /></View>;
  }
  return <Image source={providerBrandImages[brand]} resizeMode="contain" style={{ width: size, height: size }} />;
}

function ProsCons({ title, color, items, symbol }: { title: string; color: string; items: string[]; symbol: string }) {
  return <View style={styles.prosCons}><Text style={[styles.prosConsTitle, { color }]}>{title}</Text>{items.map(item => <View style={styles.proRow} key={item}><View style={[styles.proBullet, { borderColor: color }]}><Text style={[styles.proBulletText, { color }]}>{symbol}</Text></View><Text style={styles.proText}>{item}</Text></View>)}</View>;
}

function HomeScreen({ state, primary, recordingMode, onRecord, onJourneys, onLive, onAtlas, onMore, onConnections, onJourney, onRefresh }: { state: LoadState<AppDashboard>; primary: PrimaryDataState; recordingMode: RecordingMode; onRecord: () => void; onJourneys: () => void; onLive: () => void; onAtlas: () => void; onMore: (destination: MoreDestination) => void; onConnections: () => void; onJourney: (id: string) => void; onRefresh: () => void }) {
  const insets = useSafeAreaInsets();
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
  const home = useMemo(() => primary.data ? buildHomeSummary(primary.data) : null, [primary.data]);
  return (
    <View style={styles.safe}>
      <ScrollView
        contentContainerStyle={[styles.webDashboardPage, { paddingTop: insets.top + 14, paddingBottom: insets.bottom + 132 }]}
        contentInsetAdjustmentBehavior="never"
        automaticallyAdjustContentInsets={false}
        automaticallyAdjustsScrollIndicatorInsets={false}
        showsVerticalScrollIndicator={false}
      >
        <AtmosphericBackdrop variant="home" />
        {state.status === 'error' && <InlineNotice message={state.message!} onRetry={onRefresh} />}
        <View style={styles.webDashboardShell}>
          <ImageBackground source={require('../assets/dashboard-neon-road-v2.png')} style={styles.webHero} imageStyle={styles.webHeroImage}>
            <View style={styles.webHeroShade} />
            <View style={styles.webHeroTop}>
              <View><Text style={styles.webHeroKicker}>YOUR ROAD</Text><Text style={styles.webHeroScript}>In motion</Text></View>
              <Pressable onPress={onLive} style={styles.webLivePill}><View style={[styles.webLiveDot, { backgroundColor: recorderColor(data.recorder.state, data.recorder.connected) }]} /><Text style={styles.webLiveText}>{data.recorder.state === 'recording' ? 'RECORDING' : automaticMode ? 'WATCHING' : 'READY'}</Text></Pressable>
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
            <WebAction symbol="arrow.clockwise" title="Sync" detail="Latest journey" color="#ff645d" onPress={onRefresh} />
            <WebAction symbol="play.fill" title="Replay" detail="Your journey" color="#a75cff" onPress={data.latestJourney ? () => onJourney(data.latestJourney!.id) : onJourneys} />
            <WebAction symbol="map" title="Journeys" detail="Your archive" color="#45bdf4" onPress={onJourneys} />
            <WebAction symbol="link" title="Connect" detail="Music & car" color="#ff9a5d" onPress={onConnections} />
          </View>

          {home && <>
            <View style={styles.homeSummaryHeading}><View><Text style={styles.webPanelTitle}>YOUR JOURNEYDECK</Text><Text style={styles.homeSummarySubtitle}>Everything the road has saved on this iPhone</Text></View><View style={styles.homeLocalPill}><View style={styles.homeLocalDot} /><Text style={styles.homeLocalText}>LOCAL</Text></View></View>
            <View style={styles.homeArchiveGrid}>
              <HomeArchiveTile value={home.archive.journeys} label="Journeys" color="#ff765a" onPress={onJourneys} />
              <HomeArchiveTile value={home.archive.memories} label="Memories" color="#a876ff" onPress={onJourneys} />
              <HomeArchiveTile value={home.archive.collections} label="Collections" color="#f0b65d" onPress={onJourneys} />
              <HomeArchiveTile value={home.archive.places} label="Places" color="#4bd6b1" onPress={onAtlas} />
            </View>

            <View style={styles.homeSpotlightGrid}>
              <Pressable onPress={onJourneys} style={[styles.homeSpotlight, styles.homeMemorySpotlight]}>
                <LinearGradient colors={['#35164a', '#140a20']} style={StyleSheet.absoluteFill} />
                <Text style={styles.homeSpotlightKicker}>MEMORY SPOTLIGHT</Text>
                <Text style={styles.homeSpotlightTitle} numberOfLines={2}>{home.memorySpotlight?.name ?? 'Create your first chapter'}</Text>
                <Text style={styles.homeSpotlightMeta}>{home.memorySpotlight ? `${home.memorySpotlight.collections} collections  •  ${home.memorySpotlight.journeys} journeys  •  ${home.memorySpotlight.photos} photos` : 'Bring two Collections together into a story.'}</Text>
                <Text style={styles.homeSpotlightAction}>Open Memories  ›</Text>
              </Pressable>
              <Pressable onPress={() => onMore('music')} style={[styles.homeSpotlight, styles.homeMusicSpotlight]}>
                <LinearGradient colors={['#471329', '#150918']} style={StyleSheet.absoluteFill} />
                <Text style={[styles.homeSpotlightKicker, { color: '#ff769e' }]}>ROAD SOUNDTRACK</Text>
                <Text style={styles.homeSpotlightTitle} numberOfLines={2}>{home.topTrack?.track ?? 'Your soundtrack is waiting'}</Text>
                <Text style={styles.homeSpotlightMeta} numberOfLines={2}>{home.topTrack ? `${home.topTrack.artist}  •  ${home.topTrack.plays} road play${home.topTrack.plays === 1 ? '' : 's'}` : 'Matched songs will be ranked locally.'}</Text>
                <Text style={[styles.homeSpotlightAction, { color: '#ff91b0' }]}>Open Music  ›</Text>
              </Pressable>
            </View>

            <Pressable onPress={onAtlas} style={styles.homePatternCard}>
              <View style={styles.homePatternIcon}><SymbolView name="point.bottomleft.forward.to.point.topright.scurvepath" tintColor="#ff8065" type="hierarchical" style={styles.homePatternSymbol} /></View>
              <View style={styles.flex}><Text style={styles.homeSpotlightKicker}>YOUR ROAD PATTERN</Text><Text style={styles.homePatternTitle} numberOfLines={1}>{home.favoriteRoute?.label ?? (home.topPlace ? `Back to ${home.topPlace.name}` : 'Atlas is learning your roads')}</Text><Text style={styles.homeSpotlightMeta}>{home.favoriteRoute ? `${home.favoriteRoute.count} drives  •  ${formatMiles(home.favoriteRoute.averageMiles)} average` : home.topPlace ? `${home.topPlace.visits} recorded visits` : 'Recurring routes and places stay on this iPhone.'}</Text></View>
              <Text style={styles.webRecorderChevron}>›</Text>
            </Pressable>

            <View style={styles.homeIntelligenceCard}>
              <View style={styles.homeIntelligenceHeader}><View><Text style={styles.homeSpotlightKicker}>ROAD INTELLIGENCE</Text><Text style={styles.homeIntelligenceTitle}>Your mobility at a glance</Text></View><Pressable onPress={() => onMore('statistics')}><Text style={styles.webPanelAction}>Full statistics  ›</Text></Pressable></View>
              <View style={styles.homeIntelligenceMetrics}>
                <HomeIntelligenceMetric value={home.roadScore === null ? '—' : String(home.roadScore)} label="ROAD SCORE" detail="Non-safety insight" />
                <HomeIntelligenceMetric value={String(home.charging.sessions)} label="CHARGES" detail="Last 30 days" />
                <HomeIntelligenceMetric value={formatNumber(home.charging.energyKwh)} label="KWH ADDED" detail={home.charging.cost ? `$${home.charging.cost.toFixed(2)} estimated` : 'On-device total'} />
              </View>
            </View>

            <View style={styles.homeExploreCard}>
              <View style={styles.homeSummaryHeading}><View><Text style={styles.webPanelTitle}>EXPLORE YOUR ROAD</Text><Text style={styles.homeSummarySubtitle}>Jump back into your local archive</Text></View></View>
              <View style={styles.homeExploreGrid}>
                <HomeExploreAction symbol="clock.arrow.circlepath" title="Timeline" detail={`${home.timelineEvents} recent events`} color="#6b9cff" onPress={() => onMore('timeline')} />
                <HomeExploreAction symbol="globe.americas" title="Atlas" detail="Places & patterns" color="#4bd6b1" onPress={onAtlas} />
                <HomeExploreAction symbol="chart.bar.xaxis" title="Statistics" detail="Trends & highlights" color="#ff8065" onPress={() => onMore('statistics')} />
                <HomeExploreAction symbol="magnifyingglass" title="Search" detail="Find anything" color="#d57aff" onPress={() => onMore('search')} />
              </View>
            </View>
          </>}

          <View style={styles.webBottomGrid}>
            <View style={styles.webJourneysPanel}>
              <View style={styles.webPanelHeader}><Text style={styles.webPanelTitle}>RECENT JOURNEYS</Text><Pressable onPress={onJourneys}><Text style={styles.webPanelAction}>View all  ›</Text></Pressable></View>
              {recentJourneys.length ? recentJourneys.map(journey => <CompactJourneyRow key={journey.id} journey={journey} onPress={() => onJourney(journey.id)} />) : <Text style={styles.webPanelEmpty}>Your completed journeys will appear here.</Text>}
            </View>
            <View style={styles.webHealthPanel}>
              <View style={styles.webPanelHeader}><Text style={[styles.webPanelTitle, { color: '#45c6f0' }]}>DATA HEALTH</Text></View>
              <CompactHealthRow symbol="J" label="JourneyDeck" detail={data.recorder.connected ? 'Connected' : 'Offline'} healthy={data.recorder.connected} />
              <CompactHealthRow symbol="♪" label="Music" detail={musicConnected ? 'Ready' : 'Check'} healthy={musicConnected} />
              <CompactHealthRow icon={<TessieMark size={25} />} symbol="T" label="Tessie" detail={connections.tessie === 'connected' ? 'Connected' : 'Check'} healthy={connections.tessie === 'connected'} />
            </View>
          </View>

          <View style={[styles.webWeekCard, styles.staticWidgetGlow]}>
            <View style={styles.webPanelHeader}><View><Text style={styles.webPanelTitle}>THIS WEEK</Text><Text style={styles.webWeekSubtitle}>Seven days on the road</Text></View><View style={styles.livePill}><View style={styles.liveDot} /><Text style={styles.liveText}>LIVE</Text></View></View>
            <View style={styles.webWeekChart}>{activity.map(day => <View key={day.key} style={styles.webWeekColumn}><View style={styles.webWeekTrack}><View style={[styles.webWeekBar, { height: `${Math.max(6, day.ratio * 100)}%` }]} /></View><Text style={[styles.webWeekDay, day.isToday && styles.pulseDayToday]}>{day.label}</Text></View>)}</View>
            <View style={styles.webWeekStats}><View><Text style={styles.webWeekStatValue}>{formatMiles(week.miles)}</Text><Text style={styles.webWeekStatLabel}>MILES DRIVEN</Text></View><View><Text style={styles.webWeekStatValue}>{week.journeyCount}</Text><Text style={styles.webWeekStatLabel}>JOURNEYS</Text></View><View><Text style={styles.webWeekStatValue}>{week.songCount}</Text><Text style={styles.webWeekStatLabel}>SONGS MATCHED</Text></View></View>
          </View>

          <View style={[styles.webAllTimeRail, styles.staticWidgetGlow]}><View><Text style={styles.webAllTimeKicker}>YOUR JOURNEYDECK</Text><Text style={styles.webAllTimeTitle}>The road so far</Text></View><View style={styles.webAllTimeMetric}><Text style={styles.webAllTimeMetricValue}>{formatMiles(allTime.miles)}</Text><Text style={styles.webAllTimeMetricLabel}>ALL-TIME DISTANCE</Text></View><View style={styles.webAllTimeMetric}><Text style={styles.webAllTimeMetricValue}>{allTime.journeyCount}</Text><Text style={styles.webAllTimeMetricLabel}>JOURNEYS</Text></View></View>
          {!recorderHealthy && <Text style={styles.webQueueNote}>{data.recorder.queuedPoints + data.recorder.queuedMusic} items are safely waiting to sync on this iPhone.</Text>}
        </View>
        {state.status === 'loading' && <LoadingLine label="Refreshing your dashboard…" />}
      </ScrollView>
    </View>
  );
}

function HomeArchiveTile({ value, label, color, onPress }: { value: number; label: string; color: string; onPress: () => void }) {
  return <Pressable onPress={onPress} style={[styles.homeArchiveTile, { borderColor: `${color}66`, shadowColor: color }]}><View style={[styles.homeArchiveGlow, { backgroundColor: `${color}22` }]} /><Text style={[styles.homeArchiveValue, { color }]}>{value.toLocaleString()}</Text><Text style={styles.homeArchiveLabel}>{label}</Text></Pressable>;
}

function HomeIntelligenceMetric({ value, label, detail }: { value: string; label: string; detail: string }) {
  return <View style={styles.homeIntelligenceMetric}><Text style={styles.homeIntelligenceValue} numberOfLines={1}>{value}</Text><Text style={styles.homeIntelligenceLabel}>{label}</Text><Text style={styles.homeIntelligenceDetail} numberOfLines={1}>{detail}</Text></View>;
}

function HomeExploreAction({ symbol, title, detail, color, onPress }: { symbol: SFSymbol; title: string; detail: string; color: string; onPress: () => void }) {
  return <Pressable onPress={onPress} style={styles.homeExploreAction}><View style={[styles.homeExploreIcon, { backgroundColor: `${color}18`, borderColor: `${color}55` }]}><SymbolView name={symbol} tintColor={color} type="hierarchical" style={styles.homeExploreSymbol} /></View><View style={styles.flex}><Text style={styles.homeExploreTitle}>{title}</Text><Text style={styles.homeExploreDetail}>{detail}</Text></View><Text style={[styles.webRecorderChevron, { color }]}>›</Text></Pressable>;
}

function DashboardWaveform() {
  const bars = [8, 16, 27, 13, 31, 20, 38, 17, 29, 42, 20, 34, 14, 27, 37, 18, 31, 11, 24, 35, 16, 27, 9, 20];
  return <View style={styles.webWaveform}>{bars.map((height, index) => <View key={index} style={[styles.webWaveBar, { height }]} />)}</View>;
}

function WebAction({ symbol, title, detail, color, onPress }: { symbol: SFSymbol; title: string; detail: string; color: string; onPress: () => void }) {
  return <Pressable onPress={onPress} style={({ pressed }) => [styles.webAction, { borderColor: `${color}88`, shadowColor: color }, pressed && styles.pressed]}>
    <LinearGradient pointerEvents="none" colors={[`${color}70`, `${color}25`, '#12091b']} locations={[0, 0.48, 1]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
    <Svg pointerEvents="none" viewBox="0 0 100 120" preserveAspectRatio="none" style={StyleSheet.absoluteFill}><Defs><SvgRadialGradient id={`actionGlint${title.replace(/\s/g, '')}`} cx="28%" cy="8%" rx="64%" ry="48%"><Stop offset="0" stopColor="#ffffff" stopOpacity="0.23" /><Stop offset="0.42" stopColor="#ffffff" stopOpacity="0.06" /><Stop offset="1" stopColor="#ffffff" stopOpacity="0" /></SvgRadialGradient></Defs><Rect width="100" height="120" fill={`url(#actionGlint${title.replace(/\s/g, '')})`} /></Svg>
    <View style={[styles.webActionIcon, { borderColor: `${color}cc`, shadowColor: color }]}><SymbolView name={symbol} tintColor={color} type="hierarchical" style={styles.webActionSymbol} /></View>
    <View style={styles.webActionSpacer} />
    <Text style={styles.webActionTitle}>{title}</Text><Text style={styles.webActionDetail} numberOfLines={1}>{detail}</Text>
  </Pressable>;
}

function CompactJourneyRow({ journey, onPress }: { journey: JourneySummary; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.webJourneyRow, pressed && styles.pressed]}>
      <View style={styles.webPlaceIcon}><Text>⌂</Text></View>
      <View style={styles.flex}>
        <Text style={styles.webJourneyOrigin} numberOfLines={2}>{journey.startingLocation ?? 'Journey start'}</Text>
        <Text style={styles.webJourneyDestination} numberOfLines={1}>{journey.endingLocation ?? 'Recorded destination'}</Text>
        <Text style={styles.webJourneyMeta}>{formatMiles(journey.miles)} · {formatDuration(journey.durationMinutes)}</Text>
      </View>
      <View style={styles.webRouteThumb}>
        <Svg width={48} height={38} viewBox="0 0 48 38">
          <Path d="M 6 30 Q 20 10 42 12" fill="none" stroke="#ff694f" strokeWidth="2.5" strokeLinecap="round" />
          <Circle cx="6" cy="30" r="3" fill="#9746f5" />
          <Circle cx="42" cy="12" r="3" fill="#ffc2af" />
        </Svg>
      </View>
    </Pressable>
  );
}

function CompactHealthRow({ symbol, icon, label, detail, healthy }: { symbol: string; icon?: ReactNode; label: string; detail: string; healthy: boolean }) {
  return <View style={styles.webCompactHealth}>{icon ?? <View style={[styles.webServiceIcon, { backgroundColor: healthy ? '#2589c8' : '#62334c' }]}><Text style={styles.webServiceIconText}>{symbol}</Text></View>}<View style={styles.flex}><Text style={styles.webServiceName} numberOfLines={1}>{label}</Text><Text style={styles.webServiceDetail} numberOfLines={1}>{detail}</Text></View><View style={[styles.webHealthCheck, { backgroundColor: healthy ? '#2caeea' : '#ff9a5d' }]}><Text style={styles.webHealthCheckText}>{healthy ? '✓' : '!'}</Text></View></View>;
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
    <Svg width="100%" height={132} viewBox="0 0 360 132" style={StyleSheet.absoluteFill}>
      <Defs>
        <SvgLinearGradient id="openRoadSky" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#1a0c28" />
          <Stop offset="0.6" stopColor="#0d0918" />
          <Stop offset="1" stopColor="#050308" />
        </SvgLinearGradient>
        <SvgLinearGradient id="openRoadSun" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#ff9a78" />
          <Stop offset="1" stopColor="#ff5a43" />
        </SvgLinearGradient>
        <SvgLinearGradient id="openRoadGlow" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor="#ff5a43" stopOpacity={0} />
          <Stop offset="0.5" stopColor="#ff7b54" stopOpacity={0.6} />
          <Stop offset="1" stopColor="#ff5a43" stopOpacity={0} />
        </SvgLinearGradient>
        <SvgLinearGradient id="openRoadPav" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#1e142e" />
          <Stop offset="1" stopColor="#0a0612" />
        </SvgLinearGradient>
      </Defs>
      <Rect width="360" height="132" fill="url(#openRoadSky)" />
      <Circle cx={45} cy={22} r={1.5} fill="#e4d6ff" opacity={0.7} />
      <Circle cx={120} cy={35} r={1} fill="#e4d6ff" opacity={0.5} />
      <Circle cx={275} cy={18} r={1.5} fill="#e4d6ff" opacity={0.8} />
      <Circle cx={320} cy={38} r={1} fill="#e4d6ff" opacity={0.6} />
      <Circle cx={180} cy={56} r={28} fill="url(#openRoadSun)" opacity={0.9} />
      <Circle cx={180} cy={56} r={44} fill="#ff5a43" opacity={0.15} />
      <Path d="M 16 58 L 344 58" stroke="url(#openRoadGlow)" strokeWidth={1.5} />
      <Path d="M 162 58 L 198 58 L 290 132 L 70 132 Z" fill="url(#openRoadPav)" />
      <Path d="M 162 58 L 70 132" stroke="#9d70ff" strokeWidth={2} opacity={0.75} />
      <Path d="M 198 58 L 290 132" stroke="#9d70ff" strokeWidth={2} opacity={0.75} />
      <Path d="M 180 62 L 180 70" stroke="#ff8767" strokeWidth={1.5} opacity={0.8} />
      <Path d="M 180 76 L 180 90" stroke="#ff8767" strokeWidth={2.5} opacity={0.9} />
      <Path d="M 180 98 L 180 124" stroke="#ff8767" strokeWidth={4} opacity={1} />
    </Svg>
    <View style={styles.roadSoundwave}><View style={styles.roadSoundBarSmall} /><View style={styles.roadSoundBarTall} /><View style={styles.roadSoundBarMedium} /><View style={styles.roadSoundBarTall} /><View style={styles.roadSoundBarSmall} /></View>
    <Text style={styles.roadCaption}>OPEN ROAD  •  YOUR STORY</Text>
  </View>;
}

function MemoriesScreen({ catalog, journeys, details, onJourney, onRefresh }: {
  catalog: LoadState<MemoriesCatalog>; journeys: LoadState<JourneySummary[]>; details: JourneyDetail[];
  onJourney: (id: string) => void; onRefresh: () => void;
}) {
  const insets = useSafeAreaInsets();
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
  const memoryTransitionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [saving, setSaving] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [section, setSection] = useState<'library' | 'memories' | 'collections'>('memories');
  const [query, setQuery] = useState('');
  const [libraryFilter, setLibraryFilter] = useState<JourneyLibraryFilter>('all');
  const [librarySort, setLibrarySort] = useState<JourneyLibrarySort>('newest');
  const [assignJourneyId, setAssignJourneyId] = useState<string | null>(null);
  const visibleJourneys = useMemo(() => filterJourneyLibrary(journeys.data, query, libraryFilter, librarySort), [journeys.data, query, libraryFilter, librarySort]);
  const recurringRoutes = useMemo(() => favoriteRoutes(journeys.data).slice(0, 3), [journeys.data]);
  const visibleMemories = useMemo(() => catalog.data.memories.filter(item => `${item.name} ${item.notes}`.toLowerCase().includes(query.trim().toLowerCase())), [catalog.data.memories, query]);
  const visibleCollections = useMemo(() => catalog.data.collections.filter(item => `${item.name} ${item.description}`.toLowerCase().includes(query.trim().toLowerCase())), [catalog.data.collections, query]);
  const collectionJourneys = collectionOverview ? journeys.data.filter(journey => collectionOverview.driveIds.includes(journey.id)) : [];
  const collectionRoutes = collectionOverview ? details.filter(detail => collectionOverview.driveIds.includes(detail.id) && detail.route?.coordinates.length).map(detail => ({ id: detail.id, coordinates: detail.route!.coordinates })) : [];
  const selectedMemory = catalog.data.memories[Math.min(selectedIndex, Math.max(0, catalog.data.memories.length - 1))] ?? null;
  const selectedCollections = selectedMemory
    ? selectedMemory.collectionIds.map(id => catalog.data.collections.find(collection => collection.id === id)).filter((collection): collection is JourneyCollection => Boolean(collection))
    : [];
  const availableMemoryPhotos = memoryDraft ? [
    ...memoryDraft.photos.filter(photo => photo.source === 'memory'),
    ...memoryDraft.collectionIds.flatMap(id => catalog.data.collections.find(collection => collection.id === id)?.photos ?? []),
  ].filter((photo, index, photos) => photos.findIndex(candidate => candidate.id === photo.id) === index) : [];

  useEffect(() => { if (selectedIndex >= catalog.data.memories.length && catalog.data.memories.length) setSelectedIndex(catalog.data.memories.length - 1); }, [catalog.data.memories.length, selectedIndex]);
  useEffect(() => () => { if (memoryTransitionTimer.current) clearTimeout(memoryTransitionTimer.current); }, []);

  const closeMemoryThen = (action: () => void) => {
    if (memoryTransitionTimer.current) clearTimeout(memoryTransitionTimer.current);
    setMemoryOverview(null);
    memoryTransitionTimer.current = setTimeout(() => {
      memoryTransitionTimer.current = null;
      action();
    }, 260);
  };

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
  const assignToCollection = async (collection: JourneyCollection) => {
    if (!assignJourneyId) return;
    if (collection.driveIds.includes(assignJourneyId)) { setAssignJourneyId(null); return; }
    setSaving(true);
    try {
      await appDataClient.saveCollection({ id: collection.id, name: collection.name, description: collection.description, driveIds: [...collection.driveIds, assignJourneyId] });
      setAssignJourneyId(null);
      onRefresh();
    } finally { setSaving(false); }
  };

  return <View style={styles.safe}>
    <ScrollView
      contentContainerStyle={[styles.memoriesPage, { paddingTop: insets.top + 14, paddingBottom: insets.bottom + 132 }]}
      contentInsetAdjustmentBehavior="never"
      automaticallyAdjustContentInsets={false}
      automaticallyAdjustsScrollIndicatorInsets={false}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <AtmosphericBackdrop variant="memories" />
      <View style={styles.memoryPageHeader}><PageHeader variant="memories" eyebrow="YOUR STORY ON THE ROAD" title="Memories" body="Memories hold Collections. Collections hold the journeys that made them." /></View>
      {(catalog.status === 'error' || journeys.status === 'error') && <InlineNotice message={catalog.message ?? journeys.message ?? 'Memories could not refresh.'} onRetry={onRefresh} />}

      <View style={styles.libraryTabs}>{(['library', 'memories', 'collections'] as const).map(item => <Pressable key={item} onPress={() => { setSection(item); setQuery(''); }} style={[styles.libraryTab, section === item && styles.libraryTabActive]}><Text style={[styles.libraryTabText, section === item && styles.libraryTabTextActive]}>{item === 'library' ? 'Journeys' : item[0].toUpperCase() + item.slice(1)}</Text></Pressable>)}</View>
      <TextInput value={query} onChangeText={setQuery} placeholder={`Search ${section}`} placeholderTextColor="#716879" style={styles.librarySearch} />

      {section === 'memories' && <>
      <View style={styles.memorySectionHeader}><Text style={styles.memoryLevel}>MEMORIES</Text><Pressable onPress={() => editMemory(null)}><Text style={styles.memoryHeaderAction}>+ New memory</Text></Pressable></View>
      <Animated.ScrollView
        ref={carousel}
        horizontal showsHorizontalScrollIndicator={false} decelerationRate="fast" snapToInterval={cardStep}
        contentContainerStyle={styles.memoryCarouselContent}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], { useNativeDriver: true })}
        scrollEventThrottle={16}
        onMomentumScrollEnd={event => setSelectedIndex(Math.max(0, Math.min(catalog.data.memories.length - 1, Math.round(event.nativeEvent.contentOffset.x / cardStep))))}
      >
        {visibleMemories.map((memory, index) => {
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
      <View style={styles.memoryDots}>{visibleMemories.map((memory, index) => <View key={memory.id} style={[styles.memoryDot, index === selectedIndex && styles.memoryDotActive]} />)}</View>

      <View style={styles.memorySectionHeader}><View><Text style={styles.memoryLevel}>CHAPTERS</Text><Text style={styles.memorySectionTitle}>{selectedMemory?.name ?? 'Build your first Memory'}</Text></View>{selectedMemory && <Pressable onPress={() => editMemory(selectedMemory)}><Text style={styles.memoryHeaderAction}>Edit</Text></Pressable>}</View>
      {selectedCollections.map((collection, index) => <CollectionCard key={collection.id} collection={collection} index={index} onOpen={() => setCollectionOverview(collection)} />)}
      </>}

      {section === 'collections' && <>
      <View style={styles.memorySectionHeader}><View><Text style={styles.memoryLevel}>COLLECTIONS</Text><Text style={styles.memorySectionTitle}>{selectedMemory?.name ?? 'Saved collections'}</Text></View><View style={styles.memoryHeaderActions}>{selectedMemory && <Pressable onPress={() => editMemory(selectedMemory)}><Text style={styles.memoryHeaderAction}>Edit memory</Text></Pressable>}<Pressable onPress={() => editCollection(null)}><Text style={styles.memoryHeaderAction}>+ New</Text></Pressable></View></View>
      {visibleCollections.map((collection, index) => <CollectionCard key={collection.id} collection={collection} index={index} onOpen={() => setCollectionOverview(collection)} />)}
      {!catalog.data.collections.length && <EmptyCard title="No Collections yet" body="Create a Collection, then add the journeys that belong together." />}
      </>}

      {section === 'library' && <>
      <View style={styles.libraryFilterRow}>{([['all', 'All'], ['music', 'With music'], ['long', '10+ miles'], ['efficient', 'Easy pace']] as const).map(([id, label]) => <Pressable key={id} onPress={() => setLibraryFilter(id)} style={[styles.libraryChip, libraryFilter === id && styles.libraryChipActive]}><Text style={[styles.libraryChipText, libraryFilter === id && styles.libraryChipTextActive]}>{label}</Text></Pressable>)}</View>
      <View style={styles.libraryFilterRow}>{([['newest', 'Newest'], ['oldest', 'Oldest'], ['distance', 'Distance'], ['duration', 'Drive time']] as const).map(([id, label]) => <Pressable key={id} onPress={() => setLibrarySort(id)} style={[styles.librarySortChip, librarySort === id && styles.librarySortChipActive]}><Text style={styles.librarySortText}>{label}</Text></Pressable>)}</View>
      {recurringRoutes.length > 0 && <><View style={styles.memorySectionHeader}><View><Text style={styles.memoryLevel}>FAVORITE ROUTES</Text><Text style={styles.memorySectionTitle}>Roads you return to</Text></View></View>{recurringRoutes.map(route => <View key={route.key} style={styles.favoriteRoute}><View style={styles.flex}><Text style={styles.favoriteRouteTitle}>{route.label}</Text><Text style={styles.favoriteRouteMeta}>{route.count} drives  •  {formatMiles(route.averageMiles)} average  •  {Math.round(route.averageMinutes)} min</Text></View><Text style={styles.favoriteRouteCount}>{route.count}×</Text></View>)}</>}
      <View style={styles.memorySectionHeader}><View><Text style={styles.memoryLevel}>JOURNEY LIBRARY</Text><Text style={styles.memorySectionTitle}>{visibleJourneys.length} archived drives</Text></View></View>
      <View style={styles.memoryJourneyList}>{visibleJourneys.map(journey => <View key={journey.id} style={styles.libraryJourneyWrap}><JourneyCard journey={journey} compact onPress={() => onJourney(journey.id)} /><Pressable onPress={() => setAssignJourneyId(journey.id)} style={styles.libraryAddButton}><Text style={styles.libraryAddText}>+ Collection</Text></Pressable></View>)}</View>
      {!journeys.data.length && journeys.status !== 'loading' && <EmptyCard title="No journeys yet" body="Finish a recording and it will appear here, ready to organize." />}
      </>}
      {(catalog.status === 'loading' || journeys.status === 'loading') && <LoadingLine label="Refreshing memories…" />}
    </ScrollView>

    <MemoryDetailModal
      visible={Boolean(memoryOverview)}
      memory={memoryOverview}
      cover={memoryCover}
      collections={overviewCollections}
      journeys={journeys.data}
      onClose={() => setMemoryOverview(null)}
      onOpenCollection={collection => closeMemoryThen(() => setCollectionOverview(collection))}
      onOpenJourney={journeyId => closeMemoryThen(() => onJourney(journeyId))}
      onShare={() => memoryOverview && closeMemoryThen(() => openMemoryShare(memoryOverview))}
      onEdit={() => memoryOverview && closeMemoryThen(() => editMemory(memoryOverview))}
    />

    <OverlayModal visible={Boolean(collectionOverview)} kicker="COLLECTION OVERVIEW" title={collectionOverview?.name ?? 'Collection'} onClose={() => setCollectionOverview(null)}>
      {collectionOverview && <>
        <View style={styles.overviewCollectionHero}>{collectionOverview.photos[0] ? <JourneyPhotoImage photo={collectionOverview.photos[0]} style={styles.overviewCollectionImage} /> : <View style={[styles.overviewCollectionImage, styles.overviewCollectionFallback]}><LinearGradient colors={['#241238', '#140c20']} style={StyleSheet.absoluteFill} /><Svg width="100%" height="100%" viewBox="0 0 320 230" style={StyleSheet.absoluteFill}><Path d="M 40 210 Q 140 130 180 140 T 280 40" fill="none" stroke="#ff795b" strokeWidth="3.5" strokeLinecap="round" /><Circle cx="280" cy="40" r="5" fill="#43e6ae" stroke="#fff" strokeWidth="2" /></Svg></View>}<View style={styles.memoryHeroShade} /><View style={styles.overviewHeroCopy}><Text style={styles.overviewEyebrow}>ROADS THAT BELONG TOGETHER</Text><Text style={styles.overviewHeroTitle}>{collectionOverview.name}</Text></View></View>
        <OverviewMetrics items={[{ label: 'JOURNEYS', value: String(collectionOverview.driveIds.length) }, { label: 'MILES', value: formatMiles(collectionJourneys.reduce((sum, journey) => sum + journey.miles, 0)) }, { label: 'SONGS', value: String(collectionJourneys.reduce((sum, journey) => sum + journey.songCount, 0)) }]} />
        {collectionOverview.description ? <Text style={styles.overviewBody}>{collectionOverview.description}</Text> : <Text style={styles.overviewBodyMuted}>Add a description to give this Collection more context.</Text>}
        <Text style={styles.overviewSectionLabel}>COLLECTION MAP</Text>
        <PrimaryMobilityMap routes={collectionRoutes} height={260} emptyMessage="Open a journey once to cache its recorded route for this Collection map." />
        <Text style={styles.overviewSectionLabel}>JOURNEYS IN THIS COLLECTION</Text>
        {journeys.data.filter(journey => collectionOverview.driveIds.includes(journey.id)).slice(0, 6).map(journey => <Pressable key={journey.id} onPress={() => { setCollectionOverview(null); onJourney(journey.id); }} style={[styles.overviewListRow, styles.staticWidgetGlow]}><View style={styles.flex}><Text style={styles.overviewListTitle}>{locationPair(journey)}</Text><Text style={styles.overviewListMeta}>{formatCompactDate(journey.startedAt)}  •  {formatMiles(journey.miles)}</Text></View><Text style={styles.overviewChevron}>›</Text></Pressable>)}
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
    <OverlayModal visible={Boolean(assignJourneyId)} kicker="QUICK ORGANIZE" title="Add to a Collection" onClose={() => setAssignJourneyId(null)}>
      <Text style={styles.overviewBodyMuted}>Choose where this journey belongs. The change is saved on this iPhone first.</Text>
      {catalog.data.collections.map(collection => <MembershipRow key={collection.id} title={collection.name} detail={`${collection.driveIds.length} journeys`} selected={Boolean(assignJourneyId && collection.driveIds.includes(assignJourneyId))} onPress={() => void assignToCollection(collection)} />)}
      {!catalog.data.collections.length && <Pressable onPress={() => { setAssignJourneyId(null); editCollection(null); }} style={styles.overviewPrimary}><Text style={styles.overviewPrimaryText}>Create your first Collection</Text></Pressable>}
    </OverlayModal>
    <ShareCardModal payload={shareCard} onClose={() => setShareCard(null)} />
  </View>;
}

function MemoryDetailModal({
  visible, memory, cover, collections, journeys, onClose, onOpenCollection, onOpenJourney, onShare, onEdit,
}: {
  visible: boolean;
  memory: JourneyMemory | null;
  cover: JourneyPhoto | null;
  collections: JourneyCollection[];
  journeys: JourneySummary[];
  onClose: () => void;
  onOpenCollection: (collection: JourneyCollection) => void;
  onOpenJourney: (journeyId: string) => void;
  onShare: () => void;
  onEdit: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const sweepX = useSharedValue(-width * 1.4);
  const sweepStyle = useAnimatedStyle(() => ({ transform: [{ translateX: sweepX.value }] }));

  useEffect(() => {
    if (!visible) {
      sweepX.value = -width * 1.4;
      return;
    }
    sweepX.value = -width * 1.4;
    sweepX.value = withDelay(170, withTiming(width * 1.5, { duration: 540, easing: Easing.out(Easing.cubic) }));
  }, [sweepX, visible, width]);

  if (!visible || !memory) return null;

  const journeyIds = new Set(collections.flatMap(collection => collection.driveIds));

  return <View style={[styles.memoryDetailRoot, StyleSheet.absoluteFill, { zIndex: 100 }]}>
      <Reanimated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(150)} style={styles.memoryDetailBackdrop}>
        <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
      </Reanimated.View>
      <Reanimated.View entering={FadeInDown.duration(260).springify().damping(20)} exiting={FadeOut.duration(150)} style={[styles.memoryDetailSheet, { paddingTop: insets.top + 10, paddingBottom: insets.bottom + 10 }]}>
        <LinearGradient colors={['#2b172b', '#120d1a', '#08070c'] as const} locations={[0, 0.36, 1]} style={StyleSheet.absoluteFill} />
        <Reanimated.View pointerEvents="none" style={[styles.memoryDetailSweep, sweepStyle]}>
          <LinearGradient colors={['transparent', 'rgba(255,127,92,0.34)', 'rgba(176,112,255,0.18)', 'transparent'] as const} locations={[0, 0.43, 0.58, 1]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.memoryDetailSweepGradient} />
        </Reanimated.View>
        <View style={styles.memoryDetailHeader}>
          <Pressable accessibilityRole="button" accessibilityLabel="Close memory" onPress={onClose} style={styles.memoryDetailClose}><Text style={styles.memoryDetailCloseText}>‹</Text></Pressable>
          <View style={styles.memoryDetailHeaderActions}><Pressable onPress={onShare} style={styles.memoryDetailHeaderAction}><Text style={styles.memoryDetailHeaderActionText}>Share</Text></Pressable><Pressable onPress={onEdit} style={styles.memoryDetailHeaderAction}><Text style={styles.memoryDetailHeaderActionText}>Edit</Text></Pressable></View>
        </View>
        <ScrollView contentContainerStyle={styles.memoryDetailContent} showsVerticalScrollIndicator={false} contentInsetAdjustmentBehavior="never" automaticallyAdjustContentInsets={false} automaticallyAdjustsScrollIndicatorInsets={false}>
          <Reanimated.View entering={FadeInUp.delay(150).duration(360)} style={styles.memoryDetailHero}>
            <View style={StyleSheet.absoluteFill}>{cover ? <JourneyPhotoImage photo={cover} style={styles.memoryDetailHeroImage} /> : <MemoryArtwork artworkKey={memory.artworkKey} />}</View>
            <LinearGradient colors={['rgba(5,3,9,0.04)', 'rgba(8,5,13,0.33)', '#09060de8'] as const} locations={[0, 0.42, 1]} style={StyleSheet.absoluteFill} />
            <View style={styles.memoryDetailHeroGlowOne} /><View style={styles.memoryDetailHeroGlowTwo} />
            <View style={styles.memoryDetailHeroContent}><Text style={styles.memoryDetailKicker}>MEMORY</Text><Text style={styles.memoryDetailTitle}>{memory.name}</Text><Text style={styles.memoryDetailMeta}>{collections.length} collections  ·  {journeyIds.size} journeys</Text></View>
          </Reanimated.View>
          <Reanimated.View entering={FadeInUp.delay(230).duration(280)} style={styles.memoryDetailBreadcrumb}><Text style={styles.memoryDetailBreadcrumbMuted}>Memory</Text><Text style={styles.memoryDetailBreadcrumbArrow}>›</Text><Text style={styles.memoryDetailBreadcrumbActive}>Collections</Text><Text style={styles.memoryDetailBreadcrumbArrow}>›</Text><Text style={styles.memoryDetailBreadcrumbMuted}>Journeys</Text></Reanimated.View>
          {memory.notes ? <Reanimated.Text entering={FadeInUp.delay(270).duration(260)} style={styles.memoryDetailNotes}>{memory.notes}</Reanimated.Text> : null}
          <Reanimated.Text entering={FadeInUp.delay(300).duration(260)} style={styles.memoryDetailSection}>COLLECTIONS</Reanimated.Text>
          <View style={styles.memoryDetailAtlas}>
            <MemoryRoadThread collectionCount={collections.length} />
            <View style={styles.memoryDetailChapters}>
              {collections.map((collection, index) => <MemoryCollectionChapter key={collection.id} collection={collection} index={index} journeys={journeys.filter(journey => collection.driveIds.includes(journey.id))} onOpen={() => onOpenCollection(collection)} onOpenJourney={onOpenJourney} />)}
            </View>
          </View>
          {!collections.length && <EmptyCard title="This Memory is waiting for Collections" body="Add at least two Collections to make this chapter come alive." />}
        </ScrollView>
      </Reanimated.View>
  </View>;
}

function MemoryRoadThread({ collectionCount }: { collectionCount: number }) {
  const height = Math.max(300, collectionCount * 286 + 88);
  return <View pointerEvents="none" style={[styles.memoryRoadThread, { height }]}>
    <Svg width="82" height={height} viewBox="0 0 82 900" preserveAspectRatio="none">
      <Defs><SvgLinearGradient id="memoryRoad" x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor="#ffb19b" /><Stop offset="0.42" stopColor="#a47dff" /><Stop offset="1" stopColor="#ff765c" /></SvgLinearGradient></Defs>
      <Path d="M 48 0 C 5 70, 78 122, 31 210 S 77 354, 30 454 S 78 635, 30 730 S 70 836, 43 900" stroke="#ff7e67" strokeWidth="15" opacity="0.16" fill="none" />
      <Path d="M 48 0 C 5 70, 78 122, 31 210 S 77 354, 30 454 S 78 635, 30 730 S 70 836, 43 900" stroke="url(#memoryRoad)" strokeWidth="3" fill="none" />
    </Svg>
  </View>;
}

function MemoryCollectionChapter({ collection, index, journeys, onOpen, onOpenJourney }: { collection: JourneyCollection; index: number; journeys: JourneySummary[]; onOpen: () => void; onOpenJourney: (journeyId: string) => void }) {
  const preview = journeys.slice(0, 3);
  return <Reanimated.View entering={FadeInUp.delay(380 + index * 90).duration(340)} style={styles.memoryChapterWrap}>
    <View style={styles.memoryDetailRoadNode} />
    <View style={styles.memoryChapterCard}>
      <Pressable onPress={onOpen} style={styles.memoryChapterHeader}>
        {collection.photos[0] ? <JourneyPhotoImage photo={collection.photos[0]} style={styles.memoryChapterArtwork} /> : <CollectionPlaceholderArtwork index={index} />}
        <View style={styles.flex}><Text style={styles.memoryChapterKicker}>COLLECTION  ·  TAP TO OPEN</Text><Text style={styles.memoryChapterTitle}>{collection.name}</Text><Text style={styles.memoryChapterMeta}>{collection.driveIds.length} journeys  ·  {collection.photos.length ? `${collection.photos.length} photos` : 'cinematic placeholders'}</Text></View>
        <View style={styles.memoryChapterOpen}><Text style={styles.memoryChapterOpenText}>→</Text></View>
      </Pressable>
      {preview.length ? <View style={styles.memoryChapterJourneys}>{preview.map((journey, journeyIndex) => <Pressable key={journey.id} onPress={() => onOpenJourney(journey.id)} style={styles.memoryChapterJourney}><View style={[styles.memoryChapterJourneyVisual, { height: 65, alignSelf: 'auto', borderRadius: 13 }]}><JourneyMomentArtwork index={index + journeyIndex} /></View><View style={styles.memoryChapterJourneyIndex}><Text style={styles.memoryChapterJourneyIndexText}>{journeyIndex + 1}</Text></View><View style={styles.flex}><Text style={styles.memoryChapterJourneyRoute} numberOfLines={1}>{locationPair(journey)}</Text><Text style={styles.memoryChapterJourneyMeta}>{formatCompactDate(journey.startedAt)}  ·  {formatMiles(journey.miles)}</Text></View></Pressable>)}</View> : <Text style={styles.memoryChapterEmpty}>Open this Collection to choose its journeys.</Text>}
      {collection.driveIds.length > preview.length && <Pressable onPress={onOpen} style={styles.memoryChapterMore}><Text style={styles.memoryChapterMoreText}>View all {collection.driveIds.length} journeys</Text><Text style={styles.memoryChapterMoreArrow}>›</Text></Pressable>}
    </View>
  </Reanimated.View>;
}

function CollectionPlaceholderArtwork({ index }: { index: number }) {
  const isAlt = index % 2 === 1;
  return (
    <View style={styles.memoryChapterArtwork}>
      <LinearGradient
        colors={isAlt ? ['#170e28', '#2a1640', '#0f0a1c'] : ['#220d20', '#3b1633', '#110714']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <Svg width="100%" height="100%" viewBox="0 0 92 82" style={StyleSheet.absoluteFill}>
        <Defs>
          <SvgLinearGradient id={`colRoadGrad-${index}`} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0%" stopColor={isAlt ? '#a47dff' : '#ff795b'} />
            <Stop offset="100%" stopColor={isAlt ? '#5ce5c2' : '#ff4d87'} />
          </SvgLinearGradient>
        </Defs>
        <Path d="M 0 44 L 92 44" stroke="#4a2d59" strokeWidth="0.75" opacity="0.6" />
        <Path d="M 0 52 Q 28 36 50 48 T 92 42" fill="none" stroke="#3d214c" strokeWidth="1.5" opacity="0.7" />
        <Path d="M 12 82 C 26 62, 54 56, 46 44" fill="none" stroke={`url(#colRoadGrad-${index})`} strokeWidth="2.5" strokeLinecap="round" />
        <Path d="M 14 82 C 27 63, 53 57, 46 45" fill="none" stroke="#fff" strokeWidth="0.75" strokeDasharray="3 3" opacity="0.75" />
        <Circle cx="46" cy="44" r="2.5" fill={isAlt ? '#5ce5c2' : '#ff795b'} />
      </Svg>
    </View>
  );
}

function JourneyMomentArtwork({ index }: { index: number }) {
  const palettes = index % 3 === 0
    ? ['#261021', '#130a17'] as const
    : index % 3 === 1
      ? ['#0f172a', '#080c18'] as const
      : ['#1d1228', '#0c0714'] as const;
  const accent = index % 3 === 0 ? '#ff795b' : index % 3 === 1 ? '#43e6ae' : '#b583ff';

  return (
    <View style={StyleSheet.absoluteFill}>
      <LinearGradient colors={palettes} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <Svg width="100%" height="100%" viewBox="0 0 74 65" style={StyleSheet.absoluteFill}>
        <Defs>
          <SvgLinearGradient id={`momentGrad-${index}`} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0%" stopColor={accent} />
            <Stop offset="100%" stopColor="#ff4d87" />
          </SvgLinearGradient>
        </Defs>
        <Path d="M 8 65 C 20 45, 52 40, 48 20" fill="none" stroke={`url(#momentGrad-${index})`} strokeWidth="2" strokeLinecap="round" />
        <Circle cx="48" cy="20" r="2" fill="#fff" />
      </Svg>
    </View>
  );
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
  return <View style={[styles.overviewMetrics, styles.staticWidgetGlow]}>{items.map(item => <View key={item.label} style={styles.overviewMetric}><Text style={styles.overviewMetricValue}>{item.value}</Text><Text style={styles.overviewMetricLabel}>{item.label}</Text></View>)}</View>;
}

function MemoryArtwork({ artworkKey, photo }: { artworkKey: string; photo?: JourneyPhoto | null }) {
  const isNight = artworkKey === 'favorite-night-drives' || artworkKey === 'golden-hour-drives';
  if (photo) return <JourneyPhotoImage photo={photo} style={styles.memoryArtwork} />;

  return (
    <View style={[styles.memoryArtwork, isNight && styles.memoryArtworkNight]}>
      <LinearGradient
        colors={isNight ? ['#0d142b', '#180f2c', '#080611'] : ['#281023', '#391230', '#100713']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <Svg width="100%" height="100%" viewBox="0 0 320 240" style={StyleSheet.absoluteFill}>
        <Defs>
          <SvgRadialGradient id="memoryArtGlow" cx="50%" cy="30%" rx="40%" ry="40%">
            <Stop offset="0%" stopColor={isNight ? '#6347ff' : '#ff795b'} stopOpacity="0.3" />
            <Stop offset="100%" stopColor={isNight ? '#6347ff' : '#ff795b'} stopOpacity="0" />
          </SvgRadialGradient>
          <SvgLinearGradient id="memoryArtRoad" x1="0" y1="1" x2="0" y2="0">
            <Stop offset="0%" stopColor={isNight ? '#5ce5c2' : '#ff795b'} />
            <Stop offset="60%" stopColor={isNight ? '#b17aff' : '#ff4d87'} />
            <Stop offset="100%" stopColor={isNight ? '#ff8bb9' : '#9b61ff'} />
          </SvgLinearGradient>
        </Defs>
        <Rect width="320" height="240" fill="url(#memoryArtGlow)" />
        <Path d="M 0 110 L 320 110" stroke="#482b57" strokeWidth="1" opacity="0.4" />
        <Path d="M 120 240 L 157 110 L 163 110 L 200 240 Z" fill="#0d0915" opacity="0.85" />
        <Path d="M 120 240 L 157 110" stroke="url(#memoryArtRoad)" strokeWidth="2.5" />
        <Path d="M 200 240 L 163 110" stroke="url(#memoryArtRoad)" strokeWidth="2.5" />
        <Path d="M 160 230 L 160 210" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" opacity="0.8" />
        <Path d="M 160 190 L 160 174" stroke="#fff" strokeWidth="2" strokeLinecap="round" opacity="0.7" />
        <Path d="M 160 160 L 160 148" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
        <Path d="M 160 138 L 160 130" stroke="#fff" strokeWidth="1" strokeLinecap="round" opacity="0.5" />
        <Circle cx="160" cy="110" r="5" fill={isNight ? '#5ce5c2' : '#ff8c6d'} />
        <Circle cx="160" cy="110" r="10" fill="none" stroke={isNight ? '#5ce5c2' : '#ff8c6d'} strokeWidth="1" opacity="0.35" />
      </Svg>
    </View>
  );
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
  return (
    <Pressable onPress={onOpen} style={[styles.memoryCollectionCard, styles.staticWidgetGlow]}>
      {collection.photos[0] ? (
        <JourneyPhotoImage photo={collection.photos[0]} style={styles.collectionArtwork} />
      ) : (
        <View style={styles.collectionArtwork}>
          <LinearGradient colors={['#1c1028', '#100a18']} style={StyleSheet.absoluteFill} />
          <Svg width={68} height={68} viewBox="0 0 68 68" style={StyleSheet.absoluteFill}>
            <Path d="M 10 58 Q 30 38 42 42 T 58 16" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
            <Circle cx="58" cy="16" r="3" fill="#fff" />
            <Circle cx="10" cy="58" r="2.5" fill={color} />
          </Svg>
        </View>
      )}
      <View style={styles.flex}>
        <Text style={styles.collectionKicker}>COLLECTION</Text>
        <Text style={styles.collectionTitle}>{collection.name}</Text>
        <Text style={styles.collectionMeta}>
          {collection.driveIds.length} journeys • {collection.photos.length} photos{collection.description ? ` • ${collection.description}` : ''}
        </Text>
      </View>
      <View style={styles.collectionManage}>
        <Text style={styles.collectionManageText}>Open</Text>
      </View>
    </Pressable>
  );
}

function JourneysScreen({ state, hasMore, loadingMore, onJourney, onRefresh, onLoadMore }: { state: LoadState<JourneySummary[]>; hasMore: boolean; loadingMore: boolean; onJourney: (id: string) => void; onRefresh: () => void; onLoadMore: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.safe}>
      <ScrollView
        contentContainerStyle={[styles.pageContent, { paddingTop: insets.top + 14, paddingBottom: insets.bottom + 132 }]}
        contentInsetAdjustmentBehavior="never"
        automaticallyAdjustContentInsets={false}
        automaticallyAdjustsScrollIndicatorInsets={false}
        showsVerticalScrollIndicator={false}
      >
        <AtmosphericBackdrop variant="memories" />
        <PageHeader eyebrow="YOUR STORY ON THE ROAD" title="Journeys" body="Routes, vehicle moments, and every soundtrack in one place." />
        {state.status === 'error' && <InlineNotice message={state.message!} onRetry={onRefresh} />}
        {state.status === 'loading' && state.data.length === 0 ? <LoadingCard /> : state.data.length
          ? state.data.map(journey => <JourneyCard key={journey.id} journey={journey} onPress={() => onJourney(journey.id)} />)
          : <EmptyCard title="Your timeline starts here" body="Finish your first recording and it will appear here automatically. Recording still works offline." />}
        {hasMore && <Pressable onPress={onLoadMore} disabled={loadingMore} style={[styles.loadMoreButton, loadingMore && styles.pressed]}>{loadingMore ? <ActivityIndicator color="#b59cff" /> : <Text style={styles.loadMoreText}>Load more journeys</Text>}</Pressable>}
      </ScrollView>
    </View>
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
  const [selectedSongIndex, setSelectedSongIndex] = useState<number | null>(null);
  const songMoments = useMemo(() => journey ? buildSongRouteMoments(
    journey.soundtrack,
    journey.route?.coordinates ?? [],
    journey.startedAt,
    journey.endedAt,
  ) : [], [journey]);

  useEffect(() => {
    if (!visible) { setEditingLocations(false); setSelectedSongIndex(null); return; }
    if (!journey) return;
    setSelectedSongIndex(null);
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
    <OverlayModal visible={visible} kicker="JOURNEY OVERVIEW" title="Journey" onClose={onClose}>
      {state.status === 'loading' ? <LoadingCard /> : state.status === 'error' || !journey ? <InlineNotice message={state.message ?? 'Journey unavailable.'} onRetry={onRetry} /> : <>
            <JourneyCinematicHero journey={journey} />
            <View style={styles.journeyMapHeading}>
              <Text style={styles.journeyMapKicker}>JOURNEY MAP</Text>
              <Text style={styles.journeyMapTitle}>ROUTE + SONG LOCATIONS</Text>
            </View>
            <InteractiveRouteMap
              coordinates={journey.route?.coordinates ?? []}
              routeSamples={journey.route?.points}
              songMoments={songMoments}
              totalSongCount={Math.max(journey.songCount, journey.soundtrack.length)}
              startedAt={journey.startedAt}
              endedAt={journey.endedAt}
              startingBatteryPercent={journey.startingBatteryPercent}
              endingBatteryPercent={journey.endingBatteryPercent}
              startLabel={journey.startingLocation}
              endLabel={journey.endingLocation}
              selectedSongIndex={selectedSongIndex}
              onSelectSong={setSelectedSongIndex}
              fallback={<RouteSketch expanded coordinates={journey.route?.coordinates ?? []} soundtrack={journey.soundtrack} startedAt={journey.startedAt} endedAt={journey.endedAt} startLabel={journey.startingLocation} endLabel={journey.endingLocation} />}
            />
            <SectionHeading title="Soundtrack moments" action={`${journey.songCount} songs`} />
            {journey.soundtrack.length ? journey.soundtrack.map((track, index) => <TrackRow key={`${track.source}-${track.playedAt ?? track.track}-${index}`} track={track} index={index + 1} selected={selectedSongIndex === index + 1} onPress={() => setSelectedSongIndex(index + 1)} />) : <EmptyCard title="No songs matched yet" body="JourneyDeck may keep checking briefly after a drive, or you can choose another music connection." />}
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
              <Pressable onPress={() => { onClose(); const featured = journey.soundtrack[0] ?? journey.soundtrackPreview[0] ?? null; const artistCounts = new Map<string, number>(); journey.soundtrack.forEach(track => artistCounts.set(track.artist, (artistCounts.get(track.artist) ?? 0) + 1)); const topArtist = [...artistCounts.entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))[0]?.[0] ?? featured?.artist ?? null; setShareCard({ kind: 'journey', eyebrow: 'A JOURNEY REMEMBERED', title: formatFullDate(journey.startedAt), subtitle: 'A privacy-safe recap of time on the road—without precise locations.', metrics: [{ label: 'DISTANCE', value: formatMiles(journey.miles) }, { label: 'DRIVE TIME', value: formatDuration(journey.durationMinutes) }, { label: 'SONGS', value: String(journey.songCount) }], accent: '#43e6ae', journey: { startedAt: journey.startedAt, miles: journey.miles, durationMinutes: journey.durationMinutes, energyUsedKwh: journey.energyUsedKwh, songCount: journey.songCount, startLocation: journey.startingLocation, endLocation: journey.endingLocation, routeCoordinates: journey.route?.coordinates ?? [], featured: featured ? { track: featured.track, artist: featured.artist, artworkUrl: featured.artworkUrl } : null, topArtist } }); }} style={styles.journeyShareButton}><Text style={styles.journeyShareButtonText}>Create share card</Text></Pressable>
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
  onChangeRecordingMode, onConnectAppleMusic, onEnableRecognition, currentUser, appleIdentityStatus, signingInWithApple,
  privateCloud, onAppleSignIn, onPrivateCloudSync,
}: {
  dashboard: AppDashboard;
  provider: MusicProvider;
  recordingMode: RecordingMode;
  capabilities: JourneyDeckMusicCapabilityStatus | null;
  connectionCapabilities: ConnectionCapabilities;
  currentUser: LocalUser;
  appleIdentityStatus: AppleIdentityStatus;
  signingInWithApple: boolean;
  privateCloud: PrivateCloudUiState;
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
  onAppleSignIn: () => void;
  onPrivateCloudSync: () => void;
}) {
  const [vehicleIntelligenceVisible, setVehicleIntelligenceVisible] = useState(false);
  const selected = providerOptions.find(option => option.id === provider)!;
  const selectedRecordingMode = recordingModeOptions.find(option => option.id === recordingMode)!;
  const connections = dashboard.providerPreferences?.connections ?? defaultConnections;
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.safe}>
      <ScrollView
        contentContainerStyle={[styles.pageContent, { paddingTop: insets.top + 14, paddingBottom: insets.bottom + 132 }]}
        contentInsetAdjustmentBehavior="never"
        automaticallyAdjustContentInsets={false}
        automaticallyAdjustsScrollIndicatorInsets={false}
        showsVerticalScrollIndicator={false}
      >
        <AtmosphericBackdrop variant="settings" />
        <PageHeader variant="settings" eyebrow="YOUR DATA, YOUR CHOICE" title="Settings" body="JourneyDeck works as a recorder on its own. Add music or vehicle context whenever you are ready." />

        <SectionHeading title="Driver profile & iCloud" />
        <View style={[styles.selectedProvider, styles.staticWidgetGlow, { borderColor: '#a88aff' }]}>
          <View style={[styles.connectionIcon, { backgroundColor: '#a88aff' }]}><Text style={styles.connectionIconText}></Text></View>
          <View style={styles.flex}>
            <Text style={styles.connectionKicker}>LOCAL-FIRST · PRIVATE ICLOUD</Text>
            <Text style={styles.connectionName}>{currentUser.displayName || 'Primary Driver'}</Text>
            <Text style={styles.connectionDetail}>{appleIdentityStatus === 'authorized' ? 'Apple identity linked to this local profile' : 'Local profile · Apple sign-in is optional'}</Text>
          </View>
          <Pressable onPress={onPrivateCloudSync} disabled={privateCloud.status === 'syncing' || privateCloud.status === 'unavailable'} style={[styles.changeButton, privateCloud.status === 'syncing' && styles.pressed]}><Text style={styles.changeButtonText}>{privateCloud.status === 'syncing' ? 'Syncing…' : privateCloud.status === 'synced' ? 'Synced' : privateCloud.status === 'unavailable' ? 'Install 1.7' : 'Sync'}</Text></Pressable>
        </View>
        <View style={styles.privateCloudCard}>
          <Text style={styles.privateCloudTitle}>PRIVATE ICLOUD SYNC</Text>
          <Text style={styles.privateCloudBody}>{privateCloud.detail} Journey summaries, music, collections, and memories use your private iCloud database. Raw route points, Home/Work coordinates, Apple credentials, and local photo paths stay on this iPhone.</Text>
          <Pressable onPress={() => Alert.alert('Apple identity and iCloud', 'Sign in with Apple links this local JourneyDeck profile. Private iCloud sync separately uses the iCloud account signed into this iPhone. JourneyDeck’s server does not receive these CloudKit records.', [{ text: 'Done' }])}><Text style={styles.privateCloudLearn}>How privacy works</Text></Pressable>
        </View>
        {appleIdentityStatus !== 'authorized' && !signingInWithApple && <AppleAuthentication.AppleAuthenticationButton buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE} buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE} cornerRadius={12} style={styles.appleSignInButton} onPress={onAppleSignIn} />}
        {signingInWithApple && <View style={styles.appleSignInProgress}><ActivityIndicator color="#a88aff" /><Text style={styles.connectionDetail}>Finishing Apple sign-in…</Text></View>}
        {appleIdentityStatus === 'revoked' && <Text style={styles.appleIdentityWarning}>Apple access was revoked. Your local journeys remain untouched; sign in again to relink this profile.</Text>}

        <SectionHeading title="Membership" />
        <View style={[styles.selectedProvider, styles.staticWidgetGlow, { borderColor: '#ff69b4' }]}>
          <View style={[styles.connectionIcon, { backgroundColor: '#ff4594' }]}><Text style={styles.connectionIconText}>★</Text></View>
          <View style={styles.flex}>
            <Text style={styles.connectionKicker}>PRO MEMBERSHIP · $4.99 / MONTH</Text>
            <Text style={styles.connectionName}>JourneyDeck Pro</Text>
            <Text style={styles.connectionDetail}>Unlimited trips · Private iCloud backup · Music analytics</Text>
          </View>
          <Pressable onPress={() => Alert.alert('JourneyDeck Pro', 'Your device is currently running with full local-first access unlocked during preview.', [{ text: 'Great' }])} style={[styles.changeButton, { borderColor: '#ff4594' }]}><Text style={[styles.changeButtonText, { color: '#ff4594' }]}>Unlocked</Text></Pressable>
        </View>

        <SectionHeading title="Privacy geofences" />
        <View style={[styles.selectedProvider, styles.staticWidgetGlow, { borderColor: '#43e6ae' }]}>
          <View style={[styles.connectionIcon, { backgroundColor: '#10b981' }]}><Text style={styles.connectionIconText}>🛡</Text></View>
          <View style={styles.flex}>
            <Text style={styles.connectionKicker}>AUTOMATIC PRIVACY MASKING</Text>
            <Text style={styles.connectionName}>Home & Work Safe Zones</Text>
            <Text style={styles.connectionDetail}>300m safety radius active · Coordinates scrubbed on share cards</Text>
          </View>
        </View>

        <SectionHeading title="Recording" />
        <View style={[styles.selectedProvider, styles.staticWidgetGlow, { borderColor: selectedRecordingMode.color }]}>
          <View style={[styles.connectionIcon, { backgroundColor: selectedRecordingMode.color }]}><Text style={styles.connectionIconText}>{selectedRecordingMode.symbol}</Text></View>
          <View style={styles.flex}><Text style={styles.connectionKicker}>SELECTED JOURNEY START METHOD</Text><Text style={styles.connectionName}>{selectedRecordingMode.name}</Text><Text style={styles.connectionDetail}>{selectedRecordingMode.summary}</Text></View>
          <Pressable onPress={onChangeRecordingMode} style={styles.changeButton}><Text style={styles.changeButtonText}>Change</Text></Pressable>
        </View>

        <SectionHeading title="Soundtrack method" />
        <View style={[styles.selectedProvider, styles.staticWidgetGlow, { borderColor: selected.color }]}>
          <ProviderMark brand={selected.brand} size={50} />
          <View style={styles.flex}><Text style={styles.connectionKicker}>SELECTED MUSIC METHOD · NOT A CONNECTION</Text><Text style={styles.connectionName}>{selected.name}</Text><Text style={styles.connectionDetail}>{selected.summary}</Text></View>
          <Pressable onPress={onChangeProvider} style={styles.changeButton}><Text style={styles.changeButtonText}>Change</Text></Pressable>
        </View>

        <SectionHeading title="Music connections" />
        <ConnectionTile name="Apple Music" detail="Native history and artwork" symbol="♪" brand="apple-music" color="#fa5c74" status={nativeAppleStatus(capabilities, connections.appleMusic)} action={capabilities?.appleMusicAuthorizationStatus === 'authorized' ? 'Manage' : 'Connect'} onPress={onConnectAppleMusic} />
        <ConnectionTile name="Auto Recognition" detail="Music recognition powered by ShazamKit" symbol="S" brand="shazam" color="#2688ff" status={nativeShazamStatus(capabilities, connections.shazam)} action={capabilities?.microphonePermissionStatus === 'authorized' ? 'Enabled' : 'Enable'} onPress={onEnableRecognition} />
        <ConnectionTile name="Spotify history" detail="Imported through your Last.fm username" symbol="↻" brand="spotify" color="#1ed760" status={!connectionCapabilities.lastFmConfigured ? 'Server setup required' : connections.lastFm === 'connected' ? statusText(connections.lastFm) : lastFmUsername ? `Set for ${lastFmUsername} · pending first sync` : statusText(connections.lastFm)} action={lastFmUsername ? 'Change' : 'Set up'} onPress={onEditLastFm} />
        {editingLastFm && <View style={styles.setupCard}>
          <Text style={styles.setupTitle}>SPOTIFY HISTORY VIA LAST.FM</Text>
          <Text style={styles.setupBody}>First connect Spotify scrobbling in Last.fm, then enter that public Last.fm username here. JourneyDeck uses only timestamped scrobbles around a completed journey.</Text>
          <TextInput value={lastFmDraft} onChangeText={onLastFmDraft} autoCapitalize="none" autoCorrect={false} maxLength={30} placeholder="Last.fm username" placeholderTextColor="#6f6877" style={styles.setupInput} />
          {!connectionCapabilities.lastFmConfigured && <Text style={styles.setupWarning}>The JourneyDeck server still needs its private Last.fm key before syncing can run.</Text>}
          {lastFmUsername && connectionCapabilities.lastFmConfigured && <Pressable onPress={onSyncLastFm} disabled={syncingLastFm} style={[styles.setupSync, syncingLastFm && styles.pressed]}><Text style={styles.setupSyncText}>{syncingLastFm ? 'Checking recent journeys…' : 'Sync recent journeys now'}</Text></Pressable>}
          <View style={styles.setupActions}><Pressable onPress={onCancelLastFm} style={styles.setupSecondary}><Text style={styles.setupSecondaryText}>Cancel</Text></Pressable><Pressable onPress={onSaveLastFm} disabled={savingLastFm} style={[styles.setupPrimary, savingLastFm && styles.pressed]}><Text style={styles.setupPrimaryText}>{savingLastFm ? 'Saving…' : 'Save'}</Text></Pressable></View>
        </View>}

        <SectionHeading title="Vehicle" />
        <ConnectionTile name="Tessie" detail="Battery, energy, and vehicle context" symbol="T" mark={<TessieMark size={46} />} color="#65c9ff" status={connectionCapabilities.tessieConfigured ? 'Connected through Tessie' : statusText(connections.tessie)} action={connectionCapabilities.tessieConfigured ? 'Server managed' : 'Learn more'} onPress={() => Alert.alert('Better with Tesla + Tessie', connectionCapabilities.tessieConfigured ? 'Tessie is connected securely on the JourneyDeck server. Its token is never copied to this iPhone.' : 'Tessie can add Tesla battery, energy, charging, and vehicle context. Journey recording and music continue to work normally without it.', [{ text: 'Not now', style: 'cancel' }, { text: 'Visit Tessie', onPress: () => void Linking.openURL('https://www.tessie.com/') }])} />
        <ConnectionTile name="Drive intelligence" detail="Charging, saved places, and route efficiency" symbol="↗" color="#ff7547" status="Private · cached on this iPhone" action="Open" onPress={() => setVehicleIntelligenceVisible(true)} />
        <View style={[styles.securityCard, styles.staticWidgetGlow]}><Text style={styles.securityTitle}>PRIVATE BY DESIGN</Text><Text style={styles.securityBody}>Music and Tessie connections are optional and isolated. A connection problem never blocks recording, finishing, or the on-device point queue.</Text></View>
      </ScrollView>
      <VehicleIntelligenceScreen visible={vehicleIntelligenceVisible} onClose={() => setVehicleIntelligenceVisible(false)} />
    </View>
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
    if (finalTab !== activeRef.current) onSelectRef.current(finalTab);
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

function PageHeader({ eyebrow, title, body, variant = 'standard' }: { eyebrow: string; title: string; body: string; variant?: 'standard' | 'memories' | 'settings' }) {
  if (variant === 'memories') {
    return <View style={styles.memoryHeroCardHeader}>
      <Image source={require('../assets/memories-header-hero.png')} style={styles.memoryHeroHeaderImage} resizeMode="cover" />
    </View>;
  }
  return <View style={[styles.pageHeader, variant === 'settings' && pageSceneStyles.settingsHeader]}>
    <PageHeaderScene variant={variant} />
    <Text style={[styles.pageEyebrow, variant !== 'standard' && pageSceneStyles.sceneEyebrow]}>{eyebrow}</Text>
    <Text style={[styles.pageTitle, variant !== 'standard' && pageSceneStyles.sceneTitle]}>{title}</Text>
    <Text style={[styles.pageBody, variant !== 'standard' && pageSceneStyles.sceneBody]}>{body}</Text>
  </View>;
}

function AtmosphericBackdrop({ variant }: { variant: 'home' | 'memories' | 'settings' }) {
  const accent = variant === 'home' ? '#ff603f' : variant === 'memories' ? '#a04cff' : '#54e0bd';
  const secondary = variant === 'settings' ? '#9157ff' : '#ff3f85';
  return <Svg pointerEvents="none" viewBox="0 0 430 1400" preserveAspectRatio="none" style={styles.atmosphere}>
    <Defs>
      <SvgRadialGradient id={`${variant}Top`} cx="52%" cy="3%" rx="62%" ry="32%"><Stop offset="0" stopColor={accent} stopOpacity="0.24" /><Stop offset="0.48" stopColor={accent} stopOpacity="0.09" /><Stop offset="1" stopColor={accent} stopOpacity="0" /></SvgRadialGradient>
      <SvgRadialGradient id={`${variant}Side`} cx="100%" cy="39%" rx="72%" ry="31%"><Stop offset="0" stopColor={secondary} stopOpacity="0.18" /><Stop offset="0.55" stopColor={secondary} stopOpacity="0.06" /><Stop offset="1" stopColor={secondary} stopOpacity="0" /></SvgRadialGradient>
      <SvgRadialGradient id={`${variant}Low`} cx="0%" cy="82%" rx="78%" ry="35%"><Stop offset="0" stopColor="#5f52ff" stopOpacity="0.14" /><Stop offset="0.58" stopColor="#5f52ff" stopOpacity="0.04" /><Stop offset="1" stopColor="#5f52ff" stopOpacity="0" /></SvgRadialGradient>
    </Defs>
    <Rect width="430" height="1400" fill={`url(#${variant}Top)`} /><Rect width="430" height="1400" fill={`url(#${variant}Side)`} /><Rect width="430" height="1400" fill={`url(#${variant}Low)`} />
  </Svg>;
}

function PageHeaderScene({ variant }: { variant: 'standard' | 'memories' | 'settings' }) {
  if (variant === 'memories') return <>
    <LinearGradient pointerEvents="none" colors={['#180c26', '#0d091b', '#06030c'] as const} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
    <Svg pointerEvents="none" viewBox="0 0 360 170" style={pageSceneStyles.sceneCanvas}>
      <Defs>
        <SvgRadialGradient id="memorySkyGlow" cx="76%" cy="25%" rx="55%" ry="60%">
          <Stop offset="0" stopColor="#7a4fb2" stopOpacity="0.32" />
          <Stop offset="50%" stopColor="#ff4d87" stopOpacity="0.08" />
          <Stop offset="100%" stopColor="#06030c" stopOpacity="0" />
        </SvgRadialGradient>
        <SvgRadialGradient id="moonAura" cx="78%" cy="22%" rx="20%" ry="35%">
          <Stop offset="0" stopColor="#dce8ff" stopOpacity="0.4" />
          <Stop offset="40%" stopColor="#7a96d4" stopOpacity="0.12" />
          <Stop offset="100%" stopColor="#7a96d4" stopOpacity="0" />
        </SvgRadialGradient>
        <SvgLinearGradient id="highwayCoral" x1="0" y1="1" x2="1" y2="0">
          <Stop offset="0%" stopColor="#ff8c6d" />
          <Stop offset="60%" stopColor="#ff5a43" />
          <Stop offset="100%" stopColor="#ff9a7a" />
        </SvgLinearGradient>
        <SvgLinearGradient id="highwayMagenta" x1="0" y1="1" x2="1" y2="0">
          <Stop offset="0%" stopColor="#ff3f82" />
          <Stop offset="55%" stopColor="#d946ef" />
          <Stop offset="100%" stopColor="#a855f7" />
        </SvgLinearGradient>
        <SvgLinearGradient id="highwayCyan" x1="0" y1="1" x2="1" y2="0">
          <Stop offset="0%" stopColor="#38bdf8" />
          <Stop offset="50%" stopColor="#43e6ae" />
          <Stop offset="100%" stopColor="#818cf8" />
        </SvgLinearGradient>
        <SvgLinearGradient id="memoryHeaderRoad" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0%" stopColor="#ff795b" />
          <Stop offset="45%" stopColor="#ff3f82" />
          <Stop offset="80%" stopColor="#c57fff" />
          <Stop offset="100%" stopColor="#43e6ae" />
        </SvgLinearGradient>
        <SvgLinearGradient id="topoLines" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0%" stopColor="#68478c" stopOpacity="0.08" />
          <Stop offset="50%" stopColor="#8b5cb8" stopOpacity="0.28" />
          <Stop offset="100%" stopColor="#ff795b" stopOpacity="0.15" />
        </SvgLinearGradient>
      </Defs>
      <Rect width="360" height="170" fill="url(#memorySkyGlow)" />
      <Rect width="360" height="170" fill="url(#moonAura)" />

      {/* Luminous Moon & Stars */}
      <Circle cx="280" cy="34" r="6" fill="#eaf2ff" />
      <Circle cx="280" cy="34" r="12" fill="none" stroke="#90b2f0" strokeWidth="1" opacity="0.3" />
      <Circle cx="230" cy="22" r="1" fill="#ffffff" opacity="0.8" />
      <Circle cx="250" cy="45" r="1.2" fill="#ffffff" opacity="0.6" />
      <Circle cx="320" cy="26" r="1" fill="#ffffff" opacity="0.85" />
      <Circle cx="340" cy="50" r="1.2" fill="#ffd9ea" opacity="0.65" />
      <Circle cx="215" cy="40" r="0.8" fill="#ffffff" opacity="0.5" />

      {/* Topographic Mountain Elevation Contours */}
      <Path d="M 140 38 Q 210 60 355 35" fill="none" stroke="url(#topoLines)" strokeWidth="1" strokeDasharray="3 3" />
      <Path d="M 130 68 Q 205 92 355 65" fill="none" stroke="url(#topoLines)" strokeWidth="1" strokeDasharray="4 4" />
      <Path d="M 120 102 Q 195 125 355 98" fill="none" stroke="url(#topoLines)" strokeWidth="1.2" opacity="0.4" />
      <Path d="M 110 135 Q 185 152 355 130" fill="none" stroke="url(#topoLines)" strokeWidth="1" opacity="0.25" />

      {/* Distant Horizon City Shimmer */}
      <Path d="M 230 70 Q 285 75 340 68" fill="none" stroke="#ff8bb9" strokeWidth="1.5" opacity="0.3" strokeDasharray="1 3" />

      {/* Multi-Lane Glowing Highway Ribbon */}
      {/* Highway Underglow Bloom */}
      <Path d="M 355 72 C 295 72, 280 102, 235 106 S 185 152, 130 146 S 65 162, 0 156" fill="none" stroke="#ff3f82" strokeWidth="16" opacity="0.18" strokeLinecap="round" />

      {/* Lane 1: Cyan/Mint Light Trail */}
      <Path d="M 355 69 C 295 69, 280 99, 235 103 S 185 149, 130 143 S 65 159, 0 153" fill="none" stroke="url(#highwayCyan)" strokeWidth="2.5" strokeLinecap="round" />

      {/* Lane 2: Magenta/Pink Light Trail */}
      <Path d="M 355 72 C 295 72, 280 102, 235 106 S 185 152, 130 146 S 65 162, 0 156" fill="none" stroke="url(#highwayMagenta)" strokeWidth="3" strokeLinecap="round" />

      {/* Lane 3: Coral/Amber Light Trail */}
      <Path d="M 355 75 C 295 75, 280 105, 235 109 S 185 155, 130 149 S 65 165, 0 159" fill="none" stroke="url(#highwayCoral)" strokeWidth="3" strokeLinecap="round" />

      {/* Waypoint Pin Beacons along the Road without Text */}
      {/* Waypoint 1 (Distant apex) */}
      <Path d="M 295 64 C 291 64, 291 70, 295 74 C 299 70, 299 64, 295 64 Z" fill="#d946ef" />
      <Circle cx="295" cy="67" r="1.5" fill="#ffffff" />
      <Circle cx="295" cy="69" r="7" fill="none" stroke="#d946ef" strokeWidth="0.8" opacity="0.4" />

      {/* Waypoint 2 (Mid curve) */}
      <Path d="M 235 94 C 230 94, 230 101, 235 106 C 240 101, 240 94, 235 94 Z" fill="#ff795b" />
      <Circle cx="235" cy="98" r="2" fill="#ffffff" />
      <Circle cx="235" cy="100" r="10" fill="none" stroke="#ff795b" strokeWidth="1" opacity="0.4" strokeDasharray="2 2" />

      {/* Waypoint 3 (Near foreground) */}
      <Path d="M 130 134 C 125 134, 125 141, 130 146 C 135 141, 135 134, 130 134 Z" fill="#38bdf8" />
      <Circle cx="130" cy="138" r="2" fill="#ffffff" />
      <Circle cx="130" cy="140" r="10" fill="none" stroke="#38bdf8" strokeWidth="1" opacity="0.45" />

      {/* Waypoint 4 (Front bend) */}
      <Path d="M 50 146 C 46 146, 46 152, 50 156 C 54 152, 54 146, 50 146 Z" fill="#c084fc" />
      <Circle cx="50" cy="149" r="1.5" fill="#ffffff" />
    </Svg>
    <View pointerEvents="none" style={pageSceneStyles.sceneRail}><View style={pageSceneStyles.sceneRailCore} /></View>
  </>;
  if (variant === 'settings') return <>
    <LinearGradient pointerEvents="none" colors={['#0e1026', '#160f29', '#0d0918'] as const} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
    <Svg pointerEvents="none" viewBox="0 0 360 170" style={pageSceneStyles.sceneCanvas}>
      <Defs>
        <SvgLinearGradient id="settingsHeaderLink" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0%" stopColor="#43e6ae" stopOpacity="0.85" />
          <Stop offset="50%" stopColor="#9b7cff" stopOpacity="0.9" />
          <Stop offset="100%" stopColor="#ff795b" stopOpacity="0.85" />
        </SvgLinearGradient>
        <SvgRadialGradient id="settingsHeaderBloom" cx="80%" cy="35%" rx="60%" ry="70%">
          <Stop offset="0" stopColor="#5570ff" stopOpacity="0.25" />
          <Stop offset="45%" stopColor="#7658dd" stopOpacity="0.1" />
          <Stop offset="100%" stopColor="#9b61ff" stopOpacity="0" />
        </SvgRadialGradient>
      </Defs>
      <Rect width="360" height="170" fill="url(#settingsHeaderBloom)" />

      {/* Orbital Telemetry Sensor Rings */}
      <Circle cx="280" cy="72" r="48" fill="none" stroke="#3b2b5c" strokeWidth="1" strokeDasharray="5 5" opacity="0.6" />
      <Circle cx="280" cy="72" r="32" fill="none" stroke="#7658dd" strokeWidth="1.25" opacity="0.4" />
      <Circle cx="280" cy="72" r="18" fill="none" stroke="#43e6ae" strokeWidth="1" strokeDasharray="3 3" opacity="0.75" />

      {/* Cybernetic Node Interlinks */}
      <Path d="M 185 45 L 245 72 L 280 72 L 335 38 M 245 72 L 230 132 L 315 125 L 342 90" fill="none" stroke="url(#settingsHeaderLink)" strokeWidth="1.75" strokeDasharray="4 3" opacity="0.7" />
      <Path d="M 280 72 L 315 125" fill="none" stroke="#ff795b" strokeWidth="1.2" opacity="0.4" />

      {/* Telemetry Target Nodes */}
      <Circle cx="185" cy="45" r="4.5" fill="#43e6ae" stroke="#dffff5" strokeWidth="1.5" />
      <Circle cx="245" cy="72" r="4" fill="#9b7cff" stroke="#f4ebff" strokeWidth="1.5" />
      <Circle cx="280" cy="72" r="7" fill="#ff795b" stroke="#fff0ea" strokeWidth="2.5" />
      <Circle cx="335" cy="38" r="4.5" fill="#54b8ff" stroke="#e6f5ff" strokeWidth="1.5" />
      <Circle cx="230" cy="132" r="5" fill="#7658dd" stroke="#ebe2ff" strokeWidth="1.5" />
      <Circle cx="315" cy="125" r="4.5" fill="#ff795b" stroke="#fff1ed" strokeWidth="1.5" />
      <Circle cx="342" cy="90" r="3.5" fill="#43e6ae" stroke="#e6fff7" strokeWidth="1.5" />
    </Svg>
    <View pointerEvents="none" style={pageSceneStyles.sceneRail}><View style={[pageSceneStyles.sceneRailCore, pageSceneStyles.settingsRailCore]} /></View>
  </>;
  return <><LinearGradient pointerEvents="none" colors={['#ff6a4d28', '#9b61ff22', '#05030b00']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} /><View pointerEvents="none" style={styles.pageHeaderRail}><View style={styles.pageHeaderRailCore} /></View></>;
}

function JourneyCinematicHero({ journey }: { journey: JourneyDetail }) {
  const leadTrack = journey.soundtrack[0] ?? journey.soundtrackPreview[0] ?? null;
  return <View style={styles.journeyHeroCard}>
    <View style={styles.journeyHeroMapFrame}>
      <RouteSketch cinematic coordinates={journey.route?.coordinates ?? []} soundtrack={journey.soundtrack} startedAt={journey.startedAt} endedAt={journey.endedAt} startLabel={journey.startingLocation} endLabel={journey.endingLocation} />
      <LinearGradient pointerEvents="none" colors={['rgba(7,5,12,0.05)', 'rgba(7,5,12,0.16)', 'rgba(7,5,12,0.94)'] as const} locations={[0, 0.38, 1]} style={styles.journeyHeroMapShade} />
      <View pointerEvents="none" style={styles.journeyHeroCopy}>
        <Text style={styles.journeyHeroDate}>{formatFullDate(journey.startedAt).toUpperCase()}</Text>
        <Text style={styles.journeyHeroRoute} numberOfLines={2}>{locationPair(journey)}</Text>
      </View>
    </View>
    <View style={styles.journeyHeroMetrics}>
      <JourneyHeroMetric value={formatMiles(journey.miles)} label="DISTANCE" />
      <View style={styles.journeyHeroMetricDivider} />
      <JourneyHeroMetric value={formatDuration(journey.durationMinutes)} label="DRIVE TIME" />
      <View style={styles.journeyHeroMetricDivider} />
      <JourneyHeroMetric value={journey.averageSpeedMph == null ? '—' : `${Math.round(journey.averageSpeedMph)} mph`} label="AVG SPEED" />
    </View>
    <View style={styles.journeyHeroSoundtrack}>
      {leadTrack ? <Artwork track={leadTrack} size={54} /> : <View style={styles.journeyHeroArtworkFallback}><Text style={styles.journeyHeroArtworkNote}>♪</Text></View>}
      <View style={styles.flex}>
        <Text style={styles.journeyHeroSoundtrackLabel}>THE DRIVE'S SOUNDTRACK</Text>
        <Text style={styles.journeyHeroTrack} numberOfLines={1}>{leadTrack?.track ?? (journey.songCount ? `${journey.songCount} songs captured` : 'No songs matched yet')}</Text>
        <Text style={styles.journeyHeroArtist} numberOfLines={1}>{leadTrack?.artist ?? 'Your soundtrack will appear here'}</Text>
      </View>
      <View style={styles.journeyHeroSongCount}><Text style={styles.journeyHeroSongCountValue}>{journey.songCount}</Text><Text style={styles.journeyHeroSongCountLabel}>SONGS</Text></View>
    </View>
  </View>;
}

function JourneyHeroMetric({ value, label }: { value: string; label: string }) {
  return <View style={styles.journeyHeroMetric}><Text style={styles.journeyHeroMetricValue} numberOfLines={1}>{value}</Text><Text style={styles.journeyHeroMetricLabel}>{label}</Text></View>;
}

function SectionHeading({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return <View style={styles.sectionHeading}><View style={styles.sectionTitleGroup}><View style={styles.sectionAccent} /><Text style={styles.sectionTitle}>{title}</Text></View>{action && <Pressable onPress={onAction} disabled={!onAction} style={styles.sectionActionButton}><Text style={[styles.sectionAction, !onAction && styles.sectionActionMuted]}>{action}</Text></Pressable>}</View>;
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
    <Pressable onPress={onPress} style={({ pressed }) => [styles.journeyCardCompact, styles.staticWidgetGlow, pressed && styles.pressed]}>
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
    <Pressable onPress={onPress} style={({ pressed }) => [styles.journeyCard, styles.staticWidgetGlow, pressed && styles.pressed]}>
      <View style={styles.journeyTop}><View><Text style={styles.journeyDate}>{formatFullDate(journey.startedAt)}</Text><Text style={styles.journeyRoute} numberOfLines={2}>{locationPair(journey)}</Text></View><Text style={styles.journeyChevron}>›</Text></View>
      <View style={styles.journeyStats}><Text style={styles.journeyStat}>{formatMiles(journey.miles)}</Text><Text style={styles.journeyStatDot}>•</Text><Text style={styles.journeyStat}>{formatDuration(journey.durationMinutes)}</Text>{journey.vehicleName && <><Text style={styles.journeyStatDot}>•</Text><Text style={styles.journeyStat}>{journey.vehicleName}</Text></>}</View>
      <View style={styles.journeySoundtrack}>{track ? <Artwork track={track} size={42} /> : <View style={styles.miniArtwork}><Text style={styles.miniArtworkText}>♪</Text></View>}<View style={styles.flex}><Text style={styles.journeySong} numberOfLines={1}>{track?.track ?? (journey.songCount ? `${journey.songCount} soundtrack songs` : 'No soundtrack matched')}</Text><Text style={styles.journeyArtist} numberOfLines={1}>{track?.artist ?? 'Music can be added after the journey'}</Text></View>{journey.songCount > 0 && <Text style={styles.songCount}>{journey.songCount}</Text>}</View>
    </Pressable>
  );
}

function Artwork({ track, size }: { track: { artworkUrl?: string | null; track: string }; size: number }) {
  return track.artworkUrl ? <Image source={{ uri: track.artworkUrl }} accessibilityLabel={`${track.track} artwork`} style={{ width: size, height: size, borderRadius: Math.round(size * 0.22), backgroundColor: '#251d31' }} /> : <View style={[styles.artworkFallback, { width: size, height: size, borderRadius: Math.round(size * 0.22) }]}><Text style={[styles.artworkFallbackText, { fontSize: Math.round(size * 0.35) }]}>♪</Text></View>;
}

function TrackRow({ track, index, selected = false, onPress }: { track: { artworkUrl?: string | null; track: string; artist: string }; index: number; selected?: boolean; onPress?: () => void }) {
  return <Pressable accessibilityLabel={`Show ${track.track} on the journey map`} onPress={onPress} style={({ pressed }) => [styles.trackRow, selected && styles.trackRowSelected, pressed && styles.pressed]}><Text style={[styles.trackIndex, selected && styles.trackIndexSelected]}>{String(index).padStart(2, '0')}</Text><Artwork track={track} size={48} /><View style={styles.flex}><Text style={styles.trackTitle} numberOfLines={1}>{track.track}</Text><Text style={styles.trackArtist} numberOfLines={1}>{track.artist}</Text></View><Text style={[styles.trackMapLink, selected && styles.trackMapLinkSelected]}>{selected ? 'ON MAP' : 'MAP'}</Text></Pressable>;
}

function EmptyCard({ title, body }: { title: string; body: string }) {
  return <View style={styles.emptyCard}><View style={styles.emptyCircle}><Text style={styles.emptyCircleText}>J</Text></View><Text style={styles.emptyTitle}>{title}</Text><Text style={styles.emptyBody}>{body}</Text></View>;
}

function InlineNotice({ message, onRetry }: { message: string; onRetry: () => void }) {
  return <View style={styles.inlineNotice}><View style={styles.noticeDot} /><Text style={styles.inlineNoticeText}>{message}</Text><Pressable onPress={onRetry}><Text style={styles.retryText}>Retry</Text></Pressable></View>;
}

function LoadingLine({ label }: { label: string }) { return <View style={styles.loadingLine}><ActivityIndicator color="#9b7cff" /><Text style={styles.loadingLineText}>{label}</Text></View>; }
function LoadingCard() { return <View style={styles.loadingCard}><ActivityIndicator color="#9b7cff" size="large" /><Text style={styles.loadingLineText}>Loading your journeys…</Text></View>; }

function RouteSketch({ coordinates, soundtrack, startedAt, endedAt, startLabel, endLabel, cinematic = false, expanded = false }: { coordinates: [number, number][]; soundtrack: JourneyDetail['soundtrack']; startedAt: string; endedAt: string; startLabel: string | null; endLabel: string | null; cinematic?: boolean; expanded?: boolean }) {
  const { width: screenWidth } = useWindowDimensions();
  const plotWidth = Math.max(240, Math.min(480, screenWidth - 72)), plotHeight = 142;
  const valid = coordinates.filter(([longitude, latitude]) => Number.isFinite(longitude) && Number.isFinite(latitude));
  // Preserve enough of a recorded drive to follow its actual turns without asking
  // the native SVG view to draw every background GPS reading.
  const step = Math.max(1, Math.ceil(valid.length / 96));
  const sampled = valid.filter((_, index) => index % step === 0 || index === valid.length - 1);
  const songMoments = buildSongRouteMoments(soundtrack, valid, startedAt, endedAt);
  const longitudes = sampled.map(point => point[0]), latitudes = sampled.map(point => point[1]);
  const minLongitude = Math.min(...longitudes), maxLongitude = Math.max(...longitudes);
  const minLatitude = Math.min(...latitudes), maxLatitude = Math.max(...latitudes);
  const longitudeSpan = Math.max(0.00001, maxLongitude - minLongitude), latitudeSpan = Math.max(0.00001, maxLatitude - minLatitude);
  const points = sampled.map(([longitude, latitude]) => ({
    x: 18 + ((longitude - minLongitude) / longitudeSpan) * (plotWidth - 36),
    y: 18 + (1 - (latitude - minLatitude) / latitudeSpan) * (plotHeight - 36),
  }));
  const tileSize = 256, snapshotSize = tileSize * 3;
  const mercatorPoint = ([longitude, latitude]: [number, number], zoom: number) => {
    const scale = tileSize * (2 ** zoom), clippedLatitude = Math.max(-85.05112878, Math.min(85.05112878, latitude));
    return { x: ((longitude + 180) / 360) * scale, y: (1 - Math.asinh(Math.tan(clippedLatitude * Math.PI / 180)) / Math.PI) * scale / 2 };
  };
  let snapshotZoom = 3;
  for (let zoom = 16; zoom >= 3; zoom -= 1) {
    const candidate = valid.map(point => mercatorPoint(point, zoom)), xs = candidate.map(point => point.x), ys = candidate.map(point => point.y);
    if (Math.max(...xs) - Math.min(...xs) < snapshotSize * 0.64 && Math.max(...ys) - Math.min(...ys) < snapshotSize * 0.58) { snapshotZoom = zoom; break; }
  }
  const worldPoints = sampled.map(point => mercatorPoint(point, snapshotZoom));
  const centerX = worldPoints.length ? (Math.min(...worldPoints.map(point => point.x)) + Math.max(...worldPoints.map(point => point.x))) / 2 : 0;
  const centerY = worldPoints.length ? (Math.min(...worldPoints.map(point => point.y)) + Math.max(...worldPoints.map(point => point.y))) / 2 : 0;
  const tileOriginX = Math.floor(centerX / tileSize) - 1, tileOriginY = Math.floor(centerY / tileSize) - 1, tileCount = 2 ** snapshotZoom;
  const mapPolyline = worldPoints.map(point => `${point.x - tileOriginX * tileSize},${point.y - tileOriginY * tileSize}`).join(' ');
  const fallbackSongPoints = songMoments.map(moment => {
    const point = mercatorPoint(moment.coordinate, snapshotZoom);
    return { ...moment, x: point.x - tileOriginX * tileSize, y: point.y - tileOriginY * tileSize };
  });
  const snapshotTiles = Array.from({ length: 9 }, (_, index) => {
    const column = index % 3, row = Math.floor(index / 3), x = ((tileOriginX + column) % tileCount + tileCount) % tileCount, y = tileOriginY + row;
    return { key: `${snapshotZoom}-${x}-${y}`, uri: `https://tile.openstreetmap.org/${snapshotZoom}/${x}/${y}.png`, column, row, valid: y >= 0 && y < tileCount };
  }).filter(tile => tile.valid);
  const polyline = points.map(point => `${point.x},${point.y}`).join(' ');
  const start = points[0], end = points.at(-1);
  return <View style={[styles.routeSketch, cinematic && styles.routeSketchHero, expanded && styles.routeSketchExpanded]}>
    <LinearGradient colors={['#211233', '#101525', '#0a0a13'] as const} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
    <View style={routeVisualStyles.routeGridOne} /><View style={routeVisualStyles.routeGridTwo} /><View style={routeVisualStyles.routeGlow} /><View style={routeVisualStyles.routeAurora} />
    {points.length > 1 ? <Reanimated.View entering={FadeIn.duration(420)} style={routeVisualStyles.routeSnapshot}>
      {snapshotTiles.map(tile => <ExpoImage key={tile.key} source={tile.uri} cachePolicy="memory-disk" contentFit="cover" transition={0} style={[routeVisualStyles.routeTile, { left: `${tile.column * 33.333}%`, top: `${tile.row * 33.333}%` }]} />)}
      <View pointerEvents="none" style={routeVisualStyles.routeTileShade} />
      <View pointerEvents="none" style={routeVisualStyles.routeCanvas}><Svg width="100%" height="100%" viewBox={`0 0 ${snapshotSize} ${snapshotSize}`}>
        <Defs><SvgLinearGradient id="journeyRoute" x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor="#45efc0" /><Stop offset="0.5" stopColor="#a681ff" /><Stop offset="1" stopColor="#ff765c" /></SvgLinearGradient></Defs>
        <Polyline points={mapPolyline || polyline} fill="none" stroke="#8e6dff" strokeWidth="18" strokeLinecap="round" strokeLinejoin="round" opacity="0.38" />
        <Polyline points={mapPolyline || polyline} fill="none" stroke="url(#journeyRoute)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
        {worldPoints[0] && <><Circle cx={worldPoints[0].x - tileOriginX * tileSize} cy={worldPoints[0].y - tileOriginY * tileSize} r="12" fill="#43e6ae" opacity="0.28" /><Circle cx={worldPoints[0].x - tileOriginX * tileSize} cy={worldPoints[0].y - tileOriginY * tileSize} r="6" fill="#43e6ae" stroke="#d9fff1" strokeWidth="2" /></>}
        {worldPoints.at(-1) && <><Circle cx={worldPoints.at(-1)!.x - tileOriginX * tileSize} cy={worldPoints.at(-1)!.y - tileOriginY * tileSize} r="15" fill="#ff795b" opacity="0.3" /><Circle cx={worldPoints.at(-1)!.x - tileOriginX * tileSize} cy={worldPoints.at(-1)!.y - tileOriginY * tileSize} r="7" fill="#ff795b" stroke="#fff0e8" strokeWidth="2" /></>}
        {fallbackSongPoints.map((moment, index) => <Circle key={`${moment.playedAt}-${index}`} cx={moment.x} cy={moment.y} r="8" fill="#ff69b4" stroke="#fff1fa" strokeWidth="3" />)}
      </Svg></View>
    </Reanimated.View> : <View style={routeVisualStyles.routeAwaiting}><Text style={routeVisualStyles.routeAwaitingSymbol}>⌁</Text><Text style={routeVisualStyles.routeAwaitingText}>Route will appear after the journey syncs</Text></View>}
    {!cinematic && <><View style={routeVisualStyles.routeLegend}><View style={routeVisualStyles.routeLegendItem}><View style={[routeVisualStyles.routeLegendDot, routeVisualStyles.routeLegendStart]} /><Text style={routeVisualStyles.routeLegendText} numberOfLines={1}>{startLabel}</Text></View><View style={routeVisualStyles.routeLegendItem}><View style={[routeVisualStyles.routeLegendDot, routeVisualStyles.routeLegendEnd]} /><Text style={routeVisualStyles.routeLegendText} numberOfLines={1}>{endLabel}</Text></View></View>
    <Text pointerEvents="none" style={styles.routeCaption}>{points.length > 1 ? `${valid.length} GPS points · ${songMoments.length} song markers · OpenFreeMap / © OpenStreetMap` : 'OFFLINE-SAFE ROUTE PREVIEW'}</Text></>}
  </View>;
}

function InfoRow({ label, value }: { label: string; value: string }) { return <View style={styles.infoRow}><Text style={styles.infoLabel}>{label}</Text><Text style={styles.infoValue}>{value}</Text></View>; }

function TessieMark({ size }: { size: number }) {
  const radius = size * 0.3;
  return <LinearGradient colors={['#16364d', '#15203e', '#28163c']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: size, height: size, borderRadius: radius, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#79dcff88', shadowColor: '#65c9ff', shadowOpacity: 0.45, shadowRadius: size * 0.22, shadowOffset: { width: 0, height: size * 0.08 } }}>
    <View pointerEvents="none" style={{ position: 'absolute', width: size * 0.62, height: size * 0.62, borderRadius: size * 0.31, backgroundColor: '#5cd9ff18' }} />
    <Image source={tessieBrandImages.white} resizeMode="contain" style={{ width: size * 0.72, height: size * 0.72 }} />
  </LinearGradient>;
}

function ConnectionTile({ name, detail, symbol, brand, mark, color, status, action, onPress }: { name: string; detail: string; symbol: string; brand?: ProviderBrand; mark?: ReactNode; color: string; status: string; action: string; onPress: () => void }) {
  return <Pressable onPress={onPress} style={({ pressed }) => [styles.connectionTile, styles.staticWidgetGlow, pressed && styles.pressed]}><View pointerEvents="none" style={[styles.connectionEdge, { backgroundColor: color }]} />{mark ?? (brand ? <ProviderMark brand={brand} size={46} /> : <View style={[styles.connectionIcon, { backgroundColor: color, shadowColor: color }]}><Text style={styles.connectionIconText}>{symbol}</Text></View>)}<View style={styles.flex}><Text style={styles.connectionName}>{name}</Text><Text style={styles.connectionDetail}>{detail}</Text><Text style={[styles.connectionStatus, status === 'Connected' || status === 'Enabled' || status.startsWith('Connected through') ? styles.goodStatus : undefined]}>{status}</Text></View><View style={styles.connectionAction}><Text style={styles.connectionActionText}>{action}</Text></View></Pressable>;
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

const routeVisualStyles = StyleSheet.create({
  routeGridOne: { position: 'absolute', left: 0, right: 0, top: '35%', height: 1, backgroundColor: 'rgba(172,132,255,0.12)' },
  routeGridTwo: { position: 'absolute', left: 0, right: 0, top: '65%', height: 1, backgroundColor: 'rgba(255,135,100,0.1)' },
  routeGlow: { position: 'absolute', left: '20%', right: '20%', top: '25%', bottom: '25%', backgroundColor: '#45265f', opacity: 0.25, borderRadius: 30 },
  routeAurora: { position: 'absolute', left: 20, right: 20, height: 2, top: '49%', backgroundColor: '#b98eff', opacity: 0.2, shadowColor: '#b98eff', shadowOpacity: 0.8, shadowRadius: 10 },
  routeSnapshot: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, overflow: 'hidden' },
  routeTile: { position: 'absolute', width: '33.334%', height: '33.334%', opacity: 0.72 },
  routeTileShade: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(13,7,21,0.44)' },
  routeCanvas: { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 },
  routeAwaiting: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', gap: 7 },
  routeAwaitingSymbol: { color: '#b795ff', fontSize: 29, fontWeight: '900' },
  routeAwaitingText: { color: '#91879a', fontSize: 11, fontWeight: '700' },
  routeLegend: { position: 'absolute', left: 13, right: 13, top: 12, flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  routeLegendItem: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 6 },
  routeLegendDot: { width: 7, height: 7, borderRadius: 4, shadowOpacity: 0.9, shadowRadius: 7 },
  routeLegendStart: { backgroundColor: '#43e6ae', shadowColor: '#43e6ae' },
  routeLegendEnd: { backgroundColor: '#ff795b', shadowColor: '#ff795b' },
  routeLegendText: { flex: 1, color: '#ded3e5', fontSize: 9, fontWeight: '800' },
});

const pageSceneStyles = StyleSheet.create({
  memoryHeader: { minHeight: 166, borderColor: '#583a75', backgroundColor: '#0b0915', shadowColor: '#b16eff', shadowOpacity: 0.32, shadowRadius: 22 },
  settingsHeader: { minHeight: 166, borderColor: '#4b3b73', backgroundColor: '#0e0b17', shadowColor: '#8564ff', shadowOpacity: 0.3, shadowRadius: 22 },
  sceneCanvas: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  sceneEyebrow: { color: '#ffc0a9', maxWidth: 235 },
  sceneTitle: { fontSize: 35, textShadowColor: '#c57fff', textShadowRadius: 12 },
  sceneBody: { color: '#d0c4d7', maxWidth: 238 },
  sceneRail: { position: 'absolute', left: 18, top: 13, width: 58, height: 3, borderRadius: 3, backgroundColor: 'rgba(158, 109, 225, 0.32)', overflow: 'hidden' },
  sceneRailCore: { width: '70%', height: '100%', borderRadius: 3, backgroundColor: '#ff795b', shadowColor: '#ff795b', shadowOpacity: 1, shadowRadius: 8 },
  settingsRailCore: { backgroundColor: '#6fe8c2', shadowColor: '#6fe8c2' },
});

const styles = StyleSheet.create({
  staticWidgetGlow: { borderColor: '#684184', shadowColor: '#a85cff', shadowOpacity: 0.28, shadowRadius: 16, shadowOffset: { width: 0, height: 7 } },
  atmosphere: { position: 'absolute', top: -40, left: -20, right: -20, height: 1420 },
  app: { flex: 1, backgroundColor: '#08070d' }, screenBody: { flex: 1, overflow: 'hidden' }, pager: { flex: 1, backgroundColor: '#08070d' }, tabLayer: { flex: 1, backgroundColor: '#08070d' }, flex: { flex: 1 }, safe: { flex: 1, backgroundColor: '#08070d' },
  loadingScreen: { flex: 1, backgroundColor: '#08070d', alignItems: 'center', justifyContent: 'center', gap: 14 }, loadingText: { color: '#b8afc5', fontSize: 14 },
  pageContent: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 128, gap: 16 },
  webDashboardPage: { paddingHorizontal: 6, paddingTop: 6, paddingBottom: 116, gap: 8 },
  webDashboardShell: { gap: 8, padding: 8, borderRadius: 30, borderWidth: 1, borderColor: '#56357a', backgroundColor: '#05040e', shadowColor: '#9d58ff', shadowOpacity: 0.28, shadowRadius: 28, shadowOffset: { width: 0, height: 9 }, overflow: 'hidden' },
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
  webMusicCard: { minHeight: 124, flexDirection: 'row', alignItems: 'center', gap: 13, padding: 13, overflow: 'hidden', borderRadius: 18, borderWidth: 1, borderColor: '#8247a8', backgroundColor: '#100920', shadowColor: '#c34cff', shadowOpacity: 0.34, shadowRadius: 17, shadowOffset: { width: 0, height: 7 } }, webMusicGlow: { position: 'absolute', width: 330, height: 72, right: -100, bottom: -8, backgroundColor: '#7d2fca', opacity: 0.2, transform: [{ rotate: '-14deg' }], shadowColor: '#c34cff', shadowOpacity: 0.75, shadowRadius: 32 }, webEmptyAlbum: { width: 92, height: 92, borderRadius: 12, padding: 9, justifyContent: 'space-between', backgroundColor: '#38133e', borderWidth: 1, borderColor: '#a04b79', shadowColor: '#ff526c', shadowOpacity: 0.55, shadowRadius: 14 }, webEmptyAlbumWord: { color: '#ff8a79', fontSize: 8, lineHeight: 9, fontWeight: '900' }, webEmptyAlbumNote: { color: '#f0b7ff', fontSize: 33, fontWeight: '900', alignSelf: 'center' },
  webTrackCopy: { flex: 1, minWidth: 0 }, webCardKicker: { color: '#ff5f67', fontSize: 8, fontWeight: '900', letterSpacing: 1.1 }, webTrackTitle: { color: '#f8f3fb', fontSize: 19, lineHeight: 22, fontWeight: '800', marginTop: 3 }, webTrackArtist: { color: '#a15df1', fontSize: 12, fontWeight: '700', marginTop: 2 }, webWaveform: { height: 40, flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 5, overflow: 'hidden' }, webWaveBar: { flex: 1, maxWidth: 3, borderRadius: 2, backgroundColor: '#d34cf3', shadowColor: '#ff4e70', shadowOpacity: 0.8, shadowRadius: 4 }, webTrackTime: { flexDirection: 'row', justifyContent: 'space-between' }, webTrackTimeText: { color: '#8b8196', fontSize: 6, fontWeight: '800', letterSpacing: 0.6 },
  webDrivingCard: { height: 174, overflow: 'hidden', borderRadius: 18, borderWidth: 1, borderColor: '#784397', backgroundColor: '#0e0a1c', padding: 14, shadowColor: '#ff4c82', shadowOpacity: 0.27, shadowRadius: 17, shadowOffset: { width: 0, height: 7 } }, webDrivingGlow: { position: 'absolute', width: 350, height: 78, left: -135, bottom: -20, backgroundColor: '#ff3b6c', opacity: 0.18, transform: [{ rotate: '13deg' }], shadowColor: '#ff3b6c', shadowOpacity: 0.75, shadowRadius: 30 }, webDrivingHeading: { position: 'absolute', left: 14, top: 13 }, webDrivingValue: { color: '#fff8ff', fontSize: 36, lineHeight: 42, fontWeight: '900', letterSpacing: -1.4, textShadowColor: '#ff4c8255', textShadowRadius: 8 }, webDrivingUnit: { color: '#b8b0c1', fontSize: 14, fontWeight: '700' }, webDrivingFacts: { position: 'absolute', left: '53%', top: 18, flexDirection: 'row', gap: 22 }, webFactValue: { color: '#f4eff7', fontSize: 14, fontWeight: '900' }, webFactLabel: { color: '#80788b', fontSize: 8, marginTop: 2 },
  webHourlyChart: { position: 'absolute', left: 14, right: 77, bottom: 28, height: 58, flexDirection: 'row', alignItems: 'flex-end', gap: 3, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#393049' }, webHourlyBar: { flex: 1, minHeight: 3, borderTopLeftRadius: 2, borderTopRightRadius: 2, backgroundColor: '#d74483', shadowColor: '#ff4b72', shadowOpacity: 0.5, shadowRadius: 4 }, webChartAxis: { position: 'absolute', left: 14, right: 76, bottom: 11, flexDirection: 'row', justifyContent: 'space-between' }, webChartAxisText: { color: '#6f6779', fontSize: 5.5, fontWeight: '700' },
  webScoreRing: { position: 'absolute', right: 10, bottom: 24, width: 60, height: 60, borderRadius: 30, padding: 5, borderWidth: 5, borderColor: '#ff694f', shadowColor: '#ff694f', shadowOpacity: 0.4, shadowRadius: 8 }, webScoreRingInner: { flex: 1, borderRadius: 25, backgroundColor: '#160e21', alignItems: 'center', justifyContent: 'center' }, webScoreIcon: { color: '#ff7a58', fontSize: 10, fontWeight: '900' }, webScoreValue: { color: '#a25cff', fontSize: 14, fontWeight: '900' }, webScoreLabel: { color: '#777081', fontSize: 5, fontWeight: '900', letterSpacing: 0.8 },
  webRecorderStrip: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 13, borderRadius: 16, borderWidth: 1, borderColor: '#674381', backgroundColor: '#0d0a18', shadowColor: '#9b61ff', shadowOpacity: 0.28, shadowRadius: 14, shadowOffset: { width: 0, height: 6 } }, webRecorderBeacon: { width: 30, height: 30, borderRadius: 15, borderWidth: 1, alignItems: 'center', justifyContent: 'center', shadowColor: '#9b7cff', shadowOpacity: 0.85, shadowRadius: 10 }, webRecorderBeaconCore: { width: 9, height: 9, borderRadius: 5 }, webRecorderTitle: { color: '#eee8f4', fontSize: 12, fontWeight: '900' }, webRecorderDetail: { color: '#847b8e', fontSize: 9, lineHeight: 13, marginTop: 3 }, webRecorderChevron: { color: '#8f72b5', fontSize: 28, lineHeight: 30 },
  webActions: { height: 118, flexDirection: 'row', gap: 8 }, webAction: { flex: 1, minWidth: 0, overflow: 'hidden', borderRadius: 19, borderWidth: 1, paddingHorizontal: 9, paddingTop: 11, paddingBottom: 11, alignItems: 'center', backgroundColor: '#120a1b', shadowOpacity: 0.58, shadowRadius: 22, shadowOffset: { width: 0, height: 8 } }, webActionIcon: { width: 42, height: 42, borderRadius: 21, borderWidth: 1.25, alignItems: 'center', justifyContent: 'center', backgroundColor: '#07040d42', shadowOpacity: 0.9, shadowRadius: 14 }, webActionSymbol: { width: 25, height: 25 }, webActionSpacer: { flex: 1, minHeight: 5 }, webActionTitle: { color: '#fff', fontSize: 12, lineHeight: 15, fontWeight: '900', textAlign: 'center', textShadowColor: '#000', textShadowRadius: 5 }, webActionDetail: { color: '#c1b7c8', fontSize: 8, lineHeight: 11, marginTop: 3, textAlign: 'center' },
  homeSummaryHeading: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 5, marginTop: 5 }, homeSummarySubtitle: { color: '#8b8093', fontSize: 9, marginTop: 4 }, homeLocalPill: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, borderWidth: 1, borderColor: '#27624e', backgroundColor: '#10271f', paddingHorizontal: 8, paddingVertical: 5 }, homeLocalDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#49e5b1', shadowColor: '#49e5b1', shadowOpacity: 1, shadowRadius: 6 }, homeLocalText: { color: '#66ecc0', fontSize: 7, fontWeight: '900', letterSpacing: 1 },
  homeArchiveGrid: { flexDirection: 'row', gap: 7 }, homeArchiveTile: { flex: 1, minWidth: 0, minHeight: 82, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', borderRadius: 17, borderWidth: 1, backgroundColor: '#0f0a16', shadowOpacity: 0.22, shadowRadius: 10 }, homeArchiveGlow: { position: 'absolute', width: 70, height: 70, borderRadius: 35, top: -38 }, homeArchiveValue: { fontSize: 20, fontWeight: '900', fontVariant: ['tabular-nums'] }, homeArchiveLabel: { color: '#9b8fa3', fontSize: 8, fontWeight: '800', marginTop: 5 },
  homeSpotlightGrid: { flexDirection: 'row', gap: 8 }, homeSpotlight: { flex: 1, minHeight: 165, overflow: 'hidden', borderRadius: 21, borderWidth: 1, padding: 14, justifyContent: 'flex-end', shadowOpacity: 0.3, shadowRadius: 16, shadowOffset: { width: 0, height: 7 } }, homeMemorySpotlight: { borderColor: '#6c3f88', shadowColor: '#a55cff' }, homeMusicSpotlight: { borderColor: '#793148', shadowColor: '#ff4e82' }, homeSpotlightKicker: { color: '#c091ff', fontSize: 7.5, fontWeight: '900', letterSpacing: 1.15 }, homeSpotlightTitle: { color: '#fff7ff', fontSize: 17, lineHeight: 20, fontWeight: '900', marginTop: 7 }, homeSpotlightMeta: { color: '#a99cab', fontSize: 9, lineHeight: 14, marginTop: 6 }, homeSpotlightAction: { color: '#cf9dff', fontSize: 9, fontWeight: '900', marginTop: 10 },
  homePatternCard: { minHeight: 94, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 20, borderWidth: 1, borderColor: '#704253', backgroundColor: '#140b17', padding: 14, shadowColor: '#ff7257', shadowOpacity: 0.18, shadowRadius: 14 }, homePatternIcon: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#2b1520', borderWidth: 1, borderColor: '#7f463f' }, homePatternSymbol: { width: 27, height: 27 }, homePatternTitle: { color: '#f8eff7', fontSize: 14, fontWeight: '900', marginTop: 5 },
  homeIntelligenceCard: { borderRadius: 21, borderWidth: 1, borderColor: '#3d476d', backgroundColor: '#0c0d19', padding: 14, shadowColor: '#5e79ff', shadowOpacity: 0.16, shadowRadius: 14 }, homeIntelligenceHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }, homeIntelligenceTitle: { color: '#f1ecf5', fontSize: 15, fontWeight: '900', marginTop: 4 }, homeIntelligenceMetrics: { flexDirection: 'row', marginTop: 15 }, homeIntelligenceMetric: { flex: 1, minWidth: 0, alignItems: 'center', paddingHorizontal: 5, borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: '#353449' }, homeIntelligenceValue: { color: '#f8f2fb', fontSize: 19, fontWeight: '900', fontVariant: ['tabular-nums'] }, homeIntelligenceLabel: { color: '#7da0ff', fontSize: 7, fontWeight: '900', letterSpacing: 0.8, marginTop: 5 }, homeIntelligenceDetail: { color: '#777483', fontSize: 7, marginTop: 4 },
  homeExploreCard: { borderRadius: 21, borderWidth: 1, borderColor: '#3b2a48', backgroundColor: '#0e0914', padding: 10 }, homeExploreGrid: { gap: 6 }, homeExploreAction: { minHeight: 62, flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 8, borderRadius: 15, backgroundColor: '#15101c', borderWidth: 1, borderColor: '#2d2435' }, homeExploreIcon: { width: 38, height: 38, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' }, homeExploreSymbol: { width: 22, height: 22 }, homeExploreTitle: { color: '#eee8f1', fontSize: 12, fontWeight: '900' }, homeExploreDetail: { color: '#83798b', fontSize: 8.5, marginTop: 3 },
  webBottomGrid: { minHeight: 226, flexDirection: 'row', gap: 7 }, webJourneysPanel: { flex: 1.45, overflow: 'hidden', borderRadius: 19, borderWidth: 1, borderColor: '#774a94', backgroundColor: '#0c0918', shadowColor: '#a45cff', shadowOpacity: 0.34, shadowRadius: 17, shadowOffset: { width: 0, height: 7 } }, webHealthPanel: { flex: 1, overflow: 'hidden', borderRadius: 19, borderWidth: 1, borderColor: '#4d6995', backgroundColor: '#0b0a1a', shadowColor: '#28b9ff', shadowOpacity: 0.3, shadowRadius: 17, shadowOffset: { width: 0, height: 7 } }, webPanelHeader: { minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 11 }, webPanelTitle: { color: '#ff5969', fontSize: 8.5, fontWeight: '900', letterSpacing: 1, textShadowColor: '#ff596988', textShadowRadius: 7 }, webPanelAction: { color: '#aaa0b2', fontSize: 8, fontWeight: '800' }, webPanelEmpty: { color: '#918698', fontSize: 10, lineHeight: 15, padding: 12 },
  webJourneyRow: { minHeight: 91, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 9, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#493052' }, webPlaceIcon: { width: 31, height: 31, borderRadius: 16, backgroundColor: '#541d3a', alignItems: 'center', justifyContent: 'center', shadowColor: '#ff4f78', shadowOpacity: 0.38, shadowRadius: 9 }, webJourneyOrigin: { color: '#b0a4b7', fontSize: 9, lineHeight: 12, fontWeight: '600' }, webJourneyDestination: { color: '#fff8ff', fontSize: 12, lineHeight: 15, fontWeight: '900', marginTop: 3 }, webJourneyMeta: { color: '#9a8fa1', fontSize: 8.5, lineHeight: 11, marginTop: 3 }, webRouteThumb: { width: 48, height: 38, borderRadius: 7, backgroundColor: '#0a0a1c', borderWidth: 1, borderColor: '#55376c', overflow: 'hidden', shadowColor: '#a85cff', shadowOpacity: 0.3, shadowRadius: 8 }, webRouteThumbLine: { position: 'absolute', width: 44, height: 2, borderRadius: 1, backgroundColor: '#ff694f', left: 2, top: 19, transform: [{ rotate: '-18deg' }], shadowColor: '#ff4e60', shadowOpacity: 1, shadowRadius: 5 }, webRouteThumbStart: { position: 'absolute', width: 6, height: 6, borderRadius: 3, backgroundColor: '#9746f5', left: 3, top: 23 }, webRouteThumbEnd: { position: 'absolute', width: 6, height: 6, borderRadius: 3, backgroundColor: '#ffc2af', right: 2, top: 10 },
  webCompactHealth: { flex: 1, minHeight: 59, flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#293a59' }, webServiceIcon: { width: 29, height: 29, borderRadius: 15, alignItems: 'center', justifyContent: 'center', shadowColor: '#28b9ff', shadowOpacity: 0.4, shadowRadius: 8 }, webServiceIconText: { color: '#edf8ff', fontSize: 10, fontWeight: '900' }, webServiceName: { color: '#f7f1fa', fontSize: 10, lineHeight: 13, fontWeight: '900' }, webServiceDetail: { color: '#a298aa', fontSize: 8.5, lineHeight: 11, marginTop: 2 }, webHealthCheck: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', shadowColor: '#28b9ff', shadowOpacity: 0.45, shadowRadius: 7 }, webHealthCheckText: { color: '#0d0920', fontSize: 9, fontWeight: '900' },
  webWeekCard: { minHeight: 225, borderRadius: 18, borderWidth: 1, borderColor: '#51336a77', backgroundColor: '#0c0918', padding: 13 }, webWeekSubtitle: { color: '#f0eaf5', fontSize: 14, fontWeight: '900', marginTop: 4 }, webWeekChart: { height: 96, flexDirection: 'row', alignItems: 'flex-end', gap: 10, marginTop: 10 }, webWeekColumn: { flex: 1, height: '100%', alignItems: 'center', gap: 5 }, webWeekTrack: { width: 15, flex: 1, borderRadius: 8, backgroundColor: '#171221', overflow: 'hidden', justifyContent: 'flex-end' }, webWeekBar: { width: '100%', minHeight: 5, borderRadius: 8, backgroundColor: '#8554e6', shadowColor: '#9d63ff', shadowOpacity: 0.8, shadowRadius: 6 }, webWeekDay: { color: '#6d6475', fontSize: 7, fontWeight: '900' }, webWeekStats: { minHeight: 47, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#392943' }, webWeekStatValue: { color: '#f8f2fb', fontSize: 13, fontWeight: '900' }, webWeekStatLabel: { color: '#756c7e', fontSize: 5.5, fontWeight: '900', letterSpacing: 0.7, marginTop: 3 },
  webAllTimeRail: { minHeight: 84, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 13, borderRadius: 17, borderWidth: 1, borderColor: '#4c305f66', backgroundColor: '#100a1c' }, webAllTimeKicker: { color: '#ff6b67', fontSize: 7, fontWeight: '900', letterSpacing: 1 }, webAllTimeTitle: { color: '#f4eef8', fontSize: 15, fontWeight: '900', marginTop: 4 }, webAllTimeMetric: { flex: 1, alignItems: 'flex-end' }, webAllTimeMetricValue: { color: '#f7f1fb', fontSize: 13, fontWeight: '900' }, webAllTimeMetricLabel: { color: '#716878', fontSize: 5.5, fontWeight: '900', letterSpacing: 0.6, marginTop: 3 }, webQueueNote: { color: '#ffbb73', fontSize: 9, textAlign: 'center', padding: 8 },
  memoriesPage: { paddingTop: 24, paddingBottom: 128, gap: 16 },
  overlayRoot: { flex: 1, justifyContent: 'flex-end', backgroundColor: '#030106cc' }, overlaySheet: { maxHeight: '94%', margin: 8, overflow: 'hidden', borderRadius: 28, borderWidth: 1, borderColor: '#5d4273', backgroundColor: '#0a0710', shadowColor: '#000', shadowOpacity: 0.85, shadowRadius: 30, shadowOffset: { width: 0, height: -8 } }, overlayHeader: { minHeight: 74, flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 18, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#382641' }, overlayKicker: { color: '#ff795b', fontSize: 8, fontWeight: '900', letterSpacing: 1.5 }, overlayTitle: { color: '#f7f1fa', fontSize: 21, fontWeight: '900', marginTop: 3 }, overlayClose: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#4b3758', backgroundColor: '#17101f' }, overlayCloseText: { color: '#d7c9df', fontSize: 27, lineHeight: 29 }, overlayContent: { padding: 16, paddingBottom: 26, gap: 14 },
  overviewHero: { height: 260, overflow: 'hidden', borderRadius: 22, borderWidth: 1, borderColor: '#593c70', backgroundColor: '#171021' }, overviewCollectionHero: { height: 230, overflow: 'hidden', borderRadius: 22, borderWidth: 1, borderColor: '#593c70', backgroundColor: '#171021' }, overviewCollectionImage: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }, overviewCollectionFallback: { backgroundColor: '#241433' }, overviewHeroCopy: { position: 'absolute', left: 20, right: 20, bottom: 19 }, overviewEyebrow: { color: '#ff9a79', fontSize: 8, fontWeight: '900', letterSpacing: 1.4 }, overviewHeroTitle: { color: '#fff8ff', fontSize: 29, lineHeight: 33, fontWeight: '900', letterSpacing: -0.7, marginTop: 6 }, overviewMetrics: { flexDirection: 'row', overflow: 'hidden', borderRadius: 17, borderWidth: 1, borderColor: '#352b40', backgroundColor: '#111018' }, overviewMetric: { flex: 1, minHeight: 70, alignItems: 'center', justifyContent: 'center', borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: '#342b3d' }, overviewMetricValue: { color: '#f7f2fb', fontSize: 19, fontWeight: '900' }, overviewMetricLabel: { color: '#81758b', fontSize: 7, fontWeight: '900', letterSpacing: 1, marginTop: 5 }, overviewBody: { color: '#c7bdce', fontSize: 13, lineHeight: 20 }, overviewBodyMuted: { color: '#857d8d', fontSize: 12, lineHeight: 18, fontStyle: 'italic' }, overviewSectionLabel: { color: '#a88aff', fontSize: 8, fontWeight: '900', letterSpacing: 1.4, marginTop: 3 }, overviewListRow: { minHeight: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingHorizontal: 13, borderRadius: 14, borderWidth: 1, borderColor: '#30283a', backgroundColor: '#111018' }, overviewListTitle: { color: '#eee8f3', fontSize: 13, fontWeight: '800' }, overviewListMeta: { color: '#8c8295', fontSize: 10, marginTop: 3 }, overviewChevron: { color: '#a88aff', fontSize: 24 }, overviewActions: { flexDirection: 'row', gap: 9, marginTop: 4 }, overviewShare: { flex: 1, minHeight: 50, alignItems: 'center', justifyContent: 'center', borderRadius: 15, borderWidth: 1, borderColor: '#65468a', backgroundColor: '#20152e' }, overviewShareText: { color: '#c2a7ff', fontSize: 12, fontWeight: '900' }, overviewPrimary: { flex: 1.25, minHeight: 50, alignItems: 'center', justifyContent: 'center', borderRadius: 15, backgroundColor: '#ff795b' }, overviewPrimaryText: { color: '#1b0b07', fontSize: 12, fontWeight: '900' }, modalEditorBody: { gap: 12 }, journeyActions: { flexDirection: 'row', gap: 9, marginTop: 6 }, journeyShareButton: { flex: 1, minHeight: 54, alignItems: 'center', justifyContent: 'center', borderRadius: 16, borderWidth: 1, borderColor: '#65468a', backgroundColor: '#20152e' }, journeyShareButtonText: { color: '#c7adff', fontSize: 12, fontWeight: '900', textAlign: 'center' }, journeyEditButton: { flex: 1, minHeight: 54, alignItems: 'center', justifyContent: 'center', borderRadius: 16, backgroundColor: '#ff795b' }, journeyEditButtonText: { color: '#1b0b07', fontSize: 12, fontWeight: '900' },
  locationEditor: { gap: 11, marginTop: 6, padding: 14, borderRadius: 18, borderWidth: 1, borderColor: '#4e3b60', backgroundColor: '#100d16' }, locationEditorKicker: { color: '#b99cff', fontSize: 9, fontWeight: '900', letterSpacing: 1.4 }, locationEditorHelp: { color: '#9b91a4', fontSize: 11, lineHeight: 17 }, locationField: { gap: 5 }, locationFieldLabel: { color: '#ff9a79', fontSize: 8, fontWeight: '900', letterSpacing: 1.2 }, locationRaw: { color: '#6f6877', fontSize: 9, lineHeight: 13, paddingHorizontal: 3 },
  memoryPageHeader: { marginHorizontal: 16, marginBottom: 6 },
  memoryHeroCardHeader: { width: '100%', aspectRatio: 673 / 331, borderRadius: 24, overflow: 'hidden', backgroundColor: '#07040d', shadowColor: '#9b61ff', shadowOpacity: 0.45, shadowRadius: 24, shadowOffset: { width: 0, height: 8 } },
  memoryHeroHeaderImage: { width: '100%', height: '100%' },
  memorySectionHeader: { marginHorizontal: 20, marginTop: 5, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }, memoryLevel: { color: '#a88aff', fontSize: 9, fontWeight: '900', letterSpacing: 1.8 }, memorySectionTitle: { color: '#f5f0fb', fontSize: 19, fontWeight: '900', marginTop: 4 }, memoryHeaderActions: { flexDirection: 'row', alignItems: 'center', gap: 12 }, memoryHeaderAction: { color: '#ff8767', fontSize: 11, fontWeight: '900' },
  memoryCarouselContent: { paddingHorizontal: 20, paddingBottom: 12, gap: 14 }, memoryHeroCard: { height: 244, borderRadius: 26, overflow: 'hidden', backgroundColor: '#14101e', borderWidth: 1, borderColor: '#4c375d', padding: 20, justifyContent: 'flex-end', shadowColor: '#9b7cff', shadowOpacity: 0.25, shadowRadius: 18 }, memoryEmptyHero: { marginHorizontal: 20 }, memoryHeroShade: { position: 'absolute', left: 0, right: 0, top: 100, bottom: 0, backgroundColor: '#09071099' }, memoryHeroKicker: { color: '#ff9b7c', fontSize: 9, fontWeight: '900', letterSpacing: 1.5 }, memoryHeroTitle: { color: '#fff8ff', fontSize: 29, lineHeight: 34, fontWeight: '900', marginTop: 7, letterSpacing: -0.7 }, memoryHeroMeta: { color: '#c2b7ca', fontSize: 12, fontWeight: '700', marginTop: 7 }, memoryDots: { minHeight: 8, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6 }, memoryDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#403748' }, memoryDotActive: { width: 24, backgroundColor: '#ff795b' },
  memoryArtwork: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: '#241433', overflow: 'hidden' }, memoryArtworkNight: { backgroundColor: '#0b1630' },
  memoryEditor: { marginHorizontal: 20, backgroundColor: '#121019', borderRadius: 22, borderWidth: 1, borderColor: '#604779', padding: 16, gap: 10 }, collectionEditor: { marginHorizontal: 20, backgroundColor: '#111018', borderRadius: 20, borderWidth: 1, borderColor: '#4a365c', padding: 15, gap: 10 }, editorKicker: { color: '#b693ff', fontSize: 9, fontWeight: '900', letterSpacing: 1.5 }, editorInput: { minHeight: 48, borderRadius: 13, borderWidth: 1, borderColor: '#3b3148', backgroundColor: '#0c0a11', color: '#f5f0f8', fontSize: 14, paddingHorizontal: 13, paddingVertical: 11 }, editorNotes: { minHeight: 76, textAlignVertical: 'top' }, editorInstruction: { color: '#8e8497', fontSize: 11, marginTop: 3 }, editorActions: { flexDirection: 'row', gap: 9, marginTop: 4 }, editorCancel: { flex: 1, minHeight: 46, borderRadius: 13, borderWidth: 1, borderColor: '#3b3345', alignItems: 'center', justifyContent: 'center' }, editorCancelText: { color: '#b5acbd', fontSize: 12, fontWeight: '800' }, editorSave: { flex: 1.4, minHeight: 46, borderRadius: 13, backgroundColor: '#ff795b', alignItems: 'center', justifyContent: 'center' }, editorSaveText: { color: '#1b0b07', fontSize: 12, fontWeight: '900' },
  photoEditorHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 5 }, photoEditorHelp: { color: '#8e8497', fontSize: 10, lineHeight: 15, marginTop: 4 }, photoAddButton: { minHeight: 36, borderRadius: 999, backgroundColor: '#281b39', borderWidth: 1, borderColor: '#684b8c', paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' }, photoAddDisabled: { opacity: 0.42 }, photoAddText: { color: '#c5a5ff', fontSize: 9, fontWeight: '900' }, photoSaveFirst: { color: '#ffad7f', fontSize: 10, lineHeight: 14 }, photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 }, photoTile: { width: '31%', aspectRatio: 0.86, borderRadius: 14, overflow: 'visible', borderWidth: 2, borderColor: 'transparent' }, photoTileSelected: { borderColor: '#ff795b', shadowColor: '#ff795b', shadowOpacity: 0.4, shadowRadius: 8 }, photoTileImage: { width: '100%', height: '100%', borderRadius: 12, overflow: 'hidden' }, photoTileShade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 38, backgroundColor: '#08060bbb' }, photoTileLabel: { position: 'absolute', left: 7, right: 7, bottom: 8, color: '#fff5fb', fontSize: 7, fontWeight: '900', letterSpacing: 0.7 }, photoRemove: { position: 'absolute', right: -7, top: -7, width: 24, height: 24, borderRadius: 12, backgroundColor: '#32151b', borderWidth: 1, borderColor: '#ff795b', alignItems: 'center', justifyContent: 'center' }, photoRemoveText: { color: '#ff9c89', fontSize: 18, lineHeight: 20, fontWeight: '700' }, photoLoading: { backgroundColor: '#1b1524', alignItems: 'center', justifyContent: 'center' }, photoEmpty: { minHeight: 72, borderRadius: 14, borderWidth: 1, borderStyle: 'dashed', borderColor: '#3b3148', backgroundColor: '#0c0a11', padding: 12, justifyContent: 'center' }, photoEmptyTitle: { color: '#d3c6dc', fontSize: 11, fontWeight: '800' }, photoEmptyBody: { color: '#7f7488', fontSize: 9, lineHeight: 14, marginTop: 4 },
  membershipRow: { minHeight: 58, borderRadius: 14, borderWidth: 1, borderColor: '#302839', backgroundColor: '#0d0b12', flexDirection: 'row', alignItems: 'center', gap: 10, padding: 11 }, membershipRowSelected: { borderColor: '#6e4f91', backgroundColor: '#191124' }, membershipCheck: { width: 27, height: 27, borderRadius: 14, borderWidth: 1, borderColor: '#5c5067', alignItems: 'center', justifyContent: 'center' }, membershipCheckSelected: { borderColor: '#43e6ae', backgroundColor: '#123128' }, membershipCheckText: { color: '#a995ba', fontWeight: '900' }, membershipTitle: { color: '#f0eaf5', fontSize: 12, fontWeight: '800' }, membershipDetail: { color: '#7e7487', fontSize: 9, marginTop: 3 }, membershipAction: { color: '#9d7de3', fontSize: 9, fontWeight: '900' }, membershipActionRemove: { color: '#ff9a7b' },
  memoryCollectionCard: { marginHorizontal: 20, minHeight: 98, borderRadius: 20, borderWidth: 1, borderColor: '#2e2738', backgroundColor: '#111018', padding: 13, flexDirection: 'row', alignItems: 'center', gap: 12 }, collectionArtwork: { width: 68, height: 68, borderRadius: 16, overflow: 'hidden' }, collectionKicker: { color: '#89779c', fontSize: 8, fontWeight: '900', letterSpacing: 1.2 }, collectionTitle: { color: '#f5eff9', fontSize: 15, fontWeight: '900', marginTop: 5 }, collectionMeta: { color: '#8b8293', fontSize: 10, lineHeight: 14, marginTop: 4 }, collectionManage: { borderRadius: 999, backgroundColor: '#251934', paddingHorizontal: 9, paddingVertical: 7 }, collectionManageText: { color: '#bc96ff', fontSize: 8, fontWeight: '900' }, managingPill: { color: '#66efc2', fontSize: 8, fontWeight: '900', letterSpacing: 1, borderWidth: 1, borderColor: '#295f4e', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 6 }, journeyManageHelp: { marginHorizontal: 20, color: '#948a9e', fontSize: 11, lineHeight: 17 }, memoryJourneyList: { marginHorizontal: 20, gap: 8 }, journeyMembershipButton: { minHeight: 40, borderRadius: 12, borderWidth: 1, borderColor: '#5d4380', backgroundColor: '#1b1327', alignItems: 'center', justifyContent: 'center' }, journeyMembershipRemove: { borderColor: '#704037', backgroundColor: '#29130f' }, journeyMembershipText: { color: '#c3a5ff', fontSize: 10, fontWeight: '900' }, journeyMembershipRemoveText: { color: '#ff9c80' },
  memoryDetailRoot: { flex: 1, backgroundColor: 'rgba(3, 2, 6, 0.54)' }, memoryDetailBackdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }, memoryDetailSheet: { flex: 1, overflow: 'hidden', borderWidth: 1, borderColor: '#6a3f71', borderTopLeftRadius: 30, borderTopRightRadius: 30, shadowColor: '#000', shadowOpacity: 0.58, shadowRadius: 28, shadowOffset: { width: 0, height: -10 } }, memoryDetailSweep: { position: 'absolute', top: -120, bottom: -120, width: 155, transform: [{ rotate: '12deg' }] }, memoryDetailSweepGradient: { flex: 1 }, memoryDetailHeader: { position: 'relative', zIndex: 4, height: 42, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, memoryDetailClose: { width: 34, height: 34, borderRadius: 17, borderWidth: 1, borderColor: '#7d617d', backgroundColor: '#180e1dd1', alignItems: 'center', justifyContent: 'center' }, memoryDetailCloseText: { color: '#f6eff8', fontSize: 30, lineHeight: 31, marginTop: -3, fontWeight: '300' }, memoryDetailHeaderActions: { flexDirection: 'row', gap: 8 }, memoryDetailHeaderAction: { minHeight: 30, paddingHorizontal: 11, borderRadius: 15, borderWidth: 1, borderColor: '#6d4c79', backgroundColor: '#1c1025d9', alignItems: 'center', justifyContent: 'center' }, memoryDetailHeaderActionText: { color: '#ecd7ff', fontSize: 10, fontWeight: '900' }, memoryDetailContent: { position: 'relative', paddingHorizontal: 20, paddingTop: 9, paddingBottom: 38, gap: 12 }, memoryDetailHero: { height: 278, borderRadius: 28, overflow: 'hidden', borderWidth: 1, borderColor: '#83536f', backgroundColor: '#21142b', justifyContent: 'flex-end', shadowColor: '#ff765c', shadowOpacity: 0.25, shadowRadius: 25, shadowOffset: { width: 0, height: 12 } }, memoryDetailHeroImage: { width: '100%', height: '100%' }, memoryDetailHeroGlowOne: { position: 'absolute', width: 190, height: 190, borderRadius: 95, backgroundColor: '#ff765c', opacity: 0.17, right: -65, top: -82, shadowColor: '#ff765c', shadowOpacity: 0.8, shadowRadius: 28 }, memoryDetailHeroGlowTwo: { position: 'absolute', width: 155, height: 155, borderRadius: 78, backgroundColor: '#9d75ff', opacity: 0.16, left: -58, bottom: -80 }, memoryDetailHeroContent: { padding: 20, paddingTop: 64 }, memoryDetailKicker: { color: '#ffad8b', fontSize: 9, fontWeight: '900', letterSpacing: 2.1 }, memoryDetailTitle: { color: '#fff9ff', fontSize: 31, lineHeight: 35, fontWeight: '900', letterSpacing: -1, marginTop: 5 }, memoryDetailMeta: { color: '#ddd0df', fontSize: 12, fontWeight: '700', marginTop: 7 }, memoryDetailBreadcrumb: { flexDirection: 'row', alignSelf: 'flex-start', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: '#49324d', borderRadius: 999, backgroundColor: '#130d18', paddingHorizontal: 11, paddingVertical: 8, marginTop: 5 }, memoryDetailBreadcrumbMuted: { color: '#95889a', fontSize: 9, fontWeight: '700' }, memoryDetailBreadcrumbActive: { color: '#ff977d', fontSize: 9, fontWeight: '900' }, memoryDetailBreadcrumbArrow: { color: '#6d546f', fontSize: 15, lineHeight: 13 }, memoryDetailNotes: { color: '#d0c4d4', fontSize: 12, lineHeight: 18, marginTop: 1 }, memoryDetailSection: { color: '#ff987c', fontSize: 10, fontWeight: '900', letterSpacing: 2.4, marginTop: 8 }, memoryDetailAtlas: { position: 'relative' }, memoryRoadThread: { position: 'absolute', zIndex: 0, left: -3, top: -22, width: 82 }, memoryDetailChapters: { gap: 18, paddingLeft: 43 }, memoryChapterWrap: { position: 'relative' }, memoryDetailRoadNode: { position: 'absolute', zIndex: 4, width: 18, height: 18, borderRadius: 9, left: -51, top: 50, backgroundColor: '#ffb18f', borderWidth: 4, borderColor: '#321832', shadowColor: '#ff7357', shadowOpacity: 1, shadowRadius: 12 }, memoryChapterCard: { borderWidth: 1, borderColor: '#684558', borderRadius: 23, backgroundColor: '#16101b', overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.28, shadowRadius: 16, shadowOffset: { width: 0, height: 8 } }, memoryChapterHeader: { minHeight: 112, padding: 13, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#1c1221' }, memoryChapterArtwork: { width: 92, height: 82, borderRadius: 17, overflow: 'hidden', borderWidth: 1, borderColor: '#a16d75' }, memoryChapterKicker: { color: '#c6a1d0', fontSize: 7, fontWeight: '900', letterSpacing: 1.2 }, memoryChapterTitle: { color: '#fff8ff', fontSize: 18, lineHeight: 21, fontWeight: '900', marginTop: 4 }, memoryChapterMeta: { color: '#b4a5b7', fontSize: 9, marginTop: 6, lineHeight: 13 }, memoryChapterOpen: { width: 35, height: 35, borderRadius: 18, backgroundColor: '#361d2e', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#633849' }, memoryChapterOpenText: { color: '#ff9a78', fontSize: 19, fontWeight: '900' }, memoryChapterJourneys: { padding: 10, gap: 8, backgroundColor: '#100c14' }, memoryChapterJourney: { minHeight: 67, borderRadius: 14, backgroundColor: '#1b1520', overflow: 'hidden', flexDirection: 'row', alignItems: 'center', gap: 10, paddingRight: 9, borderWidth: 1, borderColor: '#322638' }, memoryChapterJourneyVisual: { width: 74, alignSelf: 'stretch', overflow: 'hidden', backgroundColor: '#2a1930' }, memoryChapterJourneyImage: { width: '100%', height: '100%' }, memoryChapterJourneyIndex: { position: 'absolute', left: 7, top: 7, zIndex: 2, width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#ff9b7c', shadowColor: '#ff795b', shadowOpacity: 0.7, shadowRadius: 5 }, memoryChapterJourneyIndexText: { color: '#240d0b', fontSize: 9, fontWeight: '900' }, memoryChapterJourneyRoute: { color: '#f5edf5', fontSize: 11, fontWeight: '900' }, memoryChapterJourneyMeta: { color: '#a197a5', fontSize: 8, marginTop: 4 }, memoryChapterEmpty: { color: '#8e8293', fontSize: 10, lineHeight: 16, padding: 12, backgroundColor: '#100c14' }, memoryChapterMore: { minHeight: 38, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#4a3047', backgroundColor: '#171019' }, memoryChapterMoreText: { color: '#d0adff', fontSize: 9, fontWeight: '900' }, memoryChapterMoreArrow: { color: '#ff9c7d', fontSize: 18, lineHeight: 18 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 4 }, brandCompact: { marginBottom: 14 }, logo: { width: 46, height: 46, borderRadius: 15, backgroundColor: '#ff7b54', alignItems: 'center', justifyContent: 'center', shadowColor: '#ff7b54', shadowOpacity: 0.28, shadowRadius: 14 }, logoText: { color: '#fff', fontSize: 24, fontWeight: '900' }, brandEyebrow: { color: '#91899f', fontSize: 10, fontWeight: '900', letterSpacing: 2 }, brandTitle: { color: '#f8f4ff', fontSize: 20, fontWeight: '800', marginTop: 2 },
  pageHeader: { minHeight: 143, gap: 5, marginBottom: 4, overflow: 'hidden', borderRadius: 24, borderWidth: 1, borderColor: '#40274f', backgroundColor: '#100a19', paddingHorizontal: 18, paddingVertical: 18, justifyContent: 'center', shadowColor: '#7f47c4', shadowOpacity: 0.18, shadowRadius: 18, shadowOffset: { width: 0, height: 8 } }, pageHeaderGlow: { position: 'absolute', width: 180, height: 180, borderRadius: 90, right: -76, top: -100, backgroundColor: '#6b2557', opacity: 0.48 }, pageHeaderRail: { position: 'absolute', left: 18, top: 13, width: 50, height: 3, borderRadius: 3, backgroundColor: '#402350', overflow: 'hidden' }, pageHeaderRailCore: { width: '55%', height: '100%', borderRadius: 3, backgroundColor: '#ff795b', shadowColor: '#ff795b', shadowOpacity: 1, shadowRadius: 6 }, pageEyebrow: { color: '#c1a2ff', fontSize: 9, fontWeight: '900', letterSpacing: 1.8, marginTop: 4 }, pageTitle: { color: '#f8f5ff', fontSize: 34, lineHeight: 39, fontWeight: '900', letterSpacing: -1 }, pageBody: { color: '#ada3b4', fontSize: 13, lineHeight: 20, maxWidth: 330 },
  openRoad: { height: 132, marginHorizontal: -20, marginTop: -20, marginBottom: 8, backgroundColor: '#0d0a16', overflow: 'hidden', borderTopLeftRadius: 25, borderTopRightRadius: 25 },
  roadSoundwave: { position: 'absolute', flexDirection: 'row', alignItems: 'center', gap: 3, left: 18, top: 18, height: 20 },
  roadSoundBarSmall: { width: 2, height: 6, borderRadius: 2, backgroundColor: '#43e6ae' },
  roadSoundBarMedium: { width: 2, height: 12, borderRadius: 2, backgroundColor: '#43e6ae' },
  roadSoundBarTall: { width: 2, height: 18, borderRadius: 2, backgroundColor: '#43e6ae' },
  roadCaption: { position: 'absolute', right: 17, bottom: 10, color: '#9f8ab8', fontSize: 7, fontWeight: '900', letterSpacing: 1.4 },
  pulseCard: { backgroundColor: '#0f0d15', borderRadius: 22, borderWidth: 1, borderColor: '#332943', padding: 16, shadowColor: '#9b7cff', shadowOpacity: 0.14, shadowRadius: 18 }, pulseHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, pulseKicker: { color: '#a88aff', fontSize: 8, fontWeight: '900', letterSpacing: 1.3 }, pulseTitle: { color: '#f4eff9', fontSize: 16, fontWeight: '900', marginTop: 4 }, livePill: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderColor: '#285d4c', backgroundColor: '#10251f', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 5 }, liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#43e6ae', shadowColor: '#43e6ae', shadowOpacity: 1, shadowRadius: 6 }, liveText: { color: '#70f1c5', fontSize: 7, fontWeight: '900', letterSpacing: 1 }, pulseChart: { height: 105, flexDirection: 'row', alignItems: 'flex-end', gap: 9, marginTop: 17 }, pulseColumn: { flex: 1, height: '100%', alignItems: 'center', justifyContent: 'flex-end', gap: 7 }, pulseTrack: { width: 16, flex: 1, justifyContent: 'flex-end', borderRadius: 8, backgroundColor: '#191522', overflow: 'hidden' }, pulseBar: { width: '100%', minHeight: 7, borderRadius: 8, backgroundColor: '#7c55d9', shadowColor: '#a88aff', shadowOpacity: 0.9, shadowRadius: 7 }, pulseBarCap: { height: 4, backgroundColor: '#c6b2ff', opacity: 0.9 }, pulseDay: { color: '#696171', fontSize: 8, fontWeight: '800' }, pulseDayToday: { color: '#ff8a68' }, pulseFooter: { flexDirection: 'row', alignItems: 'baseline', gap: 7, marginTop: 13, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#31293a' }, pulseFooterValue: { color: '#f5f0fb', fontSize: 17, fontWeight: '900' }, pulseFooterLabel: { color: '#7e7687', fontSize: 10 },
  dashboardGrid: { flexDirection: 'row', gap: 10 }, dashboardStatCard: { flex: 1, minHeight: 150, backgroundColor: '#121019', borderRadius: 20, borderWidth: 1, borderColor: '#2d2638', padding: 14 }, dashboardStatIcon: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center', marginBottom: 12 }, dashboardStatSymbol: { fontSize: 18, fontWeight: '900' }, dashboardStatKicker: { color: '#817789', fontSize: 8, fontWeight: '900', letterSpacing: 1 }, dashboardStatValue: { color: '#f7f2fc', fontSize: 20, fontWeight: '900', marginTop: 7 }, dashboardStatDetail: { color: '#8d8596', fontSize: 10, lineHeight: 15, marginTop: 5 },
  insightStrip: { flexDirection: 'row', gap: 10 }, insightCard: { flex: 1, minHeight: 152, backgroundColor: '#111018', borderRadius: 20, borderWidth: 1, borderColor: '#2d2638', padding: 14, overflow: 'hidden' }, insightRoute: { height: 42, marginBottom: 9 }, insightRouteLine: { position: 'absolute', width: 105, height: 3, borderRadius: 2, backgroundColor: '#9b7cff', left: 10, top: 19, transform: [{ rotate: '-12deg' }], shadowColor: '#9b7cff', shadowOpacity: 0.9, shadowRadius: 7 }, insightRouteStart: { position: 'absolute', width: 10, height: 10, borderRadius: 5, backgroundColor: '#43e6ae', left: 7, top: 27, shadowColor: '#43e6ae', shadowOpacity: 1, shadowRadius: 6 }, insightRouteEnd: { position: 'absolute', width: 11, height: 11, borderRadius: 6, backgroundColor: '#ff7b54', left: 112, top: 5, shadowColor: '#ff7b54', shadowOpacity: 1, shadowRadius: 7 }, musicRings: { height: 42, justifyContent: 'center', marginBottom: 9 }, musicRingOuter: { width: 42, height: 42, borderRadius: 21, borderWidth: 1, borderColor: '#664c9d', backgroundColor: '#1b1427', alignItems: 'center', justifyContent: 'center', shadowColor: '#a88aff', shadowOpacity: 0.5, shadowRadius: 9 }, musicRingInner: { width: 28, height: 28, borderRadius: 14, borderWidth: 1, borderColor: '#9b7cff', backgroundColor: '#281b3a', alignItems: 'center', justifyContent: 'center' }, musicRingNote: { color: '#c2aaff', fontSize: 14, fontWeight: '900' }, insightKicker: { color: '#817789', fontSize: 8, fontWeight: '900', letterSpacing: 1 }, insightValue: { color: '#f5f0fb', fontSize: 22, fontWeight: '900', marginTop: 5 }, insightDetail: { color: '#81798a', fontSize: 9, lineHeight: 14, marginTop: 4 },
  quickActions: { flexDirection: 'row', gap: 9 }, quickAction: { flex: 1, minHeight: 105, backgroundColor: '#121019', borderRadius: 18, borderWidth: 1, borderColor: '#2b2534', padding: 13, justifyContent: 'flex-end' }, quickActionSymbol: { fontSize: 21, fontWeight: '900', marginBottom: 12 }, quickActionTitle: { color: '#f0ebf5', fontSize: 13, fontWeight: '900' }, quickActionDetail: { color: '#777080', fontSize: 9, marginTop: 4 },
  vehicleCard: { flexDirection: 'row', alignItems: 'center', gap: 13, backgroundColor: '#121019', borderRadius: 20, borderWidth: 1, borderColor: '#2c2635', padding: 15 }, vehicleIcon: { width: 50, height: 50, borderRadius: 16, backgroundColor: '#2b1f40', alignItems: 'center', justifyContent: 'center' }, vehicleIconText: { color: '#b795ff', fontSize: 20, fontWeight: '900' }, vehicleKicker: { color: '#8b74c3', fontSize: 8, fontWeight: '900', letterSpacing: 1 }, vehicleName: { color: '#f4eff8', fontSize: 16, fontWeight: '900', marginTop: 5 }, vehicleDetail: { color: '#898190', fontSize: 11, lineHeight: 16, marginTop: 4 }, connectionDot: { width: 10, height: 10, borderRadius: 5 },
  dataHealthCard: { backgroundColor: '#111018', borderRadius: 20, borderWidth: 1, borderColor: '#292331', paddingHorizontal: 15 }, dashboardHealthRow: { minHeight: 62, flexDirection: 'row', alignItems: 'center', gap: 11, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#302a38' }, dashboardHealthDot: { width: 9, height: 9, borderRadius: 5 }, dashboardHealthLabel: { color: '#eee9f3', fontSize: 12, fontWeight: '800' }, dashboardHealthDetail: { color: '#7f7788', fontSize: 10, lineHeight: 14, marginTop: 3 }, dashboardHealthState: { fontSize: 8, fontWeight: '900', letterSpacing: 1 },
  metric: { flex: 1, alignItems: 'center', gap: 5 }, metricValue: { color: '#f5f0fb', fontSize: 17, fontWeight: '800', fontVariant: ['tabular-nums'] }, metricLabel: { color: '#756c82', fontSize: 8, fontWeight: '900', letterSpacing: 1 },
  sectionHeading: { minHeight: 32, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }, sectionTitleGroup: { flexDirection: 'row', alignItems: 'center', gap: 9 }, sectionAccent: { width: 4, height: 20, borderRadius: 3, backgroundColor: '#ff795b', shadowColor: '#ff795b', shadowOpacity: 0.75, shadowRadius: 7 }, sectionTitle: { color: '#f5f1fa', fontSize: 18, fontWeight: '900', letterSpacing: -0.2 }, sectionActionButton: { minHeight: 30, borderRadius: 999, borderWidth: 1, borderColor: '#49335e', backgroundColor: '#1b1227', paddingHorizontal: 11, justifyContent: 'center' }, sectionAction: { color: '#c4a7ff', fontSize: 11, fontWeight: '900' }, sectionActionMuted: { color: '#777080' },
  soundtrackCard: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#121019', borderRadius: 20, borderWidth: 1, borderColor: '#2c2538', padding: 14 }, emptyArtwork: { width: 72, height: 72, borderRadius: 16, backgroundColor: '#2a1b38', alignItems: 'center', justifyContent: 'center' }, emptyArtworkNote: { color: '#b391ff', fontSize: 31, fontWeight: '800' }, soundtrackLabel: { color: '#9a7ee5', fontSize: 9, fontWeight: '900', letterSpacing: 1.1 }, soundtrackTitle: { color: '#f8f5ff', fontSize: 16, fontWeight: '800', marginTop: 5 }, soundtrackArtist: { color: '#8e8798', fontSize: 12, marginTop: 4 },
  recorderHealth: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#111018', borderRadius: 17, padding: 15, borderWidth: 1, borderColor: '#272331' }, healthDot: { width: 10, height: 10, borderRadius: 5 }, healthTitle: { color: '#eae5f0', fontSize: 14, fontWeight: '800' }, healthBody: { color: '#827b8c', fontSize: 11, lineHeight: 16, marginTop: 2 }, healthPoints: { color: '#9b7cff', fontSize: 16, fontWeight: '800' },
  primaryAction: { minHeight: 58, borderRadius: 18, borderWidth: 1, borderColor: '#ffaf95', backgroundColor: '#ff795b', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20, shadowColor: '#ff5d42', shadowOpacity: 0.38, shadowRadius: 13, shadowOffset: { width: 0, height: 7 } }, primaryActionText: { color: '#190b07', fontSize: 16, fontWeight: '900' }, pressed: { opacity: 0.62 },
  journeyCard: { backgroundColor: '#121019', borderRadius: 21, borderWidth: 1, borderColor: '#292334', padding: 16, gap: 11 }, journeyTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 }, journeyDate: { color: '#8f819e', fontSize: 10, fontWeight: '900', letterSpacing: 1 }, journeyRoute: { color: '#f3eef8', fontSize: 17, fontWeight: '800', marginTop: 6, maxWidth: 290 }, journeyChevron: { color: '#6f667a', fontSize: 28, lineHeight: 30 }, journeyStats: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 7 }, journeyStat: { color: '#a9a1b2', fontSize: 12, fontWeight: '600' }, journeyStatDot: { color: '#4e4657', fontSize: 10 }, journeySoundtrack: { flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#332c3d', paddingTop: 11 }, journeySong: { color: '#e7e1ed', fontSize: 13, fontWeight: '700' }, journeyArtist: { color: '#827a8c', fontSize: 11, marginTop: 3 }, songCount: { color: '#9b7cff', fontSize: 12, fontWeight: '900' }, miniArtwork: { width: 42, height: 42, borderRadius: 10, backgroundColor: '#281b36', alignItems: 'center', justifyContent: 'center' }, miniArtworkText: { color: '#aa89ff', fontSize: 18, fontWeight: '900' }, artworkFallback: { backgroundColor: '#2a1d38', alignItems: 'center', justifyContent: 'center' }, artworkFallbackText: { color: '#b694ff', fontWeight: '900' },
  journeyCardCompact: { backgroundColor: '#121019', borderRadius: 16, borderWidth: 1, borderColor: '#292334', paddingHorizontal: 12, paddingVertical: 10, gap: 7 }, journeyCompactTop: { flexDirection: 'row', alignItems: 'center', gap: 8 }, journeyDateCompact: { color: '#8f819e', fontSize: 8, fontWeight: '900', letterSpacing: 0.8 }, journeyRouteCompact: { color: '#f3eef8', fontSize: 13, lineHeight: 17, fontWeight: '800', marginTop: 3 }, journeyChevronCompact: { color: '#6f667a', fontSize: 22, lineHeight: 24 }, journeyStatsCompact: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 }, journeyStatCompact: { color: '#928a9c', fontSize: 9, fontWeight: '700' }, journeySoundtrackCompact: { minHeight: 31, flexDirection: 'row', alignItems: 'center', gap: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#2b2633', paddingTop: 7 }, journeySongCompact: { flex: 1, color: '#bdb5c5', fontSize: 10, fontWeight: '700' }, songCountCompact: { minWidth: 18, color: '#9b7cff', fontSize: 10, fontWeight: '900', textAlign: 'right' }, miniArtworkCompact: { width: 30, height: 30, borderRadius: 7, backgroundColor: '#281b36', alignItems: 'center', justifyContent: 'center' }, miniArtworkTextCompact: { color: '#aa89ff', fontSize: 13, fontWeight: '900' },
  emptyCard: { alignItems: 'center', backgroundColor: '#111018', borderRadius: 21, borderWidth: 1, borderColor: '#604077', padding: 24, shadowColor: '#a85cff', shadowOpacity: 0.27, shadowRadius: 16, shadowOffset: { width: 0, height: 7 } }, emptyCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#231a30', alignItems: 'center', justifyContent: 'center', marginBottom: 10, shadowColor: '#9b7cff', shadowOpacity: 0.65, shadowRadius: 11 }, emptyCircleText: { color: '#9b7cff', fontWeight: '900', fontSize: 17 }, emptyTitle: { color: '#eee9f5', fontSize: 16, fontWeight: '800' }, emptyBody: { color: '#8b8395', fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 6, maxWidth: 300 },
  loadMoreButton: { minHeight: 50, alignItems: 'center', justifyContent: 'center', borderRadius: 15, borderWidth: 1, borderColor: '#3a3048', backgroundColor: '#15111d' }, loadMoreText: { color: '#b59cff', fontSize: 13, fontWeight: '900' },
  inlineNotice: { flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: '#21180f', borderWidth: 1, borderColor: '#714c25', borderRadius: 15, padding: 12 }, noticeDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#ffb15c' }, inlineNoticeText: { color: '#c1af9a', fontSize: 11, lineHeight: 16, flex: 1 }, retryText: { color: '#ffb15c', fontSize: 11, fontWeight: '900' }, loadingLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, minHeight: 28 }, loadingLineText: { color: '#8f8799', fontSize: 12 }, loadingCard: { minHeight: 180, alignItems: 'center', justifyContent: 'center', gap: 13, backgroundColor: '#111018', borderRadius: 20 },
  detailDate: { color: '#a88aff', fontSize: 10, fontWeight: '900', letterSpacing: 1.3 }, detailTitle: { color: '#f8f4ff', fontSize: 25, lineHeight: 31, fontWeight: '900', letterSpacing: -0.5 }, backButton: { alignSelf: 'flex-start', paddingVertical: 6 }, backButtonText: { color: '#aa8cff', fontSize: 14, fontWeight: '800' }, routeSketch: { height: 190, borderRadius: 22, overflow: 'hidden', backgroundColor: '#10121a', borderWidth: 1, borderColor: '#252c3b' }, routeSketchHero: { height: 236, borderWidth: 0, borderRadius: 0 }, routeSketchExpanded: { height: 430, borderWidth: 0, borderRadius: 0 }, routeGlow: { position: 'absolute', width: 180, height: 180, borderRadius: 90, backgroundColor: '#171d32', right: -35, top: -30 }, routeLine: { position: 'absolute', height: 4, borderRadius: 2, backgroundColor: '#9b7cff' }, routeStart: { position: 'absolute', width: 12, height: 12, borderRadius: 6, backgroundColor: '#43e6ae' }, routeEnd: { position: 'absolute', width: 14, height: 14, borderRadius: 7, backgroundColor: '#ff7b54' }, routeCaption: { position: 'absolute', color: '#70798d', fontSize: 10, bottom: 12, left: 16 }, detailMetrics: { flexDirection: 'row', paddingVertical: 17, borderRadius: 18, backgroundColor: '#121019' },
  journeyHeroCard: { overflow: 'hidden', borderRadius: 25, backgroundColor: '#100c16', borderWidth: 1, borderColor: '#4c3659', shadowColor: '#7c4da4', shadowOpacity: 0.28, shadowRadius: 22, shadowOffset: { width: 0, height: 10 } }, journeyHeroMapFrame: { position: 'relative', overflow: 'hidden' }, journeyHeroMapShade: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }, journeyHeroCopy: { position: 'absolute', left: 18, right: 18, bottom: 18 }, journeyHeroDate: { color: '#ff9b7d', fontSize: 9, fontWeight: '900', letterSpacing: 1.35, textShadowColor: '#170b1a', textShadowRadius: 7 }, journeyHeroRoute: { color: '#fff8ff', fontSize: 24, lineHeight: 27, fontWeight: '900', letterSpacing: -0.65, marginTop: 5, textShadowColor: '#170b1a', textShadowRadius: 11 }, journeyHeroMetrics: { minHeight: 76, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', backgroundColor: '#17101e', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#45334f', paddingHorizontal: 6 }, journeyHeroMetric: { flex: 1, minWidth: 0, alignItems: 'center', gap: 4 }, journeyHeroMetricValue: { color: '#f8f1fb', fontSize: 16, fontWeight: '900', fontVariant: ['tabular-nums'] }, journeyHeroMetricLabel: { color: '#9c879f', fontSize: 8, fontWeight: '900', letterSpacing: 0.8 }, journeyHeroMetricDivider: { width: StyleSheet.hairlineWidth, height: 33, backgroundColor: '#55405d' }, journeyHeroSoundtrack: { minHeight: 82, flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 14, paddingVertical: 12, backgroundColor: '#120d1a' }, journeyHeroArtworkFallback: { width: 54, height: 54, borderRadius: 13, backgroundColor: '#2b1c3c', alignItems: 'center', justifyContent: 'center' }, journeyHeroArtworkNote: { color: '#d3b9ff', fontSize: 23, fontWeight: '900' }, journeyHeroSoundtrackLabel: { color: '#bd9dff', fontSize: 8, fontWeight: '900', letterSpacing: 1.15 }, journeyHeroTrack: { color: '#f9f2fb', fontSize: 15, fontWeight: '900', marginTop: 4 }, journeyHeroArtist: { color: '#a096a9', fontSize: 11, fontWeight: '700', marginTop: 3 }, journeyHeroSongCount: { minWidth: 35, alignItems: 'center', gap: 2 }, journeyHeroSongCountValue: { color: '#ff9677', fontSize: 17, fontWeight: '900', fontVariant: ['tabular-nums'] }, journeyHeroSongCountLabel: { color: '#8f788f', fontSize: 7, fontWeight: '900', letterSpacing: 0.7 },
  journeyMapHeading: { marginTop: 8, paddingHorizontal: 2, gap: 5 }, journeyMapKicker: { color: '#ff8d72', fontSize: 9, fontWeight: '900', letterSpacing: 1.65 }, journeyMapTitle: { color: '#fff8ff', fontSize: 21, lineHeight: 25, fontWeight: '900', letterSpacing: -0.5 },
  trackRow: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 8, paddingHorizontal: 8, marginHorizontal: -8, borderRadius: 14, borderWidth: 1, borderColor: 'transparent' }, trackRowSelected: { backgroundColor: '#201329', borderColor: '#6e3c79' }, trackIndex: { width: 21, color: '#696272', fontSize: 10, fontWeight: '700', fontVariant: ['tabular-nums'] }, trackIndexSelected: { color: '#ff967a' }, trackTitle: { color: '#eee9f3', fontSize: 13, fontWeight: '800' }, trackArtist: { color: '#837b8c', fontSize: 11, marginTop: 4 }, trackMapLink: { color: '#6d6074', fontSize: 8, fontWeight: '900', letterSpacing: 0.7 }, trackMapLinkSelected: { color: '#d797f4' }, infoCard: { backgroundColor: '#121019', borderRadius: 18, paddingHorizontal: 16 }, infoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 15, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#302a38' }, infoLabel: { color: '#776f81', fontSize: 9, fontWeight: '900', letterSpacing: 1 }, infoValue: { color: '#ece6f1', fontSize: 13, fontWeight: '700' },
  selectedProvider: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#15101e', borderWidth: 1, borderRadius: 21, padding: 15, shadowColor: '#673a87', shadowOpacity: 0.14, shadowRadius: 12, shadowOffset: { width: 0, height: 5 } }, connectionTile: { position: 'relative', overflow: 'hidden', flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#121019', borderWidth: 1, borderColor: '#34283f', borderRadius: 18, padding: 14, shadowColor: '#000', shadowOpacity: 0.16, shadowRadius: 10, shadowOffset: { width: 0, height: 5 } }, connectionEdge: { position: 'absolute', left: 0, top: 13, bottom: 13, width: 3, borderTopRightRadius: 3, borderBottomRightRadius: 3, opacity: 0.9 }, connectionIcon: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center', shadowOpacity: 0.34, shadowRadius: 9, shadowOffset: { width: 0, height: 4 } }, connectionIconText: { color: '#fff', fontSize: 16, fontWeight: '900' }, connectionKicker: { color: '#9b8ba8', fontSize: 8, fontWeight: '900', letterSpacing: 1.2 }, connectionName: { color: '#f7f0fa', fontSize: 16, fontWeight: '900', marginTop: 2 }, connectionDetail: { color: '#9c90a4', fontSize: 11, lineHeight: 16, marginTop: 3 }, connectionStatus: { color: '#a195aa', fontSize: 10, fontWeight: '800', marginTop: 5 }, goodStatus: { color: '#55e9b5' }, connectionAction: { borderWidth: 1, borderColor: '#49335d', backgroundColor: '#21162e', borderRadius: 10, paddingHorizontal: 9, paddingVertical: 8 }, connectionActionText: { color: '#c7a9ff', fontSize: 9, fontWeight: '900' }, changeButton: { borderWidth: 1, borderColor: '#503766', paddingHorizontal: 11, paddingVertical: 8, borderRadius: 10, backgroundColor: '#241831' }, changeButtonText: { color: '#c7a9ff', fontSize: 11, fontWeight: '900' }, privateCloudCard: { backgroundColor: '#17121f', borderWidth: 1, borderColor: '#352746', borderRadius: 14, padding: 14, marginTop: 9 }, privateCloudTitle: { color: '#c7a9ff', fontSize: 9, fontWeight: '900', letterSpacing: 1.1 }, privateCloudBody: { color: '#a99eae', fontSize: 11, lineHeight: 17, marginTop: 5 }, privateCloudLearn: { color: '#c7a9ff', fontSize: 11, fontWeight: '900', marginTop: 9 }, appleSignInButton: { width: '100%', height: 46, marginTop: 10 }, appleSignInProgress: { height: 46, marginTop: 10, borderRadius: 12, backgroundColor: '#17121f', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 }, appleIdentityWarning: { color: '#ffb38e', fontSize: 11, lineHeight: 17, marginTop: 8, paddingHorizontal: 4 }, securityCard: { backgroundColor: '#17121b', borderLeftWidth: 3, borderLeftColor: '#ff795b', borderRadius: 14, padding: 15, marginTop: 5 }, securityTitle: { color: '#ffc0ac', fontSize: 9, fontWeight: '900', letterSpacing: 1.2 }, securityBody: { color: '#a99eae', fontSize: 12, lineHeight: 18, marginTop: 5 },
  setupCard: { gap: 11, backgroundColor: '#171019', borderWidth: 1, borderColor: '#713e58', borderRadius: 18, padding: 15, shadowColor: '#ff4f7d', shadowOpacity: 0.25, shadowRadius: 15, shadowOffset: { width: 0, height: 7 } }, setupTitle: { color: '#ff7b82', fontSize: 9, fontWeight: '900', letterSpacing: 1.2 }, setupBody: { color: '#9b929f', fontSize: 12, lineHeight: 18 }, setupInput: { minHeight: 48, borderRadius: 13, borderWidth: 1, borderColor: '#5d466b', backgroundColor: '#0e0c12', color: '#f4eef8', paddingHorizontal: 14, fontSize: 15, shadowColor: '#a85cff', shadowOpacity: 0.18, shadowRadius: 9 }, setupWarning: { color: '#ffb15c', fontSize: 11, lineHeight: 16 }, setupSync: { minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderWidth: 1, borderColor: '#7f4151', backgroundColor: '#281318', shadowColor: '#ff4f7d', shadowOpacity: 0.25, shadowRadius: 10 }, setupSyncText: { color: '#ff8c93', fontSize: 12, fontWeight: '900' }, setupActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 }, setupSecondary: { minHeight: 40, minWidth: 88, alignItems: 'center', justifyContent: 'center', borderRadius: 11, backgroundColor: '#241f29', shadowColor: '#a85cff', shadowOpacity: 0.18, shadowRadius: 8 }, setupSecondaryText: { color: '#a79daa', fontSize: 12, fontWeight: '800' }, setupPrimary: { minHeight: 40, minWidth: 88, alignItems: 'center', justifyContent: 'center', borderRadius: 11, backgroundColor: '#f23d47', shadowColor: '#ff4f65', shadowOpacity: 0.42, shadowRadius: 11 }, setupPrimaryText: { color: '#fff', fontSize: 12, fontWeight: '900' },
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
  onboardingSafe: { flex: 1, backgroundColor: '#08070d' }, onboardingContent: { paddingHorizontal: 22, paddingTop: 24, paddingBottom: 36 }, onboardingEyebrow: { color: '#ff8a68', fontSize: 10, fontWeight: '900', letterSpacing: 1.5, marginTop: 4 }, onboardingTitle: { color: '#f9f5ff', fontSize: 31, lineHeight: 36, fontWeight: '900', letterSpacing: -0.9, marginTop: 7 }, onboardingBody: { color: '#9b92a5', fontSize: 14, lineHeight: 21, marginTop: 9 }, recordingModeTabs: { flexDirection: 'row', gap: 10, marginTop: 18, marginBottom: 14 }, recordingModeTab: { flex: 1, minHeight: 64, borderRadius: 15, borderWidth: 1, borderColor: '#2c2735', backgroundColor: '#111018', alignItems: 'center', justifyContent: 'center' }, recordingModeTabTitle: { color: '#eee9f5', fontSize: 14, fontWeight: '900' }, recordingModeTabDetail: { color: '#777080', fontSize: 10, fontWeight: '700', marginTop: 4 }, providerTabs: { flexDirection: 'row', gap: 9, marginTop: 18, marginBottom: 14 }, providerTab: { flex: 1, minHeight: 42, borderRadius: 13, borderWidth: 1, borderColor: '#2c2735', backgroundColor: '#111018', alignItems: 'center', justifyContent: 'center' }, providerTabText: { color: '#777080', fontSize: 14, fontWeight: '900' }, providerCarousel: { gap: 12 }, providerCard: { backgroundColor: '#121019', borderWidth: 1, borderRadius: 24, padding: 18, gap: 15 }, providerCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 }, providerIcon: { width: 50, height: 50, borderRadius: 15, alignItems: 'center', justifyContent: 'center' }, providerIconText: { color: '#fff', fontSize: 19, fontWeight: '900' }, spotifyMarkFrame: { backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' }, providerKicker: { fontSize: 8, fontWeight: '900', letterSpacing: 1.1 }, providerName: { color: '#fff', fontSize: 21, fontWeight: '900', marginTop: 3 }, providerSummary: { color: '#aaa2b4', fontSize: 13, lineHeight: 20 }, prosCons: { gap: 8 }, prosConsTitle: { fontSize: 8, fontWeight: '900', letterSpacing: 1.1 }, proRow: { flexDirection: 'row', alignItems: 'center', gap: 9 }, proBullet: { width: 20, height: 20, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' }, proBulletText: { fontSize: 12, fontWeight: '900', lineHeight: 15 }, proText: { color: '#d2cbd9', fontSize: 12, flex: 1 }, privacyNote: { borderRadius: 14, padding: 12 }, privacyTitle: { fontSize: 8, fontWeight: '900', letterSpacing: 1 }, privacyCopy: { color: '#9d94a5', fontSize: 11, lineHeight: 16, marginTop: 4 }, pageDots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginVertical: 14 }, pageDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#39313f' }, cancelButton: { alignItems: 'center', padding: 14 }, cancelButtonText: { color: '#9d91ae', fontSize: 12, fontWeight: '800' }, providerFootnote: { color: '#6e6875', fontSize: 10, lineHeight: 15, textAlign: 'center', marginTop: 12, paddingHorizontal: 12 },
  libraryTabs: { flexDirection: 'row', gap: 7, padding: 5, borderRadius: 16, backgroundColor: '#100a18', borderWidth: 1, borderColor: '#342043', marginBottom: 12 }, libraryTab: { flex: 1, minHeight: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 12 }, libraryTabActive: { backgroundColor: '#2b1636', borderWidth: 1, borderColor: '#9858ba' }, libraryTabText: { color: '#86788f', fontSize: 11, fontWeight: '900' }, libraryTabTextActive: { color: '#f3dfff' },
  librarySearch: { height: 48, borderRadius: 15, borderWidth: 1, borderColor: '#3d2850', backgroundColor: '#0e0915', color: '#f6eff9', paddingHorizontal: 15, fontSize: 14, marginBottom: 12 }, libraryFilterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 9 }, libraryChip: { paddingHorizontal: 11, paddingVertical: 8, borderRadius: 16, borderWidth: 1, borderColor: '#392848', backgroundColor: '#100b17' }, libraryChipActive: { borderColor: '#ff765a', backgroundColor: '#2a151d' }, libraryChipText: { color: '#93879c', fontSize: 10, fontWeight: '800' }, libraryChipTextActive: { color: '#ffab91' }, librarySortChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12 }, librarySortChipActive: { backgroundColor: '#28183a' }, librarySortText: { color: '#b69bc8', fontSize: 9, fontWeight: '900' },
  favoriteRoute: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 17, borderWidth: 1, borderColor: '#4b315f', backgroundColor: '#130c1d', marginBottom: 9 }, favoriteRouteTitle: { color: '#f4edf7', fontSize: 13, fontWeight: '900' }, favoriteRouteMeta: { color: '#8f8398', fontSize: 10, marginTop: 5 }, favoriteRouteCount: { color: '#ff8d70', fontSize: 17, fontWeight: '900' }, libraryJourneyWrap: { position: 'relative' }, libraryAddButton: { position: 'absolute', right: 12, bottom: 11, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 11, backgroundColor: '#281636', borderWidth: 1, borderColor: '#65427a' }, libraryAddText: { color: '#d2adf3', fontSize: 9, fontWeight: '900' },
});
