import { useState } from 'react';
import { Pressable, Share, Text, View } from 'react-native';
import * as Updates from 'expo-updates';
import { useAppTheme } from './app-theme';
import { formatUpdateLogs, redactUpdateLog } from './update-diagnostics-format';
import { readStartupFailure } from './startup-diagnostics';
import { readThemeAnimationDiagnostics } from './theme-animation-diagnostics';

export function UpdateDiagnostics() {
  const theme = useAppTheme();
  const state = Updates.useUpdates();
  const [report, setReport] = useState('');
  const [busy, setBusy] = useState(false);
  const [shareError, setShareError] = useState('');
  const ink = theme.color('#fff6ed', 'text');
  const load = async () => {
    if (busy) return;
    setBusy(true);
    const startupFailure = readStartupFailure();
    try {
      const logs = await Updates.readLogEntriesAsync(24 * 60 * 60 * 1000);
      setReport(redactUpdateLog([
        'JourneyDeck update diagnostics DIAG-11',
        `Captured: ${new Date().toISOString()}`,
        `Running: ${Updates.updateId ?? 'embedded'}`,
        `Downloaded: ${state.downloadedUpdate?.updateId ?? 'none'}`,
        `Runtime: ${Updates.runtimeVersion ?? 'unknown'} / Channel: ${Updates.channel ?? 'unknown'}`,
        `Embedded: ${Updates.isEmbeddedLaunch} / Emergency: ${Updates.isEmergencyLaunch}`,
        `Emergency reason: ${Updates.emergencyLaunchReason ?? 'none'}`,
        startupFailure,
        readThemeAnimationDiagnostics(),
        formatUpdateLogs(logs),
      ].join('\n\n')));
    } catch (error) {
      setReport(`${startupFailure}\n\nCould not read update logs: ${redactUpdateLog(error instanceof Error ? error.message : String(error))}`);
    } finally { setBusy(false); }
  };
  const share = async () => {
    setShareError('');
    try { await Share.share({ title: 'JourneyDeck update diagnostics', message: report }); }
    catch { setShareError('Sharing could not open. You can select and copy the report below.'); }
  };
  const button = { padding: 14, borderRadius: 12, borderWidth: 1, borderColor: theme.color('#b795e5', 'text') };
  return <View style={{ padding: 16, gap: 12, borderWidth: 1, borderRadius: 20, borderColor: theme.color('#b795e5', 'text') }}>
    <Text style={{ color: ink, fontSize: 20, fontWeight: '700' }}>Update diagnostics · DIAG-11</Text>
    <Text style={{ color: ink }}>Read the last 24 hours of update logs, theme-animation breadcrumbs, and the last locally recorded JavaScript failure. Nothing is uploaded automatically. Review the report before sharing; URLs, credentials, email addresses and precise decimal values are filtered.</Text>
    <Pressable accessibilityRole="button" disabled={busy} onPress={() => void load()} style={button}><Text style={{ color: ink }}>{busy ? 'Reading…' : 'Read update logs'}</Text></Pressable>
    {!!report && <>
      <Pressable accessibilityRole="button" onPress={() => void share()} style={button}><Text style={{ color: ink }}>Share update report</Text></Pressable>
      {!!shareError && <Text style={{ color: ink }}>{shareError}</Text>}
      <Text selectable style={{ color: ink, fontSize: 12, lineHeight: 18 }}>{report}</Text>
    </>}
  </View>;
}
