import { useEffect, useRef, type ReactNode } from 'react';
import { Alert, Keyboard, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { useAppTheme, useThemedStyles } from './app-theme';
import { NavyFrostSurface } from './navy-frost';
import { NAVY_FROST, nativeSheetModalProps, type NativeSheetSurface } from './navy-frost-policy';
import { useCoreMotion } from './use-core-motion';

export function requestSheetClose(dirty: boolean, busy: boolean, onClose: () => void) {
  if (busy) return;
  const close = () => { Keyboard.dismiss(); onClose(); };
  if (!dirty) return close();
  Alert.alert('Discard unsaved changes?', 'Your saved information will stay as it is.', [
    { text: 'Keep editing', style: 'cancel' },
    { text: 'Discard changes', style: 'destructive', onPress: close },
  ]);
}

/** UIKit owns presentation and dismissal; the underlying tab stays mounted. */
export function NativeSheet({ visible, kicker, title, onClose, onDismiss, dirty = false, busy = false, closeDisabled = false, footer, children, surface = 'opaque', animateChrome = true }: {
  visible: boolean; kicker: string; title: string; onClose: () => void; onDismiss?: () => void;
  dirty?: boolean; busy?: boolean; closeDisabled?: boolean; footer?: ReactNode; children: ReactNode;
  surface?: NativeSheetSurface;
  /** Frost enter/exit only. Keep false on Record-active chrome. */
  animateChrome?: boolean;
}) {
  const theme = useAppTheme();
  const motion = useCoreMotion();
  const themed = useThemedStyles(sheetStyles);
  const frost = surface === 'frost';
  const styles = frost ? frostSheetStyles : themed;
  const modal = nativeSheetModalProps({ surface, reduceMotion: motion.reduceMotion, animateChrome });
  const wasVisible = useRef(visible);
  useEffect(() => {
    // RN's onDismiss is iOS-only. Keep follow-up actions working on Android.
    if (Platform.OS !== 'ios' && wasVisible.current && !visible) onDismiss?.();
    wasVisible.current = visible;
  }, [visible, onDismiss]);
  const close = () => requestSheetClose(dirty, busy || closeDisabled, onClose);
  const body = <KeyboardAvoidingView style={styles.root} behavior={footer && Platform.OS === 'ios' ? 'padding' : undefined} accessibilityViewIsModal>
    {frost ? <NavyFrostSurface reduceTransparency={motion.reduceTransparency} testID="navy-frost-sheet" style={StyleSheet.absoluteFill} /> : null}
    <View style={styles.header}>
      <View style={styles.heading}><Text style={styles.kicker}>{kicker}</Text><Text style={styles.title}>{title}</Text></View>
      <Pressable accessibilityRole="button" accessibilityLabel="Close sheet" disabled={busy || closeDisabled}
        onPress={close} style={[styles.button, busy && styles.disabled]}><SymbolView name="xmark" tintColor={styles.close.color} style={styles.closeIcon} /></Pressable>
    </View>
    <ScrollView automaticallyAdjustKeyboardInsets={!footer} keyboardDismissMode="interactive" keyboardShouldPersistTaps="handled" bounces={false}
      alwaysBounceVertical={false} overScrollMode="never" contentInsetAdjustmentBehavior={footer ? 'never' : 'automatic'} contentContainerStyle={styles.content}>
      <View pointerEvents={busy ? 'none' : 'auto'} style={styles.body}>{children}</View>
    </ScrollView>
    {footer ? <View pointerEvents={busy ? 'none' : 'auto'} style={styles.footer}>{footer}</View> : null}
  </KeyboardAvoidingView>;
  return <Modal visible={visible} presentationStyle={modal.presentationStyle} animationType={modal.animationType}
    transparent={modal.transparent} backdropColor={frost ? undefined : theme.color('#08070d', 'surface')}
    allowSwipeDismissal={false} onRequestClose={close} onDismiss={onDismiss}>
    {frost
      ? <View style={frostSheetStyles.overlay}>
        <Pressable accessibilityRole="button" accessibilityLabel="Dismiss sheet backdrop" onPress={close} style={frostSheetStyles.backdrop} />
        <View style={frostSheetStyles.card}>{body}</View>
      </View>
      : body}
  </Modal>;
}

const sheetStyles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#08070d' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 24, paddingBottom: 14, gap: 6 },
  heading: { flex: 1, minWidth: 0 },
  kicker: { color: '#b795e5', fontSize: 10, letterSpacing: 1.5, fontWeight: '800', marginBottom: 5 },
  title: { color: '#fff6ed', fontSize: 23, fontWeight: '800' },
  button: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  close: { color: '#fff6ed', fontSize: 30 },
  closeIcon: { width: 20, height: 20 },
  disabled: { opacity: 0.4 },
  body: { gap: 16 },
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40, gap: 16 },
  footer: { flexShrink: 0, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 20, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#30283a', backgroundColor: '#08070d' },
});

const frostSheetStyles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { flex: 1 },
  card: { height: '88%', overflow: 'hidden', borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: StyleSheet.hairlineWidth, borderColor: NAVY_FROST.edge, borderBottomWidth: 0 },
  root: { flex: 1, backgroundColor: 'transparent' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 24, paddingBottom: 14, gap: 6 },
  heading: { flex: 1, minWidth: 0 },
  kicker: { color: NAVY_FROST.accent, fontSize: 10, letterSpacing: 1.5, fontWeight: '800', marginBottom: 5 },
  title: { color: NAVY_FROST.ink, fontSize: 23, fontWeight: '800' },
  button: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  close: { color: NAVY_FROST.ink, fontSize: 30 },
  closeIcon: { width: 20, height: 20 },
  disabled: { opacity: 0.4 },
  body: { gap: 16 },
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40, gap: 16 },
  footer: { flexShrink: 0, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 20, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: NAVY_FROST.edge, backgroundColor: 'transparent' },
});
