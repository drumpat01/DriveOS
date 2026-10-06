import { ScrollView, type ScrollViewProps } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { isIpad, readingColumnStyle } from './device-layout';
import { V4_REDESIGN_ENABLED } from './release-features';
import { useAppTheme } from './app-theme';

// The horizontal padding a (possibly nested) style array already applies.
function sidePadding(style: unknown): { left: number; right: number } {
  const side = { left: 0, right: 0 };
  const visit = (value: unknown) => {
    if (Array.isArray(value)) return value.forEach(visit);
    if (!value || typeof value !== 'object') return;
    const s = value as { padding?: number; paddingHorizontal?: number; paddingLeft?: number; paddingRight?: number };
    const base = s.paddingHorizontal ?? s.padding;
    if (typeof base === 'number') { side.left = base; side.right = base; }
    if (typeof s.paddingLeft === 'number') side.left = s.paddingLeft;
    if (typeof s.paddingRight === 'number') side.right = s.paddingRight;
  };
  visit(style);
  return side;
}

// Preserve phone scroll behavior; iPad's native sidebar owns horizontal insets.
export function SettingsScrollView(props: ScrollViewProps) {
  const theme = useAppTheme();
  // V4 settings is a pushed screen with its own insets on both devices; iPad centers it in a reading column.
  // Duo's vertical tab bar and camera area arrive as left/right insets (zero elsewhere); the page background still fills the window.
  const insets = useSafeAreaInsets();
  // Padding, not margin, so the page's glow still reaches the window edge behind the inset.
  const side = sidePadding(props.contentContainerStyle);
  if (V4_REDESIGN_ENABLED) return <ScrollView {...props} contentContainerStyle={[props.contentContainerStyle, isIpad() && readingColumnStyle, { paddingLeft: side.left + insets.left, paddingRight: side.right + insets.right }]} />;
  if (!isIpad()) return <ScrollView {...props} />;
  return <SafeAreaView edges={['left', 'right']} style={{ flex: 1, backgroundColor: theme.palette.page }}>
    <ScrollView {...props} style={[{ flex: 1 }, props.style]} contentInsetAdjustmentBehavior="automatic"
      automaticallyAdjustContentInsets automaticallyAdjustsScrollIndicatorInsets
      contentContainerStyle={[props.contentContainerStyle, { width: '100%', maxWidth: 760, alignSelf: 'center', paddingHorizontal: 24, paddingTop: 18 }]} />
  </SafeAreaView>;
}
