import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const sourceRoot = new URL('../src/', import.meta.url);
const shell = await readFile(new URL('shell.tsx', sourceRoot), 'utf8');
const musicScreen = await readFile(new URL('music-screen.tsx', sourceRoot), 'utf8');
const musicCapture = await readFile(new URL('music-capture.ts', sourceRoot), 'utf8');
const appleArtworkLookup = await readFile(new URL('apple-artwork-lookup.ts', sourceRoot), 'utf8');
const shareCard = await readFile(new URL('share-card-modal.tsx', sourceRoot), 'utf8');
const shareRoutePrivacy = await readFile(new URL('share-route-privacy.ts', sourceRoot), 'utf8');
const interactiveRouteMap = await readFile(new URL('interactive-route-map.tsx', sourceRoot), 'utf8');
const primarySections = await readFile(new URL('primary-sections.tsx', sourceRoot), 'utf8');
const primaryData = await readFile(new URL('primary-sections-data.ts', sourceRoot), 'utf8');
const primaryMap = await readFile(new URL('primary-mobility-map.tsx', sourceRoot), 'utf8');
const homeSummary = await readFile(new URL('home-summary.ts', sourceRoot), 'utf8');
const profileAppearance = await readFile(new URL('profile-appearance.ts', sourceRoot), 'utf8');
const neonWidget = await readFile(new URL('neon-widget-outline.tsx', sourceRoot), 'utf8');
const headerArtwork = await readFile(new URL('header-artwork.tsx', sourceRoot), 'utf8');
const storage = await readFile(new URL('storage.ts', sourceRoot), 'utf8');
const welcomeIntro = await readFile(new URL('welcome-intro.ts', sourceRoot), 'utf8');
const firstRun = await readFile(new URL('first-run-onboarding.ts', sourceRoot), 'utf8');
const firstRunScreen = await readFile(new URL('first-run-onboarding-screen.tsx', sourceRoot), 'utf8');
const releaseFeatures = await readFile(new URL('release-features.ts', sourceRoot), 'utf8');
const app = await readFile(new URL('../App.tsx', import.meta.url), 'utf8');
const moreScreen = primarySections.slice(primarySections.indexOf('export function MoreScreen'), primarySections.indexOf('function MoreTile'));

