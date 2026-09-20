import { touchFeedbackMock } from './touch-feedback-fixture.mts';
import { testTheme } from './theme-fixture.mts';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';
import React from 'react';
import { act, create } from 'react-test-renderer';
import ts from 'typescript';

const require = createRequire(import.meta.url);
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const host = (name: string) => ({ children, ...props }: any) => React.createElement(name, props, children);
const source = readFileSync(new URL('../src/shell.tsx', import.meta.url), 'utf8');
let tablet = true, light = true, viewportWidth = 1100, viewportHeight = 800, viewportFontScale = 1;
let adaptiveFold: any = null;
const colors = { isLight: true, name: 'Cinematic Dark', palette: { accent: '#b795e5', inset: '#291735' }, color: (value: string) => value, gradient: (values: any) => values };
const controls = Object.fromEntries(['View', 'Text', 'ScrollView', 'Pressable', 'ActivityIndicator', 'Switch', 'Image', 'TextInput'].map(name => [name, host(name)]));
function evaluate(sourceText: string, mocks: Record<string, any> = {}, globals: Record<string, any> = {}) {
  const module = { exports: {} as any };
  const code = ts.transpileModule(sourceText, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, require: (id: string) => id === './touch-feedback' ? touchFeedbackMock : id in mocks ? mocks[id] : id === './theme-catalog.ts' ? require('../src/theme-catalog.ts') : id.startsWith('../assets/') ? id : require(id), ...globals });
  return module.exports;
}
const viewport = evaluate(readFileSync(new URL('../src/settings-scroll-view.tsx', import.meta.url), 'utf8'), {
  'react-native': controls, 'react-native-safe-area-context': { SafeAreaView: host('SafeAreaView') },
  './device-layout': { isIpad: () => tablet }, './app-theme': { useAppTheme: () => testTheme(light) },
});
const viewSource = source.slice(source.indexOf('function ConnectionsScreen('), source.indexOf('function JourneyDeckLogo('));
const links: string[] = [], modes: string[] = [];
let internalTesting = false;
const header = evaluate(readFileSync(new URL('../src/ipad-page-header.tsx', import.meta.url), 'utf8'), {
  'react-native': { ...controls, StyleSheet: { create: (v: any) => v }, useWindowDimensions: () => ({ fontScale: viewportFontScale }) }, 'expo-image': { Image: host('Image') }, 'expo-linear-gradient': { LinearGradient: host('Gradient') },
  './app-theme': { useAppTheme: () => testTheme(light) }, './header-artwork': { HeaderArtworkLayers: host('HeaderArtworkLayers'), HEADER_ARTWORK_ASPECT_RATIO: 1672 / 941 },
  './phone-tab-title': { PhoneTabTitle: host('PhoneTabTitle'), AutumnTitleAccent: host('AutumnTitleAccent') }, './device-layout': { ipadGridColumns: (width: number, scale = 1) => width / scale >= 900 ? 6 : 3, ipadGridSpan: (width: number, span: number) => (width - 60) / 6 * span + 12 * (span - 1) },
});
const ipad = evaluate(readFileSync(new URL('../src/ipad-settings-screen.tsx', import.meta.url), 'utf8'), {
  './ipad-page-header': header,
  './theme-picker': { ThemePicker: host('ThemePicker') },
  './app-icon-picker': { AppIconPicker: host('AppIconPicker') },
  './place-data-credits': { PlaceDataCredits: host('PlaceDataCredits') },
  './achievements-overview': { AchievementsOverview: host('AchievementsOverview') },
  './settings-categories': require('../src/settings-categories.ts'),
  'react-native': { ...controls, StyleSheet: { create: (v: any) => ({ ...v, hairlineWidth: 1 }), hairlineWidth: 1 }, useWindowDimensions: () => ({ width: viewportWidth, height: viewportHeight, fontScale: viewportFontScale }),
    Linking: { openURL: async (url: string) => { links.push(url); } }, Alert: { alert: () => {} } },
  'expo-image': { Image: host('Image') }, 'expo-linear-gradient': { LinearGradient: host('Gradient') },
  'expo-symbols': { SymbolView: host('Symbol') },
  'expo-apple-authentication': { AppleAuthenticationButton: host('AppleSignIn'), AppleAuthenticationButtonType: { CONTINUE: 1 }, AppleAuthenticationButtonStyle: { WHITE: 1, BLACK: 2 } },
  'react-native-safe-area-context': { SafeAreaView: host('SafeAreaView'), useSafeAreaInsets: () => ({ bottom: 20 }) },
  './app-theme': { useThemeChoice: () => ({ theme: testTheme(light), setMode: (mode: string) => modes.push(mode) }) },
  './theme-palette': { ivoryPalette: { page: '#fffaf0', surface: '#fffcf6', text: '#291d26', secondary: '#685461', violet: '#754487', border: '#d8c5ba', lilac: '#eee2ef' } },
  './header-image-sources': { headerImageSource: (source: any) => source },
  './adaptive-layout': { useAdaptiveLayout: () => ({ fold: adaptiveFold }) },
});
const ui = evaluate(viewSource + '\nexports.ConnectionsScreen = ConnectionsScreen;', {}, {
  ...controls, ...touchFeedbackMock, ThemePicker: host('ThemePicker'), AppIconPicker: host('AppIconPicker'), useState: React.useState, useEffect: React.useEffect,
  useAdaptiveLayout: () => ({ isRegular: tablet, fold: adaptiveFold }),
  V3_MARKERS_PROTOTYPE_ENABLED: false,
  router: { push: () => undefined },
  useAppTheme: () => colors, useThemeChoice: () => ({ theme: colors, setMode: () => {} }),
  useAppIconChoice: () => ({ appIconId: 'original' }), appIconCatalog: { original: { name: 'Cinematic' } },
  settingsCategories: require('../src/settings-categories.ts').settingsCategories,
  useThemedStyles: () => new Proxy({}, { get: () => ({}) }), darkStyles: {},
  useSafeAreaInsets: () => ({ top: 24, bottom: 20 }), isIpad: () => tablet,
  loadSavedPlaces: () => ({}), loadCustomSavedPlaces: () => [{ id: 'saved-custom-place-v1-gym', label: 'Gym' }], loadProfileAppearance: () => ({ displayName: 'Test driver', avatarDataUri: null }), profileInitialsFor: () => 'TD',
  selectableProviderOptions: () => [{ id: 'apple-music', color: '#ff9478', name: 'Apple Music' }], publicProviderOptions: [], SAVED_PLACE_SLOTS: [{ id: 'home', label: 'Home', symbol: 'house' }, { id: 'work', label: 'Work', symbol: 'briefcase' }, { id: 'school', label: 'School', symbol: 'graduationcap' }],
  IpadSettingsScreen: ipad.IpadSettingsScreen, SettingsScrollView: viewport.SettingsScrollView, SettingsEditorScaffold: host('SettingsEditorScaffold'), SettingsProfileEditor: host('ProfileEditor'), SettingsSavedPlaceEditor: host('PlaceEditor'), SettingsCustomPlaceEditor: host('CustomPlaceEditor'),
  PlaceDataCredits: host('PlaceDataCredits'),
  AchievementsOverview: host('AchievementsOverview'),
  AtmosphericBackdrop: host('Backdrop'), PageHeader: host('Header'), SectionHeading: host('SectionHeading'), ProviderMark: host('Provider'), ConnectionTile: host('ConnectionTile'),
  SymbolView: host('Symbol'), LinearGradient: host('Gradient'), ExpoImage: host('Image'), StyleSheet: {},
  AppleAuthentication: { AppleAuthenticationButton: host('AppleSignIn'), AppleAuthenticationButtonType: { CONTINUE: 1 }, AppleAuthenticationButtonStyle: { WHITE: 1 } },
  haptics: { selection: async () => {} }, isInternalTestingBuild: () => internalTesting, Linking: { openURL: async () => {} },
});

