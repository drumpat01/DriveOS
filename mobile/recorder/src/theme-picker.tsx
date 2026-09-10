import { useRef } from 'react';
import { Alert, Pressable, StyleSheet, Text, View, type GestureResponderEvent } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useThemeChoice } from './app-theme';
import { themeCatalog, type ThemeId } from './theme-catalog';

const previews = {
  dark: require('../assets/cinematic-home-main-photo-v1.jpg'),
  light: require('../assets/home-header-light-v1.png'),
  sakura: require('../assets/theme-rosewater-road-v1.png'),
  redline: require('../assets/theme-grand-touring-home-v1.png'),
};
const choices: ThemeId[] = ['dark', 'redline', 'light', 'sakura'];

/** Available to every tester; theme selection never changes membership state. */
export function ThemePicker({ embedded = false, compact = false }: { embedded?: boolean; compact?: boolean } = {}) {
  const { theme, transitionTheme } = useThemeChoice();
  const buttons = useRef(new Map<ThemeId, View>());
  const c = theme.palette;
  return <View testID="theme-picker" style={[s.panel, embedded && s.embedded, { backgroundColor: embedded ? 'transparent' : c.card, borderColor: embedded ? 'transparent' : c.line }]}>
    <Text accessibilityRole="header" style={[embedded ? s.sectionTitle : s.title, { color: embedded ? c.accent : c.text }]}>{embedded ? 'THEME' : 'Appearance'}</Text>
    {!embedded && <Text accessibilityLiveRegion="polite" style={[s.detail, { color: c.muted }]}>{theme.name}</Text>}
    <View style={s.grid}>{choices.map(id => {
      const choice = themeCatalog[id], p = choice.palette, selected = id === theme.id;
      return <Pressable key={id} ref={view => { if (view) buttons.current.set(id, view); else buttons.current.delete(id); }} accessibilityRole="radio" accessibilityLabel={`${choice.name}, ${choice.mode} theme`}
        accessibilityState={{ checked: selected }} onPress={(event: GestureResponderEvent) => {
          const select = (x: number, y: number) => {
            try { transitionTheme(id, { x, y }); } catch { Alert.alert('Appearance not saved', 'Please try selecting the theme again.'); }
          };
          const { pageX, pageY } = event.nativeEvent;
          if (Number.isFinite(pageX) && Number.isFinite(pageY) && (pageX !== 0 || pageY !== 0)) {
            select(pageX, pageY);
          } else {
            // VoiceOver/keyboard activation has no finger coordinate. Use this
            // button's measured center, still in the same window coordinate space.
            buttons.current.get(id)?.measureInWindow((x, y, width, height) => select(x + width / 2, y + height / 2));
          }
        }} style={({ pressed }) => [s.choice, compact && s.compactChoice, { backgroundColor: p.card, borderColor: selected ? c.accent : c.line, opacity: pressed ? 0.8 : 1 }]}>
        <View style={[s.preview, compact && s.compactPreview]}>
          <Image source={previews[id]} contentFit="cover" style={StyleSheet.absoluteFill} />
          <LinearGradient colors={['transparent', p.page]} style={StyleSheet.absoluteFill} />
          <Text style={[s.badge, { color: p.text, backgroundColor: p.card }]}>{choice.mode === 'light' ? 'LIGHT' : 'DARK'}{selected ? '  ✓' : ''}</Text>
          <View style={s.swatches}>{(choice.swatches ?? [p.coral, p.amber, p.teal, p.blue, p.rose]).map((color, i) => <View key={i} style={[s.swatch, { backgroundColor: color }]} />)}</View>
        </View>
        <Text style={[s.name, { color: p.text }]}>{choice.name}</Text>
        {!compact && <Text style={[s.description, { color: p.muted }]}>{choice.description}</Text>}
      </Pressable>;
    })}</View>
  </View>;
}

const s = StyleSheet.create({
  panel: { padding: 16, borderRadius: 24, borderWidth: 1, gap: 8, width: '100%' },
  embedded: { padding: 0, borderRadius: 0 },
  title: { fontSize: 20, fontWeight: '800' }, detail: { fontSize: 13 },
  sectionTitle: { fontSize: 11, fontWeight: '900', letterSpacing: 2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 6 },
  choice: { flexGrow: 1, flexBasis: 140, minWidth: 140, borderRadius: 18, borderWidth: 2, overflow: 'hidden', paddingBottom: 12 },
  compactChoice: { flexBasis: 120, minWidth: 120, paddingBottom: 8 },
  preview: { height: 96, justifyContent: 'space-between', padding: 9 },
  compactPreview: { height: 78 },
  badge: { alignSelf: 'flex-start', fontSize: 10, fontWeight: '800', paddingHorizontal: 7, paddingVertical: 4, borderRadius: 8 },
  swatches: { flexDirection: 'row', gap: 5 }, swatch: { width: 14, height: 14, borderRadius: 7 },
  name: { fontSize: 15, fontWeight: '700', paddingHorizontal: 10, paddingTop: 4 },
  description: { fontSize: 12, lineHeight: 17, paddingHorizontal: 10, paddingTop: 4 },
});
