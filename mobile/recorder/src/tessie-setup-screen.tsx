import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAppTheme } from './app-theme';
import { appDataClient } from './app-data';
import { connectTessieDirect, disconnectTessieDirect, tessieDirectStatus } from './tessie-direct';

type Props = {
  visible: boolean;
  onClose: () => void;
  onConnectionChanged: () => void;
  onOpenVehicle: () => void;
};

export function TessieSetupScreen({ visible, onClose, onConnectionChanged, onOpenVehicle }: Props) {
  const { palette } = useAppTheme();
  const [token, setToken] = useState('');
  const [connected, setConnected] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!visible) { setToken(''); return; }
    let active = true;
    void tessieDirectStatus().then(status => { if (active) setConnected(status === 'connected'); })
      .catch(() => { if (active) setConnected(false); });
    return () => { active = false; };
  }, [visible]);

  const connect = async () => {
    if (busy) return;
    setBusy(true);
    setMessage('');
    try {
      const count = await connectTessieDirect(token);
      setToken('');
      setConnected(true);
      onConnectionChanged();
      try {
        const snapshot = await appDataClient.syncVehicleIntelligence();
        setMessage(`${count} ${count === 1 ? 'vehicle' : 'vehicles'} connected. ${snapshot.chargingSessions.length} charging sessions are ready to explore.`);
      } catch (error) {
        setMessage(`Tessie is connected, but the first refresh failed: ${error instanceof Error ? error.message : 'Please try again.'}`);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Tessie could not connect.');
    } finally { setBusy(false); }
  };

  const disconnect = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await disconnectTessieDirect();
      appDataClient.clearTessieVehicleCache();
      setConnected(false);
      setToken('');
      setMessage('Tessie disconnected from this JourneyDeck profile. Saved journeys remain available.');
      onConnectionChanged();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Tessie could not disconnect.');
    } finally { setBusy(false); }
  };

  return <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
    <SafeAreaView style={[styles.safe, { backgroundColor: palette.page }]}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Pressable accessibilityRole="button" accessibilityLabel="Close Tessie setup" onPress={onClose} style={styles.close}><Text style={[styles.link, { color: palette.accent }]}>Done</Text></Pressable>
        <Text accessibilityRole="header" style={[styles.title, { color: palette.text }]}>Connect Tessie</Text>
        <Text style={[styles.body, { color: palette.muted }]}>Add your Tessie access token to see live vehicle status, charging history, drives, and efficiency in JourneyDeck. Your token stays in this iPhone’s profile Keychain and is sent only to JourneyDeck’s privacy edge for Tessie requests.</Text>
        <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.line }]}>
          <Text style={[styles.status, { color: palette.text }]}>{connected ? 'Tessie connected' : 'Tessie not connected'}</Text>
          {connected ? <>
            <Pressable accessibilityRole="button" accessibilityLabel="Open vehicle intelligence" onPress={onOpenVehicle} style={[styles.button, { backgroundColor: palette.accent }]}><Text style={[styles.buttonText, { color: palette.onAccent }]}>Open vehicle intelligence</Text></Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Disconnect Tessie" disabled={busy} onPress={() => void disconnect()} style={styles.secondary}><Text style={[styles.link, { color: palette.accent }]}>Disconnect Tessie</Text></Pressable>
          </> : <>
            <Text style={[styles.label, { color: palette.text }]}>Tessie access token</Text>
            <TextInput accessibilityLabel="Tessie access token" autoCapitalize="none" autoCorrect={false} secureTextEntry maxLength={512} value={token} onChangeText={setToken} placeholder="Paste your Tessie token" placeholderTextColor={palette.muted} style={[styles.input, { color: palette.text, borderColor: palette.line }]} />
            <Pressable accessibilityRole="button" accessibilityLabel="Connect Tessie" accessibilityState={{ disabled: busy || !token.trim(), busy }} disabled={busy || !token.trim()} onPress={() => void connect()} style={[styles.button, { backgroundColor: palette.accent, opacity: busy || !token.trim() ? 0.5 : 1 }]}>{busy ? <ActivityIndicator color={palette.onAccent} /> : <Text style={[styles.buttonText, { color: palette.onAccent }]}>Connect Tessie</Text>}</Pressable>
          </>}
          {!!message && <Text accessibilityLiveRegion="polite" style={[styles.message, { color: palette.text }]}>{message}</Text>}
        </View>
        <Text style={[styles.note, { color: palette.muted }]}>Tessie is optional. Manual recording and your saved journeys work without a vehicle connection. Get an access token from Tessie developer settings.</Text>
      </ScrollView>
    </SafeAreaView>
  </Modal>;
}

const styles = StyleSheet.create({
  safe: { flex: 1 }, content: { flexGrow: 1, width: '100%', maxWidth: 600, alignSelf: 'center', padding: 24, gap: 18 },
  close: { alignSelf: 'flex-end', padding: 8 }, link: { fontSize: 16, fontWeight: '700' },
  title: { fontSize: 34, fontWeight: '800' }, body: { fontSize: 16, lineHeight: 24 },
  card: { borderWidth: 1, borderRadius: 22, padding: 20, gap: 16 }, status: { fontSize: 20, fontWeight: '700' },
  label: { fontSize: 14, fontWeight: '700' }, input: { minHeight: 52, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, fontSize: 16 },
  button: { minHeight: 54, borderRadius: 14, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 16 },
  buttonText: { fontSize: 16, fontWeight: '700' }, secondary: { alignSelf: 'center', padding: 8 },
  message: { fontSize: 14, lineHeight: 20 }, note: { fontSize: 14, lineHeight: 21 },
});
