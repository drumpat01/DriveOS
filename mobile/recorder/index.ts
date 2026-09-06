import 'react-native-gesture-handler';
// Register background tasks before the router starts; navigation never owns them.
import './src/location-task';
import './src/automatic-drive-task';
import 'expo-router/entry';
