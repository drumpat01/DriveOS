import { Pressable, Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { useAppTheme } from './app-theme';

export function AskJourneyDeckWidget({ onPress, onLongPress, disabled = false }: { onPress: () => void; onLongPress?: () => void; disabled?: boolean }) {
  const { palette: c, id } = useAppTheme();
  return <Pressable accessibilityRole="button" accessibilityLabel="Ask JourneyDeck" accessibilityHint="Opens a text field for a question about your journeys, Memories, and music."
    disabled={disabled} onPress={onPress} onLongPress={onLongPress} delayLongPress={1000} style={({ pressed }) => ({ minHeight: 142, padding: 22, borderRadius: 24, borderCurve: 'continuous', borderWidth: 1, borderColor: c.line, backgroundColor: c.card, gap: 14, opacity: pressed ? 0.8 : 1 })}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <SymbolView name="bubble.left.and.text.bubble.right" tintColor={c.accent} size={27} />
      <Text style={{ flex: 1, color: id === 'midnight-canopy' ? c.teal : c.text, fontSize: 21, fontWeight: '700' }}>Ask JourneyDeck</Text>
      <SymbolView name="chevron.right" tintColor={c.accent} size={16} />
    </View>
    <Text style={{ color: c.muted, fontSize: 15, lineHeight: 22 }}>Your roads, memories, and music. What would you like to know?</Text>
    <Text style={{ color: c.accent, fontSize: 12, fontWeight: '600' }}>ASK A QUESTION</Text>
  </Pressable>;
}
