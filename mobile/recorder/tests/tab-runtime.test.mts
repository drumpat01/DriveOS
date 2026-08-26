import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const sourceRoot = new URL('../src/', import.meta.url);
const shell = await readFile(new URL('shell.tsx', sourceRoot), 'utf8');
const musicScreen = await readFile(new URL('music-screen.tsx', sourceRoot), 'utf8');
const shareCard = await readFile(new URL('share-card-modal.tsx', sourceRoot), 'utf8');
const app = await readFile(new URL('../App.tsx', import.meta.url), 'utf8');

test('tabs use one persistent native pager instead of blackout remounts', () => {
  assert.match(shell, /<PagerView/);
  assert.match(shell, /scrollEnabled=\{false\}/);
  assert.match(shell, /offscreenPageLimit=\{bottomNavigationItems\.length\}/);
  assert.match(shell, /key="home"/);
  assert.match(shell, /key="journeys"/);
  assert.match(shell, /key="music"/);
  assert.match(shell, /key="record"/);
  assert.match(shell, /key="connections"/);
  assert.doesNotMatch(shell, /transitionVeil|visibleTab|recorderHidden/);
});

test('Music background loading cannot activate the native refresh inset', () => {
  assert.match(musicScreen, /refreshing=\{manualRefreshing\}/);
  assert.match(musicScreen, /contentInsetAdjustmentBehavior="never"/);
  assert.match(musicScreen, /automaticallyAdjustContentInsets=\{false\}/);
  assert.doesNotMatch(musicScreen, /refreshing=\{state\.status/);
});

test('Memories, Music, and Settings each have a distinct cinematic header scene', () => {
  assert.match(shell, /<PageHeader variant="memories"/);
  assert.match(shell, /memories-header-hero\.png/);
  assert.match(shell, /<PageHeader variant="settings"/);
  assert.match(shell, /function PageHeaderScene/);
  assert.match(shell, /settingsHeaderLink/);
  assert.match(musicScreen, /music-header-hero\.png/);
  assert.match(musicScreen, /function MusicHeaderScene/);
  assert.match(musicScreen, /musicSceneGlow|soundwaveGrad/);
  assert.match(musicScreen, /musicHeaderStyles\.spectrum/);
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
  assert.match(shell, /Better with Tesla \+ Tessie/);
  assert.match(shell, /https:\/\/www\.tessie\.com\//);
  assert.doesNotMatch(shell, /name: 'Last\.fm for Spotify'/);
});

test('native dashboards use static cinematic lighting and Music has intentional artwork and mileage graphics', () => {
  assert.match(musicScreen, /function RouteGlow\(\)[\s\S]*?<Svg/);
  assert.match(musicScreen, /strokeDasharray="5 7"/);
  assert.doesNotMatch(musicScreen, /routeLineOne|routeLineTwo/);
  assert.match(musicScreen, /function VinylHeroRecord/);
  assert.match(musicScreen, /Animated\.loop[\s\S]*?duration: 22000/);
  assert.match(musicScreen, /vinylCenterLabel: \{ width: 60, height: 60/);
  assert.match(musicScreen, /metric: \{[\s\S]*?shadowColor: '#9b61ff'/);
  assert.match(shell, /staticWidgetGlow/);
  assert.match(shell, /webDashboardShell: \{[\s\S]*?shadowColor: '#9d58ff'/);
  assert.match(app, /statusCard: \{[\s\S]*?shadowColor: '#9b61ff'/);
  assert.match(app, /metrics: \{[\s\S]*?shadowColor: '#9b61ff'/);
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
  assert.match(shell, /GPS recorded/);
  assert.match(shell, /OpenStreetMap contributors/);
  assert.match(shell, /Route will appear after the journey syncs/);
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
