import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const sourceRoot = new URL('../src/', import.meta.url);
const shell = await readFile(new URL('shell.tsx', sourceRoot), 'utf8');
const musicScreen = await readFile(new URL('music-screen.tsx', sourceRoot), 'utf8');
const shareCard = await readFile(new URL('share-card-modal.tsx', sourceRoot), 'utf8');
const interactiveRouteMap = await readFile(new URL('interactive-route-map.tsx', sourceRoot), 'utf8');
const primarySections = await readFile(new URL('primary-sections.tsx', sourceRoot), 'utf8');
const primaryData = await readFile(new URL('primary-sections-data.ts', sourceRoot), 'utf8');
const primaryMap = await readFile(new URL('primary-mobility-map.tsx', sourceRoot), 'utf8');
const homeSummary = await readFile(new URL('home-summary.ts', sourceRoot), 'utf8');
const profileAppearance = await readFile(new URL('profile-appearance.ts', sourceRoot), 'utf8');
const neonWidget = await readFile(new URL('neon-widget-outline.tsx', sourceRoot), 'utf8');
const storage = await readFile(new URL('storage.ts', sourceRoot), 'utf8');
const welcomeIntro = await readFile(new URL('welcome-intro.ts', sourceRoot), 'utf8');
const app = await readFile(new URL('../App.tsx', import.meta.url), 'utf8');

test('tabs use one native pager with a bounded offscreen memory budget', () => {
  assert.match(shell, /<PagerView/);
  assert.match(shell, /scrollEnabled=\{false\}/);
  assert.match(shell, /offscreenPageLimit=\{1\}/);
  assert.match(shell, /key="home"/);
  assert.match(shell, /key="live"/);
  assert.match(shell, /key="journeys"/);
  assert.match(shell, /key="atlas"/);
  assert.match(shell, /key="more"/);
  assert.match(shell, /type Tab = 'home' \| 'live' \| 'journeys' \| 'atlas' \| 'more'/);
  assert.doesNotMatch(shell, /transitionVeil|visibleTab|recorderHidden/);
});

test('Phase 2 exposes Live, Atlas, Timeline, Statistics, Search, and Data Health from a local-first model', () => {
  assert.match(primarySections, /export function LiveScreen/);
  assert.match(primarySections, /export function AtlasScreen/);
  assert.match(primarySections, /export function TimelineScreen/);
  assert.match(primarySections, /export function StatisticsScreen/);
  assert.match(primarySections, /export function SearchScreen/);
  assert.match(primarySections, /export function DataHealthScreen/);
  assert.match(primarySections, /'timeline' \| 'statistics' \| 'music' \| 'record' \| 'health' \| 'settings'/);
  assert.match(primaryData, /getLiveRecorderSnapshot/);
  assert.match(primaryData, /primary\.sections\.\$\{userId\}\.v1/);
  assert.match(primaryData, /buildTimeline/);
  assert.match(primaryData, /buildStatistics/);
  assert.match(primaryData, /buildSearchRecords/);
  assert.match(storage, /including points already uploaded/);
});

