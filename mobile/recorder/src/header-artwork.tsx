import { useAppTheme, useThemedStyles } from './app-theme';
import { StyleSheet, View, type ImageSourcePropType } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { headerImageSource } from './header-image-sources';
import { JourneyImage } from './journey-image';

type HeaderArtworkProps = {
  source: ImageSourcePropType;
};

/** One wide banner keeps every non-Home destination compact and consistent. */
export const HEADER_ARTWORK_ASPECT_RATIO = 2.65;

function alpha(color: string, opacity: number) {
  const hex = color.match(/^#([\da-f]{6})$/i)?.[1];
  if (!hex) return color;
  return `rgba(${parseInt(hex.slice(0, 2), 16)},${parseInt(hex.slice(2, 4), 16)},${parseInt(hex.slice(4, 6), 16)},${opacity})`;
}

/** Shared image layers let headers with overlaid controls use the same crop and edge treatment. */
export function HeaderArtworkLayers({ source }: HeaderArtworkProps) {
  const theme = useAppTheme();
  const styles = useThemedStyles(darkStyles);
  const themedSource = headerImageSource(source, theme.id);

  return <>
    <JourneyImage imageIdentity={`header-${theme.id}-sharp`} source={themedSource} contentFit="cover" style={StyleSheet.absoluteFill} />
    <JourneyImage imageIdentity={`header-${theme.id}-blur`} source={themedSource} contentFit="cover" blurRadius={18} style={[StyleSheet.absoluteFill, styles.blurredArtwork]} />
    <CinematicPhotoGrade />
    <HeaderEdgeFeather />
  </>;
}

/** Gives licensed photography the same deep-plum cinematic finish across the dark theme. */
export function CinematicPhotoGrade() {
  const theme = useAppTheme();
  if (theme.id !== 'dark') return null;

  return <View pointerEvents="none" style={StyleSheet.absoluteFill}>
    <View style={[StyleSheet.absoluteFill, photoStyles.cinematicTint]} />
    <LinearGradient
      colors={['rgba(7,2,13,0.08)', 'rgba(55,12,68,0.20)', 'rgba(7,2,13,0.38)']}
      locations={[0, 0.52, 1]}
      start={{ x: 0.08, y: 0 }}
      end={{ x: 0.92, y: 1 }}
      style={StyleSheet.absoluteFill}
    />
  </View>;
}

export function HeaderArtwork({ source }: HeaderArtworkProps) {
  const styles = useThemedStyles(darkStyles);

  return <View style={styles.artwork}>
    <HeaderEdgeBleed />
    <View style={styles.artworkFrame}>
      <HeaderArtworkLayers source={source} />
    </View>
  </View>;
}

/** Makes the image reach the page color before its bitmap boundary. */
export function HeaderEdgeFeather() {
  const theme = useAppTheme();
  const page = theme.palette.page;
  const clear = alpha(page, 0);
  const haze = alpha(page, 0.22);

  return <View pointerEvents="none" style={StyleSheet.absoluteFill}>
    <LinearGradient colors={[page, haze, clear, clear, haze, page]} locations={[0, 0.1, 0.27, 0.7, 0.9, 1]} style={StyleSheet.absoluteFill} />
    <LinearGradient colors={[page, clear, clear, page]} locations={[0, 0.14, 0.86, 1]} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={StyleSheet.absoluteFill} />
  </View>;
}

/** Carries that exact edge color beyond the bitmap, then dissolves it into the ambient page wash. */
export function HeaderEdgeBleed() {
  const theme = useAppTheme();
  const styles = useThemedStyles(darkStyles);
  const page = theme.palette.page;
  const clear = alpha(page, 0);

  return <View pointerEvents="none" style={StyleSheet.absoluteFill}>
    <LinearGradient colors={[clear, page]} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={styles.bleedLeft} />
    <LinearGradient colors={[page, clear]} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={styles.bleedRight} />
    <LinearGradient colors={[clear, page]} style={styles.bleedTop} />
    <LinearGradient colors={[page, clear]} style={styles.bleedBottom} />
  </View>;
}

const darkStyles = StyleSheet.create({
  artwork: { width: '100%', aspectRatio: HEADER_ARTWORK_ASPECT_RATIO, overflow: 'visible' },
  artworkFrame: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, overflow: 'hidden' },
  blurredArtwork: { opacity: 0.22, transform: [{ scale: 1.06 }] },
  bleedLeft: { position: 'absolute', left: -30, top: -22, bottom: -22, width: 30 },
  bleedRight: { position: 'absolute', right: -30, top: -22, bottom: -22, width: 30 },
  bleedTop: { position: 'absolute', left: -30, right: -30, top: -30, height: 30 },
  bleedBottom: { position: 'absolute', left: -30, right: -30, bottom: -30, height: 30 },
});

const photoStyles = StyleSheet.create({
  cinematicTint: { backgroundColor: 'rgba(18,3,29,0.14)' },
});
