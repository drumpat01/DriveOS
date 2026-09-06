import { useAppTheme, useThemedStyles } from './app-theme';
import { StyleSheet, View, type ImageSourcePropType } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { headerImageSource } from './header-image-sources';

type HeaderArtworkProps = {
  source: ImageSourcePropType;
};

/** One shared frame keeps every destination header the same on-screen size. */
export const HEADER_ARTWORK_ASPECT_RATIO = 1672 / 941;

export function HeaderArtwork({ source }: HeaderArtworkProps) {
  const theme = useAppTheme();
  const styles = useThemedStyles(darkStyles);

  return <View style={styles.artwork}>
    <HeaderEdgeBleed />
    <View style={styles.artworkFrame}>
      <Image source={headerImageSource(source, theme.mode)} contentFit="cover" style={StyleSheet.absoluteFill} />
      <HeaderEdgeFeather />
    </View>
  </View>;
}

/** Makes the image reach the page color before its bitmap boundary. */
export function HeaderEdgeFeather() {
  const theme = useAppTheme();

  return <View pointerEvents="none" style={StyleSheet.absoluteFill}>
    <LinearGradient colors={theme.gradient(['#05030b', 'rgba(5,3,11,0)', 'rgba(5,3,11,0)', '#05030b'])} locations={[0, 0.16, 0.84, 1]} style={StyleSheet.absoluteFill} />
    <LinearGradient colors={theme.gradient(['#05030b', 'rgba(5,3,11,0)', 'rgba(5,3,11,0)', '#05030b'])} locations={[0, 0.13, 0.87, 1]} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={StyleSheet.absoluteFill} />
  </View>;
}

/** Carries that exact edge color beyond the bitmap, then dissolves it into the ambient page wash. */
export function HeaderEdgeBleed() {
  const theme = useAppTheme();
  const styles = useThemedStyles(darkStyles);

  return <View pointerEvents="none" style={StyleSheet.absoluteFill}>
    <LinearGradient colors={theme.gradient(['rgba(5,3,11,0)', '#05030b'])} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={styles.bleedLeft} />
    <LinearGradient colors={theme.gradient(['#05030b', 'rgba(5,3,11,0)'])} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={styles.bleedRight} />
    <LinearGradient colors={theme.gradient(['rgba(5,3,11,0)', '#05030b'])} style={styles.bleedTop} />
    <LinearGradient colors={theme.gradient(['#05030b', 'rgba(5,3,11,0)'])} style={styles.bleedBottom} />
  </View>;
}

const darkStyles = StyleSheet.create({
  artwork: { width: '100%', aspectRatio: HEADER_ARTWORK_ASPECT_RATIO, overflow: 'visible' },
  artworkFrame: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, overflow: 'hidden' },
  bleedLeft: { position: 'absolute', left: -30, top: -22, bottom: -22, width: 30 },
  bleedRight: { position: 'absolute', right: -30, top: -22, bottom: -22, width: 30 },
  bleedTop: { position: 'absolute', left: -30, right: -30, top: -30, height: 30 },
  bleedBottom: { position: 'absolute', left: -30, right: -30, bottom: -30, height: 30 },
});
