import { useCallback, useEffect, useRef, useState } from 'react';
import { v4Styles } from './v4-phone';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import { ensureConnectorAppLink } from './connector-app-link';
import { ConnectionsError, disconnectAssistant, fetchConnections, saveAssistantSharing } from './connector-connections-api';
import { CONNECTIONS_ERROR_TEXT, connectionDates, connectionsBaseUrl, effectiveSharing, sharingSummary, type ConnectedAssistant, type ConnectionsErrorCode } from './connector-connections-model';
import { CONNECTOR_PRIVACY_OPTIONS, type ConnectorPrivacy, type ConnectorPrivacyKey } from './connector-privacy';
import { CONNECTOR_MCP_URL } from './release-features';

type Colors = { text: string; muted: string; card: string; border: string; accent: string; onAccent: string; inset: string };

type Props = {
  profileId: string;
  /** The app-wide switches in "What assistants can see"; they apply on top of each assistant's. */
  appPrivacy: ConnectorPrivacy;
  cloudStatus: string;
  onSync: () => void;
  colors: Colors;
};

type State =
  | { kind: 'loading' }
  | { kind: 'error'; code: ConnectionsErrorCode }
  | { kind: 'ready'; connections: ConnectedAssistant[] };

/** V4 Settings → AI Assistants: each connected assistant, what it can read, and Disconnect. */
export function ConnectedAssistants({ profileId, appPrivacy, cloudStatus, onSync, colors }: Props) {
  const baseUrl = connectionsBaseUrl(CONNECTOR_MCP_URL);
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [expanded, setExpanded] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const secret = useRef<string | null>(null);
  const generation = useRef(0);

  const load = useCallback(async () => {
    if (!baseUrl) return;
    const run = ++generation.current;
    setState(current => (current.kind === 'ready' ? current : { kind: 'loading' }));
    try {
      secret.current = await ensureConnectorAppLink(profileId);
      const result = await fetchConnections(baseUrl, secret.current);
      if (run === generation.current) setState({ kind: 'ready', connections: result.connections });
    } catch (e) {
      if (run === generation.current) setState({ kind: 'error', code: e instanceof ConnectionsError ? e.code : 'unknown' });
    }
  }, [baseUrl, profileId]);

  useEffect(() => { setExpanded(null); setMessage(''); void load(); }, [load]);

  // A just-finished iCloud sync may have delivered the link the connector was waiting for.
  const lastCloud = useRef(cloudStatus);
  useEffect(() => {
    if (lastCloud.current === 'syncing' && cloudStatus === 'synced' && state.kind === 'error') void load();
    lastCloud.current = cloudStatus;
  }, [cloudStatus, load, state.kind]);

  if (!baseUrl) return null;

  const replace = (next: ConnectedAssistant) => setState(current => (current.kind === 'ready' ? { kind: 'ready', connections: current.connections.map(c => (c.id === next.id ? next : c)) } : current));

  const toggle = async (assistant: ConnectedAssistant, key: ConnectorPrivacyKey, value: boolean) => {
    if (!secret.current) return;
    const sharing = { ...assistant.sharing, [key]: value };
    replace({ ...assistant, sharing, sharingSource: 'app' });
    setBusy(assistant.id);
    try {
      replace(await saveAssistantSharing(baseUrl, secret.current, assistant.id, sharing));
      setMessage(`Saved. ${assistant.name} sees this on its next question.`);
    } catch (e) {
      replace(assistant);
      setMessage(CONNECTIONS_ERROR_TEXT[e instanceof ConnectionsError ? e.code : 'unknown']);
    } finally {
      setBusy(null);
    }
  };

  const disconnect = (assistant: ConnectedAssistant) => {
    Alert.alert(`Disconnect ${assistant.name}?`, `${assistant.name} will stop reading your JourneyDeck data. To use it again, connect JourneyDeck in ${assistant.name} and sign in with Apple.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Disconnect', style: 'destructive', onPress: async () => {
        if (!secret.current) return;
        setBusy(assistant.id);
        try {
          await disconnectAssistant(baseUrl, secret.current, assistant.id);
          setState(current => (current.kind === 'ready' ? { kind: 'ready', connections: current.connections.filter(c => c.id !== assistant.id) } : current));
          setExpanded(null);
          setMessage(`${assistant.name} is disconnected.`);
        } catch (e) {
          setMessage(CONNECTIONS_ERROR_TEXT[e instanceof ConnectionsError ? e.code : 'unknown']);
        } finally {
          setBusy(null);
        }
      } },
    ]);
  };

  return <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
    <View style={styles.header}>
      <Text style={[styles.kicker, { color: colors.accent }]}>CONNECTED ASSISTANTS</Text>
      {state.kind !== 'loading' && <Pressable accessibilityRole="button" accessibilityLabel="Refresh connected assistants" onPress={() => void load()} hitSlop={10} style={({ pressed }) => pressed && styles.pressed}>
        <SymbolView name="arrow.clockwise" tintColor={colors.accent} size={16} />
      </Pressable>}
    </View>

    {state.kind === 'loading' && <View style={styles.center}><ActivityIndicator color={colors.accent} /><Text style={[styles.body, { color: colors.muted }]}>Checking your connections…</Text></View>}

    {state.kind === 'error' && <View style={styles.errorBox}>
      <Text accessibilityRole="alert" style={[styles.body, { color: colors.text }]}>{CONNECTIONS_ERROR_TEXT[state.code]}</Text>
      <View style={styles.buttonRow}>
        {state.code === 'not_linked' && <Pressable accessibilityRole="button" disabled={cloudStatus === 'syncing'} onPress={onSync} style={({ pressed }) => [styles.button, { borderColor: colors.accent }, (pressed || cloudStatus === 'syncing') && styles.pressed]}>
          <Text style={[styles.buttonText, { color: colors.accent }]}>{cloudStatus === 'syncing' ? 'Syncing…' : 'Sync iCloud now'}</Text>
        </Pressable>}
        <Pressable accessibilityRole="button" onPress={() => void load()} style={({ pressed }) => [styles.button, { borderColor: colors.border }, pressed && styles.pressed]}>
          <Text style={[styles.buttonText, { color: colors.text }]}>Try again</Text>
        </Pressable>
      </View>
    </View>}

    {state.kind === 'ready' && state.connections.length === 0 && <Text style={[styles.body, { color: colors.muted }]}>No assistants are connected yet. Follow the steps above, and each one you connect shows up here with its own switches.</Text>}

    {state.kind === 'ready' && state.connections.map((assistant, index) => {
      const open = expanded === assistant.id;
      const effective = effectiveSharing(assistant.sharing, appPrivacy);
      return <View key={assistant.id} style={index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }}>
        <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} accessibilityLabel={`${assistant.name}. ${sharingSummary(effective)}. ${connectionDates(assistant)}`} accessibilityHint={open ? 'Hides its switches' : 'Shows what it can read'}
          onPress={() => setExpanded(open ? null : assistant.id)} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
          <View style={[styles.avatar, { backgroundColor: colors.inset, borderColor: colors.border }]}><Text style={[styles.avatarText, { color: colors.accent }]}>{assistant.name.charAt(0).toUpperCase()}</Text></View>
          <View style={styles.flex}>
            <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>{assistant.name}{assistant.host && assistant.host !== assistant.name ? <Text style={{ color: colors.muted }}>{`  ${assistant.host}`}</Text> : null}</Text>
            <Text style={[styles.detail, { color: colors.muted }]}>{sharingSummary(effective)}</Text>
            <Text style={[styles.detail, { color: colors.muted }]}>{connectionDates(assistant)}</Text>
          </View>
          {busy === assistant.id ? <ActivityIndicator color={colors.accent} /> : <SymbolView name={open ? 'chevron.up' : 'chevron.down'} tintColor={colors.muted} size={14} />}
        </Pressable>
        {open && <View style={[styles.panel, { backgroundColor: colors.inset }]}>
          <Text style={[styles.detail, { color: colors.muted }]}>{assistant.name} always sees journey dates, distances and place names.</Text>
          {CONNECTOR_PRIVACY_OPTIONS.map(option => {
            const offForAll = !appPrivacy[option.key];
            return <View key={option.key} style={styles.toggleRow}>
              <SymbolView name={option.symbol as SFSymbol} tintColor={offForAll ? colors.muted : colors.accent} size={16} />
              <View style={styles.flex}>
                <Text style={[styles.toggleTitle, { color: offForAll ? colors.muted : colors.text }]}>{option.title}</Text>
                {offForAll && <Text style={[styles.detail, { color: colors.muted }]}>Off for every assistant in What assistants can see</Text>}
              </View>
              <Switch accessibilityLabel={`Share ${option.title} with ${assistant.name}`} disabled={offForAll || busy === assistant.id} value={effective[option.key]}
                onValueChange={value => void toggle(assistant, option.key, value)} trackColor={{ false: colors.border, true: colors.accent }} />
            </View>;
          })}
          <Pressable accessibilityRole="button" accessibilityLabel={`Disconnect ${assistant.name}`} disabled={busy === assistant.id} onPress={() => disconnect(assistant)} style={({ pressed }) => [styles.disconnect, { borderColor: colors.border }, pressed && styles.pressed]}>
            <Text style={[styles.buttonText, { color: colors.text }]}>Disconnect {assistant.name}</Text>
          </Pressable>
        </View>}
      </View>;
    })}

    {message ? <Text accessibilityRole="alert" style={[styles.detail, { color: colors.text }]}>{message}</Text> : null}
  </View>;
}

const styles = v4Styles(StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 20, padding: 18, gap: 12 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  kicker: { fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  body: { fontSize: 13, lineHeight: 19 },
  center: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44 },
  errorBox: { gap: 10 },
  buttonRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  button: { minHeight: 44, borderWidth: 1, borderRadius: 12, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 14 },
  buttonText: { fontSize: 13, fontWeight: '800', textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, minHeight: 60 },
  avatar: { width: 40, height: 40, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 18, fontWeight: '800' },
  flex: { flex: 1 },
  name: { fontSize: 16, fontWeight: '700' },
  detail: { fontSize: 12, lineHeight: 17 },
  panel: { borderRadius: 14, padding: 12, gap: 4, marginBottom: 12 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48 },
  toggleTitle: { fontSize: 15, fontWeight: '600' },
  disconnect: { minHeight: 44, borderWidth: 1, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  pressed: { opacity: 0.6 },
}), {
  card: { borderRadius: 24, borderWidth: StyleSheet.hairlineWidth },
  button: { borderRadius: 22 },
  avatar: { borderRadius: 20, borderWidth: StyleSheet.hairlineWidth },
  panel: { borderRadius: 18 },
  disconnect: { borderRadius: 22, borderWidth: StyleSheet.hairlineWidth },
});
