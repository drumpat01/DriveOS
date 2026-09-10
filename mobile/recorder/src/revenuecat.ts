import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import { NativeModules, Platform } from 'react-native';
import Purchases, { LOG_LEVEL, PURCHASES_ARE_COMPLETED_BY_TYPE, STOREKIT_VERSION } from 'react-native-purchases';
import { createBillingObserver } from './revenuecat-observer';

let configured = false;
const migrationMarker = 'journeydeck.revenuecat.migration.v1';

export const revenueCatBilling = createBillingObserver({
  configure() {
    if (configured) return true;
    const key = Constants.expoConfig?.extra?.revenueCat?.appleApiKey;
    if (Platform.OS !== 'ios' || !NativeModules.RNPurchases || typeof key !== 'string' || !/^appl_[A-Za-z0-9]+$/.test(key)) return false;
    // Anonymous RevenueCat identity; never pass Apple identity or journal data.
    void Purchases.setLogLevel(LOG_LEVEL.ERROR).catch(() => {});
    Purchases.configure({
      apiKey: key,
      purchasesAreCompletedBy: {
        type: PURCHASES_ARE_COMPLETED_BY_TYPE.MY_APP,
        storeKitVersion: STOREKIT_VERSION.STOREKIT_2,
      },
      diagnosticsEnabled: false,
      automaticDeviceIdentifierCollectionEnabled: false,
    });
    configured = true;
    return true;
  },
  userId: () => Purchases.getAppUserID(),
  sync: () => Purchases.syncPurchasesForResult(),
  readMarker: () => SecureStore.getItemAsync(migrationMarker),
  writeMarker: value => SecureStore.setItemAsync(migrationMarker, value),
});
