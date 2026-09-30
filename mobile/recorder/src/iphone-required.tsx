import { createContext, useContext, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { haptics } from './haptics';
import { redesignStyles, Surface, useRedesignColors } from './redesign-ui';
import { TouchPressable } from './touch-feedback';

/** What an empty iPad can do about it: pull from iCloud, or open Account settings. Provided by the shell. */
export type IphoneRequiredActions = { sync?: () => void; account?: () => void; sample?: () => void };
const IphoneRequiredContext = createContext<IphoneRequiredActions>({});
export const IphoneRequiredProvider = ({ value, children }: { value: IphoneRequiredActions; children: ReactNode }) => <IphoneRequiredContext.Provider value={value}>{children}</IphoneRequiredContext.Provider>;

/** Shown on iPad in place of an empty section: iPad views what an iPhone records. */
export function IphoneRequiredCard({ subject }: { subject: string }) {
  const colors = useRedesignColors();
  const { sync, account, sample } = useContext(IphoneRequiredContext);
  return <Surface style={styles.card}>
    <View testID="requires-iphone" style={styles.copy}>
      <SymbolView name="iphone" tintColor={colors.accent} size={26} />
      <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>Requires an iPhone</Text>
      <Text style={[redesignStyles.caption, styles.body, { color: colors.textSecondary }]}>{`${subject} come from drives recorded with JourneyDeck on your iPhone. Sign in with the same Apple Account and iCloud on both devices and they appear here.`}</Text>
    </View>
    <View style={styles.actions}>
      {sync ? <TouchPressable accessibilityRole="button" accessibilityLabel="Sync from iCloud" onPress={() => { void haptics.selection(); sync(); }} style={({ pressed }) => [styles.button, { backgroundColor: colors.accent }, pressed && redesignStyles.pressed]}><Text style={[styles.buttonText, { color: colors.onAccent }]}>Sync from iCloud</Text></TouchPressable> : null}
      {account ? <TouchPressable accessibilityRole="button" accessibilityLabel="Account and iCloud settings" onPress={() => { void haptics.selection(); account(); }} style={({ pressed }) => [styles.button, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: StyleSheet.hairlineWidth }, pressed && redesignStyles.pressed]}><Text style={[styles.buttonText, { color: colors.text }]}>Account & sync</Text></TouchPressable> : null}
      {sample ? <TouchPressable accessibilityRole="button" accessibilityLabel="Try sample data" onPress={() => { void haptics.selection(); sample(); }} style={({ pressed }) => [styles.button, { backgroundColor: colors.accentSoft }, pressed && redesignStyles.pressed]}><Text style={[styles.buttonText, { color: colors.accent }]}>Try sample data</Text></TouchPressable> : null}
    </View>
  </Surface>;
}

const styles = StyleSheet.create({
  card: { padding: 22, gap: 16, alignItems: 'center' },
  copy: { alignItems: 'center', gap: 8 },
  title: { fontSize: 20, fontWeight: '700' },
  body: { textAlign: 'center', maxWidth: 420 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center' },
  button: { minHeight: 44, paddingHorizontal: 18, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  buttonText: { fontSize: 15, fontWeight: '700' },
});