test('tabs use one native pager with a bounded offscreen memory budget', () => {
  assert.match(shell, /<PagerView/);
  assert.match(shell, /scrollEnabled=\{false\}/);
  assert.match(shell, /offscreenPageLimit=\{1\}/);
  assert.match(shell, /transform: \[\{ scaleX: motion\.scale \}\]/);
  assert.doesNotMatch(shell, /transform: \[\{ scale: motion\.scale \}\]/);
  assert.match(shell, /key="music"/);
  assert.match(shell, /key="journeys"/);
  assert.match(shell, /key="home"/);
  assert.match(shell, /key="statistics"/);
  assert.match(shell, /key="settings"/);
  assert.doesNotMatch(shell, /key="live"|key="atlas"/);
  assert.doesNotMatch(shell, /key="more"/);
  assert.match(shell, /type Tab = 'music' \| 'journeys' \| 'home' \| 'statistics' \| 'settings'/);
  assert.match(shell, /initialPage=\{3\}/);
  assert.match(shell, /useSharedValue\(2\)/);
  assert.match(shell, /key="settings-wrap" index=\{-1\}/);
  assert.match(shell, /key="music-wrap" index=\{5\}/);
  assert.match(shell, /onPageScrollStateChanged=\{event => \{/);
  assert.match(shell, /pageScrollState !== 'idle'/);
  assert.match(shell, /pendingPagerSnapRef\.current = null/);
  assert.match(shell, /setPageWithoutAnimation\(canonicalPosition\)/);
  assert.match(shell, /accessibilityElementsHidden importantForAccessibility="no-hide-descendants"/);
  assert.doesNotMatch(shell, /transitionVeil|visibleTab|recorderHidden/);
  assert.match(shell, /navItemPressed: \{ transform: \[\{ scale: 0\.98 \}\], opacity: 0\.88 \}/);
  assert.doesNotMatch(shell, /navItemPressed: \{[^}]*backgroundColor/);
});

test('the local-first model still builds Live, Atlas, the merged Statistics timeline, Search, and Data Health', () => {
  assert.match(primarySections, /export function LiveScreen/);
  assert.match(primarySections, /export function AtlasScreen/);
  assert.match(primarySections, /export function TimelineScreen/);
  assert.match(primarySections, /export function StatisticsScreen/);
  assert.match(primarySections, /export function SearchScreen/);
  assert.match(primarySections, /export function DataHealthScreen/);
  assert.match(primarySections, /export type MoreDestination = 'menu' \| 'health' \| 'settings'/);
  assert.match(primaryData, /getLiveRecorderSnapshot/);
  assert.match(primaryData, /primary\.sections\.\$\{userId\}\.v1/);
  assert.match(primaryData, /buildTimeline/);
  assert.match(primaryData, /buildStatistics/);
  assert.match(primaryData, /buildSearchRecords/);
  assert.match(storage, /including points already uploaded/);
});

test('the fixed Statistics tab merges live Statistics with the recent Timeline and retains paid Atlas access', () => {
  assert.match(shell, /bottomNavigationItemsFor\(atlasAccess: boolean\)/);
  assert.match(shell, /label: 'Statistics'/);
  assert.match(shell, /key="statistics"[\s\S]*?<StatisticsScreen/);
  assert.match(shell, /onAtlas=\{membership\.atlasAccess \? openAtlas : undefined\}/);
  assert.match(shell, /atlasVisible && <View style=\{styles\.utilityOverlay\}><AtlasScreen/);
  assert.match(primarySections, /statistics\.current\.miles\.value\.toFixed\(1\)/);
  assert.match(primarySections, /Math\.round\(statistics\.current\.songs\.value\)/);
  assert.match(primarySections, /timelineItems\.slice\(0, visibleTimelineCount\)/);
  assert.match(primarySections, /Math\.min\(count \+ 10, timelineItems\.length\)/);
  assert.match(primarySections, /historyDays \* 86_400_000/);
  assert.match(primarySections, /song && item\.artworkUrl/);
  assert.match(primarySections, /TimelineRouteThumbnail coordinates=\{item\.route \?\? \[\]\}/);
  assert.match(primaryData, /accessibleJourneys = journeys\.filter/);
  assert.match(primaryData, /membershipCanAccessDate\(membership, journey\.startedAt\)/);
  assert.match(primaryData, /membership\.atlasAccess \? buildAtlasPatterns/);
  assert.match(primarySections, /UNLOCK ATLAS \+ COMPLETE HISTORY/);
  assert.match(shell, /<MembershipPaywall/);
});

test('Statistics reproduces the selected cinematic option-3 composition with live data', () => {
  assert.match(primarySections, /title="STATISTICS"[\s\S]*?headerPresentation="centered"[\s\S]*?pageTone="black"[\s\S]*?headerTone="statistics"/);
  assert.match(primarySections, /statistics-story-hero-v1\.png/);
  assert.match(primarySections, /THE ROAD YOU’VE LIVED/);
  assert.match(primarySections, /A month worth[\s\S]*?remembering\./);
  assert.match(primarySections, /Longest drive/);
  assert.match(primarySections, /Most-played/);
  assert.match(primarySections, /Favorite time/);
  assert.match(primarySections, /FREE HISTORY[\s\S]*?statistics\.windowDays/);
  assert.match(primarySections, /RECENT TIMELINE/);
  assert.match(primarySections, /first=\{index === 0\}[\s\S]*?last=\{index === visibleTimeline\.length - 1\}/);
  assert.match(primarySections, /storyTimelineMoreFill/);
  assert.match(primarySections, /storyStatsHero: \{ width: '100%', alignSelf: 'center', aspectRatio: HEADER_ARTWORK_ASPECT_RATIO/);
  assert.match(primarySections, /<HeaderEdgeBleed \/>/);
  assert.doesNotMatch(primarySections, /storyStatsHero: \{[^}]*borderWidth|storyStatsHero: \{[^}]*borderColor/);
});

test('Data Health can force a visible Apple Music artwork retry', () => {
  assert.match(primarySections, /Force Apple Music artwork refresh/);
  assert.match(primarySections, /Refresh artwork now/);
  assert.match(primarySections, /forceRefreshAllAppleMusicArtworkForDiagnostics/);
  assert.match(primarySections, /artworkRefreshState === 'running'/);
  assert.match(primarySections, /setArtworkRefreshDetail/);
  assert.match(primarySections, /onRefresh\(\)/);
  assert.match(musicCapture, /recentAppleSongs\(0\)/);
  assert.match(musicCapture, /enrichMusicEntriesWithArtwork\(userId,[\s\S]*?replaceExisting: true/);
  assert.match(musicCapture, /resolveMissingAppleMusicArtwork\(15, \{ force: true \}\)/);
  assert.match(musicCapture, /historyWarning = appleMusicHistoryWarning\(error\)/);
  assert.match(musicCapture, /The online catalog fallback still ran/);
  assert.match(primarySections, /const \[artworkRefreshState, setArtworkRefreshState\] = useState<'idle' \| 'running' \| 'complete' \| 'warning' \| 'error'>/);
  assert.match(primarySections, /report\.historyWarning \|\| report\.failed \? 'warning' : 'complete'/);
  assert.match(musicCapture, /listMusicEntries\(userId, 500\)/);
  assert.match(appleArtworkLookup, /!options\.force && \(attempts\[identity\] \?\? 0\) > cutoff/);
});

test('version 1 is manual-only while dormant automatic code stays fail-closed', () => {
  assert.match(releaseFeatures, /TESSIE_INTEGRATION_ENABLED: boolean = false/);
  assert.match(app, /const automaticMode = TESSIE_INTEGRATION_ENABLED &&/);
  assert.match(primarySections, /loadRecordingModePreferences/);
  assert.match(primarySections, /Ready for your next drive/);
  assert.match(primarySections, /Start a journey to capture its route and time/);
  assert.match(primarySections, /Apple Music adds the automatic soundtrack/);
  assert.match(primarySections, /SPEED/);
  assert.match(primarySections, /DISTANCE/);
  assert.match(primarySections, /ELAPSED/);
  assert.match(primarySections, /TESSIE_INTEGRATION_ENABLED && tessieConnected &&/);
  assert.match(primarySections, /TESSIE_INTEGRATION_ENABLED && tessieConnected &&/);
  assert.match(primarySections, /\{\(snapshot\.session \|\| !automaticMode\) && <View style=\{styles\.liveHero\}>/);
  assert.match(primarySections, /songMoments=\{visibleSongMoments\}/);
  assert.match(primaryMap, /validSongMoments\.map\(moment => <Marker/);
  assert.match(primaryMap, /selectedSong && <View style=\{styles\.songPopup\}>/);
  assert.match(primaryMap, /selectedSong\.artworkUrl/);
  assert.doesNotMatch(primarySections, /Connect Tessie in Settings to show live battery and range/);
});

test('Home owns the single recorder instance while Settings omits redundant recording controls', () => {
  assert.match(shell, /recorder=\{<Recorder presentation="home"/);
  assert.doesNotMatch(shell, /<LiveScreen|recorderVisible|setRecorderVisible|openTab\('live'\)/);
  assert.match(app, /presentation === 'home'/);
  assert.match(app, /Start Journey/);
  assert.match(app, /Identify Song/);
  assert.match(app, /End Journey/);
  assert.match(app, /showManualSongButton/);
  assert.match(shell, /useEffect\(\(\) => \{ void refreshMusicCapabilities\(\); \}, \[refreshMusicCapabilities\]\)/);
  assert.match(shell, /const storedAppleMusicConnected = dashboard\.data\.providerPreferences\?\.connections\.appleMusic === 'connected'/);
  assert.match(shell, /const appleMusicConnected = musicCapabilities === null[\s\S]*?storedAppleMusicConnected[\s\S]*?musicCapabilities\.appleMusicAuthorizationStatus === 'authorized'/);
  assert.match(shell, /const showManualSongButton = activePreferences\?\.provider !== 'apple-music' \|\| !appleMusicConnected/);
  assert.match(shell, /<Recorder presentation="home" showManualSongButton=\{showManualSongButton\}/);
  assert.doesNotMatch(shell, /<SectionHeading title="Recording" \/>/);
  assert.doesNotMatch(primarySections, /title="Record"|onRequestedChange\('record'\)|destination === 'record'/);
});

test('Settings is the fifth primary tab and keeps Data Health under Advanced Support', () => {
  assert.match(shell, /id: 'music', label: 'Soundtracks', symbol: 'music\.note'/);
  assert.match(shell, /id: 'journeys', label: 'Memories'/);
  assert.match(shell, /id: 'home', label: 'Home'/);
  assert.match(shell, /id: 'statistics', label: 'Statistics'/);
  assert.match(shell, /id: 'settings', label: 'Settings'/);
  assert.match(shell, /<MusicScreen state=\{musicDashboard\}/);
  assert.match(shell, /onSoundtracks=\{\(\) => openTab\('music'\)\}/);
  assert.doesNotMatch(shell, /accessibilityLabel="Open tools and settings"/);
  assert.match(shell, /accessibilityLabel="Open Data Health"/);
  assert.match(shell, /onDataHealth=\{\(\) => openMore\('health'\)\}/);
  assert.match(shell, /accessibilityState=\{\{ expanded: advancedSupportVisible \}\}/);
  assert.match(shell, /advancedSupportVisible && <Pressable accessibilityRole="button" accessibilityLabel="Open Data Health"/);
  assert.match(shell, /utilityVisible && <View style=\{styles\.utilityOverlay\}><MoreScreen/);
  assert.match(moreScreen, /title="Tools"/);
  assert.match(moreScreen, /title="Data Health"[\s\S]*?onRequestedChange\('health'\)/);
  assert.match(moreScreen, /title="Settings"[\s\S]*?onRequestedChange\('settings'\)/);
  assert.doesNotMatch(moreScreen, /Search all JourneyDeck|title="Timeline"|title="Statistics"|onRequestedChange\('search'\)|onRequestedChange\('timeline'\)|onRequestedChange\('statistics'\)/);
  assert.doesNotMatch(shell, /timelineHistoryDays=\{membership\.timelineHistoryDays\}[\s\S]*?<MoreScreen/);
  assert.doesNotMatch(primarySections, /title="Music" detail="Road soundtrack"/);
  assert.match(shell, /if \(tab === 'music'\) void refreshMusicDashboard\(true\)/);
  assert.match(shell, /forceAppleMusicArtworkRefreshAfterUpdate\(\)/);
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

test('first run uses the approved animation and manual-only version-1 recording setup', async () => {
  assert.match(shell, /<FirstRunOnboardingScreen/);
  assert.match(shell, /onRecordingContinue=\{async mode/);
  assert.match(shell, /onConnectAppleMusic=\{async \(\) =>/);
  assert.match(shell, /onSkipAppleMusic=\{async \(\) =>/);
  assert.match(shell, /completeFirstRun\(firstRunRecordingMode\)/);
  assert.match(firstRun, /onboarding\.first-run-v2/);
  assert.match(firstRun, /'welcome' \| 'recording' \| 'music' \| 'instructions' \| 'complete'/);
  assert.match(firstRunScreen, /onboarding-welcome-approved\.webp/);
  assert.match(firstRunScreen, /onboarding-welcome-approved-poster\.png/);
  assert.match(firstRunScreen, /setTimeout\([\s\S]*?2500/);
  assert.match(firstRunScreen, /const onCompleteRef = useRef\(onComplete\)/);
  assert.match(firstRunScreen, /onCompleteRef\.current\(\)/);
  assert.match(firstRunScreen, /\}, \[loaded\]\)/);
  assert.doesNotMatch(firstRunScreen, /\[loaded, onComplete\]/);
  assert.match(firstRunScreen, /AccessibilityInfo\.isReduceMotionEnabled\(\)/);
  assert.match(firstRunScreen, /onboarding-road-background\.png/);
  assert.match(firstRunScreen, /useSafeAreaInsets\(\)/);
  assert.match(firstRunScreen, /paddingTop: insets\.top \+ 10/);
  assert.match(firstRunScreen, /paddingBottom: Math\.max\(insets\.bottom, 12\)/);
  assert.match(firstRunScreen, /<ScrollView/);
  assert.match(firstRunScreen, /styles\.fixedAction/);
  assert.match(firstRunScreen, /<RecordingChoice selected/);
  assert.doesNotMatch(firstRunScreen, /<RecordingChoice mode="automatic"/);
  assert.match(firstRunScreen, /await onContinue\('manual'\)/);
  assert.match(firstRunScreen, /Continue with Manual/);
  assert.doesNotMatch(firstRunScreen, /DESIGN_WIDTH|DESIGN_HEIGHT|useDesignRect|contentFit="cover"[\s\S]*?GPS_AUTOMATIC/);
  assert.match(firstRunScreen, /Continue without Apple Music/);
  assert.match(firstRunScreen, /label="Let the Journey Begin" onPress=\{onFinish\}/);
  assert.match(firstRunScreen, /<ProgressHeader step="04 \/ 04" \/>/);
  assert.doesNotMatch(firstRunScreen, /04A \/ 04|04B \/ 04/);
  assert.match(welcomeIntro, /onboarding\.welcome-intro/);

  const expected = new Map([
    ['onboarding-welcome-approved.webp', 'D9FE45E62312539FA9511A947BDDC2E1A957EF99822DF99E3EA3F26B18EB02AB'],
    ['onboarding-welcome-approved-poster.png', '2E9C330A0C6AFB9C66026A077024A3A5DAAACD68900A561DC0E62AFB73251CB7'],
  ]);
  for (const [name, hash] of expected) {
    const bytes = await readFile(new URL(`../assets/${name}`, import.meta.url));
    assert.equal(createHash('sha256').update(bytes).digest('hex').toUpperCase(), hash, `${name} must remain byte-for-byte approved`);
  }
});

test('Home and navigation reproduce the approved manual-recorder composition', () => {
  assert.match(shell, /home-recorder-coast-v1\.png/);
  assert.match(shell, /style=\{styles\.approvedHomeHeader\}/);
  assert.match(shell, /style=\{\[styles\.approvedHomeScenicSpace, recorderActive && styles\.approvedHomeScenicSpaceActive\]\}/);
  assert.match(shell, /<Text accessibilityRole="header" style=\{styles\.approvedHomeTitle\}>HOME<\/Text>/);
  assert.match(shell, /recorder=\{<Recorder presentation="home"/);
  assert.match(shell, /Latest memory/);
  assert.match(shell, /LATEST SONG PLAYED/);
  assert.match(shell, /latestTrack \? <Artwork track=\{latestTrack\} size=\{58\}/);
  assert.match(shell, /onJourney\(latestJourney\.id\)/);
  assert.match(shell, /symbol: 'house'/);
  assert.match(shell, /function IntegratedNavigationChrome/);
  assert.match(shell, /H 157 C 179 1 180 -20 215 -20/);
  assert.match(shell, /navCenterPedestalRing/);
  assert.match(shell, /navCenterPedestalCore/);
  assert.doesNotMatch(shell, /navCenterLabelPlate|navCenterLabel:/);
  assert.match(shell, /size=\{31\} weight="medium" tintColor="#ff9b73" style=\{styles\.navCenterSymbol\}/);
  assert.match(shell, /navCenterSymbolFrame: \{[\s\S]*?width: 66[\s\S]*?height: 66/);
  assert.doesNotMatch(shell, /style=\{styles\.navCenterPedestal\}/);
  assert.doesNotMatch(shell, /<Reanimated\.View[\s\S]*?styles\.navGlidingIndicator/);
  assert.match(shell, /recorderActive && styles\.approvedHomeScenicSpaceActive/);
  assert.match(shell, /approvedHomeScenicSpace: \{ height: 70 \}/);
  assert.match(shell, /approvedHomeScenicSpaceActive: \{ height: 85 \}/);
  assert.match(app, /Your journey is being remembered\./);
  assert.match(app, /const startupPending = !deviceId \|\| !recorderInitialized/);
  assert.match(app, /const showStartPortal = !active && !automaticMode && \(startupPending \|\| permissionsReady\)/);
  assert.match(app, /showStartPortal \? \(\s*<HomeRecorderStartPortal onPress=\{start\} disabled=\{busy \|\| startupPending\} showProgress=\{busy\} \/>/);
  assert.match(app, /refresh\(\)\.catch\(\(\) => \{\}\)\.finally\(\(\) => \{ if \(mounted\) setRecorderInitialized\(true\); \}\)/);
  assert.doesNotMatch(app, /Preparing your private recorder|homeRecorderPreparing/);
  assert.match(app, /function HomeRecorderStartPortal/);
  assert.match(app, /testID="home-start-journey-portal"[\s\S]*?accessibilityRole="button"[\s\S]*?accessibilityLabel="Start Journey"[\s\S]*?onPress=\{onPress\}/);
  assert.match(app, /homeRecorderStartPortalCanvas[\s\S]*?HomeRecorderStartPortalAtmosphere[\s\S]*?homeRecorderStartPortalPulseCore[\s\S]*?>READY<[\s\S]*?>Start Journey<[\s\S]*?name="arrow\.right"/);
  assert.match(app, /function HomeRecorderStartPortalAtmosphere[\s\S]*?startPortalGlass[\s\S]*?startPortalCoral[\s\S]*?stopOpacity="0"/);
  assert.match(app, /id="startPortalCoral" cx="50%" cy="54%" rx="82%" ry="78%" fx="50%" fy="70%"[\s\S]*?offset="1" stopColor="#ff7654" stopOpacity="0\.10"/);
  assert.match(app, /<Rect width="360" height="360" rx="30" ry="30" fill="url\(#startPortalCoral\)" \/>/);
  assert.doesNotMatch(app, /homeRecorderStartPortalAtmosphere: \{[^}]*borderRadius|homeRecorderStartPortalAtmosphere: \{[^}]*overflow/);
  assert.match(app, /homeRecorderStartPortal: \{ minHeight: 360 \}/);
  assert.match(app, /homeRecorderStartPortalPressed: \{ transform: \[\{ scale: 0\.992 \}\] \}/);
  assert.doesNotMatch(app, /homeRecorderStartPortalBorder|homeRecorderStartPortalGlass:|homeRecorderStartPortalBloom|homeRecorderStartPortalDisabled|homeRecorderStartPortalPressed: \{ opacity/);
  assert.match(app, /pointerEvents="none" style=\{styles\.homeRecorderStartPortalOutline\}/);
  assert.match(app, /homeRecorderStartPortalOutline: \{[\s\S]*?borderRadius: 30[\s\S]*?borderWidth: 1[\s\S]*?borderColor: 'rgba\(255,126,88,0\.92\)'[\s\S]*?shadowColor: '#ff704f'/);
  assert.doesNotMatch(shell, /approvedHomeMusicDot|const hasMusic = Boolean\(latestTrack\)/);
  assert.doesNotMatch(app, /HomeRecorderPrimaryAction label="Start Journey"/);
  assert.match(app, /const withBusy = useCallback\(async[\s\S]*?if \(busyRef\.current\) return;[\s\S]*?busyRef\.current = true/);
  assert.match(app, /function HomeRecorderPrimaryAction/);
  assert.match(app, /label="Identify Song"/);
  assert.match(app, /label="End Journey"/);
  assert.match(app, /routeDistanceMiles/);
  assert.match(app, /presentation === 'home'/);
  assert.match(profileAppearance, /profile\.appearance/);
  assert.match(profileAppearance, /upsertPrivatePreference/);
  assert.match(storage, /if \(changed\) notifyLocalArchiveChanged\(\)/);
});

test('Music background loading cannot activate the native refresh inset', () => {
  assert.match(musicScreen, /refreshing=\{manualRefreshing\}/);
  assert.match(musicScreen, /contentInsetAdjustmentBehavior="never"/);
  assert.match(musicScreen, /automaticallyAdjustContentInsets=\{false\}/);
  assert.doesNotMatch(musicScreen, /refreshing=\{state\.status/);
});

test('every major destination has a distinct cinematic header scene', () => {
  assert.match(shell, /<PageHeader variant="memories"/);
  assert.match(shell, /memories-header-cinematic-v1\.png/);
  assert.match(shell, /<PageHeader variant="settings"/);
  assert.match(shell, /function PageHeaderScene/);
  assert.match(shell, /settingsHeaderLink/);
  assert.match(musicScreen, /soundtracks-header-cinematic-v2\.png/);
  assert.match(primarySections, /live-header-cinematic-v1\.png/);
  assert.match(primarySections, /atlas-header-cinematic-v1\.png/);
  assert.match(shell, /settings-header-cinematic-v1\.png/);
});

test('Shared tab background loading cannot activate the native refresh inset', () => {
  assert.match(primarySections, /refreshing=\{manualRefreshing\}/);
  assert.match(primarySections, /await onRefresh\(\)/);
  assert.doesNotMatch(primarySections, /refreshing=\{state\.status/);
  assert.doesNotMatch(primarySections, /refreshing=\{refreshing\}/);
});

test('every destination artwork header shares one frameless, feathered frame', () => {
  assert.match(headerArtwork, /HEADER_ARTWORK_ASPECT_RATIO = 1672 \/ 941/);
  assert.match(headerArtwork, /aspectRatio: HEADER_ARTWORK_ASPECT_RATIO/);
  assert.match(headerArtwork, /contentFit="cover"/);
  assert.match(headerArtwork, /function HeaderEdgeFeather/);
  assert.match(headerArtwork, /function HeaderEdgeBleed/);
  assert.match(headerArtwork, /bleedLeft[\s\S]*?bleedRight[\s\S]*?bleedTop[\s\S]*?bleedBottom/);
  assert.match(musicScreen, /heroCardHeader: \{ width: '100%', aspectRatio: HEADER_ARTWORK_ASPECT_RATIO/);
  assert.match(musicScreen, /HeaderArtwork source=\{require\('\.\.\/assets\/soundtracks-header-cinematic-v2\.png'\)\}/);
  assert.doesNotMatch(musicScreen, /heroVinylMotionFrame|soundtracksSpinningVinyl|Animated\.loop/);
  assert.match(shell, /HeaderArtwork[\s\S]*?memories-header-cinematic-v1\.png/);
  assert.match(primarySections, /artHeader: \{ position: 'relative', zIndex: 0, alignSelf: 'stretch', marginBottom: 22/);
  assert.match(shell, /pageArtHeader: \{ position: 'relative', zIndex: 0, alignSelf: 'stretch', marginBottom: 14/);
  assert.match(primarySections, /statsPageTitle: \{ position: 'relative', zIndex: 10, elevation: 10/);
  assert.match(shell, /cinematicPageTitle: \{ position: 'relative', zIndex: 10, elevation: 10/);
  assert.doesNotMatch(primarySections, /artHeader: \{[^}]*marginHorizontal: -4/);
  assert.doesNotMatch(shell, /pageArtHeader: \{[^}]*marginHorizontal: -4/);
  assert.match(app, /recorderArtHeader: \{ alignSelf: 'stretch', marginHorizontal: -4/);
});

test('Soundtracks uses a frameless static header and Memories filters align with content cards', () => {
  assert.match(musicScreen, /heroCardHeader: \{ width: '100%', aspectRatio: HEADER_ARTWORK_ASPECT_RATIO \}/);
  assert.doesNotMatch(musicScreen, /heroCardHeader: \{[^}]*borderWidth|heroCardHeader: \{[^}]*borderRadius/);
  assert.match(shell, /libraryTabs: \{[\s\S]*?marginHorizontal: 20/);
  assert.match(shell, /librarySearchFrame: \{[\s\S]*?marginHorizontal: 20/);
  assert.match(shell, /libraryFilterRow: \{[\s\S]*?marginHorizontal: 20/);
  assert.match(shell, /memoryJourneyList: \{ marginHorizontal: 20/);
});

test('Memory photo cards keep their photos visible and omit generic sequence labels', () => {
  assert.doesNotMatch(shell, /memoryHeroKicker}>MEMORY \{String\(index \+ 1\)/);
  assert.match(shell, /memory-default-floating-timeline-v1\.jpg/);
  assert.doesNotMatch(shell, /memoryArtRoad/);
  assert.match(shell, /style=\{styles\.memoryCardShade\}/);
  assert.match(shell, /memoryCardShade: \{[^}]*bottom: 0, height: 92/);
  assert.match(shell, /memoryCardTitle: \{ marginTop: 0/);
  assert.match(shell, /memoryCardMeta: \{ marginTop: 2/);
});

test('music chooser and Settings use approved service marks with honest provider wording', () => {
  assert.match(shell, /apple-music-icon\.png/);
  assert.match(shell, /shazam-icon\.png/);
  assert.match(shell, /spotify-icon-white\.png/);
  assert.match(shell, /function ProviderMark/);
  assert.match(shell, /name: 'Spotify history', kicker: 'IMPORTED VIA LAST\.FM'/);
  assert.match(shell, /Import timestamped Spotify listening history through your Last\.fm account/);
  assert.match(shell, /<SectionHeading title="Soundtrack capture" \/>/);
  assert.match(shell, /<ProviderMark brand=\{selected\.brand\} size=\{50\} \/>/);
  assert.match(shell, /<Text style=\{styles\.changeButtonText\}>Change<\/Text>/);
  assert.doesNotMatch(shell, /ConnectionTile name="Apple Music"/);
  assert.doesNotMatch(shell, /ConnectionTile name="Manual Song Recognition"/);
  assert.match(shell, /AUTOMATIC SOUNDTRACK · RECOMMENDED/);
  assert.match(shell, /you must tap Identify Song for every track/i);
  assert.match(app, /label="Identify Song"/);
  assert.match(app, /allowAdHoc: true/);
  assert.match(musicScreen, /AUTOMATIC · RECOMMENDED/);
  assert.match(musicScreen, /MANUAL · ONE SONG AT A TIME/);
  assert.match(shell, /ConnectionTile name="Spotify history"[\s\S]*?brand="spotify"/);
  assert.match(shell, /SPOTIFY HISTORY VIA LAST\.FM/);
  assert.match(releaseFeatures, /TESSIE_INTEGRATION_ENABLED: boolean = false/);
  assert.doesNotMatch(shell, /Tessie Automatic Recording|Drive intelligence|function TessieMark/i);
  assert.doesNotMatch(shell, /name: 'Last\.fm for Spotify'/);
});

test('native dashboards use static cinematic lighting and Music has intentional artwork and mileage graphics', () => {
  assert.match(musicScreen, /function RouteGlow\(\)[\s\S]*?<Svg/);
  assert.match(musicScreen, /strokeDasharray="5 7"/);
  assert.doesNotMatch(musicScreen, /routeLineOne|routeLineTwo/);
  assert.match(musicScreen, /function SoundtracksHeroHeader/);
  assert.match(musicScreen, /heroCardHeader: \{ width: '100%', aspectRatio: HEADER_ARTWORK_ASPECT_RATIO/);
  assert.match(musicScreen, /soundtracks-header-cinematic-v2\.png/);
  assert.doesNotMatch(musicScreen, /Animated\.loop|heroVinylMotionFrame|soundtracksSpinningVinyl|heroVinylDisc/);
  assert.doesNotMatch(musicScreen, /M100 100L26 26|M100 100L174 174/);
  assert.match(musicScreen, /\{data \? <>\s*<View style=\{styles\.metricGrid\}>/);
  assert.doesNotMatch(musicScreen, /YOUR LIFE HAS A|function VinylHeroRecord|styles\.hero\}/);
  assert.match(musicScreen, /<View style=\{styles\.albumCaption\}>[\s\S]*?styles\.albumTitle[\s\S]*?styles\.albumArtist/);
  assert.match(musicScreen, /albumCard: \{ width: 112, height: 158/);
  assert.match(musicScreen, /albumCaption: \{ height: 46,[\s\S]*?paddingLeft: 7[\s\S]*?paddingBottom: 3/);
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
  assert.match(app, /function RecorderScreen\(\{ onClose, presentation = 'screen', showManualSongButton = false, onJourneyChange, onActivityChange \}/);
  assert.match(app, /const insets = useSafeAreaInsets\(\)/);
  assert.match(app, /paddingTop: insets\.top \+ 14/);
  assert.match(app, /contentInsetAdjustmentBehavior="never"/);
});

test('Memory detail directly groups Journeys with the approved cinematic presentation', () => {
  assert.match(shell, /function MemoryDetailModal/);
  assert.match(shell, /function MemoryDetailModal[\s\S]*?return <View style=\{\[styles\.memoryDetailRoot, StyleSheet\.absoluteFill, \{ zIndex: 100 \}\]\}/);
  assert.doesNotMatch(shell, /return <Modal visible transparent animationType="none" statusBarTranslucent/);
  assert.match(shell, /import \{ BlurView \} from 'expo-blur'/);
  assert.match(shell, /import \{ LinearGradient \} from 'expo-linear-gradient'/);
  assert.match(shell, /from 'react-native-reanimated'/);
  assert.match(shell, /withDelay\(170, withTiming/);
  assert.match(shell, /memoryDetailBreadcrumbActive}>Memory<[\s\S]*?memoryDetailBreadcrumbMuted}>Journeys</);
  assert.match(shell, /JOURNEYS IN THIS MEMORY/);
  assert.match(shell, /journeys\.map\(\(journey, index\) => <Reanimated\.View/);
  assert.doesNotMatch(shell, /function MemoryRoadThread|function MemoryCollectionChapter|function CollectionPlaceholderArtwork/);
  assert.match(shell, /closeMemoryThen/);
  assert.match(shell, /onOpenJourney\(journey\.id\)/);
});

test('Memory editor remains usable while the iOS keyboard is open', () => {
  assert.match(shell, /KeyboardAvoidingView style=\{styles\.overlayKeyboardAvoider\}/);
  assert.match(shell, /behavior=\{Platform\.OS === 'ios' \? 'padding' : 'height'\}/);
  assert.match(shell, /keyboardDismissMode=\{Platform\.OS === 'ios' \? 'interactive' : 'on-drag'\}/);
  assert.match(shell, /Keyboard\.addListener\('keyboardDidShow'/);
  assert.match(shell, /accessibilityLabel="Dismiss keyboard"/);
  assert.match(shell, /<Text style=\{styles\.overlayKeyboardDoneText\}>Done<\/Text>/);
});

test('Memory editor stages direct Journey membership before first save and exposes saved state', () => {
  assert.match(shell, /function memoryDraftSignature/);
  assert.match(shell, /type MemoryEditorDraft = \{[^}]*journeyIds: string\[\]/);
  assert.match(shell, /const toggleMemoryJourney = \(id: string\) => setMemoryDraft/);
  assert.match(shell, /A Memory needs at least one journey/);
  assert.match(shell, /JOURNEYS IN THIS MEMORY/);
  assert.match(shell, /setMemorySavedSignature\(memoryDraftSignature\(next\)\)/);
  assert.equal(shell.match(/DraftDirty \? 'SAVE' : 'SAVED'/g)?.length, 1);
  assert.equal(shell.match(/disabled=\{saving \|\| ![a-zA-Z]+DraftDirty\}/g)?.length, 1);
  assert.match(shell, /editorSaveSaved: \{ backgroundColor: '#43e6ae' \}/);
});

test('Journey details keep one dark route map beneath a map-free summary hero', () => {
  const journeyHero = shell.slice(shell.indexOf('function JourneyCinematicHero'), shell.indexOf('function JourneyHeroMetric'));
  const journeyAtmosphere = shell.slice(shell.indexOf('function JourneyHeroAtmosphere'), shell.indexOf('function JourneyCinematicHero'));
  assert.match(shell, /function JourneyCinematicHero/);
  assert.match(shell, /<JourneyCinematicHero journey=\{journey\} title=\{displayTitle\} \/>/);
  assert.match(shell, /kicker="ROAD MEMORY" title="Drive details"/);
  assert.match(shell, /loadCityLabelForCoordinate/);
  assert.match(journeyAtmosphere, /journey-detail-memory-hero-v1\.jpg/);
  assert.match(journeyAtmosphere, /<ExpoImage/);
  assert.match(journeyAtmosphere, /contentFit="cover"/);
  assert.match(journeyAtmosphere, /cachePolicy="memory-disk"/);
  assert.doesNotMatch(journeyAtmosphere, /<Path|RouteSketch|InteractiveRouteMap/);
  assert.match(journeyHero, /styles\.journeyHeroIntro/);
  assert.doesNotMatch(journeyHero, /RouteSketch|InteractiveRouteMap/);
  assert.doesNotMatch(journeyHero, /journeyHeroGlowCoral|journeyHeroGlowViolet/);
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

test('Saved journey location names refresh the reopened detail and every journey-backed section', () => {
  const refreshLocations = shell.slice(shell.indexOf('const refreshJourneyLocations'), shell.indexOf('const syncPrivateCloud'));
  assert.match(shell, /await appDataClient\.savePlaceAlias\(startingLocationKey, start, routeStart/);
  assert.match(shell, /await appDataClient\.savePlaceAlias\(endingLocationKey, end, routeEnd/);
  assert.match(shell, /journey:\$\{journey\?\.id \?\? 'unavailable'\}:start/);
  assert.match(refreshLocations, /appDataClient\.journey\(selectedJourneyId/);
  assert.match(refreshLocations, /refreshPrimarySections\(false\)/);
  assert.match(refreshLocations, /setJourneyDetail\(\{ status: 'ready', data: detail \}\)/);
});

test('Settings presents one iCloud Backup status and keeps Apple identity under Account', () => {
  assert.match(shell, /AppleAuthentication\.AppleAuthenticationButton/);
  assert.match(shell, /onAppleSignIn/);
  assert.match(shell, /onPrivateCloudSync/);
  assert.match(shell, /<SectionHeading title="iCloud Backup" \/>/);
  assert.match(shell, /Your JourneyDeck library stays private in your iCloud account/);
  assert.match(shell, /<SectionHeading title="Account" \/>/);
  assert.match(shell, /Apple connected/);
  assert.match(shell, /Apple sign-in is optional/);
});

test('Journey sharing has web-parity controls and never exports raw saved-place geometry', () => {
  assert.match(shell, /function privacySafeRealShareRoute/);
  assert.match(shell, /prepareShareCardCoords/);
  assert.match(shell, /const sensitivePlaces = \[\.\.\.getSensitivePlaces\(userId\), \.\.\.inferredPrivatePlaces\]/);
  assert.match(shell, /buildSongRouteMoments\(journey\.soundtrack, routeCoordinates/);
  assert.match(shell, /maskCoordinate\(\{ lng: point\.coordinate\[0\], lat: point\.coordinate\[1\] \}, sensitivePlaces\)/);
  assert.match(shell, /const shareRoute = privacySafeRealShareRoute\(journey\)/);
  assert.match(shell, /trimPrivateShareRoute/);
  assert.match(shareRoutePrivacy, /PRIVATE_SHARE_ROUTE_DISTANCE_METERS = 1_609\.344/);
  assert.match(shareRoutePrivacy, /Randomized endpoints are intentionally avoided/);
  assert.match(shareRoutePrivacy, /distanceMeters\(endpoint, firstSong\.point\.coordinate\)/);
  assert.match(shareRoutePrivacy, /distanceMeters\(endpoint, lastSong\.point\.coordinate\)/);
  assert.match(shareCard, /function JourneyShareControls/);
  assert.match(shareCard, /BUILD YOUR CARD/);
  assert.match(shareCard, /Featured album/);
  assert.match(shareCard, /SHOW ON CARD/);
  assert.doesNotMatch(shareCard, /Efficiency|EFFICIENCY|'efficiency'/);
  assert.match(shareCard, /function ShareRouteSnapshot/);
  assert.match(shareCard, /function JourneyDeckMapTile/);
  assert.match(shareCard, /ColorMatrix matrix=\{shareMapColorMatrix\}/);
  assert.match(shareCard, /background: '#05020a'/);
  assert.match(shareCard, /road: '#8a4c9a'/);
  assert.match(shareCard, /route: '#ff684f'/);
  assert.match(shareCard, /colorizedInvertedLuminanceRow/);
  assert.match(shareCard, /rgba\(5,2,10,0\.02\)/);
  assert.match(shareCard, /SHARE_ROUTE_WIDTH_FILL = 0\.84, SHARE_ROUTE_HEIGHT_FILL = 0\.76/);
  assert.match(shareCard, /const fractionalZoom = Math\.max\(3, Math\.min\(18/);
  assert.match(shareCard, /tileRenderScale = 2 \*\* \(fractionalZoom - tileZoom\)/);
  assert.match(shareCard, /songPoints=\{journey\.songPoints\}/);
  assert.match(shareCard, /share-song-\$\{marker\.index\}/);
  assert.match(shareCard, /shareStartPrivacyFade/);
  assert.match(shareCard, /shareEndPrivacyFade/);
  assert.doesNotMatch(shareCard, /PRIVATE AREA HIDDEN|Private area hidden/);
  assert.match(shareCard, /fill="#36defa" opacity="0\.2"/);
  assert.match(shareCard, /fill="#07303a" stroke="#36defa"/);
  assert.match(shareCard, /stroke="#d9fbff"/);
  assert.match(shareCard, /SAVED PLACE SEGMENT TRIMMED/);
  assert.match(shareCard, /https:\/\/tile\.openstreetmap\.org/);
  assert.match(shareCard, /function privacySafeJourneyRoute/);
  assert.doesNotMatch(shareCard, /privateCityRoute/);
  assert.match(shareCard, /REAL ROUTE · PRIVATE ZONES MASKED/);
  assert.match(shareCard, /function JourneyDeckShareMark/);
  assert.match(shareCard, /require\('\.\.\/assets\/icon\.png'\)/);
  assert.doesNotMatch(shareCard, /<Text style=\{styles\.markText\}>J<\/Text>/);
  assert.match(shareCard, /height: payload\.journey \? 1550 : 1350/);
  assert.match(shareCard, /journeyShareCard: \{ height: 465/);
});