test('responsive Settings uses an iPad split view and an iPhone category hub without losing actions', async () => {
  const calls: string[] = [], editorStates: boolean[] = [];
  const props: any = { provider: 'apple-music', currentUser: { id: 'test-user', appleSubject: null }, appleIdentityStatus: 'unknown', signingInWithApple: false,
    accountActionPending: false, privateCloud: { status: 'idle', detail: 'Ready to sync' }, connectionCapabilities: { lastFmConfigured: false, tessieConfigured: false }, membershipTier: 'free', membershipExpirationDate: null,
    journeys: [{ id: 'j1', startedAt: '2026-09-05T10:00:00Z', startingLocation: 'Park', endingLocation: 'Museum', miles: 12, durationMinutes: 30, songCount: 2, soundtrackPreview: [] }],
    onAppleSignIn: () => calls.push('apple'), onPrivateCloudSync: () => calls.push('sync'), onEditorActiveChange: (active: boolean) => editorStates.push(active),
    onSignOut: () => calls.push('signout'), onDeleteAccount: () => calls.push('delete'), onMembership: () => calls.push('membership'), onChangeProvider: () => calls.push('provider'), onDataHealth: () => calls.push('health'),
  };
  let tree: any;
  const render = (changes: any = {}) => React.createElement(ui.ConnectionsScreen, { ...props, ...changes });
  const press = (label: string) => tree.root.findAllByType('Pressable').find((node: any) => node.props.accessibilityLabel === label);
  try {
    await act(() => { tree = create(render()); });
    assert.ok(tree.root.findAllByProps({ testID: 'ipad-settings-sidebar' }).length >= 1);
    assert.ok(tree.root.findAllByProps({ testID: 'ipad-settings-detail' }).length >= 1);
    const categoryItems = tree.root.findAllByType('Pressable').filter((node: any) => node.props.accessibilityRole === 'menuitem');
    assert.equal(categoryItems.length, 7);
    assert.deepEqual(categoryItems.map((node: any) => node.props.accessibilityLabel), [
      'Open Account & iCloud settings',
      'Open Appearance settings',
      'Open Achievements settings',
      'Open Membership & Support settings',
      'Open Music & Connections settings',
      'Open Recording & Location settings',
      'Open Saved Places settings',
    ]);
    assert.equal(tree.root.findByType('ThemePicker').props.embedded, true);
    assert.equal(tree.root.findByType('ThemePicker').props.compact, true);
    assert.equal(tree.root.findByType('ThemePicker').props.membershipTier, 'free');
    assert.equal(tree.root.findByType('AppIconPicker').props.compact, true);
    assert.equal(tree.root.findByType('AppIconPicker').props.membershipTier, 'free');

    await act(() => tree.root.findAllByProps({ testID: 'ipad-settings' })[0].props.onLayout({ nativeEvent: { layout: { width: 1100 } } }));
    let sidebarStyle = tree.root.findAllByProps({ testID: 'ipad-settings-sidebar' })[0].props.style;
    assert.ok(Math.abs(sidebarStyle[1].width - 1100 / 3) < 0.01);
    const sidebarTitle = tree.root.findByProps({ testID: 'ipad-page-title' });
    assert.equal(sidebarTitle.props.numberOfLines, 1);
    assert.equal(sidebarTitle.props.style[1].fontSize, 28);

    await act(() => tree.root.findAllByProps({ testID: 'ipad-settings' })[0].props.onLayout({ nativeEvent: { layout: { width: 976 } } }));
    sidebarStyle = tree.root.findAllByProps({ testID: 'ipad-settings-sidebar' })[0].props.style;
    assert.ok(Math.abs(sidebarStyle[1].width - 976 / 3) < 0.01, 'landscape category rail occupies exactly two of six columns');

    viewportWidth = 820; viewportHeight = 1180;
    await act(() => tree.update(render()));
    await act(() => tree.root.findAllByProps({ testID: 'ipad-settings' })[0].props.onLayout({ nativeEvent: { layout: { width: 820 } } }));
    sidebarStyle = tree.root.findAllByProps({ testID: 'ipad-settings-sidebar' })[0].props.style;
    assert.ok(sidebarStyle[1].width >= 206 && sidebarStyle[1].width <= 238);

    adaptiveFold = { axis: 'vertical', frame: { x: 654, y: 24, width: 27, height: 895 }, before: { x: 20, y: 24, width: 634, height: 895 }, after: { x: 681, y: 24, width: 634, height: 895 } };
    viewportWidth = 1335; viewportHeight = 939;
    await act(() => tree.update(render({ membershipTier: 'paid' })));
    await act(() => tree.root.findAllByProps({ testID: 'ipad-settings' })[0].props.onLayout({ nativeEvent: { layout: { width: 1295 } } }));
    sidebarStyle = tree.root.findAllByProps({ testID: 'ipad-settings-sidebar' })[0].props.style;
    assert.equal(sidebarStyle[1].width, 634);
    assert.equal(tree.root.findByProps({ testID: 'ipad-settings-fold-spacer' }).props.style.width, 27);
    adaptiveFold = null;

    viewportWidth = 744; viewportHeight = 520;
    await act(() => tree.update(render()));
    await act(() => tree.root.findByProps({ testID: 'ipad-settings' }).props.onLayout({ nativeEvent: { layout: { width: 600 } } }));
    assert.equal(tree.root.findByProps({ testID: 'ipad-settings' }).props.style[1].flexDirection, 'column');
    const compactSidebar = tree.root.findByProps({ testID: 'ipad-settings-sidebar' });
    assert.equal(compactSidebar.props.horizontal, true);
    assert.equal(compactSidebar.props.style[1].width, '100%');
    assert.equal(tree.root.findAllByProps({ testID: 'ipad-page-header' }).length, 0, 'narrow Split View gives the detail pane the full width');
    assert.equal(tree.root.findAllByType('Pressable').filter((node: any) => node.props.accessibilityRole === 'menuitem').length, 7);

    viewportFontScale = 2; viewportWidth = 1100; viewportHeight = 800;
    await act(() => tree.update(render()));
    await act(() => tree.root.findByProps({ testID: 'ipad-settings' }).props.onLayout({ nativeEvent: { layout: { width: 976 } } }));
    assert.equal(tree.root.findByProps({ testID: 'ipad-settings' }).props.style[1].flexDirection, 'column', 'accessibility text receives the compact landscape navigation strip');
    viewportFontScale = 1;
    await act(() => tree.update(render()));
    await act(() => tree.root.findByProps({ testID: 'ipad-settings' }).props.onLayout({ nativeEvent: { layout: { width: 976 } } }));
    assert.equal(tree.root.findByProps({ testID: 'ipad-settings' }).props.style[1], false);

    await act(() => press('Open Account & iCloud settings').props.onPress());
    assert.ok(tree.root.findAllByProps({ testID: 'ipad-settings-account' }).length);
    await act(() => tree.root.findByType('AppleSignIn').props.onPress());
    await act(() => press('Sync iCloud now').props.onPress());
    assert.deepEqual(calls, ['apple', 'sync']);

    await act(() => press('Open Achievements settings').props.onPress());
    assert.equal(tree.root.findByType('AchievementsOverview').props.journeys.length, 1);

    await act(() => press('Open Music & Connections settings').props.onPress());
    await act(() => press('Change soundtrack provider').props.onPress());
    await act(() => press('Open Membership & Support settings').props.onPress());
    await act(() => press('Unlock').props.onPress());
    assert.equal(press('Advanced Support'), undefined, 'public Settings hides internal diagnostics');
    assert.equal(press('Open Data Health'), undefined, 'public Settings does not expose Data Health');
    internalTesting = true;
    await act(() => tree.update(render()));
    await act(() => press('Advanced Support').props.onPress());
    await act(() => press('Open Data Health').props.onPress());
    await act(() => press('Privacy Policy').props.onPress());
    await act(() => press('Support Page').props.onPress());
    assert.deepEqual(links.slice(-2), ['https://journeydeck.me/privacy', 'https://journeydeck.me/support']);
    assert.deepEqual(calls.slice(-3), ['provider', 'membership', 'health']);

    await act(() => press('Open Saved Places settings').props.onPress());
    await act(() => press('Set Work').props.onPress());
    assert.equal(tree.root.findByType('PlaceEditor').props.slot, 'work');
    await act(() => tree.root.findByType('PlaceEditor').props.onBack());
    await act(() => press('Open Saved Places settings').props.onPress());
    await act(() => press('Edit custom place Gym').props.onPress());
    assert.equal(tree.root.findByType('CustomPlaceEditor').props.place.label, 'Gym');
    await act(() => tree.root.findByType('CustomPlaceEditor').props.onBack());
    await act(() => press('Open Saved Places settings').props.onPress());
    await act(() => press('Add another custom place').props.onPress());
    assert.equal(tree.root.findByType('CustomPlaceEditor').props.place, undefined);
    await act(() => tree.root.findByType('CustomPlaceEditor').props.onBack());
    await act(() => press('Edit primary driver profile').props.onPress());
    assert.equal(tree.root.findAllByType('ProfileEditor').length, 1);
    await act(() => tree.root.findByType('ProfileEditor').props.onBack());

    tablet = false; viewportWidth = 390; viewportHeight = 844;
    await act(() => tree.update(render()));
    assert.equal(tree.root.findAllByProps({ testID: 'ipad-settings-sidebar' }).length, 0);
    assert.equal(tree.root.findAllByType('Pressable').filter((node: any) => typeof node.props.accessibilityLabel === 'string' && /^Open .* settings$/.test(node.props.accessibilityLabel)).length, 7);
    await act(() => press('Open Achievements settings').props.onPress());
    assert.equal(tree.root.findByType('AchievementsOverview').props.journeys.length, 1);
    await act(() => tree.root.findByType('SettingsEditorScaffold').props.onBack());
    await act(() => press('Open Appearance settings').props.onPress());
    assert.equal(tree.root.findAllByType('ThemePicker').length, 0, 'phone appearance opens as a compact overview');
    assert.equal(tree.root.findAllByType('AppIconPicker').length, 0, 'phone icon gallery stays one level deeper');
    await act(() => press('Choose theme').props.onPress());
    assert.equal(tree.root.findAllByType('ThemePicker').length, 1);
    assert.equal(tree.root.findByType('SettingsEditorScaffold').props.backLabel, 'Appearance');
    await act(() => tree.root.findByType('SettingsEditorScaffold').props.onBack());
    await act(() => press('Choose app icon').props.onPress());
    assert.equal(tree.root.findAllByType('AppIconPicker').length, 1);
    await act(() => tree.root.findByType('SettingsEditorScaffold').props.onBack());
    assert.match(source, /keyboardShouldPersistTaps="handled"/, 'phone Settings keeps its proven pre-regression tap policy');
    assert.doesNotMatch(source, /disableScrollViewPanResponder|canCancelContentTouches={false}/, 'Settings does not override native child gesture arbitration');
    assert.equal(editorStates.at(-1), true);
    await act(() => tree.root.findByType('SettingsEditorScaffold').props.onBack());
    assert.equal(editorStates.at(-1), false);
  } finally {
    tablet = true; light = true; viewportWidth = 1100; viewportHeight = 800; viewportFontScale = 1; internalTesting = false;
    await act(() => tree?.unmount());
  }
});

