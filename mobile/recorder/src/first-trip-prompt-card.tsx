import { Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { firstTripPromptCopy } from './first-trip-prompt';
import { withAlpha } from './redesign-palette';
import { SERIF, useRedesignColors } from './redesign-ui';

const WIDE_MIN = 680;

/**
 * Dismissible Plus card. It sits over the settled home screen and does not lock the app.
 * Colors follow the V4 theme, and the kicker, title, and close control follow the native sheet.
 */
export function FirstTripPlusPrompt({ visible, trialDays, onSeePlus, onDismiss }: {
  visible: boolean;
  trialDays: number | null;
  onSeePlus: () => void;
  onDismiss: () => void;
}) {
  const colors = useRedesignColors();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const wide = width >= WIDE_MIN;
  const copy = firstTripPromptCopy(trialDays);

  return <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss} statusBarTranslucent>
    <View style={[styles.overlay, wide && styles.overlayWide, { paddingTop: insets.top + 12, paddingBottom: Math.max(insets.bottom, 12) }]}>
      <Pressable accessible={false} importantForAccessibility="no" onPress={onDismiss} style={styles.backdrop} />
      <View
        accessibilityViewIsModal
        testID="first-trip-plus-prompt"
        style={[
          styles.card,
          wide && styles.cardWide,
          { backgroundColor: colors.surface, borderColor: colors.border, maxHeight: Math.round(height * 0.8) },
        ]}
      >
        <View style={styles.header}>
          <View style={styles.heading}>
            <Text style={[styles.kicker, { color: colors.textSecondary }]}>{copy.kicker}</Text>
            <Text accessibilityRole="header" maxFontSizeMultiplier={1.4} style={[styles.title, { color: colors.text }]}>{copy.title}</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Close" hitSlop={8} onPress={onDismiss} style={styles.close}>
            <SymbolView name="xmark" tintColor={colors.text} size={18} weight="semibold" />
          </Pressable>
        </View>
        <ScrollView bounces={false} contentContainerStyle={styles.body}>
          <Text style={[styles.bodyText, { color: colors.textSecondary }]}>{copy.body}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel={copy.primary} testID="first-trip-plus-see" onPress={onSeePlus}
            style={({ pressed }) => [styles.primary, { backgroundColor: colors.accent }, pressed && styles.pressed]}>
            <Text style={[styles.primaryText, { color: colors.onAccent }]}>{copy.primary}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={copy.secondary} testID="first-trip-plus-dismiss" onPress={onDismiss}
            style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}>
            <Text style={[styles.secondaryText, { color: colors.textSecondary }]}>{copy.secondary}</Text>
          </Pressable>
        </ScrollView>
      </View>
    </View>
  </Modal>;
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', paddingHorizontal: 12 },
  overlayWide: { justifyContent: 'center', alignItems: 'center' },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: withAlpha('#08070d', 0.46) },
  card: { borderRadius: 28, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden', width: '100%', maxWidth: 480, alignSelf: 'center' },
  cardWide: { width: 440 },
  header: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 20, paddingTop: 22, paddingBottom: 4, gap: 8 },
  heading: { flex: 1, minWidth: 0 },
  kicker: { fontSize: 11, lineHeight: 14, fontWeight: '700', letterSpacing: 1, marginBottom: 6 },
  title: { fontFamily: SERIF, fontSize: 28, lineHeight: 34, fontWeight: '600' },
  close: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  body: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 18, gap: 8 },
  bodyText: { fontSize: 16, lineHeight: 22, marginBottom: 8 },
  primary: { minHeight: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center' },
  primaryText: { fontSize: 17, fontWeight: '700' },
  secondary: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { fontSize: 15, fontWeight: '600' },
  pressed: { opacity: 0.72 },
});
