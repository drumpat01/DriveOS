import { DEVICE_NAME } from './device-layout';
import { useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Keyboard, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as Location from 'expo-location';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getCurrentUser } from './auth';
import { haptics } from './haptics';
import { SERIF, useRedesignColors } from './redesign-ui';
import { loadSavedPlaces, saveSavedPlace, type SavedPlaceSlot } from './saved-places';

const SLOTS: readonly { id: Extract<SavedPlaceSlot, 'home' | 'work'>; label: string; symbol: SFSymbol; hint: string }[] = [
  { id: 'home', label: 'Home', symbol: 'house.fill', hint: 'Where most drives start' },
  { id: 'work', label: 'Work', symbol: 'briefcase.fill', hint: 'Optional' },
];

/**
 * Onboarding: save Home and Work. They name journeys ("Home → Work") and turn on
 * the privacy trim that keeps those places off shared routes. Both are optional.
 */
export function FirstRunPlacesStep({ header, onDone }: { header: ReactNode; onDone: () => void }) {
  const c = useRedesignColors();
  const insets = useSafeAreaInsets();
  const userId = getCurrentUser().id;
  const [saved, setSaved] = useState(() => { const places = loadSavedPlaces(userId); return { home: Boolean(places.home), work: Boolean(places.work) }; });
  const [editing, setEditing] = useState<'home' | 'work' | null>(null);
  const [address, setAddress] = useState('');
  const [busy, setBusy] = useState<'home' | 'work' | null>(null);
  const [message, setMessage] = useState('');
  const operation = useRef(0);

  const store = (slot: 'home' | 'work', latitude: number, longitude: number) => {
    saveSavedPlace(userId, slot, latitude, longitude);
    setSaved(current => ({ ...current, [slot]: true }));
    setEditing(null); setAddress(''); setMessage('');
    void haptics.success();
  };
  const useHere = async (slot: 'home' | 'work') => {
    Keyboard.dismiss();
    const run = ++operation.current;
    setBusy(slot); setMessage('');
    try {
      const permission = await Location.getForegroundPermissionsAsync();
      if (!permission.granted) { setMessage('Location access is off. Enter an address instead.'); setEditing(slot); return; }
      const here = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      if (run === operation.current) store(slot, here.coords.latitude, here.coords.longitude);
    } catch { if (run === operation.current) setMessage('Your location could not be read. Enter an address instead.'); }
    finally { if (run === operation.current) setBusy(null); }
  };
  const useAddress = async (slot: 'home' | 'work') => {
    if (!address.trim()) return;
    Keyboard.dismiss();
    const run = ++operation.current;
    setBusy(slot); setMessage('');
    try {
      const match = (await Location.geocodeAsync(address.trim()))[0];
      if (run !== operation.current) return;
      if (match) store(slot, match.latitude, match.longitude); else setMessage('That address was not found. Try a full street address.');
    } catch { if (run === operation.current) setMessage('That address could not be looked up. Try again.'); }
    finally { if (run === operation.current) setBusy(null); }
  };

  const any = saved.home || saved.work;
  return <View style={styles.screen}>
    <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 10, paddingBottom: Math.max(insets.bottom, 16) }]}>
      {header}
      <Text style={[styles.kicker, { color: c.accent }]}>OPTIONAL · PRIVACY</Text>
      <Text accessibilityRole="header" style={[styles.title, { color: c.text }]}>Where's home?</Text>
      <Text style={[styles.body, { color: c.textSecondary }]}>Save Home and Work to name your drives automatically. JourneyDeck also hides them whenever you share a route.</Text>
      <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
        {SLOTS.map((slot, index) => {
          const isSaved = saved[slot.id], open = editing === slot.id, working = busy === slot.id;
          return <View key={slot.id} style={[styles.slot, index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.separator }]}>
            <View style={styles.slotRow}>
              <View style={[styles.icon, { backgroundColor: c.accentSoft }]}><SymbolView name={slot.symbol} tintColor={c.accent} size={18} /></View>
              <View style={styles.flex}>
                <Text style={[styles.slotName, { color: c.text }]}>{slot.label}</Text>
                <Text style={[styles.slotHint, { color: isSaved ? c.accent : c.textSecondary }]}>{isSaved ? 'Saved · protected when sharing' : slot.hint}</Text>
              </View>
              {working ? <ActivityIndicator color={c.accent} /> : isSaved
                ? <SymbolView name="checkmark.circle.fill" tintColor={c.accent} size={24} />
                : null}
            </View>
            {!isSaved && !working ? <View style={styles.actions}>
              <Pressable accessibilityRole="button" accessibilityLabel={`Set ${slot.label} to my current location`} onPress={() => void useHere(slot.id)}
                style={({ pressed }) => [styles.chip, { backgroundColor: c.accent }, pressed && styles.pressed]}>
                <SymbolView name="location.fill" tintColor={c.onAccent} size={13} />
                <Text style={[styles.chipText, { color: c.onAccent }]}>I'm here now</Text>
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel={`Enter the ${slot.label} address`} onPress={() => { setEditing(open ? null : slot.id); setAddress(''); setMessage(''); }}
                style={({ pressed }) => [styles.chip, { backgroundColor: c.surfaceStrong, borderColor: c.border, borderWidth: StyleSheet.hairlineWidth }, pressed && styles.pressed]}>
                <Text style={[styles.chipText, { color: c.text }]}>Enter address</Text>
              </Pressable>
            </View> : null}
            {open && !isSaved ? <View style={styles.addressRow}>
              <TextInput value={address} onChangeText={setAddress} autoFocus autoCapitalize="words" autoCorrect={false} returnKeyType="done"
                accessibilityLabel={`${slot.label} address`} placeholder="Street address" placeholderTextColor={c.textTertiary}
                onSubmitEditing={() => void useAddress(slot.id)} editable={!busy}
                style={[styles.input, { color: c.text, backgroundColor: c.surfaceStrong, borderColor: c.border }]} />
              <Pressable accessibilityRole="button" accessibilityLabel={`Save ${slot.label}`} disabled={!address.trim() || Boolean(busy)} onPress={() => void useAddress(slot.id)}
                style={({ pressed }) => [styles.save, { backgroundColor: c.accent, opacity: address.trim() ? 1 : 0.5 }, pressed && styles.pressed]}>
                <Text style={[styles.chipText, { color: c.onAccent }]}>Save</Text>
              </Pressable>
            </View> : null}
          </View>;
        })}
      </View>
      {message ? <Text accessibilityRole="alert" style={[styles.message, { color: c.text }]}>{message}</Text> : null}
      <Text style={[styles.fine, { color: c.textTertiary }]}>Stored only on this {DEVICE_NAME} and in your private iCloud. Change them anytime in Settings → Saved Places.</Text>
      <View style={styles.spacer} />
      <Pressable accessibilityRole="button" onPress={onDone} style={({ pressed }) => [styles.primary, { backgroundColor: c.accent }, pressed && styles.pressed]}>
        <Text style={[styles.primaryText, { color: c.onAccent }]}>{any ? 'Continue' : 'Skip for now'}</Text>
      </Pressable>
    </ScrollView>
  </View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: 24, gap: 12 },
  flex: { flex: 1, minWidth: 0 },
  spacer: { flexGrow: 1, minHeight: 12 },
  pressed: { opacity: 0.72, transform: [{ scale: 0.985 }] },
  kicker: { fontSize: 11, lineHeight: 14, fontWeight: '700', letterSpacing: 1.2, marginTop: 18 },
  title: { fontFamily: SERIF, fontSize: 34, lineHeight: 40, fontWeight: '600', letterSpacing: -0.5 },
  body: { fontSize: 16, lineHeight: 23 },
  card: { borderRadius: 24, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden', marginTop: 8 },
  slot: { padding: 14, gap: 12 },
  slotRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  slotName: { fontSize: 17, fontWeight: '600' },
  slotHint: { fontSize: 13 },
  actions: { flexDirection: 'row', gap: 8 },
  chip: { minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, borderRadius: 20 },
  chipText: { fontSize: 14, fontWeight: '700' },
  addressRow: { flexDirection: 'row', gap: 8 },
  input: { flex: 1, minHeight: 44, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 12, fontSize: 16 },
  save: { minHeight: 44, borderRadius: 22, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  message: { fontSize: 14, lineHeight: 20 },
  fine: { fontSize: 12, lineHeight: 17 },
  primary: { minHeight: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  primaryText: { fontSize: 17, fontWeight: '700' },
});
