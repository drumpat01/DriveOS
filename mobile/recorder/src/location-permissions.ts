import * as Location from 'expo-location';
import { Alert, Linking } from 'react-native';
import { getNativeAutomaticRecorderStatus } from '../modules/journeydeck-recorder';

// Request access only after a user action; never start tracking here.
export async function requestJourneyLocationAccess(): Promise<boolean> {
  const foreground = await Location.requestForegroundPermissionsAsync();
  if (foreground.status !== 'granted') {
    if (!foreground.canAskAgain) {
      Alert.alert('Location is disabled', 'Open device Settings and allow JourneyDeck to use location.', [
        { text: 'Not now', style: 'cancel' },
        { text: 'Open Settings', onPress: () => void Linking.openSettings() },
      ]);
      return false;
    }
    Alert.alert('Location access', 'Location access is required to record a journey.');
    return false;
  }
  let background = await Location.requestBackgroundPermissionsAsync();
  // "Change to Always Allow" can finish a moment after the request returns;
  // check again briefly before telling someone Always is missing.
  for (let attempt = 0; background.status !== 'granted' && attempt < 6; attempt++) {
    await new Promise(resolve => setTimeout(resolve, 500));
    background = await Location.getBackgroundPermissionsAsync();
  }
  if (background.status !== 'granted') {
    // Core Location in the native recorder sees the finished upgrade even when Expo's
    // cached answer lags behind it; trust it before warning.
    const native = await getNativeAutomaticRecorderStatus().catch(() => null) as { authorization?: string } | null;
    if (native?.authorization === 'always') return true;
    if (!background.canAskAgain) {
      Alert.alert('Always Allow is needed', 'Open device Settings, choose Location, then select Always so journeys can continue with the screen locked.', [
        { text: 'Not now', style: 'cancel' },
        { text: 'Open Settings', onPress: () => void Linking.openSettings() },
      ]);
      return false;
    }
    Alert.alert('Location access', 'Choose “Always Allow” so recording continues with the screen locked.');
    return false;
  }
  return true;
}
