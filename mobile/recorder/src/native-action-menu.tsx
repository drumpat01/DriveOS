import { MenuView, type MenuAction } from '@expo/ui/community/menu';
import { useState } from 'react';
import { SymbolView } from 'expo-symbols';
import { StyleSheet, Text, View } from 'react-native';
import { useThemedStyles } from './app-theme';

export type NativeMenuAction = MenuAction & { id: string; onSelect: () => void };

export function NativeActionMenu({ label, actions, compact = false, stretch = false }: {
  label: string; actions: NativeMenuAction[]; compact?: boolean; stretch?: boolean;
}) {
  const styles = useThemedStyles(menuStyles);
  const [width, setWidth] = useState<number>();
  return <View style={stretch && styles.column} onLayout={stretch ? event => setWidth(event.nativeEvent.layout.width) : undefined}>
    <MenuView style={stretch ? { width } : undefined} actions={actions.map(({ onSelect, ...action }) => action)}
    onPressAction={({ nativeEvent }) => {
      const action = actions.find(item => item.id === nativeEvent.event);
      if (action && !action.attributes?.disabled && !action.attributes?.hidden) action.onSelect();
    }}>
    <View accessible accessibilityRole="button" accessibilityLabel={label} accessibilityHint="Opens a menu"
      style={[styles.trigger, compact && styles.compact, stretch && { width }]}>
      {!compact && <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={styles.label}>{label}</Text>}
      <SymbolView name={compact ? 'ellipsis' : 'chevron.down'} tintColor={styles.label.color} style={compact ? styles.moreIcon : styles.chevron} />
    </View>
  </MenuView></View>;
}

const menuStyles = StyleSheet.create({
  column: { flex: 1, minWidth: 0 },
  trigger: { minHeight: 44, paddingHorizontal: 12, flexDirection: 'row', gap: 7, alignItems: 'center', justifyContent: 'space-between', borderRadius: 14, backgroundColor: '#211829' },
  compact: { minWidth: 44, paddingHorizontal: 10 },
  label: { color: '#b795e5', fontSize: 14, fontWeight: '700', flexShrink: 1 },
  chevron: { width: 12, height: 12, flexShrink: 0 },
  moreIcon: { width: 22, height: 22 },
});
