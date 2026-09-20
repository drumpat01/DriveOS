import { useEffect, useRef, type ReactNode } from 'react';
import { Alert, Keyboard, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { useAppTheme, useThemedStyles } from './app-theme';

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
export function NativeSheet({ visible, kicker, title, onClose, onDismiss, dirty = false, busy = false, closeDisabled = false, footer, children }: {
  visible: boolean; kicker: string; title: string; onClose: () => void; onDismiss?: () => void;
  dirty?: boolean; busy?: boolean; closeDisabled?: boolean; footer?: ReactNode; children: ReactNode;
}) {
  const theme = useAppTheme();
  const styles = useThemedStyles(sheetStyles);
  const wasVisible = useRef(visible);
  useEffect(() => {
    // RN's onDismiss is iOS-only. Keep follow-up actions working on Android.
    if (Platform.OS !== 'ios' && wasVisible.current && !visible) onDismiss?.();
    wasVisible.current = visible;
  }, [visible, onDismiss]);
  return <Modal visible={visible} presentationStyle="pageSheet" animationType="slide"
    transparent={false} backdropColor={theme.color('#08070d', 'surface')}
    allowSwipeDismissal={false} onRequestClose={() => requestSheetClose(dirty, busy || closeDisabled, onClose)} onDismiss={onDismiss}>
    <KeyboardAvoidingView style={styles.root} behavior={footer && Platform.OS === 'ios' ? 'padding' : undefined} accessibilityViewIsModal>
      <View style={styles.header}>
        <View style={styles.heading}><Text style={styles.kicker}>{kicker}</Text><Text style={styles.title}>{title}</Text></View>
        <Pressable accessibilityRole="button" accessibilityLabel="Close sheet" disabled={busy || closeDisabled}
          onPress={() => requestSheetClose(dirty, busy || closeDisabled, onClose)} style={[styles.button, busy && styles.disabled]}><SymbolView name="xmark" tintColor={styles.close.color} style={styles.closeIcon} /></Pressable>
      </View>
      <ScrollView automaticallyAdjustKeyboardInsets={!footer} keyboardDismissMode="interactive" keyboardShouldPersistTaps="handled" bounces={false}
        alwaysBounceVertical={false} overScrollMode="never" contentInsetAdjustmentBehavior={footer ? 'never' : 'automatic'} contentContainerStyle={styles.content}>
        <View pointerEvents={busy ? 'none' : 'auto'} style={styles.body}>{children}</View>
      </ScrollView>
      {footer ? <View pointerEvents={busy ? 'none' : 'auto'} style={styles.footer}>{footer}</View> : null}
    </KeyboardAvoidingView>
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
