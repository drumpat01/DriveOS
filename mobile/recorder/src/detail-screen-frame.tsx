import { createContext, useContext, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets, type EdgeInsets } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';
import { useAppTheme } from './app-theme';

const DetailViewportContext = createContext<EdgeInsets | null>(null);

// Read the window's safe area ABOVE the native stack. A zooming destination's
// own safe area can change when UIKit finishes the transition.
export function DetailViewportProvider({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return <DetailViewportContext.Provider value={insets}>{children}</DetailViewportContext.Provider>;
}

export function useDetailViewportInsets() {
  const insets = useContext(DetailViewportContext);
  if (!insets) throw new Error('Detail screens require DetailViewportProvider above the stack');
  return insets;
}

export function DetailScreenFrame({ title, onBack, actions, children }: {
  title: string; onBack: () => void; actions?: ReactNode; children: ReactNode;
}) {
  const insets = useDetailViewportInsets();
  const theme = useAppTheme();
  const backgroundColor = theme.palette.page;
  const color = theme.isCustom ? theme.palette.text : theme.isLight ? '#59316d' : '#eee4f6';
  return <View style={[styles.screen, { backgroundColor, paddingTop: insets.top, paddingLeft: insets.left, paddingRight: insets.right }]}>
    <View style={styles.header}>
      <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={onBack}
        style={({ pressed }) => [styles.control, { backgroundColor: theme.palette.card, borderColor: theme.palette.line, opacity: pressed ? 0.65 : 1 }]}>
        <SymbolView name="chevron.left" tintColor={color} style={styles.backIcon} />
      </Pressable>
      <Text accessibilityRole="header" numberOfLines={1} style={[styles.title, { color }]}>{title}</Text>
      <View style={styles.actionSlot}>{actions}</View>
    </View>
    <View style={styles.body}>{children}</View>
  </View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { height: 52, flexShrink: 0, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 12 },
  control: { width: 44, height: 44, borderRadius: 22, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
  backIcon: { width: 20, height: 24 },
  title: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '600' },
  actionSlot: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1 },
});
