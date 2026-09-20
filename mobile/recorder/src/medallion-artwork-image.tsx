import { Image } from 'expo-image';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { getMedallionFrame, medallionArtwork, type ApprovedMedallionId } from './medallion-artwork';
import type { ThemeId } from './theme-catalog';

type Props = {
  achievementId: ApprovedMedallionId;
  themeId: ThemeId;
  style?: StyleProp<ViewStyle>;
  label: string;
  rimWidth?: number;
};

/** Show the same centered circular face used by the spinning medallion. */
export function MedallionArtworkImage({ achievementId, themeId, style, label, rimWidth = 2.5 }: Props) {
  const frame = getMedallionFrame(achievementId, themeId);
  return <View style={[style, styles.rim]}>
    <View style={[styles.clip, { top: rimWidth, right: rimWidth, bottom: rimWidth, left: rimWidth }]}>
      <Image source={medallionArtwork[achievementId][themeId]} contentFit="fill" transition={0}
        accessibilityLabel={label} style={{
          position: 'absolute',
          width: `${100 / frame.width}%`, height: `${100 / frame.height}%`,
          left: `${-100 * frame.x / frame.width}%`, top: `${-100 * frame.y / frame.height}%`,
        }} />
    </View>
  </View>;
}

const styles = StyleSheet.create({
  rim: {
    borderRadius: 9999,
    overflow: 'hidden',
    backgroundColor: '#b9842b',
    borderWidth: 1,
    borderColor: '#f4d47b',
  },
  clip: { position: 'absolute', borderRadius: 9999, overflow: 'hidden' },
});
