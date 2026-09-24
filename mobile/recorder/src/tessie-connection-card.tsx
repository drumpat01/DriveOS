import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAppTheme } from './app-theme';
import { connectTessieDirect, disconnectTessieDirect, hasTessieCredentials, syncTessieDirect, tessieDirectStatus } from './tessie-direct';
import { TESSIE_INTEGRATION_ENABLED } from './release-features';
import { NativeSheet } from './native-sheet';
import { loadRecordingModePreferences, saveRecordingModePreferences } from './recording-mode';

type Props = { profileId: string; membershipTier: 'free' | 'paid'; onUpgrade: () => void; onChanged: () => void };

export function TessieConnectionCard({ profileId, membershipTier, onUpgrade, onChanged }: Props) {
  const theme = useAppTheme();
  const activeProfile = useRef(profileId);
  activeProfile.current = profileId;
  const [connected, setConnected] = useState(false);
  const [hasCredentials, setHasCredentials] = useState(false);
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState(false);
  const [connectSheetOpen, setConnectSheetOpen] = useState(false);
  const [token, setToken] = useState('');
  const [message, setMessage] = useState('');
  useEffect(() => {
    let active = true;
    setConnected(false); setHasCredentials(false); setChecking(true); setBusy(false); setConnectSheetOpen(false); setToken(''); setMessage('');
    void Promise.all([tessieDirectStatus(), hasTessieCredentials()]).then(([status, saved]) => {
      if (active) { setConnected(status === 'connected'); setHasCredentials(saved); }
    })
      .catch(() => { if (active) setMessage('Connection status is unavailable right now.'); })
      .finally(() => { if (active) setChecking(false); });
    return () => { active = false; };
  }, [profileId, membershipTier]);
  if (!TESSIE_INTEGRATION_ENABLED) return null;

  const closeConnectSheet = () => {
    if (busy) return;
    setConnectSheetOpen(false); setToken(''); setMessage('');
  };

  const connect = async () => {
    if (busy || !token.trim()) return;
    setBusy(true); setMessage('');
    try {
      const count = await connectTessieDirect(token);
      if (activeProfile.current !== profileId) return;
      setToken(''); setConnectSheetOpen(false); setConnected(true); setHasCredentials(true);
      saveRecordingModePreferences({ mode: 'automatic', onboardingCompleted: true });
      setMessage(`${count} ${count === 1 ? 'vehicle' : 'vehicles'} connected. JourneyDeck now watches for drives and shows them while recording. Tessie history refreshes when the app opens.`);
      onChanged();
    } catch (error) { if (activeProfile.current === profileId) setMessage(error instanceof Error ? error.message : 'Tessie could not connect.'); }
    finally { if (activeProfile.current === profileId) setBusy(false); }
  };
  const refresh = async () => {
    if (busy) return;
    setBusy(true); setMessage('');
    try {
      const snapshot = await syncTessieDirect();
      if (activeProfile.current !== profileId) return;
      setMessage(`Updated ${snapshot.vehicles.length} ${snapshot.vehicles.length === 1 ? 'vehicle' : 'vehicles'}, ${snapshot.drives.length} drives, and ${snapshot.charges.length} charges on this device. New journeys appear in your library.`);
      onChanged();
    } catch (error) {
      if (activeProfile.current !== profileId) return;
      const status = await tessieDirectStatus().catch(() => 'connected' as const);
      if (activeProfile.current !== profileId) return;
      setConnected(status === 'connected');
      setMessage(status === 'connected'
        ? error instanceof Error ? error.message : 'Vehicle history could not refresh. Saved data is still available.'
        : 'Tessie access expired. Enter a new token to reconnect.');
    }
    finally { if (activeProfile.current === profileId) setBusy(false); }
  };
  const disconnect = async () => {
    if (busy) return;
    setBusy(true); setMessage('');
    try {
      await disconnectTessieDirect();
      if (activeProfile.current !== profileId) return;
      setConnected(false); setHasCredentials(false); setToken(''); setMessage('Tessie disconnected and its cache removed. Imported journeys remain in your library.');
      const recording = loadRecordingModePreferences();
      if (recording.mode === 'automatic') saveRecordingModePreferences({ mode: 'manual', onboardingCompleted: recording.onboardingCompleted });
      onChanged();
    } catch { if (activeProfile.current === profileId) setMessage('Tessie could not disconnect. Try again.'); }
    finally { if (activeProfile.current === profileId) setBusy(false); }
  };

  const colors = { text: theme.palette.text, muted: theme.palette.muted, card: theme.palette.card, border: theme.palette.line, accent: theme.palette.accent, onAccent: theme.palette.onAccent };
  const sheetColors = { text: '#fff6ed', muted: '#b7c2d6', border: '#4b5265' };
  return <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
    <Text style={[styles.kicker, { color: colors.accent }]}>CONNECTED VEHICLE · V3</Text>
    <Text style={[styles.title, { color: colors.text }]}>Tessie</Text>
    <Text style={[styles.body, { color: colors.muted }]}>Optional Tesla journey capture and charging history. Your token is stored in this device’s Keychain and sent securely to the privacy edge for Tessie requests. Car GPS routes are saved in your journey archive and can sync to your private iCloud.</Text>
    {checking ? <ActivityIndicator color={colors.accent} /> : membershipTier !== 'paid' ? <>
      <Text style={[styles.body, { color: colors.muted }]}>An active, verified JourneyDeck membership is required for this connection. Your recorded journeys remain available without it.</Text>
      <Action label="View membership" onPress={onUpgrade} disabled={busy} accent={colors.accent} onAccent={colors.onAccent} />
    </> : connected ? <View style={styles.actions}>
      <Action label={busy ? 'Working…' : 'Refresh vehicle history'} onPress={() => void refresh()} disabled={busy} accent={colors.accent} onAccent={colors.onAccent} />
    </View> : <Action label="Connect Tessie" onPress={() => { setMessage(''); setConnectSheetOpen(true); }} disabled={busy} accent={colors.accent} onAccent={colors.onAccent} />}
    {!checking && hasCredentials && <Action label="Disconnect Tessie" onPress={() => void disconnect()} disabled={busy} accent={colors.accent} onAccent={colors.onAccent} secondary />}
    {message && !connectSheetOpen ? <Text accessibilityRole="alert" style={[styles.message, { color: colors.text }]}>{message}</Text> : null}
    <NativeSheet visible={connectSheetOpen} kicker="CONNECTED VEHICLE" title="Connect Tessie" onClose={closeConnectSheet} busy={busy}
      footer={<Action label={busy ? 'Checking token…' : 'Connect Tessie'} onPress={() => void connect()} disabled={busy || !token.trim()} accent={colors.accent} onAccent={colors.onAccent} />}>
      <Text style={[styles.sheetIntro, { color: sheetColors.text }]}>Get your access token from Tessie</Text>
      <Text style={[styles.sheetBody, { color: sheetColors.muted }]}>You only need one token. In the Tessie app:</Text>
      <View style={styles.steps}>
        <InstructionStep number="1" text="Open Settings." accent={colors.accent} textColor={sheetColors.text} />
        <InstructionStep number="2" text="Tap Developer, then Generate Access Token." accent={colors.accent} textColor={sheetColors.text} />
        <InstructionStep number="3" text="Copy the token and paste it below." accent={colors.accent} textColor={sheetColors.text} />
      </View>
      <Text style={[styles.inputLabel, { color: sheetColors.text }]}>Tessie access token</Text>
      <TextInput value={token} onChangeText={setToken} editable={!busy} secureTextEntry autoCapitalize="none" autoCorrect={false}
        textContentType="none" autoComplete="off" maxLength={512} placeholder="Paste your token" placeholderTextColor={sheetColors.muted}
        accessibilityLabel="Tessie access token" style={[styles.input, { color: sheetColors.text, borderColor: sheetColors.border }]} />
      <Text style={[styles.sheetBody, { color: sheetColors.muted }]}>Keep this token private. JourneyDeck saves it in this iPhone’s Keychain.</Text>
      {message ? <Text accessibilityRole="alert" style={[styles.message, { color: sheetColors.text }]}>{message}</Text> : null}
    </NativeSheet>
  </View>;
}

