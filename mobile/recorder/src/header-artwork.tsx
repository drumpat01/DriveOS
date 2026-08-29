import { Image as NativeImage, StyleSheet, View, type ImageSourcePropType } from 'react-native';
import { Image } from 'expo-image';

type HeaderArtworkProps = {
  source: ImageSourcePropType;
};

/** Renders a pre-trimmed header at its exact native aspect ratio. */
export function HeaderArtwork({ source }: HeaderArtworkProps) {
  const asset = NativeImage.resolveAssetSource(source);
  const aspectRatio = asset.width > 0 && asset.height > 0 ? asset.width / asset.height : 1376 / 768;

  return <View style={[styles.artwork, { aspectRatio }]}>
    <Image source={source} contentFit="cover" style={StyleSheet.absoluteFill} />
  </View>;
}

const styles = StyleSheet.create({
  artwork: { width: '100%', overflow: 'hidden' },
});