test('Phase 2 maps use recorded geometry and the same themed OpenFreeMap basemap', () => {
  assert.match(primaryMap, /loadJourneyDeckMapStyle/);
  assert.match(primaryMap, /OPEN_FREE_MAP_DARK_STYLE/);
  assert.match(primaryMap, /primary-route-line/);
  assert.match(primaryMap, /primary-mobility-places/);
  assert.match(primaryMap, /clusterRadius=\{44\}/);
  assert.doesNotMatch(primaryMap, /places\.map\(place => <Marker/);
  assert.match(primaryMap, /OpenFreeMap · © OpenStreetMap/);
  assert.match(primarySections, /details.*route/);
  assert.match(primarySections, /snapshot\.route\.map/);
  assert.match(primarySections, /<Text style=\{styles\.routeGlyph\}>⌁<\/Text>/);
  assert.doesNotMatch(primarySections, /<View style=\{styles\.routeGlyph\}>⌁<\/View>/);
});

test('Phase 6 Home summarizes every completed local-first section and routes into it', () => {
  assert.match(shell, /primary={primarySections}/);
  assert.match(shell, /buildHomeSummary/);
  assert.match(shell, /MEMORY SPOTLIGHT/);
  assert.match(shell, /ROAD SOUNDTRACK/);
  assert.match(shell, /YOUR ROAD PATTERN/);
  assert.match(shell, /ROAD INTELLIGENCE/);
  assert.match(shell, /EXPLORE YOUR ROAD/);
  assert.match(shell, /onMore\('timeline'\)/);
  assert.match(shell, /onMore\('statistics'\)/);
  assert.match(shell, /onMore\('search'\)/);
  assert.match(homeSummary, /data\.memories/);
  assert.match(homeSummary, /data\.vehicle/);
  assert.match(homeSummary, /data\.statistics/);
  assert.match(homeSummary, /data\.timeline/);
  assert.doesNotMatch(homeSummary, /fetch\(|request\(|loadConnection/);
});

test('a new profile receives a skippable, motion-aware welcome before functional setup', () => {
  assert.match(shell, /shouldShowWelcomeIntro/);
  assert.match(shell, /!\(preferences\.onboardingCompleted && recordingPreferences\.onboardingCompleted\)/);
  assert.match(shell, /<WelcomeIntro onContinue=\{beginOnboarding\} \/>/);
  assert.match(shell, /JourneyDeckLogo size=\{42\}/);
  assert.match(shell, /<Text style=\{styles\.wordmarkJourney\}>Journey<\/Text><Text style=\{styles\.wordmarkDeck\}>Deck<\/Text>/);
  assert.match(shell, /The road\{`\\n`\}remembers\./);
  assert.match(shell, /Set up JourneyDeck/);
  assert.match(shell, /AccessibilityInfo\.isReduceMotionEnabled\(\)/);
  assert.match(shell, /reduceMotionChanged/);
  assert.match(shell, /No ads\. No tracking\. You control your data\./);
  assert.match(welcomeIntro, /onboarding\.welcome-intro/);
  assert.match(welcomeIntro, /upsertPrivatePreference/);
});

test('runtime 1.8 Home uses the cinematic memory design and private editable profile appearance', () => {
  assert.match(shell, /<HomeScreen currentUser=\{currentUser\}/);
  assert.match(shell, /function HomeMeshAtmosphere/);
  assert.match(shell, /<MeshGradientView columns=\{3\} rows=\{3\}/);
  assert.match(shell, /function CinematicGlass/);
  assert.match(shell, /function LiquidGlassEdges/);
  assert.match(shell, /<NeonWidgetOutline radius=\{radius\} \/>/);
  assert.match(neonWidget, /function NeonWidgetOutline/);
  assert.match(neonWidget, /<RoundedRect x=\{3\} y=\{3\}/);
  assert.match(neonWidget, /'#ff795b', '#ff4d87', '#a66cff', '#5aa7ff'/);
  assert.match(shell, /<LiquidGlassEdges radius=\{29\} \/>/);
  assert.match(shell, /<LiquidGlassEdges radius=\{22\} \/>/);
  assert.match(shell, /<LiquidGlassEdges radius=\{24\} \/>/);
  assert.match(shell, /isLiquidGlassAvailable\(\) && isGlassEffectAPIAvailable\(\)/);
  assert.match(shell, /glassEffectStyle="clear"/);
  assert.match(shell, /home-cinematic-hero-night-v1\.png/);
  assert.match(shell, /home-cinematic-hero-morning-v2\.png/);
  assert.match(shell, /home-cinematic-hero-afternoon-v2\.png/);
  assert.match(shell, /home-cinematic-hero-evening-v2\.png/);
  assert.match(shell, /function homeHeroImageFor/);
  assert.match(shell, /function homeHeroTitle/);
  assert.match(shell, /function homeRouteContext/);
  assert.match(shell, /Keep the Home hero editorial; the recorded route belongs in the drive detail\./);
  assert.match(shell, /Open drive/);
  assert.doesNotMatch(shell, /function HomeHeroRoute/);
  assert.doesNotMatch(shell, /Friday night in Fort Worth/);
  assert.match(shell, /LATEST ROAD MEMORY/);
  assert.match(shell, /The road\{`\\n`\}remembers\./);
  assert.match(shell, /accessibilityLabel="Edit profile"/);
  assert.match(shell, /<View pointerEvents="none" style=\{styles\.cinematicAvatarGlow\} \/>/);
  assert.match(shell, /cinematicAvatarGlow: \{[\s\S]*?borderRadius: 27/);
  assert.match(neonWidget, /@shopify\/react-native-skia/);
  assert.match(neonWidget, /<BlurMask blur=\{isHero \? 8 : isSelected \? 7 : 4\} style="normal" \/>/);
  assert.match(shell, /chooseProfileAvatar/);
  assert.match(shell, /<Text style=\{styles\.cinematicSectionTitle\}>Memories<\/Text>/);
  assert.match(shell, /\.slice\(0, 5\)/);
  assert.match(shell, /accessibilityLabel="See more memories"/);
  assert.match(shell, /All memories/);
  assert.match(shell, /Now playing on your road/);
  assert.match(profileAppearance, /profile\.appearance/);
  assert.match(profileAppearance, /upsertPrivatePreference/);
  assert.match(profileAppearance, /MAX_AVATAR_DATA_URI_LENGTH/);
  assert.doesNotMatch(profileAppearance, /fetch\(|request\(/);
});

test('Music background loading cannot activate the native refresh inset', () => {
  assert.match(musicScreen, /refreshing=\{manualRefreshing\}/);
  assert.match(musicScreen, /contentInsetAdjustmentBehavior="never"/);
  assert.match(musicScreen, /automaticallyAdjustContentInsets=\{false\}/);
  assert.doesNotMatch(musicScreen, /refreshing=\{state\.status/);
});

test('every major destination has a distinct cinematic header scene', () => {
  assert.match(shell, /<PageHeader variant="memories"/);
  assert.match(shell, /memories-header-hero\.png/);
  assert.match(shell, /<PageHeader variant="settings"/);
  assert.match(shell, /function PageHeaderScene/);
  assert.match(shell, /settingsHeaderLink/);
  assert.match(musicScreen, /music-header-hero\.png/);
  assert.match(musicScreen, /function MusicHeaderScene/);
  assert.match(musicScreen, /musicSceneGlow|soundwaveGrad/);
  assert.match(musicScreen, /musicHeaderStyles\.spectrum/);
  assert.match(primarySections, /live-header-hero-v2\.png/);
  assert.match(primarySections, /atlas-header-hero-v2\.png/);
});

test('music chooser and Settings use approved service marks with honest provider wording', () => {
  assert.match(shell, /apple-music-icon\.png/);
  assert.match(shell, /shazam-icon\.png/);
  assert.match(shell, /spotify-icon-white\.png/);
  assert.match(shell, /function ProviderMark/);
  assert.match(shell, /name: 'Spotify history', kicker: 'IMPORTED VIA LAST\.FM'/);
  assert.match(shell, /Import timestamped Spotify listening history through your Last\.fm account/);
  assert.match(shell, /ConnectionTile name="Apple Music"[\s\S]*?brand="apple-music"/);
  assert.match(shell, /ConnectionTile name="Auto Recognition"[\s\S]*?brand="shazam"/);
  assert.match(shell, /ConnectionTile name="Spotify history"[\s\S]*?brand="spotify"/);
  assert.match(shell, /SPOTIFY HISTORY VIA LAST\.FM/);
  assert.match(shell, /tessie-logo-white\.png/);
  assert.match(shell, /tessie-logo-black\.png/);
  assert.match(shell, /function TessieMark/);
  assert.match(shell, /ConnectionTile name="Tessie"[\s\S]*?mark=\{<TessieMark size=\{46\} \/>\}/);
  assert.match(shell, /Connected through Tessie/);
  assert.match(shell, /token in this iPhone Keychain/);
  assert.match(shell, /stateless privacy edge/);
  assert.match(shell, /https:\/\/dash\.tessie\.com\/settings\/developer/);
  assert.doesNotMatch(shell, /name: 'Last\.fm for Spotify'/);
});

test('native dashboards use static cinematic lighting and Music has intentional artwork and mileage graphics', () => {
  assert.match(musicScreen, /function RouteGlow\(\)[\s\S]*?<Svg/);
  assert.match(musicScreen, /strokeDasharray="5 7"/);
  assert.doesNotMatch(musicScreen, /routeLineOne|routeLineTwo/);
  assert.match(musicScreen, /function VinylHeroRecord/);
  assert.match(musicScreen, /Animated\.loop[\s\S]*?duration: 22000/);
  assert.match(musicScreen, /vinylCenterLabel: \{ width: 60, height: 60/);
  assert.match(musicScreen, /return <QuietInset radius=\{19\} accent=\{accent\} style=\{styles\.metric\}>/);
  assert.match(neonWidget, /function QuietInset/);
  assert.match(shell, /staticWidgetGlow/);
  assert.match(shell, /webDashboardShell: \{[\s\S]*?shadowColor: '#9d58ff'/);
  assert.match(app, /statusCard: \{[\s\S]*?shadowColor: '#9b61ff'/);
  assert.match(app, /<QuietInset radius=\{16\} accent=\{index === 0 \? '#ff795b'/);
  assert.match(app, /metrics: \{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 \}/);
  assert.match(shell, /function AtmosphericBackdrop/);
  assert.match(shell, /<AtmosphericBackdrop variant="home"/);
  assert.match(shell, /<AtmosphericBackdrop variant="memories"/);
  assert.match(shell, /<AtmosphericBackdrop variant="settings"/);
  assert.match(musicScreen, /function MusicAtmosphere/);
  assert.match(app, /function RecorderAtmosphere/);
  assert.match(shell, /SvgRadialGradient id="settingsHeaderBloom"/);
  assert.doesNotMatch(shell, /settingsOrb/);
  assert.doesNotMatch(shell, /atmosphereRibbon|atmosphereHorizon|heroGlowPink|heroGlowBlue/);
  assert.match(musicScreen, /SvgRadialGradient id="musicTopBloom"/);
  assert.match(app, /SvgRadialGradient id="recorderTopBloom"/);
  assert.match(shell, /webActions: \{ height: 118/);
  assert.match(shell, /webActionIcon: \{[\s\S]*?width: 42, height: 42/);
  assert.match(shell, /webAction: \{[\s\S]*?alignItems: 'center'/);
  assert.match(shell, /webActionIcon: \{ width: 42, height: 42/);
  assert.doesNotMatch(shell, /webActionIcon: \{[^}]*position: 'absolute'/);
  assert.match(shell, /<SymbolView name=\{symbol\} tintColor=\{color\}/);
  assert.match(shell, /symbol="arrow\.clockwise"/);
  assert.match(shell, /symbol="play\.fill"/);
  assert.match(shell, /webJourneyOrigin: \{[\s\S]*?fontSize: 9/);
  assert.match(shell, /webJourneyDestination: \{[\s\S]*?fontSize: 12/);
  assert.match(shell, /webServiceName: \{[\s\S]*?fontSize: 10/);
  assert.match(shell, /style=\{styles\.webJourneyOrigin\} numberOfLines=\{2\}/);
});

test('every pager page explicitly clears the Dynamic Island and owns its scroll inset', () => {
  assert.match(shell, /function HomeScreen[\s\S]*?useSafeAreaInsets\(\)/);
  assert.match(shell, /function MemoriesScreen[\s\S]*?useSafeAreaInsets\(\)/);
  assert.match(shell, /function ConnectionsScreen[\s\S]*?useSafeAreaInsets\(\)/);
  assert.match(shell, /contentInsetAdjustmentBehavior="never"/);
  assert.match(shell, /automaticallyAdjustContentInsets=\{false\}/);
  assert.match(app, /function RecorderScreen\(\) \{\s+const insets = useSafeAreaInsets\(\)/);
  assert.match(app, /paddingTop: insets\.top \+ 14/);
  assert.match(app, /contentInsetAdjustmentBehavior="never"/);
});

test('Memory detail keeps its collection-first hierarchy, photo-rich atlas, and cinematic light sweep native', () => {
  assert.match(shell, /function MemoryDetailModal/);
  assert.match(shell, /function MemoryDetailModal[\s\S]*?return <View style=\{\[styles\.memoryDetailRoot, StyleSheet\.absoluteFill, \{ zIndex: 100 \}\]\}/);
  assert.doesNotMatch(shell, /return <Modal visible transparent animationType="none" statusBarTranslucent/);
  assert.match(shell, /import \{ BlurView \} from 'expo-blur'/);
  assert.match(shell, /import \{ LinearGradient \} from 'expo-linear-gradient'/);
  assert.match(shell, /from 'react-native-reanimated'/);
  assert.match(shell, /withDelay\(170, withTiming/);
  assert.match(shell, /memoryDetailBreadcrumbActive.*Collections/);
  assert.match(shell, /from 'react-native-svg'/);
  assert.match(shell, /function MemoryRoadThread/);
  assert.match(shell, /C 5 70, 78 122/);
  assert.match(shell, /function CollectionPlaceholderArtwork/);
  assert.match(shell, /function JourneyMomentArtwork/);
  assert.match(shell, /cinematic placeholders/);
  assert.match(shell, /closeMemoryThen/);
  assert.match(shell, /height: 65, alignSelf: 'auto'/);
  assert.doesNotMatch(shell, /collection\.photos\[journeyIndex % collection\.photos\.length\]/);
  assert.match(shell, /function MemoryCollectionChapter/);
  assert.match(shell, /journeys\.filter\(journey => collection\.driveIds\.includes\(journey\.id\)\)/);
  assert.match(shell, /onOpenJourney\(journey\.id\)/);
});

test('Journey details render their recorded GPS geometry as a cinematic native route canvas', () => {
  assert.match(shell, /function JourneyCinematicHero/);
  assert.match(shell, /<JourneyCinematicHero journey=\{journey\} \/>/);
  assert.match(shell, /THE DRIVE'S SOUNDTRACK/);
  assert.match(shell, /DRIVE TIME/);
  assert.match(shell, /function RouteSketch/);
  assert.match(shell, /const mercatorPoint/);
  assert.match(shell, /https:\/\/tile\.openstreetmap\.org/);
  assert.match(shell, /cachePolicy="memory-disk"/);
  assert.match(shell, /<Polyline points=\{mapPolyline \|\| polyline\}/);
  assert.match(shell, /id="journeyRoute"/);
  assert.match(shell, /GPS points/);
  assert.match(shell, /song markers/);
  assert.match(shell, /OpenFreeMap \/ © OpenStreetMap/);
  assert.match(shell, /Route will appear after the journey syncs/);
});

test('Journey details enable an interactive MapLibre route with a cached static fallback', () => {
  assert.match(shell, /<InteractiveRouteMap/);
  assert.match(shell, /routeSamples=\{journey\.route\?\.points\}/);
  assert.match(shell, /fallback=\{<RouteSketch expanded/);
  assert.match(shell, /OpenFreeMap \/ © OpenStreetMap/);
  assert.match(shell, /ROUTE \+ SONG LOCATIONS/);
  assert.match(shell, /selected=\{selectedSongIndex === index \+ 1\}/);
  assert.match(interactiveRouteMap, /OPEN_FREE_MAP_DARK_STYLE/);
  assert.match(interactiveRouteMap, /journey-route-bloom/);
  assert.match(interactiveRouteMap, /<SongMarker index=\{moment\.index\}/);
  assert.match(interactiveRouteMap, /Tap anywhere on the map for nearby music/);
  assert.match(interactiveRouteMap, /nearbyRadii = \[0\.5, 1, 2, 5\]/);
  assert.match(interactiveRouteMap, /JOURNEY REPLAY/);
  assert.match(interactiveRouteMap, /Replay uses recorded vehicle telemetry/);
  assert.match(interactiveRouteMap, /OpenFreeMap supplies only the basemap/);
});

test('Settings exposes real Apple identity and private iCloud sync without confusing the two accounts', () => {
  assert.match(shell, /AppleAuthentication\.AppleAuthenticationButton/);
  assert.match(shell, /onAppleSignIn/);
  assert.match(shell, /onPrivateCloudSync/);
  assert.match(shell, /Apple identity linked to this local profile/);
  assert.match(shell, /Private iCloud sync separately uses the iCloud account signed into this iPhone/);
  assert.match(shell, /exact GPS route points[\s\S]*Home\/Work labels, Apple credentials, and local photo paths stay on this iPhone/);
});

test('Journey sharing has web-parity controls and never exports raw Home or Work geometry', () => {
  assert.match(shell, /routeCoordinates: journey\.route\?\.coordinates \?\? \[\]/);
  assert.match(shareCard, /function JourneyShareControls/);
  assert.match(shareCard, /BUILD YOUR CARD/);
  assert.match(shareCard, /Featured album/);
  assert.match(shareCard, /SHOW ON CARD/);
  assert.match(shareCard, /function ShareRouteSnapshot/);
  assert.match(shareCard, /https:\/\/tile\.openstreetmap\.org/);
  assert.match(shareCard, /function privacySafeJourneyRoute/);
  assert.ok(shareCard.includes('/^(home|work)$/i'));
  assert.match(shareCard, /privateCityRoute\(\)/);
  assert.match(shareCard, /CITY-LEVEL PREVIEW/);
  assert.match(shareCard, /height: payload\.journey \? 1550 : 1350/);
  assert.match(shareCard, /journeyShareCard: \{ height: 465/);
});
