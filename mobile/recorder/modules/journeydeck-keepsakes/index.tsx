import { useEffect, useMemo, useRef, useState } from 'react';
import { requireNativeView } from 'expo';
import { Asset } from 'expo-asset';
import { Image } from 'expo-image';
import { Animated, PanResponder, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useAppTheme } from '../../src/app-theme';
import { medallionArtwork, type ApprovedMedallionId } from '../../src/medallion-artwork';
import JourneyDeckKeepsakesModule from './src/JourneyDeckKeepsakesModule';

type MedallionProps = { achievementId: ApprovedMedallionId; name: string; style?: StyleProp<ViewStyle> };
type NativeProps = MedallionProps & { artworkUri: string };
const supportsReplaceableArtwork = (JourneyDeckKeepsakesModule?.assetCatalogVersion ?? 0) >= 3;
const NativeMedallion = supportsReplaceableArtwork ? requireNativeView<NativeProps>('JourneyDeckKeepsakes') : null;

export const isJourneyDeckKeepsakeNativeAvailable = NativeMedallion !== null;

export function JourneyDeckMedallion({ achievementId, name, style }: MedallionProps) {
  const theme = useAppTheme();
  const artworkSource = medallionArtwork[achievementId][theme.id];
  const [artworkUri, setArtworkUri] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    setArtworkUri(null);
    void Asset.fromModule(artworkSource).downloadAsync()
      .then(asset => { if (active) setArtworkUri(asset.localUri); })
      .catch(() => { if (active) setArtworkUri(null); });
    return () => { active = false; };
  }, [artworkSource]);
  if (NativeMedallion && artworkUri) return <NativeMedallion achievementId={achievementId} name={name} artworkUri={artworkUri} style={style} />;
  return <FallbackMedallion achievementId={achievementId} name={name} style={style} />;
}

export function FirstJourneyMedallion({ style }: { style?: StyleProp<ViewStyle> }) {
  return <JourneyDeckMedallion achievementId="first-track" name="The First Track" style={style} />;
}

function FallbackMedallion({ achievementId, name, style }: MedallionProps) {
  const theme = useAppTheme();
  const turn = useRef(new Animated.Value(0)).current;
  const responder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > 4,
    onPanResponderMove: (_, gesture) => turn.setValue(gesture.dx * 1.15),
    onPanResponderRelease: (_, gesture) => Animated.spring(turn, {
      toValue: Math.round((gesture.dx * 1.15) / 180) * 180,
      damping: 13,
      stiffness: 130,
      mass: 0.75,
      useNativeDriver: true,
    }).start(),
    onPanResponderTerminate: () => Animated.spring(turn, {
      toValue: 0,
      damping: 13,
      stiffness: 130,
      mass: 0.75,
      useNativeDriver: true,
    }).start(),
  }), [turn]);
  const rotateFront = turn.interpolate({ inputRange: [-360, 0, 360], outputRange: ['-360deg', '0deg', '360deg'] });
  const rotateBack = turn.interpolate({ inputRange: [-360, 0, 360], outputRange: ['-180deg', '180deg', '540deg'] });

  return <View
    accessible
    accessibilityRole="imagebutton"
    accessibilityLabel={`${name} medallion`}
    accessibilityHint="Drag left or right to rotate the medallion"
    style={[styles.frame, style]}
    {...responder.panHandlers}
  >
    <Animated.View style={[styles.face, { transform: [{ perspective: 700 }, { rotateY: rotateFront }] }]}>
      <Image source={medallionArtwork[achievementId][theme.id]} contentFit="cover" transition={0} style={styles.artwork} />
    </Animated.View>
    <Animated.View style={[styles.face, styles.goldBack, { transform: [{ perspective: 700 }, { rotateY: rotateBack }] }]}>
      <View style={styles.backRing} />
      <Text numberOfLines={2} style={styles.backText}>{name.toUpperCase()}</Text>
      <Text style={styles.backMark}>JD</Text>
    </Animated.View>
  </View>;
}

const styles = StyleSheet.create({
  frame: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  face: { position: 'absolute', width: '100%', aspectRatio: 1, borderRadius: 999, borderWidth: 2, borderColor: '#e4ae58', overflow: 'hidden', backfaceVisibility: 'hidden', shadowColor: '#f1bd5d', shadowOpacity: 0.32, shadowRadius: 9, shadowOffset: { width: 0, height: 3 } },
  artwork: { width: '100%', height: '100%' },
  goldBack: { backgroundColor: '#c9952f', alignItems: 'center', justifyContent: 'center', padding: 24 },
  backRing: { position: 'absolute', top: 10, right: 10, bottom: 10, left: 10, borderRadius: 999, borderWidth: 3, borderColor: '#f4d782' },
  backText: { color: '#fff0bd', fontSize: 13, lineHeight: 17, fontWeight: '900', letterSpacing: 1.3, textAlign: 'center' },
  backMark: { color: '#7b5116', fontSize: 11, fontWeight: '900', letterSpacing: 2, marginTop: 10 },
});
