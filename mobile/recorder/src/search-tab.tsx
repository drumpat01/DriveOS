import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import { searchPrimarySections, type SearchRecord } from './primary-sections-data';
import { CardDetailLink } from './card-detail-link';
import type { PrimaryDataState } from './primary-sections';
import { memoryIdFromSearch, searchSections } from './redesign-model';
import { Artwork, LargeTitle, RedesignPage, Surface, redesignStyles, useRedesignColors } from './redesign-ui';
import { TouchPressable } from './touch-feedback';

const KIND_SYMBOL: Record<SearchRecord['kind'], SFSymbol> = {
  memory: 'photo.on.rectangle', journey: 'car.fill', song: 'music.note', artist: 'music.mic', place: 'mappin.and.ellipse',
};

export function SearchTabScreen({ state, onJourney, onMemory }: { state: PrimaryDataState; onJourney: (id: string) => void; onMemory: (id: string) => void }) {
  const colors = useRedesignColors();
  const [query, setQuery] = useState('');
  const records = state.data?.search ?? [];
  const sections = useMemo(() => searchSections(searchPrimarySections(records, query)), [records, query]);
  const ink: Record<SearchRecord['kind'], string> = {
    memory: colors.accent, journey: colors.routes[2], song: colors.highlight, artist: colors.routes[3], place: colors.artwork[2],
  };
  const open = (record: SearchRecord) => {
    const memoryId = memoryIdFromSearch(record);
    if (memoryId) onMemory(memoryId);
    else if (record.journeyId) onJourney(record.journeyId);
  };

  return <RedesignPage testID="search-tab">
    <LargeTitle title="Search" />
    <View style={[styles.field, { backgroundColor: colors.track, borderColor: colors.border }]}>
      <SymbolView name="magnifyingglass" tintColor={colors.textSecondary} size={18} />
      <TextInput value={query} onChangeText={setQuery} placeholder="Drives, memories, songs, places" placeholderTextColor={colors.textTertiary}
        accessibilityLabel="Search your library" autoCapitalize="none" autoCorrect={false} returnKeyType="search" clearButtonMode="while-editing"
        selectionColor={colors.accent} style={[styles.input, { color: colors.text }]} />
    </View>
    <Text style={[styles.hint, { color: colors.textSecondary }]}>{query.trim() ? `${sections.reduce((sum, section) => sum + section.records.length, 0)} results` : 'Everything stays on this iPhone. Start typing, or pick up where you left off.'}</Text>
    {sections.length ? sections.map(section => <View key={section.kind} style={styles.section}>
      <Text accessibilityRole="header" style={[styles.sectionTitle, { color: colors.text }]}>{section.title}</Text>
      <Surface style={styles.list}>
        {section.records.map((record, index) => {
          const memoryId = memoryIdFromSearch(record);
          const actionable = Boolean(memoryId || record.journeyId);
          const Row = memoryId ? Pressable : TouchPressable;
          const row = <Row disabled={!actionable} accessibilityRole={actionable ? 'button' : undefined}
            accessibilityLabel={`${record.title}. ${record.subtitle}`} onPress={() => open(record)}
            style={({ pressed }) => [styles.row, index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.separator }, pressed && redesignStyles.pressed]}>
            {record.artworkUrl ? <Artwork uri={record.artworkUrl} size={42} round={record.kind === 'artist'} />
              : <View style={[styles.icon, { backgroundColor: colors.surfaceStrong }]}><SymbolView name={KIND_SYMBOL[record.kind]} tintColor={ink[record.kind]} size={18} /></View>}
            <View style={redesignStyles.flex}>
              <Text numberOfLines={1} style={[styles.title, { color: colors.text }]}>{record.title}</Text>
              <Text numberOfLines={1} style={[redesignStyles.caption, { color: colors.textSecondary }]}>{record.subtitle}</Text>
            </View>
            {actionable ? <SymbolView name="chevron.right" tintColor={colors.textTertiary} size={14} weight="semibold" /> : null}
          </Row>;
          return memoryId ? <CardDetailLink key={record.id} kind="memory" id={memoryId}>{row}</CardDetailLink> : <View key={record.id}>{row}</View>;
        })}
      </Surface>
    </View>) : <Surface style={styles.empty}>
      <SymbolView name="magnifyingglass" tintColor={colors.textSecondary} size={26} />
      <Text style={[redesignStyles.caption, styles.center, { color: colors.textSecondary }]}>{query.trim() ? 'Nothing in your library matches that yet.' : 'Your drives, memories and songs will be searchable here.'}</Text>
    </Surface>}
  </RedesignPage>;
}

const styles = StyleSheet.create({
  field: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 46, paddingHorizontal: 14, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth },
  input: { flex: 1, fontSize: 17, paddingVertical: 10 },
  hint: { fontSize: 13, lineHeight: 18, marginTop: -10 },
  section: { gap: 10 },
  sectionTitle: { fontSize: 20, lineHeight: 25, fontWeight: '800' },
  list: { paddingHorizontal: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  icon: { width: 42, height: 42, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 15, lineHeight: 20, fontWeight: '600' },
  empty: { padding: 24, alignItems: 'center', gap: 10 },
  center: { textAlign: 'center' },
});
