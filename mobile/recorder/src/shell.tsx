import { requestJourneyLocationAccess } from './location-permissions';
import { loadReplayPhotos } from './journey-replay-photos';
import { TouchPressable, ExpandingSection } from './touch-feedback';
import { MemoryJourneyEditor, MemorySaveLabel } from './memory-edit-motion';
import { useAppTheme, useThemedStyles } from './app-theme';
import { AppIconPicker } from './app-icon-picker';
import { appIconCatalog } from './app-icon-catalog';
import { useAppIconChoice } from './app-icon-preference';
import { ThemePicker } from './theme-picker';
import { settingsCategories, type SettingsCategoryId } from './settings-categories';
import { isIpad } from './device-layout';
import { useAdaptiveLayout, verticalFoldContentColumns } from './adaptive-layout';
import { HomeLayoutEditorSheet, useHomeWidgetLayout } from './home-widget-grid';
import { HOME_SUMMARY_WIDGETS, selectHomePresentation, type HomeWidgetId } from './home-widget-layout';
import { journeyDeckElevation, journeyDeckRadius, journeyDeckSemanticColors, journeyDeckSpacing, journeyDeckTypography } from './journeydeck-design-tokens';
import { FiftyStatesHomeWidget } from './fifty-states-ui';
import { AskJourneyDeckWidget } from './ask-journeydeck-widget';
import { TESSIE_INTEGRATION_ENABLED, V3_ASK_JOURNEYDECK_ENABLED } from './release-features';
import { IpadHomeScreen } from './ipad-home';
import { IpadStatisticsScreen } from './ipad-statistics-screen';
import { PhoneTabTitle } from './phone-tab-title';
import { IpadMemoriesScreen } from './ipad-memories-screen';
import { SettingsScrollView } from './settings-scroll-view';
import { IpadSettingsScreen } from './ipad-settings-screen';
import { TessieConnectionCard } from './tessie-connection-card';
import { syncTessieCaptureBestEffort, tessieDirectStatus } from './tessie-direct';
import { ActiveJourneyDetailsSheet, JourneyInProgressWidget, YourCarWidget, type ActiveJourneyProgress } from './tessie-home-widgets';
import { AchievementsOverview } from './achievements-overview';
import { JourneyImage } from './journey-image';
import { useCallback, useContext, useEffect, useMemo, useRef, useState, type ComponentType, type ReactNode } from 'react';
import {
  AccessibilityInfo, ActivityIndicator, Alert, Animated, AppState, Image, ImageBackground, Keyboard, Linking, Modal, Pressable,
  SafeAreaView, ScrollView, StyleSheet, Switch, Text, TextInput, View, useWindowDimensions,
} from 'react-native';
import { useUpdateRestart } from './use-update-restart';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import * as AppleAuthentication from 'expo-apple-authentication';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from 'expo-glass-effect';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import { BlurView } from 'expo-blur';
import { Image as ExpoImage } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { MeshGradientView } from 'expo-mesh-gradient';
import { router, useLocalSearchParams, usePathname } from 'expo-router';
import { NativeNavigationContext, tabPaths, useJourneyDeckNavigation } from './native-navigation-context';
import { useJourneyDetail } from './use-journey-detail';
import { NativeSheet, requestSheetClose } from './native-sheet';
import { CardDetailLink, useCardDetailDismissal } from './card-detail-link';
import { MemoryFlipImageContext } from './memory-flip';
import { openJourneyCardAction, useJourneyCardAction } from './journey-card-action';
import { NativeActionMenu } from './native-action-menu';
import { DetailScreenFrame, useDetailViewportInsets } from './detail-screen-frame';
import Svg, { Circle, Defs, LinearGradient as SvgLinearGradient, Path, Polyline, RadialGradient as SvgRadialGradient, Rect, Stop } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Reanimated, {
  Extrapolation, FadeIn, FadeInDown, FadeInUp, FadeOut, cancelAnimation, interpolate,
  useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSpring, withTiming,
} from 'react-native-reanimated';
import { ObserveInteractiveMarker } from 'expo-observe';
import { haptics } from './haptics';
import { MOTION_SPRINGS, motionEasing, useMotionPreferences } from './motion';
import { JourneyCardEntryTracker } from './core-experience-motion';
import { useListRowMotion } from './list-motion';
import { JourneyListSkeleton } from './list-skeleton';

import {
  appDataClient, type AppDashboard, type ConnectionCapabilities, type JourneyDetail,
  type JourneyMemory, type JourneyPhoto, type JourneySummary, type MemoriesCatalog, type ProviderPreferences,
} from './app-data';
import {
  isLastFmConnected, isMusicProviderAvailable, loadLastFmUsername, loadMusicPreferences, saveLastFmUsername, saveMusicPreferences, toApiMusicProvider,
  type MusicPreferences, type MusicProvider,
} from './music-preferences';
import {
  authorizeAppleMusic, authorizeShazamMicrophone, getMusicCapabilityStatus,
  isJourneyDeckMusicNativeAvailable, type JourneyDeckMusicCapabilityStatus,
} from '../modules/journeydeck-music';
import { syncRecentLastFmNow } from './lastfm-sync';
import { beginSpotifyDirectConnection, finishSpotifyDirectConnection, spotifyDirectStatus, syncRecentSpotifyDirectNow } from './spotify-direct';
import { loadConnection } from './credentials';
import {
  loadRecordingModePreferences, saveRecordingModePreferences, type RecordingMode,
  type RecordingModePreferences,
} from './recording-mode';
import { ShareCardModal, type ShareCardPayload } from './share-card-modal';
import { MusicScreen, type MusicDashboardState } from './music-screen';
import { createIsolationTestProfile, getAppleIdentityStatus, getCurrentUser, isIsolationTestProfile, listLocalUsers, signInWithApple, switchActiveUser, type AppleIdentityStatus } from './auth';
import { deleteCurrentJourneyDeckAccount, finishProfileSwitch, prepareForProfileSwitch, signOutOfJourneyDeck } from './account-lifecycle';
import { getSensitivePlaces, type LocalPlace, type LocalUser } from './local-store';
import { PlaceDataCredits } from './place-data-credits';
import {
  loadCustomSavedPlaces, loadSavedPlaces, removeCustomSavedPlace, removeSavedPlace, saveCustomSavedPlace, saveSavedPlace,
  SAVED_PLACE_SLOTS, type CustomSavedPlace, type SavedPlaceSlot,
} from './saved-places';
import { observeJourneyDeckEvent } from './observability';
import { JourneyMarkerRoute } from './journey-markers';
import { journeyDeckMapPalette } from './journey-map-theme';
import { buildSongRouteMoments } from './route-moments';
import {
  classifyPrivateICloudSyncError,
  getPrivateICloudSyncBackoff,
  getPrivateICloudSyncFailureRecord,
  isPrivateICloudNativeAvailable,
  PrivateICloudSyncDeferredError,
  syncCurrentUserWithPrivateICloud,
} from './icloud-sync';
import { favoriteRoutes, filterJourneyLibrary, type JourneyLibraryFilter, type JourneyLibrarySort } from './library-model';
import { PrimaryMobilityMap } from './primary-mobility-map';
import { buildHomeSummary } from './home-summary';
import { journeyDisplayTitle } from './journey-title';
import { loadCityLabelForCoordinate } from './music-city-summary';
import { loadProfileAppearance, saveProfileAppearance, type ProfileAppearance } from './profile-appearance';
import { NeonWidgetOutline } from './neon-widget-outline';
import { CinematicPhotoGrade, HEADER_ARTWORK_ASPECT_RATIO } from './header-artwork';
import { headerImageSource } from './header-image-sources';
import { isInternalTestingBuild } from './internal-testing';
import { maskCoordinate, prepareShareCardCoords } from './privacy-masker';
import { trimPrivateShareRoute } from './share-route-privacy';
import { buildAccessibleMusicDashboard, loadPrimarySectionsData } from './primary-sections-data';
import { subscribeLocalArchiveChanges } from './local-archive-events';
import { forceAppleMusicArtworkRefreshAfterUpdate } from './music-capture';
import { completeWelcomeIntro, hasCompletedWelcomeIntro } from './welcome-intro';
import { lastPromptedShareJourneyId, markShareJourneyPrompted } from './share-prompt';
import { membershipCanAccessDate, type JourneyDeckMembershipEntitlements } from './membership-entitlements';
import { useJourneyDeckMembership } from './membership-store';
import { MembershipPaywall } from './membership-paywall';
import { completeFirstRun, loadFirstRunProgress, saveFirstRunProgress, type FirstRunProgress, type FirstRunStage } from './first-run-onboarding';
import { FirstRunOnboardingScreen } from './first-run-onboarding-screen';

function previousFirstRunStage(stage: Exclude<FirstRunStage, 'welcome' | 'complete'>): FirstRunProgress['stage'] {
  switch (stage) {
    case 'recording': return 'welcome';
    case 'location': return 'recording';
    case 'music': return 'location';
    case 'membership': return 'music';
    case 'tessie': return 'membership';
    case 'instructions': return TESSIE_INTEGRATION_ENABLED ? 'tessie' : 'membership';
  }
}
import { V3_FIFTY_STATES_ENABLED } from './release-features';
import {
  AtlasScreen, MoreScreen, type MoreDestination, type PrimaryDataState,
} from './primary-sections';

type Tab = 'music' | 'journeys' | 'home' | 'statistics' | 'settings';
type LoadState<T> = { status: 'loading' | 'ready' | 'error'; data: T; message?: string };
type PrivateCloudUiState = { status: 'unavailable' | 'idle' | 'syncing' | 'synced' | 'needs_icloud' | 'error'; detail: string };

function dashboardForMembership(
  dashboard: AppDashboard,
  membership: JourneyDeckMembershipEntitlements,
  accessibleAllTime?: AppDashboard['summary']['allTime'],
): AppDashboard {
  if (membership.timelineHistoryDays === null) return dashboard;
  const recentJourneys = dashboard.recentJourneys.filter(journey => membershipCanAccessDate(membership, journey.startedAt));
  const weeklyJourneys = dashboard.weeklyJourneys.filter(journey => membershipCanAccessDate(membership, journey.startedAt));
  const latestJourney = dashboard.latestJourney && membershipCanAccessDate(membership, dashboard.latestJourney.startedAt) ? dashboard.latestJourney : null;
  const safeAllTime = accessibleAllTime ?? recentJourneys.reduce((total, journey) => ({
    journeyCount: total.journeyCount + 1,
    miles: total.miles + journey.miles,
    minutes: total.minutes + journey.durationMinutes,
  }), { journeyCount: 0, miles: 0, minutes: 0 });
  return { ...dashboard, latestJourney, recentJourneys, weeklyJourneys, summary: { ...dashboard.summary, allTime: safeAllTime } };
}

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

async function chooseProfileAvatar() {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) throw new Error('Allow JourneyDeck to access your selected photos in iPhone Settings.');
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'], allowsMultipleSelection: false, allowsEditing: true, aspect: [1, 1], quality: 0.9,
  });
  if (result.canceled || !result.assets[0]) return null;
  const prepared = await manipulateAsync(result.assets[0].uri, [{ resize: { width: 384, height: 384 } }], {
    base64: true, compress: 0.68, format: SaveFormat.JPEG,
  });
  if (!prepared.base64) throw new Error('JourneyDeck could not prepare that profile image.');
  const dataUri = `data:image/jpeg;base64,${prepared.base64}`;
  if (dataUri.length > 420_000) throw new Error('That image is still too large. Try a different photo.');
  return dataUri;
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

const homeHeroImages = {
  morning: require('../assets/cinematic-home-morning-photo-v1.jpg'),
  afternoon: require('../assets/cinematic-home-afternoon-photo-v1.jpg'),
  evening: require('../assets/cinematic-home-evening-photo-v1.jpg'),
  night: require('../assets/cinematic-home-night-photo-v1.jpg'),
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
    id: 'shazam', name: 'Manual Song Recognition', kicker: 'TAP TO IDENTIFY · SHAZAMKIT', symbol: 'S', brand: 'shazam', color: '#56a8ff', tint: '#101d31',
    summary: 'Tap Identify Song during a journey for each song you want JourneyDeck to save.',
    benefits: ['Works with radio, CDs, Spotify, or another phone', 'No music account required', 'Audio is never saved by JourneyDeck'],
    drawbacks: ['You must tap for every song', 'JourneyDeck does not listen automatically in the background', 'Road noise or low volume can cause misses'],
    privacy: 'Each tap starts one brief listening session. Only the match and timestamp are kept; the microphone turns off afterward.',
  },
  {
    id: 'lastfm', name: 'Spotify history', kicker: 'IMPORTED VIA LAST.FM', symbol: '↻', brand: 'spotify', color: '#1ed760', tint: '#0d2116',
    summary: 'Import timestamped Spotify listening history through your Last.fm account.',
    benefits: ['Automatic Spotify history', 'No microphone needed', 'Works across Spotify devices'],
    drawbacks: ['Requires a Last.fm account with Spotify scrobbling', 'Sync can be delayed or miss tracks'],
    privacy: 'JourneyDeck reads only recent scrobbles from the public Last.fm username you provide.',
  },
];

const spotifyDirectOption: ProviderOption = {
  id: 'spotify-direct', name: 'Owner Spotify', kicker: 'PRIVATE OWNER PREVIEW', symbol: '▶', brand: 'spotify', color: '#1ed760', tint: '#0d2116',
  summary: 'Use Patrick’s allowlisted Spotify developer account directly on this iPhone.',
  benefits: ['Exact Spotify playback timestamps', 'Tokens stay in this iPhone Keychain', 'No JourneyDeck server storage'],
  drawbacks: ['Owner-only developer access', 'Not available to public JourneyDeck accounts'],
  privacy: 'The privacy edge exchanges PKCE codes without storing tokens. Spotify history goes directly to this iPhone.',
};

const publicProviderOptions = providerOptions.filter(option => isMusicProviderAvailable(option.id));
const allProviderOptions = [...providerOptions, spotifyDirectOption];

function selectableProviderOptions(ownerSpotifyEnabled: boolean) {
  return isInternalTestingBuild() && ownerSpotifyEnabled ? allProviderOptions : publicProviderOptions;
}

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

type RecorderComponent = ComponentType<{
  onClose: () => void;
  presentation?: 'screen' | 'home' | 'ipad-home';
  showManualSongButton?: boolean;
  onJourneyChange?: () => void;
  onActivityChange?: (active: boolean) => void;
  onProgressChange?: (progress: ActiveJourneyProgress | null) => void;
}>;

export function JourneyDeckShell({ recorder, children }: { recorder: RecorderComponent; children: ReactNode }) {
  const [profileRevision, setProfileRevision] = useState(0);
  return <JourneyDeckShellContent key={profileRevision} recorder={recorder} onProfileChanged={() => setProfileRevision(revision => revision + 1)}>{children}</JourneyDeckShellContent>;
}

function JourneyDeckShellContent({ recorder: Recorder, onProfileChanged, children }: { recorder: RecorderComponent; onProfileChanged: () => void; children: ReactNode }) {
  const theme = useAppTheme();
  const styles = useThemedStyles(darkStyles);
  const adaptiveLayout = useAdaptiveLayout();

  const membershipStore = useJourneyDeckMembership();
  const membership = membershipStore.state.entitlements;
  const [tab, setTab] = useState<Tab>('home');
  const [homeRecorderActive, setHomeRecorderActive] = useState(false);
  const [homeJourneyProgress, setHomeJourneyProgress] = useState<ActiveJourneyProgress | null>(null);
  const [settingsEditorActive, setSettingsEditorActive] = useState(false);
  const tabRef = useRef<Tab>('home');
  const [preferences, setPreferences] = useState<MusicPreferences | null>(null);
  const [recordingPreferences, setRecordingPreferences] = useState<RecordingModePreferences | null>(null);
  const [firstRunProgress, setFirstRunProgress] = useState<FirstRunProgress | null>(() => loadFirstRunProgress());
  const [editingRecordingMode, setEditingRecordingMode] = useState(false);
  const [editingProvider, setEditingProvider] = useState(false);
  const [musicCapabilities, setMusicCapabilities] = useState<JourneyDeckMusicCapabilityStatus | null>(null);
  const [connectionCapabilities, setConnectionCapabilities] = useState<ConnectionCapabilities>({ lastFmConfigured: false, tessieConfigured: false });
  const [lastFmUsername, setLastFmUsername] = useState('');
  const [editingLastFm, setEditingLastFm] = useState(false);
  const [lastFmDraft, setLastFmDraft] = useState('');
  const [savingLastFm, setSavingLastFm] = useState(false);
  const [syncingLastFm, setSyncingLastFm] = useState(false);
  const [lastFmConnected, setLastFmConnected] = useState(false);
  const [ownerSpotifyEligible, setOwnerSpotifyEligible] = useState(false);
  const [spotifyOwnerState, setSpotifyOwnerState] = useState<'not_connected' | 'connecting' | 'connected' | 'syncing'>('not_connected');
  const [currentUser] = useState(() => getCurrentUser());
  const [appleIdentityStatus, setAppleIdentityStatus] = useState<AppleIdentityStatus>('unknown');
  const [signingInWithApple, setSigningInWithApple] = useState(false);
  const [accountActionPending, setAccountActionPending] = useState(false);
  const [privateCloud, setPrivateCloud] = useState<PrivateCloudUiState>(() => isPrivateICloudNativeAvailable()
    ? { status: 'idle', detail: 'Ready to sync privately through iCloud.' }
    : { status: 'unavailable', detail: 'Available after installing JourneyDeck 1.9.' });
  const [dashboard, setDashboard] = useState<LoadState<AppDashboard>>({ status: 'loading', data: blankDashboard() });
  const [journeys, setJourneys] = useState<LoadState<JourneySummary[]>>({ status: 'loading', data: [] });
  const [journeyCursor, setJourneyCursor] = useState<string | null>(null);
  const [journeysLoadingMore, setJourneysLoadingMore] = useState(false);
  const [memories, setMemories] = useState<LoadState<MemoriesCatalog>>({ status: 'loading', data: { memories: [] } });
  const [musicDashboard, setMusicDashboard] = useState<MusicDashboardState>({ status: 'loading', data: null });
  const [primarySections, setPrimarySections] = useState<PrimaryDataState>({ status: 'loading', data: null });
  const [moreDestination, setMoreDestination] = useState<MoreDestination>('menu');
  const utilityVisible = usePathname() === '/tools';
  const [membershipPaywallVisible, setMembershipPaywallVisible] = useState(false);
  const preferenceSyncAttempt = useRef('');
  const musicRefreshGeneration = useRef(0);

  useEffect(() => {
    let alive = true;
    void loadMusicPreferences().then(value => { if (alive) setPreferences(value); });
    setRecordingPreferences(loadRecordingModePreferences());
    void loadLastFmUsername().then(async value => { if (alive) { setLastFmUsername(value); setLastFmDraft(value); setLastFmConnected(await isLastFmConnected(value)); } });
    if (isInternalTestingBuild()) {
      void Promise.all([loadConnection(), spotifyDirectStatus()]).then(([connection, status]) => {
        if (!alive) return;
        setOwnerSpotifyEligible(Boolean(connection));
        setSpotifyOwnerState(status);
      });
    }
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!preferences || !recordingPreferences || firstRunProgress) return;
    if (preferences.onboardingCompleted && recordingPreferences.onboardingCompleted) return;
    setFirstRunProgress(saveFirstRunProgress({
      stage: hasCompletedWelcomeIntro() ? 'recording' : 'welcome',
      recordingMode: recordingPreferences.mode,
    }));
  }, [firstRunProgress, preferences, recordingPreferences]);

  useEffect(() => {
    if (!TESSIE_INTEGRATION_ENABLED) return;
    let current = true;
    void tessieDirectStatus().then(status => {
      if (!current || status !== 'connected') return;
      const recording = loadRecordingModePreferences();
      if (recording.onboardingCompleted && recording.mode !== 'automatic') {
        setRecordingPreferences(saveRecordingModePreferences({ mode: 'automatic', onboardingCompleted: true }));
      }
    }).catch(() => undefined);
    return () => { current = false; };
  }, []);


  useEffect(() => {
    if (!isInternalTestingBuild()) return undefined;
    let finishingSpotify = false;
    const finish = (url: string) => {
      if (finishingSpotify || !url.startsWith('journeydeck-recorder://spotify-callback')) return;
      finishingSpotify = true;
      void finishSpotifyDirectConnection(url).then(handled => {
        if (!handled) return;
        setSpotifyOwnerState('connected');
        Alert.alert('Owner Spotify connected', 'Recent playback can now be matched directly on this iPhone.');
      }).catch(error => {
        setSpotifyOwnerState('not_connected');
        Alert.alert('Spotify did not connect', error instanceof Error ? error.message : 'Try again from Settings.');
      }).finally(() => { finishingSpotify = false; });
    };
    const subscription = Linking.addEventListener('url', event => finish(event.url));
    void Linking.getInitialURL().then(url => { if (url) finish(url); });
    return () => subscription.remove();
  }, []);

  const refreshDashboard = useCallback(async (refreshRemote = false) => {
    setDashboard(current => ({ ...current, status: 'loading', message: undefined }));
    try {
      const data = await appDataClient.dashboard(refreshRemote);
      setDashboard({ status: 'ready', data: dashboardForMembership(data, membership, primarySections.data?.dashboard.summary.allTime) });
    } catch {
      const local = await appDataClient.localDashboard();
      setDashboard({ status: 'error', data: dashboardForMembership(local, membership, primarySections.data?.dashboard.summary.allTime), message: 'Showing what is safe on this iPhone. Journey history will return when JourneyDeck is reachable.' });
    }
  }, [membership, primarySections.data?.dashboard.summary.allTime]);

  const refreshJourneys = useCallback(async (refreshRemote = false) => {
    setJourneys(current => ({ ...current, status: 'loading', message: undefined }));
    try {
      const result = await appDataClient.journeys(25, undefined, refreshRemote);
      const visibleItems = result.items.filter(item => membershipCanAccessDate(membership, item.startedAt));
      setJourneys({ status: 'ready', data: visibleItems });
      setJourneyCursor(visibleItems.length === result.items.length ? result.nextCursor : null);
    } catch {
      setJourneys(current => ({ status: 'error', data: current.data, message: 'Journey history is unavailable right now. Your recordings are still safe.' }));
    }
  }, [membership]);

  const refreshMemories = useCallback(async (refreshRemote = false) => {
    setMemories(current => ({ ...current, status: 'loading', message: undefined }));
    try { setMemories({ status: 'ready', data: await appDataClient.memories(refreshRemote) }); }
    catch { setMemories(current => ({ status: 'error', data: current.data, message: 'Memories could not refresh. Your saved journeys are still safe.' })); }
  }, []);

  const refreshMusicDashboard = useCallback(async (refreshRemote = false, details?: JourneyDetail[]) => {
    const refreshGeneration = ++musicRefreshGeneration.current;
    const effectiveDetails = details ?? primarySections.data?.details ?? [];
    setMusicDashboard(current => ({ ...current, status: 'loading', message: undefined }));
    try {
      const data = await appDataClient.musicDashboard(refreshRemote, effectiveDetails);
      if (refreshGeneration !== musicRefreshGeneration.current) return;
      const accessibleJourneys = primarySections.data?.journeys ?? journeys.data;
      setMusicDashboard({ status: 'ready', data: membership.timelineHistoryDays === null ? data : buildAccessibleMusicDashboard(accessibleJourneys, effectiveDetails, data) });
    }
    catch (error) {
      if (refreshGeneration !== musicRefreshGeneration.current) return;
      setMusicDashboard(current => ({ status: 'error', data: current.data, message: error instanceof Error ? error.message : 'Your music archive could not be loaded.' }));
    }
  }, [membership.timelineHistoryDays, primarySections.data?.details, primarySections.data?.journeys, journeys.data]);

  const loadMoreJourneys = useCallback(async () => {
    if (!journeyCursor || journeysLoadingMore) return;
    setJourneysLoadingMore(true);
    try {
      const result = await appDataClient.journeys(25, journeyCursor);
      const visibleItems = result.items.filter(item => membershipCanAccessDate(membership, item.startedAt));
      setJourneys(current => {
        const existing = new Set(current.data.map(item => item.id));
        return { status: 'ready', data: [...current.data, ...visibleItems.filter(item => !existing.has(item.id))] };
      });
      setJourneyCursor(visibleItems.length === result.items.length ? result.nextCursor : null);
    } catch {
      setJourneys(current => ({ ...current, message: 'More journeys could not be loaded yet. Try again when JourneyDeck is connected.' }));
    } finally {
      setJourneysLoadingMore(false);
    }
  }, [journeyCursor, journeysLoadingMore, membership]);

  const refreshAppleIdentity = useCallback(async () => {
    setAppleIdentityStatus(await getAppleIdentityStatus(getCurrentUser()));
  }, []);

  const refreshPrimarySections = useCallback(async (forceRefresh = false) => {
    setPrimarySections(current => ({ ...current, status: 'loading', message: undefined }));
    try {
      const data = await loadPrimarySectionsData(forceRefresh, membership);
      setPrimarySections({ status: 'ready', data });
      setDashboard({ status: 'ready', data: data.dashboard });
      setJourneys({ status: 'ready', data: data.journeys });
      setJourneyCursor(null);
      setMemories({ status: 'ready', data: data.memories });
      musicRefreshGeneration.current += 1;
      setMusicDashboard({ status: 'ready', data: data.music });
    } catch (error) {
      setPrimarySections(current => ({ status: 'error', data: current.data, message: error instanceof Error ? error.message : 'Some JourneyDeck data could not refresh.' }));
    }
  }, [membership]);

  const syncPrivateCloud = useCallback(async (announce = false) => {
    if (isIsolationTestProfile()) {
      const detail = 'Paused for the temporary clean-profile isolation test.';
      setPrivateCloud({ status: 'idle', detail });
      if (announce) Alert.alert('Private iCloud is paused', detail);
      return;
    }
    if (!isPrivateICloudNativeAvailable()) {
      setPrivateCloud({ status: 'unavailable', detail: 'Available after installing JourneyDeck 1.9.' });
      return;
    }
    // Automatic triggers wait out a failure backoff silently; the Sync button
    // (announce) always retries now.
    if (!announce && getPrivateICloudSyncBackoff()) return;
    setPrivateCloud({ status: 'syncing', detail: 'Checking iCloud zone…' });
    try {
      const result = await syncCurrentUserWithPrivateICloud({ force: announce });
      if (result.accountStatus !== 'available') {
        const detail = result.accountStatus === 'no_account' ? `Sign into iCloud in ${isIpad() ? 'iPad' : 'iPhone'} Settings to enable private sync.` : 'Private iCloud is unavailable right now; local data remains safe.';
        setPrivateCloud({ status: 'needs_icloud', detail });
        if (announce) Alert.alert('Private iCloud is not available', detail);
        observeJourneyDeckEvent('cloudkit.sync_failed', { stage: 'account_status', reason: result.accountStatus });
        return;
      }
      const awaitingNative = result.privateContentVersion < 2 ? result.state.pendingUploadCount : 0;
      const pending = awaitingNative ? 0 : result.state.pendingUploadCount;
      const summary = `${result.uploaded} uploaded · ${result.downloaded} downloaded${result.failedUploads ? ` · ${result.failedUploads} need${result.failedUploads === 1 ? 's' : ''} attention` : ''}${pending ? ` · ${pending} ${pending === 1 ? 'item' : 'items'} still waiting to upload.${result.failedUploads ? '' : ' Tap Sync again to continue.'}` : ''}${awaitingNative ? ` · ${awaitingNative} private items waiting for the next native build` : ''}`;
      const detail = [summary, ...(result.issueDetails ?? [])].join('\n\n');
      setPrivateCloud({ status: result.failedUploads ? 'error' : awaitingNative || pending ? 'idle' : 'synced', detail });
      if (result.failedUploads && !result.reused) {
        const failure = getPrivateICloudSyncFailureRecord();
        observeJourneyDeckEvent('cloudkit.sync_failed', {
          stage: 'partial_upload', error_category: 'partial_upload', failed_count: result.failedUploads,
          consecutive_failures: failure?.consecutiveFailures ?? 1,
        });
      }
      if (announce) Alert.alert(result.failedUploads ? 'Private iCloud needs attention' : pending || awaitingNative ? 'Private iCloud sync is incomplete' : 'Private iCloud sync finished', detail);
      // Refresh the shared library snapshot only when this sync restored or
      // removed records. A full reload walks the whole archive.
      if (!result.reused && (result.downloaded > 0 || result.deletedRecordNames.length > 0)) await refreshPrimarySections(false);
    } catch (error) {
      if (error instanceof PrivateICloudSyncDeferredError) {
        // Lost a race with a failure recorded after the pre-check. No CloudKit work ran.
        setPrivateCloud({ status: 'error', detail: `${error.message}\n\nEverything remains saved on this ${isIpad() ? 'iPad' : 'iPhone'}.` });
        return;
      }
      const failure = getPrivateICloudSyncFailureRecord();
      observeJourneyDeckEvent('cloudkit.sync_failed', {
        stage: 'sync_exception',
        error_category: classifyPrivateICloudSyncError(error),
        consecutive_failures: failure?.consecutiveFailures ?? 1,
        retry_in_seconds: failure ? Math.max(0, Math.round((failure.nextAttemptAt - Date.now()) / 1000)) : 0,
        user_initiated: announce,
      });
      const reason = error instanceof Error && error.message.trim()
        ? error.message.trim()
        : 'CloudKit did not return an error description.';
      const detail = `${reason}\n\nEverything remains saved on this ${isIpad() ? 'iPad' : 'iPhone'}.`;
      setPrivateCloud({ status: 'error', detail });
      if (announce) Alert.alert('Private iCloud will retry', detail);
    }
  }, [refreshPrimarySections]);

  const createProfileIsolationTest = useCallback(() => {
    if (dashboard.data.recorder.state !== 'ready') {
      Alert.alert('Finish the active journey first', 'Profile switching is disabled while the recorder is active.');
      return;
    }
    Alert.alert('Create a clean test profile?', 'Your current profile and all of its data will remain unchanged. JourneyDeck will reload into a separate empty local profile.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Create test profile', onPress: () => void (async () => {
        try {
          await prepareForProfileSwitch();
          createIsolationTestProfile();
          onProfileChanged();
        } catch (error) {
          Alert.alert('Test profile was not created', error instanceof Error ? error.message : 'No profile data was changed.');
        } finally { finishProfileSwitch(); }
      })() },
    ]);
  }, [dashboard.data.recorder.state, onProfileChanged]);

  const switchProfileForTest = useCallback((userId: string) => {
    if (dashboard.data.recorder.state !== 'ready') {
      Alert.alert('Finish the active journey first', 'Profile switching is disabled while the recorder is active.');
      return;
    }
    void (async () => {
      try {
        await prepareForProfileSwitch();
        const user = switchActiveUser(userId);
        if (!user) { Alert.alert('Profile unavailable', 'JourneyDeck could not find that local profile. No data was changed.'); return; }
        onProfileChanged();
      } catch (error) {
        Alert.alert('Profile was not changed', error instanceof Error ? error.message : 'No profile data was changed.');
      } finally { finishProfileSwitch(); }
    })();
  }, [dashboard.data.recorder.state, onProfileChanged]);

  const signOutJourneyDeck = useCallback(() => {
    if (dashboard.data.recorder.state !== 'ready') {
      Alert.alert('Finish the active journey first', 'Sign-out is disabled while the recorder is active.');
      return;
    }
    Alert.alert('Sign out of JourneyDeck?', 'This switches to a new empty local profile. Your current profile, private iCloud backup, and data stay intact so you can sign in again.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', onPress: () => void (async () => {
        setAccountActionPending(true);
        try {
          await signOutOfJourneyDeck();
          onProfileChanged();
        } catch (error) {
          Alert.alert('Sign-out did not finish', error instanceof Error ? error.message : 'Your profile was not changed.');
          setAccountActionPending(false);
        }
      })() },
    ]);
  }, [dashboard.data.recorder.state, onProfileChanged]);

  const deleteJourneyDeckAccount = useCallback(() => {
    if (dashboard.data.recorder.state !== 'ready') {
      Alert.alert('Finish the active journey first', 'Account deletion is disabled while the recorder is active.');
      return;
    }
    Alert.alert('Delete this JourneyDeck account?', 'This permanently removes this profile’s private iCloud backup, exact routes, photos, Journeys, Memories, preferences, and Keychain connections. This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Continue', style: 'destructive', onPress: () => Alert.alert('Final confirmation', `Permanently delete ${currentUser.displayName || 'this profile'} everywhere?`, [
        { text: 'Keep account', style: 'cancel' },
        { text: 'Delete forever', style: 'destructive', onPress: () => void (async () => {
          setAccountActionPending(true);
          try {
            await deleteCurrentJourneyDeckAccount();
            onProfileChanged();
          } catch (error) {
            Alert.alert('Account was not deleted', error instanceof Error ? error.message : 'Your local profile was kept so deletion can be retried safely.');
            setAccountActionPending(false);
          }
        })() },
      ]) },
    ]);
  }, [currentUser.displayName, dashboard.data.recorder.state, onProfileChanged]);

  const connectAppleIdentity = useCallback(async () => {
    if (dashboard.data.recorder.state !== 'ready') {
      Alert.alert('Finish the active journey first', 'Apple sign-in can switch driver profiles, so it is disabled while the recorder is active.');
      return;
    }
    setSigningInWithApple(true);
    try {
      await signInWithApple(prepareForProfileSwitch);
      onProfileChanged();
    } catch (error) {
      if ((error as { code?: string }).code !== 'ERR_REQUEST_CANCELED') {
        Alert.alert('Apple sign-in did not finish', error instanceof Error ? error.message : 'Try again from Settings. Your local data was not changed.');
      }
    } finally {
      finishProfileSwitch();
      setSigningInWithApple(false);
    }
  }, [dashboard.data.recorder.state, onProfileChanged]);

  useEffect(() => { if (tab === 'home') void refreshDashboard(); }, [refreshDashboard, tab]);
  useEffect(() => { void refreshPrimarySections(false); }, [refreshPrimarySections]);
  useEffect(() => { if (TESSIE_INTEGRATION_ENABLED) void syncTessieCaptureBestEffort().then(() => refreshPrimarySections(false)).catch(() => undefined); }, [currentUser.id, refreshPrimarySections]);
  useEffect(() => { void forceAppleMusicArtworkRefreshAfterUpdate().catch(() => undefined); }, []);
  useEffect(() => subscribeLocalArchiveChanges(() => { void refreshPrimarySections(false); if (tab === 'home') void refreshDashboard(); }), [refreshDashboard, refreshPrimarySections, tab]);
  useEffect(() => { void refreshAppleIdentity(); void syncPrivateCloud(false); }, [refreshAppleIdentity, syncPrivateCloud]);
  useEffect(() => { if (tab === 'journeys') { void refreshJourneys(); void refreshMemories(); } }, [refreshJourneys, refreshMemories, tab]);
  useEffect(() => { if (tab === 'music') void refreshMusicDashboard(true); }, [refreshMusicDashboard, tab]);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') {
        if (TESSIE_INTEGRATION_ENABLED) void syncTessieCaptureBestEffort().then(() => refreshPrimarySections(false)).catch(() => undefined);
        void refreshAppleIdentity();
        void syncPrivateCloud(false);
        void refreshDashboard();
        if (tab === 'journeys') void refreshJourneys();
        if (tab === 'music') void refreshMusicDashboard();
      }
    });
    return () => subscription.remove();
  }, [refreshAppleIdentity, refreshDashboard, refreshJourneys, refreshMusicDashboard, syncPrivateCloud, tab]);

  useEffect(() => {
    if (!preferences?.provider || !preferences.onboardingCompleted || dashboard.status !== 'ready' || !dashboard.data.recorder.connected) return;
    const desired = toApiMusicProvider(preferences.provider), remote = dashboard.data.providerPreferences;
    if (!desired) return;
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

  const refreshMusicCapabilities = useCallback(async () => {
    try { setMusicCapabilities(await getMusicCapabilityStatus()); }
    catch { setMusicCapabilities(null); }
  }, []);

  useEffect(() => { void refreshMusicCapabilities(); }, [refreshMusicCapabilities]);

  const refreshConnectionCapabilities = useCallback(async () => {
    try {
      setConnectionCapabilities(await appDataClient.connectionCapabilities());
      const username = await loadLastFmUsername();
      setLastFmConnected(await isLastFmConnected(username));
    }
    catch { setConnectionCapabilities({ lastFmConfigured: false, tessieConfigured: false }); }
  }, []);

  useEffect(() => {
    if (!utilityVisible && tab !== 'settings') return;
    void refreshMusicCapabilities();
    void refreshConnectionCapabilities();
  }, [membershipStore.state.status.tier, refreshConnectionCapabilities, refreshMusicCapabilities, tab, utilityVisible]);

  const chooseProvider = useCallback(async (provider: MusicProvider) => {
    if (!isMusicProviderAvailable(provider)) {
      Alert.alert('That music method is not available', 'Choose another music method.');
      return;
    }
    const next = { provider, onboardingCompleted: true };
    await saveMusicPreferences(next);
    setPreferences(next);
    setEditingProvider(false);
    const desired = toApiMusicProvider(provider);
    if (!desired) return;
    const existing = await appDataClient.providerPreferences().catch(() => null);
    await appDataClient.updateProviderPreferences({
      musicProvider: desired,
      onboardingCompleted: true,
      connections: existing?.connections ?? defaultConnections,
    }).catch(() => null);
    void refreshDashboard(true);
  }, [refreshDashboard]);

  const chooseRecordingMode = useCallback(async (_mode: RecordingMode) => {
    const next = saveRecordingModePreferences({ mode: 'manual', onboardingCompleted: true });
    setRecordingPreferences(next);
    setEditingRecordingMode(false);
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
      Alert.alert('Manual Song Recognition is not ready', 'ShazamKit requires the installed JourneyDeck app and its Apple developer capability before it can ask for microphone access.');
      return;
    }
    try {
      const status = await authorizeShazamMicrophone();
      await refreshMusicCapabilities();
      await saveConnectionState({ shazam: status === 'authorized' ? 'enabled' : status === 'denied' || status === 'restricted' ? 'permission_denied' : 'not_enabled' }, providerOverride, true);
      Alert.alert(status === 'authorized' ? 'Manual Song Recognition enabled' : 'Microphone access was not enabled', status === 'authorized' ? 'During an active journey, open the recorder and tap Identify Song for every track you want to save. JourneyDeck never listens automatically.' : 'Recording still works without music recognition.');
    } catch {
      Alert.alert('Manual Song Recognition could not be enabled', 'Nothing changed. Recording will continue to work normally.');
    }
  }, [musicCapabilities, refreshMusicCapabilities, saveConnectionState]);

  const saveLastFm = useCallback(async () => {
    if (!isMusicProviderAvailable('lastfm')) return;
    setSavingLastFm(true);
    try {
      await saveLastFmUsername(lastFmDraft);
      const normalized = lastFmDraft.trim();
      setLastFmUsername(normalized);
      setLastFmDraft(normalized);
      setLastFmConnected(await isLastFmConnected(normalized));
      setEditingLastFm(false);
      if (normalized) Alert.alert('Last.fm username saved', `JourneyDeck will try to match scrobbles for ${normalized} after your next completed journey.`);
    } catch (error) {
      Alert.alert('Check the Last.fm username', error instanceof Error ? error.message : 'That username could not be saved.');
    } finally {
      setSavingLastFm(false);
    }
  }, [lastFmDraft]);

  const syncLastFmNow = useCallback(async () => {
    if (!isMusicProviderAvailable('lastfm')) return;
    setSyncingLastFm(true);
    try {
      const result = await syncRecentLastFmNow();
      if (result.succeeded > 0) {
        setLastFmConnected(true);
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

  const connectSpotifyOwner = useCallback(async () => {
    if (!isInternalTestingBuild()) return;
    setSpotifyOwnerState('connecting');
    try { await beginSpotifyDirectConnection(); }
    catch (error) {
      setSpotifyOwnerState('not_connected');
      Alert.alert('Spotify could not open', error instanceof Error ? error.message : 'Try again from Settings.');
    }
  }, []);

  const syncSpotifyOwner = useCallback(async () => {
    if (!isInternalTestingBuild()) return;
    setSpotifyOwnerState('syncing');
    try {
      const result = await syncRecentSpotifyDirectNow();
      setSpotifyOwnerState('connected');
      Alert.alert('Owner Spotify sync finished', result.attempted === 0 ? 'Finish a journey first.' : result.matchedTracks ? `${result.matchedTracks} new songs matched recent journeys.` : 'The connection worked. No new songs matched those journey times.');
    } catch (error) {
      setSpotifyOwnerState(await spotifyDirectStatus());
      Alert.alert('Owner Spotify sync did not finish', error instanceof Error ? error.message : 'Try again later. Recording is unaffected.');
    }
  }, []);

  const onTabFocus = useCallback((next: Tab) => {
    if (tabRef.current === next) return;
    Keyboard.dismiss();
    tabRef.current = next;
    setTab(next);
  }, []);
  const openJourney = (id: string) => router.navigate({ pathname: '/journey/[id]', params: { id } });
  const openMemory = (id: string) => router.navigate({ pathname: '/memory/[id]', params: { id } });
  const openFiftyStates = () => { router.push('/fifty-states'); void haptics.selection(); };
  const openTab = (next: Tab) => {
    if (navigationReady) router.navigate(tabPaths[next]);
  };

  const openMore = (destination: MoreDestination) => {
    if (!isInternalTestingBuild()) return;
    setMoreDestination(destination);
    router.navigate('/tools');
    void haptics.selection();
  };

  const openAtlas = () => {
    if (!membership.atlasAccess) {
      setMembershipPaywallVisible(true);
      return;
    }
    router.navigate('/atlas');
    void haptics.selection();
  };

  const activePreferences = preferences?.onboardingCompleted && !editingProvider ? preferences : null;
  const activeRecordingPreferences = recordingPreferences?.onboardingCompleted && !editingRecordingMode ? recordingPreferences : null;
  const storedAppleMusicConnected = dashboard.data.providerPreferences?.connections.appleMusic === 'connected';
  const appleMusicConnected = musicCapabilities === null ? storedAppleMusicConnected : musicCapabilities.appleMusicAuthorizationStatus === 'authorized';
  const showManualSongButton = isMusicProviderAvailable('lastfm') ? activePreferences?.provider === 'shazam'
    : activePreferences?.provider !== 'apple-music' || !appleMusicConnected;
  const appReady = Boolean(activePreferences && activeRecordingPreferences);
  const fallbackFirstRunStage = preferences && recordingPreferences && !(preferences.onboardingCompleted && recordingPreferences.onboardingCompleted)
    ? (hasCompletedWelcomeIntro() ? 'recording' : 'welcome')
    : null;
  const firstRunStage = !editingRecordingMode && !editingProvider
    ? firstRunProgress?.stage === 'complete' ? null : firstRunProgress?.stage ?? fallbackFirstRunStage
    : null;
  const firstRunRecordingMode: RecordingMode = 'manual';
  const appVisible = appReady && !firstRunStage;
  useUpdateRestart({ ready: appVisible && dashboard.status === 'ready', recorderState: dashboard.data.recorder.state, recorderBusy: homeRecorderActive });
  // Keep the navigator and single recorder mounted while editing a provider.
  const enteredApp = useRef(false);
  if (appVisible) enteredApp.current = true;
  const navigationReady = appVisible || enteredApp.current;
  const membershipMemories = useMemo<LoadState<MemoriesCatalog>>(() => {
    const visibleJourneyIds = new Set(primarySections.data?.journeys.map(journey => journey.id) ?? journeys.data.map(journey => journey.id));
    const sanitizedMemoryItems = memories.data.memories.map(memory => ({
      ...memory,
      journeyIds: memory.journeyIds.filter(id => visibleJourneyIds.has(id)),
    }));
    const visibleMemoryItems = membership.timelineHistoryDays === null
      ? sanitizedMemoryItems
      : sanitizedMemoryItems.filter(memory => membershipCanAccessDate(membership, memory.createdAtUtc) || memory.journeyIds.length > 0);
    return { ...memories, data: { ...memories.data, memories: visibleMemoryItems } };
  }, [membership, memories, primarySections.data?.journeys, journeys.data]);

  const advanceFirstRun = (stage: FirstRunProgress['stage'], recordingMode: RecordingMode = firstRunRecordingMode) => {
    setFirstRunProgress(saveFirstRunProgress({ stage, recordingMode }));
  };

  const settingsPage = () => <ConnectionsScreen
    provider={preferences?.provider ?? 'apple-music'}
    connectionCapabilities={connectionCapabilities}
    currentUser={currentUser}
    appleIdentityStatus={appleIdentityStatus}
    signingInWithApple={signingInWithApple}
    accountActionPending={accountActionPending}
    privateCloud={privateCloud}
    membershipTier={membership.tier}
    membershipExpirationDate={membershipStore.state.status.expirationDate}
    journeys={primarySections.data?.journeys ?? journeys.data}
    memories={membershipMemories.data.memories}
    lastFmUsername={lastFmUsername}
    lastFmConnected={lastFmConnected}
    editingLastFm={editingLastFm}
    lastFmDraft={lastFmDraft}
    savingLastFm={savingLastFm}
    syncingLastFm={syncingLastFm}
    ownerSpotifyEligible={ownerSpotifyEligible}
    spotifyOwnerState={spotifyOwnerState}
    onDataHealth={() => openMore('health')}
    onMembership={() => membership.atlasAccess ? void Linking.openURL('https://apps.apple.com/account/subscriptions') : setMembershipPaywallVisible(true)}
    onSpotifyOwnerConnect={() => void connectSpotifyOwner()}
    onSpotifyOwnerSync={() => void syncSpotifyOwner()}
    onAppleSignIn={() => void connectAppleIdentity()}
    onPrivateCloudSync={() => void syncPrivateCloud(true)}
    onSignOut={signOutJourneyDeck}
    onDeleteAccount={deleteJourneyDeckAccount}
    onLastFmDraft={setLastFmDraft}
    onEditLastFm={() => setEditingLastFm(true)}
    onCancelLastFm={() => { setLastFmDraft(lastFmUsername); setEditingLastFm(false); }}
    onSaveLastFm={() => void saveLastFm()}
    onSyncLastFm={() => void syncLastFmNow()}
    onChangeProvider={() => setEditingProvider(true)}
    onTessieChanged={() => { void refreshConnectionCapabilities(); void refreshPrimarySections(false); }}
    onEditorActiveChange={setSettingsEditorActive}
  />;

  const navigationContent = {
    tabs: adaptiveLayout.isRegular ? {
      music: <MusicScreen state={musicDashboard} provider={preferences?.provider ?? 'apple-music'} journeys={(primarySections.data?.journeys ?? journeys.data).filter(journey => membershipCanAccessDate(membership, journey.startedAt))} details={primarySections.data?.details ?? []} onJourney={openJourney} onRefresh={() => refreshMusicDashboard(true, primarySections.data?.details ?? [])} />,
      journeys: <MemoriesScreen studio catalog={membershipMemories} journeys={{ ...journeys, data: (primarySections.data?.journeys ?? journeys.data).filter(journey => membershipCanAccessDate(membership, journey.startedAt)) }} details={primarySections.data?.details ?? []} historyLimited={membership.timelineHistoryDays !== null} onUpgrade={() => setMembershipPaywallVisible(true)} onJourney={openJourney} onMemory={openMemory} onFiftyStates={V3_FIFTY_STATES_ENABLED ? openFiftyStates : undefined} onRefresh={() => { void refreshMemories(false); void refreshPrimarySections(false); }} />,
      statistics: <IpadStatisticsScreen key={currentUser.id} state={primarySections} onRefresh={() => refreshPrimarySections(true)} onJourney={openJourney} onUpgrade={() => setMembershipPaywallVisible(true)} onAtlas={membership.atlasAccess ? openAtlas : undefined} onYearOnRoad={() => router.push('/year-on-road')} historyDays={membership.timelineHistoryDays} />,
      settings: settingsPage(),
      home: <IpadHomeScreen userId={currentUser.id} memories={membershipMemories.data.memories} journeys={(primarySections.data?.journeys ?? journeys.data).filter(journey => membershipCanAccessDate(membership, journey.startedAt))} music={musicDashboard.data}
        journeyProgress={homeJourneyProgress} vehicles={primarySections.data?.vehicle.vehicles ?? []} vehicleLoading={primarySections.status === 'loading' && !primarySections.data} vehicleError={primarySections.status === 'error'}
        onMemory={openMemory} onJourney={openJourney} onFiftyStates={V3_FIFTY_STATES_ENABLED ? openFiftyStates : undefined}
        loading={primarySections.status === 'loading' || musicDashboard.status === 'loading'} error={primarySections.status === 'error' ? 'Your saved library is temporarily unavailable.' : undefined}
        recorder={<Recorder presentation="ipad-home" showManualSongButton={showManualSongButton} onClose={() => undefined} onActivityChange={setHomeRecorderActive} onProgressChange={setHomeJourneyProgress} onJourneyChange={() => { void refreshDashboard(); void refreshPrimarySections(false); }} />} />,
    } : {
      music: <MusicScreen state={musicDashboard} provider={preferences?.provider ?? 'apple-music'} journeys={primarySections.data?.journeys ?? journeys.data} details={primarySections.data?.details ?? []} onJourney={openJourney} onRefresh={() => refreshMusicDashboard(true, primarySections.data?.details ?? [])} />,
      journeys: <MemoriesScreen studio catalog={membershipMemories} journeys={{ ...journeys, data: (primarySections.data?.journeys ?? journeys.data).filter(journey => membershipCanAccessDate(membership, journey.startedAt)) }} details={primarySections.data?.details ?? []} historyLimited={membership.timelineHistoryDays !== null} onUpgrade={() => setMembershipPaywallVisible(true)} onJourney={openJourney} onMemory={openMemory} onFiftyStates={V3_FIFTY_STATES_ENABLED ? openFiftyStates : undefined} onRefresh={() => { void refreshMemories(false); void refreshPrimarySections(false); }} />,
      home: <HomeScreen userId={currentUser.id} recorderActive={homeRecorderActive} primary={primarySections} journeyProgress={homeJourneyProgress} onSoundtracks={() => openTab('music')} onStatistics={() => openTab('statistics')} onJourney={openJourney} onFiftyStates={V3_FIFTY_STATES_ENABLED ? openFiftyStates : undefined} recorder={<Recorder presentation="home" showManualSongButton={showManualSongButton} onClose={() => undefined} onActivityChange={setHomeRecorderActive} onProgressChange={setHomeJourneyProgress} onJourneyChange={() => { void refreshDashboard(); void refreshPrimarySections(false); }} />} />,
      statistics: <IpadStatisticsScreen key={currentUser.id} compact state={primarySections} onRefresh={() => refreshPrimarySections(true)} onJourney={openJourney} onUpgrade={() => setMembershipPaywallVisible(true)} onAtlas={membership.atlasAccess ? openAtlas : undefined} onYearOnRoad={() => router.push('/year-on-road')} historyDays={membership.timelineHistoryDays} />,
      settings: settingsPage(),
    },
    memory: (id: string, onReady?: () => void) => <MemoriesScreen detailId={id} detailReady={onReady} catalog={membershipMemories} journeys={primarySections.data?.journeys?.length ? { status: 'ready', data: primarySections.data.journeys } : journeys} details={primarySections.data?.details ?? []} historyLimited={membership.timelineHistoryDays !== null} onUpgrade={() => setMembershipPaywallVisible(true)} onJourney={openJourney} onMemory={openMemory} onRefresh={() => { void refreshMemories(false); void refreshPrimarySections(false); }} />,
    atlas: membership.atlasAccess ? <AtlasScreen state={primarySections} onRefresh={() => refreshPrimarySections(true)} onJourney={openJourney} onBack={() => router.back()} /> : <InlineNotice message="Unlock Atlas to explore your driving patterns." onRetry={() => setMembershipPaywallVisible(true)} />,
    tools: isInternalTestingBuild() ? <MoreScreen active={utilityVisible} requested={moreDestination} onRequestedChange={setMoreDestination} onClose={() => router.back()} state={primarySections} dashboard={dashboard.data} privateCloud={privateCloud} appleIdentityStatus={appleIdentityStatus} providerCapabilities={connectionCapabilities} currentUser={currentUser} profiles={listLocalUsers()} onCreateProfileTest={createProfileIsolationTest} onSwitchProfile={switchProfileForTest} onRefresh={() => refreshPrimarySections(true)} onCloudSync={() => void syncPrivateCloud(true)} /> : settingsPage(),
    membership,
    refreshArchive: () => refreshPrimarySections(false),
    showUpgrade: () => setMembershipPaywallVisible(true),
    onTabFocus,
    tabBarHidden: settingsEditorActive,
  };

  return (
    <NativeNavigationContext.Provider value={navigationContent}><View style={styles.app}>
      {appVisible && primarySections.status !== 'loading' && <ObserveInteractiveMarker params={{ dataState: primarySections.status }} />}
      <View style={styles.screenBody}>
        {(!preferences || !recordingPreferences) && <AppLoading />}
        {firstRunStage && <FirstRunOnboardingScreen
          stage={firstRunStage}
          onWelcomeComplete={() => {
            completeWelcomeIntro();
            advanceFirstRun('recording');
          }}
          onRecordingContinue={async mode => {
            await chooseRecordingMode(mode);
            advanceFirstRun('location', mode);
          }}
          onLocationContinue={async () => {
            try {
              await requestJourneyLocationAccess();
              advanceFirstRun('music');
            } catch {
              Alert.alert('Location access unavailable', 'Please try again. You can also set location access in device Settings.');
            }
          }}
          onConnectAppleMusic={async () => {
            await chooseProvider('apple-music');
            await connectAppleMusic('apple-music');
            advanceFirstRun('membership');
          }}
          lastFmUsername={lastFmUsername}
          onConnectLastFm={async username => {
            await saveLastFmUsername(username);
            setLastFmUsername(username);
            setLastFmDraft(username);
            setLastFmConnected(await isLastFmConnected(username));
            await chooseProvider('lastfm');
            advanceFirstRun('membership');
          }}
          onSkipMusic={() => advanceFirstRun('membership')}
          tessieProfileId={currentUser.id}
          tessieMembershipTier={membership.tier}
          onTessieUpgrade={() => setMembershipPaywallVisible(true)}
          onTessieChanged={() => { void refreshConnectionCapabilities(); void refreshPrimarySections(false); }}
          onTessieContinue={() => advanceFirstRun('instructions')}
          onFinish={() => {
            setFirstRunProgress(completeFirstRun(firstRunRecordingMode));
            openTab('home');
          }}
          onBack={firstRunStage === 'welcome' ? undefined : () => advanceFirstRun(previousFirstRunStage(firstRunStage as Exclude<FirstRunStage, 'welcome' | 'complete'>))}
        />}
        {!firstRunStage && recordingPreferences && !activeRecordingPreferences && <RecordingModePicker
          initial={recordingPreferences.mode ?? 'manual'}
          onContinue={chooseRecordingMode}
          onCancel={recordingPreferences.onboardingCompleted ? () => setEditingRecordingMode(false) : undefined}
        />}
        {!firstRunStage && activeRecordingPreferences && preferences && !activePreferences && <ProviderPicker
          initial={preferences.provider ?? 'apple-music'}
          ownerSpotifyEnabled={ownerSpotifyEligible}
          lastFmUsername={lastFmUsername}
          onContinue={async (provider, username) => {
            if (provider === 'lastfm' && username) {
              await saveLastFmUsername(username);
              setLastFmUsername(username);
              setLastFmDraft(username);
              setLastFmConnected(await isLastFmConnected(username));
            }
            await chooseProvider(provider);
            if (provider === 'apple-music') await connectAppleMusic(provider);
            if (provider === 'shazam') await enableRecognition(provider);
            if (provider === 'spotify-direct') await connectSpotifyOwner();
          }}
          onCancel={preferences.onboardingCompleted ? () => setEditingProvider(false) : undefined}
        />}
        {navigationReady && <View style={[styles.primaryTabHost, !appVisible && { display: 'none' }]}>{children}</View>}
      </View>
      <MembershipPaywall
        visible={membershipPaywallVisible || firstRunStage === 'membership'}
        state={membershipStore.state}
        insight={dashboard.data.summary.allTime.journeyCount > 0 ? {
          journeyCount: dashboard.data.summary.allTime.journeyCount,
          milesLabel: formatMiles(dashboard.data.summary.allTime.miles),
          topTrack: primarySections.data?.music.recentSelections[0]
            ? { track: primarySections.data.music.recentSelections[0].track, artist: primarySections.data.music.recentSelections[0].artist }
            : null,
        } : null}
        onClose={() => {
          if (firstRunStage === 'membership') { advanceFirstRun(TESSIE_INTEGRATION_ENABLED ? 'tessie' : 'instructions'); return; }
          setMembershipPaywallVisible(false);
        }}
        onLoadProducts={membershipStore.loadProducts}
        onPurchase={async productId => membershipStore.purchase(productId).then(outcome => {
          if (outcome !== 'purchased') return;
          if (firstRunStage === 'membership') { advanceFirstRun(TESSIE_INTEGRATION_ENABLED ? 'tessie' : 'instructions'); return; }
          setMembershipPaywallVisible(false);
        })}
        onRestore={membershipStore.restore}
      />
    </View></NativeNavigationContext.Provider>
  );
}

function AppLoading() {
  const theme = useAppTheme();
  const styles = useThemedStyles(darkStyles);

  return <SafeAreaView style={styles.loadingScreen}><ActivityIndicator color={theme.color("#a88aff", 'text')} size="large" /><Text style={styles.loadingText}>Opening JourneyDeck…</Text></SafeAreaView>;
}

function WelcomeIntro({ onContinue }: { onContinue: () => void }) {
  const theme = useAppTheme();
  const styles = useThemedStyles(darkStyles);

  const routeReveal = useSharedValue(0);
  const { reduceMotion } = useMotionPreferences();

  useEffect(() => {
    routeReveal.value = reduceMotion ? 1 : withDelay(140, withTiming(1, { duration: 1550, easing: motionEasing.enter }));
  }, [reduceMotion, routeReveal]);

  const routeRevealStyle = useAnimatedStyle(() => ({
    opacity: routeReveal.value,
    transform: [{ scale: 0.9 + routeReveal.value * 0.1 }],
  }));

  return (
    <SafeAreaView style={styles.welcomeIntroSafe}>
      <View style={styles.welcomeIntroContent}>
        <View style={styles.welcomeIntroBrand}><JourneyDeckLogo size={42} /><JourneyDeckWordmark variant="intro" /></View>
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" pointerEvents="none" style={styles.welcomeIntroScene}>
          <Reanimated.View style={[styles.welcomeIntroHero, routeRevealStyle]}>
            <Image source={require('../assets/welcome-journey-hero-v1.png')} resizeMode="cover" style={StyleSheet.absoluteFill} />
          </Reanimated.View>
          <LinearGradient pointerEvents="none" colors={theme.gradient(['rgba(5, 5, 13, 0.14)', 'rgba(7, 4, 15, 0.02)', 'rgba(4, 4, 11, 0.5)'])} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
          <View style={styles.welcomeIntroSignal}><View style={styles.welcomeIntroSignalDot} /><Text style={styles.welcomeIntroSignalText}>PRIVATE BY DESIGN</Text></View>
        </View>
        <Text style={styles.welcomeIntroTitle}>The road{`\n`}remembers.</Text>
        <Text style={styles.welcomeIntroBody}>Record the drives that matter. Your journey archive stays on this iPhone and in your private iCloud.</Text>
        <View style={styles.welcomeIntroPrivacy}><Text style={styles.welcomeIntroPrivacyIcon}>⌁</Text><Text style={styles.welcomeIntroPrivacyText}>No ads. No tracking. You control your data.</Text></View>
        <View style={styles.welcomeIntroAction}><PrimaryAction label="Set up JourneyDeck" onPress={onContinue} /><Text style={styles.welcomeIntroFootnote}>Choose recording and music preferences next. You can change them anytime.</Text></View>
      </View>
    </SafeAreaView>
  );
}

function RecordingModePicker({ initial, onContinue, onCancel }: { initial: RecordingMode; onContinue: (mode: RecordingMode) => Promise<void>; onCancel?: () => void }) {
  const theme = useAppTheme();
  const styles = useThemedStyles(darkStyles);

  const { width } = useWindowDimensions();
  const availableModes = recordingModeOptions;
  const cardWidth = Math.max(280, width - 44);
  const initialIndex = Math.max(0, availableModes.findIndex(option => option.id === initial));
  const [index, setIndex] = useState(initialIndex);
  const [saving, setSaving] = useState(false);
  const carousel = useRef<any>(null);
  const selected = availableModes[index];

  const finish = async () => {
    setSaving(true);
    try { await onContinue(selected.id); }
    finally { setSaving(false); }
  };

  return (
    <SafeAreaView style={styles.onboardingSafe}>
      <ScrollView contentContainerStyle={styles.onboardingContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.onboardingEyebrow}>HOW SHOULD JOURNEYS BEGIN</Text>
        <Text style={styles.onboardingTitle}>Choose how JourneyDeck starts recording</Text>
        <Text style={styles.onboardingBody}>You can change this later. Manual Start and Finish always remain available.</Text>
        <View style={styles.recordingModeTabs}>
          {availableModes.map((option, optionIndex) => (
            <Pressable key={option.id} onPress={() => { setIndex(optionIndex); carousel.current?.scrollTo({ x: optionIndex * (cardWidth + 12), animated: true }); }} style={[styles.recordingModeTab, index === optionIndex && { borderColor: theme.color(option.color, 'border'), backgroundColor: theme.color(option.tint, 'surface') }]}>
              <Text style={[styles.recordingModeTabTitle, index === optionIndex && { color: theme.color(option.color, 'text') }]}>{option.id === 'automatic' ? 'Automatic' : 'Manual'}</Text>
              <Text style={styles.recordingModeTabDetail}>{option.tabDetail}</Text>
            </Pressable>
          ))}
        </View>
        <ScrollView
          ref={carousel}
          horizontal showsHorizontalScrollIndicator={false} snapToInterval={cardWidth + 12} decelerationRate="fast"
          contentOffset={{ x: initialIndex * (cardWidth + 12), y: 0 }}
          onMomentumScrollEnd={event => setIndex(Math.max(0, Math.min(availableModes.length - 1, Math.round(event.nativeEvent.contentOffset.x / (cardWidth + 12)))))}
          contentContainerStyle={styles.providerCarousel}
        >
          {availableModes.map(option => <RecordingModeCard key={option.id} option={option} width={cardWidth} />)}
        </ScrollView>
        <View style={styles.pageDots}>{availableModes.map((option, optionIndex) => <View key={option.id} style={[styles.pageDot, index === optionIndex && { width: 24, backgroundColor: theme.color(selected.color, 'surface') }]} />)}</View>
        <PrimaryAction label={saving ? 'Saving your choice…' : 'Use Manual Recording'} onPress={() => void finish()} disabled={saving} />
        {onCancel && <Pressable onPress={onCancel} style={styles.cancelButton}><Text style={styles.cancelButtonText}>Keep my current choice</Text></Pressable>}
        <Text style={styles.providerFootnote}>Every journey starts and finishes only when you choose.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function RecordingModeCard({ option, width }: { option: RecordingModeOption; width: number }) {
  const theme = useAppTheme();
  const styles = useThemedStyles(darkStyles);

  return (
    <View style={[styles.providerCard, { width, borderColor: theme.color(option.color, 'border') }]}>
      <View style={styles.providerCardHeader}>
        <View style={[styles.providerIcon, { backgroundColor: theme.color(option.color, 'surface') }]}><Text style={styles.providerIconText}>{option.symbol}</Text></View>
        <View style={styles.flex}><Text style={[styles.providerKicker, { color: theme.color(option.color, 'text') }]}>{option.kicker}</Text><Text style={styles.providerName}>{option.name}</Text></View>
      </View>
      <Text style={styles.providerSummary}>{option.summary}</Text>
      <ProsCons title="WHY YOU MAY LOVE IT" color={theme.color("#4ce1b1", 'text')} items={option.benefits} symbol="+" />
      <ProsCons title="WHAT TO KNOW" color={theme.color("#ffb15c", 'text')} items={option.drawbacks} symbol="–" />
      <View style={[styles.privacyNote, { backgroundColor: theme.color(option.tint, 'surface') }]}><Text style={[styles.privacyTitle, { color: theme.color(option.color, 'text') }]}>PRIVACY</Text><Text style={styles.privacyCopy}>{option.privacy}</Text></View>
    </View>
  );
}

function ProviderPicker({ initial, ownerSpotifyEnabled, lastFmUsername, onContinue, onCancel }: { initial: MusicProvider; ownerSpotifyEnabled: boolean; lastFmUsername: string; onContinue: (provider: MusicProvider, username?: string) => Promise<void>; onCancel?: () => void }) {
  const theme = useAppTheme();
  const styles = useThemedStyles(darkStyles);

  const { width } = useWindowDimensions();
  const availableProviders = selectableProviderOptions(ownerSpotifyEnabled);
  const cardWidth = Math.max(280, width - 44);
  const initialIndex = Math.max(0, availableProviders.findIndex(option => option.id === initial));
  const [index, setIndex] = useState(initialIndex);
  const [saving, setSaving] = useState(false);
  const [username, setUsername] = useState(lastFmUsername);
  const [error, setError] = useState('');
  const carousel = useRef<any>(null);
  const selected = availableProviders[index];

  const finish = async () => {
    if (selected.id === 'lastfm' && !/^[A-Za-z][A-Za-z0-9_-]{1,14}$/.test(username.trim())) {
      setError('Enter your Last.fm username: 2–15 characters, starting with a letter.');
      return;
    }
    setSaving(true);
    try { await onContinue(selected.id, selected.id === 'lastfm' ? username.trim() : undefined); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not save your music choice. Try again.'); }
    finally { setSaving(false); }
  };

  return (
    <SafeAreaView style={styles.onboardingSafe}>
      <ScrollView contentContainerStyle={styles.onboardingContent} showsVerticalScrollIndicator={false}>
        <BrandHeader compact />
        <Text style={styles.onboardingEyebrow}>AUTOMATIC SOUNDTRACKS</Text>
        <Text style={styles.onboardingTitle}>Choose your soundtrack source</Text>
        <Text style={styles.onboardingBody}>Choose one music method for your journeys. You can change it later. For Manual Song Recognition, you must tap Identify Song for every track.</Text>
        <View style={styles.providerTabs}>
          {availableProviders.map((option, optionIndex) => (
            <Pressable key={option.id} onPress={() => { setIndex(optionIndex); carousel.current?.scrollTo({ x: optionIndex * (cardWidth + 12), animated: true }); }} style={[styles.providerTab, index === optionIndex && { borderColor: theme.color(option.color, 'border'), backgroundColor: theme.color(option.tint, 'surface') }]}>
              <ProviderMark brand={option.brand} size={28} />
            </Pressable>
          ))}
        </View>
        <ScrollView
          ref={carousel}
          horizontal showsHorizontalScrollIndicator={false} snapToInterval={cardWidth + 12} decelerationRate="fast"
          contentOffset={{ x: initialIndex * (cardWidth + 12), y: 0 }}
          onMomentumScrollEnd={event => setIndex(Math.max(0, Math.min(availableProviders.length - 1, Math.round(event.nativeEvent.contentOffset.x / (cardWidth + 12)))))}
          contentContainerStyle={styles.providerCarousel}
        >
          {availableProviders.map(option => <ProviderCard key={option.id} option={option} width={cardWidth} />)}
        </ScrollView>
        <View style={styles.pageDots}>{availableProviders.map((option, optionIndex) => <View key={option.id} style={[styles.pageDot, index === optionIndex && { width: 24, backgroundColor: theme.color(selected.color, 'surface') }]} />)}</View>
        {selected.id === 'lastfm' && <View style={styles.setupCard}>
          <Text style={styles.setupBody}>Create a free Last.fm account, connect Spotify to it, then enter your Last.fm username.</Text>
          <Text accessibilityRole="link" onPress={() => void Linking.openURL('https://www.last.fm/join')} style={styles.privateCloudLearn}>Create free Last.fm account</Text>
          <Text accessibilityRole="link" onPress={() => void Linking.openURL('https://www.last.fm/about/trackmymusic')} style={styles.privateCloudLearn}>Connect Spotify to Last.fm</Text>
          <TextInput accessibilityLabel="Last.fm username" value={username} onChangeText={value => { setUsername(value); setError(''); }} autoCapitalize="none" autoCorrect={false} maxLength={15} placeholder="Last.fm username" placeholderTextColor={theme.palette.muted} style={styles.setupInput} />
          <Text style={styles.connectionDetail}>JourneyDeck matches your public Last.fm listening history to completed journeys.</Text>
        </View>}
        {error ? <Text accessibilityRole="alert" style={styles.setupWarning}>{error}</Text> : null}
        <PrimaryAction label={saving ? 'Saving your choice…' : selected.id === 'apple-music' ? 'Connect Apple Music' : selected.id === 'shazam' ? 'Use Manual Song Recognition' : `Continue with ${selected.name}`} onPress={() => void finish()} disabled={saving} />
        {onCancel && <Pressable onPress={onCancel} style={styles.cancelButton}><Text style={styles.cancelButtonText}>Keep my current choice</Text></Pressable>}
        <Text style={styles.providerFootnote}>Apple Music requires an active subscription for automatic soundtracks. Route recording always works without a music service.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function ProviderCard({ option, width }: { option: ProviderOption; width: number }) {
  const theme = useAppTheme();
  const styles = useThemedStyles(darkStyles);

  return (
    <View style={[styles.providerCard, { width, borderColor: theme.color(option.color, 'border') }]}>
      {option.id === 'apple-music' && <Text style={styles.providerRecommendation}>RECOMMENDED · AUTOMATIC</Text>}
      <View style={styles.providerCardHeader}>
        <ProviderMark brand={option.brand} size={50} />
        <View style={styles.flex}><Text style={[styles.providerKicker, { color: theme.color(option.color, 'text') }]}>{option.kicker}</Text><Text style={styles.providerName}>{option.name}</Text></View>
      </View>
      <Text style={styles.providerSummary}>{option.summary}</Text>
      <ProsCons title="WHY YOU MAY LOVE IT" color={theme.color("#4ce1b1", 'text')} items={option.benefits} symbol="+" />
      <ProsCons title="WHAT TO KNOW" color={theme.color("#ffb15c", 'text')} items={option.drawbacks} symbol="–" />
      <View style={[styles.privacyNote, { backgroundColor: theme.color(option.tint, 'surface') }]}><Text style={[styles.privacyTitle, { color: theme.color(option.color, 'text') }]}>PRIVACY</Text><Text style={styles.privacyCopy}>{option.privacy}</Text></View>
    </View>
  );
}

function ProviderMark({ brand, size }: { brand: ProviderBrand; size: number }) {
  const styles = useThemedStyles(darkStyles);

  if (brand === 'spotify') {
    return <View style={[styles.spotifyMarkFrame, { width: size, height: size, borderRadius: size / 2 }]}><Image source={providerBrandImages.spotify} resizeMode="contain" style={{ width: size / 2, height: size / 2 }} /></View>;
  }
  return <Image source={providerBrandImages[brand]} resizeMode="contain" style={{ width: size, height: size }} />;
}

function ProsCons({ title, color, items, symbol }: { title: string; color: string; items: string[]; symbol: string }) {
  const theme = useAppTheme();
  const styles = useThemedStyles(darkStyles);

  return <View style={styles.prosCons}><Text style={[styles.prosConsTitle, { color }]}>{title}</Text>{items.map(item => <View style={styles.proRow} key={item}><View style={[styles.proBullet, { borderColor: theme.color(color, 'border') }]}><Text style={[styles.proBulletText, { color }]}>{symbol}</Text></View><Text style={styles.proText}>{item}</Text></View>)}</View>;
}

function HomeScreen({ userId, primary, recorderActive, journeyProgress, onSoundtracks, onStatistics, onJourney, onFiftyStates, recorder }: { userId: string; primary: PrimaryDataState; recorderActive: boolean; journeyProgress: ActiveJourneyProgress | null; onSoundtracks: () => void; onStatistics: () => void; onJourney: (id: string) => void; onFiftyStates?: () => void; recorder: ReactNode }) {
  const theme = useAppTheme();
  const styles = useThemedStyles(darkStyles);
  const { ambientMotionEnabled, reduceMotion } = useMotionPreferences();

  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const [editingLayout, setEditingLayout] = useState(false);
  const [activeJourneyVisible, setActiveJourneyVisible] = useState(false);
  const gridLayout = useHomeWidgetLayout('compact', Boolean(onFiftyStates), V3_ASK_JOURNEYDECK_ENABLED, TESSIE_INTEGRATION_ENABLED);
  const cameraDrift = useSharedValue(0);
  const recorderFocus = useSharedValue(recorderActive ? 1 : 0);
  const latestSummary = primary.data?.journeys[0] ?? null;
  const latestDetail = latestSummary ? primary.data?.details.find(detail => detail.id === latestSummary.id) ?? null : null;
  const latestJourney = latestDetail ?? latestSummary;
  const [promptedShareJourneyId, setPromptedShareJourneyId] = useState<string | null>(() => lastPromptedShareJourneyId());
  const showSharePrompt = Boolean(latestJourney && latestJourney.id !== promptedShareJourneyId);
  const dismissSharePrompt = () => {
    if (!latestJourney) return;
    markShareJourneyPrompted(latestJourney.id);
    setPromptedShareJourneyId(latestJourney.id);
  };
  const latestTitle = latestJourney ? homeHeroTitle(latestJourney) : 'Your first road memory';
  const latestRoute = latestJourney ? homeRouteContext(latestJourney) : 'Your next completed journey will appear here.';
  const latestDate = latestJourney ? new Date(latestJourney.startedAt).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'Ready when you are';
  const latestImage = headerImageSource(homeHeroImageFor(latestJourney?.startedAt), theme.id);
  const latestTrack = primary.data?.music.recentSelections[0] ?? null;
  const metricWidgets: Record<Extract<HomeWidgetId, 'miles' | 'listening' | 'songs' | 'streak'>, { title: string; value: string; icon: SFSymbol }> = {
    miles: { title: 'Miles with music', value: primary.data?.music.metrics.milesWithMusic.toLocaleString(undefined, { maximumFractionDigits: 1 }) ?? '—', icon: 'road.lanes' },
    listening: { title: 'Listening hours', value: primary.data?.music.metrics.listeningHours.toLocaleString(undefined, { maximumFractionDigits: 1 }) ?? '—', icon: 'headphones' },
    songs: { title: 'Songs on the road', value: primary.data?.music.metrics.songsOnRoad.toLocaleString() ?? '—', icon: 'music.note' },
    streak: { title: 'Current streak', value: primary.data?.music.metrics.currentStreak.toLocaleString() ?? '—', icon: 'flame' },
  };
  const backdropStyle = useAnimatedStyle(() => {
    const drift = cameraDrift.get();
    const focus = recorderFocus.get();
    return {
      transform: [
        { translateX: interpolate(drift, [0, 1], [-9, 9], Extrapolation.CLAMP) },
        { translateY: interpolate(drift, [0, 1], [7, -11], Extrapolation.CLAMP) - focus * 4 },
        { scale: interpolate(drift, [0, 1], [1.055, 1.105], Extrapolation.CLAMP) + focus * 0.025 },
      ],
    };
  });
  useEffect(() => {
    cancelAnimation(cameraDrift);
    cameraDrift.set(0);
    if (!ambientMotionEnabled) return;
    cameraDrift.set(withRepeat(withTiming(1, { duration: 18_000, easing: motionEasing.standard }), -1, true));
    return () => {
      cancelAnimation(cameraDrift);
      cameraDrift.set(0);
    };
  }, [ambientMotionEnabled, cameraDrift]);
  useEffect(() => {
    cancelAnimation(recorderFocus);
    recorderFocus.set(reduceMotion ? (recorderActive ? 1 : 0) : withSpring(recorderActive ? 1 : 0, MOTION_SPRINGS.gentle));
    return () => cancelAnimation(recorderFocus);
  }, [recorderActive, recorderFocus, reduceMotion]);
  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [recorderActive]);
  const homeColors = journeyDeckSemanticColors(theme.id, theme.palette);
  const tessieVehicles = TESSIE_INTEGRATION_ENABLED ? primary.data?.vehicle.vehicles ?? [] : [];
  const presentation = selectHomePresentation(gridLayout.placements);
  const openEditor = () => setEditingLayout(true);
  const renderLatestMemory = () => <CardDetailLink kind="journey" id={latestJourney?.id} actions={[]}>
    <TouchPressable disabled={!latestJourney} onPress={() => latestJourney && onJourney(latestJourney.id)} onLongPress={openEditor} delayLongPress={1000} style={({ pressed }) => [styles.approvedLatestMemory, { backgroundColor: homeColors.surfaceRaised, borderColor: homeColors.separator }, pressed && styles.pressed]}>
      <View style={styles.approvedLatestMemoryHeader}><SymbolView name="sparkles" tintColor={homeColors.accent} size={15} /><Text style={[styles.approvedLatestMemoryKicker, { color: homeColors.accent }]}>Latest memory</Text></View>
      <View style={styles.approvedLatestMemoryRow}>
        <View style={styles.approvedLatestMemoryArtwork}><ExpoImage source={latestImage} contentFit="cover" cachePolicy="memory-disk" style={StyleSheet.absoluteFill} />{latestJourney && <View style={styles.approvedLatestMemoryPlay}><SymbolView name="play.fill" tintColor="#fff" size={13} /></View>}</View>
        <View style={styles.flex}><Text style={[styles.approvedLatestMemoryTitle, { color: homeColors.text }]} numberOfLines={1}>{latestTitle}</Text><View style={styles.approvedLatestMemoryMeta}><SymbolView name="mappin.and.ellipse" tintColor={homeColors.textSecondary} size={13} /><Text style={[styles.approvedLatestMemoryMetaText, { color: homeColors.textSecondary }]} numberOfLines={1}>{latestRoute}</Text></View><View style={styles.approvedLatestMemoryMeta}><SymbolView name="calendar" tintColor={homeColors.textSecondary} size={13} /><Text style={[styles.approvedLatestMemoryMetaText, { color: homeColors.textSecondary }]}>{latestDate}</Text></View></View>
        <View style={[styles.approvedLatestMemoryMore, { borderColor: homeColors.separator, backgroundColor: homeColors.surfaceInset }]}><Text style={[styles.approvedLatestMemoryMoreText, { color: homeColors.textSecondary }]}>•••</Text></View>
      </View>
    </TouchPressable>
  </CardDetailLink>;
  const renderLatestSoundtrack = () => <TouchPressable accessibilityRole="button" accessibilityLabel={latestTrack ? `Open Soundtracks for ${latestTrack.track}` : 'Open Soundtracks'} onPress={onSoundtracks} onLongPress={openEditor} delayLongPress={1000} style={({ pressed }) => [styles.approvedLatestSong, { backgroundColor: homeColors.surfaceRaised, borderColor: homeColors.separator }, pressed && styles.pressed]}>
    {latestTrack ? <Artwork track={latestTrack} size={58} /> : <View style={[styles.approvedLatestSongFallback, { backgroundColor: homeColors.surfaceInset, borderColor: homeColors.separator }]}><SymbolView name="music.note" tintColor={homeColors.accent} size={25} /></View>}
    <View style={styles.flex}>
      <Text style={[styles.approvedLatestSongKicker, { color: homeColors.accent }]}>LATEST SONG PLAYED</Text>
      <Text style={[styles.approvedLatestSongTitle, { color: homeColors.text }]} numberOfLines={1}>{latestTrack?.track ?? 'Your soundtrack starts here'}</Text>
      <Text style={[styles.approvedLatestSongMeta, { color: homeColors.textSecondary }]} numberOfLines={1}>{latestTrack ? `${latestTrack.artist}${formatTrackTime(latestTrack.playedAt)}` : 'The most recent song from a journey will appear here.'}</Text>
    </View>
    <View style={[styles.approvedLatestSongArrow, { backgroundColor: homeColors.surfaceInset, borderColor: homeColors.separator }]}><SymbolView name="chevron.right" tintColor={homeColors.accent} size={15} weight="semibold" /></View>
  </TouchPressable>;
  // Home only ever shows Latest Memory, one featured context widget, and the visible
  // Road Summary metrics (selectHomePresentation) -- so customizing it means choosing
  // among those three things, not laying out a free 12-column grid.
  const contextChoiceCandidates: ({ id: HomeWidgetId; label: string; icon: SFSymbol } | null)[] = [
    onFiftyStates ? { id: 'fiftyStates', label: '50 States', icon: 'map' } : null,
    V3_ASK_JOURNEYDECK_ENABLED ? { id: 'askJourneyDeck', label: 'Ask JourneyDeck', icon: 'sparkles' } : null,
    { id: 'soundtrack', label: 'Latest Soundtrack', icon: 'music.note' },
    TESSIE_INTEGRATION_ENABLED ? { id: 'yourCar', label: 'Your car', icon: 'car.side' } : null,
    TESSIE_INTEGRATION_ENABLED ? { id: 'journeyInProgress', label: 'Journey in progress', icon: 'location.north.line' } : null,
  ];
  const contextChoices = contextChoiceCandidates.filter((choice): choice is { id: HomeWidgetId; label: string; icon: SFSymbol } => choice !== null);
  const summaryLabels: Record<string, string> = { miles: 'Miles with music', listening: 'Listening hours', songs: 'Songs on the road', streak: 'Current streak', journeys: 'Journey library' };
  const renderCustomizeSheet = () => {
    const memoryPlacement = gridLayout.placements.find(item => item.id === 'memories');
    const selectedContextId = presentation.context?.id ?? null;
    const summaryOrder = gridLayout.placements.filter(item => HOME_SUMMARY_WIDGETS.includes(item.id)).sort((left, right) => left.order - right.order);
    return <View style={styles.customizeSheet}>
      <View style={styles.customizeSection}>
        <Text style={[styles.customizeSectionTitle, { color: homeColors.textSecondary }]}>LATEST MEMORY</Text>
        <View style={[styles.customizeRow, { backgroundColor: homeColors.surface, borderColor: homeColors.separator }]}>
          <Text style={[styles.customizeRowLabel, styles.flex, { color: homeColors.text }]}>Show on Home</Text>
          <View style={styles.customizeRowSwitch}>
            <Switch accessibilityLabel="Show Latest Memory on Home" value={!memoryPlacement?.hidden} onValueChange={() => gridLayout.toggle('memories')} trackColor={{ false: homeColors.separator, true: homeColors.accent }} style={styles.customizeRowSwitchControl} />
          </View>
        </View>
      </View>
      <View style={styles.customizeSection}>
        <Text style={[styles.customizeSectionTitle, { color: homeColors.textSecondary }]}>FEATURED WIDGET</Text>
        {contextChoices.map(choice => <TouchPressable key={choice.id} accessibilityRole="radio" accessibilityState={{ checked: selectedContextId === choice.id }}
          onPress={() => gridLayout.selectContext(choice.id)} style={({ pressed }) => [styles.customizeRow, { backgroundColor: homeColors.surface, borderColor: homeColors.separator }, pressed && styles.pressed]}>
          <SymbolView name={choice.icon} tintColor={homeColors.accent} size={18} />
          <Text style={[styles.customizeRowLabel, styles.flex, { color: homeColors.text }]}>{choice.label}</Text>
          {selectedContextId === choice.id && <SymbolView name="checkmark" tintColor={homeColors.accent} size={17} weight="bold" />}
        </TouchPressable>)}
      </View>
      <View style={styles.customizeSection}>
        <Text style={[styles.customizeSectionTitle, { color: homeColors.textSecondary }]}>ROAD SUMMARY</Text>
        {summaryOrder.map((item, index) => <View key={item.id} style={[styles.customizeRow, { backgroundColor: homeColors.surface, borderColor: homeColors.separator }]}>
          <Text style={[styles.customizeRowLabel, styles.flex, { color: homeColors.text }]}>{summaryLabels[item.id]}</Text>
          <TouchPressable accessibilityRole="button" accessibilityLabel={`Move ${summaryLabels[item.id]} earlier`} disabled={index === 0} hitSlop={6} onPress={() => gridLayout.moveSummary(item.id, -1)} style={styles.customizeRowChevron}>
            <SymbolView name="chevron.up" tintColor={index === 0 ? homeColors.separator : homeColors.accent} size={16} />
          </TouchPressable>
          <TouchPressable accessibilityRole="button" accessibilityLabel={`Move ${summaryLabels[item.id]} later`} disabled={index === summaryOrder.length - 1} hitSlop={6} onPress={() => gridLayout.moveSummary(item.id, 1)} style={styles.customizeRowChevron}>
            <SymbolView name="chevron.down" tintColor={index === summaryOrder.length - 1 ? homeColors.separator : homeColors.accent} size={16} />
          </TouchPressable>
          <View style={styles.customizeRowSwitch}>
            <Switch accessibilityLabel={`Show ${summaryLabels[item.id]} in Road Summary`} value={!item.hidden} onValueChange={() => gridLayout.toggle(item.id)} trackColor={{ false: homeColors.separator, true: homeColors.accent }} style={styles.customizeRowSwitchControl} />
          </View>
        </View>)}
      </View>
    </View>;
  };
  const contextualWidget = presentation.context?.id === 'fiftyStates' && onFiftyStates
    ? <FiftyStatesHomeWidget userId={userId} onPress={onFiftyStates} dense onLongPress={openEditor} />
    : presentation.context?.id === 'askJourneyDeck'
      ? <AskJourneyDeckWidget onPress={() => router.push('/ask-journeydeck')} onLongPress={openEditor} />
      : presentation.context?.id === 'soundtrack' ? renderLatestSoundtrack()
        : presentation.context?.id === 'yourCar' ? <YourCarWidget vehicles={tessieVehicles} loading={primary.status === 'loading' && !primary.data} failed={primary.status === 'error'} />
        : presentation.context?.id === 'journeyInProgress' ? <JourneyInProgressWidget progress={journeyProgress} onOpen={() => setActiveJourneyVisible(true)} /> : null;
  return <View style={styles.approvedHomeSafe}>
    <Reanimated.View pointerEvents="none" style={[styles.approvedHomeBackdrop, backdropStyle]}>
      <JourneyImage key={`home-header-${theme.id}`} imageIdentity={`home-header-${theme.id}`} source={headerImageSource(require('../assets/cinematic-home-main-photo-v1.jpg'), theme.id)} contentFit="cover" style={StyleSheet.absoluteFill} />
    </Reanimated.View>
    <CinematicPhotoGrade />
    <LinearGradient colors={theme.isCustom ? [`${theme.palette.page}28`, `${theme.palette.page}12`, `${theme.palette.page}b8`, theme.palette.page] : theme.isLight ? ['rgba(255,250,240,0.24)', 'rgba(255,250,240,0.08)', 'rgba(255,250,240,0.74)', '#fffaf0'] : ['rgba(4,3,11,0.05)', 'rgba(5,3,10,0.1)', 'rgba(5,3,10,0.72)', '#05030b']} locations={[0, 0.28, 0.55, 0.86]} style={StyleSheet.absoluteFill} />
    <ScrollView ref={scrollRef} contentContainerStyle={[styles.approvedHomeContent, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 28 }]} contentInsetAdjustmentBehavior="never" automaticallyAdjustContentInsets={false} automaticallyAdjustsScrollIndicatorInsets={false} showsVerticalScrollIndicator={false}>
      <PhoneTabTitle title="Home"
        leading={<TouchPressable accessibilityRole="button" accessibilityLabel="Open Statistics" onPress={onStatistics} style={({ pressed }) => [styles.approvedHomeHeaderButton, pressed && styles.pressed]}><SymbolView name="chart.bar.xaxis" tintColor={theme.color("#c5afd1", 'text')} size={22} /></TouchPressable>}
        trailing={<NativeActionMenu compact label="Home actions" actions={[
          { id: 'soundtracks', title: 'Soundtracks', onSelect: onSoundtracks },
          { id: 'edit-home', title: 'Edit Home', onSelect: openEditor },
        ]} />} />
      <View style={[styles.approvedHomeScenicSpace, recorderActive && styles.approvedHomeScenicSpaceActive]} />
      <View style={styles.approvedHomePanels}>
        <View testID="home-fixed-recorder">{recorder}</View>
        <View testID="compact-home-widget-grid" style={styles.homeCuratedStack}>
          {presentation.memory ? renderLatestMemory() : null}
          {presentation.memory && showSharePrompt && latestJourney && <View style={[styles.sharePrompt, { backgroundColor: homeColors.surfaceRaised, borderColor: homeColors.separator }]}>
            <SymbolView name="square.and.arrow.up" tintColor={homeColors.accent} size={16} />
            <Text style={[styles.sharePromptText, { color: homeColors.text }]}>Your drive is ready to share.</Text>
            <TouchPressable accessibilityRole="button" accessibilityLabel="Share this drive" onPress={() => { markShareJourneyPrompted(latestJourney.id); setPromptedShareJourneyId(latestJourney.id); openJourneyCardAction(latestJourney.id, 'share'); }} style={({ pressed }) => [styles.sharePromptAction, { backgroundColor: homeColors.accent }, pressed && styles.pressed]}>
              <Text style={[styles.sharePromptActionText, { color: homeColors.onAccent }]}>Share</Text>
            </TouchPressable>
            <TouchPressable accessibilityRole="button" accessibilityLabel="Dismiss share prompt" hitSlop={8} onPress={dismissSharePrompt} style={({ pressed }) => [styles.sharePromptDismiss, pressed && styles.pressed]}>
              <SymbolView name="xmark" tintColor={homeColors.textSecondary} size={11} weight="bold" />
            </TouchPressable>
          </View>}
          {contextualWidget}
          {presentation.summary.length ? <TouchPressable testID="home-road-summary" accessibilityRole="button" accessibilityLabel="Open road summary in Statistics" accessibilityHint="Long press to edit Home" onPress={onStatistics} onLongPress={openEditor} delayLongPress={1000} style={({ pressed }) => [styles.homeRoadSummary, { backgroundColor: homeColors.surfaceRaised, borderColor: homeColors.separator }, pressed && styles.pressed]}>
            <View style={styles.homeRoadSummaryHeader}><View><Text style={[styles.homeRoadSummaryKicker, { color: homeColors.accent }]}>ROAD SUMMARY</Text><Text style={[styles.homeRoadSummaryTitle, { color: homeColors.text }]}>Along the way</Text></View><SymbolView name="chevron.right" tintColor={homeColors.accent} size={17} /></View>
            <View style={styles.homeRoadSummaryGrid}>{presentation.summary.map((placement, index) => {
              const metric = placement.id === 'journeys' ? { title: 'Journeys', value: primary.data?.journeys.length.toLocaleString() ?? '—', icon: 'books.vertical' as SFSymbol } : metricWidgets[placement.id as keyof typeof metricWidgets];
              const isLastOdd = presentation.summary.length % 2 === 1 && index === presentation.summary.length - 1;
              const fullWidth = placement.span === 12 || isLastOdd;
              return <View key={placement.id} style={[styles.homeRoadSummaryItem, { width: fullWidth ? '100%' : '50%', borderColor: homeColors.separator }]}><SymbolView name={metric.icon} tintColor={homeColors.accent} size={19} /><View style={styles.flex}><Text style={[styles.homeRoadSummaryLabel, { color: homeColors.textSecondary }]}>{metric.title}</Text><Text style={[styles.homeRoadSummaryValue, { color: homeColors.text }]}>{metric.value}</Text></View></View>;
            })}</View>
          </TouchPressable> : null}
        </View>
      </View>
    </ScrollView>
    <HomeLayoutEditorSheet visible={editingLayout} onClose={() => setEditingLayout(false)} onReset={gridLayout.reset}
      noteIcon="sparkles" note="Choose what Home features, reorder your Road Summary, and hide anything you do not want.">
      <View testID="home-layout-editor-grid">{renderCustomizeSheet()}</View>
    </HomeLayoutEditorSheet>
    <ActiveJourneyDetailsSheet visible={activeJourneyVisible} progress={journeyProgress} onClose={() => setActiveJourneyVisible(false)} />
  </View>;
}

function PreviousCinematicHomeScreen({ currentUser, state, primary, onJourneys, onSoundtracks, onJourney, onRefresh, recorder }: { currentUser: LocalUser; state: LoadState<AppDashboard>; primary: PrimaryDataState; onJourneys: () => void; onSoundtracks: () => void; onJourney: (id: string) => void; onRefresh: () => void; recorder: ReactNode }) {
  const theme = useAppTheme();
  const styles = useThemedStyles(darkStyles);

  const insets = useSafeAreaInsets();
  const { data } = state;
  const home = useMemo(() => primary.data ? buildHomeSummary(primary.data) : null, [primary.data]);
  const [appearance, setAppearance] = useState<ProfileAppearance>(() => loadProfileAppearance(currentUser));
  const [profileEditorOpen, setProfileEditorOpen] = useState(false);
  const [profileDraft, setProfileDraft] = useState(appearance);
  const [avatarBusy, setAvatarBusy] = useState(false);
  // The hero must describe the newest local journey, not a different older drive
  // selected only because it has a fuller route payload.
  const latestSummary = primary.data?.journeys[0] ?? data.latestJourney ?? null;
  const latestDetail = latestSummary ? primary.data?.details.find(detail => detail.id === latestSummary.id) ?? null : null;
  const latestJourney = latestDetail ?? latestSummary;
  const heroImage = homeHeroImageFor(latestJourney?.startedAt);
  const latestHeardTrack = home?.latestTrack ?? null;
  const soundtrackTitle = latestHeardTrack?.track ?? null;
  const soundtrackArtist = latestHeardTrack?.artist ?? null;
  const hasRoadSoundtrack = Boolean(soundtrackTitle && soundtrackArtist);
  const storyItems = useMemo(() => {
    if (!primary.data) return [];
    return [...primary.data.memories.memories]
      .sort((left, right) => Date.parse(right.updatedAtUtc) - Date.parse(left.updatedAtUtc))
      .slice(0, 5)
      .map(memory => ({
        id: memory.id,
        title: memory.name,
        meta: `${memory.journeyIds.length} ${memory.journeyIds.length === 1 ? 'journey' : 'journeys'}`,
        photo: memory.photos.find(photo => photo.id === memory.coverPhotoId) ?? memory.photos[0] ?? null,
      }));
  }, [primary.data]);
  const profileInitials = profileInitialsFor(appearance.displayName);
  const draftInitials = profileInitialsFor(profileDraft.displayName);
  const heroTitle = latestJourney ? homeHeroTitle(latestJourney) : 'Your road, remembered';
  const routeTitle = latestJourney ? homeRouteContext(latestJourney) : 'Your next drive will appear here';
  const heroStats = latestJourney
    ? `${formatMiles(latestJourney.miles)} · ${formatDuration(latestJourney.durationMinutes)} · ${latestJourney.songCount} ${latestJourney.songCount === 1 ? 'song' : 'songs'}`
    : 'Captured privately on your iPhone';

  const editProfile = () => { setProfileDraft(appearance); setProfileEditorOpen(true); void haptics.selection(); };
  const pickAvatar = async () => {
    setAvatarBusy(true);
    try {
      const avatarDataUri = await chooseProfileAvatar();
      if (avatarDataUri) setProfileDraft(current => ({ ...current, avatarDataUri }));
    } catch (error) { Alert.alert('Profile image was not changed', error instanceof Error ? error.message : 'Try another image.'); }
    finally { setAvatarBusy(false); }
  };
  const saveProfile = () => {
    const saved = saveProfileAppearance(currentUser, profileDraft);
    setAppearance(saved); setProfileEditorOpen(false);
    void haptics.success();
  };

  return <View style={styles.safe}>
    <ScrollView contentContainerStyle={[styles.cinematicHomePage, { paddingTop: insets.top + 14, paddingBottom: insets.bottom + 132 }]} contentInsetAdjustmentBehavior="never" automaticallyAdjustContentInsets={false} automaticallyAdjustsScrollIndicatorInsets={false} showsVerticalScrollIndicator={false}>
      <HomeMeshAtmosphere />
      <View style={styles.cinematicHomeShell}>
        {state.status === 'error' && <InlineNotice message={state.message!} onRetry={onRefresh} />}
        <Reanimated.View entering={FadeInDown.duration(430)} style={styles.cinematicHomeHeader}>
          <View style={styles.flex}>
            <JourneyDeckWordmark variant="home" />
            <Text style={styles.cinematicHeadline}>The road{`\n`}remembers.</Text>
          </View>
          <View style={styles.cinematicHeaderActions}>
            <View style={styles.cinematicAvatarAnchor}><View pointerEvents="none" style={styles.cinematicAvatarGlow} />
              <Pressable accessibilityRole="button" accessibilityLabel="Edit profile" onPress={editProfile} style={({ pressed }) => [styles.cinematicAvatarButton, pressed && styles.pressed]}>
              <LinearGradient colors={theme.gradient(['#ff795b', '#db55a6', '#8d61ff'])} start={{ x: 0.1, y: 0.08 }} end={{ x: 0.92, y: 0.94 }} style={styles.cinematicAvatarRing}>
                <View style={styles.cinematicAvatarInner}>
                  {appearance.avatarDataUri ? (
                    <ExpoImage source={appearance.avatarDataUri} cachePolicy="memory" contentFit="cover" transition={180} style={StyleSheet.absoluteFill} />
                  ) : (
                    <Text style={styles.cinematicAvatarInitials}>{profileInitials}</Text>
                  )}
                </View>
              </LinearGradient>
              <View style={styles.cinematicAvatarEdit}>
                <SymbolView name="pencil" tintColor={theme.color("#fff4fb", 'text')} type="hierarchical" style={styles.cinematicAvatarEditSymbol} />
              </View>
              </Pressable>
            </View>
          </View>
        </Reanimated.View>

        <Reanimated.View entering={FadeInDown.delay(55).duration(460)}>
          {recorder}
        </Reanimated.View>

        {/* Hero Card */}
        <Reanimated.View entering={FadeInDown.delay(70).duration(480)}>
          <View style={styles.cinematicHeroAura}>
            <Pressable disabled={!latestJourney} onPress={() => latestJourney && onJourney(latestJourney.id)} style={({ pressed }) => [styles.cinematicHero, pressed && styles.cinematicPressed]}>
              <ExpoImage source={heroImage} cachePolicy="memory-disk" contentFit="cover" transition={220} style={StyleSheet.absoluteFill} />
              <CinematicPhotoGrade />
              <LinearGradient colors={theme.gradient(['rgba(8,3,14,0.34)', 'rgba(8,3,14,0.12)', 'rgba(5,2,10,0.85)', 'rgba(4,1,8,0.97)'])} locations={[0, 0.28, 0.72, 1]} style={StyleSheet.absoluteFill} />
              <LiquidGlassEdges radius={29} />
              {/* Top Bar of Hero */}
              <View style={styles.cinematicHeroHeader}>
                <View style={styles.cinematicHeroHeaderCopy}>
                  <Text style={styles.cinematicHeroEyebrow}>LATEST ROAD MEMORY</Text>
                  <Text style={styles.cinematicHeroTitle} numberOfLines={1}>{heroTitle}</Text>
                  <Text style={styles.cinematicHeroRoute} numberOfLines={1}>{routeTitle}</Text>
                  <Text style={styles.cinematicHeroMeta}>{heroStats}</Text>
                </View>
                <Pressable onPress={() => latestJourney && onJourney(latestJourney.id)} style={styles.cinematicRelive}>
                  <SymbolView name="play.fill" tintColor={theme.color("#fff", 'text')} type="hierarchical" style={styles.cinematicReliveSymbol} />
                  <Text style={styles.cinematicReliveText}>Relive</Text>
                </Pressable>
              </View>

              {/* Keep the Home hero editorial; the recorded route belongs in the drive detail. */}
              <View style={styles.cinematicHeroBottomActions}>
                <Pressable onPress={() => latestJourney ? onJourney(latestJourney.id) : onJourneys()} style={styles.cinematicHeroRouteButton}>
                  <SymbolView name="arrow.right" tintColor={theme.color("#fff", 'text')} type="hierarchical" style={styles.cinematicHeroPillIcon} />
                  <Text style={styles.cinematicHeroPillText}>Open drive</Text>
                </Pressable>
              </View>
            </Pressable>
          </View>
        </Reanimated.View>

        {/* Newest Memories */}
        <Reanimated.View entering={FadeInDown.delay(120).duration(480)} style={styles.cinematicSection}>
          <View style={styles.cinematicSectionHeader}>
            <Text style={styles.cinematicSectionTitle}>Memories</Text>
            <Pressable onPress={onJourneys}>
              <Text style={styles.cinematicSectionAction}>View all  ›</Text>
            </Pressable>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cinematicStoryRail}>
            {storyItems.map(item => (
              <Pressable key={item.id} onPress={onJourneys} style={({ pressed }) => [styles.cinematicStoryCard, pressed && styles.cinematicPressed]}>
                {item.photo ? (
                  <JourneyPhotoImage photo={item.photo} style={StyleSheet.absoluteFill} />
                ) : (
                  <MemoryArtwork artworkKey="road-trips" />
                )}
                <LinearGradient colors={theme.gradient(['rgba(5,2,9,0)', 'rgba(5,2,9,0.38)', 'rgba(5,2,9,0.96)'])} locations={[0.3, 0.65, 1]} style={StyleSheet.absoluteFill} />
                <LiquidGlassEdges radius={22} />
                <View style={styles.cinematicStoryCopy}>
                  <Text style={styles.cinematicStoryTitle} numberOfLines={1}>{item.title}</Text>
                  <Text style={styles.cinematicStoryMeta}>{item.meta}</Text>
                </View>
              </Pressable>
            ))}
            <Pressable accessibilityRole="button" accessibilityLabel="See more memories" onPress={onJourneys} style={({ pressed }) => [styles.cinematicStoryMoreCard, pressed && styles.cinematicPressed]}>
              <LinearGradient colors={theme.gradient(['rgba(115,67,159,0.42)', 'rgba(20,9,31,0.92)'])} style={StyleSheet.absoluteFill} />
              <SymbolView name="rectangle.stack.fill" tintColor={theme.color("#dcb9ff", 'text')} type="hierarchical" style={styles.cinematicStoryMoreIcon} />
              <Text style={styles.cinematicStoryMoreTitle}>See more</Text>
              <Text style={styles.cinematicStoryMoreMeta}>All memories  ›</Text>
              <LiquidGlassEdges radius={22} />
            </Pressable>
          </ScrollView>
        </Reanimated.View>

        {/* Soundtrack Card (the newest song JourneyDeck actually heard) */}
        <Reanimated.View entering={FadeInDown.delay(180).duration(480)}>
          <CinematicGlass style={styles.cinematicSoundtrackGlassCard}>
            {/* Card Header Row */}
            <View style={styles.cinematicSoundtrackHeaderRow}>
              <View style={styles.cinematicSoundtrackKickerWrap}>
                <SymbolView name="waveform" tintColor={theme.color("#ff6078", 'text')} type="hierarchical" style={styles.cinematicWaveformKickerIcon} />
                <Text style={styles.cinematicSoundtrackKickerText}>{hasRoadSoundtrack ? 'Last heard on your road' : 'Your road soundtrack'}</Text>
              </View>
              <View style={styles.cinematicStatusBadgePill}>
                <View style={[styles.cinematicStatusDot, { backgroundColor: theme.color(recorderColor(data.recorder.state, data.recorder.connected), 'surface') }]} />
                <Text style={styles.cinematicStatusBadgeText}>
                  {data.recorder.state === 'recording' ? 'Recording' : 'Ready'} · On device
                </Text>
                <SymbolView name="checkmark.shield.fill" tintColor={theme.color("#4be8c4", 'text')} type="hierarchical" style={styles.cinematicShieldIcon} />
              </View>
            </View>

            {/* Card Content Row */}
            <View style={styles.cinematicSoundtrackContentRow}>
              <View style={styles.cinematicAlbumCoverWrap}>
                {latestHeardTrack ? (
                  <Artwork track={latestHeardTrack} size={76} />
                ) : (
                  <LinearGradient colors={theme.gradient(['rgba(255,96,120,0.28)', 'rgba(141,97,255,0.26)', 'rgba(12,8,18,0.95)'])} style={styles.cinematicEmptyAlbumCover}>
                    <SymbolView name="music.note" tintColor={theme.color("#e5c8ff", 'text')} type="hierarchical" style={styles.cinematicEmptyAlbumIcon} />
                  </LinearGradient>
                )}
              </View>
              <View style={styles.cinematicTrackInfoColumn}>
                <Text style={styles.cinematicTrackTitleText} numberOfLines={1}>{soundtrackTitle ?? 'Music will appear here'}</Text>
                <Text style={styles.cinematicTrackArtistText} numberOfLines={1}>{soundtrackArtist ?? 'After your first drive'}</Text>
                {hasRoadSoundtrack ? <SoundtrackWaveform /> : <Text style={styles.cinematicEmptySoundtrackHint}>Open music setup  ›</Text>}
              </View>
              <Pressable onPress={onSoundtracks} style={styles.cinematicPlayButtonOuter}>
                <LinearGradient colors={theme.gradient(['#ff795b', '#db55a6', '#8d61ff'])} style={styles.cinematicPlayButtonRing}>
                  <View style={styles.cinematicPlayButtonDisc}>
                    <SymbolView name={hasRoadSoundtrack ? 'play.fill' : 'arrow.right'} tintColor={theme.color("#ffffff", 'text')} type="hierarchical" style={styles.cinematicPlaySymbol} />
                  </View>
                </LinearGradient>
              </Pressable>
            </View>
          </CinematicGlass>
        </Reanimated.View>

        {state.status === 'loading' && <LoadingLine label="Refreshing your dashboard…" />}
      </View>
    </ScrollView>

    {/* Profile Edit Modal */}
    <Modal visible={profileEditorOpen} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setProfileEditorOpen(false)}>
      <View style={styles.profileEditorRoot}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => setProfileEditorOpen(false)}>
          <BlurView intensity={28} tint={theme.mode} style={StyleSheet.absoluteFill} />
        </Pressable>
        <CinematicGlass style={styles.profileEditorCard}>
          <Text style={styles.profileEditorEyebrow}>HOME PROFILE</Text>
          <Text style={styles.profileEditorTitle}>Make it yours</Text>
          <Text style={styles.profileEditorBody}>Your profile image and greeting stay in your private JourneyDeck profile.</Text>
          <Pressable disabled={avatarBusy} onPress={() => void pickAvatar()} style={styles.profileEditorAvatarButton}>
            <LinearGradient colors={theme.gradient(['#ff795b', '#db55a6', '#8d61ff'])} style={styles.profileEditorAvatarRing}>
              <View style={styles.profileEditorAvatarInner}>
                {profileDraft.avatarDataUri ? (
                  <ExpoImage source={profileDraft.avatarDataUri} contentFit="cover" transition={180} style={StyleSheet.absoluteFill} />
                ) : (
                  <Text style={styles.profileEditorAvatarInitials}>{draftInitials}</Text>
                )}
              </View>
            </LinearGradient>
            <View style={styles.profileEditorPhotoBadge}>
              {avatarBusy ? <ActivityIndicator color={theme.color("#fff", 'text')} size="small" /> : <SymbolView name="camera.fill" tintColor={theme.color("#fff", 'text')} type="hierarchical" style={styles.profileEditorCamera} />}
            </View>
          </Pressable>
          <Pressable disabled={avatarBusy} onPress={() => void pickAvatar()}>
            <Text style={styles.profileEditorPhotoAction}>{profileDraft.avatarDataUri ? 'Choose a different photo' : 'Choose profile photo'}</Text>
          </Pressable>
          {profileDraft.avatarDataUri && (
            <Pressable onPress={() => setProfileDraft(current => ({ ...current, avatarDataUri: null }))}>
              <Text style={styles.profileEditorRemovePhoto}>Use initials instead</Text>
            </Pressable>
          )}
          <Text style={styles.profileEditorLabel}>GREETING NAME</Text>
          <TextInput value={profileDraft.displayName} onChangeText={displayName => setProfileDraft(current => ({ ...current, displayName }))} maxLength={48} placeholder="Primary Driver" placeholderTextColor={theme.color("#71677a", 'text')} selectionColor="#ff795b" style={styles.profileEditorInput} />
          <View style={styles.profileEditorActions}>
            <Pressable onPress={() => setProfileEditorOpen(false)} style={styles.profileEditorCancel}>
              <Text style={styles.profileEditorCancelText}>Cancel</Text>
            </Pressable>
            <Pressable onPress={saveProfile} style={styles.profileEditorSave}>
              <LinearGradient colors={theme.isCustom ? [theme.palette.accent, theme.palette.accent] : theme.gradient(['#ff795b', '#ff597f'])} style={StyleSheet.absoluteFill} />
              <Text style={[styles.profileEditorSaveText, theme.isCustom && { color: theme.palette.onAccent }]}>Save profile</Text>
            </Pressable>
          </View>
        </CinematicGlass>
      </View>
    </Modal>
  </View>;
}

function profileInitialsFor(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]?.toLocaleUpperCase()).join('') || 'JD';
}

function homeHeroTitle(journey: JourneySummary) {
  const started = new Date(journey.startedAt);
  if (Number.isNaN(started.getTime())) return 'A drive worth remembering';
  const weekday = started.toLocaleDateString(undefined, { weekday: 'long' });
  const hour = started.getHours();
  const moment = hour < 5 ? 'late night' : hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : hour < 21 ? 'evening' : 'night';
  return `${weekday} ${moment} drive`;
}

function homeHeroImageFor(startedAt: string | undefined) {
  const started = startedAt ? new Date(startedAt) : null;
  const hour = started && !Number.isNaN(started.getTime()) ? started.getHours() : 22;
  if (hour >= 5 && hour < 12) return homeHeroImages.morning;
  if (hour >= 12 && hour < 17) return homeHeroImages.afternoon;
  if (hour >= 17 && hour < 21) return homeHeroImages.evening;
  return homeHeroImages.night;
}

function homeRouteContext(journey: Pick<JourneySummary, 'startingLocation' | 'endingLocation'>) {
  const start = journey.startingLocation?.split(',')[0]?.trim();
  const end = journey.endingLocation?.split(',')[0]?.trim();
  if (start && end) return `${start} → ${end}`;
  if (end) return `Arrived near ${end}`;
  if (start) return `Set out from ${start}`;
  return 'Location details are still syncing';
}

function HomeMeshAtmosphere() {
  const theme = useAppTheme();
  const styles = useThemedStyles(darkStyles);

  return <View pointerEvents="none" style={styles.cinematicMeshRoot}>
    <MeshGradientView columns={3} rows={3} points={[[0, 0], [0.54, 0], [1, 0], [0, 0.5], [0.48, 0.44], [1, 0.53], [0, 1], [0.5, 1], [1, 1]]} colors={theme.gradient(['#050208', '#13071b', '#09030b', '#120610', '#08030c', '#1b0a29', '#050208', '#0b040f', '#050208'])} smoothsColors style={StyleSheet.absoluteFill} />
    <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}><Defs><SvgRadialGradient id="homeCoralHaze" cx="82%" cy="16%" rx="42%" ry="30%"><Stop offset="0" stopColor={theme.color("#ff506f", 'accent')} stopOpacity="0.25" /><Stop offset="0.42" stopColor={theme.color("#aa274e", 'accent')} stopOpacity="0.1" /><Stop offset="1" stopColor={theme.color("#050208", 'accent')} stopOpacity="0" /></SvgRadialGradient><SvgRadialGradient id="homeVioletHaze" cx="18%" cy="40%" rx="50%" ry="34%"><Stop offset="0" stopColor={theme.color("#9b4cff", 'accent')} stopOpacity="0.15" /><Stop offset="0.5" stopColor={theme.color("#50207d", 'accent')} stopOpacity="0.06" /><Stop offset="1" stopColor={theme.color("#050208", 'accent')} stopOpacity="0" /></SvgRadialGradient><SvgRadialGradient id="homeLowHaze" cx="70%" cy="72%" rx="55%" ry="24%"><Stop offset="0" stopColor={theme.color("#ff4f72", 'accent')} stopOpacity="0.1" /><Stop offset="1" stopColor={theme.color("#050208", 'accent')} stopOpacity="0" /></SvgRadialGradient></Defs><Rect width="100%" height="100%" fill="url(#homeCoralHaze)" /><Rect width="100%" height="100%" fill="url(#homeVioletHaze)" /><Rect width="100%" height="100%" fill="url(#homeLowHaze)" /></Svg>
    <LinearGradient colors={theme.gradient(['rgba(5,2,8,0.02)', 'rgba(5,2,8,0.22)', '#050208'])} locations={[0, 0.72, 1]} style={StyleSheet.absoluteFill} />
  </View>;
}

function CinematicGlass({ children, style }: { children: ReactNode; style?: any }) {
  const theme = useAppTheme();
  const styles = useThemedStyles(darkStyles);

  const nativeGlass = isLiquidGlassAvailable() && isGlassEffectAPIAvailable();
  return <View style={[styles.cinematicGlass, style]}><View pointerEvents="none" style={styles.cinematicGlassAura} /><View pointerEvents="none" style={styles.cinematicGlassMaterial}>{nativeGlass ? <GlassView glassEffectStyle="clear" tintColor={theme.color("rgba(10,4,16,0.04)", 'text')} colorScheme={theme.mode} style={StyleSheet.absoluteFill} /> : <BlurView intensity={25} tint={theme.mode} style={StyleSheet.absoluteFill} />}<View style={styles.cinematicGlassDarkener} /><LinearGradient colors={theme.gradient(['rgba(255,255,255,0.14)', 'rgba(111,68,130,0.055)', 'rgba(255,72,95,0.045)', 'rgba(3,1,6,0.28)'])} locations={[0, 0.22, 0.72, 1]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} /></View><LiquidGlassEdges radius={25} />{children}</View>;
}

function LiquidGlassEdges({ radius }: { radius: number }) {
  const theme = useAppTheme();
  const styles = useThemedStyles(darkStyles);

  return <View pointerEvents="none" style={[styles.liquidGlassEdges, { borderRadius: radius }]}>
    <NeonWidgetOutline radius={radius} />
    <View style={[styles.liquidGlassOuterBevel, { borderRadius: radius }]} />
    <LinearGradient colors={theme.gradient(['rgba(204,139,242,0.11)', 'rgba(164,85,197,0.035)', 'rgba(255,255,255,0)'])} locations={[0, 0.45, 1]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.liquidGlassTopEdge, { borderTopLeftRadius: radius, borderTopRightRadius: radius }]} />
    <LinearGradient colors={theme.gradient(['rgba(186,117,222,0.075)', 'rgba(255,255,255,0)'])} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.liquidGlassLeftEdge, { borderTopLeftRadius: radius, borderBottomLeftRadius: radius }]} />
    <LinearGradient colors={theme.gradient(['rgba(41,13,62,0.16)', 'rgba(152,82,182,0.045)'])} start={{ x: 1, y: 0 }} end={{ x: 0, y: 1 }} style={[styles.liquidGlassRightEdge, { borderTopRightRadius: radius, borderBottomRightRadius: radius }]} />
    <LinearGradient colors={theme.gradient(['rgba(33,10,48,0.18)', 'rgba(170,99,207,0.05)'])} start={{ x: 0, y: 1 }} end={{ x: 0, y: 0 }} style={[styles.liquidGlassBottomEdge, { borderBottomLeftRadius: radius, borderBottomRightRadius: radius }]} />
    <View style={[styles.liquidGlassInsetBevel, { borderRadius: Math.max(radius - 4, 0) }]} />
  </View>;
}

function SoundtrackWaveform() {
  const theme = useAppTheme();
  const styles = useThemedStyles(darkStyles);

  const bars = [10, 16, 26, 12, 30, 22, 38, 16, 28, 42, 22, 34, 15, 26, 36, 18, 30, 12, 24, 34, 16, 26, 10, 20];
  return (
    <View style={styles.cinematicWaveformContainer}>
      <Text style={styles.cinematicWaveformTime}>1:48</Text>
      <View style={styles.cinematicWaveformBars}>
        {bars.map((height, index) => {
          const ratio = index / (bars.length - 1);
          const color = ratio < 0.32 ? '#ff5277' : ratio < 0.68 ? '#df43e8' : '#6366f1';
          return (
            <View
              key={index}
              style={[
                styles.cinematicWaveBar,
                { height: Math.round(height * 0.68), backgroundColor: theme.color(color, 'surface') },
              ]}
            />
          );
        })}
      </View>
      <Text style={styles.cinematicWaveformTime}>4:03</Text>
    </View>
  );
}

function CinematicHomeAction({ symbol, label, onPress }: { symbol: SFSymbol; label: string; onPress: () => void }) {
  const theme = useAppTheme();
  const styles = useThemedStyles(darkStyles);

  return <Pressable onPress={onPress} style={({ pressed }) => [styles.cinematicWeekAction, pressed && styles.cinematicPressed]}><View style={styles.cinematicWeekActionIcon}><SymbolView name={symbol} tintColor={theme.color("#d7b8ff", 'text')} type="hierarchical" style={styles.cinematicWeekActionSymbol} /></View><Text style={styles.cinematicWeekActionLabel}>{label}</Text></Pressable>;
}

function LegacyHomeScreen({ state, primary, recordingMode, tessieConnected, onRecord, onJourneys, onLive, onSoundtracks, onAtlas, onMore, onConnections, onJourney, onRefresh }: { state: LoadState<AppDashboard>; primary: PrimaryDataState; recordingMode: RecordingMode; tessieConnected: boolean; onRecord: () => void; onJourneys: () => void; onLive: () => void; onSoundtracks: () => void; onAtlas: () => void; onMore: (destination: MoreDestination | 'search' | 'timeline' | 'statistics') => void; onConnections: () => void; onJourney: (id: string) => void; onRefresh: () => void }) {
  const theme = useAppTheme();
  const styles = useThemedStyles(darkStyles);

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
  const musicConnected = data.providerPreferences?.musicProvider === 'apple_music' ? connections.appleMusic === 'connected'
    : data.providerPreferences?.musicProvider === 'shazam' ? connections.shazam === 'enabled'
    : data.providerPreferences?.musicProvider === 'lastfm' ? connections.lastFm === 'connected' : false;
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
              <Pressable onPress={onLive} style={styles.webLivePill}><View style={[styles.webLiveDot, { backgroundColor: theme.color(recorderColor(data.recorder.state, data.recorder.connected), 'surface') }]} /><Text style={styles.webLiveText}>{data.recorder.state === 'recording' ? 'RECORDING' : automaticMode ? 'WATCHING' : 'READY'}</Text></Pressable>
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
            <View style={[styles.webRecorderBeacon, { borderColor: theme.color(recorderColor(data.recorder.state, data.recorder.connected), 'border') }]}><View style={[styles.webRecorderBeaconCore, { backgroundColor: theme.color(recorderColor(data.recorder.state, data.recorder.connected), 'surface') }]} /></View>
            <View style={styles.flex}><Text style={styles.webRecorderTitle}>{automaticMode && data.recorder.state === 'ready' ? 'Automatic detection is watching' : recorderTitle(data.recorder.state, data.recorder.connected)}</Text><Text style={styles.webRecorderDetail}>{automaticMode && data.recorder.state === 'ready' ? 'JourneyDeck will begin after sustained driving speed.' : recorderDetail(data.recorder.state, data.recorder.queuedPoints, data.recorder.queuedMusic)}</Text></View>
            <Text style={styles.webRecorderChevron}>›</Text>
          </Pressable>
          {(recordingMode === 'manual' || data.recorder.state === 'recording') && <PrimaryAction label={data.recorder.state === 'recording' ? 'Open active recording' : 'Start a journey'} onPress={onRecord} />}

          <View style={styles.webActions}>
            <WebAction symbol="arrow.clockwise" title="Sync" detail="Latest journey" color={theme.color("#ff645d", 'text')} onPress={onRefresh} />
            <WebAction symbol="play.fill" title="Replay" detail="Your journey" color={theme.color("#a75cff", 'text')} onPress={data.latestJourney ? () => onJourney(data.latestJourney!.id) : onJourneys} />
            <WebAction symbol="map" title="Journeys" detail="Your archive" color={theme.color("#45bdf4", 'text')} onPress={onJourneys} />
            <WebAction symbol="link" title="Connect" detail="Music & car" color={theme.color("#ff9a5d", 'text')} onPress={onConnections} />
          </View>

          {home && <>
            <View style={styles.homeSummaryHeading}><View><Text style={styles.webPanelTitle}>YOUR JOURNEYDECK</Text><Text style={styles.homeSummarySubtitle}>Everything the road has saved on this iPhone</Text></View><View style={styles.homeLocalPill}><View style={styles.homeLocalDot} /><Text style={styles.homeLocalText}>LOCAL</Text></View></View>
            <View style={styles.homeArchiveGrid}>
              <HomeArchiveTile value={home.archive.journeys} label="Journeys" color={theme.color("#ff765a", 'text')} onPress={onJourneys} />
              <HomeArchiveTile value={home.archive.memories} label="Memories" color={theme.color("#a876ff", 'text')} onPress={onJourneys} />
              <HomeArchiveTile value={home.archive.places} label="Places" color={theme.color("#4bd6b1", 'text')} onPress={onAtlas} />
            </View>

            <View style={styles.homeSpotlightGrid}>
              <Pressable onPress={onJourneys} style={[styles.homeSpotlight, styles.homeMemorySpotlight]}>
                <LinearGradient colors={theme.gradient(['#35164a', '#140a20'])} style={StyleSheet.absoluteFill} />
                <Text style={styles.homeSpotlightKicker}>MEMORY SPOTLIGHT</Text>
                <Text style={styles.homeSpotlightTitle} numberOfLines={2}>{home.memorySpotlight?.name ?? 'Create your first chapter'}</Text>
                <Text style={styles.homeSpotlightMeta}>{home.memorySpotlight ? `${home.memorySpotlight.journeys} journeys  •  ${home.memorySpotlight.photos} photos` : 'Group the journeys you want to remember.'}</Text>
                <Text style={styles.homeSpotlightAction}>Open Memories  ›</Text>
              </Pressable>
              <Pressable onPress={onSoundtracks} style={[styles.homeSpotlight, styles.homeMusicSpotlight]}>
                <LinearGradient colors={theme.gradient(['#471329', '#150918'])} style={StyleSheet.absoluteFill} />
                <Text style={[styles.homeSpotlightKicker, { color: theme.color('#ff769e', 'text') }]}>ROAD SOUNDTRACK</Text>
                <Text style={styles.homeSpotlightTitle} numberOfLines={2}>{home.topTrack?.track ?? 'Your soundtrack is waiting'}</Text>
                <Text style={styles.homeSpotlightMeta} numberOfLines={2}>{home.topTrack ? `${home.topTrack.artist}  •  ${home.topTrack.plays} road play${home.topTrack.plays === 1 ? '' : 's'}` : 'Matched songs will be ranked locally.'}</Text>
                <Text style={[styles.homeSpotlightAction, { color: theme.color('#ff91b0', 'text') }]}>Open Music  ›</Text>
              </Pressable>
            </View>

            <Pressable onPress={onAtlas} style={styles.homePatternCard}>
              <View style={styles.homePatternIcon}><SymbolView name="point.bottomleft.forward.to.point.topright.scurvepath" tintColor={theme.color("#ff8065", 'text')} type="hierarchical" style={styles.homePatternSymbol} /></View>
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
                <HomeExploreAction symbol="clock.arrow.circlepath" title="Timeline" detail={`${home.timelineEvents} recent events`} color={theme.color("#6b9cff", 'text')} onPress={() => onMore('timeline')} />
                <HomeExploreAction symbol="globe.americas" title="Atlas" detail="Places & patterns" color={theme.color("#4bd6b1", 'text')} onPress={onAtlas} />
                <HomeExploreAction symbol="chart.bar.xaxis" title="Statistics" detail="Trends & highlights" color={theme.color("#ff8065", 'text')} onPress={() => onMore('statistics')} />
                <HomeExploreAction symbol="magnifyingglass" title="Search" detail="Find anything" color={theme.color("#d57aff", 'text')} onPress={() => onMore('search')} />
              </View>
            </View>
          </>}

          <View style={styles.webBottomGrid}>
            <View style={styles.webJourneysPanel}>
              <View style={styles.webPanelHeader}><Text style={styles.webPanelTitle}>RECENT JOURNEYS</Text><Pressable onPress={onJourneys}><Text style={styles.webPanelAction}>View all  ›</Text></Pressable></View>
              {recentJourneys.length ? recentJourneys.map(journey => <CompactJourneyRow key={journey.id} journey={journey} onPress={() => onJourney(journey.id)} />) : <Text style={styles.webPanelEmpty}>Your completed journeys will appear here.</Text>}
            </View>
            <View style={styles.webHealthPanel}>
              <View style={styles.webPanelHeader}><Text style={[styles.webPanelTitle, { color: theme.color('#45c6f0', 'text') }]}>DATA HEALTH</Text></View>
              <CompactHealthRow symbol="J" label="JourneyDeck" detail={data.recorder.connected ? 'Connected' : 'Offline'} healthy={data.recorder.connected} />
              <CompactHealthRow symbol="♪" label="Music" detail={musicConnected ? 'Ready' : 'Check'} healthy={musicConnected} />
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
  const theme = useAppTheme();
  const styles = useThemedStyles(darkStyles);

  return <Pressable onPress={onPress} style={[styles.homeArchiveTile, { borderColor: theme.color(`${color}66`, 'border'), shadowColor: theme.color(color, 'shadow') }]}><View style={[styles.homeArchiveGlow, { backgroundColor: theme.color(`${color}22`, 'surface') }]} /><Text style={[styles.homeArchiveValue, { color }]}>{value.toLocaleString()}</Text><Text style={styles.homeArchiveLabel}>{label}</Text></Pressable>;
}

function HomeIntelligenceMetric({ value, label, detail }: { value: string; label: string; detail: string }) {
  const styles = useThemedStyles(darkStyles);

  return <View style={styles.homeIntelligenceMetric}><Text style={styles.homeIntelligenceValue} numberOfLines={1}>{value}</Text><Text style={styles.homeIntelligenceLabel}>{label}</Text><Text style={styles.homeIntelligenceDetail} numberOfLines={1}>{detail}</Text></View>;
}

function HomeExploreAction({ symbol, title, detail, color, onPress }: { symbol: SFSymbol; title: string; detail: string; color: string; onPress: () => void }) {
  const theme = useAppTheme();
  const styles = useThemedStyles(darkStyles);

  return <Pressable onPress={onPress} style={styles.homeExploreAction}><View style={[styles.homeExploreIcon, { backgroundColor: theme.color(`${color}18`, 'surface'), borderColor: theme.color(`${color}55`, 'border') }]}><SymbolView name={symbol} tintColor={theme.color(color, 'text')} type="hierarchical" style={styles.homeExploreSymbol} /></View><View style={styles.flex}><Text style={styles.homeExploreTitle}>{title}</Text><Text style={styles.homeExploreDetail}>{detail}</Text></View><Text style={[styles.webRecorderChevron, { color }]}>›</Text></Pressable>;
}

function DashboardWaveform() {
  const styles = useThemedStyles(darkStyles);

  const bars = [8, 16, 27, 13, 31, 20, 38, 17, 29, 42, 20, 34, 14, 27, 37, 18, 31, 11, 24, 35, 16, 27, 9, 20];
  return <View style={styles.webWaveform}>{bars.map((height, index) => <View key={index} style={[styles.webWaveBar, { height }]} />)}</View>;
}

function WebAction({ symbol, title, detail, color, onPress }: { symbol: SFSymbol; title: string; detail: string; color: string; onPress: () => void }) {
  const theme = useAppTheme();
  const styles = useThemedStyles(darkStyles);

  return <Pressable onPress={onPress} style={({ pressed }) => [styles.webAction, { borderColor: theme.color(`${color}88`, 'border'), shadowColor: theme.color(color, 'shadow') }, pressed && styles.pressed]}>
    <LinearGradient pointerEvents="none" colors={theme.gradient([`${color}70`, `${color}25`, '#12091b'])} locations={[0, 0.48, 1]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
    <Svg pointerEvents="none" viewBox="0 0 100 120" preserveAspectRatio="none" style={StyleSheet.absoluteFill}><Defs><SvgRadialGradient id={`actionGlint${title.replace(/\s/g, '')}`} cx="28%" cy="8%" rx="64%" ry="48%"><Stop offset="0" stopColor={theme.color("#ffffff", 'accent')} stopOpacity="0.23" /><Stop offset="0.42" stopColor={theme.color("#ffffff", 'accent')} stopOpacity="0.06" /><Stop offset="1" stopColor={theme.color("#ffffff", 'accent')} stopOpacity="0" /></SvgRadialGradient></Defs><Rect width="100" height="120" fill={theme.color(`url(#actionGlint${title.replace(/\s/g, '')})`, 'accent')} /></Svg>
    <View style={[styles.webActionIcon, { borderColor: theme.color(`${color}cc`, 'border'), shadowColor: theme.color(color, 'shadow') }]}><SymbolView name={symbol} tintColor={theme.color(color, 'text')} type="hierarchical" style={styles.webActionSymbol} /></View>
    <View style={styles.webActionSpacer} />
    <Text style={styles.webActionTitle}>{title}</Text><Text style={styles.webActionDetail} numberOfLines={1}>{detail}</Text>
  </Pressable>;
}

function CompactJourneyRow({ journey, onPress }: { journey: JourneySummary; onPress: () => void }) {
  const theme = useAppTheme();
  const styles = useThemedStyles(darkStyles);

  return (
    <TouchPressable onPress={onPress} style={({ pressed }) => [styles.webJourneyRow, pressed && styles.pressed]}>
      <View style={styles.webPlaceIcon}><Text>⌂</Text></View>
      <View style={styles.flex}>
        <Text style={styles.webJourneyOrigin} numberOfLines={2}>{journey.startingLocation ?? 'Journey start'}</Text>
        <Text style={styles.webJourneyDestination} numberOfLines={1}>{journey.endingLocation ?? 'Recorded destination'}</Text>
        <Text style={styles.webJourneyMeta}>{formatMiles(journey.miles)} · {formatDuration(journey.durationMinutes)}</Text>
      </View>
      <View style={styles.webRouteThumb}>
        <Svg width={48} height={38} viewBox="0 0 48 38">
          <Path d="M 6 30 Q 20 10 42 12" fill="none" stroke={theme.color("#ff694f", 'accent')} strokeWidth="2.5" strokeLinecap="round" />
          <Circle cx="6" cy="30" r="3" fill={theme.color("#9746f5", 'accent')} />
          <Circle cx="42" cy="12" r="3" fill={theme.color("#ffc2af", 'accent')} />
        </Svg>
      </View>
    </TouchPressable>
  );
}

function CompactHealthRow({ symbol, icon, label, detail, healthy }: { symbol: string; icon?: ReactNode; label: string; detail: string; healthy: boolean }) {
  const theme = useAppTheme();
  const styles = useThemedStyles(darkStyles);

  return <View style={styles.webCompactHealth}>{icon ?? <View style={[styles.webServiceIcon, { backgroundColor: theme.color(healthy ? '#2589c8' : '#62334c', 'surface') }]}><Text style={styles.webServiceIconText}>{symbol}</Text></View>}<View style={styles.flex}><Text style={styles.webServiceName} numberOfLines={1}>{label}</Text><Text style={styles.webServiceDetail} numberOfLines={1}>{detail}</Text></View><View style={[styles.webHealthCheck, { backgroundColor: theme.color(healthy ? '#2caeea' : '#ff9a5d', 'surface') }]}><Text style={styles.webHealthCheckText}>{healthy ? '✓' : '!'}</Text></View></View>;
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
  const theme = useAppTheme();
  const styles = useThemedStyles(darkStyles);

  return <View style={styles.dashboardStatCard}><View style={[styles.dashboardStatIcon, { backgroundColor: theme.color(`${color}20`, 'surface') }]}><Text style={[styles.dashboardStatSymbol, { color }]}>{symbol}</Text></View><Text style={styles.dashboardStatKicker}>{kicker}</Text><Text style={styles.dashboardStatValue} numberOfLines={1}>{value}</Text><Text style={styles.dashboardStatDetail}>{detail}</Text></View>;
}

function QuickAction({ symbol, title, detail, onPress, color }: { symbol: string; title: string; detail: string; onPress: () => void; color: string }) {
  const styles = useThemedStyles(darkStyles);

  return <Pressable onPress={onPress} style={({ pressed }) => [styles.quickAction, pressed && styles.pressed]}><Text style={[styles.quickActionSymbol, { color }]}>{symbol}</Text><Text style={styles.quickActionTitle}>{title}</Text><Text style={styles.quickActionDetail}>{detail}</Text></Pressable>;
}

function DashboardHealthRow({ label, detail, healthy }: { label: string; detail: string; healthy: boolean }) {
  const theme = useAppTheme();
  const styles = useThemedStyles(darkStyles);

  return <View style={styles.dashboardHealthRow}><View style={[styles.dashboardHealthDot, { backgroundColor: theme.color(healthy ? '#43e6ae' : '#ffb15c', 'surface') }]} /><View style={styles.flex}><Text style={styles.dashboardHealthLabel}>{label}</Text><Text style={styles.dashboardHealthDetail}>{detail}</Text></View><Text style={[styles.dashboardHealthState, { color: theme.color(healthy ? '#43e6ae' : '#ffb15c', 'text') }]}>{healthy ? 'READY' : 'CHECK'}</Text></View>;
}

function OpenRoadArtwork() {
  const theme = useAppTheme();
  const styles = useThemedStyles(darkStyles);

  return <View style={styles.openRoad} pointerEvents="none">
    <Svg width="100%" height={132} viewBox="0 0 360 132" style={StyleSheet.absoluteFill}>
      <Defs>
        <SvgLinearGradient id="openRoadSky" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={theme.color("#1a0c28", 'accent')} />
          <Stop offset="0.6" stopColor={theme.color("#0d0918", 'accent')} />
          <Stop offset="1" stopColor={theme.color("#050308", 'accent')} />
        </SvgLinearGradient>
        <SvgLinearGradient id="openRoadSun" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={theme.color("#ff9a78", 'accent')} />
          <Stop offset="1" stopColor={theme.color("#ff5a43", 'accent')} />
        </SvgLinearGradient>
        <SvgLinearGradient id="openRoadGlow" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor={theme.color("#ff5a43", 'accent')} stopOpacity={0} />
          <Stop offset="0.5" stopColor={theme.color("#ff7b54", 'accent')} stopOpacity={0.6} />
          <Stop offset="1" stopColor={theme.color("#ff5a43", 'accent')} stopOpacity={0} />
        </SvgLinearGradient>
        <SvgLinearGradient id="openRoadPav" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={theme.color("#1e142e", 'accent')} />
          <Stop offset="1" stopColor={theme.color("#0a0612", 'accent')} />
        </SvgLinearGradient>
      </Defs>
      <Rect width="360" height="132" fill="url(#openRoadSky)" />
      <Circle cx={45} cy={22} r={1.5} fill={theme.color("#e4d6ff", 'accent')} opacity={0.7} />
      <Circle cx={120} cy={35} r={1} fill={theme.color("#e4d6ff", 'accent')} opacity={0.5} />
      <Circle cx={275} cy={18} r={1.5} fill={theme.color("#e4d6ff", 'accent')} opacity={0.8} />
      <Circle cx={320} cy={38} r={1} fill={theme.color("#e4d6ff", 'accent')} opacity={0.6} />
      <Circle cx={180} cy={56} r={28} fill="url(#openRoadSun)" opacity={0.9} />
      <Circle cx={180} cy={56} r={44} fill={theme.color("#ff5a43", 'accent')} opacity={0.15} />
      <Path d="M 16 58 L 344 58" stroke="url(#openRoadGlow)" strokeWidth={1.5} />
      <Path d="M 162 58 L 198 58 L 290 132 L 70 132 Z" fill="url(#openRoadPav)" />
      <Path d="M 162 58 L 70 132" stroke={theme.color("#9d70ff", 'accent')} strokeWidth={2} opacity={0.75} />
      <Path d="M 198 58 L 290 132" stroke={theme.color("#9d70ff", 'accent')} strokeWidth={2} opacity={0.75} />
      <Path d="M 180 62 L 180 70" stroke={theme.color("#ff8767", 'accent')} strokeWidth={1.5} opacity={0.8} />
      <Path d="M 180 76 L 180 90" stroke={theme.color("#ff8767", 'accent')} strokeWidth={2.5} opacity={0.9} />
      <Path d="M 180 98 L 180 124" stroke={theme.color("#ff8767", 'accent')} strokeWidth={4} opacity={1} />
    </Svg>
    <View style={styles.roadSoundwave}><View style={styles.roadSoundBarSmall} /><View style={styles.roadSoundBarTall} /><View style={styles.roadSoundBarMedium} /><View style={styles.roadSoundBarTall} /><View style={styles.roadSoundBarSmall} /></View>
    <Text style={styles.roadCaption}>OPEN ROAD  •  YOUR STORY</Text>
  </View>;
}

type MemoryEditorDraft = { id: string | null; name: string; notes: string; journeyIds: string[]; previousJourneyIds: string[]; coverPhotoId: string | null; photos: JourneyPhoto[] };

function memoryDraftSignature(draft: MemoryEditorDraft) {
  return JSON.stringify({ name: draft.name.trim(), notes: draft.notes.trim(), journeyIds: [...new Set(draft.journeyIds)].sort(), coverPhotoId: draft.coverPhotoId });
}

function MemoriesScreen({ catalog, journeys, details, historyLimited, onUpgrade, onJourney, onMemory, onRefresh, onFiftyStates, detailId, detailReady, studio = false }: {
  catalog: LoadState<MemoriesCatalog>; journeys: LoadState<JourneySummary[]>; details: JourneyDetail[];
  historyLimited: boolean; onUpgrade: () => void; onJourney: (id: string) => void; onMemory: (id: string) => void; onRefresh: () => void; onFiftyStates?: () => void; detailId?: string; detailReady?: () => void; studio?: boolean;
}) {
  const theme = useAppTheme();
  const styles = useThemedStyles(darkStyles);

  const insets = useSafeAreaInsets();
  const adaptiveLayout = useAdaptiveLayout();
  const { width } = useWindowDimensions();
  const cardWidth = Math.max(260, width - 74), cardStep = cardWidth + 14;
  const scrollX = useRef(new Animated.Value(0)).current;
  const carousel = useRef<any>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const memoryOverview = detailId ? catalog.data.memories.find(memory => memory.id === detailId) ?? null : null;
  const [shareCard, setShareCard] = useState<ShareCardPayload | null>(null);
  const [memoryDraft, setMemoryDraft] = useState<MemoryEditorDraft | null>(null);
  const studioArtworkKey = useRef('road-trips');
  const [memorySavedSignature, setMemorySavedSignature] = useState<string | null>(null);
  const [memorySaveVersion, setMemorySaveVersion] = useState(0);
  const [saving, setSaving] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [section, setSection] = useState<'library' | 'memories'>('memories');
  const [query, setQuery] = useState('');
  const [libraryFilter, setLibraryFilter] = useState<JourneyLibraryFilter>('all');
  const [librarySort, setLibrarySort] = useState<JourneyLibrarySort>('newest');
  const [assignJourneyId, setAssignJourneyId] = useState<string | null>(null);
  const afterAssignDismiss = useRef<(() => void) | null>(null);
  const afterEditorDismiss = useRef<(() => void) | null>(null);
  const visibleJourneys = useMemo(() => filterJourneyLibrary(journeys.data, query, libraryFilter, librarySort), [journeys.data, query, libraryFilter, librarySort]);
  const recurringRoutes = useMemo(() => favoriteRoutes(journeys.data).slice(0, 3), [journeys.data]);
  const visibleMemories = useMemo(() => catalog.data.memories.filter(item => `${item.name} ${item.notes}`.toLowerCase().includes(query.trim().toLowerCase())), [catalog.data.memories, query]);
  const selectedMemory = catalog.data.memories[Math.min(selectedIndex, Math.max(0, catalog.data.memories.length - 1))] ?? null;
  const selectedMemoryJourneys = selectedMemory ? journeys.data.filter(journey => selectedMemory.journeyIds.includes(journey.id)) : [];
  const availableMemoryPhotos = memoryDraft?.photos ?? [];
  const memoryDraftDirty = Boolean(memoryDraft && memoryDraftSignature(memoryDraft) !== memorySavedSignature);

  useEffect(() => { if (selectedIndex >= catalog.data.memories.length && catalog.data.memories.length) setSelectedIndex(catalog.data.memories.length - 1); }, [catalog.data.memories.length, selectedIndex]);
  const editMemory = (memory: JourneyMemory | null, preselectedJourneyId?: string | null) => {
    setMemorySaveVersion(0);
    studioArtworkKey.current = memory?.artworkKey ?? 'road-trips';
    const draft = { id: memory?.id ?? null, name: memory?.name ?? '', notes: memory?.notes ?? '', journeyIds: [...(memory?.journeyIds ?? (preselectedJourneyId ? [preselectedJourneyId] : []))], previousJourneyIds: [...(memory?.journeyIds ?? [])], coverPhotoId: memory?.coverPhotoId ?? null, photos: [...(memory?.photos ?? [])] };
    setMemoryDraft(draft);
    setMemorySavedSignature(memory ? memoryDraftSignature(draft) : null);
  };
  const toggleMemoryJourney = (id: string) => setMemoryDraft(current => {
    if (!current) return current;
    return { ...current, journeyIds: current.journeyIds.includes(id) ? current.journeyIds.filter(value => value !== id) : [...current.journeyIds, id] };
  });
  const saveMemory = async () => {
    if (!memoryDraft || saving || photoBusy) return;
    if (!memoryDraft.name.trim()) return Alert.alert('Name this memory', 'Give the memory a short name first.');
    if (!memoryDraft.id && !memoryDraft.journeyIds.length) return Alert.alert('Choose a journey', 'A Memory needs at least one journey.');
    setSaving(true);
    try {
      const wasNew = !memoryDraft.id;
      const saved = await appDataClient.saveMemory({ id: memoryDraft.id, name: memoryDraft.name, notes: memoryDraft.notes, journeyIds: memoryDraft.journeyIds, previousJourneyIds: memoryDraft.previousJourneyIds, coverPhotoId: memoryDraft.coverPhotoId, artworkKey: studio ? studioArtworkKey.current : (memoryOverview ?? selectedMemory)?.artworkKey ?? 'road-trips' });
      const next = { ...memoryDraft, id: saved.id, name: saved.name, notes: saved.notes, journeyIds: saved.journeyIds, previousJourneyIds: saved.journeyIds, coverPhotoId: saved.coverPhotoId, photos: saved.photos };
      setMemoryDraft(next);
      setMemorySavedSignature(memoryDraftSignature(next));
      setMemorySaveVersion(version => version + 1);
      void haptics.success();
      onRefresh();
      afterEditorDismiss.current = wasNew ? () => onMemory(saved.id) : null;
      setMemoryDraft(null);
    } catch (error) { Alert.alert('Memory not saved', error instanceof Error ? error.message : 'JourneyDeck could not save this memory.'); }
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
  const removePhoto = (photo: JourneyPhoto) => Alert.alert('Remove photo?', 'This removes the photo from this Memory.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Remove', style: 'destructive', onPress: () => void (async () => {
      setPhotoBusy(true);
      try {
        await appDataClient.removePhoto(photo.id);
        setMemoryDraft(current => current ? { ...current, photos: current.photos.filter(item => item.id !== photo.id), coverPhotoId: current.coverPhotoId === photo.id ? null : current.coverPhotoId } : current);
        onRefresh();
      } catch (error) { Alert.alert('Photo not removed', error instanceof Error ? error.message : 'JourneyDeck could not remove this photo.'); }
      finally { setPhotoBusy(false); }
    })() },
  ]);

  const deleteMemory = () => {
    if (!memoryDraft?.id) return;
    Alert.alert('Delete this Memory?', 'It will disappear on this iPhone and your other devices. JourneyDeck keeps a recoverable deletion marker so an older device cannot bring it back.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => void (async () => {
        setSaving(true);
        try { await appDataClient.deleteMemory(memoryDraft.id!); if (detailId) afterEditorDismiss.current = () => router.back(); setMemoryDraft(null); onRefresh(); }
        catch (error) { Alert.alert('Memory not deleted', error instanceof Error ? error.message : 'JourneyDeck could not delete this Memory.'); }
        finally { setSaving(false); }
      })() },
    ]);
  };

  const overviewJourneys = memoryOverview ? journeys.data.filter(journey => memoryOverview.journeyIds.includes(journey.id)) : [];
  const memoryCover = memoryOverview?.coverPhotoId ? memoryOverview.photos.find(photo => photo.id === memoryOverview.coverPhotoId) ?? null : null;
  const openMemoryShare = (memory: JourneyMemory) => {
    const memoryJourneys = journeys.data.filter(journey => memory.journeyIds.includes(journey.id));
    setShareCard({ kind: 'memory', eyebrow: 'A JOURNEYDECK MEMORY', title: memory.name, subtitle: memory.notes || 'A group of journeys worth remembering.', metrics: [{ label: 'JOURNEYS', value: String(memoryJourneys.length) }, { label: 'MILES', value: formatMiles(memoryJourneys.reduce((sum, journey) => sum + journey.miles, 0)) }, { label: 'PHOTOS', value: String(memory.photos.length) }], photo: memory.coverPhotoId ? memory.photos.find(photo => photo.id === memory.coverPhotoId) ?? null : null, accent: '#ff6a68' });
  };
  const toggleJourneyInMemory = async (memory: JourneyMemory) => {
    if (!assignJourneyId || saving) return;
    setSaving(true);
    try {
      const journeyIds = memory.journeyIds.includes(assignJourneyId) ? memory.journeyIds.filter(id => id !== assignJourneyId) : [...memory.journeyIds, assignJourneyId];
      await appDataClient.saveMemory({ id: memory.id, name: memory.name, notes: memory.notes, artworkKey: memory.artworkKey, coverPhotoId: memory.coverPhotoId, journeyIds, previousJourneyIds: memory.journeyIds });
      setAssignJourneyId(null);
      onRefresh();
    } catch (error) { Alert.alert('Memory not updated', error instanceof Error ? error.message : 'Please try again.'); }
    finally { setSaving(false); }
  };

  return <View style={styles.safe}>
    {studio && !detailId && <IpadMemoriesScreen presentation={adaptiveLayout.isRegular ? 'ipad' : 'iphone'} memories={catalog.data.memories} journeys={journeys.data}
      renderArtwork={memory => <MemoryArtwork artworkKey={memory.artworkKey} photo={memory.photos.find(photo => photo.id === memory.coverPhotoId) ?? null} />}
      onCreate={ids => { editMemory(null); setMemoryDraft(draft => draft ? { ...draft, journeyIds: [...new Set(ids)] } : draft); }}
      onAdd={async (id, ids) => { await appDataClient.addJourneysToMemory(id, ids); onRefresh(); }}
      onEdit={memory => { void appDataClient.memories().then(data => {
        const latest = data.memories.find(item => item.id === memory.id);
        if (latest) editMemory(latest);
        else Alert.alert('Memory unavailable', 'This Memory is no longer in your library.');
      }).catch(() => Alert.alert('Memory unavailable', 'Your library could not be read. Please try again.')); }}
      onShare={openMemoryShare} onMemory={onMemory} onJourney={onJourney} onRefresh={onRefresh} onFiftyStates={onFiftyStates}
      loading={catalog.status === 'loading' || journeys.status === 'loading'} error={catalog.status === 'error' || journeys.status === 'error' ? catalog.message ?? journeys.message ?? 'Your library could not refresh.' : undefined}
      historyLimited={historyLimited} onUpgrade={onUpgrade} busy={Boolean(memoryDraft || shareCard) || saving} />}
    {!studio && !detailId && <ScrollView
      contentContainerStyle={[styles.memoriesPage, { paddingTop: insets.top + 14, paddingBottom: insets.bottom + 28 }]}
      contentInsetAdjustmentBehavior="never"
      automaticallyAdjustContentInsets={false}
      automaticallyAdjustsScrollIndicatorInsets={false}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <AtmosphericBackdrop variant="memories" />
      <View style={styles.memoryPageHeader}><PageHeader variant="memories" eyebrow="YOUR STORY ON THE ROAD" title="Memories" body="A Journey is one recorded drive. A Memory is a group of journeys you want to keep together." /></View>
      {(catalog.status === 'error' || journeys.status === 'error') && <InlineNotice message={catalog.message ?? journeys.message ?? 'Memories could not refresh.'} onRetry={onRefresh} />}

      <View style={styles.libraryTabs}><NeonWidgetOutline radius={16} />{(['memories', 'library'] as const).map(item => <Pressable key={item} onPress={() => { setSection(item); setQuery(''); }} style={[styles.libraryTab, section === item && styles.libraryTabActive]}>{section === item && <View pointerEvents="none" style={styles.libraryTabSelectionGlow} />}<Text style={[styles.libraryTabText, section === item && styles.libraryTabTextActive]}>{item === 'library' ? 'Journeys' : 'Memories'}</Text></Pressable>)}</View>
      <View style={styles.librarySearchFrame}><NeonWidgetOutline radius={15} /><TextInput value={query} onChangeText={setQuery} placeholder={`Search ${section}`} placeholderTextColor={theme.color("#716879", 'text')} style={styles.librarySearch} /></View>
      {historyLimited && <Pressable accessibilityRole="button" accessibilityLabel="Unlock complete journey and memory history" onPress={onUpgrade} style={styles.memoryHistoryGate}><View><Text style={styles.memoryHistoryGateKicker}>LATEST 45 DAYS</Text><Text style={styles.memoryHistoryGateText}>Unlock every Journey and Memory</Text></View><Text style={styles.memoryHistoryGateArrow}>›</Text></Pressable>}

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
          return <Animated.View key={memory.id} style={{ width: cardWidth, transform: [{ scale }, { translateY }] }}>
            <CardDetailLink kind="memory" id={memory.id} onSelect={() => setSelectedIndex(index)} actions={[
              { id: 'edit', title: 'Edit Memory', icon: 'pencil', onPress: () => editMemory(memory) },
              { id: 'share', title: 'Create share card', icon: 'square.and.arrow.up', onPress: () => openMemoryShare(memory) },
            ]}>
            <Pressable onPress={() => { setSelectedIndex(index); carousel.current?.scrollTo({ x: index * cardStep, animated: true }); onMemory(memory.id); }} style={styles.memoryHeroCard}><NeonWidgetOutline radius={26} />
              <MemoryArtwork artworkKey={memory.artworkKey} photo={memory.coverPhotoId ? memory.photos.find(photo => photo.id === memory.coverPhotoId) ?? null : null} />
              <LinearGradient colors={theme.gradient(['rgba(9,7,16,0)', 'rgba(9,7,16,0.28)', 'rgba(9,7,16,0.88)'])} locations={[0, 0.35, 1]} style={styles.memoryCardShade} />
              <Text style={[styles.memoryHeroTitle, styles.memoryCardTitle]}>{memory.name}</Text>
              <Text style={[styles.memoryHeroMeta, styles.memoryCardMeta]}>{memory.journeyIds.length} {memory.journeyIds.length === 1 ? 'journey' : 'journeys'}  •  {memory.photos.length} photos</Text>
            </Pressable>
            </CardDetailLink>
          </Animated.View>;
        })}
        {!catalog.data.memories.length && <Pressable onPress={() => editMemory(null)} style={[styles.memoryHeroCard, styles.memoryEmptyHero, { width: cardWidth }]}><NeonWidgetOutline radius={26} /><MemoryArtwork artworkKey="road-trips" /><View style={styles.memoryHeroShade} /><Text style={styles.memoryHeroKicker}>YOUR FIRST MEMORY</Text><Text style={styles.memoryHeroTitle}>Keep journeys together</Text><Text style={styles.memoryHeroMeta}>Choose one or more journeys to begin</Text></Pressable>}
      </Animated.ScrollView>
      <View style={styles.memoryDots}>{visibleMemories.map((memory, index) => <View key={memory.id} style={[styles.memoryDot, index === selectedIndex && styles.memoryDotActive]} />)}</View>

      <View style={styles.memorySectionHeader}><View><Text style={styles.memoryLevel}>JOURNEYS</Text><Text style={styles.memorySectionTitle}>{selectedMemory?.name ?? 'Build your first Memory'}</Text></View>{selectedMemory && <NativeActionMenu label="Memory actions" compact actions={[
        { id: 'open', title: 'Open Memory', image: 'photo.on.rectangle', onSelect: () => onMemory(selectedMemory.id) },
        { id: 'edit', title: 'Edit Memory', image: 'pencil', onSelect: () => editMemory(selectedMemory) },
        { id: 'share', title: 'Create share card', image: 'square.and.arrow.up', onSelect: () => openMemoryShare(selectedMemory) },
      ]} />}</View>
      <View style={styles.memoryJourneyList}>{selectedMemoryJourneys.map(journey => <JourneyCard key={journey.id} journey={journey} compact onPress={() => onJourney(journey.id)} />)}</View>
      {selectedMemory && !selectedMemoryJourneys.length && <EmptyCard title="This Memory is waiting for a journey" body="Edit it and choose one or more journeys to keep together." />}
      </>}

      {section === 'library' && <>
      <View style={styles.libraryFilterRow}>
        <NativeActionMenu stretch label={`Filter: ${{all: 'All', music: 'With music', long: '10+ miles', efficient: 'Easy pace'}[libraryFilter]}`} actions={(['all', 'music', 'long', 'efficient'] as const).map(id => ({ id, title: {all: 'All journeys', music: 'With music', long: '10+ miles', efficient: 'Easy pace'}[id], state: libraryFilter === id ? 'on' : 'off', onSelect: () => setLibraryFilter(id) }))} />
        <NativeActionMenu stretch label={`Sort: ${{newest: 'Newest', oldest: 'Oldest', distance: 'Distance', duration: 'Drive time'}[librarySort]}`} actions={(['newest', 'oldest', 'distance', 'duration'] as const).map(id => ({ id, title: {newest: 'Newest first', oldest: 'Oldest first', distance: 'Distance', duration: 'Drive time'}[id], state: librarySort === id ? 'on' : 'off', onSelect: () => setLibrarySort(id) }))} />
      </View>
      {recurringRoutes.length > 0 && <><View style={styles.memorySectionHeader}><View><Text style={styles.memoryLevel}>FAVORITE ROUTES</Text><Text style={styles.memorySectionTitle}>Roads you return to</Text></View></View>{recurringRoutes.map(route => <View key={route.key} style={styles.favoriteRoute}><NeonWidgetOutline radius={17} /><View style={styles.flex}><Text style={styles.favoriteRouteTitle}>{route.label}</Text><Text style={styles.favoriteRouteMeta}>{route.count} drives  •  {formatMiles(route.averageMiles)} average  •  {Math.round(route.averageMinutes)} min</Text></View><Text style={styles.favoriteRouteCount}>{route.count}×</Text></View>)}</>}
      <View style={styles.memorySectionHeader}><View><Text style={styles.memoryLevel}>JOURNEY LIBRARY</Text><Text style={styles.memorySectionTitle}>{visibleJourneys.length} archived drives</Text></View></View>
      <View style={styles.memoryJourneyList}>{visibleJourneys.map(journey => <View key={journey.id} style={styles.libraryJourneyWrap}><JourneyCard journey={journey} compact onPress={() => onJourney(journey.id)} /><Pressable onPress={() => setAssignJourneyId(journey.id)} style={styles.libraryAddButton}><NeonWidgetOutline radius={11} /><Text style={styles.libraryAddText}>+ Memory</Text></Pressable></View>)}</View>
      {!journeys.data.length && journeys.status !== 'loading' && <EmptyCard title="No journeys yet" body="Finish a recording and it will appear here, ready to organize." />}
      </>}
      {(catalog.status === 'loading' || journeys.status === 'loading') && !catalog.data.memories.length && !journeys.data.length
        ? <JourneyListSkeleton compact label="Refreshing memories…" />
        : (catalog.status === 'loading' || journeys.status === 'loading') && <LoadingLine label="Refreshing memories…" />}
    </ScrollView>}

    {detailId && !memoryOverview && <View onLayout={detailReady}><InlineNotice message={catalog.status === 'loading' ? 'Loading Memory…' : 'This Memory is no longer available.'} onRetry={onRefresh} /></View>}
    <MemoryDetailScreen
      visible={Boolean(memoryOverview)}
      memory={memoryOverview}
      cover={memoryCover}
      journeys={overviewJourneys}
      onClose={() => router.back()}
      onOpenJourney={onJourney}
      onShare={() => memoryOverview && openMemoryShare(memoryOverview)}
      onEdit={() => memoryOverview && editMemory(memoryOverview)}
      onReady={detailReady}
    />

    <NativeSheet dirty={memoryDraftDirty} busy={saving || photoBusy} onDismiss={() => { const next = afterEditorDismiss.current; afterEditorDismiss.current = null; next?.(); }} visible={Boolean(memoryDraft)} kicker={memoryDraft?.id ? 'EDIT MEMORY' : 'NEW MEMORY'} title={memoryDraft?.id ? 'Edit Memory' : 'Create a Memory'} onClose={() => setMemoryDraft(null)} footer={memoryDraft ? <View style={styles.editorActions}>
      <Pressable onPress={() => requestSheetClose(memoryDraftDirty, saving || photoBusy, () => setMemoryDraft(null))} disabled={saving || photoBusy} style={styles.editorCancel}><Text style={styles.editorCancelText}>Cancel</Text></Pressable>
      <TouchPressable onPress={() => void saveMemory()} disabled={saving || photoBusy || !memoryDraftDirty} style={[styles.editorSave, !memoryDraftDirty && styles.editorSaveSaved, saving && styles.pressed]}><MemorySaveLabel saving={saving} dirty={memoryDraftDirty} successVersion={memorySaveVersion} style={styles.editorSaveText} /></TouchPressable>
    </View> : undefined}>
      {memoryDraft && <View style={styles.modalEditorBody}>
        <Text style={styles.editorInstruction}>MEMORY NAME</Text>
        <TextInput editable={!saving} value={memoryDraft.name} onChangeText={name => setMemoryDraft(current => current ? { ...current, name } : current)} placeholder="Memory name" placeholderTextColor={theme.color("#716879", 'text')} maxLength={80} style={styles.editorInput} />
        <Text style={styles.editorInstruction}>STORY</Text>
        <TextInput editable={!saving} value={memoryDraft.notes} onChangeText={notes => setMemoryDraft(current => current ? { ...current, notes } : current)} placeholder="What makes this chapter special?" placeholderTextColor={theme.color("#716879", 'text')} maxLength={1200} multiline style={[styles.editorInput, styles.editorNotes]} />
        {memoryDraft.id ? <>
          <View style={styles.photoEditorHeader}><View style={styles.flex}><Text style={styles.editorInstruction}>MEMORY PHOTOS</Text><Text style={styles.photoEditorHelp}>Choose one photo as this Memory’s cover.</Text></View><Pressable onPress={() => void uploadMemoryPhoto()} disabled={photoBusy} style={[styles.photoAddButton, photoBusy && styles.photoAddDisabled]}><Text style={styles.photoAddText}>{photoBusy ? 'Working…' : '+ Add photo'}</Text></Pressable></View>
          {availableMemoryPhotos.length ? <View style={styles.photoGrid}>{availableMemoryPhotos.map(photo => <PhotoTile key={photo.id} photo={photo} selected={memoryDraft.coverPhotoId === photo.id} label="MEMORY" onPress={() => setMemoryDraft(current => current ? { ...current, coverPhotoId: photo.id } : current)} onRemove={() => removePhoto(photo)} />)}</View> : <View style={styles.photoEmpty}><Text style={styles.photoEmptyTitle}>No photos yet</Text><Text style={styles.photoEmptyBody}>Add a photo to give this Memory a cover.</Text></View>}
        </> : <Text style={styles.photoSaveFirst}>You can add a cover and more photos after creating the Memory.</Text>}
        <MemoryJourneyEditor journeys={journeys.data.map(journey => ({ id: journey.id, title: locationPair(journey), detail: `${formatCompactDate(journey.startedAt)}  •  ${formatMiles(journey.miles)}` }))} selectedIds={memoryDraft.journeyIds} disabled={saving || photoBusy} onToggle={id => { toggleMemoryJourney(id); void haptics.selection(); }} />
        {memoryDraft.id && <Pressable onPress={deleteMemory} disabled={saving} style={styles.editorDelete}><Text style={styles.editorDeleteText}>Delete Memory</Text></Pressable>}
      </View>}
    </NativeSheet>

    <NativeSheet busy={saving} onDismiss={() => { const next = afterAssignDismiss.current; afterAssignDismiss.current = null; next?.(); }} visible={Boolean(assignJourneyId)} kicker="QUICK ORGANIZE" title="Add to a Memory" onClose={() => setAssignJourneyId(null)}>
      <Text style={styles.overviewBodyMuted}>Choose a Memory for this journey. A journey can appear in more than one Memory.</Text>
      {catalog.data.memories.map(memory => <MembershipRow key={memory.id} title={memory.name} detail={`${memory.journeyIds.length} ${memory.journeyIds.length === 1 ? 'journey' : 'journeys'}`} selected={Boolean(assignJourneyId && memory.journeyIds.includes(assignJourneyId))} onPress={() => void toggleJourneyInMemory(memory)} />)}
      {!catalog.data.memories.length && <Pressable onPress={() => { const journeyId = assignJourneyId; afterAssignDismiss.current = () => editMemory(null, journeyId); setAssignJourneyId(null); }} style={styles.overviewPrimary}><Text style={styles.overviewPrimaryText}>Create your first Memory</Text></Pressable>}
    </NativeSheet>
    <ShareCardModal payload={shareCard} onClose={() => setShareCard(null)} />
  </View>;
}

function MemoryDetailScreen({
  visible, memory, cover, journeys, onClose, onOpenJourney, onShare, onEdit, onReady,
}: {
  visible: boolean;
  memory: JourneyMemory | null;
  cover: JourneyPhoto | null;
  journeys: JourneySummary[];
  onClose: () => void;
  onOpenJourney: (journeyId: string) => void;
  onShare: () => void;
  onEdit: () => void;
  onReady?: () => void;
}) {
  const theme = useAppTheme();
  const styles = useThemedStyles(darkStyles);
  const { reduceMotion } = useMotionPreferences();
  const adaptiveLayout = useAdaptiveLayout();
  const foldColumns = verticalFoldContentColumns(adaptiveLayout.fold, 20);
  const detailScrollY = useRef(new Animated.Value(0)).current;
  const photographicDepth = reduceMotion ? undefined : {
    transform: [
      { translateY: detailScrollY.interpolate({ inputRange: [0, 180], outputRange: [0, 18], extrapolate: 'clamp' }) },
      { scale: detailScrollY.interpolate({ inputRange: [0, 180], outputRange: [1.04, 1], extrapolate: 'clamp' }) },
    ],
  };

  const insets = useDetailViewportInsets();
  if (!visible || !memory) return null;

  return <DetailScreenFrame title="Memory" onBack={onClose} actions={<NativeActionMenu compact label="Memory actions" actions={[
    { id: 'edit', title: 'Edit Memory', image: 'pencil', onSelect: onEdit },
    { id: 'match', title: 'Find matching photos', image: 'photo.badge.magnifyingglass', onSelect: () => router.push({ pathname: '/memory-photos/[id]', params: { id: memory.id } }) },
    { id: 'share', title: 'Create share card', image: 'square.and.arrow.up', onSelect: onShare },
  ]} />}><View style={styles.safe}>
    <LinearGradient colors={theme.gradient(['#2b172b', '#120d1a', '#08070c'] as const)} locations={[0, 0.36, 1]} style={StyleSheet.absoluteFill} />
        <Animated.ScrollView
          contentContainerStyle={[styles.memoryDetailContent, { paddingTop: 16 + adaptiveLayout.occlusionInsets.top, paddingBottom: insets.bottom + adaptiveLayout.occlusionInsets.bottom + 38 }]}
          showsVerticalScrollIndicator={false}
          contentInsetAdjustmentBehavior="never"
          automaticallyAdjustContentInsets={false}
          automaticallyAdjustsScrollIndicatorInsets={false}
          onScroll={reduceMotion ? undefined : Animated.event([{ nativeEvent: { contentOffset: { y: detailScrollY } } }], { useNativeDriver: true })}
          scrollEventThrottle={16}
        >
          <View testID="memory-detail-duo-layout" style={foldColumns ? { flexDirection: 'row', gap: foldColumns.gap, alignItems: 'flex-start' } : undefined}>
            <View testID="memory-detail-story-pane" style={[styles.memoryDetailStoryPane, foldColumns ? { width: foldColumns.beforeWidth, flexGrow: 0, flexShrink: 0 } : undefined]}>
              <Animated.View style={[styles.memoryDetailHero, photographicDepth]}>
                <View style={StyleSheet.absoluteFill}>{cover ? <JourneyPhotoImage photo={cover} style={styles.memoryDetailHeroImage} onReady={onReady} /> : <MemoryArtwork artworkKey={memory.artworkKey} onReady={onReady} />}</View>
                <LinearGradient colors={theme.gradient(['rgba(5,3,9,0.04)', 'rgba(8,5,13,0.33)', '#09060de8'] as const)} locations={[0, 0.42, 1]} style={StyleSheet.absoluteFill} />
                <View style={styles.memoryDetailHeroGlowOne} /><View style={styles.memoryDetailHeroGlowTwo} />
                <View style={styles.memoryDetailHeroContent}><Text style={styles.memoryDetailKicker}>MEMORY</Text><Text style={styles.memoryDetailTitle}>{memory.name}</Text><Text style={styles.memoryDetailMeta}>{journeys.length} {journeys.length === 1 ? 'journey' : 'journeys'}  ·  {memory.photos.length} photos</Text></View>
              </Animated.View>
              {memory.notes ? <View style={styles.memoryStory}><Text style={styles.memoryDetailSection}>STORY</Text><Reanimated.Text style={styles.memoryDetailNotes}>{memory.notes}</Reanimated.Text></View> : null}
              <View style={styles.memoryPhotoHeader}><Text style={styles.memoryDetailSection}>PHOTOS · {memory.photos.length}</Text><Pressable accessibilityRole="button" onPress={onEdit} style={styles.memoryPhotoHeaderAction}><Text style={styles.memoryPhotoHeaderActionText}>{memory.photos.length ? 'Manage' : 'Add photos'}</Text></Pressable></View>
              {memory.photos.length > 1 ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.memoryPhotoStrip}>{memory.photos.map(photo => <Pressable key={photo.id} accessibilityRole="button" accessibilityLabel={photo.id === memory.coverPhotoId ? 'Cover photo' : 'Set as cover in Edit Memory'} onPress={onEdit} style={[styles.memoryPhotoThumb, photo.id === memory.coverPhotoId && styles.memoryPhotoThumbCover]}><JourneyPhotoImage photo={photo} style={styles.memoryPhotoThumbImage} /></Pressable>)}</ScrollView> : null}
              <Pressable accessibilityRole="button" accessibilityLabel="Find photos matching this Memory" onPress={() => router.push({ pathname: '/memory-photos/[id]', params: { id: memory.id } })} style={styles.memoryPhotoMatchRow}>
                <SymbolView name="photo.badge.magnifyingglass" tintColor={theme.palette.accent} style={styles.memoryPhotoMatchIcon} />
                <View style={styles.flex}><Text style={styles.memoryPhotoMatchTitle}>Find matching photos</Text><Text style={styles.memoryPhotoMatchBody}>Suggestions from journey dates and locations</Text></View>
                <Text style={styles.memoryPhotoMatchChevron}>›</Text>
              </Pressable>
            </View>
            <View testID="memory-detail-journeys-pane" style={[styles.memoryDetailJourneysPane, foldColumns ? { width: foldColumns.afterWidth, flexGrow: 0, flexShrink: 0 } : undefined]}>
              <Reanimated.Text style={styles.memoryDetailSection}>JOURNEYS IN THIS MEMORY</Reanimated.Text>
              <View style={[styles.memoryJourneyList, styles.memoryDetailJourneyList]}>{journeys.map((journey) => <Reanimated.View key={journey.id} ><JourneyCard journey={journey} compact onPress={() => onOpenJourney(journey.id)} /></Reanimated.View>)}</View>
              {!journeys.length && <EmptyCard title="This Memory is waiting for a journey" body="Edit it and choose one or more journeys to keep together." />}
            </View>
          </View>
        </Animated.ScrollView>
  </View></DetailScreenFrame>;
}


function OverviewMetrics({ items }: { items: { label: string; value: string }[] }) {
  const styles = useThemedStyles(darkStyles);

  return <View style={[styles.overviewMetrics, styles.staticWidgetGlow]}>{items.map(item => <View key={item.label} style={styles.overviewMetric}><Text style={styles.overviewMetricValue}>{item.value}</Text><Text style={styles.overviewMetricLabel}>{item.label}</Text></View>)}</View>;
}

function MemoryArtwork({ photo, onReady }: { artworkKey: string; photo?: JourneyPhoto | null; onReady?: () => void }) {
  const theme = useAppTheme();
  const styles = useThemedStyles(darkStyles);
  const flipImage = useContext(MemoryFlipImageContext);

  if (photo) return <JourneyPhotoImage photo={photo} style={styles.memoryArtwork} onReady={onReady} />;
  return <View style={styles.memoryArtwork}>
    <JourneyImage
      key={`default-memory-${theme.id}`}
      imageIdentity={`default-memory-${theme.id}`}
      accessibilityLabel="Cinematic memory timeline artwork"
      source={headerImageSource(require('../assets/cinematic-memory-polaroids-photo-v1.jpg'), theme.id)}
      contentFit="cover"
      onDisplay={onReady}
      onError={onReady}
      style={StyleSheet.absoluteFill}
    />
    <CinematicPhotoGrade />
  </View>;
}

function JourneyPhotoImage({ photo, style, onReady }: { photo: JourneyPhoto; style?: any; onReady?: () => void }) {
  const theme = useAppTheme();
  const styles = useThemedStyles(darkStyles);

  const [uri, setUri] = useState<string | null>(null);
  const ready = useRef(onReady);
  ready.current = onReady;
  useEffect(() => { let active = true; void appDataClient.photoDataUrl(photo).then(value => { if (active) { setUri(value); if (!value) ready.current?.(); } }).catch(() => { if (active) ready.current?.(); }); return () => { active = false; }; }, [photo.id]);
  return uri ? <Image source={{ uri }} resizeMode="cover" onLoadEnd={onReady} style={style} /> : <View style={[style, styles.photoLoading]}><ActivityIndicator color={theme.color("#b693ff", 'text')} /></View>;
}

function PhotoTile({ photo, selected = false, label, onPress, onRemove }: { photo: JourneyPhoto; selected?: boolean; label: string; onPress: () => void; onRemove?: () => void }) {
  const styles = useThemedStyles(darkStyles);

  return <View style={[styles.photoTile, selected && styles.photoTileSelected]}><Pressable onPress={onPress} style={styles.photoTileImage}><JourneyPhotoImage photo={photo} style={styles.photoTileImage} /><View style={styles.photoTileShade} /><Text style={styles.photoTileLabel}>{selected ? '✓ COVER' : label}</Text></Pressable>{onRemove && <Pressable onPress={onRemove} style={styles.photoRemove}><Text style={styles.photoRemoveText}>×</Text></Pressable>}</View>;
}

function MembershipRow({ title, detail, selected, onPress }: { title: string; detail: string; selected: boolean; onPress: () => void }) {
  const styles = useThemedStyles(darkStyles);

  return <Pressable onPress={onPress} style={[styles.membershipRow, selected && styles.membershipRowSelected]}><View style={[styles.membershipCheck, selected && styles.membershipCheckSelected]}><Text style={styles.membershipCheckText}>{selected ? '✓' : '+'}</Text></View><View style={styles.flex}><Text style={styles.membershipTitle}>{title}</Text><Text style={styles.membershipDetail}>{detail}</Text></View><Text style={[styles.membershipAction, selected && styles.membershipActionRemove]}>{selected ? 'Remove' : 'Add'}</Text></Pressable>;
}

function JourneysScreen({ state, hasMore, loadingMore, onJourney, onRefresh, onLoadMore }: { state: LoadState<JourneySummary[]>; hasMore: boolean; loadingMore: boolean; onJourney: (id: string) => void; onRefresh: () => void; onLoadMore: () => void }) {
  const theme = useAppTheme();
  const styles = useThemedStyles(darkStyles);

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
        {state.status === 'loading' && state.data.length === 0 ? <JourneyListSkeleton /> : state.data.length
          ? state.data.map(journey => <JourneyCard key={journey.id} journey={journey} onPress={() => onJourney(journey.id)} />)
          : <EmptyCard title="Your timeline starts here" body="Finish your first recording and it will appear here automatically. Recording still works offline." />}
        {hasMore && <Pressable onPress={onLoadMore} disabled={loadingMore} style={[styles.loadMoreButton, loadingMore && styles.pressed]}>{loadingMore ? <ActivityIndicator color={theme.color("#b59cff", 'text')} /> : <Text style={styles.loadMoreText}>Load more journeys</Text>}</Pressable>}
      </ScrollView>
    </View>
  );
}

function privacySafeRealShareRoute(journey: JourneyDetail) {
  const routeCoordinates = journey.route?.coordinates ?? [];
  const start = routeCoordinates[0], end = routeCoordinates.at(-1);
  const userId = getCurrentUser().id;
  const timestamp = new Date().toISOString();
  const inferredPrivatePlaces: LocalPlace[] = [];
  const inferEndpoint = (label: string | null, coordinate: [number, number] | undefined, suffix: string) => {
    const kind = label?.trim().toLocaleLowerCase();
    if ((kind !== 'home' && kind !== 'work' && kind !== 'school') || !coordinate) return;
    inferredPrivatePlaces.push({
      id: `share-card-${kind}-${suffix}`,
      userId,
      kind: kind === 'school' ? 'custom' : kind,
      label: kind === 'home' ? 'Home' : kind === 'work' ? 'Work' : 'School',
      lat: coordinate[1],
      lng: coordinate[0],
      radiusMeters: 300,
      foursquareId: null,
      osmId: null,
      cachedUntil: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  };
  inferEndpoint(journey.startingLocation, start, 'start');
  inferEndpoint(journey.endingLocation, end, 'end');
  const sensitivePlaces = [...getSensitivePlaces(userId), ...inferredPrivatePlaces];
  const rawSongPoints = buildSongRouteMoments(journey.soundtrack, routeCoordinates, journey.startedAt, journey.endedAt)
    .map(moment => ({ index: moment.index, coordinate: moment.coordinate }));
  const trimmed = trimPrivateShareRoute({
    route: routeCoordinates,
    songPoints: rawSongPoints,
    startLabel: journey.startingLocation,
    endLabel: journey.endingLocation,
  });
  const prepared = prepareShareCardCoords({
    startLabel: journey.startingLocation,
    endLabel: journey.endingLocation,
    startCoord: start ? { lng: start[0], lat: start[1] } : null,
    endCoord: end ? { lng: end[0], lat: end[1] } : null,
    route: trimmed.route,
    sensitivePlaces,
  });
  const songPoints = trimmed.songPoints
    .map(point => {
      const masked = maskCoordinate({ lng: point.coordinate[0], lat: point.coordinate[1] }, sensitivePlaces);
      return { index: point.index, coordinate: [masked.lng, masked.lat] as [number, number] };
    });
  return {
    startLocation: trimmed.trimmedStart ? null : prepared.startLabel,
    endLocation: trimmed.trimmedEnd ? null : prepared.endLabel,
    routeCoordinates: prepared.route?.coordinates ?? [],
    routeProtected: trimmed.trimmedStart || trimmed.trimmedEnd || prepared.privacySummary !== 'Full route shown',
    routePrivacySummary: trimmed.trimmedStart || trimmed.trimmedEnd ? 'Private saved-place route trimmed' : prepared.privacySummary,
    routeTrimmedStart: trimmed.trimmedStart,
    routeTrimmedEnd: trimmed.trimmedEnd,
    songPoints,
  };
}

export function NativeJourneyScreen() {
  useCardDetailDismissal();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { membership, refreshArchive, showUpgrade } = useJourneyDeckNavigation();
  const { state, refresh } = useJourneyDetail(id);
  if (state.data && !membershipCanAccessDate(membership, state.data.startedAt)) {
    return <DetailScreenFrame title="Journey" onBack={() => router.back()}><InlineNotice message="Unlock complete history to open this Journey." onRetry={showUpgrade} /></DetailScreenFrame>;
  }
  return <JourneyDetailScreen visible state={state} onClose={() => router.back()} onRetry={refresh} onLocationsSaved={async () => {
    await refreshArchive();
    refresh();
  }} />;
}

function JourneyDetailScreen({ visible, state, onClose, onRetry, onLocationsSaved }: { visible: boolean; state: LoadState<JourneyDetail | null>; onClose: () => void; onRetry: () => void; onLocationsSaved: () => Promise<void> }) {
  const theme = useAppTheme();
  const styles = useThemedStyles(darkStyles);
  const adaptiveLayout = useAdaptiveLayout();
  const foldColumns = verticalFoldContentColumns(adaptiveLayout.fold, 16);
  const journeyScrollRef = useRef<ScrollView>(null);

  const journey = state.data;
  const replayPhotos = useMemo(() => journey && visible ? loadReplayPhotos(getCurrentUser().id, journey.id) : [], [journey, visible]);
  const rawStartingLocation = journey?.rawStartingLocation || journey?.startingLocation || 'Recorded start';
  const rawEndingLocation = journey?.rawEndingLocation || journey?.endingLocation || 'Recorded destination';
  const startingLocationKey = journey?.startingLocationKey || journey?.rawStartingLocation || journey?.startingLocation || `journey:${journey?.id ?? 'unavailable'}:start`;
  const endingLocationKey = journey?.endingLocationKey || journey?.rawEndingLocation || journey?.endingLocation || `journey:${journey?.id ?? 'unavailable'}:end`;
  const [shareCard, setShareCard] = useState<ShareCardPayload | null>(null);
  const [editingLocations, setEditingLocations] = useState(false);
  const [startingName, setStartingName] = useState('');
  const [endingName, setEndingName] = useState('');
  const [savingLocations, setSavingLocations] = useState(false);
  const [locationsSignature, setLocationsSignature] = useState('');
  const locationsDirty = JSON.stringify([startingName.trim(), endingName.trim()]) !== locationsSignature;
  const [selectedSongIndex, setSelectedSongIndex] = useState<number | null>(null);
  const [showAllTracks, setShowAllTracks] = useState(false);
  const [journeyCityLabel, setJourneyCityLabel] = useState<string | null>(null);
  const songMoments = useMemo(() => journey ? buildSongRouteMoments(
    journey.soundtrack,
    journey.route?.coordinates ?? [],
    journey.startedAt,
    journey.endedAt,
  ) : [], [journey]);

  useEffect(() => {
    if (!visible) { setEditingLocations(false); setSelectedSongIndex(null); setShowAllTracks(false); return; }
    if (!journey || editingLocations) return;
    setSelectedSongIndex(null);
    setStartingName(journey.startingLocation && journey.startingLocation !== rawStartingLocation ? journey.startingLocation : '');
    setEndingName(journey.endingLocation && journey.endingLocation !== rawEndingLocation ? journey.endingLocation : '');
  }, [journey, visible]);

  useEffect(() => {
    let active = true;
    setJourneyCityLabel(null);
    if (!visible || !journey || journey.startingLocation || journey.endingLocation) return () => { active = false; };
    const coordinates = journey.route?.coordinates ?? [];
    const midpoint = coordinates[Math.floor(coordinates.length / 2)] ?? null;
    if (!midpoint) return () => { active = false; };
    void loadCityLabelForCoordinate(getCurrentUser().id, midpoint).then(label => {
      if (active) setJourneyCityLabel(label);
    });
    return () => { active = false; };
  }, [journey, visible]);

  const displayTitle = journey ? journeyDisplayTitle(journey, journeyCityLabel) : 'Drive details';
  const visibleSoundtrack = journey ? (showAllTracks ? journey.soundtrack : journey.soundtrack.slice(0, 5)) : [];
  const revealSongOnMap = (index: number) => {
    setSelectedSongIndex(index);
    if (!foldColumns) journeyScrollRef.current?.scrollTo({ y: 300, animated: true });
  };

  const openJourneyShare = () => {
    if (!journey) return;
    const featured = journey.soundtrack[0] ?? journey.soundtrackPreview[0] ?? null;
    const artistCounts = new Map<string, number>();
    journey.soundtrack.forEach(track => artistCounts.set(track.artist, (artistCounts.get(track.artist) ?? 0) + 1));
    const topArtist = [...artistCounts.entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))[0]?.[0] ?? featured?.artist ?? null;
    const shareRoute = privacySafeRealShareRoute(journey);
    setShareCard({
      kind: 'journey',
      eyebrow: 'A JOURNEY REMEMBERED',
      title: formatFullDate(journey.startedAt),
      subtitle: 'A privacy-safe recap of time on the road—without precise locations.',
      metrics: [{ label: 'DISTANCE', value: formatMiles(journey.miles) }, { label: 'DRIVE TIME', value: formatDuration(journey.durationMinutes) }, { label: 'SONGS', value: String(journey.songCount) }],
      accent: '#43e6ae',
      journey: {
        startedAt: journey.startedAt,
        miles: journey.miles,
        durationMinutes: journey.durationMinutes,
        energyUsedKwh: journey.energyUsedKwh,
        songCount: journey.songCount,
        ...shareRoute,
        featured: featured ? { track: featured.track, artist: featured.artist, artworkUrl: featured.artworkUrl } : null,
        topArtist,
      },
    });
  };

  const openLocationEditor = () => {
    if (!journey) return;
    const start = journey.startingLocation && journey.startingLocation !== rawStartingLocation ? journey.startingLocation : '';
    const end = journey.endingLocation && journey.endingLocation !== rawEndingLocation ? journey.endingLocation : '';
    setStartingName(start); setEndingName(end); setLocationsSignature(JSON.stringify([start.trim(), end.trim()])); setEditingLocations(true);
  };

  useJourneyCardAction(visible && state.status === 'ready' && Boolean(journey), openLocationEditor, openJourneyShare);

  const saveLocations = async () => {
    if (!journey) return;
    const start = startingName.trim(), end = endingName.trim();
    const routeCoordinates = journey.route?.coordinates ?? [];
    const routeStart = routeCoordinates[0], routeEnd = routeCoordinates.at(-1);
    if (startingLocationKey === endingLocationKey && start !== end) {
      Alert.alert('Use one name for this place', 'This journey starts and ends at the same saved place. Give both endpoints the same name.');
      return;
    }
    setSavingLocations(true);
    try {
      await appDataClient.savePlaceAlias(startingLocationKey, start, routeStart ? { latitude: routeStart[1], longitude: routeStart[0] } : null);
      if (endingLocationKey !== startingLocationKey) await appDataClient.savePlaceAlias(endingLocationKey, end, routeEnd ? { latitude: routeEnd[1], longitude: routeEnd[0] } : null);
      await onLocationsSaved();
      setEditingLocations(false);
    } catch (error) {
      Alert.alert('Location names were not saved', error instanceof Error ? error.message : 'JourneyDeck could not save these location names.');
    } finally {
      setSavingLocations(false);
    }
  };

  return <>
    <DetailScreenFrame title="Journey" onBack={onClose} actions={journey ? <NativeActionMenu compact label="Journey actions" actions={[
      { id: 'share', title: 'Create share card', image: 'square.and.arrow.up', onSelect: openJourneyShare },
      { id: 'locations', title: 'Edit locations', image: 'mappin.and.ellipse', onSelect: openLocationEditor },
      { id: 'trim', title: 'Trim & split', image: 'scissors', onSelect: () => router.push({ pathname: '/journey-editor/[id]', params: { id: journey.id } }) },
    ]} /> : undefined}>
    <ScrollView ref={journeyScrollRef} style={styles.safe} contentInsetAdjustmentBehavior="never" automaticallyAdjustContentInsets={false} automaticallyAdjustsScrollIndicatorInsets={false} contentContainerStyle={[styles.overlayContent, { paddingTop: 16 + adaptiveLayout.occlusionInsets.top, paddingBottom: 40 + adaptiveLayout.occlusionInsets.bottom }]} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" automaticallyAdjustKeyboardInsets>
      {state.status === 'loading' ? <LoadingCard /> : state.status === 'error' || !journey ? <InlineNotice message={state.message ?? 'Journey unavailable.'} onRetry={onRetry} /> : <>
          <View testID="journey-detail-duo-layout" style={foldColumns ? { flexDirection: 'row', gap: foldColumns.gap, alignItems: 'flex-start' } : undefined}>
            <View testID="journey-detail-map-pane" style={foldColumns ? { width: foldColumns.beforeWidth, flexGrow: 0, flexShrink: 0 } : undefined}>
            <JourneyCinematicHero journey={journey} title={displayTitle} />
            <SectionHeading title="Route" />
            <JourneyMarkerRoute key={journey.id} journeyId={journey.id}
              coordinates={journey.route?.coordinates ?? []}
              routeSamples={journey.route?.points}
              photos={replayPhotos}
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
            </View>
            <View testID="journey-detail-story-pane" style={foldColumns ? { width: foldColumns.afterWidth, flexGrow: 0, flexShrink: 0 } : undefined}>
            <SectionHeading title="Soundtrack" action={journey.soundtrack.length > 5 ? (showAllTracks ? 'Show less' : `View all ${journey.soundtrack.length}`) : `${journey.songCount} songs`} onAction={journey.soundtrack.length > 5 ? () => setShowAllTracks(value => !value) : undefined} />
            {visibleSoundtrack.length ? visibleSoundtrack.map((track, index) => <TrackRow key={`${track.source}-${track.playedAt ?? track.track}-${index}`} track={track} index={index + 1} selected={selectedSongIndex === index + 1} onPress={() => revealSongOnMap(index + 1)} />) : <EmptyCard title="No songs yet" body="Identify songs while recording." />}
            {(journey.vehicleName || journey.startingBatteryPercent != null || journey.energyUsedKwh != null) && <>
              <SectionHeading title="Vehicle" />
              <View style={styles.infoCard}>
                <InfoRow label="VEHICLE" value={journey.vehicleName ?? 'Connected vehicle'} />
                {journey.startingBatteryPercent != null && <InfoRow label="BATTERY" value={`${journey.startingBatteryPercent}% → ${journey.endingBatteryPercent ?? '—'}%`} />}
                {journey.energyUsedKwh != null && <InfoRow label="ENERGY USED" value={`${journey.energyUsedKwh.toFixed(1)} kWh`} />}
              </View>
            </>}
            </View>
          </View>
          </>}
    </ScrollView>
    </DetailScreenFrame>
    <NativeSheet visible={editingLocations} kicker="JOURNEY PLACES" title="Edit locations" dirty={locationsDirty} busy={savingLocations} onClose={() => setEditingLocations(false)}>
            <View style={styles.locationEditor}>
              <Text style={styles.locationEditorKicker}>NAME THE PLACES IN THIS JOURNEY</Text>
              <Text style={styles.locationEditorHelp}>Names apply everywhere. Leave blank to reset.</Text>
              <View style={styles.locationField}><Text style={styles.locationFieldLabel}>START</Text><TextInput value={startingName} onChangeText={setStartingName} placeholder="Home, Work, School…" placeholderTextColor={theme.color("#716879", 'text')} maxLength={64} returnKeyType="next" style={styles.editorInput} /><Text style={styles.locationRaw} numberOfLines={2}>{rawStartingLocation}</Text></View>
              <View style={styles.locationField}><Text style={styles.locationFieldLabel}>DESTINATION</Text><TextInput value={endingName} onChangeText={setEndingName} placeholder="Home, Work, School…" placeholderTextColor={theme.color("#716879", 'text')} maxLength={64} returnKeyType="done" style={styles.editorInput} /><Text style={styles.locationRaw} numberOfLines={2}>{rawEndingLocation}</Text></View>
              <View style={styles.editorActions}><Pressable onPress={() => requestSheetClose(locationsDirty, savingLocations, () => setEditingLocations(false))} disabled={savingLocations} style={styles.editorCancel}><Text style={styles.editorCancelText}>Cancel</Text></Pressable><Pressable onPress={() => void saveLocations()} disabled={savingLocations} style={[styles.editorSave, savingLocations && styles.pressed]}><Text style={styles.editorSaveText}>{savingLocations ? 'Saving…' : 'Save names'}</Text></Pressable></View>
            </View>
    </NativeSheet>
    <ShareCardModal payload={shareCard} onClose={() => setShareCard(null)} />
  </>;
}

type SettingsDestination =
  | { kind: 'overview' }
  | { kind: 'category'; category: SettingsCategoryId }
  | { kind: 'appearance-picker'; picker: 'theme' | 'icon' }
  | { kind: 'profile' }
  | { kind: 'saved-place'; slot: SavedPlaceSlot }
  | { kind: 'custom-place'; placeId?: string };

function SettingsEditorScaffold({ eyebrow, title, onBack, backDisabled = false, primaryAction, children }: {
  eyebrow: string;
  title: string;
  onBack: () => void;
  backDisabled?: boolean;
  primaryAction?: { label: string; onPress: () => void; disabled?: boolean };
  children: ReactNode;
}) {
  const theme = useAppTheme();
  const styles = useThemedStyles(darkStyles);

  const insets = useSafeAreaInsets();
  const close = () => {
    if (backDisabled) return;
    Keyboard.dismiss();
    onBack();
  };
  return (
    <View style={styles.settingsEditorScreen}>
      <SettingsScrollView
        contentContainerStyle={[styles.settingsEditorContent, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 28 }]}
        contentInsetAdjustmentBehavior="never"
        automaticallyAdjustContentInsets={false}
        automaticallyAdjustKeyboardInsets={false}
        automaticallyAdjustsScrollIndicatorInsets={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
      >
        <AtmosphericBackdrop variant="settings" />
        <View style={styles.settingsEditorNavigation}>
          <Pressable accessibilityRole="button" accessibilityLabel="Back" accessibilityState={{ disabled: backDisabled }} disabled={backDisabled} onPress={close} style={({ pressed }) => [styles.settingsEditorBack, { backgroundColor: theme.palette.card, borderColor: theme.palette.line }, (pressed || backDisabled) && styles.pressed]}>
            <SymbolView name="chevron.left" tintColor={theme.palette.text} size={20} />
          </Pressable>
          {primaryAction && <Pressable accessibilityRole="button" accessibilityState={{ disabled: primaryAction.disabled }} disabled={primaryAction.disabled} onPress={primaryAction.onPress} style={[styles.settingsEditorHeaderAction, primaryAction.disabled && styles.pressed]}><Text style={styles.settingsEditorHeaderActionText}>{primaryAction.label}</Text></Pressable>}
        </View>
        <Text style={styles.settingsEditorEyebrow}>{eyebrow}</Text>
        <Text accessibilityRole="header" style={styles.settingsEditorTitle}>{title}</Text>
        {children}
      </SettingsScrollView>
    </View>
  );
}

function SettingsProfileEditor({ currentUser, appearance, onSaved, onBack }: { currentUser: LocalUser; appearance: ProfileAppearance; onSaved: (appearance: ProfileAppearance) => void; onBack: () => void }) {
  const theme = useAppTheme();
  const styles = useThemedStyles(darkStyles);

  const [draft, setDraft] = useState(appearance);
  const [avatarBusy, setAvatarBusy] = useState(false);

  const pickAvatar = async () => {
    setAvatarBusy(true);
    try {
      const avatarDataUri = await chooseProfileAvatar();
      if (avatarDataUri) setDraft(current => ({ ...current, avatarDataUri }));
    } catch (error) {
      Alert.alert('Profile image was not changed', error instanceof Error ? error.message : 'Try another image.');
    } finally {
      setAvatarBusy(false);
    }
  };
  const save = () => {
    Keyboard.dismiss();
    const saved = saveProfileAppearance(currentUser, draft);
    onSaved(saved);
    void haptics.success();
  };

  return (
    <SettingsEditorScaffold eyebrow="PRIMARY DRIVER" title="Edit your profile" onBack={onBack} backDisabled={avatarBusy} primaryAction={{ label: 'Save', onPress: save, disabled: avatarBusy }}>
      <View style={[styles.profileEditorCard, styles.settingsEditorPanel]}>
        <Text style={styles.profileEditorBody}>Your name and photo stay in your private JourneyDeck profile.</Text>
        <Pressable disabled={avatarBusy} onPress={() => void pickAvatar()} style={styles.profileEditorAvatarButton}>
          <LinearGradient colors={theme.gradient(['#ff795b', '#db55a6', '#8d61ff'])} style={styles.profileEditorAvatarRing}><View style={styles.profileEditorAvatarInner}>{draft.avatarDataUri ? <ExpoImage source={draft.avatarDataUri} contentFit="cover" transition={180} style={StyleSheet.absoluteFill} /> : <Text style={styles.profileEditorAvatarInitials}>{profileInitialsFor(draft.displayName)}</Text>}</View></LinearGradient>
          <View style={styles.profileEditorPhotoBadge}>{avatarBusy ? <ActivityIndicator color={theme.color("#fff", 'text')} size="small" /> : <SymbolView name="camera.fill" tintColor={theme.color("#fff", 'text')} type="hierarchical" style={styles.profileEditorCamera} />}</View>
        </Pressable>
        <Pressable disabled={avatarBusy} onPress={() => void pickAvatar()}><Text style={styles.profileEditorPhotoAction}>{draft.avatarDataUri ? 'Choose a different photo' : 'Choose profile photo'}</Text></Pressable>
        {draft.avatarDataUri && <Pressable onPress={() => setDraft(current => ({ ...current, avatarDataUri: null }))}><Text style={styles.profileEditorRemovePhoto}>Use initials instead</Text></Pressable>}
        <Text style={styles.profileEditorLabel}>NAME</Text>
        <TextInput
          value={draft.displayName}
          onChangeText={displayName => setDraft(current => ({ ...current, displayName }))}
          editable={!avatarBusy}
          maxLength={48}
          placeholder="Primary Driver"
          placeholderTextColor={theme.color("#71677a", 'text')}
          selectionColor="#ff795b"
          returnKeyType="done"
          onSubmitEditing={save}
          style={styles.profileEditorInput}
        />
      </View>
    </SettingsEditorScaffold>
  );
}

function SettingsSavedPlaceEditor({ currentUser, slot, hasSavedPlace, onChanged, onBack }: { currentUser: LocalUser; slot: SavedPlaceSlot; hasSavedPlace: boolean; onChanged: () => void; onBack: () => void }) {
  const theme = useAppTheme();
  const styles = useThemedStyles(darkStyles);

  const [address, setAddress] = useState('');
  const [busy, setBusy] = useState(false);
  const operationGeneration = useRef(0);
  const label = SAVED_PLACE_SLOTS.find(option => option.id === slot)?.label ?? 'place';
  useEffect(() => () => {
    operationGeneration.current += 1;
  }, []);
  const finish = (latitude: number, longitude: number) => {
    saveSavedPlace(currentUser.id, slot, latitude, longitude);
    Keyboard.dismiss();
    onChanged();
    onBack();
  };
  const saveAddress = async () => {
    if (!address.trim()) return;
    const operation = ++operationGeneration.current;
    setBusy(true);
    try {
      const matches = await Location.geocodeAsync(address.trim());
      if (operation !== operationGeneration.current) return;
      const match = matches[0];
      if (!match) {
        setBusy(false);
        Alert.alert('Location not found', 'Try a complete street address or use your current location.');
        return;
      }
      setBusy(false);
      finish(match.latitude, match.longitude);
    } catch (error) {
      if (operation !== operationGeneration.current) return;
      setBusy(false);
      Alert.alert('Location not saved', error instanceof Error ? error.message : 'JourneyDeck could not find that location.');
    }
  };
  const saveCurrent = async () => {
    Keyboard.dismiss();
    const operation = ++operationGeneration.current;
    setBusy(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (operation !== operationGeneration.current) return;
      if (permission.status !== 'granted') {
        setBusy(false);
        Alert.alert('Location permission needed', 'Allow location access, then try again.');
        return;
      }
      const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      if (operation !== operationGeneration.current) return;
      setBusy(false);
      finish(current.coords.latitude, current.coords.longitude);
    } catch (error) {
      if (operation !== operationGeneration.current) return;
      setBusy(false);
      Alert.alert('Location not saved', error instanceof Error ? error.message : 'JourneyDeck could not read your current location.');
    }
  };
  const remove = () => {
    removeSavedPlace(currentUser.id, slot);
    Keyboard.dismiss();
    onChanged();
    onBack();
  };

  return (
    <SettingsEditorScaffold eyebrow="SAVED PLACE" title={`Set ${label}`} onBack={onBack} backDisabled={busy}>
      <View style={styles.settingsEditorPanel}>
        <Text style={styles.settingsEditorBody}>Use an address or your current location. JourneyDeck uses this place to name journeys and protect it when you share.</Text>
        <Text style={styles.profileEditorLabel}>ADDRESS</Text>
        <TextInput
          value={address}
          onChangeText={setAddress}
          editable={!busy}
          autoCapitalize="words"
          autoCorrect={false}
          returnKeyType="search"
          onSubmitEditing={() => void saveAddress()}
          placeholder="Street address"
          placeholderTextColor={theme.color("#716879", 'text')}
          selectionColor="#ff795b"
          style={styles.editorInput}
        />
        <Pressable onPress={() => void saveAddress()} disabled={busy || !address.trim()} style={[styles.savedPlacePrimary, (busy || !address.trim()) && styles.pressed]}><Text style={styles.savedPlacePrimaryText}>{busy ? 'Saving…' : 'Use this address'}</Text></Pressable>
        <Pressable onPress={() => void saveCurrent()} disabled={busy} style={[styles.savedPlaceCurrent, busy && styles.pressed]}><SymbolView name="location.fill" tintColor={theme.color("#c7a9ff", 'text')} size={16} /><Text style={styles.savedPlaceCurrentText}>{busy ? 'Finding location…' : 'Use my current location'}</Text></Pressable>
        {hasSavedPlace && <Pressable onPress={remove} disabled={busy} style={styles.editorDelete}><Text style={styles.editorDeleteText}>Remove saved place</Text></Pressable>}
      </View>
    </SettingsEditorScaffold>
  );
}

function SettingsCustomPlaceEditor({ currentUser, place, onChanged, onBack }: { currentUser: LocalUser; place?: CustomSavedPlace; onChanged: () => void; onBack: () => void }) {
  const theme = useAppTheme();
  const styles = useThemedStyles(darkStyles);
  const [name, setName] = useState(place?.label ?? '');
  const [address, setAddress] = useState('');
  const [busy, setBusy] = useState(false);
  const operationGeneration = useRef(0);
  useEffect(() => () => { operationGeneration.current += 1; }, []);

  const save = async () => {
    const trimmedName = name.trim(), trimmedAddress = address.trim();
    if (!trimmedName || !trimmedAddress) return;
    const operation = ++operationGeneration.current;
    setBusy(true);
    try {
      const matches = await Location.geocodeAsync(trimmedAddress);
      if (operation !== operationGeneration.current) return;
      const match = matches[0];
      if (!match) {
        setBusy(false);
        Alert.alert('Location not found', 'Try a complete street address.');
        return;
      }
      saveCustomSavedPlace(currentUser.id, trimmedName, match.latitude, match.longitude, place?.id);
      setBusy(false);
      Keyboard.dismiss();
      onChanged();
      onBack();
    } catch (error) {
      if (operation !== operationGeneration.current) return;
      setBusy(false);
      Alert.alert('Location not saved', error instanceof Error ? error.message : 'JourneyDeck could not save that place.');
    }
  };

  const remove = () => {
    if (!place) return;
    removeCustomSavedPlace(currentUser.id, place.id);
    Keyboard.dismiss();
    onChanged();
    onBack();
  };
  const disabled = busy || !name.trim() || !address.trim();

  return <SettingsEditorScaffold eyebrow="CUSTOM SAFE PLACE" title={place ? `Edit ${place.label}` : 'Add a safe place'} onBack={onBack} backDisabled={busy}>
    <View style={styles.settingsEditorPanel}>
      <Text style={styles.settingsEditorBody}>Give this place a name and address. JourneyDeck will use the name for journeys and protect the location when you share.</Text>
      <Text style={styles.profileEditorLabel}>NAME</Text>
      <TextInput value={name} onChangeText={setName} editable={!busy} autoCapitalize="words" maxLength={64} returnKeyType="next" placeholder="Gym, family, cabin…" placeholderTextColor={theme.color('#716879', 'text')} selectionColor="#ff795b" style={styles.editorInput} />
      <Text style={styles.profileEditorLabel}>ADDRESS</Text>
      <TextInput value={address} onChangeText={setAddress} editable={!busy} autoCapitalize="words" autoCorrect={false} maxLength={240} returnKeyType="done" onSubmitEditing={() => void save()} placeholder="Street address" placeholderTextColor={theme.color('#716879', 'text')} selectionColor="#ff795b" style={styles.editorInput} />
      <Pressable accessibilityRole="button" accessibilityLabel={place ? 'Save custom place' : 'Add custom place'} onPress={() => void save()} disabled={disabled} style={[styles.savedPlacePrimary, disabled && styles.pressed]}><Text style={styles.savedPlacePrimaryText}>{busy ? 'Saving…' : 'Save place'}</Text></Pressable>
      {place && <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${place.label}`} onPress={remove} disabled={busy} style={styles.editorDelete}><Text style={styles.editorDeleteText}>Remove custom place</Text></Pressable>}
    </View>
  </SettingsEditorScaffold>;
}

function ConnectionsScreen({
  provider, connectionCapabilities, lastFmUsername, lastFmConnected, editingLastFm, lastFmDraft,
  savingLastFm, syncingLastFm, onLastFmDraft, onEditLastFm, onCancelLastFm, onSaveLastFm, onSyncLastFm, onChangeProvider,
  currentUser, appleIdentityStatus, signingInWithApple, privateCloud, membershipTier, membershipExpirationDate, journeys, memories, onMembership,
  onAppleSignIn, onPrivateCloudSync, accountActionPending, onSignOut, onDeleteAccount, ownerSpotifyEligible,
  spotifyOwnerState, onSpotifyOwnerConnect, onSpotifyOwnerSync, onDataHealth, onEditorActiveChange, onTessieChanged,
}: {
  provider: MusicProvider;
  connectionCapabilities: ConnectionCapabilities;
  currentUser: LocalUser;
  appleIdentityStatus: AppleIdentityStatus;
  signingInWithApple: boolean;
  accountActionPending: boolean;
  privateCloud: PrivateCloudUiState;
  membershipTier: 'free' | 'paid';
  membershipExpirationDate: string | null;
  journeys: JourneySummary[];
  memories: JourneyMemory[];
  lastFmUsername: string;
  lastFmConnected: boolean;
  editingLastFm: boolean;
  lastFmDraft: string;
  savingLastFm: boolean;
  syncingLastFm: boolean;
  ownerSpotifyEligible: boolean;
  spotifyOwnerState: 'not_connected' | 'connecting' | 'connected' | 'syncing';
  onLastFmDraft: (value: string) => void;
  onEditLastFm: () => void;
  onCancelLastFm: () => void;
  onSaveLastFm: () => void;
  onSyncLastFm: () => void;
  onSpotifyOwnerConnect: () => void;
  onSpotifyOwnerSync: () => void;
  onChangeProvider: () => void;
  onMembership: () => void;
  onAppleSignIn: () => void;
  onPrivateCloudSync: () => void;
  onSignOut: () => void;
  onDeleteAccount: () => void;
  onDataHealth: () => void;
  onTessieChanged: () => void;
  onEditorActiveChange: (active: boolean) => void;
}) {
  const theme = useAppTheme();
  const styles = useThemedStyles(darkStyles);
  const adaptiveLayout = useAdaptiveLayout();

  const [advancedSupportVisible, setAdvancedSupportVisible] = useState(false);
  const [savedPlaces, setSavedPlaces] = useState(() => loadSavedPlaces(currentUser.id));
  const [customSavedPlaces, setCustomSavedPlaces] = useState(() => loadCustomSavedPlaces(currentUser.id));
  const [profileAppearance, setProfileAppearance] = useState(() => loadProfileAppearance(currentUser));
  const [destination, setDestination] = useState<SettingsDestination>({ kind: 'overview' });
  const internalTesting = isInternalTestingBuild();
  const { appIconId } = useAppIconChoice();
  const selected = selectableProviderOptions(ownerSpotifyEligible).find(option => option.id === provider) ?? publicProviderOptions[0]!;
  const insets = useSafeAreaInsets();
  useEffect(() => {
    setSavedPlaces(loadSavedPlaces(currentUser.id));
    setCustomSavedPlaces(loadCustomSavedPlaces(currentUser.id));
    setProfileAppearance(loadProfileAppearance(currentUser));
    setDestination({ kind: 'overview' });
  }, [currentUser.id]);
  useEffect(() => {
    onEditorActiveChange(destination.kind !== 'overview');
  }, [destination.kind, onEditorActiveChange]);
  useEffect(() => () => onEditorActiveChange(false), [onEditorActiveChange]);
  const refreshSavedPlaces = () => {
    setSavedPlaces(loadSavedPlaces(currentUser.id));
    setCustomSavedPlaces(loadCustomSavedPlaces(currentUser.id));
  };
  const closeEditor = () => setDestination({ kind: 'overview' });
  const openCategory = (category: SettingsCategoryId) => {
    setDestination({ kind: 'category', category });
    void haptics.selection();
  };

  const lastFmControls = <>{isMusicProviderAvailable('lastfm') && selected.id === 'lastfm' && <>
          <SectionHeading title="Last.fm connection" />
          <ConnectionTile name="Spotify history" detail="Imported through your Last.fm username" symbol="↻" brand="spotify" color={theme.color("#1ed760", 'text')} status={!connectionCapabilities.lastFmConfigured ? 'Preview edge setup required' : lastFmConnected ? `Connected as ${lastFmUsername} · privacy edge` : lastFmUsername ? `Set for ${lastFmUsername} · pending first sync` : 'Not connected'} action={lastFmUsername ? 'Change' : 'Set up'} onPress={onEditLastFm} />
          {editingLastFm && <View style={styles.setupCard}>
            <Text style={styles.setupTitle}>SPOTIFY HISTORY VIA LAST.FM</Text>
            <Text style={styles.setupBody}>First connect Spotify scrobbling in Last.fm, then enter that public Last.fm username here. JourneyDeck uses only timestamped scrobbles around a completed journey.</Text>
            <Text accessibilityRole="link" onPress={() => void Linking.openURL('https://www.last.fm/join')} style={styles.privateCloudLearn}>Create a free Last.fm account</Text>
            <Text accessibilityRole="link" onPress={() => void Linking.openURL('https://www.last.fm/about/trackmymusic')} style={styles.privateCloudLearn}>Connect Spotify to Last.fm</Text>
            <TextInput value={lastFmDraft} onChangeText={onLastFmDraft} autoCapitalize="none" autoCorrect={false} maxLength={15} placeholder="Last.fm username" placeholderTextColor={theme.color("#6f6877", 'text')} style={styles.setupInput} />
            <Text style={styles.connectionDetail}>Only your public Last.fm username and the completed journey’s time window cross the privacy edge. Routes, coordinates, Apple identity, and JourneyDeck records stay off it.</Text>
            {!connectionCapabilities.lastFmConfigured && <Text style={styles.setupWarning}>Music sync is unavailable until the Last.fm connection is configured.</Text>}
            {lastFmUsername && connectionCapabilities.lastFmConfigured && <TouchPressable onPress={onSyncLastFm} disabled={syncingLastFm} style={[styles.setupSync, syncingLastFm && styles.pressed]}><Text style={styles.setupSyncText}>{syncingLastFm ? 'Checking recent journeys…' : 'Sync recent journeys now'}</Text></TouchPressable>}
            <View style={styles.setupActions}><TouchPressable onPress={onCancelLastFm} style={styles.setupSecondary}><Text style={styles.setupSecondaryText}>Cancel</Text></TouchPressable><TouchPressable onPress={onSaveLastFm} disabled={savingLastFm} style={[styles.setupPrimary, savingLastFm && styles.pressed]}><Text style={styles.setupPrimaryText}>{savingLastFm ? 'Saving…' : 'Save'}</Text></TouchPressable></View>
          </View>}
        </>}</>;
  const internalMusicControls = <>{internalTesting && advancedSupportVisible && ownerSpotifyEligible && <ConnectionTile name="Owner Spotify (private preview)" detail="Direct allowlisted history for Patrick’s device" symbol="▶" brand="spotify" color={theme.color("#1ed760", 'text')} status={spotifyOwnerState === 'connected' ? 'Connected · tokens in this iPhone Keychain' : spotifyOwnerState === 'connecting' ? 'Finish in Spotify…' : spotifyOwnerState === 'syncing' ? 'Matching recent journeys…' : 'Not connected'} action={spotifyOwnerState === 'connected' ? 'Sync now' : spotifyOwnerState === 'syncing' ? 'Syncing…' : 'Connect'} onPress={spotifyOwnerState === 'connected' ? onSpotifyOwnerSync : spotifyOwnerState === 'syncing' || spotifyOwnerState === 'connecting' ? () => undefined : onSpotifyOwnerConnect} />}</>;

  const tessieContent = TESSIE_INTEGRATION_ENABLED
    ? <TessieConnectionCard profileId={currentUser.id} membershipTier={membershipTier} onUpgrade={onMembership} onChanged={onTessieChanged} />
    : null;

  if (destination.kind === 'profile') {
    return <SettingsProfileEditor currentUser={currentUser} appearance={profileAppearance} onSaved={appearance => { setProfileAppearance(appearance); closeEditor(); }} onBack={closeEditor} />;
  }
  if (destination.kind === 'saved-place') {
    return <SettingsSavedPlaceEditor currentUser={currentUser} slot={destination.slot} hasSavedPlace={Boolean(savedPlaces[destination.slot])} onChanged={refreshSavedPlaces} onBack={closeEditor} />;
  }
  if (destination.kind === 'custom-place') {
    return <SettingsCustomPlaceEditor currentUser={currentUser} place={customSavedPlaces.find(place => place.id === destination.placeId)} onChanged={refreshSavedPlaces} onBack={closeEditor} />;
  }
  if (destination.kind === 'appearance-picker') {
    const choosingTheme = destination.picker === 'theme';
    return <SettingsEditorScaffold eyebrow="APPEARANCE" title={choosingTheme ? 'Choose a theme' : 'Choose an app icon'} onBack={() => setDestination({ kind: 'category', category: 'appearance' })}>
      <View style={styles.settingsCategoryStack}>
        {choosingTheme
          ? <ThemePicker membershipTier={membershipTier} onUpgrade={onMembership} />
          : <AppIconPicker membershipTier={membershipTier} onUpgrade={onMembership} />}
      </View>
    </SettingsEditorScaffold>;
  }

  if (adaptiveLayout.isRegular) return <IpadSettingsScreen
    displayName={profileAppearance.displayName} avatar={profileAppearance.avatarDataUri} initials={profileInitialsFor(profileAppearance.displayName)}
    appleIdentityStatus={appleIdentityStatus} signingInWithApple={signingInWithApple} accountActionPending={accountActionPending}
    hasAppleAccount={Boolean(currentUser.appleSubject)} cloud={privateCloud} membershipTier={membershipTier} membershipExpirationDate={membershipExpirationDate}
    providerName={selected.name} providerDetail={selected.summary}
    tessieConnected={connectionCapabilities.tessieConfigured}
    journeys={journeys}
    memories={memories}
    places={SAVED_PLACE_SLOTS.map(slot => ({ ...slot, saved: Boolean(savedPlaces[slot.id]) }))}
    customPlaces={customSavedPlaces.map(place => ({ id: place.id, label: place.label }))}
    onEditProfile={() => { setDestination({ kind: 'profile' }); void haptics.selection(); }}
    onAppleSignIn={onAppleSignIn} onSignOut={onSignOut} onDeleteAccount={onDeleteAccount} onSync={onPrivateCloudSync}
    onMembership={onMembership} onChangeProvider={onChangeProvider} onPlace={slot => setDestination({ kind: 'saved-place', slot })}
    onCustomPlace={placeId => setDestination({ kind: 'custom-place', placeId })}
    internalDiagnostics={internalTesting}
    advancedVisible={advancedSupportVisible} onToggleAdvanced={() => setAdvancedSupportVisible(value => !value)} onDataHealth={onDataHealth}
    advancedContent={internalMusicControls}
    tessieContent={tessieContent}
  />;

  const profileCard = <>
    <SectionHeading title="Account" />
    <TouchPressable accessibilityRole="button" accessibilityLabel="Edit primary driver profile" accessibilityHint="Change your name and profile photo" onPress={() => { setDestination({ kind: 'profile' }); void haptics.selection(); }} style={({ pressed }) => [styles.selectedProvider, styles.staticWidgetGlow, { borderColor: theme.color('#6d4a78', 'border') }, pressed && styles.pressed]}>
      <View style={[styles.connectionIcon, { overflow: 'hidden', backgroundColor: theme.color('#3a2446', 'surface') }]}>{profileAppearance.avatarDataUri ? <ExpoImage source={profileAppearance.avatarDataUri} contentFit="cover" transition={180} style={StyleSheet.absoluteFill} /> : <Text style={styles.connectionIconText}>{profileInitialsFor(profileAppearance.displayName)}</Text>}</View>
      <View style={styles.flex}><Text style={styles.connectionKicker}>JOURNEYDECK PROFILE</Text><Text style={styles.connectionName}>{profileAppearance.displayName}</Text><Text style={styles.connectionDetail}>{appleIdentityStatus === 'authorized' ? 'Apple connected' : 'Apple sign-in is optional'}</Text></View>
      <Text style={styles.savedPlaceAction}>Edit</Text>
    </TouchPressable>
    {appleIdentityStatus !== 'authorized' && !signingInWithApple && <AppleAuthentication.AppleAuthenticationButton buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE} buttonStyle={theme.isLight ? AppleAuthentication.AppleAuthenticationButtonStyle.BLACK : AppleAuthentication.AppleAuthenticationButtonStyle.WHITE} cornerRadius={12} style={styles.appleSignInButton} onPress={onAppleSignIn} />}
    {signingInWithApple && <View style={styles.appleSignInProgress}><ActivityIndicator color={theme.color('#a88aff', 'text')} /><Text style={styles.connectionDetail}>Finishing Apple sign-in…</Text></View>}
    {appleIdentityStatus === 'revoked' && <Text style={styles.appleIdentityWarning}>Apple access was revoked. Your local journeys remain untouched; sign in again to relink this profile.</Text>}
  </>;
  const accountActions = <View style={styles.settingsDangerGroup}>
    {Boolean(currentUser.appleSubject) && <TouchPressable accessibilityRole="button" disabled={accountActionPending} onPress={onSignOut} style={[styles.settingsDangerRow, accountActionPending && styles.pressed]}><Text style={styles.accountSecondaryText}>Sign out of JourneyDeck</Text></TouchPressable>}
    <TouchPressable accessibilityRole="button" disabled={accountActionPending} onPress={onDeleteAccount} style={[styles.settingsDangerRow, Boolean(currentUser.appleSubject) && styles.settingsHubRowBorder, accountActionPending && styles.pressed]}><Text style={styles.accountDeleteText}>{accountActionPending ? 'Finishing account change…' : 'Delete JourneyDeck account'}</Text></TouchPressable>
  </View>;
  const cloudCard = <>
    <SectionHeading title="iCloud Backup" />
    <View style={[styles.selectedProvider, styles.staticWidgetGlow, { borderColor: theme.color('#4598ff', 'border') }]}>
      <View style={styles.icloudMark}><SymbolView name="icloud.fill" tintColor="#1687ff" size={27} /></View>
      <View style={styles.flex}><Text style={styles.connectionKicker}>PRIVATE · YOUR ICLOUD ACCOUNT</Text><Text style={styles.connectionName}>iCloud Backup</Text><Text numberOfLines={privateCloud.status === 'syncing' ? 1 : undefined} ellipsizeMode="tail" style={styles.connectionDetail}>{privateCloud.detail}</Text></View>
      <TouchPressable accessibilityRole="button" accessibilityLabel="Sync iCloud now" onPress={onPrivateCloudSync} disabled={privateCloud.status === 'syncing' || privateCloud.status === 'unavailable'} style={[styles.changeButton, privateCloud.status === 'syncing' && styles.pressed]}><Text style={styles.changeButtonText}>{privateCloud.status === 'syncing' ? 'Syncing…' : privateCloud.status === 'synced' ? 'Synced' : privateCloud.status === 'unavailable' ? 'Update app' : 'Sync'}</Text></TouchPressable>
    </View>
    <Text style={styles.settingsDetailFootnote}>Your JourneyDeck library stays private in your iCloud account.</Text>
  </>;
  const membershipCard = <>
    <SectionHeading title="Membership" />
    <View style={[styles.selectedProvider, styles.staticWidgetGlow, { borderColor: theme.color(membershipTier === 'paid' ? '#ff795b' : '#6d4a78', 'border') }]}>
      {membershipTier === 'paid' ? <Image source={theme.isLight ? require('../assets/icon-light-plum-v1.png') : require('../assets/icon.png')} resizeMode="cover" style={styles.membershipSettingsLogo} /> : <LinearGradient colors={theme.gradient(['#4a285d', '#26152f'])} style={styles.membershipSettingsIcon}><Text style={styles.membershipSettingsIconText}>45</Text></LinearGradient>}
      <View style={styles.flex}><Text style={styles.connectionKicker}>{membershipTier === 'paid' ? 'ATLAS + COMPLETE HISTORY' : 'FREE · LATEST 45 DAYS'}</Text><Text style={styles.connectionName}>{membershipTier === 'paid' ? 'JourneyDeck Membership' : 'Your latest roads are ready'}</Text><Text style={styles.connectionDetail}>{membershipTier === 'paid' ? `Atlas and complete history unlocked${membershipExpirationDate ? ` through ${new Date(membershipExpirationDate).toLocaleDateString()}` : ''}.` : 'Unlock Atlas and your complete history.'}</Text></View>
      <TouchPressable accessibilityRole="button" onPress={onMembership} style={styles.changeButton}><Text style={styles.changeButtonText}>{membershipTier === 'paid' ? 'Manage' : 'Unlock'}</Text></TouchPressable>
    </View>
  </>;
  const providerCard = <>
    <SectionHeading title="Soundtrack capture" />
    <View style={[styles.selectedProvider, styles.staticWidgetGlow, { borderColor: theme.color(selected.color, 'border') }]}>
      <ProviderMark brand={selected.brand} size={50} />
      <View style={styles.flex}><Text style={styles.connectionKicker}>{selected.id === 'apple-music' ? 'AUTOMATIC SOUNDTRACK · RECOMMENDED' : selected.id === 'shazam' ? 'MANUAL PER SONG · NOT AUTOMATIC' : 'SELECTED MUSIC METHOD'}</Text><Text style={styles.connectionName}>{selected.name}</Text><Text style={styles.connectionDetail}>{selected.summary}</Text></View>
      <TouchPressable accessibilityRole="button" accessibilityLabel="Change soundtrack provider" onPress={onChangeProvider} style={styles.changeButton}><Text style={styles.changeButtonText}>Change</Text></TouchPressable>
    </View>
  </>;
  const placesCard = <View style={styles.savedPlacesCard}>
    <Text style={styles.savedPlacesHint}>Name journeys automatically and protect these locations when sharing.</Text>
    {SAVED_PLACE_SLOTS.map((slot, index) => <TouchPressable key={slot.id} accessibilityRole="button" accessibilityLabel={`${savedPlaces[slot.id] ? 'Change' : 'Set'} ${slot.label}`} onPress={() => setDestination({ kind: 'saved-place', slot: slot.id })} style={[styles.savedPlaceRow, index > 0 && styles.savedPlaceRowBorder]}>
      <View style={styles.savedPlaceIcon}><SymbolView name={slot.symbol as SFSymbol} tintColor={theme.color('#ff9478', 'text')} size={20} /></View>
      <View style={styles.flex}><Text style={styles.savedPlaceName}>{slot.label}</Text><Text style={styles.savedPlaceStatus}>{savedPlaces[slot.id] ? 'Saved · protected when sharing' : 'Not set'}</Text></View>
      <Text style={styles.savedPlaceAction}>{savedPlaces[slot.id] ? 'Change' : 'Set'}</Text>
    </TouchPressable>)}
    {customSavedPlaces.map(place => <TouchPressable key={place.id} accessibilityRole="button" accessibilityLabel={`Edit custom place ${place.label}`} onPress={() => setDestination({ kind: 'custom-place', placeId: place.id })} style={[styles.savedPlaceRow, styles.savedPlaceRowBorder]}>
      <View style={styles.savedPlaceIcon}><SymbolView name="mappin.and.ellipse" tintColor={theme.color('#ff9478', 'text')} size={20} /></View>
      <View style={styles.flex}><Text style={styles.savedPlaceName}>{place.label}</Text><Text style={styles.savedPlaceStatus}>Saved · protected when sharing</Text></View>
      <Text style={styles.savedPlaceAction}>Change</Text>
    </TouchPressable>)}
    <TouchPressable accessibilityRole="button" accessibilityLabel={customSavedPlaces.length ? 'Add another custom place' : 'Add custom place'} onPress={() => setDestination({ kind: 'custom-place' })} style={[styles.savedPlaceRow, styles.savedPlaceRowBorder]}>
      <View style={styles.savedPlaceIcon}><SymbolView name="plus" tintColor={theme.color('#ff9478', 'text')} size={20} /></View>
      <View style={styles.flex}><Text style={styles.savedPlaceName}>Custom</Text><Text style={styles.savedPlaceStatus}>{customSavedPlaces.length ? 'Add another safe place' : 'Add a named safe place'}</Text></View>
      <Text style={styles.savedPlaceAction}>Add</Text>
    </TouchPressable>
  </View>;
  const supportCard = <>
    <SectionHeading title="Support" />
    {internalTesting && <>
      <TouchPressable accessibilityRole="button" accessibilityLabel="Advanced Support" accessibilityState={{ expanded: advancedSupportVisible }} onPress={() => setAdvancedSupportVisible(value => !value)} style={({ pressed }) => [styles.settingsDataHealth, pressed && styles.pressed]}>
        <View style={styles.settingsDataHealthIcon}><SymbolView name="wrench.and.screwdriver.fill" tintColor={theme.color('#b88cff', 'text')} size={21} /></View>
        <View style={styles.flex}><Text style={styles.settingsDataHealthKicker}>{internalTesting ? 'INTERNAL TESTING' : 'TESTFLIGHT DIAGNOSTICS'}</Text><Text style={styles.settingsDataHealthTitle}>Advanced Support</Text><Text style={styles.settingsDataHealthBody}>{internalTesting ? 'Diagnostics and test controls for internal builds.' : 'Check app data and connected services.'}</Text></View>
        <Text style={styles.settingsDataHealthArrow}>{advancedSupportVisible ? '⌃' : '⌄'}</Text>
      </TouchPressable>
      <ExpandingSection expanded={advancedSupportVisible}><TouchPressable accessibilityRole="button" accessibilityLabel="Open Data Health" onPress={onDataHealth} style={({ pressed }) => [styles.settingsDataHealth, pressed && styles.pressed]}><View style={styles.settingsDataHealthIcon}><SymbolView name="checkmark.shield.fill" tintColor={theme.color('#54e6bc', 'text')} size={22} /></View><View style={styles.flex}><Text style={styles.settingsDataHealthKicker}>LOCAL-FIRST DIAGNOSTICS</Text><Text style={styles.settingsDataHealthTitle}>Data Health</Text><Text style={styles.settingsDataHealthBody}>Check recording, music, artwork, and private iCloud status.</Text></View><Text style={styles.settingsDataHealthArrow}>›</Text></TouchPressable></ExpandingSection>
    </>}
    <View style={styles.settingsSupportLinks}><TouchPressable accessibilityRole="link" accessibilityLabel="Privacy Policy" onPress={() => void Linking.openURL('https://journeydeck.me/privacy')} style={styles.settingsSupportLink}><Text style={styles.privateCloudLearn}>Privacy Policy ↗</Text></TouchPressable><TouchPressable accessibilityRole="link" accessibilityLabel="Support Page" onPress={() => void Linking.openURL('https://journeydeck.me/support')} style={styles.settingsSupportLink}><Text style={styles.privateCloudLearn}>Support Page ↗</Text></TouchPressable></View>
  </>;

  const compactActionRow = ({ label, detail, symbol, value, accessibilityLabel, onPress, border = false }: {
    label: string; detail: string; symbol: SFSymbol; value?: string; accessibilityLabel: string; onPress: () => void; border?: boolean;
  }) => <TouchPressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} onPress={onPress} style={({ pressed }) => [styles.settingsCompactRow, border && styles.settingsHubRowBorder, pressed && styles.pressed]}>
    <View style={styles.settingsCompactIcon}><SymbolView name={symbol} tintColor={theme.palette.accent} size={19} /></View>
    <View style={styles.flex}><Text style={styles.settingsCompactTitle}>{label}</Text><Text numberOfLines={2} style={styles.settingsCompactDetail}>{detail}</Text></View>
    {value && <Text numberOfLines={1} style={styles.settingsCompactValue}>{value}</Text>}
    <Text style={styles.settingsCompactChevron}>›</Text>
  </TouchPressable>;

  if (destination.kind === 'category') {
    const category = settingsCategories.find(item => item.id === destination.category)!;
    const categoryContent: Record<SettingsCategoryId, ReactNode> = {
      appearance: <>
        <Text style={styles.settingsDetailIntro}>Your current look stays selected until you choose another. Theme changes apply throughout JourneyDeck.</Text>
        <View style={styles.settingsCompactList}>
          {compactActionRow({ label: 'Theme', detail: 'Colors, artwork, and interface style', value: theme.name, symbol: 'paintbrush.fill', accessibilityLabel: 'Choose theme', onPress: () => setDestination({ kind: 'appearance-picker', picker: 'theme' }) })}
          {compactActionRow({ label: 'App icon', detail: 'The icon shown on your Home Screen', value: appIconCatalog[appIconId].name, symbol: 'app.fill', accessibilityLabel: 'Choose app icon', onPress: () => setDestination({ kind: 'appearance-picker', picker: 'icon' }), border: true })}
        </View>
      </>,
      achievements: <AchievementsOverview journeys={journeys} memories={memories} />,
      recording: <>
        <View style={styles.settingsCompactList}>
          <View style={styles.settingsInfoRow}><View style={styles.settingsCompactIcon}><SymbolView name="record.circle" tintColor={theme.palette.accent} size={19} /></View><View style={styles.flex}><Text style={styles.settingsCompactTitle}>{connectionCapabilities.tessieConfigured ? 'Automatic recording with Tessie' : 'Manual recording'}</Text><Text style={styles.settingsCompactDetail}>{connectionCapabilities.tessieConfigured ? 'JourneyDeck detects drives and shows each journey while it is recording.' : 'Journeys begin only after you tap Start Journey.'}</Text></View><Text style={styles.settingsStatusText}>On</Text></View>
          <View style={[styles.settingsInfoRow, styles.settingsHubRowBorder]}><View style={styles.settingsCompactIcon}><SymbolView name="location.fill" tintColor={theme.palette.accent} size={19} /></View><View style={styles.flex}><Text style={styles.settingsCompactTitle}>Location privacy</Text><Text style={styles.settingsCompactDetail}>Routes stay local and in your private iCloud account. Saved places are masked when sharing.</Text></View></View>
        </View>
        <View style={styles.settingsInsetNote}><Text style={styles.privateCloudTitle}>PLACE DATA</Text><PlaceDataCredits /></View>
      </>,
      music: <>{providerCard}{tessieContent}{lastFmControls}{internalMusicControls}<View style={styles.settingsInsetNote}><Text style={styles.securityTitle}>PRIVATE BY DESIGN</Text><Text style={styles.securityBody}>Music and vehicle connections are optional. A connection or iCloud problem never blocks starting, finishing, or saving a journey.</Text></View></>,
      account: <>{profileCard}{cloudCard}<View style={styles.settingsCompactList}>{compactActionRow({ label: 'Read Privacy Policy', detail: 'How JourneyDeck protects your data', symbol: 'hand.raised.fill', accessibilityLabel: 'Privacy Policy', onPress: () => void Linking.openURL('https://journeydeck.me/privacy') })}</View><Text style={styles.settingsSectionLabel}>ACCOUNT ACTIONS</Text>{accountActions}</>,
      places: <><Text style={styles.settingsDetailIntro}>Name familiar places automatically and protect their exact locations when sharing.</Text>{placesCard}</>,
      membership: <>{membershipCard}{supportCard}</>,
    };
    return <SettingsEditorScaffold eyebrow="SETTINGS" title={category.title} onBack={closeEditor}><View style={styles.settingsCategoryStack}>{categoryContent[destination.category]}</View></SettingsEditorScaffold>;
  }

  const savedPlaceCount = SAVED_PLACE_SLOTS.filter(slot => Boolean(savedPlaces[slot.id])).length + customSavedPlaces.length;
  const categorySummary: Record<SettingsCategoryId, string> = {
    appearance: `${theme.name} · ${appIconCatalog[appIconId].name} icon`, recording: connectionCapabilities.tessieConfigured ? 'Automatic recording with Tessie' : 'Manual recording', music: selected.name,
    achievements: `${journeys.length} recorded journeys`,
    account: privateCloud.status === 'synced' ? 'iCloud synced' : 'Profile and private backup', places: `${savedPlaceCount} saved`,
    membership: membershipTier === 'paid' ? 'JourneyDeck Membership' : 'Free · Help and privacy',
  };
  const renderCategoryRow = (categoryId: SettingsCategoryId, border: boolean) => {
    const category = settingsCategories.find(item => item.id === categoryId)!;
    return <TouchPressable key={category.id} accessibilityRole="button" accessibilityLabel={`Open ${category.title} settings`} onPress={() => openCategory(category.id)} style={({ pressed }) => [styles.settingsHubRow, border && styles.settingsHubRowBorder, pressed && styles.pressed]}>
      <View style={styles.settingsHubIcon}><SymbolView name={category.symbol as SFSymbol} tintColor={theme.id === 'midnight-canopy' ? theme.palette.text : theme.palette.accent} size={19} /></View><View style={styles.flex}><Text style={styles.settingsHubTitle}>{category.title}</Text><Text numberOfLines={1} style={styles.settingsHubSummary}>{categorySummary[category.id]}</Text></View><Text style={styles.settingsHubChevron}>›</Text>
    </TouchPressable>;
  };
  const renderCategoryGroup = (label: string, categoryIds: readonly SettingsCategoryId[]) => <View style={styles.settingsHubSection}>
    <Text style={styles.settingsSectionLabel}>{label}</Text>
    <View style={styles.settingsHubList}>{categoryIds.map((categoryId, index) => renderCategoryRow(categoryId, index > 0))}</View>
  </View>;
  return <SettingsScrollView contentContainerStyle={[styles.pageContent, styles.settingsRootContent, { paddingTop: insets.top + 14, paddingBottom: insets.bottom + 112 }]} contentInsetAdjustmentBehavior="never" automaticallyAdjustContentInsets={false} automaticallyAdjustsScrollIndicatorInsets={false} showsVerticalScrollIndicator={false}>
    <AtmosphericBackdrop variant="settings" /><PageHeader variant="settings" eyebrow="YOUR DATA, YOUR CHOICE" title="Settings" body="Music, saved places, backup, and account." />
    <TouchPressable accessibilityRole="button" accessibilityLabel="Edit primary driver profile" onPress={() => { setDestination({ kind: 'profile' }); void haptics.selection(); }} style={({ pressed }) => [styles.settingsHubProfile, pressed && styles.pressed]}>
      <View style={[styles.settingsHubAvatar, { backgroundColor: theme.palette.inset }]}>{profileAppearance.avatarDataUri ? <ExpoImage source={profileAppearance.avatarDataUri} contentFit="cover" transition={180} style={StyleSheet.absoluteFill} /> : <Text style={styles.connectionIconText}>{profileInitialsFor(profileAppearance.displayName)}</Text>}</View>
      <View style={styles.flex}><Text style={styles.settingsHubProfileName}>{profileAppearance.displayName}</Text><Text style={styles.settingsHubProfileDetail}>Primary driver · {membershipTier === 'paid' ? 'JourneyDeck Membership' : 'Free plan'}</Text></View><Text style={styles.settingsHubAction}>Edit</Text>
    </TouchPressable>
    <View style={styles.settingsHubSection}>
      <Text style={styles.settingsSectionLabel}>YOUR JOURNEY</Text>
      <View style={styles.settingsHubList}>
        {renderCategoryRow('achievements', false)}
        {renderCategoryRow('places', true)}
      </View>
    </View>
    {renderCategoryGroup('PREFERENCES', ['appearance', 'music', 'recording'])}
    {renderCategoryGroup('ACCOUNT & SUPPORT', ['account', 'membership'])}
  </SettingsScrollView>;
}

function JourneyDeckLogo({ size }: { size: number }) {
  const theme = useAppTheme();
  return <Image source={theme.isLight ? require('../assets/icon-light-plum-v1.png') : require('../assets/icon.png')} resizeMode="contain" style={{ width: size, height: size, borderRadius: Math.round(size * 0.24) }} />;
}

function JourneyDeckWordmark({ variant }: { variant: 'brand' | 'intro' | 'home' }) {
  const styles = useThemedStyles(darkStyles);

  const style = variant === 'brand'
    ? styles.brandWordmark
    : variant === 'intro'
      ? styles.welcomeIntroWordmark
      : styles.cinematicWordmark;
  return <Text accessibilityRole="header" style={style}><Text style={styles.wordmarkJourney}>Journey</Text><Text style={styles.wordmarkDeck}>Deck</Text></Text>;
}

function BrandHeader({ compact = false }: { compact?: boolean }) {
  const styles = useThemedStyles(darkStyles);

  return <View style={[styles.brandRow, compact && styles.brandCompact]}><JourneyDeckLogo size={48} /><View><JourneyDeckWordmark variant="brand" /><Text style={styles.brandTitle}>Your drive, remembered.</Text></View></View>;
}

function PageHeader({ eyebrow, title, body, variant = 'standard' }: { eyebrow: string; title: string; body: string; variant?: 'standard' | 'memories' | 'settings' }) {
  const pageSceneStyles = useThemedStyles(darkPageSceneStyles);
  const styles = useThemedStyles(darkStyles);

  if (variant === 'memories') {
    return <PhoneTabTitle title={title} />;
  }
  if (variant === 'settings') return <PhoneTabTitle title={title} />;
  return <View style={styles.pageHeader}>
    <PageHeaderScene variant={variant} />
    <Text style={[styles.pageEyebrow, variant !== 'standard' && pageSceneStyles.sceneEyebrow]}>{eyebrow}</Text>
    <Text style={[styles.pageTitle, variant !== 'standard' && pageSceneStyles.sceneTitle]}>{title}</Text>
    <Text style={[styles.pageBody, variant !== 'standard' && pageSceneStyles.sceneBody]}>{body}</Text>
  </View>;
}

function AtmosphericBackdrop({ variant }: { variant: 'home' | 'memories' | 'settings' }) {
  const theme = useAppTheme();
  const styles = useThemedStyles(darkStyles);

  const accent = variant === 'home' ? '#ff603f' : variant === 'memories' ? '#a04cff' : '#315f91';
  const secondary = variant === 'settings' ? '#d34378' : '#ff3f85';
  return <Svg pointerEvents="none" viewBox="0 0 430 1400" preserveAspectRatio="none" style={styles.atmosphere}>
    <Defs>
      <SvgRadialGradient id={`${variant}Top`} cx="52%" cy="3%" rx="62%" ry="32%"><Stop offset="0" stopColor={theme.color(accent, 'accent')} stopOpacity="0.24" /><Stop offset="0.48" stopColor={theme.color(accent, 'accent')} stopOpacity="0.09" /><Stop offset="1" stopColor={theme.color(accent, 'accent')} stopOpacity="0" /></SvgRadialGradient>
      <SvgRadialGradient id={`${variant}Side`} cx="100%" cy="39%" rx="72%" ry="31%"><Stop offset="0" stopColor={theme.color(secondary, 'accent')} stopOpacity="0.18" /><Stop offset="0.55" stopColor={theme.color(secondary, 'accent')} stopOpacity="0.06" /><Stop offset="1" stopColor={theme.color(secondary, 'accent')} stopOpacity="0" /></SvgRadialGradient>
      <SvgRadialGradient id={`${variant}Low`} cx="0%" cy="82%" rx="78%" ry="35%"><Stop offset="0" stopColor={theme.color("#5f52ff", 'accent')} stopOpacity="0.14" /><Stop offset="0.58" stopColor={theme.color("#5f52ff", 'accent')} stopOpacity="0.04" /><Stop offset="1" stopColor={theme.color("#5f52ff", 'accent')} stopOpacity="0" /></SvgRadialGradient>
    </Defs>
    <Rect width="430" height="1400" fill={theme.color(`url(#${variant}Top)`, 'accent')} /><Rect width="430" height="1400" fill={theme.color(`url(#${variant}Side)`, 'accent')} /><Rect width="430" height="1400" fill={theme.color(`url(#${variant}Low)`, 'accent')} />
  </Svg>;
}

function PageHeaderScene({ variant }: { variant: 'standard' | 'memories' | 'settings' }) {
  const theme = useAppTheme();
  const pageSceneStyles = useThemedStyles(darkPageSceneStyles);
  const styles = useThemedStyles(darkStyles);

  if (variant === 'memories') return <>
    <LinearGradient pointerEvents="none" colors={theme.gradient(['#180c26', '#0d091b', '#06030c'] as const)} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
    <Svg pointerEvents="none" viewBox="0 0 360 170" style={pageSceneStyles.sceneCanvas}>
      <Defs>
        <SvgRadialGradient id="memorySkyGlow" cx="76%" cy="25%" rx="55%" ry="60%">
          <Stop offset="0" stopColor={theme.color("#7a4fb2", 'accent')} stopOpacity="0.32" />
          <Stop offset="50%" stopColor={theme.color("#ff4d87", 'accent')} stopOpacity="0.08" />
          <Stop offset="100%" stopColor={theme.color("#06030c", 'accent')} stopOpacity="0" />
        </SvgRadialGradient>
        <SvgRadialGradient id="moonAura" cx="78%" cy="22%" rx="20%" ry="35%">
          <Stop offset="0" stopColor={theme.color("#dce8ff", 'accent')} stopOpacity="0.4" />
          <Stop offset="40%" stopColor={theme.color("#7a96d4", 'accent')} stopOpacity="0.12" />
          <Stop offset="100%" stopColor={theme.color("#7a96d4", 'accent')} stopOpacity="0" />
        </SvgRadialGradient>
        <SvgLinearGradient id="highwayCoral" x1="0" y1="1" x2="1" y2="0">
          <Stop offset="0%" stopColor={theme.color("#ff8c6d", 'accent')} />
          <Stop offset="60%" stopColor={theme.color("#ff5a43", 'accent')} />
          <Stop offset="100%" stopColor={theme.color("#ff9a7a", 'accent')} />
        </SvgLinearGradient>
        <SvgLinearGradient id="highwayMagenta" x1="0" y1="1" x2="1" y2="0">
          <Stop offset="0%" stopColor={theme.color("#ff3f82", 'accent')} />
          <Stop offset="55%" stopColor={theme.color("#d946ef", 'accent')} />
          <Stop offset="100%" stopColor={theme.color("#a855f7", 'accent')} />
        </SvgLinearGradient>
        <SvgLinearGradient id="highwayCyan" x1="0" y1="1" x2="1" y2="0">
          <Stop offset="0%" stopColor={theme.color("#38bdf8", 'accent')} />
          <Stop offset="50%" stopColor={theme.color("#43e6ae", 'accent')} />
          <Stop offset="100%" stopColor={theme.color("#818cf8", 'accent')} />
        </SvgLinearGradient>
        <SvgLinearGradient id="memoryHeaderRoad" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0%" stopColor={theme.color("#ff795b", 'accent')} />
          <Stop offset="45%" stopColor={theme.color("#ff3f82", 'accent')} />
          <Stop offset="80%" stopColor={theme.color("#c57fff", 'accent')} />
          <Stop offset="100%" stopColor={theme.color("#43e6ae", 'accent')} />
        </SvgLinearGradient>
        <SvgLinearGradient id="topoLines" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0%" stopColor={theme.color("#68478c", 'accent')} stopOpacity="0.08" />
          <Stop offset="50%" stopColor={theme.color("#8b5cb8", 'accent')} stopOpacity="0.28" />
          <Stop offset="100%" stopColor={theme.color("#ff795b", 'accent')} stopOpacity="0.15" />
        </SvgLinearGradient>
      </Defs>
      <Rect width="360" height="170" fill="url(#memorySkyGlow)" />
      <Rect width="360" height="170" fill="url(#moonAura)" />

      {/* Luminous Moon & Stars */}
      <Circle cx="280" cy="34" r="6" fill={theme.color("#eaf2ff", 'accent')} />
      <Circle cx="280" cy="34" r="12" fill="none" stroke={theme.color("#90b2f0", 'accent')} strokeWidth="1" opacity="0.3" />
      <Circle cx="230" cy="22" r="1" fill={theme.color("#ffffff", 'accent')} opacity="0.8" />
      <Circle cx="250" cy="45" r="1.2" fill={theme.color("#ffffff", 'accent')} opacity="0.6" />
      <Circle cx="320" cy="26" r="1" fill={theme.color("#ffffff", 'accent')} opacity="0.85" />
      <Circle cx="340" cy="50" r="1.2" fill={theme.color("#ffd9ea", 'accent')} opacity="0.65" />
      <Circle cx="215" cy="40" r="0.8" fill={theme.color("#ffffff", 'accent')} opacity="0.5" />

      {/* Topographic Mountain Elevation Contours */}
      <Path d="M 140 38 Q 210 60 355 35" fill="none" stroke="url(#topoLines)" strokeWidth="1" strokeDasharray="3 3" />
      <Path d="M 130 68 Q 205 92 355 65" fill="none" stroke="url(#topoLines)" strokeWidth="1" strokeDasharray="4 4" />
      <Path d="M 120 102 Q 195 125 355 98" fill="none" stroke="url(#topoLines)" strokeWidth="1.2" opacity="0.4" />
      <Path d="M 110 135 Q 185 152 355 130" fill="none" stroke="url(#topoLines)" strokeWidth="1" opacity="0.25" />

      {/* Distant Horizon City Shimmer */}
      <Path d="M 230 70 Q 285 75 340 68" fill="none" stroke={theme.color("#ff8bb9", 'accent')} strokeWidth="1.5" opacity="0.3" strokeDasharray="1 3" />

      {/* Multi-Lane Glowing Highway Ribbon */}
      {/* Highway Underglow Bloom */}
      <Path d="M 355 72 C 295 72, 280 102, 235 106 S 185 152, 130 146 S 65 162, 0 156" fill="none" stroke={theme.color("#ff3f82", 'accent')} strokeWidth="16" opacity="0.18" strokeLinecap="round" />

      {/* Lane 1: Cyan/Mint Light Trail */}
      <Path d="M 355 69 C 295 69, 280 99, 235 103 S 185 149, 130 143 S 65 159, 0 153" fill="none" stroke="url(#highwayCyan)" strokeWidth="2.5" strokeLinecap="round" />

      {/* Lane 2: Magenta/Pink Light Trail */}
      <Path d="M 355 72 C 295 72, 280 102, 235 106 S 185 152, 130 146 S 65 162, 0 156" fill="none" stroke="url(#highwayMagenta)" strokeWidth="3" strokeLinecap="round" />

      {/* Lane 3: Coral/Amber Light Trail */}
      <Path d="M 355 75 C 295 75, 280 105, 235 109 S 185 155, 130 149 S 65 165, 0 159" fill="none" stroke="url(#highwayCoral)" strokeWidth="3" strokeLinecap="round" />

      {/* Waypoint Pin Beacons along the Road without Text */}
      {/* Waypoint 1 (Distant apex) */}
      <Path d="M 295 64 C 291 64, 291 70, 295 74 C 299 70, 299 64, 295 64 Z" fill={theme.color("#d946ef", 'accent')} />
      <Circle cx="295" cy="67" r="1.5" fill={theme.color("#ffffff", 'accent')} />
      <Circle cx="295" cy="69" r="7" fill="none" stroke={theme.color("#d946ef", 'accent')} strokeWidth="0.8" opacity="0.4" />

      {/* Waypoint 2 (Mid curve) */}
      <Path d="M 235 94 C 230 94, 230 101, 235 106 C 240 101, 240 94, 235 94 Z" fill={theme.color("#ff795b", 'accent')} />
      <Circle cx="235" cy="98" r="2" fill={theme.color("#ffffff", 'accent')} />
      <Circle cx="235" cy="100" r="10" fill="none" stroke={theme.color("#ff795b", 'accent')} strokeWidth="1" opacity="0.4" strokeDasharray="2 2" />

      {/* Waypoint 3 (Near foreground) */}
      <Path d="M 130 134 C 125 134, 125 141, 130 146 C 135 141, 135 134, 130 134 Z" fill={theme.color("#38bdf8", 'accent')} />
      <Circle cx="130" cy="138" r="2" fill={theme.color("#ffffff", 'accent')} />
      <Circle cx="130" cy="140" r="10" fill="none" stroke={theme.color("#38bdf8", 'accent')} strokeWidth="1" opacity="0.45" />

      {/* Waypoint 4 (Front bend) */}
      <Path d="M 50 146 C 46 146, 46 152, 50 156 C 54 152, 54 146, 50 146 Z" fill={theme.color("#c084fc", 'accent')} />
      <Circle cx="50" cy="149" r="1.5" fill={theme.color("#ffffff", 'accent')} />
    </Svg>
    <View pointerEvents="none" style={pageSceneStyles.sceneRail}><View style={pageSceneStyles.sceneRailCore} /></View>
  </>;
  if (variant === 'settings') return <>
    <LinearGradient pointerEvents="none" colors={theme.gradient(['#0e1026', '#160f29', '#0d0918'] as const)} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
    <Svg pointerEvents="none" viewBox="0 0 360 170" style={pageSceneStyles.sceneCanvas}>
      <Defs>
        <SvgLinearGradient id="settingsHeaderLink" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0%" stopColor={theme.color("#43e6ae", 'accent')} stopOpacity="0.85" />
          <Stop offset="50%" stopColor={theme.color("#9b7cff", 'accent')} stopOpacity="0.9" />
          <Stop offset="100%" stopColor={theme.color("#ff795b", 'accent')} stopOpacity="0.85" />
        </SvgLinearGradient>
        <SvgRadialGradient id="settingsHeaderBloom" cx="80%" cy="35%" rx="60%" ry="70%">
          <Stop offset="0" stopColor={theme.color("#5570ff", 'accent')} stopOpacity="0.25" />
          <Stop offset="45%" stopColor={theme.color("#7658dd", 'accent')} stopOpacity="0.1" />
          <Stop offset="100%" stopColor={theme.color("#9b61ff", 'accent')} stopOpacity="0" />
        </SvgRadialGradient>
      </Defs>
      <Rect width="360" height="170" fill="url(#settingsHeaderBloom)" />

      {/* Orbital Telemetry Sensor Rings */}
      <Circle cx="280" cy="72" r="48" fill="none" stroke={theme.color("#3b2b5c", 'accent')} strokeWidth="1" strokeDasharray="5 5" opacity="0.6" />
      <Circle cx="280" cy="72" r="32" fill="none" stroke={theme.color("#7658dd", 'accent')} strokeWidth="1.25" opacity="0.4" />
      <Circle cx="280" cy="72" r="18" fill="none" stroke={theme.color("#43e6ae", 'accent')} strokeWidth="1" strokeDasharray="3 3" opacity="0.75" />

      {/* Cybernetic Node Interlinks */}
      <Path d="M 185 45 L 245 72 L 280 72 L 335 38 M 245 72 L 230 132 L 315 125 L 342 90" fill="none" stroke="url(#settingsHeaderLink)" strokeWidth="1.75" strokeDasharray="4 3" opacity="0.7" />
      <Path d="M 280 72 L 315 125" fill="none" stroke={theme.color("#ff795b", 'accent')} strokeWidth="1.2" opacity="0.4" />

      {/* Telemetry Target Nodes */}
      <Circle cx="185" cy="45" r="4.5" fill={theme.color("#43e6ae", 'accent')} stroke={theme.color("#dffff5", 'accent')} strokeWidth="1.5" />
      <Circle cx="245" cy="72" r="4" fill={theme.color("#9b7cff", 'accent')} stroke={theme.color("#f4ebff", 'accent')} strokeWidth="1.5" />
      <Circle cx="280" cy="72" r="7" fill={theme.color("#ff795b", 'accent')} stroke={theme.color("#fff0ea", 'accent')} strokeWidth="2.5" />
      <Circle cx="335" cy="38" r="4.5" fill={theme.color("#54b8ff", 'accent')} stroke={theme.color("#e6f5ff", 'accent')} strokeWidth="1.5" />
      <Circle cx="230" cy="132" r="5" fill={theme.color("#7658dd", 'accent')} stroke={theme.color("#ebe2ff", 'accent')} strokeWidth="1.5" />
      <Circle cx="315" cy="125" r="4.5" fill={theme.color("#ff795b", 'accent')} stroke={theme.color("#fff1ed", 'accent')} strokeWidth="1.5" />
      <Circle cx="342" cy="90" r="3.5" fill={theme.color("#43e6ae", 'accent')} stroke={theme.color("#e6fff7", 'accent')} strokeWidth="1.5" />
    </Svg>
    <View pointerEvents="none" style={pageSceneStyles.sceneRail}><View style={[pageSceneStyles.sceneRailCore, pageSceneStyles.settingsRailCore]} /></View>
  </>;
  return <><LinearGradient pointerEvents="none" colors={theme.gradient(['#ff6a4d28', '#9b61ff22', '#05030b00'])} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} /><View pointerEvents="none" style={styles.pageHeaderRail}><View style={styles.pageHeaderRailCore} /></View></>;
}

function JourneyHeroAtmosphere() {
  const theme = useAppTheme();

  return <View pointerEvents="none" style={StyleSheet.absoluteFill}>
    <JourneyImage key={`journey-header-${theme.id}`} imageIdentity={`journey-header-${theme.id}`} source={headerImageSource(require('../assets/cinematic-journey-photo-v1.jpg'), theme.id)} contentFit="cover" style={StyleSheet.absoluteFill} />
    <LinearGradient colors={theme.gradient(['rgba(5,2,8,0.9)', 'rgba(7,3,10,0.45)', 'rgba(7,3,10,0)'])} locations={[0, 0.38, 0.66]} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={StyleSheet.absoluteFill} />
    <LinearGradient colors={theme.gradient(['rgba(7,3,10,0)', 'rgba(7,3,10,0.68)'])} locations={[0.28, 1]} style={StyleSheet.absoluteFill} />
  </View>;
}

function JourneyCinematicHero({ journey, title }: { journey: JourneyDetail; title: string }) {
  const styles = useThemedStyles(darkStyles);

  const leadTrack = journey.soundtrack[0] ?? journey.soundtrackPreview[0] ?? null;
  return <View style={styles.journeyHeroCard}>
    <View style={styles.journeyHeroIntro}>
      <JourneyHeroAtmosphere />
      <View pointerEvents="none" style={styles.journeyHeroCopy}>
        <Text style={styles.journeyHeroDate}>{formatFullDate(journey.startedAt).toUpperCase()}</Text>
        <Text style={styles.journeyHeroRoute} numberOfLines={2}>{title}</Text>
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
        <Text style={styles.journeyHeroSoundtrackLabel}>SOUNDTRACK</Text>
        <Text style={styles.journeyHeroTrack} numberOfLines={1}>{leadTrack?.track ?? (journey.songCount ? `${journey.songCount} songs captured` : 'No songs matched yet')}</Text>
        {!!leadTrack && <Text style={styles.journeyHeroArtist} numberOfLines={1}>{leadTrack.artist}</Text>}
      </View>
      <View style={styles.journeyHeroSongCount}><Text style={styles.journeyHeroSongCountValue}>{journey.songCount}</Text><Text style={styles.journeyHeroSongCountLabel}>SONGS</Text></View>
    </View>
  </View>;
}

function JourneyHeroMetric({ value, label }: { value: string; label: string }) {
  const styles = useThemedStyles(darkStyles);

  return <View style={styles.journeyHeroMetric}><Text style={styles.journeyHeroMetricValue} numberOfLines={1}>{value}</Text><Text style={styles.journeyHeroMetricLabel}>{label}</Text></View>;
}

function SectionHeading({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  const styles = useThemedStyles(darkStyles);

  return <View style={styles.sectionHeading}><View style={styles.sectionTitleGroup}><View style={styles.sectionAccent} /><Text style={styles.sectionTitle}>{title}</Text></View>{action && <Pressable onPress={onAction} disabled={!onAction} style={styles.sectionActionButton}><Text style={[styles.sectionAction, !onAction && styles.sectionActionMuted]}>{action}</Text></Pressable>}</View>;
}

function PrimaryAction({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  const styles = useThemedStyles(darkStyles);

  return <TouchPressable onPress={onPress} disabled={disabled} style={({ pressed }) => [styles.primaryAction, (pressed || disabled) && styles.pressed]}><Text style={styles.primaryActionText}>{label}</Text></TouchPressable>;
}

function Metric({ value, label }: { value: string; label: string }) {
  const styles = useThemedStyles(darkStyles);

  return <View style={styles.metric}><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View>;
}

const journeyCardEntryTracker = new JourneyCardEntryTracker();

function JourneyCard({ journey, onPress, compact = false }: { journey: JourneySummary; onPress: () => void; compact?: boolean }) {
  const styles = useThemedStyles(darkStyles);
  const { reduceMotion } = useMotionPreferences();
  const [firstPresentation] = useState(() => journeyCardEntryTracker.shouldAnimate(journey.id));
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const settle = (pressed: boolean) => {
    scale.value = reduceMotion ? 1 : withSpring(pressed ? 0.985 : 1, MOTION_SPRINGS.responsive);
  };
  const motion = useListRowMotion({ enter: firstPresentation, variant: 'down' });

  const track = journey.soundtrackPreview?.[0];
  if (compact) return (
    <Reanimated.View entering={motion.entering} exiting={motion.exiting} layout={motion.layout} style={animatedStyle}><CardDetailLink kind="journey" id={journey.id}><Pressable accessibilityRole="button" accessibilityLabel={`Open journey ${locationPair(journey)}`} onPress={onPress} onPressIn={() => settle(true)} onPressOut={() => settle(false)} style={({ pressed }) => [styles.journeyCardCompact, pressed && styles.pressed]}>
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
    </Pressable></CardDetailLink></Reanimated.View>
  );
  return (
    <Reanimated.View entering={motion.entering} exiting={motion.exiting} layout={motion.layout} style={animatedStyle}><CardDetailLink kind="journey" id={journey.id}><Pressable accessibilityRole="button" accessibilityLabel={`Open journey ${locationPair(journey)}`} onPress={onPress} onPressIn={() => settle(true)} onPressOut={() => settle(false)} style={({ pressed }) => [styles.journeyCard, styles.staticWidgetGlow, pressed && styles.pressed]}><NeonWidgetOutline radius={20} />
      <View style={styles.journeyTop}><View><Text style={styles.journeyDate}>{formatFullDate(journey.startedAt)}</Text><Text style={styles.journeyRoute} numberOfLines={2}>{locationPair(journey)}</Text></View><Text style={styles.journeyChevron}>›</Text></View>
      <View style={styles.journeyStats}><Text style={styles.journeyStat}>{formatMiles(journey.miles)}</Text><Text style={styles.journeyStatDot}>•</Text><Text style={styles.journeyStat}>{formatDuration(journey.durationMinutes)}</Text>{journey.vehicleName && <><Text style={styles.journeyStatDot}>•</Text><Text style={styles.journeyStat}>{journey.vehicleName}</Text></>}</View>
      <View style={styles.journeySoundtrack}>{track ? <Artwork track={track} size={42} /> : <View style={styles.miniArtwork}><Text style={styles.miniArtworkText}>♪</Text></View>}<View style={styles.flex}><Text style={styles.journeySong} numberOfLines={1}>{track?.track ?? (journey.songCount ? `${journey.songCount} soundtrack songs` : 'No soundtrack matched')}</Text><Text style={styles.journeyArtist} numberOfLines={1}>{track?.artist ?? 'Music can be added after the journey'}</Text></View>{journey.songCount > 0 && <Text style={styles.songCount}>{journey.songCount}</Text>}</View>
    </Pressable></CardDetailLink></Reanimated.View>
  );
}

function Artwork({ track, size }: { track: { artworkUrl?: string | null; track: string }; size: number }) {
  const theme = useAppTheme();
  const styles = useThemedStyles(darkStyles);

  return track.artworkUrl ? <ExpoImage source={{ uri: track.artworkUrl }} accessibilityLabel={`${track.track} artwork`} cachePolicy="memory-disk" contentFit="cover" transition={120} style={{ width: size, height: size, borderRadius: Math.round(size * 0.22), backgroundColor: theme.color('#251d31', 'surface') }} /> : <View style={[styles.artworkFallback, { width: size, height: size, borderRadius: Math.round(size * 0.22) }]}><Text style={[styles.artworkFallbackText, { fontSize: Math.round(size * 0.35) }]}>♪</Text></View>;
}

function TrackRow({ track, index, selected = false, onPress }: { track: { artworkUrl?: string | null; track: string; artist: string }; index: number; selected?: boolean; onPress?: () => void }) {
  const theme = useAppTheme();
  const styles = useThemedStyles(darkStyles);

  return <Pressable accessibilityLabel={`Show ${track.track} on the journey map`} accessibilityState={{ selected }} onPress={onPress} style={({ pressed }) => [styles.trackRow, selected && styles.trackRowSelected, pressed && styles.pressed]}><Text style={[styles.trackIndex, selected && styles.trackIndexSelected]}>{String(index).padStart(2, '0')}</Text><Artwork track={track} size={48} /><View style={styles.flex}><Text style={styles.trackTitle} numberOfLines={1}>{track.track}</Text><Text style={styles.trackArtist} numberOfLines={1}>{track.artist}</Text></View><SymbolView name={selected ? 'map.fill' : 'map'} tintColor={selected ? theme.palette.accent : theme.palette.muted} style={styles.trackMapIcon} /></Pressable>;
}

function EmptyCard({ title, body }: { title: string; body: string }) {
  const styles = useThemedStyles(darkStyles);

  return <View style={styles.emptyCard}><NeonWidgetOutline radius={20} /><View style={styles.emptyCircle}><Text style={styles.emptyCircleText}>J</Text></View><Text style={styles.emptyTitle}>{title}</Text><Text style={styles.emptyBody}>{body}</Text></View>;
}

function InlineNotice({ message, onRetry }: { message: string; onRetry: () => void }) {
  const styles = useThemedStyles(darkStyles);

  return <View style={styles.inlineNotice}><NeonWidgetOutline radius={15} /><View style={styles.noticeDot} /><Text style={styles.inlineNoticeText}>{message}</Text><Pressable onPress={onRetry}><Text style={styles.retryText}>Retry</Text></Pressable></View>;
}

function LoadingLine({ label }: { label: string }) {
  const theme = useAppTheme();
  const styles = useThemedStyles(darkStyles);
 return <View style={styles.loadingLine}><ActivityIndicator color={theme.color("#9b7cff", 'text')} /><Text style={styles.loadingLineText}>{label}</Text></View>; }
function LoadingCard() {
  return <JourneyListSkeleton />;
}

function RouteSketch({ coordinates, soundtrack, startedAt, endedAt, startLabel, endLabel, cinematic = false, expanded = false }: { coordinates: [number, number][]; soundtrack: JourneyDetail['soundtrack']; startedAt: string; endedAt: string; startLabel: string | null; endLabel: string | null; cinematic?: boolean; expanded?: boolean }) {
  const theme = useAppTheme();
  const mapPalette = journeyDeckMapPalette(theme.id);
  const routeVisualStyles = useThemedStyles(darkRouteVisualStyles);
  const styles = useThemedStyles(darkStyles);

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
    <LinearGradient colors={theme.gradient(['#211233', '#101525', '#0a0a13'] as const)} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
    <View style={routeVisualStyles.routeGridOne} /><View style={routeVisualStyles.routeGridTwo} /><View style={routeVisualStyles.routeGlow} /><View style={routeVisualStyles.routeAurora} />
    {points.length > 1 ? <Reanimated.View entering={FadeIn.duration(420)} style={routeVisualStyles.routeSnapshot}>
      {snapshotTiles.map(tile => <ExpoImage key={tile.key} source={tile.uri} cachePolicy="memory-disk" contentFit="cover" transition={0} style={[routeVisualStyles.routeTile, { left: `${tile.column * 33.333}%`, top: `${tile.row * 33.333}%` }]} />)}
      <View pointerEvents="none" style={routeVisualStyles.routeTileShade} />
      <View pointerEvents="none" style={routeVisualStyles.routeCanvas}><Svg width="100%" height="100%" viewBox={`0 0 ${snapshotSize} ${snapshotSize}`}>
        <Defs><SvgLinearGradient id="journeyRoute" x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor={theme.id === 'redline' ? mapPalette.routeLine : theme.color("#45efc0", 'accent')} /><Stop offset="0.5" stopColor={theme.id === 'redline' ? mapPalette.routeLine : theme.color("#a681ff", 'accent')} /><Stop offset="1" stopColor={theme.id === 'redline' ? mapPalette.routeLine : theme.color("#ff765c", 'accent')} /></SvgLinearGradient></Defs>
        <Polyline points={mapPolyline || polyline} fill="none" stroke={theme.id === 'redline' ? mapPalette.routeGlow : theme.color("#8e6dff", 'accent')} strokeWidth="18" strokeLinecap="round" strokeLinejoin="round" opacity="0.38" />
        <Polyline points={mapPolyline || polyline} fill="none" stroke="url(#journeyRoute)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
        {worldPoints[0] && <><Circle cx={worldPoints[0].x - tileOriginX * tileSize} cy={worldPoints[0].y - tileOriginY * tileSize} r="12" fill={theme.color("#43e6ae", 'accent')} opacity="0.28" /><Circle cx={worldPoints[0].x - tileOriginX * tileSize} cy={worldPoints[0].y - tileOriginY * tileSize} r="6" fill={theme.color("#43e6ae", 'accent')} stroke={theme.color("#d9fff1", 'accent')} strokeWidth="2" /></>}
        {worldPoints.at(-1) && <><Circle cx={worldPoints.at(-1)!.x - tileOriginX * tileSize} cy={worldPoints.at(-1)!.y - tileOriginY * tileSize} r="15" fill={theme.color("#ff795b", 'accent')} opacity="0.3" /><Circle cx={worldPoints.at(-1)!.x - tileOriginX * tileSize} cy={worldPoints.at(-1)!.y - tileOriginY * tileSize} r="7" fill={theme.color("#ff795b", 'accent')} stroke={theme.color("#fff0e8", 'accent')} strokeWidth="2" /></>}
        {fallbackSongPoints.map((moment, index) => <Circle key={`${moment.playedAt}-${index}`} cx={moment.x} cy={moment.y} r="8" fill={theme.color("#ff69b4", 'accent')} stroke={theme.color("#fff1fa", 'accent')} strokeWidth="3" />)}
      </Svg></View>
    </Reanimated.View> : <View style={routeVisualStyles.routeAwaiting}><Text style={routeVisualStyles.routeAwaitingSymbol}>⌁</Text><Text style={routeVisualStyles.routeAwaitingText}>Route will appear after the journey syncs</Text></View>}
    {!cinematic && <><View style={routeVisualStyles.routeLegend}><View style={routeVisualStyles.routeLegendItem}><View style={[routeVisualStyles.routeLegendDot, routeVisualStyles.routeLegendStart]} /><Text style={routeVisualStyles.routeLegendText} numberOfLines={1}>{startLabel}</Text></View><View style={routeVisualStyles.routeLegendItem}><View style={[routeVisualStyles.routeLegendDot, routeVisualStyles.routeLegendEnd]} /><Text style={routeVisualStyles.routeLegendText} numberOfLines={1}>{endLabel}</Text></View></View>
    <Text pointerEvents="none" style={styles.routeCaption}>{points.length > 1 ? `${valid.length} GPS points · ${songMoments.length} song markers · OpenFreeMap / © OpenStreetMap` : 'OFFLINE-SAFE ROUTE PREVIEW'}</Text></>}
  </View>;
}

function InfoRow({ label, value }: { label: string; value: string }) {
  const styles = useThemedStyles(darkStyles);
 return <View style={styles.infoRow}><Text style={styles.infoLabel}>{label}</Text><Text style={styles.infoValue}>{value}</Text></View>; }

function ConnectionTile({ name, detail, symbol, brand, mark, color, status, action, onPress }: { name: string; detail: string; symbol: string; brand?: ProviderBrand; mark?: ReactNode; color: string; status: string; action: string; onPress: () => void }) {
  const theme = useAppTheme();
  const styles = useThemedStyles(darkStyles);

  return <Pressable onPress={onPress} style={({ pressed }) => [styles.connectionTile, styles.staticWidgetGlow, pressed && styles.pressed]}><View pointerEvents="none" style={[styles.connectionEdge, { backgroundColor: theme.color(color, 'surface') }]} />{mark ?? (brand ? <ProviderMark brand={brand} size={46} /> : <View style={[styles.connectionIcon, { backgroundColor: theme.color(color, 'surface'), shadowColor: theme.color(color, 'shadow') }]}><Text style={styles.connectionIconText}>{symbol}</Text></View>)}<View style={styles.flex}><Text style={styles.connectionName}>{name}</Text><Text style={styles.connectionDetail}>{detail}</Text><Text style={[styles.connectionStatus, status === 'Connected' || status === 'Enabled' || status.startsWith('Connected through') ? styles.goodStatus : undefined]}>{status}</Text></View><View style={styles.connectionAction}><Text style={styles.connectionActionText}>{action}</Text></View></Pressable>;
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
function formatTrackTime(value: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return ` · ${date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`;
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
function locationPair(journey: Pick<JourneySummary, 'startedAt' | 'startingLocation' | 'endingLocation'>) {
  return journeyDisplayTitle(journey);
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

const darkRouteVisualStyles = StyleSheet.create({
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

const darkPageSceneStyles = StyleSheet.create({
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

const darkStyles = StyleSheet.create({
  staticWidgetGlow: { borderColor: '#684184', shadowColor: '#a85cff', shadowOpacity: 0.28, shadowRadius: 16, shadowOffset: { width: 0, height: 7 } },
  atmosphere: { position: 'absolute', top: -40, left: -20, right: -20, height: 1420 },
  app: { flex: 1, backgroundColor: '#08070d' }, screenBody: { flex: 1, overflow: 'hidden' }, primaryTabHost: { flex: 1, backgroundColor: '#08070d' }, pager: { flex: 1, backgroundColor: '#08070d' }, settingsTabLayer: { ...StyleSheet.absoluteFill, zIndex: 5, backgroundColor: '#08070d' }, settingsTabLayerHidden: { display: 'none' }, tabLayer: { flex: 1, overflow: 'hidden', backgroundColor: '#08070d' }, tabTransitionLayer: { flex: 1, backgroundColor: '#08070d' }, utilityOverlay: { ...StyleSheet.absoluteFill, zIndex: 60, backgroundColor: '#08070d' }, persistentRecorderVisible: { ...StyleSheet.absoluteFill, zIndex: 50 }, persistentRecorderHidden: { ...StyleSheet.absoluteFill, opacity: 0, zIndex: -1 }, flex: { flex: 1 }, safe: { flex: 1, backgroundColor: '#08070d' },
  loadingScreen: { flex: 1, backgroundColor: '#08070d', alignItems: 'center', justifyContent: 'center', gap: 14 }, loadingText: { color: '#b8afc5', fontSize: 14 },
  pageContent: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 128, gap: 16 }, settingsRootContent: { paddingHorizontal: 16 },
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
  overlayKeyboardAvoider: { flex: 1 }, overlayRoot: { flex: 1, justifyContent: 'flex-end', backgroundColor: '#030106cc' }, overlaySheet: { maxHeight: '94%', margin: 8, overflow: 'hidden', borderRadius: 28, borderWidth: 1, borderColor: '#5d4273', backgroundColor: '#0a0710', shadowColor: '#000', shadowOpacity: 0.85, shadowRadius: 30, shadowOffset: { width: 0, height: -8 } }, overlayHeader: { minHeight: 74, flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 18, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#382641' }, overlayHeaderActions: { flexDirection: 'row', alignItems: 'center', gap: 8 }, overlayKeyboardDone: { minHeight: 34, borderRadius: 17, borderWidth: 1, borderColor: '#704d80', backgroundColor: '#211329', paddingHorizontal: 13, alignItems: 'center', justifyContent: 'center' }, overlayKeyboardDoneText: { color: '#ff9b7c', fontSize: 11, fontWeight: '900' }, overlayKicker: { color: '#ff795b', fontSize: 8, fontWeight: '900', letterSpacing: 1.5 }, overlayTitle: { color: '#f7f1fa', fontSize: 21, fontWeight: '900', marginTop: 3 }, overlayClose: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#4b3758', backgroundColor: '#17101f' }, overlayCloseText: { color: '#d7c9df', fontSize: 27, lineHeight: 29 }, overlayContent: { padding: 16, paddingBottom: 26, gap: 14 },
  overviewHero: { height: 260, overflow: 'hidden', borderRadius: 22, borderWidth: 1, borderColor: '#593c70', backgroundColor: '#171021' }, overviewCollectionHero: { height: 230, overflow: 'hidden', borderRadius: 22, borderWidth: 1, borderColor: '#593c70', backgroundColor: '#171021' }, overviewCollectionImage: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }, overviewCollectionFallback: { backgroundColor: '#241433' }, overviewHeroCopy: { position: 'absolute', left: 20, right: 20, bottom: 19 }, overviewEyebrow: { color: '#ff9a79', fontSize: 8, fontWeight: '900', letterSpacing: 1.4 }, overviewHeroTitle: { color: '#fff8ff', fontSize: 29, lineHeight: 33, fontWeight: '900', letterSpacing: -0.7, marginTop: 6 }, overviewMetrics: { flexDirection: 'row', overflow: 'hidden', borderRadius: 17, borderWidth: 1, borderColor: '#352b40', backgroundColor: '#111018' }, overviewMetric: { flex: 1, minHeight: 70, alignItems: 'center', justifyContent: 'center', borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: '#342b3d' }, overviewMetricValue: { color: '#f7f2fb', fontSize: 19, fontWeight: '900' }, overviewMetricLabel: { color: '#81758b', fontSize: 7, fontWeight: '900', letterSpacing: 1, marginTop: 5 }, overviewBody: { color: '#c7bdce', fontSize: 13, lineHeight: 20 }, overviewBodyMuted: { color: '#857d8d', fontSize: 12, lineHeight: 18, fontStyle: 'italic' }, overviewSectionLabel: { color: '#a88aff', fontSize: 8, fontWeight: '900', letterSpacing: 1.4, marginTop: 3 }, overviewListRow: { minHeight: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingHorizontal: 13, borderRadius: 14, borderWidth: 1, borderColor: '#30283a', backgroundColor: '#111018' }, overviewListTitle: { color: '#eee8f3', fontSize: 13, fontWeight: '800' }, overviewListMeta: { color: '#8c8295', fontSize: 10, marginTop: 3 }, overviewChevron: { color: '#a88aff', fontSize: 24 }, overviewActions: { flexDirection: 'row', gap: 9, marginTop: 4 }, overviewShare: { flex: 1, minHeight: 50, alignItems: 'center', justifyContent: 'center', borderRadius: 15, borderWidth: 1, borderColor: '#65468a', backgroundColor: '#20152e' }, overviewShareText: { color: '#c2a7ff', fontSize: 12, fontWeight: '900' }, overviewPrimary: { flex: 1.25, minHeight: 50, alignItems: 'center', justifyContent: 'center', borderRadius: 15, backgroundColor: '#ff795b' }, overviewPrimaryText: { color: '#1b0b07', fontSize: 12, fontWeight: '900' }, modalEditorBody: { gap: 12 }, journeyActions: { flexDirection: 'row', gap: 9, marginTop: 6 }, journeyShareButton: { flex: 1, minHeight: 54, alignItems: 'center', justifyContent: 'center', borderRadius: 16, borderWidth: 1, borderColor: '#65468a', backgroundColor: '#20152e' }, journeyShareButtonText: { color: '#c7adff', fontSize: 12, fontWeight: '900', textAlign: 'center' }, journeyEditButton: { flex: 1, minHeight: 54, alignItems: 'center', justifyContent: 'center', borderRadius: 16, backgroundColor: '#ff795b' }, journeyEditButtonText: { color: '#1b0b07', fontSize: 12, fontWeight: '900' },
  locationEditor: { gap: 11, marginTop: 6, padding: 14, borderRadius: 18, borderWidth: 1, borderColor: '#4e3b60', backgroundColor: '#100d16' }, locationEditorKicker: { color: '#b99cff', fontSize: 9, fontWeight: '900', letterSpacing: 1.4 }, locationEditorHelp: { color: '#9b91a4', fontSize: 11, lineHeight: 17 }, locationField: { gap: 5 }, locationFieldLabel: { color: '#ff9a79', fontSize: 8, fontWeight: '900', letterSpacing: 1.2 }, locationRaw: { color: '#6f6877', fontSize: 9, lineHeight: 13, paddingHorizontal: 3 },
  memoryPageHeader: { marginHorizontal: 16, marginBottom: 6 },
  memoryHeroCardHeader: { width: '100%', aspectRatio: HEADER_ARTWORK_ASPECT_RATIO, borderRadius: 24, overflow: 'hidden', backgroundColor: '#07040d', shadowColor: '#9b61ff', shadowOpacity: 0.45, shadowRadius: 24, shadowOffset: { width: 0, height: 8 } },
  memoryHeroHeaderImage: { width: '100%', height: '100%' },
  memorySectionHeader: { marginHorizontal: 20, marginTop: 5, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }, memoryLevel: { color: '#a88aff', fontSize: 9, fontWeight: '900', letterSpacing: 1.8 }, memorySectionTitle: { color: '#f5f0fb', fontSize: 19, fontWeight: '900', marginTop: 4 }, memoryHeaderActions: { flexDirection: 'row', alignItems: 'center', gap: 12 }, memoryHeaderAction: { color: '#ff8767', fontSize: 11, fontWeight: '900' },
  memoryCarouselContent: { paddingHorizontal: 20, paddingBottom: 12, gap: 14 }, memoryHeroCard: { height: 244, borderRadius: 26, overflow: 'hidden', backgroundColor: '#14101e', borderWidth: 1, borderColor: '#4c375d', padding: 20, justifyContent: 'flex-end', shadowColor: '#9b7cff', shadowOpacity: 0.25, shadowRadius: 18 }, memoryEmptyHero: { marginHorizontal: 20 }, memoryCardShade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 92 }, memoryHeroShade: { position: 'absolute', left: 0, right: 0, top: 100, bottom: 0, backgroundColor: '#09071099' }, memoryHeroKicker: { color: '#ff9b7c', fontSize: 9, fontWeight: '900', letterSpacing: 1.5 }, memoryHeroTitle: { color: '#fff8ff', fontSize: 29, lineHeight: 34, fontWeight: '900', marginTop: 7, letterSpacing: -0.7 }, memoryCardTitle: { marginTop: 0, textShadowColor: '#08040dcc', textShadowRadius: 8 }, memoryHeroMeta: { color: '#c2b7ca', fontSize: 12, fontWeight: '700', marginTop: 7 }, memoryCardMeta: { marginTop: 2, textShadowColor: '#08040ddd', textShadowRadius: 6 }, memoryDots: { minHeight: 8, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6 }, memoryDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#403748' }, memoryDotActive: { width: 24, backgroundColor: '#ff795b' },
  memoryArtwork: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: '#241433', overflow: 'hidden' }, memoryArtworkNight: { backgroundColor: '#0b1630' },
  memoryEditor: { marginHorizontal: 20, backgroundColor: '#121019', borderRadius: 22, borderWidth: 1, borderColor: '#604779', padding: 16, gap: 10 }, collectionEditor: { marginHorizontal: 20, backgroundColor: '#111018', borderRadius: 20, borderWidth: 1, borderColor: '#4a365c', padding: 15, gap: 10 }, editorKicker: { color: '#b693ff', fontSize: 9, fontWeight: '900', letterSpacing: 1.5 }, editorInput: { minHeight: 48, borderRadius: 13, borderWidth: 1, borderColor: '#3b3148', backgroundColor: '#0c0a11', color: '#f5f0f8', fontSize: 14, paddingHorizontal: 13, paddingVertical: 11 }, editorNotes: { minHeight: 76, textAlignVertical: 'top' }, editorInstruction: { color: '#8e8497', fontSize: 11, fontWeight: '800', letterSpacing: 1.1, marginTop: 3 }, editorDelete: { minHeight: 48, borderRadius: 12, borderWidth: 1, borderColor: '#6f303b', backgroundColor: '#261116', alignItems: 'center', justifyContent: 'center', marginTop: 10 }, editorDeleteText: { color: '#ff8f9d', fontSize: 12, fontWeight: '900' }, editorActions: { flexDirection: 'row', gap: 9 }, editorCancel: { flex: 1, minHeight: 50, borderRadius: 13, borderWidth: 1, borderColor: '#3b3345', alignItems: 'center', justifyContent: 'center' }, editorCancelText: { color: '#b5acbd', fontSize: 12, fontWeight: '800' }, editorSave: { flex: 1.4, minHeight: 50, borderRadius: 13, backgroundColor: '#ff795b', alignItems: 'center', justifyContent: 'center' }, editorSaveSaved: { opacity: 0.42 }, editorSaveText: { color: '#1b0b07', fontSize: 12, fontWeight: '900', letterSpacing: 0.55 },
  photoEditorHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 5 }, photoEditorHelp: { color: '#8e8497', fontSize: 10, lineHeight: 15, marginTop: 4 }, photoAddButton: { minHeight: 36, borderRadius: 999, backgroundColor: '#281b39', borderWidth: 1, borderColor: '#684b8c', paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' }, photoAddDisabled: { opacity: 0.42 }, photoAddText: { color: '#c5a5ff', fontSize: 9, fontWeight: '900' }, photoSaveFirst: { color: '#ffad7f', fontSize: 10, lineHeight: 14 }, photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 }, photoTile: { width: '31%', aspectRatio: 0.86, borderRadius: 14, overflow: 'visible', borderWidth: 2, borderColor: 'transparent' }, photoTileSelected: { borderColor: '#ff795b', shadowColor: '#ff795b', shadowOpacity: 0.4, shadowRadius: 8 }, photoTileImage: { width: '100%', height: '100%', borderRadius: 12, overflow: 'hidden' }, photoTileShade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 38, backgroundColor: '#08060bbb' }, photoTileLabel: { position: 'absolute', left: 7, right: 7, bottom: 8, color: '#fff5fb', fontSize: 7, fontWeight: '900', letterSpacing: 0.7 }, photoRemove: { position: 'absolute', right: -7, top: -7, width: 24, height: 24, borderRadius: 12, backgroundColor: '#32151b', borderWidth: 1, borderColor: '#ff795b', alignItems: 'center', justifyContent: 'center' }, photoRemoveText: { color: '#ff9c89', fontSize: 18, lineHeight: 20, fontWeight: '700' }, photoLoading: { backgroundColor: '#1b1524', alignItems: 'center', justifyContent: 'center' }, photoEmpty: { minHeight: 72, borderRadius: 14, borderWidth: 1, borderStyle: 'dashed', borderColor: '#3b3148', backgroundColor: '#0c0a11', padding: 12, justifyContent: 'center' }, photoEmptyTitle: { color: '#d3c6dc', fontSize: 11, fontWeight: '800' }, photoEmptyBody: { color: '#7f7488', fontSize: 9, lineHeight: 14, marginTop: 4 },
  membershipRow: { minHeight: 58, borderRadius: 14, borderWidth: 1, borderColor: '#302839', backgroundColor: '#0d0b12', flexDirection: 'row', alignItems: 'center', gap: 10, padding: 11 }, membershipRowSelected: { borderColor: '#6e4f91', backgroundColor: '#191124' }, membershipCheck: { width: 27, height: 27, borderRadius: 14, borderWidth: 1, borderColor: '#5c5067', alignItems: 'center', justifyContent: 'center' }, membershipCheckSelected: { borderColor: '#43e6ae', backgroundColor: '#123128' }, membershipCheckText: { color: '#a995ba', fontWeight: '900' }, membershipTitle: { color: '#f0eaf5', fontSize: 12, fontWeight: '800' }, membershipDetail: { color: '#7e7487', fontSize: 9, marginTop: 3 }, membershipAction: { color: '#9d7de3', fontSize: 9, fontWeight: '900' }, membershipActionRemove: { color: '#ff9a7b' },
  memoryCollectionCard: { marginHorizontal: 20, minHeight: 98, borderRadius: 20, borderWidth: 1, borderColor: '#2e2738', backgroundColor: '#111018', padding: 13, flexDirection: 'row', alignItems: 'center', gap: 12 }, collectionArtwork: { width: 68, height: 68, borderRadius: 16, overflow: 'hidden' }, collectionKicker: { color: '#89779c', fontSize: 8, fontWeight: '900', letterSpacing: 1.2 }, collectionTitle: { color: '#f5eff9', fontSize: 15, fontWeight: '900', marginTop: 5 }, collectionMeta: { color: '#8b8293', fontSize: 10, lineHeight: 14, marginTop: 4 }, collectionManage: { borderRadius: 999, backgroundColor: '#251934', paddingHorizontal: 9, paddingVertical: 7 }, collectionManageText: { color: '#bc96ff', fontSize: 8, fontWeight: '900' }, managingPill: { color: '#66efc2', fontSize: 8, fontWeight: '900', letterSpacing: 1, borderWidth: 1, borderColor: '#295f4e', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 6 }, journeyManageHelp: { marginHorizontal: 20, color: '#948a9e', fontSize: 11, lineHeight: 17 }, memoryJourneyList: { marginHorizontal: 20, gap: 8 }, journeyMembershipButton: { minHeight: 40, borderRadius: 12, borderWidth: 1, borderColor: '#5d4380', backgroundColor: '#1b1327', alignItems: 'center', justifyContent: 'center' }, journeyMembershipRemove: { borderColor: '#704037', backgroundColor: '#29130f' }, journeyMembershipText: { color: '#c3a5ff', fontSize: 10, fontWeight: '900' }, journeyMembershipRemoveText: { color: '#ff9c80' },
  memoryRoadThreadAligned: { position: 'absolute', zIndex: 0, left: 0, top: 0, width: 32 },
  memoryDetailChaptersAligned: { gap: 18, paddingLeft: 44 },
  memoryDetailStoryPane: { gap: 18 }, memoryDetailJourneysPane: { gap: 12, marginTop: 8 }, memoryDetailJourneyList: { marginHorizontal: 0, gap: 12 },
  memoryDetailRoadPinAligned: { position: 'absolute', zIndex: 4, left: -40, top: 40, shadowColor: '#ff7357', shadowOpacity: 0.9, shadowRadius: 10 },
  memoryDetailRoot: { flex: 1, backgroundColor: 'rgba(3, 2, 6, 0.54)' }, memoryDetailBackdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }, memoryDetailSheet: { flex: 1, overflow: 'hidden', borderWidth: 1, borderColor: '#6a3f71', borderTopLeftRadius: 30, borderTopRightRadius: 30, shadowColor: '#000', shadowOpacity: 0.58, shadowRadius: 28, shadowOffset: { width: 0, height: -10 } }, memoryDetailSweep: { position: 'absolute', top: -120, bottom: -120, width: 155, transform: [{ rotate: '12deg' }] }, memoryDetailSweepGradient: { flex: 1 }, memoryDetailHeader: { position: 'relative', zIndex: 4, height: 42, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, memoryDetailClose: { width: 34, height: 34, borderRadius: 17, borderWidth: 1, borderColor: '#7d617d', backgroundColor: '#180e1dd1', alignItems: 'center', justifyContent: 'center' }, memoryDetailCloseText: { color: '#f6eff8', fontSize: 30, lineHeight: 31, marginTop: -3, fontWeight: '300' }, memoryDetailHeaderActions: { flexDirection: 'row', gap: 8 }, memoryDetailHeaderAction: { minHeight: 30, paddingHorizontal: 11, borderRadius: 15, borderWidth: 1, borderColor: '#6d4c79', backgroundColor: '#1c1025d9', alignItems: 'center', justifyContent: 'center' }, memoryDetailHeaderActionText: { color: '#ecd7ff', fontSize: 10, fontWeight: '900' }, memoryDetailContent: { position: 'relative', paddingHorizontal: 20, paddingTop: 9, paddingBottom: 38, gap: 12 }, memoryDetailHero: { height: 278, borderRadius: 28, overflow: 'hidden', borderWidth: 1, borderColor: '#83536f', backgroundColor: '#21142b', justifyContent: 'flex-end', shadowColor: '#ff765c', shadowOpacity: 0.25, shadowRadius: 25, shadowOffset: { width: 0, height: 12 } }, memoryDetailHeroImage: { width: '100%', height: '100%' }, memoryDetailHeroGlowOne: { position: 'absolute', width: 190, height: 190, borderRadius: 95, backgroundColor: '#ff765c', opacity: 0.17, right: -65, top: -82, shadowColor: '#ff765c', shadowOpacity: 0.8, shadowRadius: 28 }, memoryDetailHeroGlowTwo: { position: 'absolute', width: 155, height: 155, borderRadius: 78, backgroundColor: '#9d75ff', opacity: 0.16, left: -58, bottom: -80 }, memoryDetailHeroContent: { padding: 20, paddingTop: 64 }, memoryDetailKicker: { color: '#ffad8b', fontSize: 9, fontWeight: '900', letterSpacing: 2.1 }, memoryDetailTitle: { color: '#fff9ff', fontSize: 31, lineHeight: 35, fontWeight: '900', letterSpacing: -1, marginTop: 5 }, memoryDetailMeta: { color: '#ddd0df', fontSize: 12, fontWeight: '700', marginTop: 7 }, memoryStory: { gap: 7, paddingTop: 2 }, memoryDetailNotes: { color: '#d0c4d4', fontSize: 14, lineHeight: 21 }, memoryDetailSection: { color: '#ff987c', fontSize: 10, fontWeight: '900', letterSpacing: 2.1, marginTop: 8 }, memoryPhotoHeader: { minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, memoryPhotoHeaderAction: { minHeight: 40, paddingHorizontal: 10, justifyContent: 'center' }, memoryPhotoHeaderActionText: { color: '#c6a7ff', fontSize: 12, fontWeight: '800' }, memoryPhotoStrip: { gap: 10, paddingVertical: 2 }, memoryPhotoThumb: { width: 84, height: 84, borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: '#49364f' }, memoryPhotoThumbCover: { borderWidth: 2, borderColor: '#ff987c' }, memoryPhotoThumbImage: { width: '100%', height: '100%' }, memoryPhotoMatchRow: { minHeight: 64, borderRadius: 18, borderWidth: 1, borderColor: '#3a3044', backgroundColor: '#120d19', flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14 }, memoryPhotoMatchIcon: { width: 23, height: 23 }, memoryPhotoMatchTitle: { color: '#f4edf7', fontSize: 14, fontWeight: '800' }, memoryPhotoMatchBody: { color: '#938797', fontSize: 11, marginTop: 3 }, memoryPhotoMatchChevron: { color: '#c6a7ff', fontSize: 24 }, memoryDetailAtlas: { position: 'relative' }, memoryRoadThread: { position: 'absolute', zIndex: 0, left: -3, top: -22, width: 82 }, memoryDetailChapters: { gap: 18, paddingLeft: 43 }, memoryChapterWrap: { position: 'relative' }, memoryDetailRoadNode: { position: 'absolute', zIndex: 4, width: 18, height: 18, borderRadius: 9, left: -51, top: 50, backgroundColor: '#ffb18f', borderWidth: 4, borderColor: '#321832', shadowColor: '#ff7357', shadowOpacity: 1, shadowRadius: 12 }, memoryChapterCard: { borderWidth: 1, borderColor: '#684558', borderRadius: 23, backgroundColor: '#16101b', overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.28, shadowRadius: 16, shadowOffset: { width: 0, height: 8 } }, memoryChapterHeader: { minHeight: 112, padding: 13, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#1c1221' }, memoryChapterArtwork: { width: 92, height: 82, borderRadius: 17, overflow: 'hidden', borderWidth: 1, borderColor: '#a16d75' }, memoryChapterKicker: { color: '#c6a1d0', fontSize: 7, fontWeight: '900', letterSpacing: 1.2 }, memoryChapterTitle: { color: '#fff8ff', fontSize: 18, lineHeight: 21, fontWeight: '900', marginTop: 4 }, memoryChapterMeta: { color: '#b4a5b7', fontSize: 9, marginTop: 6, lineHeight: 13 }, memoryChapterOpen: { width: 35, height: 35, borderRadius: 18, backgroundColor: '#361d2e', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#633849' }, memoryChapterOpenText: { color: '#ff9a78', fontSize: 19, fontWeight: '900' }, memoryChapterJourneys: { padding: 10, gap: 8, backgroundColor: '#100c14' }, memoryChapterJourney: { minHeight: 67, borderRadius: 14, backgroundColor: '#1b1520', overflow: 'hidden', flexDirection: 'row', alignItems: 'center', gap: 10, paddingRight: 9, borderWidth: 1, borderColor: '#322638' }, memoryChapterJourneyVisual: { width: 74, alignSelf: 'stretch', overflow: 'hidden', backgroundColor: '#2a1930' }, memoryChapterJourneyImage: { width: '100%', height: '100%' }, memoryChapterJourneyIndex: { position: 'absolute', left: 7, top: 7, zIndex: 2, width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#ff9b7c', shadowColor: '#ff795b', shadowOpacity: 0.7, shadowRadius: 5 }, memoryChapterJourneyIndexText: { color: '#240d0b', fontSize: 9, fontWeight: '900' }, memoryChapterJourneyRoute: { color: '#f5edf5', fontSize: 11, fontWeight: '900' }, memoryChapterJourneyMeta: { color: '#a197a5', fontSize: 8, marginTop: 4 }, memoryChapterEmpty: { color: '#8e8293', fontSize: 10, lineHeight: 16, padding: 12, backgroundColor: '#100c14' }, memoryChapterMore: { minHeight: 38, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#4a3047', backgroundColor: '#171019' }, memoryChapterMoreText: { color: '#d0adff', fontSize: 9, fontWeight: '900' }, memoryChapterMoreArrow: { color: '#ff9c7d', fontSize: 18, lineHeight: 18 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 4 }, brandCompact: { marginBottom: 14 }, brandWordmark: { color: '#f8f4ff', fontSize: 16, fontWeight: '900', letterSpacing: -0.25 }, wordmarkJourney: { color: '#f7f2fc' }, wordmarkDeck: { color: '#ff7b5c' }, brandTitle: { color: '#f8f4ff', fontSize: 20, fontWeight: '800', marginTop: 2 },
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
  journeyHeroCard: { overflow: 'hidden', borderRadius: 25, backgroundColor: '#100c16', borderWidth: 1, borderColor: '#4c3659', shadowColor: '#7c4da4', shadowOpacity: 0.28, shadowRadius: 22, shadowOffset: { width: 0, height: 10 } }, journeyHeroIntro: { position: 'relative', minHeight: 125, overflow: 'hidden', justifyContent: 'flex-end', paddingHorizontal: 18, paddingTop: 26, paddingBottom: 19 }, journeyHeroCopy: { position: 'relative' }, journeyHeroDate: { color: '#ff9b7d', fontSize: 9, fontWeight: '900', letterSpacing: 1.35, textShadowColor: '#170b1a', textShadowRadius: 7 }, journeyHeroRoute: { color: '#fff8ff', fontSize: 24, lineHeight: 27, fontWeight: '900', letterSpacing: -0.65, marginTop: 5, textShadowColor: '#170b1a', textShadowRadius: 11 }, journeyHeroMetrics: { minHeight: 76, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', backgroundColor: '#17101e', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#45334f', paddingHorizontal: 6 }, journeyHeroMetric: { flex: 1, minWidth: 0, alignItems: 'center', gap: 4 }, journeyHeroMetricValue: { color: '#f8f1fb', fontSize: 16, fontWeight: '900', fontVariant: ['tabular-nums'] }, journeyHeroMetricLabel: { color: '#9c879f', fontSize: 8, fontWeight: '900', letterSpacing: 0.8 }, journeyHeroMetricDivider: { width: StyleSheet.hairlineWidth, height: 33, backgroundColor: '#55405d' }, journeyHeroSoundtrack: { minHeight: 82, flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 14, paddingVertical: 12, backgroundColor: '#120d1a' }, journeyHeroArtworkFallback: { width: 54, height: 54, borderRadius: 13, backgroundColor: '#2b1c3c', alignItems: 'center', justifyContent: 'center' }, journeyHeroArtworkNote: { color: '#d3b9ff', fontSize: 23, fontWeight: '900' }, journeyHeroSoundtrackLabel: { color: '#bd9dff', fontSize: 8, fontWeight: '900', letterSpacing: 1.15 }, journeyHeroTrack: { color: '#f9f2fb', fontSize: 15, fontWeight: '900', marginTop: 4 }, journeyHeroArtist: { color: '#a096a9', fontSize: 11, fontWeight: '700', marginTop: 3 }, journeyHeroSongCount: { minWidth: 35, alignItems: 'center', gap: 2 }, journeyHeroSongCountValue: { color: '#ff9677', fontSize: 17, fontWeight: '900', fontVariant: ['tabular-nums'] }, journeyHeroSongCountLabel: { color: '#8f788f', fontSize: 7, fontWeight: '900', letterSpacing: 0.7 },
  trackRow: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 8, paddingHorizontal: 8, marginHorizontal: -8, borderRadius: 14, borderWidth: 1, borderColor: 'transparent' }, trackRowSelected: { backgroundColor: '#201329', borderColor: '#6e3c79' }, trackIndex: { width: 21, color: '#696272', fontSize: 10, fontWeight: '700', fontVariant: ['tabular-nums'] }, trackIndexSelected: { color: '#ff967a' }, trackTitle: { color: '#eee9f3', fontSize: 13, fontWeight: '800' }, trackArtist: { color: '#837b8c', fontSize: 11, marginTop: 4 }, trackMapIcon: { width: 20, height: 20 }, infoCard: { backgroundColor: '#121019', borderRadius: 18, paddingHorizontal: 16 }, infoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 15, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#302a38' }, infoLabel: { color: '#776f81', fontSize: 9, fontWeight: '900', letterSpacing: 1 }, infoValue: { color: '#ece6f1', fontSize: 13, fontWeight: '700' },
  selectedProvider: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#15101e', borderWidth: 1, borderRadius: 21, padding: 15, shadowColor: '#673a87', shadowOpacity: 0.14, shadowRadius: 12, shadowOffset: { width: 0, height: 5 } }, membershipSettingsIcon: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }, membershipSettingsLogo: { width: 46, height: 46, borderRadius: 14 }, membershipSettingsIconText: { color: '#fff8fb', fontSize: 17, fontWeight: '900' }, connectionTile: { position: 'relative', overflow: 'hidden', flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#121019', borderWidth: 1, borderColor: '#34283f', borderRadius: 18, padding: 14, shadowColor: '#000', shadowOpacity: 0.16, shadowRadius: 10, shadowOffset: { width: 0, height: 5 } }, connectionEdge: { position: 'absolute', left: 0, top: 13, bottom: 13, width: 3, borderTopRightRadius: 3, borderBottomRightRadius: 3, opacity: 0.9 }, connectionIcon: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center', shadowOpacity: 0.34, shadowRadius: 9, shadowOffset: { width: 0, height: 4 } }, icloudMark: { width: 46, height: 46, borderRadius: 13, backgroundColor: '#f7fbff', borderWidth: 1, borderColor: '#b9dcff', alignItems: 'center', justifyContent: 'center', shadowColor: '#1687ff', shadowOpacity: 0.42, shadowRadius: 11, shadowOffset: { width: 0, height: 4 } }, connectionIconText: { color: '#fff', fontSize: 16, fontWeight: '900' }, connectionKicker: { color: '#9b8ba8', fontSize: 8, fontWeight: '900', letterSpacing: 1.2 }, connectionName: { color: '#f7f0fa', fontSize: 16, fontWeight: '900', marginTop: 2 }, connectionDetail: { color: '#9c90a4', fontSize: 11, lineHeight: 16, marginTop: 3 }, connectionStatus: { color: '#a195aa', fontSize: 10, fontWeight: '800', marginTop: 5 }, goodStatus: { color: '#55e9b5' }, connectionAction: { borderWidth: 1, borderColor: '#49335d', backgroundColor: '#21162e', borderRadius: 10, paddingHorizontal: 9, paddingVertical: 8 }, connectionActionText: { color: '#c7a9ff', fontSize: 9, fontWeight: '900' }, changeButton: { borderWidth: 1, borderColor: '#503766', paddingHorizontal: 11, paddingVertical: 8, borderRadius: 10, backgroundColor: '#241831' }, changeButtonText: { color: '#c7a9ff', fontSize: 11, fontWeight: '900' }, privateCloudCard: { backgroundColor: '#17121f', borderWidth: 1, borderColor: '#352746', borderRadius: 14, padding: 14, marginTop: 9 }, privateCloudTitle: { color: '#c7a9ff', fontSize: 9, fontWeight: '900', letterSpacing: 1.1 }, privateCloudBody: { color: '#a99eae', fontSize: 11, lineHeight: 17, marginTop: 5 }, privateCloudLearn: { color: '#c7a9ff', fontSize: 11, fontWeight: '900', marginTop: 9 }, appleSignInButton: { width: '100%', height: 46, marginTop: 10 }, appleSignInProgress: { height: 46, marginTop: 10, borderRadius: 12, backgroundColor: '#17121f', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 }, appleIdentityWarning: { color: '#ffb38e', fontSize: 11, lineHeight: 17, marginTop: 8, paddingHorizontal: 4 }, accountActions: { gap: 8, marginTop: 10 }, accountSecondaryButton: { minHeight: 44, borderRadius: 12, borderWidth: 1, borderColor: '#503766', backgroundColor: '#17121f', alignItems: 'center', justifyContent: 'center' }, accountSecondaryText: { color: '#c7a9ff', fontSize: 12, fontWeight: '900' }, accountDeleteButton: { minHeight: 44, borderRadius: 12, borderWidth: 1, borderColor: '#6e2d36', backgroundColor: '#241116', alignItems: 'center', justifyContent: 'center' }, accountDeleteText: { color: '#ff8c98', fontSize: 12, fontWeight: '900' }, securityCard: { backgroundColor: '#17121b', borderLeftWidth: 3, borderLeftColor: '#ff795b', borderRadius: 14, padding: 15, marginTop: 5 }, securityTitle: { color: '#ffc0ac', fontSize: 9, fontWeight: '900', letterSpacing: 1.2 }, securityBody: { color: '#a99eae', fontSize: 12, lineHeight: 18, marginTop: 5 },
  savedPlacesCard: { overflow: 'hidden', borderRadius: 19, borderWidth: 1, borderColor: '#553449', backgroundColor: '#141018' },
  savedPlacesHint: { color: '#a99eae', fontSize: 11, lineHeight: 16, paddingHorizontal: 15, paddingTop: 13, paddingBottom: 9 },
  savedPlaceRow: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14 },
  savedPlaceRowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#352937' },
  savedPlaceIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#2a1821', borderWidth: 1, borderColor: '#62363c' },
  savedPlaceName: { color: '#f7f0fa', fontSize: 14, fontWeight: '900' },
  savedPlaceStatus: { color: '#8e8496', fontSize: 10, marginTop: 3 },
  savedPlaceAction: { color: '#ff9a7c', fontSize: 11, fontWeight: '900' },
  savedPlacePrimary: { minHeight: 48, borderRadius: 14, backgroundColor: '#ff795b', alignItems: 'center', justifyContent: 'center' },
  savedPlacePrimaryText: { color: '#1b0b07', fontSize: 13, fontWeight: '900' },
  savedPlaceCurrent: { minHeight: 48, borderRadius: 14, borderWidth: 1, borderColor: '#503766', backgroundColor: '#21162e', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  savedPlaceCurrentText: { color: '#c7a9ff', fontSize: 12, fontWeight: '900' },
  setupCard: { gap: 11, backgroundColor: '#171019', borderWidth: 1, borderColor: '#713e58', borderRadius: 18, padding: 15, shadowColor: '#ff4f7d', shadowOpacity: 0.25, shadowRadius: 15, shadowOffset: { width: 0, height: 7 } }, setupTitle: { color: '#ff7b82', fontSize: 9, fontWeight: '900', letterSpacing: 1.2 }, setupBody: { color: '#9b929f', fontSize: 12, lineHeight: 18 }, setupInput: { minHeight: 48, borderRadius: 13, borderWidth: 1, borderColor: '#5d466b', backgroundColor: '#0e0c12', color: '#f4eef8', paddingHorizontal: 14, fontSize: 15, shadowColor: '#a85cff', shadowOpacity: 0.18, shadowRadius: 9 }, setupWarning: { color: '#ffb15c', fontSize: 11, lineHeight: 16 }, setupSync: { minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderWidth: 1, borderColor: '#7f4151', backgroundColor: '#281318', shadowColor: '#ff4f7d', shadowOpacity: 0.25, shadowRadius: 10 }, setupSyncText: { color: '#ff8c93', fontSize: 12, fontWeight: '900' }, setupActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 }, setupSecondary: { minHeight: 40, minWidth: 88, alignItems: 'center', justifyContent: 'center', borderRadius: 11, backgroundColor: '#241f29', shadowColor: '#a85cff', shadowOpacity: 0.18, shadowRadius: 8 }, setupSecondaryText: { color: '#a79daa', fontSize: 12, fontWeight: '800' }, setupPrimary: { minHeight: 40, minWidth: 88, alignItems: 'center', justifyContent: 'center', borderRadius: 11, backgroundColor: '#f23d47', shadowColor: '#ff4f65', shadowOpacity: 0.42, shadowRadius: 11 }, setupPrimaryText: { color: '#fff', fontSize: 12, fontWeight: '900' },
  // Keep the content readable until it reaches the dock; the dock itself remains crisp above this veil.
  bottomContentFade: { position: 'absolute', right: 0, bottom: 0, left: 0, height: 132, zIndex: 30 },
  navSafe: { position: 'absolute', right: 0, bottom: 0, left: 0, zIndex: 40, backgroundColor: 'transparent', paddingHorizontal: 10, paddingTop: 24 },
  navDockFrame: { marginBottom: 8, borderRadius: 25, shadowColor: '#000', shadowOpacity: 0.58, shadowRadius: 20, shadowOffset: { width: 0, height: 10 } },
  navDockAura: { position: 'absolute', top: -2, right: -2, bottom: -2, left: -2, borderRadius: 27, shadowColor: '#d147ff', shadowOpacity: 0.18, shadowRadius: 18, shadowOffset: { width: 0, height: 0 } },
  bottomNav: { minHeight: 64, borderRadius: 24, overflow: 'visible' },
  navMaterial: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, borderRadius: 24 },
  bottomNavFallback: { backgroundColor: 'rgba(22,10,31,0.94)' },
  navSurfaceTint: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(16,7,25,0.78)' },
  navSurfaceWarmWash: { position: 'absolute', top: 0, right: 0, bottom: 0, width: '42%', backgroundColor: 'rgba(96,27,42,0.08)' },
  navIntegratedChrome: { position: 'absolute', zIndex: 2, top: -23, right: 0, left: 0, height: 87, overflow: 'visible' },
  navTrack: { flex: 1, zIndex: 3, minHeight: 64, flexDirection: 'row', gap: 2, paddingHorizontal: 20, paddingTop: 0, paddingBottom: 6 },
  navGlassSheen: { position: 'absolute', zIndex: 3, top: 2, right: 27, left: 27, height: StyleSheet.hairlineWidth, borderRadius: 1, backgroundColor: 'rgba(255,255,255,0.18)' },
  navMotionAnchor: { position: 'absolute', top: 0, bottom: 0, left: 0, opacity: 0 },
  navGlidingIndicator: { position: 'absolute', zIndex: 0, top: 6, bottom: 6, left: 0, borderRadius: 18, shadowColor: '#ff713e', shadowOpacity: 0.36, shadowRadius: 10, shadowOffset: { width: 0, height: 0 } },
  navSelectionGlow: { position: 'absolute', top: -3, right: -3, bottom: -3, left: -3, borderRadius: 21, backgroundColor: 'rgba(255,100,56,0.10)' },
  navGlidingFill: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, overflow: 'hidden', borderRadius: 17, backgroundColor: 'rgba(106, 42, 29, 0.48)' },
  navItem: { position: 'relative', zIndex: 1, flex: 1, minHeight: 58, alignItems: 'center', justifyContent: 'center', gap: 2, paddingVertical: 3, borderRadius: 18 },
  navCenterPedestalRing: { position: 'absolute', top: 4, right: 4, bottom: 4, left: 4, borderRadius: 29, borderWidth: 1, borderColor: 'rgba(255,146,133,0.62)', alignItems: 'center', justifyContent: 'center' },
  navCenterPedestalCore: { width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(38,15,44,0.4)', alignItems: 'center', justifyContent: 'center' },
  navCenterItem: { zIndex: 4, flex: 1.5 },
  navItemPressed: { transform: [{ scale: 0.98 }], opacity: 0.88 },
  navSymbolFrame: { width: 29, height: 29, alignItems: 'center', justifyContent: 'center' },
  navCenterSymbolFrame: { position: 'absolute', top: -12, left: '50%', width: 66, height: 66, marginLeft: -33, borderRadius: 33, borderWidth: 1.1, borderColor: 'rgba(235,110,205,0.72)', backgroundColor: 'transparent', shadowColor: '#ff5878', shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 2 } },
  navCenterMedallionFill: { position: 'absolute', top: 1, right: 1, bottom: 1, left: 1, borderRadius: 32 },
  navCenterPermanentGlow: { position: 'absolute', width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,104,95,0.045)', shadowColor: '#ff755e', shadowOpacity: 0.42, shadowRadius: 8 },
  navSymbolFrameActive: { shadowColor: '#ff6730', shadowOpacity: 0.92, shadowRadius: 6, shadowOffset: { width: 0, height: 0 } },
  navSymbol: { width: 24, height: 24 },
  navCenterSymbol: { width: 32, height: 32 },
  navSymbolFallback: { color: '#a78db8', fontSize: 21, lineHeight: 24, fontWeight: '800' },
  navLabel: { color: '#c38cda', fontSize: 9.5, fontWeight: '600', letterSpacing: 0.02 },
  navActive: { color: '#ff9a5d', textShadowColor: 'rgba(255,95,47,0.72)', textShadowRadius: 6 },
  navActiveLine: { position: 'absolute', right: '26%', bottom: 0, left: '26%', height: 2, borderRadius: 2, backgroundColor: '#ff9a5d', shadowColor: '#ff6e3e', shadowOpacity: 0.82, shadowRadius: 5, shadowOffset: { width: 0, height: 0 } },
  welcomeIntroSafe: { flex: 1, backgroundColor: '#07060d' },
  welcomeIntroContent: { flex: 1, paddingHorizontal: 27, paddingTop: 19, paddingBottom: 24 },
  welcomeIntroBrand: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 42 }, welcomeIntroWordmark: { color: '#f8f4ff', fontSize: 18, fontWeight: '900', letterSpacing: -0.28 },
  welcomeIntroScene: { height: 286, marginTop: 24, borderRadius: 31, overflow: 'hidden', borderWidth: 1, borderColor: '#5c4b7d', justifyContent: 'flex-end', backgroundColor: '#060713' },
  welcomeIntroHero: { ...StyleSheet.absoluteFill },
  welcomeIntroSignal: { position: 'absolute', top: 16, left: 16, flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 14, backgroundColor: 'rgba(7, 6, 15, 0.72)', borderWidth: 1, borderColor: 'rgba(137, 116, 183, 0.52)' },
  welcomeIntroSignalDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#6ee4c0', shadowColor: '#6ee4c0', shadowOpacity: 0.92, shadowRadius: 7 },
  welcomeIntroSignalText: { color: '#d7c7f5', fontSize: 8, fontWeight: '900', letterSpacing: 1.2 },
  welcomeIntroTitle: { color: '#fbf8ff', fontFamily: 'Georgia', fontSize: 47, lineHeight: 49, letterSpacing: -1.4, marginTop: 27 },
  welcomeIntroBody: { color: '#b3aaba', fontSize: 15, lineHeight: 23, marginTop: 14, maxWidth: 350 },
  welcomeIntroPrivacy: { flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 18, paddingHorizontal: 13, paddingVertical: 11, borderRadius: 16, backgroundColor: 'rgba(82, 54, 112, 0.24)', borderWidth: 1, borderColor: 'rgba(171, 119, 255, 0.32)' },
  welcomeIntroPrivacyIcon: { color: '#bd8cff', fontSize: 19, lineHeight: 19 },
  welcomeIntroPrivacyText: { color: '#d6cbdf', fontSize: 12, fontWeight: '700', flex: 1 },
  welcomeIntroAction: { marginTop: 'auto', paddingTop: 18 },
  welcomeIntroFootnote: { color: '#777080', fontSize: 11, lineHeight: 16, marginTop: 13, textAlign: 'center', paddingHorizontal: 14 },
  onboardingSafe: { flex: 1, backgroundColor: '#08070d' }, onboardingContent: { paddingHorizontal: 22, paddingTop: 24, paddingBottom: 36 }, onboardingEyebrow: { color: '#ff8a68', fontSize: 10, fontWeight: '900', letterSpacing: 1.5, marginTop: 4 }, onboardingTitle: { color: '#f9f5ff', fontSize: 31, lineHeight: 36, fontWeight: '900', letterSpacing: -0.9, marginTop: 7 }, onboardingBody: { color: '#9b92a5', fontSize: 14, lineHeight: 21, marginTop: 9 }, recordingModeTabs: { flexDirection: 'row', gap: 10, marginTop: 18, marginBottom: 14 }, recordingModeTab: { flex: 1, minHeight: 64, borderRadius: 15, borderWidth: 1, borderColor: '#2c2735', backgroundColor: '#111018', alignItems: 'center', justifyContent: 'center' }, recordingModeTabTitle: { color: '#eee9f5', fontSize: 14, fontWeight: '900' }, recordingModeTabDetail: { color: '#777080', fontSize: 10, fontWeight: '700', marginTop: 4 }, providerTabs: { flexDirection: 'row', gap: 9, marginTop: 18, marginBottom: 14 }, providerTab: { flex: 1, minHeight: 42, borderRadius: 13, borderWidth: 1, borderColor: '#2c2735', backgroundColor: '#111018', alignItems: 'center', justifyContent: 'center' }, providerTabText: { color: '#777080', fontSize: 14, fontWeight: '900' }, providerCarousel: { gap: 12 }, providerCard: { backgroundColor: '#121019', borderWidth: 1, borderRadius: 24, padding: 18, gap: 15 }, providerRecommendation: { alignSelf: 'flex-start', color: '#ff9b82', backgroundColor: '#2a1519', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, fontSize: 8, fontWeight: '900', letterSpacing: 1 }, providerCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 }, providerIcon: { width: 50, height: 50, borderRadius: 15, alignItems: 'center', justifyContent: 'center' }, providerIconText: { color: '#fff', fontSize: 19, fontWeight: '900' }, spotifyMarkFrame: { backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' }, providerKicker: { fontSize: 8, fontWeight: '900', letterSpacing: 1.1 }, providerName: { color: '#fff', fontSize: 21, fontWeight: '900', marginTop: 3 }, providerSummary: { color: '#aaa2b4', fontSize: 13, lineHeight: 20 }, prosCons: { gap: 8 }, prosConsTitle: { fontSize: 8, fontWeight: '900', letterSpacing: 1.1 }, proRow: { flexDirection: 'row', alignItems: 'center', gap: 9 }, proBullet: { width: 20, height: 20, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' }, proBulletText: { fontSize: 12, fontWeight: '900', lineHeight: 15 }, proText: { color: '#d2cbd9', fontSize: 12, flex: 1 }, privacyNote: { borderRadius: 14, padding: 12 }, privacyTitle: { fontSize: 8, fontWeight: '900', letterSpacing: 1 }, privacyCopy: { color: '#9d94a5', fontSize: 11, lineHeight: 16, marginTop: 4 }, pageDots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginVertical: 14 }, pageDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#39313f' }, cancelButton: { alignItems: 'center', padding: 14 }, cancelButtonText: { color: '#9d91ae', fontSize: 12, fontWeight: '800' }, providerFootnote: { color: '#6e6875', fontSize: 10, lineHeight: 15, textAlign: 'center', marginTop: 12, paddingHorizontal: 12 },
  libraryTabs: { flexDirection: 'row', gap: 7, padding: 5, borderRadius: 16, backgroundColor: '#100a18', borderWidth: 1, borderColor: '#342043', marginHorizontal: 20, marginBottom: 12 }, libraryTab: { position: 'relative', flex: 1, minHeight: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 12 }, libraryTabActive: { backgroundColor: 'rgba(108, 47, 29, 0.48)', shadowColor: '#ff713e', shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 0 } }, libraryTabSelectionGlow: { position: 'absolute', top: -2, right: -2, bottom: -2, left: -2, borderRadius: 14, backgroundColor: 'rgba(255,100,56,0.08)' }, libraryTabText: { zIndex: 1, color: '#86788f', fontSize: 11, fontWeight: '800' }, libraryTabTextActive: { color: '#ffc09c' },
  librarySearchFrame: { height: 48, borderRadius: 15, borderWidth: 1, borderColor: '#3d2850', backgroundColor: '#0e0915', marginHorizontal: 20, marginBottom: 12, position: 'relative', overflow: 'hidden' }, librarySearch: { flex: 1, color: '#f6eff9', paddingHorizontal: 15, fontSize: 14 }, libraryFilterRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 20, marginBottom: 9 }, libraryChip: { position: 'relative', minHeight: 34, justifyContent: 'center', paddingHorizontal: 11, paddingVertical: 8, borderRadius: 16, backgroundColor: '#100b17' }, librarySortChip: { position: 'relative', minHeight: 28, justifyContent: 'center', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, backgroundColor: '#100b17' }, libraryChoiceActive: { backgroundColor: 'rgba(108, 47, 29, 0.48)', shadowColor: '#ff713e', shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 0 } }, libraryChoiceGlow: { position: 'absolute', top: -3, right: -3, bottom: -3, left: -3, backgroundColor: 'rgba(255,100,56,0.08)' }, libraryChoiceRim: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(159, 126, 180, 0.4)' }, libraryChoiceRimActive: { borderColor: 'rgba(255, 130, 78, 0.42)' }, libraryChipText: { zIndex: 1, color: '#aa9caf', fontSize: 10, fontWeight: '800' }, libraryChipTextActive: { color: '#ffc09c' }, librarySortText: { zIndex: 1, color: '#b9a7c4', fontSize: 9, fontWeight: '800' },
  memoryHistoryGate: { minHeight: 58, marginHorizontal: 20, marginBottom: 14, borderRadius: 16, borderWidth: 1, borderColor: '#704052', backgroundColor: '#231018', paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }, memoryHistoryGateKicker: { color: '#ff9c7f', fontSize: 8, fontWeight: '900', letterSpacing: 1.45 }, memoryHistoryGateText: { color: '#e9dfe9', fontSize: 11, fontWeight: '800', marginTop: 4 }, memoryHistoryGateArrow: { color: '#ff9c7f', fontSize: 25, lineHeight: 26 },
  favoriteRoute: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 17, borderWidth: 1, borderColor: '#4b315f', backgroundColor: '#130c1d', marginBottom: 9 }, favoriteRouteTitle: { color: '#f4edf7', fontSize: 13, fontWeight: '900' }, favoriteRouteMeta: { color: '#8f8398', fontSize: 10, marginTop: 5 }, favoriteRouteCount: { color: '#ff8d70', fontSize: 17, fontWeight: '900' }, libraryJourneyWrap: { position: 'relative' }, libraryAddButton: { position: 'absolute', right: 12, bottom: 11, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 11, backgroundColor: '#281636', borderWidth: 1, borderColor: '#65427a' }, libraryAddText: { color: '#d2adf3', fontSize: 9, fontWeight: '900' },

  approvedHomeSafe: { flex: 1, backgroundColor: '#05030b' },
  approvedHomeBackdrop: { position: 'absolute', top: -24, right: -24, bottom: -24, left: -24 },
  approvedHomeContent: { minHeight: '100%', paddingHorizontal: 16 },
  approvedHomeHeaderButton: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(24,15,35,0.52)', borderWidth: 1, borderColor: 'rgba(191,149,218,0.24)' },
  approvedHomeScenicSpace: { height: 70 },
  approvedHomeScenicSpaceActive: { height: 85 },
  approvedHomePanels: { gap: 14 },
  homeCuratedStack: { gap: journeyDeckSpacing[4] },
  homeRoadSummary: { borderRadius: journeyDeckRadius.feature, borderCurve: 'continuous', borderWidth: 1, overflow: 'hidden', ...journeyDeckElevation.raised },
  homeRoadSummaryHeader: { minHeight: 72, paddingHorizontal: journeyDeckSpacing[5], paddingVertical: journeyDeckSpacing[4], flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: journeyDeckSpacing[3] },
  homeRoadSummaryKicker: { ...journeyDeckTypography.kicker },
  homeRoadSummaryTitle: { ...journeyDeckTypography.title, marginTop: 3 },
  homeRoadSummaryGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: journeyDeckSpacing[3], paddingBottom: journeyDeckSpacing[3] },
  homeRoadSummaryItem: { minHeight: 78, borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: journeyDeckSpacing[3], paddingVertical: journeyDeckSpacing[3], flexDirection: 'row', alignItems: 'center', gap: journeyDeckSpacing[3] },
  homeRoadSummaryLabel: { ...journeyDeckTypography.kicker, letterSpacing: 0.4 },
  homeRoadSummaryValue: { ...journeyDeckTypography.metric, marginTop: 2 },
  customizeSheet: { gap: journeyDeckSpacing[5] },
  customizeSection: { gap: journeyDeckSpacing[2] },
  customizeSectionTitle: { fontSize: 11, fontWeight: '800', letterSpacing: 1.2 },
  customizeRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: journeyDeckSpacing[3], borderRadius: 14, borderWidth: 1, paddingHorizontal: journeyDeckSpacing[4] },
  customizeRowLabel: { fontSize: 14, fontWeight: '600' },
  customizeRowChevron: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  // iOS Switch has no reliable intrinsic centering, so it gets the same fixed,
  // explicitly centered box as the chevrons -- that keeps every trailing control
  // on one vertical centre line inside the row.
  customizeRowSwitch: { height: 32, alignItems: 'center', justifyContent: 'center' },
  customizeRowSwitchControl: { alignSelf: 'center' },
  approvedLatestMemory: { minHeight: 145, borderRadius: 22, borderWidth: 1, borderColor: 'rgba(165,132,180,0.34)', backgroundColor: 'rgba(9,8,14,0.88)', padding: 15, shadowColor: '#bc6aff', shadowOpacity: 0.12, shadowRadius: 16, shadowOffset: { width: 0, height: 8 } },
  approvedLatestMemoryHeader: { height: 24, flexDirection: 'row', alignItems: 'center', gap: 7 },
  approvedLatestMemoryKicker: { color: '#bf8aeb', fontSize: 12, fontWeight: '600' },
  approvedLatestMemoryRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 5 },
  approvedLatestMemoryArtwork: { width: 86, height: 78, borderRadius: 13, overflow: 'hidden', backgroundColor: '#1a1120' },
  approvedLatestMemoryPlay: { position: 'absolute', left: 8, bottom: 8, width: 30, height: 30, borderRadius: 15, borderWidth: 1, borderColor: 'rgba(255,255,255,0.58)', backgroundColor: 'rgba(12,8,18,0.66)', alignItems: 'center', justifyContent: 'center' },
  approvedLatestMemoryTitle: { color: '#f6eef8', fontSize: 15, fontWeight: '700' },
  approvedLatestMemoryMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 7 },
  approvedLatestMemoryMetaText: { flex: 1, color: '#9e92a4', fontSize: 10.5 },
  approvedLatestMemoryMore: { width: 39, height: 39, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(166,142,177,0.36)', backgroundColor: 'rgba(27,20,34,0.72)', alignItems: 'center', justifyContent: 'center' },
  approvedLatestMemoryMoreText: { color: '#d0c3d6', fontSize: 13, letterSpacing: 1 },
  sharePrompt: { flexDirection: 'row', alignItems: 'center', gap: 9, borderRadius: 16, borderWidth: 1, paddingVertical: 11, paddingHorizontal: 13 },
  sharePromptText: { flex: 1, fontSize: 12.5, fontWeight: '600' },
  sharePromptAction: { borderRadius: 12, paddingHorizontal: 13, paddingVertical: 7 },
  sharePromptActionText: { fontSize: 12.5, fontWeight: '800' },
  sharePromptDismiss: { width: 26, height: 26, alignItems: 'center', justifyContent: 'center' },
  approvedLatestSong: { minHeight: 90, borderRadius: 21, borderWidth: 1, borderColor: 'rgba(139,83,181,0.38)', backgroundColor: 'rgba(11,7,18,0.92)', paddingHorizontal: 14, paddingVertical: 13, flexDirection: 'row', alignItems: 'center', gap: 16, shadowColor: '#9f52e8', shadowOpacity: 0.12, shadowRadius: 14, shadowOffset: { width: 0, height: 7 } },
  approvedLatestSongFallback: { width: 58, height: 58, borderRadius: 13, borderWidth: 1, borderColor: 'rgba(173,105,221,0.34)', backgroundColor: 'rgba(69,31,91,0.58)', alignItems: 'center', justifyContent: 'center' },
  approvedLatestSongKicker: { color: '#c98cff', fontSize: 8, fontWeight: '900', letterSpacing: 1.25 },
  approvedLatestSongTitle: { color: '#fbf5ff', fontSize: 16, lineHeight: 20, fontWeight: '800', marginTop: 5 },
  approvedLatestSongMeta: { color: '#93869b', fontSize: 10.5, lineHeight: 15, marginTop: 3 },
  approvedLatestSongArrow: { width: 30, height: 30, borderRadius: 15, borderWidth: 1, borderColor: 'rgba(174,126,207,0.3)', backgroundColor: 'rgba(39,23,48,0.7)', alignItems: 'center', justifyContent: 'center' },
  cinematicHomePage: { position: 'relative', minHeight: '100%', backgroundColor: '#030105', paddingHorizontal: 18 },
  cinematicMeshRoot: { position: 'absolute', top: 0, right: -28, left: -28, height: 1120 },
  cinematicHomeShell: { gap: 20 },
  cinematicHomeHeader: { minHeight: 130, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', paddingHorizontal: 3, marginTop: 4 },
  cinematicHeaderActions: { flexDirection: 'row', alignItems: 'flex-start', gap: 5 },
  cinematicToolsButton: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', marginTop: 45, backgroundColor: 'rgba(25,14,31,0.86)', borderWidth: 1, borderColor: 'rgba(205,158,230,0.28)' },
  cinematicToolsSymbol: { width: 18, height: 18 },
  cinematicWordmark: { color: '#f8f4ff', fontSize: 16, fontWeight: '900', letterSpacing: -0.25, marginTop: 4 },
  cinematicHeadline: { color: '#fffaff', fontFamily: 'Georgia', fontSize: 42, lineHeight: 46, fontWeight: '400', letterSpacing: -1.2, marginTop: 10, textShadowColor: 'rgba(242,182,255,0.22)', textShadowRadius: 18 },
  cinematicGreeting: { color: '#b9a9c2', fontSize: 14, fontWeight: '600', marginTop: 9 },
  cinematicAvatarAnchor: { width: 76, height: 76, alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start', marginTop: 26, marginRight: -3 },
  cinematicAvatarGlow: { position: 'absolute', width: 54, height: 54, borderRadius: 27, backgroundColor: 'rgba(216, 72, 177, 0.055)', shadowColor: '#e851b4', shadowOpacity: 0.72, shadowRadius: 20, shadowOffset: { width: 0, height: 3 } },
  cinematicAvatarButton: { width: 68, height: 68, borderRadius: 34, alignItems: 'center', justifyContent: 'center', shadowColor: '#f35aa7', shadowOpacity: 0.62, shadowRadius: 15, shadowOffset: { width: 0, height: 5 } },
  settingsBackButton: { alignSelf: 'flex-start', minHeight: 38, justifyContent: 'center', paddingHorizontal: 3, marginBottom: 8 },
  settingsBackText: { color: '#c99bff', fontSize: 14, fontWeight: '800' },
  settingsEditorScreen: { flex: 1, backgroundColor: '#08070d' },
  settingsEditorContent: { minHeight: '100%', paddingHorizontal: 20 },
  settingsEditorNavigation: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  settingsEditorBack: { width: 44, height: 44, borderRadius: 22, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
  settingsEditorHeaderAction: { minWidth: 68, minHeight: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,121,91,0.5)', backgroundColor: 'rgba(255,96,91,0.14)', paddingHorizontal: 14 },
  settingsEditorHeaderActionText: { color: '#ff9278', fontSize: 14, fontWeight: '900' },
  settingsEditorEyebrow: { color: '#ff8f73', fontSize: 9, fontWeight: '900', letterSpacing: 1.7, marginTop: 10 },
  settingsEditorTitle: { color: '#fff8ff', fontSize: 28, lineHeight: 33, fontWeight: '900', letterSpacing: -0.65, marginTop: 5 },
  settingsCategoryStack: { gap: 14, marginTop: 18 },
  settingsHubProfile: { minHeight: 70, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 20, borderWidth: 1, borderColor: '#53355f', backgroundColor: '#15101e', paddingHorizontal: 13, paddingVertical: 10 },
  settingsHubAvatar: { width: 46, height: 46, borderRadius: 15, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  settingsHubProfileName: { color: '#fff8ff', fontSize: 16, fontWeight: '900' },
  settingsHubProfileDetail: { color: '#9f92a7', fontSize: 11, lineHeight: 16, marginTop: 3 },
  settingsHubAction: { color: '#c7a9ff', fontSize: 13, fontWeight: '900' },
  settingsHubSection: { gap: 8 },
  settingsSectionLabel: { color: '#a993b2', fontSize: 9, lineHeight: 13, fontWeight: '900', letterSpacing: 1.55, marginLeft: 4, marginTop: 4 },
  settingsHubList: { overflow: 'hidden', borderRadius: 23, borderWidth: 1, borderColor: '#53355f', backgroundColor: '#141018' },
  settingsHubRow: { minHeight: 62, flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 13, paddingVertical: 9 },
  settingsHubRowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#3d2d46' },
  settingsHubIcon: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: '#291735', borderWidth: 1, borderColor: '#49304f' },
  settingsHubTitle: { color: '#fff8ff', fontSize: 14, lineHeight: 18, fontWeight: '900' },
  settingsHubSummary: { color: '#9f92a7', fontSize: 10.5, lineHeight: 14, marginTop: 2 },
  settingsHubChevron: { color: '#c7a9ff', fontSize: 24, lineHeight: 26 },
  settingsDetailIntro: { color: '#aa9ead', fontSize: 13, lineHeight: 19, marginHorizontal: 2, marginBottom: 2 },
  settingsDetailFootnote: { color: '#9f92a7', fontSize: 12, lineHeight: 18, marginHorizontal: 4, marginTop: -5 },
  settingsCompactList: { overflow: 'hidden', borderRadius: 20, borderWidth: 1, borderColor: '#53355f', backgroundColor: '#141018' },
  settingsCompactRow: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 13, paddingVertical: 10 },
  settingsInfoRow: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 13, paddingVertical: 11 },
  settingsCompactIcon: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: '#291735', borderWidth: 1, borderColor: '#49304f' },
  settingsCompactTitle: { color: '#fff8ff', fontSize: 14, lineHeight: 18, fontWeight: '900' },
  settingsCompactDetail: { color: '#9f92a7', fontSize: 10.5, lineHeight: 15, marginTop: 2 },
  settingsCompactValue: { maxWidth: 105, color: '#c7a9ff', fontSize: 11, fontWeight: '800', textAlign: 'right' },
  settingsCompactChevron: { color: '#c7a9ff', fontSize: 23, lineHeight: 25 },
  settingsStatusText: { color: '#79d9bd', fontSize: 11, fontWeight: '900' },
  settingsInsetNote: { gap: 7, borderRadius: 18, borderWidth: 1, borderColor: '#49304f', backgroundColor: '#110d17', padding: 15 },
  settingsDangerGroup: { overflow: 'hidden', borderRadius: 18, borderWidth: 1, borderColor: '#5b3a69', backgroundColor: '#141018' },
  settingsDangerRow: { minHeight: 48, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14, paddingVertical: 11 },
  settingsSupportLinks: { flexDirection: 'row', gap: 10 },
  settingsSupportLink: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 14, borderWidth: 1, borderColor: '#49304f', backgroundColor: '#17121f' },
  settingsEditorPanel: { width: '100%', overflow: 'hidden', gap: 14, borderRadius: 24, borderWidth: 1, borderColor: '#5b3a69', backgroundColor: '#130d19', padding: 20, marginTop: 22, shadowColor: '#8d51aa', shadowOpacity: 0.2, shadowRadius: 16, shadowOffset: { width: 0, height: 8 } },
  settingsEditorBody: { color: '#aa9ead', fontSize: 13, lineHeight: 20 },
  settingsDataHealth: { minHeight: 86, borderRadius: 21, borderWidth: 1, borderColor: 'rgba(83,210,177,0.34)', backgroundColor: 'rgba(10,22,24,0.82)', paddingHorizontal: 14, paddingVertical: 13, flexDirection: 'row', alignItems: 'center', gap: 12, shadowColor: '#43e6ae', shadowOpacity: 0.13, shadowRadius: 16, shadowOffset: { width: 0, height: 7 } },
  settingsDataHealthIcon: { width: 44, height: 44, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(30,89,75,0.44)', borderWidth: 1, borderColor: 'rgba(87,235,194,0.28)' },
  settingsDataHealthKicker: { color: '#68d9bc', fontSize: 7, fontWeight: '900', letterSpacing: 1.15 },
  settingsDataHealthTitle: { color: '#f4fff9', fontSize: 17, fontWeight: '900', marginTop: 3 },
  settingsDataHealthBody: { color: '#8fa9a1', fontSize: 10, lineHeight: 14, marginTop: 3 },
  settingsDataHealthArrow: { color: '#75e8c7', fontSize: 27, lineHeight: 29 },
  cinematicAvatarRing: { width: 64, height: 64, borderRadius: 32, padding: 2.5 },
  cinematicAvatarInner: { flex: 1, borderRadius: 30, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: '#170b22', borderWidth: 2, borderColor: '#09040d' },
  cinematicAvatarInitials: { color: '#fff6ff', fontSize: 20, fontWeight: '900', letterSpacing: 0.8 },
  cinematicAvatarEdit: { position: 'absolute', right: -1, bottom: -1, width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#21112d', borderWidth: 1, borderColor: '#d76df0', shadowColor: '#c44cff', shadowOpacity: 0.8, shadowRadius: 7 },
  cinematicAvatarEditSymbol: { width: 11, height: 11 },
  cinematicHeroAura: { borderRadius: 29, shadowColor: '#ff6a78', shadowOpacity: 0.45, shadowRadius: 24, shadowOffset: { width: -4, height: 7 }, backgroundColor: 'rgba(255,93,113,0.04)' },
  cinematicHero: { height: 375, overflow: 'hidden', borderRadius: 29, backgroundColor: '#0b050f' },
  cinematicPressed: { opacity: 0.88, transform: [{ scale: 0.992 }] },
  cinematicHeroHeader: { position: 'absolute', top: 18, right: 18, left: 18, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', zIndex: 3 },
  cinematicHeroHeaderCopy: { flex: 1, paddingRight: 12 },
  cinematicHeroEyebrow: { color: '#ff967f', fontSize: 10, fontWeight: '900', letterSpacing: 1.4, textShadowColor: '#1a0712', textShadowRadius: 8, marginBottom: 2 },
  cinematicHeroTitle: { color: '#fffaff', fontSize: 21, lineHeight: 25, fontWeight: '800', letterSpacing: -0.5, textShadowColor: '#100512', textShadowRadius: 10 },
  cinematicHeroRoute: { color: '#c7b6ce', fontSize: 14, fontWeight: '600', marginTop: 4, textShadowColor: '#0a030d', textShadowRadius: 8 },
  cinematicHeroMeta: { color: '#9d8e9f', fontSize: 12.5, fontWeight: '600', marginTop: 4 },
  cinematicRelive: { minHeight: 38, flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 16, borderRadius: 19, backgroundColor: 'rgba(72,36,92,0.48)', borderWidth: 1, borderColor: 'rgba(235,191,255,0.3)', shadowColor: '#9b51e0', shadowOpacity: 0.4, shadowRadius: 10 },
  cinematicReliveSymbol: { width: 14, height: 14 },
  cinematicReliveText: { color: '#fff8ff', fontSize: 13.5, fontWeight: '800' },
  cinematicHeroRouteMap: { position: 'absolute', left: 8, bottom: 62, width: '95%', height: 148, opacity: 0.98 },
  cinematicHeroBottomActions: { position: 'absolute', right: 18, bottom: 18, left: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', zIndex: 3 },
  cinematicHeroRouteButton: { minHeight: 38, flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 14, borderRadius: 19, backgroundColor: 'rgba(15,7,22,0.68)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' },
  cinematicHeroPillIcon: { width: 15, height: 15 },
  cinematicHeroPillText: { color: '#fff9ff', fontSize: 13, fontWeight: '700' },
  cinematicHeroMoreButton: { width: 44, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(15,7,22,0.68)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' },
  cinematicGlass: { position: 'relative', borderRadius: 25, backgroundColor: 'transparent', shadowColor: '#d958ff', shadowOpacity: 0.2, shadowRadius: 18, shadowOffset: { width: 0, height: 8 } },
  cinematicGlassAura: { position: 'absolute', top: 2, right: 2, bottom: 2, left: 2, borderRadius: 24, backgroundColor: 'rgba(129,56,155,0.04)', shadowColor: '#ff647c', shadowOpacity: 0.2, shadowRadius: 16, shadowOffset: { width: -4, height: 6 } },
  cinematicGlassMaterial: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, overflow: 'hidden', borderRadius: 25, borderWidth: 1, borderColor: 'rgba(168,101,201,0.13)', backgroundColor: 'rgba(7,3,11,0.62)' },
  cinematicGlassDarkener: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(4,1,8,0.48)' },
  liquidGlassEdges: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, overflow: 'hidden' },
  liquidGlassOuterBevel: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, borderWidth: 1, borderTopColor: 'rgba(200,128,234,0.18)', borderLeftColor: 'rgba(181,103,217,0.13)', borderRightColor: 'rgba(78,37,103,0.26)', borderBottomColor: 'rgba(48,21,67,0.34)' },
  liquidGlassTopEdge: { position: 'absolute', top: 2, right: 3, left: 3, height: 9 },
  liquidGlassLeftEdge: { position: 'absolute', top: 3, bottom: 3, left: 2, width: 7 },
  liquidGlassRightEdge: { position: 'absolute', top: 3, right: 2, bottom: 3, width: 7 },
  liquidGlassBottomEdge: { position: 'absolute', right: 3, bottom: 2, left: 3, height: 8 },
  liquidGlassInsetBevel: { position: 'absolute', top: 4, right: 4, bottom: 4, left: 4, borderWidth: 1, borderTopColor: 'rgba(192,119,223,0.06)', borderLeftColor: 'rgba(175,102,206,0.05)', borderRightColor: 'rgba(42,17,60,0.16)', borderBottomColor: 'rgba(28,11,41,0.22)' },
  cinematicSection: { gap: 11 },
  cinematicSectionHeader: { minHeight: 29, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 3 },
  cinematicSectionTitle: { color: '#fff9ff', fontSize: 20, fontWeight: '800', letterSpacing: -0.35 },
  cinematicSectionAction: { color: '#c793ff', fontSize: 13, fontWeight: '800' },
  cinematicStoryRail: { gap: 12, paddingHorizontal: 2, paddingBottom: 4 },
  cinematicStoryCard: { width: 128, height: 185, overflow: 'hidden', borderRadius: 22, backgroundColor: '#0b050f', shadowColor: '#d356ff', shadowOpacity: 0.3, shadowRadius: 14, shadowOffset: { width: 0, height: 7 } },
  cinematicStoryMoreCard: { width: 128, height: 185, overflow: 'hidden', borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: '#120a1b', shadowColor: '#d356ff', shadowOpacity: 0.3, shadowRadius: 14, shadowOffset: { width: 0, height: 7 } },
  cinematicStoryCopy: { position: 'absolute', right: 12, bottom: 13, left: 12 },
  cinematicStoryTitle: { color: '#fffaff', fontSize: 15, lineHeight: 18, fontWeight: '800' },
  cinematicStoryMeta: { color: '#b2a2b7', fontSize: 11, lineHeight: 14, fontWeight: '600', marginTop: 3 },
  cinematicStoryMoreIcon: { width: 30, height: 30, marginBottom: 12 },
  cinematicStoryMoreTitle: { color: '#fffaff', fontSize: 16, fontWeight: '800' },
  cinematicStoryMoreMeta: { color: '#c6a7db', fontSize: 11, fontWeight: '700', marginTop: 5 },
  cinematicSoundtrackGlassCard: { borderRadius: 26, padding: 16, gap: 14 },
  cinematicSoundtrackHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cinematicSoundtrackKickerWrap: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  cinematicWaveformKickerIcon: { width: 16, height: 16 },
  cinematicSoundtrackKickerText: { color: '#f5ecf8', fontSize: 13, fontWeight: '700' },
  cinematicStatusBadgePill: { minHeight: 26, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, borderRadius: 13, backgroundColor: 'rgba(8,26,20,0.65)', borderWidth: 1, borderColor: 'rgba(75,232,196,0.3)' },
  cinematicStatusDot: { width: 7, height: 7, borderRadius: 4, shadowColor: '#4be8c4', shadowOpacity: 1, shadowRadius: 7 },
  cinematicStatusBadgeText: { color: '#e8fdf7', fontSize: 11, fontWeight: '700' },
  cinematicShieldIcon: { width: 12, height: 12 },
  cinematicSoundtrackContentRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cinematicAlbumCoverWrap: { width: 76, height: 76, borderRadius: 16, overflow: 'hidden', backgroundColor: '#180a22', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', shadowColor: '#db49ff', shadowOpacity: 0.45, shadowRadius: 10 },
  cinematicAlbumCoverImage: { width: '100%', height: '100%' },
  cinematicEmptyAlbumCover: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  cinematicEmptyAlbumIcon: { width: 31, height: 31 },
  cinematicTrackInfoColumn: { flex: 1, gap: 2 },
  cinematicTrackTitleText: { color: '#fff9ff', fontSize: 17, fontWeight: '800' },
  cinematicTrackArtistText: { color: '#ad9fb3', fontSize: 13.5, fontWeight: '600' },
  cinematicEmptySoundtrackHint: { color: '#c49ae3', fontSize: 10, fontWeight: '800', marginTop: 5 },
  cinematicWaveformContainer: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  cinematicWaveformTime: { color: '#7a6c82', fontSize: 10.5, fontWeight: '700' },
  cinematicWaveformBars: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 26 },
  cinematicWaveBar: { width: 2.2, borderRadius: 1.5 },
  cinematicPlayButtonOuter: { width: 54, height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center', shadowColor: '#ff5493', shadowOpacity: 0.65, shadowRadius: 12 },
  cinematicPlayButtonRing: { width: 54, height: 54, borderRadius: 27, padding: 2.2 },
  cinematicPlayButtonDisc: { flex: 1, borderRadius: 25, alignItems: 'center', justifyContent: 'center', backgroundColor: '#13061c' },
  cinematicPlaySymbol: { width: 20, height: 20, marginLeft: 2 },
  cinematicWeekCard: { borderRadius: 25, padding: 19 },
  cinematicWeekEyebrow: { color: '#cc9eff', fontSize: 11, fontWeight: '900', letterSpacing: 1.5 },
  cinematicWeekDistance: { color: '#fffaff', fontSize: 34, lineHeight: 40, fontWeight: '900', letterSpacing: -1, marginTop: 7 },
  cinematicWeekMeta: { color: '#aa9caf', fontSize: 14, marginTop: 4 },
  cinematicWeekActions: { flexDirection: 'row', justifyContent: 'space-between', gap: 7, marginTop: 19, paddingTop: 16, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(213,175,229,0.2)' },
  cinematicWeekAction: { flex: 1, alignItems: 'center', gap: 7, paddingVertical: 5 },
  cinematicWeekActionIcon: { width: 39, height: 39, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(132,71,174,0.16)', borderWidth: 1, borderColor: 'rgba(202,141,245,0.3)' },
  cinematicWeekActionSymbol: { width: 20, height: 20 },
  cinematicWeekActionLabel: { color: '#b9a9c1', fontSize: 11, fontWeight: '700' },
  cinematicPrivacyRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 8 },
  cinematicPrivacyDot: { width: 7, height: 7, borderRadius: 4, shadowColor: '#4be8c4', shadowOpacity: 0.9, shadowRadius: 6 },
  cinematicPrivacyText: { flexShrink: 1, color: '#817684', fontSize: 11, fontWeight: '600', textAlign: 'center' },
  cinematicPrivacyChevron: { width: 11, height: 15 },
  profileEditorRoot: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 22, backgroundColor: 'rgba(3,1,6,0.52)' },
  profileEditorCard: { width: '100%', maxWidth: 430, borderRadius: 30, alignItems: 'center', padding: 22 },
  profileEditorEyebrow: { alignSelf: 'flex-start', color: '#ce9fff', fontSize: 11, fontWeight: '900', letterSpacing: 1.6 },
  profileEditorTitle: { alignSelf: 'flex-start', color: '#fffaff', fontSize: 27, fontWeight: '900', letterSpacing: -0.7, marginTop: 7 },
  profileEditorBody: { alignSelf: 'flex-start', color: '#ac9eb1', fontSize: 14, lineHeight: 20, marginTop: 7 },
  profileEditorAvatarButton: { width: 108, height: 108, alignItems: 'center', justifyContent: 'center', marginTop: 22 },
  profileEditorAvatarRing: { width: 102, height: 102, borderRadius: 51, padding: 3 },
  profileEditorAvatarInner: { flex: 1, borderRadius: 48, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: '#15091f', borderWidth: 2, borderColor: '#09040d' },
  profileEditorAvatarInitials: { color: '#fff7ff', fontSize: 31, fontWeight: '900' },
  profileEditorPhotoBadge: { position: 'absolute', right: 0, bottom: 0, width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: '#ff6f62', borderWidth: 2, borderColor: '#180a20', shadowColor: '#ff5e67', shadowOpacity: 0.8, shadowRadius: 8 },
  profileEditorCamera: { width: 17, height: 17 },
  profileEditorPhotoAction: { color: '#d6aaff', fontSize: 13, fontWeight: '800', marginTop: 9 },
  profileEditorRemovePhoto: { color: '#978a9c', fontSize: 12, fontWeight: '700', marginTop: 8 },
  profileEditorLabel: { alignSelf: 'flex-start', color: '#a68caf', fontSize: 10, fontWeight: '900', letterSpacing: 1.3, marginTop: 22, marginBottom: 7 },
  profileEditorInput: { alignSelf: 'stretch', height: 52, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(203,139,241,0.36)', backgroundColor: 'rgba(7,3,11,0.62)', color: '#fffaff', paddingHorizontal: 15, fontSize: 17, fontWeight: '700' },
  profileEditorActions: { alignSelf: 'stretch', flexDirection: 'row', gap: 10, marginTop: 19 },
  profileEditorCancel: { flex: 1, minHeight: 50, alignItems: 'center', justifyContent: 'center', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(196,159,213,0.24)', backgroundColor: 'rgba(28,16,35,0.55)' },
  profileEditorCancelText: { color: '#c2b4c8', fontSize: 14, fontWeight: '800' },
  profileEditorSave: { flex: 1.35, minHeight: 50, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', borderRadius: 16, shadowColor: '#ff5f6d', shadowOpacity: 0.58, shadowRadius: 11 },
  profileEditorSaveText: { color: '#170708', fontSize: 14, fontWeight: '900' },
});
