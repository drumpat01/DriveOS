import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAppTheme } from './app-theme';

/** Decorative glass lighting, with no blur cost or interaction interception. */
export function ThemeMaterial({ radius = 20 }: { radius?: number }) {
  const theme = useAppTheme();
  if (!theme.isCustom) return null;
  const grandTouring = theme.id === 'redline';
  const autumn = theme.id === 'midnight-canopy';
  return <View pointerEvents="none" accessible={false} style={[StyleSheet.absoluteFill, { borderRadius: radius, overflow: 'hidden' }]}>
    <LinearGradient colors={autumn ? [`${theme.palette.glow}18`, `${theme.palette.glow}00`, `${theme.palette.glow}12`] : theme.isLight ? ['#fff8fb55', '#ffffff00', '#d895ab22'] : grandTouring ? [`${theme.palette.green}48`, '#ffffff00', `${theme.palette.accent}10`] : ['#f6f0e218', '#ffffff00', '#d4b15a12']}
      locations={[0, 0.38, 1]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
    <LinearGradient colors={autumn ? [`${theme.palette.line}bb`, `${theme.palette.line}18`, `${theme.palette.line}44`] : grandTouring ? [`${theme.palette.green}dd`, `${theme.palette.green}22`, `${theme.palette.blue}55`] : [`${theme.palette.chrome}bb`, `${theme.palette.chrome}18`, `${theme.palette.rose}44`]}
      start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ position: 'absolute', top: 0, left: radius, right: radius, height: 1 }} />
  </View>;
}