test('Settings viewport adapts to iPad sidebar without changing phone scroll props or remounting content', async () => {
  let tree: any, mounts = 0;
  function Draft() { const [draft, setDraft] = React.useState(''); React.useEffect(() => { mounts++; }, []); return React.createElement('draft', { draft, setDraft }); }
  const props = { contentInsetAdjustmentBehavior: 'never', automaticallyAdjustContentInsets: false, contentContainerStyle: { paddingTop: 38 } };
  const render = () => React.createElement(viewport.SettingsScrollView, props, React.createElement(Draft));
  try {
    await act(() => { tree = create(render()); });
    await act(() => tree.root.findByType('draft').props.setDraft('unsaved name'));
    for (const appearance of [false, true]) {
      light = appearance;
      await act(() => tree.update(render()));
      assert.equal(tree.root.findByType('draft').props.draft, 'unsaved name');
      assert.equal(tree.root.findByType('SafeAreaView').props.style.backgroundColor, light ? '#fffaf0' : '#08070d');
      const content = tree.root.findByType('ScrollView').props.contentContainerStyle[1];
      assert.equal(content.width, '100%'); assert.equal(content.maxWidth, 760); assert.equal(content.paddingTop, 18);
    }
    assert.equal(mounts, 1);
    await act(() => tree.unmount());
    tablet = false;
    await act(() => { tree = create(render()); });
    assert.equal(tree.root.findAllByType('SafeAreaView').length, 0);
    assert.equal(tree.root.findByType('ScrollView').props.contentInsetAdjustmentBehavior, 'never');
    assert.equal(tree.root.findByType('ScrollView').props.contentContainerStyle, props.contentContainerStyle);
  } finally { tablet = true; light = true; await act(() => tree?.unmount()); }
});

