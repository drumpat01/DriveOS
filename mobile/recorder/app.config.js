// Only the internal preview gets a second identity. The public V2 release updates
// the existing App Store app and retains its data, CloudKit container and products.
module.exports = ({ config }) => {
  if (process.env.EAS_BUILD_PROFILE && !['development-simulator', 'v2-preview', 'production'].includes(process.env.EAS_BUILD_PROFILE)) {
    throw new Error('Use development-simulator for cloud simulator testing, v2-preview for the side-by-side test app, or production for the App Store release.');
  }
  const preview = process.env.APP_VARIANT === 'v2-preview' || process.env.EAS_BUILD_PROFILE === 'v2-preview';
  // Keys are public Apple SDK keys; each bundle must use its own RevenueCat app.
  const revenueCatAppleKey = (preview ? process.env.REVENUECAT_PREVIEW_APPLE_API_KEY : process.env.REVENUECAT_PRODUCTION_APPLE_API_KEY) || '';
  if (revenueCatAppleKey && !/^appl_[A-Za-z0-9]+$/.test(revenueCatAppleKey)) throw new Error('RevenueCat requires a public Apple SDK key for the selected app.');
  const container = preview ? 'iCloud.com.journeydeck.recorder.v2' : 'iCloud.com.journeydeck.recorder';
  const photoPermission = 'JourneyDeck uses the dates and locations of photos you allow to suggest photos for your journeys. You review and choose which photos to add to Memories.';
  const existingPlugins = (config.plugins ?? []).map(plugin => Array.isArray(plugin) && plugin[0] === 'expo-image-picker'
    ? [plugin[0], { ...plugin[1], photosPermission: photoPermission }] : plugin);
  return {
    ...config,
    name: preview ? 'JourneyDeck V2' : config.name,
    version: '2.0.0',
    icon: './assets/icon-grand-touring-v2.png',
    // RevenueCat adds native code; keep older installed runtimes isolated.
    runtimeVersion: preview ? '2.0.0-preview.12' : '2.0.0-watch.7',
    plugins: [...existingPlugins, 'expo-router', ['expo-audio', {
      microphonePermission: config.ios.infoPlist.NSMicrophoneUsageDescription,
      recordAudioAndroid: false, enableBackgroundRecording: false, enableBackgroundPlayback: false,
    }], './plugins/with-even-native-tabs', './plugins/with-alternate-app-icons', './plugins/with-journeydeck-watch'],
    scheme: preview ? 'journeydeck-v2' : config.scheme,
    userInterfaceStyle: 'automatic',
    ios: {
      ...config.ios,
      deploymentTarget: '17.0',
      config: {
        ...(config.ios?.config || {}),
        usesNonExemptEncryption: false,
      },
      supportsTablet: true,
      requireFullScreen: false,
      icon: {
        light: './assets/icon-grand-touring-v2.png',
        dark: './assets/icon-grand-touring-v2.png',
        // Grayscale mask for iOS tinted and clear Home Screen appearances.
        // The system supplies the tint or Liquid Glass background at runtime.
        tinted: './assets/icon-tinted-clear-v1.png',
      },
      bundleIdentifier: preview ? 'com.journeydeck.recorder.v2' : config.ios.bundleIdentifier,
      ...(preview ? { buildNumber: '6' } : {}),
      entitlements: {
        ...config.ios.entitlements,
        'com.apple.developer.icloud-container-identifiers': [container],
      },
      infoPlist: { ...config.ios.infoPlist, NSPhotoLibraryUsageDescription: photoPermission, JourneyDeckCloudKitContainer: container, UIViewControllerBasedStatusBarAppearance: true, 'UISupportedInterfaceOrientations~ipad': ['UIInterfaceOrientationPortrait', 'UIInterfaceOrientationPortraitUpsideDown', 'UIInterfaceOrientationLandscapeLeft', 'UIInterfaceOrientationLandscapeRight'] },
    },
    extra: {
      ...config.extra,
      revenueCat: { appleApiKey: revenueCatAppleKey },
      features: { ...config.extra?.features, atlasUnlocked: false },
      release: preview ? { label: 'JourneyDeck V2 — Stories & Studio', sequence: 'V2-P9-HARDENED' } : { label: 'JourneyDeck 2.0 — Stories & Studio', sequence: 'V2-BUNDLE4-HARDENED' },
    },
  };
};
