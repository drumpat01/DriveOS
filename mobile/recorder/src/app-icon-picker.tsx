import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';

import { useAppTheme } from './app-theme';
import {
  APP_ICON_GRID_ORDER,
  FREE_APP_ICON_IDS,
  PLUS_APP_ICON_IDS,
  appIconCatalog,
  appIconRequiresPlus,
  type AppIconId,
} from './app-icon-catalog';
import { useAppIconChoice } from './app-icon-preference';

const previews: Record<AppIconId, number> = {
  original: require('../assets/icon-cinematic-dark-v2.png'),
  'warm-ivory': require('../assets/icon-warm-ivory-v2.png'),
  rosewater: require('../assets/icon-rosewater-v2.png'),
  'grand-touring': require('../assets/icon-grand-touring-v2.png'),
};

type AppIconPickerProps = {
  embedded?: boolean;
  compact?: boolean;
  membershipTier?: 'free' | 'paid';
  onUpgrade?: () => void;
};

export function AppIconPicker({ embedded = false, compact = false, membershipTier = 'free', onUpgrade }: AppIconPickerProps = {}) {
  const theme = useAppTheme();
  const colors = theme.palette;
  const { appIconId, availability, changing, setAppIcon } = useAppIconChoice();
  const ready = availability === 'ready';
  const detail = availability === 'checking' ? 'Checking icon support…'
    : availability === 'requires-build' ? 'Ready after the next app build'
      : availability === 'unsupported' ? 'Unavailable on this device'
        : 'Choose the icon shown on your Home Screen.';

  const select = (id: AppIconId) => {
    if (membershipTier !== 'paid' && appIconRequiresPlus(id)) {
      onUpgrade?.();
      return;
    }
    void setAppIcon(id).catch(error => Alert.alert(
      'App icon not changed',
      error instanceof Error ? error.message : 'Please try selecting the icon again.',
    ));
  };

  const renderRow = (label: string, ids: readonly AppIconId[], isPlus: boolean) => <View testID={`app-icon-row-${isPlus ? 'plus' : 'free'}`} style={styles.tierGroup}>
    <View style={styles.tierHeading}>
      <Text style={[styles.tierLabel, { color: isPlus ? colors.accent : colors.muted }]}>{label}</Text>
      {isPlus && <SymbolView name="crown.fill" tintColor={colors.accent} size={13} />}
    </View>
    <View style={styles.gridRow}>{ids.map(id => {
      const choice = appIconCatalog[id];
      const selected = id === appIconId;
      const locked = isPlus && membershipTier !== 'paid';
      const position = APP_ICON_GRID_ORDER.indexOf(id) + 1;
      return <Pressable
        key={id}
        testID={`app-icon-${id}`}
        accessibilityRole="radio"
        accessibilityLabel={`${choice.name}, app icon ${position} of ${APP_ICON_GRID_ORDER.length}. ${choice.description}. ${isPlus ? 'JourneyDeck Plus' : 'Free'}${locked ? '. Requires JourneyDeck Plus' : ''}`}
        accessibilityHint={locked ? 'Opens JourneyDeck Plus' : selected ? 'Selected app icon' : 'Applies this app icon'}
        accessibilityState={{ checked: selected, selected, disabled: !ready || changing }}
        disabled={!ready || changing}
        pressRetentionOffset={20}
        onPress={() => select(id)}
        style={({ pressed }) => [styles.choice, compact && styles.compactChoice, {
          backgroundColor: colors.inset,
          borderColor: selected ? colors.accent : colors.line,
          shadowColor: colors.accent,
          opacity: !ready ? .62 : pressed ? .8 : 1,
          transform: [{ scale: pressed ? .985 : 1 }],
        }]}
      >
        <View style={styles.previewFrame}>
          <Image accessible={false} source={previews[id]} contentFit="cover" style={[styles.preview, compact && styles.compactPreview]} />
          {isPlus && <Text testID={`app-icon-plus-${id}`} style={[styles.plusBadge, { color: colors.onAccent, backgroundColor: colors.accent }]}>PLUS</Text>}
          {selected && <View testID={`app-icon-selected-${id}`} style={[styles.selectedBadge, { backgroundColor: colors.accent }]}>
            <SymbolView name="checkmark" tintColor={colors.onAccent} size={14} weight="bold" />
          </View>}
        </View>
        <View style={styles.copy}>
          <Text style={[styles.name, { color: colors.text }]}>{choice.name}</Text>
          <Text style={[styles.description, { color: colors.muted }]}>{choice.description}</Text>
        </View>
      </Pressable>;
    })}</View>
  </View>;

  return <View testID="app-icon-picker" style={[styles.panel, embedded && styles.embedded, { backgroundColor: embedded ? 'transparent' : colors.card, borderColor: embedded ? 'transparent' : colors.line }]}>
    <Text accessibilityRole="header" style={[embedded ? styles.sectionTitle : styles.title, { color: embedded ? colors.accent : colors.text }]}>{embedded ? 'APP ICON' : 'App Icon'}</Text>
    <Text accessibilityLiveRegion="polite" style={[styles.detail, { color: colors.muted }]}>{detail}</Text>
    <View accessibilityRole="radiogroup" style={styles.grid}>
      {renderRow('FREE', FREE_APP_ICON_IDS, false)}
      {renderRow('JOURNEYDECK PLUS', PLUS_APP_ICON_IDS, true)}
    </View>
  </View>;
}

const styles = StyleSheet.create({
  panel: { padding: 16, borderRadius: 24, borderWidth: 1, gap: 8, width: '100%' },
  embedded: { padding: 0, borderRadius: 0 },
  title: { fontSize: 20, fontWeight: '800' },
  sectionTitle: { fontSize: 11, fontWeight: '900', letterSpacing: 2 },
  detail: { fontSize: 13, lineHeight: 19, marginBottom: 3 },
  grid: { gap: 16 },
  tierGroup: { gap: 7 },
  tierHeading: { minHeight: 20, flexDirection: 'row', alignItems: 'center', gap: 6 },
  tierLabel: { fontSize: 10, lineHeight: 14, fontWeight: '900', letterSpacing: 1.5 },
  gridRow: { flexDirection: 'row', alignItems: 'stretch', gap: 10 },
  choice: { flex: 1, minWidth: 0, minHeight: 176, alignItems: 'center', borderRadius: 19, borderWidth: 1.5, padding: 10, gap: 9, shadowOpacity: .14, shadowRadius: 11, shadowOffset: { width: 0, height: 6 } },
  compactChoice: { minHeight: 190, borderRadius: 21, padding: 12 },
  previewFrame: { position: 'relative' },
  preview: { width: 88, height: 88, borderRadius: 20 },
  compactPreview: { width: 104, height: 104, borderRadius: 24 },
  plusBadge: { position: 'absolute', left: -4, top: -4, fontSize: 8, lineHeight: 12, fontWeight: '900', letterSpacing: 1, paddingHorizontal: 7, paddingVertical: 4, borderRadius: 9, overflow: 'hidden' },
  selectedBadge: { position: 'absolute', right: -5, top: -5, width: 27, height: 27, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  copy: { flexGrow: 1, minWidth: 0, alignItems: 'center', gap: 3 },
  name: { fontSize: 15, lineHeight: 19, fontWeight: '800', textAlign: 'center' },
  description: { fontSize: 11, lineHeight: 15, textAlign: 'center' },
});
