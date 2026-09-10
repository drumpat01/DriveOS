import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { useAppTheme } from './app-theme';
import { useAppIconChoice } from './app-icon-preference';
import { appIconCatalog, type AppIconId } from './app-icon-catalog';

const choices: AppIconId[] = ['original', 'warm-ivory', 'rosewater', 'grand-touring'];
const previews = {
  original: require('../assets/icon.png'),
  'warm-ivory': require('../assets/icon-light-plum-v1.png'),
  rosewater: require('../assets/icon-rosewater-v1.png'),
  'grand-touring': require('../assets/icon-grand-touring-v1.png'),
};

export function AppIconPicker({ embedded = false, compact = false }: { embedded?: boolean; compact?: boolean } = {}) {
  const theme = useAppTheme();
  const c = theme.palette;
  const { appIconId, availability, changing, setAppIcon } = useAppIconChoice();
  const ready = availability === 'ready';
  const detail = availability === 'checking' ? 'Checking icon support…'
    : availability === 'requires-build' ? 'Ready after the next app build'
      : availability === 'unsupported' ? 'Unavailable on this device'
        : 'Choose independently from your theme';

  const select = (id: AppIconId) => {
    void setAppIcon(id).catch(error => Alert.alert(
      'App icon not changed',
      error instanceof Error ? error.message : 'Please try selecting the icon again.',
    ));
  };

  return <View testID="app-icon-picker" style={[s.panel, embedded && s.embedded, { backgroundColor: embedded ? 'transparent' : c.card, borderColor: embedded ? 'transparent' : c.line }]}>
    <Text accessibilityRole="header" style={[embedded ? s.sectionTitle : s.title, { color: embedded ? c.accent : c.text }]}>{embedded ? 'APP ICON' : 'App Icon'}</Text>
    <Text accessibilityLiveRegion="polite" style={[s.detail, { color: c.muted }]}>{detail}</Text>
    <View accessibilityRole="radiogroup" style={[s.list, compact && s.compactList]}>{choices.map(id => {
      const choice = appIconCatalog[id];
      const selected = id === appIconId;
      return <Pressable key={id} accessibilityRole="radio" accessibilityLabel={`${choice.name} app icon`}
        accessibilityState={{ checked: selected, disabled: !ready || changing }} disabled={!ready || changing}
        onPress={() => select(id)} style={({ pressed }) => [s.choice, compact && s.compactChoice, {
          backgroundColor: c.inset, borderColor: selected ? c.accent : c.line,
          opacity: !ready ? 0.62 : pressed ? 0.78 : 1,
        }]}>
        <Image source={previews[id]} contentFit="cover" style={[s.preview, compact && s.compactPreview]} />
        <View style={[s.copy, compact && s.compactCopy]}><Text style={[s.name, { color: c.text }]}>{choice.name}</Text>
          {!compact && <Text numberOfLines={2} style={[s.description, { color: c.muted }]}>{choice.description}</Text>}</View>
        {selected && <SymbolView name="checkmark.circle.fill" tintColor={c.accent} size={22} />}
      </Pressable>;
    })}</View>
  </View>;
}

const s = StyleSheet.create({
  panel: { padding: 16, borderRadius: 24, borderWidth: 1, gap: 8, width: '100%' },
  embedded: { padding: 0, borderRadius: 0 },
  title: { fontSize: 20, fontWeight: '800' }, detail: { fontSize: 13, lineHeight: 18 },
  sectionTitle: { fontSize: 11, fontWeight: '900', letterSpacing: 2 },
  list: { gap: 9, marginTop: 6 },
  compactList: { flexDirection: 'row', flexWrap: 'wrap' },
  choice: { minHeight: 74, flexDirection: 'row', alignItems: 'center', gap: 11, borderRadius: 17, borderWidth: 2, padding: 8 },
  compactChoice: { flexGrow: 1, flexShrink: 1, flexBasis: '47%', minWidth: 0, minHeight: 132, flexDirection: 'column', justifyContent: 'center', gap: 7 },
  preview: { width: 56, height: 56, borderRadius: 13 },
  compactPreview: { width: 76, height: 76, borderRadius: 18 },
  copy: { flex: 1, minWidth: 0, gap: 3 }, name: { fontSize: 15, fontWeight: '700' },
  compactCopy: { flex: 0, alignItems: 'center' },
  description: { fontSize: 11, lineHeight: 15 },
});
