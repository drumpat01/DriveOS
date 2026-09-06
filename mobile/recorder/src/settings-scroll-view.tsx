import { ScrollView, type ScrollViewProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { isIpad } from './device-layout';
import { useAppTheme } from './app-theme';

// Preserve phone scroll behavior; iPad's native sidebar owns horizontal insets.
export function SettingsScrollView(props: ScrollViewProps) {
  const theme = useAppTheme();
  if (!isIpad()) return <ScrollView {...props} />;
  return <SafeAreaView edges={['left', 'right']} style={{ flex: 1, backgroundColor: theme.isLight ? '#fffaf0' : '#08070d' }}>
    <ScrollView {...props} style={[{ flex: 1 }, props.style]} contentInsetAdjustmentBehavior="automatic"
      automaticallyAdjustContentInsets automaticallyAdjustsScrollIndicatorInsets
      contentContainerStyle={[props.contentContainerStyle, { width: '100%', maxWidth: 760, alignSelf: 'center', paddingHorizontal: 24, paddingTop: 18 }]} />
  </SafeAreaView>;
}
