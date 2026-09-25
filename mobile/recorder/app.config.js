// Isolated V3 preview (`v3-preview`) keeps a second bundle and CloudKit
// container. V3 store TestFlight (`v3-store` / profile `v3-testflight`)
// turns V3 product features on while keeping the live App Store identity.
module.exports = ({ config }) => {
  if (process.env.EAS_BUILD_PROFILE && !['development-simulator', 'v2-preview', 'v3-preview', 'v3-development-simulator', 'v3-testflight', 'production'].includes(process.env.EAS_BUILD_PROFILE)) {
    throw new Error('Use a declared V2, V3, simulator, or production build profile.');
  }
  // Profile wins: v3-testflight must never inherit .v3 identity from APP_VARIANT=v3-preview.
  const v3Store = process.env.APP_VARIANT === 'v3-store' || process.env.EAS_BUILD_PROFILE === 'v3-testflight';
  const v3Preview = !v3Store && (process.env.APP_VARIANT === 'v3-preview' || ['v3-preview', 'v3-development-simulator'].includes(process.env.EAS_BUILD_PROFILE));
  const v3 = v3Preview || v3Store;
  const preview = process.env.APP_VARIANT === 'v2-preview' || process.env.EAS_BUILD_PROFILE === 'v2-preview';
  const markerOtaCompat = process.env.EXPO_PUBLIC_JOURNEYDECK_MARKER_OTA_COMPAT === '1';
  const channel = v3Preview ? 'v3-preview' : preview ? 'v2-preview' : 'production';
  if (markerOtaCompat) throw new Error('Tessie schema 11 requires a new V3 native build. Older-runtime OTA compatibility is unavailable from this tree.');
  // Keys are public Apple SDK keys; each bundle must use its own RevenueCat app.
  const revenueCatAppleKey = (preview || v3Preview ? process.env.REVENUECAT_PREVIEW_APPLE_API_KEY : process.env.REVENUECAT_PRODUCTION_APPLE_API_KEY) || '';
  if (revenueCatAppleKey && !/^appl_[A-Za-z0-9]+$/.test(revenueCatAppleKey)) throw new Error('RevenueCat requires a public Apple SDK key for the selected app.');
  const container = v3Preview ? 'iCloud.com.journeydeck.recorder.v3' : preview ? 'iCloud.com.journeydeck.recorder.v2' : 'iCloud.com.journeydeck.recorder';
  const microphonePermission = v3 ? 'JourneyDeck uses the microphone only when you choose to identify a song. Song recognition audio is not saved.' : config.ios.infoPlist.NSMicrophoneUsageDescription;
  const photoPermission = 'JourneyDeck uses the dates and locations of photos you allow to suggest photos for your journeys. You review and choose which photos to add to Memories.';
  const existingPlugins = (config.plugins ?? []).map(plugin => Array.isArray(plugin) && plugin[0] === 'expo-image-picker'
    ? [plugin[0], { ...plugin[1], photosPermission: photoPermission }] : plugin);
  return {
    ...config,
    name: v3Preview ? 'JourneyDeck V3' : preview ? 'JourneyDeck V2' : config.name,
    version: v3 ? '3.0.0' : '2.0.0',
    icon: './assets/icon-grand-touring-v2.png',
    // Build 35 (preview.4) Ask accepts schema 9 only. Tessie schema 11 needs
    // the updated native reader; never deliver this archive migration to it by OTA.
    // Expo MediaLibrary and the Ask bridges require a new binary. Keep Build
    // 36's preview.5 OTA stream separate from this source's native runtime.
    runtimeVersion: v3 ? '3.0.0-preview.6' : preview ? '2.0.0-preview.14' : '2.0.0-watch.9',
    updates: {
      ...config.updates,
      ...(v3 ? {
        url: 'https://ota.journeydeck.me/manifest',
        codeSigningCertificate: './certs/xprem-certificate.crt',
        codeSigningMetadata: { keyid: 'main', alg: 'rsa-v1_5-sha256' },
      } : {}),
      requestHeaders: {
        ...(config.updates?.requestHeaders || {}),
        'expo-channel-name': channel,
        ...(v3 ? {
          'expo-app-id': '45dbc2f7-fa8a-4761-8db8-8fac41a4c624',
          'xprem-branch': channel,
        } : {}),
      },
    },
    plugins: [...existingPlugins, 'expo-router', ...(v3 ? [['expo-media-library', {
      photosPermission: photoPermission, savePhotosPermission: false, preventAutomaticLimitedAccessAlert: true,
    }]] : []), ['expo-audio', {
      microphonePermission,
      recordAudioAndroid: false, enableBackgroundRecording: false, enableBackgroundPlayback: false,
    }], './plugins/with-even-native-tabs', './plugins/with-alternate-app-icons', './plugins/with-journeydeck-watch', './plugins/with-journeydeck-siri', ...(v3 ? ['./plugins/with-ask-journeydeck'] : [])],
    scheme: v3Preview ? 'journeydeck-v3' : preview ? 'journeydeck-v2' : config.scheme,
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
        dark: './assets/icon-grand-touring-dark-v1.png',
        // Grayscale mask for iOS tinted and clear Home Screen appearances.
        // The system supplies the tint or Liquid Glass background at runtime.
        tinted: './assets/icon-tinted-clear-v1.png',
      },
      bundleIdentifier: v3Preview ? 'com.journeydeck.recorder.v3' : preview ? 'com.journeydeck.recorder.v2' : config.ios.bundleIdentifier,
      ...(v3Preview ? { buildNumber: '1' } : preview ? { buildNumber: '6' } : {}),
      entitlements: {
        ...config.ios.entitlements,
        'com.apple.developer.icloud-container-identifiers': [container],
      },
      infoPlist: { ...config.ios.infoPlist, NSMicrophoneUsageDescription: microphonePermission, NSPhotoLibraryUsageDescription: photoPermission, JourneyDeckCloudKitContainer: container, JourneyDeckMarkerEnabled: v3, UIViewControllerBasedStatusBarAppearance: true, 'UISupportedInterfaceOrientations~ipad': ['UIInterfaceOrientationPortrait', 'UIInterfaceOrientationPortraitUpsideDown', 'UIInterfaceOrientationLandscapeLeft', 'UIInterfaceOrientationLandscapeRight'] },
    },
    extra: {
      ...config.extra,
      revenueCat: { appleApiKey: revenueCatAppleKey },
      features: { ...config.extra?.features, atlasUnlocked: v3, markerPrototype: v3, fiftyStates: v3, askJourneyDeck: v3, midnightCanopy: v3, tessieEnabled: v3, lastFmEnabled: v3, testflightPlusUnlocked: v3Store },
      release: v3Preview ? { label: 'JourneyDeck V3 — Adaptive Preview', sequence: 'V3-P2-CURRENT-V2' } : v3Store ? { label: 'JourneyDeck V3 — Live TestFlight', sequence: 'V3-STORE-TF' } : preview ? { label: 'JourneyDeck V2 — Stories & Studio', sequence: 'V2-P9-HARDENED' } : { label: 'JourneyDeck 2.0 — Stories & Studio', sequence: 'V2-BUNDLE4-HARDENED' },
    },
  };
};