test('successful private sync refreshes the shared library; unavailable accounts never report success', async () => {
  let accountStatus = 'available', refreshed = 0, pendingUploadCount = 0, failedUploads = 0;
  let issueDetails: string[] = [];
  const alerts: string[] = [];
  const states: any[] = [];
  const callback = source.slice(source.indexOf('const syncPrivateCloud = useCallback'), source.indexOf('const createProfileIsolationTest'));
  const { sync } = evaluate(callback + '\nexports.sync = syncPrivateCloud;', {}, {
    useCallback: (callback: any) => callback, isIsolationTestProfile: () => false, isPrivateICloudNativeAvailable: () => true,
    setPrivateCloud: (state: any) => states.push(state), isIpad: () => true, observeJourneyDeckEvent: () => {},
    syncCurrentUserWithPrivateICloud: async () => ({ accountStatus, privateContentVersion: 2, uploaded: 2, downloaded: 12, failedUploads, issueDetails, state: { pendingUploadCount } }),
    refreshPrimarySections: async (remote: boolean) => { assert.equal(remote, false); refreshed++; }, Alert: { alert: (title: string) => alerts.push(title) },
  });
  await sync(true);
  assert.equal(refreshed, 1);
  assert.equal(states.at(-1).status, 'synced');
  assert.match(states.at(-1).detail, /12 downloaded/);
  accountStatus = 'no_account';
  await sync(true);
  assert.equal(refreshed, 1);
  assert.equal(states.at(-1).status, 'needs_icloud');
  assert.match(states.at(-1).detail, /iPad Settings/);
  accountStatus = 'available'; pendingUploadCount = 75;
  await sync(true);
  assert.equal(states.at(-1).status, 'idle');
  assert.match(states.at(-1).detail, /75 items still waiting to upload/);
  assert.equal(alerts.at(-1), 'Private iCloud sync is incomplete');
  pendingUploadCount = 1; failedUploads = 1;
  issueDetails = ['Photo 1 in “Test memory” · Ref abc12345\nThe saved photo file is missing on this device.'];
  await sync(true);
  assert.equal(alerts.at(-1), 'Private iCloud needs attention');
  assert.match(states.at(-1).detail, /1 item still waiting/);
  assert.match(states.at(-1).detail, /Test memory/);
  assert.doesNotMatch(states.at(-1).detail, /Tap Sync again/);
});
