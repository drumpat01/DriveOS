import { ScrollView, type ScrollViewProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { isIpad, readingColumnStyle } from './device-layout';
import { V4_REDESIGN_ENABLED } from './release-features';
import { useAppTheme } from './app-theme';

// Preserve phone scroll behavior; iPad's native sidebar owns horizontal insets.
export function SettingsScrollView(props: ScrollViewProps) {
  const theme = useAppTheme();
  // V4 settings is a pushed screen with its own insets on both devices; iPad centers it in a reading column.
  if (V4_REDESIGN_ENABLED) return <ScrollView {...props} contentContainerStyle={[props.contentContainerStyle, isIpad() && readingColumnStyle]} />;
  if (!isIpad()) return <ScrollView {...props} />;
  return <SafeAreaView edges={['left', 'right']} style={{ flex: 1, backgroundColor: theme.palette.page }}>
    <ScrollView {...props} style={[{ flex: 1 }, props.style]} contentInsetAdjustmentBehavior="automatic"
      automaticallyAdjustContentInsets automaticallyAdjustsScrollIndicatorInsets
      contentContainerStyle={[props.contentContainerStyle, { width: '100%', maxWidth: 760, alignSelf: 'center', paddingHorizontal: 24, paddingTop: 18 }]} />
  </SafeAreaView>;
}
