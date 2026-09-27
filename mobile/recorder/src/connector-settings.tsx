import { useEffect, useRef, useState } from 'react';
import { Pressable, Share, StyleSheet, Switch, Text, View } from 'react-native';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import { useAppTheme } from './app-theme';
import { getPrivatePreference, upsertPrivatePreference } from './local-store';
import { CONNECTOR_PRIVACY_KEY, CONNECTOR_PRIVACY_OPTIONS, normalizeConnectorPrivacy, type ConnectorPrivacy, type ConnectorPrivacyKey } from './connector-privacy';
import { CONNECTOR_MCP_URL } from './release-features';

type CloudStatus = 'unavailable' | 'idle' | 'syncing' | 'synced' | 'needs_icloud' | 'error';

type Props = {
  profileId: string;
  membershipTier: 'free' | 'paid';
  hasAppleAccount: boolean;
  cloudStatus: CloudStatus;
  onSync: () => void;
  onMembership: () => void;
  onAccount: () => void;
};

const EXAMPLE_QUESTIONS = [
  'How many miles did I drive last month?',
  'What did I listen to on my longest drive this year?',
  'Where did I drop markers on my last road trip?',
];

export function readConnectorPrivacy(profileId: string): ConnectorPrivacy {
  return normalizeConnectorPrivacy(getPrivatePreference<unknown>(profileId, CONNECTOR_PRIVACY_KEY));
}

/** V4 Settings → Connect to Claude: readiness, setup steps, and what the connector may share. */
export function ConnectorSettings({ profileId, membershipTier, hasAppleAccount, cloudStatus, onSync, onMembership, onAccount }: Props) {
  const theme = useAppTheme();
  const activeProfile = useRef(profileId);
  activeProfile.current = profileId;
  const [privacy, setPrivacy] = useState<ConnectorPrivacy>(() => readConnectorPrivacy(profileId));
  const [message, setMessage] = useState('');
  useEffect(() => { setPrivacy(readConnectorPrivacy(profileId)); setMessage(''); }, [profileId]);

  const colors = { text: theme.palette.text, muted: theme.palette.muted, card: theme.palette.card, border: theme.palette.line, accent: theme.palette.accent, onAccent: theme.palette.onAccent, inset: theme.palette.inset };
  const plus = membershipTier === 'paid';
  const cloudReady = cloudStatus === 'synced' || cloudStatus === 'idle' || cloudStatus === 'syncing';

  const toggle = (key: ConnectorPrivacyKey, value: boolean) => {
    const next = { ...privacy, [key]: value };
    try {
      upsertPrivatePreference(profileId, CONNECTOR_PRIVACY_KEY, next);
      if (activeProfile.current !== profileId) return;
      setPrivacy(next);
      setMessage('Saved. Claude sees this change after your next iCloud sync.');
    } catch {
      setMessage('This setting could not be saved. Try again.');
    }
  };
  const shareAddress = () => { if (CONNECTOR_MCP_URL) void Share.share({ message: CONNECTOR_MCP_URL }).catch(() => undefined); };

  return <View style={styles.stack}>
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[styles.kicker, { color: colors.accent }]}>JOURNEYDECK FOR AI ASSISTANTS</Text>
      <Text style={[styles.title, { color: colors.text }]}>Ask Claude about your drives</Text>
      <Text style={[styles.body, { color: colors.muted }]}>Connect JourneyDeck to Claude to ask about your journeys, music, places and memories. Claude reads what JourneyDeck has backed up to your private iCloud, read-only, and only what you choose below. JourneyDeck keeps an encrypted sign-in token, never your journeys.</Text>
      <View style={styles.checks}>
        <ReadinessRow ok={plus} title={plus ? 'JourneyDeck Plus is active' : 'Requires JourneyDeck Plus'} action={plus ? undefined : { label: 'View', onPress: onMembership }} colors={colors} />
        <ReadinessRow ok={hasAppleAccount} title={hasAppleAccount ? 'Signed in with Apple' : 'Sign in with Apple'} action={hasAppleAccount ? undefined : { label: 'Open', onPress: onAccount }} colors={colors} />
        <ReadinessRow ok={cloudReady} title={cloudReady ? 'iCloud backup is on' : 'Turn on iCloud backup'} action={cloudReady ? undefined : { label: 'Open', onPress: onAccount }} colors={colors} />
      </View>
    </View>

    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[styles.kicker, { color: colors.accent }]}>CONNECT IN CLAUDE</Text>
      <Step number="1" text="In Claude, open Settings → Connectors → Add custom connector." colors={colors} />
      <Step number="2" text="Paste this address:" colors={colors} />
      {CONNECTOR_MCP_URL && <View style={[styles.address, { backgroundColor: colors.inset, borderColor: colors.border }]}>
        <Text selectable accessibilityLabel={`Connector address ${CONNECTOR_MCP_URL}`} style={[styles.addressText, { color: colors.text }]}>{CONNECTOR_MCP_URL}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Share or copy the connector address" onPress={shareAddress} style={({ pressed }) => [styles.addressAction, pressed && styles.pressed]}>
          <SymbolView name="square.and.arrow.up" tintColor={colors.accent} size={18} />
        </Pressable>
      </View>}
      <Step number="3" text="Choose Connect, sign in with the Apple Account this iPhone uses, then Allow." colors={colors} />
      <Text style={[styles.label, { color: colors.muted }]}>THEN TRY</Text>
      {EXAMPLE_QUESTIONS.map(question => <Text key={question} style={[styles.example, { color: colors.text, borderColor: colors.border }]}>“{question}”</Text>)}
    </View>

    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[styles.kicker, { color: colors.accent }]}>WHAT CLAUDE CAN SEE</Text>
      <Text style={[styles.body, { color: colors.muted }]}>Journey dates, distances and place names are always shared. Turn off anything else you'd rather keep to yourself.</Text>
      {CONNECTOR_PRIVACY_OPTIONS.map((option, index) => <View key={option.key} style={[styles.toggleRow, index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}>
        <View style={[styles.toggleIcon, { backgroundColor: colors.inset }]}><SymbolView name={option.symbol as SFSymbol} tintColor={colors.accent} size={17} /></View>
        <View style={styles.flex}>
          <Text style={[styles.toggleTitle, { color: colors.text }]}>{option.title}</Text>
          <Text style={[styles.toggleDetail, { color: colors.muted }]}>{option.detail}</Text>
        </View>
        <Switch accessibilityLabel={`Share ${option.title} with Claude`} value={privacy[option.key]} onValueChange={value => toggle(option.key, value)} trackColor={{ false: colors.border, true: colors.accent }} />
      </View>)}
      {message ? <Text accessibilityRole="alert" style={[styles.message, { color: colors.text }]}>{message}</Text> : null}
      <Pressable accessibilityRole="button" accessibilityLabel="Sync iCloud now" accessibilityState={{ disabled: cloudStatus === 'syncing' }} disabled={cloudStatus === 'syncing'} onPress={onSync}
        style={({ pressed }) => [styles.button, { borderColor: colors.accent }, (pressed || cloudStatus === 'syncing') && styles.pressed]}>
        <Text style={[styles.buttonText, { color: colors.accent }]}>{cloudStatus === 'syncing' ? 'Syncing…' : 'Sync iCloud now'}</Text>
      </Pressable>
      <Text style={[styles.footnote, { color: colors.muted }]}>Changes reach Claude after JourneyDeck's next iCloud sync. To disconnect, remove JourneyDeck in Claude's connector settings.</Text>
    </View>
  </View>;
}

