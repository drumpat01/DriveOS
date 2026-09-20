import * as Location from 'expo-location';
import { Alert, Linking } from 'react-native';

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
  const background = await Location.requestBackgroundPermissionsAsync();
  if (background.status !== 'granted') {
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
