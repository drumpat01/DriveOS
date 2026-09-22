// Only the internal preview gets a second identity. The public V2 release updates
// the existing App Store app and retains its data, CloudKit container and products.
module.exports = ({ config }) => {
  if (process.env.EAS_BUILD_PROFILE && !['development-simulator', 'v2-preview', 'v3-preview', 'v3-development-simulator', 'v3-testflight', 'production'].includes(process.env.EAS_BUILD_PROFILE)) {
    throw new Error('Use a declared V2, V3, simulator, or production build profile.');
  }
  const v3 = process.env.APP_VARIANT === 'v3-preview' || ['v3-preview', 'v3-development-simulator', 'v3-testflight'].includes(process.env.EAS_BUILD_PROFILE);
  const preview = process.env.APP_VARIANT === 'v2-preview' || process.env.EAS_BUILD_PROFILE === 'v2-preview';
  const markerOtaCompat = process.env.EXPO_PUBLIC_JOURNEYDECK_MARKER_OTA_COMPAT === '1';
  const channel = v3 ? 'v3-preview' : preview ? 'v2-preview' : 'production';
  if (markerOtaCompat && (!v3 || process.env.EAS_BUILD === 'true')) throw new Error('Marker compatibility mode is only for V3 OTA updates, never native builds.');
  // Keys are public Apple SDK keys; each bundle must use its own RevenueCat app.
  const revenueCatAppleKey = (preview || v3 ? process.env.REVENUECAT_PREVIEW_APPLE_API_KEY : process.env.REVENUECAT_PRODUCTION_APPLE_API_KEY) || '';
  if (revenueCatAppleKey && !/^appl_[A-Za-z0-9]+$/.test(revenueCatAppleKey)) throw new Error('RevenueCat requires a public Apple SDK key for the selected app.');
  const container = v3 ? 'iCloud.com.journeydeck.recorder.v3' : preview ? 'iCloud.com.journeydeck.recorder.v2' : 'iCloud.com.journeydeck.recorder';
  const microphonePermission = v3 ? 'JourneyDeck uses the microphone only when you choose to identify a song. Song recognition audio is not saved.' : config.ios.infoPlist.NSMicrophoneUsageDescription;
  const photoPermission = 'JourneyDeck uses the dates and locations of photos you allow to suggest photos for your journeys. You review and choose which photos to add to Memories.';
  const existingPlugins = (config.plugins ?? []).map(plugin => Array.isArray(plugin) && plugin[0] === 'expo-image-picker'
    ? [plugin[0], { ...plugin[1], photosPermission: photoPermission }] : plugin);
  return {
    ...config,
    name: v3 ? 'JourneyDeck V3' : preview ? 'JourneyDeck V2' : config.name,
    version: v3 ? '3.0.0' : '2.0.0',
    icon: './assets/icon-grand-touring-v2.png',
    // Marker capture/Siri and schema 9 require a new V3 binary; never OTA to older builds.
    runtimeVersion: markerOtaCompat ? '3.0.0-preview.2' : v3 ? '3.0.0-preview.4' : preview ? '2.0.0-preview.14' : '2.0.0-watch.9',
    updates: {
      ...config.updates,
      requestHeaders: {
        ...(config.updates?.requestHeaders || {}),
        'expo-channel-name': channel,
      },
    },
    plugins: [...existingPlugins, 'expo-router', ['expo-audio', {
      microphonePermission,
      recordAudioAndroid: false, enableBackgroundRecording: false, enableBackgroundPlayback: false,
    }], './plugins/with-even-native-tabs', './plugins/with-alternate-app-icons', './plugins/with-journeydeck-watch', './plugins/with-journeydeck-siri', ...(v3 ? ['./plugins/with-ask-journeydeck'] : [])],
    scheme: v3 ? 'journeydeck-v3' : preview ? 'journeydeck-v2' : config.scheme,
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
      bundleIdentifier: v3 ? 'com.journeydeck.recorder.v3' : preview ? 'com.journeydeck.recorder.v2' : config.ios.bundleIdentifier,
      ...(v3 ? { buildNumber: '1' } : preview ? { buildNumber: '6' } : {}),
      entitlements: {
        ...config.ios.entitlements,
        'com.apple.developer.icloud-container-identifiers': [container],
      },
      infoPlist: { ...config.ios.infoPlist, NSMicrophoneUsageDescription: microphonePermission, NSPhotoLibraryUsageDescription: photoPermission, JourneyDeckCloudKitContainer: container, UIViewControllerBasedStatusBarAppearance: true, 'UISupportedInterfaceOrientations~ipad': ['UIInterfaceOrientationPortrait', 'UIInterfaceOrientationPortraitUpsideDown', 'UIInterfaceOrientationLandscapeLeft', 'UIInterfaceOrientationLandscapeRight'] },
    },
    extra: {
      ...config.extra,
      revenueCat: { appleApiKey: revenueCatAppleKey },
      features: { ...config.extra?.features, atlasUnlocked: v3, markerPrototype: v3, fiftyStates: v3, askJourneyDeck: v3, midnightCanopy: v3 },
      release: v3 ? { label: 'JourneyDeck V3 — Adaptive Preview', sequence: 'V3-P2-CURRENT-V2' } : preview ? { label: 'JourneyDeck V2 — Stories & Studio', sequence: 'V2-P9-HARDENED' } : { label: 'JourneyDeck 2.0 — Stories & Studio', sequence: 'V2-BUNDLE4-HARDENED' },
    },
  };
};
