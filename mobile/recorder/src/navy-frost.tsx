import { type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { BackdropBlur, Canvas, Fill, Image as SkiaImage, type SkImage } from '@shopify/react-native-skia';
import { NAVY_FROST, navyFrostMaterial } from './navy-frost-policy';

export function NavyFrostSurface({ reduceTransparency, children, style, testID }: {
  reduceTransparency: boolean;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const material = navyFrostMaterial({ reduceTransparency });
  return <View testID={testID} style={[styles.surface, style]}>
    {material === 'solid'
      ? <View pointerEvents="none" testID="navy-frost-solid" style={[StyleSheet.absoluteFill, { backgroundColor: NAVY_FROST.solid }]} />
      : <>
        <BlurView pointerEvents="none" testID="navy-frost-live-blur" intensity={NAVY_FROST.blurIntensity} tint="systemUltraThinMaterialDark" style={StyleSheet.absoluteFill} />
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: NAVY_FROST.tint }]} />
      </>}
    {children}
  </View>;
}

/** In-canvas Skia stills. BackdropBlur only samples imagery drawn in this Canvas. */
export function NavyFrostStill({ image, width, height, reduceTransparency, clip, testID }: {
  image: SkImage | null;
  width: number;
  height: number;
  reduceTransparency: boolean;
  clip?: { x: number; y: number; width: number; height: number };
  testID?: string;
}) {
  const frostClip = clip ?? { x: 0, y: 0, width, height };
  const material = navyFrostMaterial({ reduceTransparency });
  return <Canvas testID={testID} style={{ width, height }}>
    {image ? <SkiaImage image={image} x={0} y={0} width={width} height={height} fit="cover" /> : <Fill color={NAVY_FROST.solid} />}
    {material === 'solid'
      ? <Fill color={NAVY_FROST.solid} />
      : <BackdropBlur blur={NAVY_FROST.skiaBlur} clip={frostClip}>
        <Fill color={NAVY_FROST.tint} />
      </BackdropBlur>}
  </Canvas>;
}

const styles = StyleSheet.create({
  surface: { overflow: 'hidden', borderColor: NAVY_FROST.edge },
});
