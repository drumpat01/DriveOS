// Only the internal preview gets a second identity. The public V2 release updates
// the existing App Store app and retains its data, CloudKit container and products.
module.exports = ({ config }) => {
  if (process.env.EAS_BUILD_PROFILE && !['v2-preview', 'production'].includes(process.env.EAS_BUILD_PROFILE)) {
    throw new Error('Use v2-preview for the side-by-side test app, or production for the App Store release.');
  }
  const preview = process.env.APP_VARIANT === 'v2-preview' || process.env.EAS_BUILD_PROFILE === 'v2-preview';
  const container = preview ? 'iCloud.com.journeydeck.recorder.v2' : 'iCloud.com.journeydeck.recorder';
  return {
    ...config,
    name: preview ? 'JourneyDeck V2' : config.name,
    version: '2.0.0',
    runtimeVersion: preview ? '2.0.0-preview.6' : '2.0.0-watch.1',
    plugins: [...(config.plugins ?? []), 'expo-router', './plugins/with-even-native-tabs', './plugins/with-journeydeck-watch'],
    scheme: preview ? 'journeydeck-v2' : config.scheme,
    userInterfaceStyle: 'automatic',
    ios: {
      ...config.ios,
      supportsTablet: true,
      requireFullScreen: false,
      icon: {
        light: './assets/icon-light-plum-v1.png',
        dark: './assets/icon.png',
      },
      bundleIdentifier: preview ? 'com.journeydeck.recorder.v2' : config.ios.bundleIdentifier,
      ...(preview ? { buildNumber: '6' } : {}),
      entitlements: {
        ...config.ios.entitlements,
        'com.apple.developer.icloud-container-identifiers': [container],
      },
      infoPlist: { ...config.ios.infoPlist, JourneyDeckCloudKitContainer: container, 'UISupportedInterfaceOrientations~ipad': ['UIInterfaceOrientationPortrait', 'UIInterfaceOrientationPortraitUpsideDown', 'UIInterfaceOrientationLandscapeLeft', 'UIInterfaceOrientationLandscapeRight'] },
    },
    extra: {
      ...config.extra,
      release: preview ? { label: 'JourneyDeck V2 — iPhone Memory Studio', sequence: 'V2-P5-MEM2' } : { label: 'JourneyDeck 2.0 — iPhone, iPad & Watch', sequence: 'V2-BUNDLE1' },
    },
  };
};