function InstructionStep({ number, text, accent, textColor }: { number: string; text: string; accent: string; textColor: string }) {
  return <View style={styles.step}>
    <View style={[styles.stepNumber, { borderColor: accent }]}><Text style={[styles.stepNumberText, { color: accent }]}>{number}</Text></View>
    <Text style={[styles.stepText, { color: textColor }]}>{text}</Text>
  </View>;
}

function Action({ label, onPress, disabled, accent, onAccent, secondary = false }: { label: string; onPress: () => void; disabled: boolean; accent: string; onAccent: string; secondary?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
    style={[styles.button, { borderColor: accent, backgroundColor: secondary ? 'transparent' : accent, opacity: disabled ? 0.5 : 1 }]}>
    <Text style={[styles.buttonText, { color: secondary ? accent : onAccent }]}>{label}</Text>
  </Pressable>;
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 20, padding: 18, gap: 12 },
  kicker: { fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  title: { fontSize: 21, fontWeight: '800' },
  body: { fontSize: 13, lineHeight: 19 },
  input: { minHeight: 48, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, fontSize: 14 },
  actions: { gap: 10 },
  button: { minHeight: 44, borderWidth: 1, borderRadius: 12, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 9 },
  buttonText: { fontSize: 13, fontWeight: '800', textAlign: 'center' },
  message: { fontSize: 12, lineHeight: 17 },
  sheetIntro: { fontSize: 18, fontWeight: '800', lineHeight: 24 },
  sheetBody: { fontSize: 13, lineHeight: 19 },
  steps: { gap: 16, paddingVertical: 8 },
  step: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  stepNumber: { width: 28, height: 28, borderWidth: 1, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  stepNumberText: { fontSize: 13, fontWeight: '800' },
  stepText: { flex: 1, fontSize: 15, lineHeight: 22, paddingTop: 2 },
  inputLabel: { fontSize: 13, fontWeight: '700', marginTop: 8 },
});
