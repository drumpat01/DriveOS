import { useCallback, useEffect, useRef } from 'react';
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { SymbolView } from 'expo-symbols';

import { useThemeChoice } from './app-theme';
import {
  FREE_THEME_IDS,
  PLUS_THEME_IDS,
  themeCatalog,
  themeRequiresPlus,
  type ThemeId,
} from './theme-catalog';
import { V3_MIDNIGHT_CANOPY_ENABLED } from './release-features';

const previews: Record<ThemeId, number> = {
  dark: require('../assets/cinematic-home-main-photo-v1.jpg'),
  light: require('../assets/home-header-light-v1.png'),
  sakura: require('../assets/theme-rosewater-road-v1.png'),
  redline: require('../assets/theme-grand-touring-home-v2.png'),
  'midnight-canopy': require('../assets/theme-autumn-drive-road-v1.png'),
};

const visibleFreeThemeIds: readonly ThemeId[] = V3_MIDNIGHT_CANOPY_ENABLED
  ? [...FREE_THEME_IDS, 'midnight-canopy']
  : FREE_THEME_IDS;
const visibleThemeIds: readonly ThemeId[] = [...visibleFreeThemeIds, ...PLUS_THEME_IDS];

type ThemePickerProps = {
  embedded?: boolean;
  compact?: boolean;
  membershipTier?: 'free' | 'paid';
  onUpgrade?: () => void;
};

type ThemeCardProps = {
  id: ThemeId;
  selected: boolean;
  locked: boolean;
  isPlus: boolean;
  compact: boolean;
  onSelect: (id: ThemeId, event: GestureResponderEvent) => void;
  register: (id: ThemeId, view: View | null) => void;
};

function ThemeCard({ id, selected, locked, isPlus, compact, onSelect, register }: Readonly<ThemeCardProps>) {
  const choice = themeCatalog[id];
  const palette = choice.palette;
  const swatches = choice.swatches ?? [palette.coral, palette.amber, palette.teal, palette.blue, palette.rose];
  const position = visibleThemeIds.indexOf(id) + 1;

  return <Pressable
    ref={view => register(id, view)}
    testID={`theme-card-${id}`}
    accessibilityRole="radio"
    accessibilityLabel={`${choice.name}, theme ${position} of ${visibleThemeIds.length}. ${choice.mode === 'light' ? 'Light' : 'Dark'} appearance. ${choice.description}. ${isPlus ? 'JourneyDeck Plus' : 'Free'}${locked ? '. Requires JourneyDeck Plus' : ''}`}
    accessibilityHint={locked ? 'Opens JourneyDeck Plus' : selected ? 'Selected theme' : 'Applies this theme'}
    accessibilityState={{ checked: selected, selected }}
    pressRetentionOffset={16}
    onPress={event => onSelect(id, event)}
    style={({ pressed }) => [styles.themeCard, compact && styles.compactThemeCard, {
      backgroundColor: palette.card,
      borderColor: selected ? palette.accent : palette.line,
      shadowColor: palette.accent,
      opacity: pressed ? .82 : 1,
      transform: [{ scale: pressed ? .985 : 1 }],
    }]}
  >
    <View style={[styles.artwork, compact && styles.compactArtwork, { backgroundColor: palette.inset }]}>
      <Image accessible={false} source={previews[id]} contentFit="cover" style={StyleSheet.absoluteFill} />
      <LinearGradient pointerEvents="none" colors={['transparent', `${palette.page}24`, palette.card]} locations={[0, .56, 1]} style={StyleSheet.absoluteFill} />
      {isPlus && <Text testID={`theme-plus-${id}`} style={[styles.plusBadge, { color: palette.onAccent, backgroundColor: palette.accent }]}>PLUS</Text>}
      {selected && <View testID={`theme-selected-${id}`} style={[styles.selectedBadge, { backgroundColor: palette.accent }]}>
        <SymbolView name="checkmark" tintColor={palette.onAccent} size={14} weight="bold" />
      </View>}
    </View>
    <View style={styles.themeCopy}>
      <Text style={[styles.themeName, compact && styles.compactThemeName, { color: palette.text }]}>{choice.name}</Text>
      <Text style={[styles.appearance, { color: palette.accent }]}>{choice.mode.toUpperCase()}</Text>
      <Text style={[styles.description, { color: palette.muted }]}>{choice.description}</Text>
      <View accessible={false} style={styles.swatches}>{swatches.map((color, index) => <View key={`${color}-${index}`} style={[styles.swatch, { backgroundColor: color, borderColor: `${palette.text}30` }]} />)}</View>
    </View>
  </Pressable>;
}