type Colors = { text: string; muted: string; accent: string; onAccent: string; border: string };

function ReadinessRow({ ok, title, action, colors }: { ok: boolean; title: string; action?: { label: string; onPress: () => void }; colors: Colors }) {
  return <View style={styles.checkRow}>
    <SymbolView name={ok ? 'checkmark.circle.fill' : 'circle'} tintColor={ok ? colors.accent : colors.muted} size={20} />
    <Text style={[styles.checkTitle, { color: colors.text }]}>{title}</Text>
    {action && <Pressable accessibilityRole="button" accessibilityLabel={`${action.label}: ${title}`} onPress={action.onPress} style={({ pressed }) => [styles.checkAction, { borderColor: colors.accent }, pressed && styles.pressed]}>
      <Text style={[styles.checkActionText, { color: colors.accent }]}>{action.label}</Text>
    </Pressable>}
  </View>;
}

function Step({ number, text, colors }: { number: string; text: string; colors: Colors }) {
  return <View style={styles.step}>
    <View style={[styles.stepNumber, { borderColor: colors.accent }]}><Text style={[styles.stepNumberText, { color: colors.accent }]}>{number}</Text></View>
    <Text style={[styles.stepText, { color: colors.text }]}>{text}</Text>
  </View>;
}

const styles = StyleSheet.create({
  stack: { gap: 16 },
  flex: { flex: 1 },
  card: { borderWidth: 1, borderRadius: 20, padding: 18, gap: 12 },
  kicker: { fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  title: { fontSize: 21, fontWeight: '800' },
  body: { fontSize: 13, lineHeight: 19 },
  checks: { gap: 10, paddingTop: 4 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 32 },
  checkTitle: { flex: 1, fontSize: 15, fontWeight: '600' },
  checkAction: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 5 },
  checkActionText: { fontSize: 13, fontWeight: '800' },
  step: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  stepNumber: { width: 28, height: 28, borderWidth: 1, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  stepNumberText: { fontSize: 13, fontWeight: '800' },
  stepText: { flex: 1, fontSize: 15, lineHeight: 22, paddingTop: 2 },
  address: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 12, paddingLeft: 14, paddingVertical: 6, marginLeft: 40 },
  addressText: { flex: 1, fontSize: 14, fontFamily: 'Menlo' },
  addressAction: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 11, fontWeight: '800', letterSpacing: 1, marginTop: 6 },
  example: { fontSize: 14, lineHeight: 20, borderLeftWidth: 2, paddingLeft: 10 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  toggleIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  toggleTitle: { fontSize: 15, fontWeight: '700' },
  toggleDetail: { fontSize: 12, lineHeight: 17, marginTop: 2 },
  message: { fontSize: 12, lineHeight: 17 },
  button: { minHeight: 44, borderWidth: 1, borderRadius: 12, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 9 },
  buttonText: { fontSize: 13, fontWeight: '800', textAlign: 'center' },
  footnote: { fontSize: 12, lineHeight: 17 },
  pressed: { opacity: 0.6 },
});
