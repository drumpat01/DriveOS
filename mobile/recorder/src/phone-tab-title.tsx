import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useAppTheme } from './app-theme';

/** Shared iPhone tab title. Side controls stay anchored without shifting the centered title. */
export function PhoneTabTitle({ title, leading, trailing, testID }: {
  title: string; leading?: ReactNode; trailing?: ReactNode; testID?: string;
}) {
  const theme = useAppTheme();
  const hasControls = Boolean(leading || trailing);
  return <View testID="phone-tab-title" style={[styles.row, hasControls && styles.controlledRow]}>
    {hasControls ? <View style={[styles.control, styles.leading]}>{leading}</View> : null}
    <Text testID={testID} accessibilityRole="header" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}
      style={[styles.title, {
        color: theme.palette.text,
        textShadowColor: theme.isLight || theme.id === 'redline' ? 'transparent' : 'rgba(255,255,255,0.32)',
        textShadowRadius: theme.id === 'redline' ? 0 : 8,
      }]}>{title.toUpperCase()}</Text>
    {hasControls ? <View style={[styles.control, styles.trailing]}>{trailing}</View> : null}

  </View>;
}



const styles = StyleSheet.create({
  row: { width: '100%', minHeight: 33, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  controlledRow: { minHeight: 58, marginBottom: 0 },
  control: { position: 'absolute', top: 6 },
  leading: { left: 0 },
  trailing: { right: 0 },
  title: { paddingHorizontal: 54, fontSize: 24, lineHeight: 29, fontWeight: '900', letterSpacing: 5.2, textAlign: 'center' },
});