/** Standard Free and Plus sections, with two cards per row and animated activation. */
export function ThemePicker({ embedded = false, compact = false, membershipTier = 'free', onUpgrade }: ThemePickerProps = {}) {
  const { theme, setTheme, transitionTheme } = useThemeChoice();
  const cards = useRef(new Map<ThemeId, View>());
  const host = useRef<View>(null);
  const colors = theme.palette;
  const committedId = theme.id;
  const alertFailure = useCallback(() => Alert.alert('Appearance not saved', 'Please try selecting the theme again.'), []);

  useEffect(() => {
    if (membershipTier === 'paid' || !themeRequiresPlus(theme.id)) return;
    try { setTheme('redline'); }
    catch { alertFailure(); }
  }, [alertFailure, membershipTier, setTheme, theme.id]);

  const applyTheme = useCallback((id: ThemeId, origin: { x: number; y: number }) => {
    if (id === committedId) return;
    try { transitionTheme(id, origin); }
    catch { alertFailure(); }
  }, [alertFailure, committedId, transitionTheme]);

  const applyFromCenter = useCallback((id: ThemeId) => {
    const apply = (x: number, y: number, width: number, height: number) => applyTheme(id, { x: x + width / 2, y: y + height / 2 });
    const card = cards.current.get(id);
    if (card) card.measureInWindow(apply);
    else host.current?.measureInWindow(apply);
  }, [applyTheme]);

  const selectTheme = (id: ThemeId, event: GestureResponderEvent) => {
    if (membershipTier !== 'paid' && themeRequiresPlus(id)) {
      onUpgrade?.();
      return;
    }
    const { pageX, pageY } = event.nativeEvent;
    if (Number.isFinite(pageX) && Number.isFinite(pageY) && (pageX !== 0 || pageY !== 0)) applyTheme(id, { x: pageX, y: pageY });
    else applyFromCenter(id);
  };

  const renderRow = (label: string, ids: readonly ThemeId[], isPlus: boolean, group: 'free' | 'plus') => <View testID={`theme-row-${group}`} style={styles.tierGroup}>
    <View style={styles.tierHeading}>
      <Text style={[styles.tierLabel, { color: isPlus ? colors.accent : colors.muted }]}>{label}</Text>
      {isPlus && <SymbolView name="crown.fill" tintColor={colors.accent} size={13} />}
    </View>
    {Array.from({ length: Math.ceil(ids.length / 2) }, (_, row) => <View key={row} style={styles.gridRow}>{ids.slice(row * 2, row * 2 + 2).map(id => <ThemeCard
      key={id}
      id={id}
      selected={id === committedId}
      locked={isPlus && membershipTier !== 'paid'}
      isPlus={isPlus}
      compact={compact}
      onSelect={selectTheme}
      register={(cardId, view) => { if (view) cards.current.set(cardId, view); else cards.current.delete(cardId); }}
    />)}{row * 2 + 1 >= ids.length && <View accessible={false} style={styles.emptyCell} />}</View>)}
  </View>;

  return <View ref={host} testID="theme-picker" style={[styles.panel, embedded && styles.embedded, { backgroundColor: embedded ? 'transparent' : colors.card, borderColor: embedded ? 'transparent' : colors.line }]}>
    <Text accessibilityRole="header" style={[embedded ? styles.sectionTitle : styles.title, { color: embedded ? colors.accent : colors.text }]}>{embedded ? 'THEME' : 'Theme'}</Text>
    <Text style={[styles.detail, { color: colors.muted }]}>Choose the colors and artwork used throughout JourneyDeck.</Text>
    <View accessibilityRole="radiogroup" style={styles.grid}>
      {renderRow('FREE', visibleFreeThemeIds, false, 'free')}
      {renderRow('JOURNEYDECK PLUS', PLUS_THEME_IDS, true, 'plus')}
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
  emptyCell: { flex: 1, minWidth: 0 },
  themeCard: { flex: 1, minWidth: 0, borderRadius: 19, borderWidth: 1.5, overflow: 'hidden', shadowOpacity: .18, shadowRadius: 12, shadowOffset: { width: 0, height: 7 } },
  compactThemeCard: { borderRadius: 21 },
  artwork: { width: '100%', aspectRatio: 1.45, minHeight: 84, overflow: 'hidden' },
  compactArtwork: { minHeight: 100 },
  plusBadge: { position: 'absolute', left: 8, top: 8, fontSize: 8, lineHeight: 12, fontWeight: '900', letterSpacing: 1, paddingHorizontal: 7, paddingVertical: 4, borderRadius: 9, overflow: 'hidden' },
  selectedBadge: { position: 'absolute', right: 8, top: 8, width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  themeCopy: { flexGrow: 1, paddingHorizontal: 11, paddingTop: 10, paddingBottom: 12, gap: 4 },
  themeName: { fontSize: 17, lineHeight: 21, fontWeight: '800', letterSpacing: -.2 },
  compactThemeName: { fontSize: 18, lineHeight: 23 },
  appearance: { fontSize: 9, lineHeight: 12, fontWeight: '900', letterSpacing: 1.1 },
  description: { fontSize: 11, lineHeight: 15 },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 4 },
  swatch: { width: 15, height: 15, borderRadius: 8, borderWidth: .5 },
});
