import 'react-native-gesture-handler';

import { createElement } from 'react';
import { registerRootComponent } from 'expo';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { initialWindowMetrics, SafeAreaProvider } from 'react-native-safe-area-context';
import { enableScreens } from 'react-native-screens';

import './src/location-task';
import './src/automatic-drive-task';
import App from './App';

enableScreens(true);

function JourneyDeckRoot() {
  return createElement(
    GestureHandlerRootView,
    { style: { flex: 1 } },
    createElement(
      SafeAreaProvider,
      { initialMetrics: initialWindowMetrics },
      createElement(App),
    ),
  );
}

registerRootComponent(JourneyDeckRoot);
