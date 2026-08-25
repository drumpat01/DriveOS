import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, AppState, KeyboardAvoidingView, Platform, Pressable,
  ScrollView, StatusBar, StyleSheet, Text, TextInput, View,
} from 'react-native';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import './src/location-task';
import { loadConnection, saveConnection, type Connection } from './src/credentials';
import { completeRecording, flushAllQueuedMusicBestEffort, flushRecording, pingRecorder, setRemoteState } from './src/api';
import {
  activeSession, beginLocalSession, getSessionSummary, initializeDatabase, markSessionCompleted,
  recordLocations, setLocalStatus, type LocalSessionStatus, type SessionSummary,
} from './src/storage';
import { decideRecovery } from './src/recovery';
import { syncPresentation, type SyncStage } from './src/sync-status';
import { isLocationTrackingActive, startLocationTracking, stopLocationTracking } from './src/tracking';
import { JourneyDeckShell } from './src/shell';
import { captureAppleMusicHistoryForSession, recognizeAndQueueActiveSessionMusic, sampleAppleMusicForActiveSession } from './src/music-capture';
import { queueLastFmForCompletedSession, syncPendingLastFmBestEffort } from './src/lastfm-sync';
import { loadAutomaticDriveEvent, resetAutomaticDriveState } from './src/automatic-drive-state';
import {
  loadRecordingModePreferences, subscribeRecordingMode, type RecordingModePreferences,
} from './src/recording-mode';
import {
  isAutomaticDetectionActive, startAutomaticDetection, stopAutomaticDetection,
} from './src/tracking';

const DEFAULT_SERVER_URL = 'https://journeydeck.me';
const messageOf = (error: unknown) => error instanceof Error ? error.message : 'Something unexpected happened.';

function enrichCompletedJourney(connection: Connection, sessionId: string) {
  void captureAppleMusicHistoryForSession(sessionId).then(() => flushAllQueuedMusicBestEffort(connection));
  void queueLastFmForCompletedSession(sessionId);
}

async function captureCurrentPoint(fresh = false) {
  try {
    const location = fresh
      ? await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.BestForNavigation })
      : await Location.getLastKnownPositionAsync({ maxAge: 15_000, requiredAccuracy: 100 });
    if (location) recordLocations([location]);
  } catch {
    // Background tracking remains authoritative if an immediate fix is unavailable.
  }
}

function durationLabel(startedAt?: string) {
  if (!startedAt) return '00:00:00';
  const seconds = Math.max(0, Math.floor((Date.now() - Date.parse(startedAt)) / 1000));
  return [Math.floor(seconds / 3600), Math.floor((seconds % 3600) / 60), seconds % 60]
    .map(value => String(value).padStart(2, '0')).join(':');
}

function statusLabel(status?: LocalSessionStatus, nativeTracking = false) {
  return status === 'recording' ? (nativeTracking ? 'Recording' : 'Recovering recording') : status === 'paused' ? 'Paused' : status === 'finishing' ? 'Waiting to finish' : 'Ready';
}

function RecorderScreen() {
  const insets = useSafeAreaInsets();
  const [connection, setConnection] = useState<Connection | null>(null);
  const [serverUrl, setServerUrl] = useState(DEFAULT_SERVER_URL);
  const [token, setToken] = useState('');
  const [summary, setSummary] = useState<SessionSummary | null>(null);
  const [foregroundPermission, setForegroundPermission] = useState(false);
  const [backgroundPermission, setBackgroundPermission] = useState(false);
  const [taskAvailable, setTaskAvailable] = useState(false);
  const [trackingActive, setTrackingActive] = useState(false);
  const [automaticDetectionActive, setAutomaticDetectionActive] = useState(false);
  const [recordingPreferences, setRecordingPreferences] = useState<RecordingModePreferences>(() => loadRecordingModePreferences());
  const operation = useRef<Promise<void>>(Promise.resolve());
  const refreshPending = useRef<Promise<void> | null>(null);
  const busyRef = useRef(false);
  const remoteRecordingConfirmed = useRef(new Set<string>());
  const announcedAutomaticEvent = useRef('');
  const [busy, setBusy] = useState(false);
  const [busyLabel, setBusyLabel] = useState('Working…');
  const [syncStage, setSyncStage] = useState<SyncStage>('idle');
  const [notice, setNotice] = useState('');
  const [, setClock] = useState(0);

  const runExclusive = useCallback(async (work: () => Promise<void>) => {
    const next = operation.current.then(work, work);
    operation.current = next.catch(() => {});
    return next;
  }, []);

  const refresh = useCallback(() => {
    if (refreshPending.current) return refreshPending.current;
    const pending = runExclusive(async () => {
    initializeDatabase();
    const foreground = await Location.getForegroundPermissionsAsync();
    const background = await Location.getBackgroundPermissionsAsync();
    const available = await TaskManager.isAvailableAsync();
    const permissionsReadyNow = foreground.status === 'granted' && background.status === 'granted' && available;
    let taskRunning = false;
    if (available) {
      try { taskRunning = await isLocationTrackingActive(); } catch { taskRunning = false; }
    }
    let automaticTaskRunning = false;
    if (available) {
      try { automaticTaskRunning = await isAutomaticDetectionActive(); } catch { automaticTaskRunning = false; }
    }
    const current = activeSession();
    const action = decideRecovery(current?.status ?? null, taskRunning, permissionsReadyNow);
    if (action === 'stop-orphaned-task' || action === 'stop-paused-task' || action === 'stop-and-finish') {
      if (taskRunning) await stopLocationTracking();
      taskRunning = false;
    }
    if (action === 'continue-recording' && current && connection && current.remote_created && !remoteRecordingConfirmed.current.has(current.id)) {
      try {
        await setRemoteState(connection, current.id, 'recording');
        remoteRecordingConfirmed.current.add(current.id);
      } catch {}
    }
    if (action === 'restart-recording' && current) {
      try {
        if (!(await startLocationTracking())) throw new Error('iOS did not confirm background location tracking.');
        await captureCurrentPoint(true);
        void sampleAppleMusicForActiveSession({ force: true });
        void recognizeAndQueueActiveSessionMusic(10_000).catch(() => {});
        taskRunning = true;
        setNotice('Recording resumed. A brief route gap may remain; existing points are safe.');
        if (connection && current.remote_created) {
          try {
            await setRemoteState(connection, current.id, 'recording');
            remoteRecordingConfirmed.current.add(current.id);
          } catch {}
        }
      } catch {
        setLocalStatus(current.id, 'paused');
        remoteRecordingConfirmed.current.delete(current.id);
        if (connection && current.remote_created) { try { await setRemoteState(connection, current.id, 'paused'); } catch {} }
        taskRunning = false;
        setNotice('Recording paused because background tracking is unavailable. Existing points are safe; the interruption may have left a route gap.');
      }
    }
    if (action === 'pause-interrupted-recording' && current) {
      if (taskRunning) {
        try { await stopLocationTracking(); } catch {}
        taskRunning = false;
      }
      setLocalStatus(current.id, 'paused');
      remoteRecordingConfirmed.current.delete(current.id);
      if (connection && current.remote_created) { try { await setRemoteState(connection, current.id, 'paused'); } catch {} }
      setNotice('Recording paused because required location access or background tracking is unavailable. Existing points are safe; the interruption may have left a route gap.');
    }
    if (action === 'stop-and-finish' && current && connection) {
      try {
        const completed = await completeRecording(connection, current.id);
        markSessionCompleted(current.id, completed.driveId ?? null);
        enrichCompletedJourney(connection, current.id);
        setSyncStage('synced');
        setNotice('Journey finished and saved to JourneyDeck. Music details may continue syncing in the background.');
      } catch {
        setSyncStage('retry');
        setNotice('Journey is ready to finish. Points remain safe and completion will retry when JourneyDeck is reachable.');
      }
    }
    const reconciled = activeSession();
    setSummary(reconciled ? getSessionSummary(reconciled.id) : null);
    setForegroundPermission(foreground.status === 'granted');
    setBackgroundPermission(background.status === 'granted');
    setTaskAvailable(available);
    setTrackingActive(taskRunning);
    setAutomaticDetectionActive(automaticTaskRunning);
    const automaticEvent = loadAutomaticDriveEvent();
    if (automaticEvent && Date.now() - Date.parse(automaticEvent.occurredAt) <= 30 * 60_000
      && announcedAutomaticEvent.current !== automaticEvent.occurredAt) {
      announcedAutomaticEvent.current = automaticEvent.occurredAt;
      setNotice(automaticEvent.kind === 'started'
        ? 'JourneyDeck detected driving and started this journey automatically.'
        : automaticEvent.kind === 'finished'
          ? 'JourneyDeck detected that you parked and finished the journey automatically.'
          : automaticEvent.kind === 'finish_waiting'
            ? 'The automatic journey ended and is safe on this iPhone. Sync will retry when JourneyDeck is reachable.'
            : 'Driving was detected, but route recording could not start. Check background location access.');
    }
    });
    const tracked = pending.finally(() => {
      if (refreshPending.current === tracked) refreshPending.current = null;
    });
    refreshPending.current = tracked;
    return tracked;
  }, [connection, runExclusive]);

  useEffect(() => subscribeRecordingMode(setRecordingPreferences), []);

  useEffect(() => {
    let cancelled = false;
    const shouldRun = Boolean(connection && foregroundPermission && backgroundPermission && taskAvailable
      && recordingPreferences.onboardingCompleted && recordingPreferences.mode === 'automatic');
    const updateTask = async () => {
      if (shouldRun) await startAutomaticDetection();
      else {
        await stopAutomaticDetection();
        if (recordingPreferences.onboardingCompleted && recordingPreferences.mode === 'manual') resetAutomaticDriveState();
      }
    };
    void updateTask()
      .then(() => isAutomaticDetectionActive())
      .then(active => { if (!cancelled) setAutomaticDetectionActive(active); })
      .catch(() => { if (!cancelled) setAutomaticDetectionActive(false); });
    return () => { cancelled = true; };
  }, [backgroundPermission, connection, foregroundPermission, recordingPreferences, taskAvailable]);

  useEffect(() => {
    let cancelled = false;
    void loadConnection().then(saved => {
      if (cancelled || !saved) return;
      setConnection(saved);
      setServerUrl(saved.serverUrl);
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    void refresh().catch(() => {});
    void sampleAppleMusicForActiveSession({ force: true });
    if (connection) void flushAllQueuedMusicBestEffort(connection);
    void syncPendingLastFmBestEffort();
    let ticks = 0;
    const timer = setInterval(() => {
      setClock(value => value + 1);
      ticks += 1;
      if (ticks % 5 === 0 && !busyRef.current) void refresh().catch(() => {});
      if (ticks % 60 === 0) void syncPendingLastFmBestEffort();
    }, 1000);
    const subscription = AppState.addEventListener('change', state => {
      if (state !== 'active' || busyRef.current) return;
      void refresh().catch(() => {});
      void sampleAppleMusicForActiveSession({ force: true });
      if (connection) void flushAllQueuedMusicBestEffort(connection);
      void syncPendingLastFmBestEffort();
    });
    return () => { clearInterval(timer); subscription.remove(); };
  }, [connection, refresh]);

  useEffect(() => {
    if (!connection || !summary || (summary.queuedCount === 0 && summary.musicQueuedCount === 0) || busy) return;
    const timer = setTimeout(() => {
      void runExclusive(async () => {
        await flushRecording(connection, summary.id);
        setNotice('Journey points synced.');
      }).then(() => void refresh()).catch(() => {});
    }, 1500);
    return () => clearTimeout(timer);
  }, [busy, connection, refresh, runExclusive, summary]);

  const active = Boolean(summary && summary.status !== 'completed');
  const permissionsReady = foregroundPermission && backgroundPermission && taskAvailable;
  const accent = summary?.status === 'recording' && trackingActive ? '#43e6ae' : summary?.status === 'paused' ? '#ffb45c' : '#9b7cff';

  const withBusy = useCallback(async (work: () => Promise<void>, label = 'Working…') => {
    busyRef.current = true; setBusy(true); setBusyLabel(label); setSyncStage('idle'); setNotice('');
    try { await runExclusive(work); }
    catch (error) { const message = messageOf(error); setNotice(message); Alert.alert('JourneyDeck Recorder', message); }
    finally { await refresh().catch(() => {}); busyRef.current = false; setBusy(false); }
  }, [refresh, runExclusive]);

  const connect = () => withBusy(async () => {
    const candidate = { serverUrl: serverUrl.trim().replace(/\/+$/, ''), token: token.trim() };
    if (!candidate.serverUrl.startsWith('https://')) throw new Error('Use the secure https:// JourneyDeck address.');
    if (candidate.token.length < 32) throw new Error('The recorder key must be at least 32 characters.');
    await pingRecorder(candidate);
    const saved = await saveConnection(candidate);
    setConnection(saved); setToken(''); setNotice('Connected securely to JourneyDeck.');
  }, 'Connecting securely…');

  const enablePermissions = () => withBusy(async () => {
    const foreground = await Location.requestForegroundPermissionsAsync();
    if (foreground.status !== 'granted') throw new Error('Location access is required to record a journey.');
    const background = await Location.requestBackgroundPermissionsAsync();
    if (background.status !== 'granted') throw new Error('Choose “Always Allow” so recording continues with the screen locked.');
    if (!(await TaskManager.isAvailableAsync())) throw new Error('Background recording requires the installed JourneyDeck build, not Expo Go.');
    setNotice('Background location is ready.');
  }, 'Checking location access…');

  const start = () => withBusy(async () => {
    if (!connection) throw new Error('Connect this recorder to JourneyDeck first.');
    if (!permissionsReady) throw new Error('Enable background location first.');
    const session = beginLocalSession(connection.deviceId);
    try { if (!(await startLocationTracking())) throw new Error('iOS did not confirm background location tracking.'); await captureCurrentPoint(true); }
    catch (error) { setLocalStatus(session.id, 'paused'); throw error; }
    void sampleAppleMusicForActiveSession({ force: true });
    void recognizeAndQueueActiveSessionMusic(10_000).then(() => flushAllQueuedMusicBestEffort(connection)).catch(() => {});
    try { await flushRecording(connection, session.id); remoteRecordingConfirmed.current.add(session.id); setNotice('Recording started and connected.'); }
    catch { setNotice('Recording started offline. It will sync when JourneyDeck is reachable.'); }
  }, 'Starting background recording…');

  const pause = () => withBusy(async () => {
    if (!connection || !summary) return;
    await captureCurrentPoint(); await stopLocationTracking(); setLocalStatus(summary.id, 'paused'); remoteRecordingConfirmed.current.delete(summary.id);
    try { await flushRecording(connection, summary.id); await setRemoteState(connection, summary.id, 'paused'); setNotice('Recording paused and synced.'); }
    catch { setNotice('Recording paused. Unsynced points are safe on this phone.'); }
  }, 'Pausing recording…');

  const resume = () => withBusy(async () => {
    if (!connection || !summary) return;
    setLocalStatus(summary.id, 'recording');
    try { if (!(await startLocationTracking())) throw new Error('iOS did not confirm background location tracking.'); await captureCurrentPoint(true); }
    catch (error) { setLocalStatus(summary.id, 'paused'); throw error; }
    void sampleAppleMusicForActiveSession({ force: true });
    void recognizeAndQueueActiveSessionMusic(10_000).then(() => flushAllQueuedMusicBestEffort(connection)).catch(() => {});
    try { await setRemoteState(connection, summary.id, 'recording'); remoteRecordingConfirmed.current.add(summary.id); setNotice('Recording resumed.'); }
    catch { setNotice('Recording resumed offline.'); }
  }, 'Resuming recording…');

  const finishSession = useCallback(async (currentConnection: Connection, currentSummary: SessionSummary) => {
    let savedForSync = false;
    busyRef.current = true; setBusy(true); setSyncStage('saving'); setNotice('');
    try {
      await runExclusive(async () => {
        await captureCurrentPoint();
        await stopLocationTracking();
        resetAutomaticDriveState();
        setLocalStatus(currentSummary.id, 'finishing');
        savedForSync = true;
        setTrackingActive(false);
        setSummary(getSessionSummary(currentSummary.id));
        setSyncStage('syncing');
        try {
          const completed = await completeRecording(currentConnection, currentSummary.id);
          markSessionCompleted(currentSummary.id, completed.driveId ?? null);
          enrichCompletedJourney(currentConnection, currentSummary.id);
          setSummary(null);
          setSyncStage('synced');
          setNotice('Journey finished and saved to JourneyDeck. Music details may continue syncing in the background.');
        } catch {
          setSummary(getSessionSummary(currentSummary.id));
          setSyncStage('retry');
          setNotice('Journey saved on this iPhone. Sync did not finish yet; your points are safe.');
        }
      });
    } catch (error) {
      const message = messageOf(error);
      setSyncStage(savedForSync ? 'retry' : 'idle');
      setNotice(message);
      Alert.alert('JourneyDeck Recorder', message);
    } finally {
      busyRef.current = false;
      setBusy(false);
      void refresh().catch(() => {});
    }
  }, [refresh, runExclusive]);

  const finish = () => {
    if (!connection || !summary) return;
    Alert.alert('Finish this journey?', 'Recording will stop and the journey will appear in JourneyDeck after its points sync.', [
      { text: 'Keep recording', style: 'cancel' },
      { text: 'Finish journey', style: 'destructive', onPress: () => void finishSession(connection, summary) },
    ]);
  };

  const syncNow = () => withBusy(async () => {
    if (!connection || !summary) return;
    setSyncStage('syncing');
    try {
      if (summary.status === 'finishing') {
        const completed = await completeRecording(connection, summary.id);
        markSessionCompleted(summary.id, completed.driveId ?? null); enrichCompletedJourney(connection, summary.id); setSummary(null); setSyncStage('synced'); setNotice('Journey finished and saved to JourneyDeck. Music details may continue syncing in the background.'); return;
      }
      await flushRecording(connection, summary.id); setSyncStage('synced'); setNotice('GPS points are synced. Music details continue syncing independently.');
    } catch (error) {
      setSyncStage('retry');
      throw error;
    }
  }, 'Syncing to JourneyDeck…');

  const metrics = useMemo(() => [
    ['TIME', durationLabel(summary?.startedAt)], ['POINTS', String(summary?.pointCount ?? 0)], ['GPS QUEUED', String(summary?.queuedCount ?? 0)], ['MUSIC QUEUED', String(summary?.musicQueuedCount ?? 0)],
  ], [summary]);
  const automaticMode = recordingPreferences.onboardingCompleted && recordingPreferences.mode === 'automatic';

  return (
    <View style={styles.safeArea}>
      <ExpoStatusBar style="light" /><StatusBar barStyle="light-content" />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[styles.content, { paddingTop: insets.top + 14, paddingBottom: insets.bottom + 132 }]}
          contentInsetAdjustmentBehavior="never"
          automaticallyAdjustContentInsets={false}
          automaticallyAdjustsScrollIndicatorInsets={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.brandRow}><View style={styles.logo}><Text style={styles.logoText}>J</Text></View><View><Text style={styles.eyebrow}>JOURNEYDECK</Text><Text style={styles.title}>Recorder</Text></View></View>

          {!connection ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Connect this iPhone</Text>
              <Text style={styles.body}>Enter the private recorder key from your JourneyDeck server. It will be stored in iOS Keychain.</Text>
              <Text style={styles.label}>JOURNEYDECK ADDRESS</Text>
              <TextInput value={serverUrl} onChangeText={setServerUrl} autoCapitalize="none" autoCorrect={false} keyboardType="url" style={styles.input} />
              <Text style={styles.label}>RECORDER KEY</Text>
              <TextInput value={token} onChangeText={setToken} autoCapitalize="none" autoCorrect={false} secureTextEntry placeholder="Paste your private key" placeholderTextColor="#655f74" style={styles.input} />
              <PrimaryButton label="Connect securely" onPress={connect} disabled={busy} />
            </View>
          ) : !permissionsReady ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Allow background location</Text>
              <Text style={styles.body}>JourneyDeck needs “Always Allow” so it can keep recording while your phone is locked or another app is open.</Text>
              <Check ready={foregroundPermission} label="Location while using the app" />
              <Check ready={backgroundPermission} label="Location in the background" />
              <Check ready={taskAvailable} label="Native recorder build" />
              <PrimaryButton label="Enable location" onPress={enablePermissions} disabled={busy} />
            </View>
          ) : (
            <>
              <View style={[styles.statusCard, { borderColor: accent }]}><View style={[styles.statusDot, { backgroundColor: accent }]} /><Text style={[styles.statusText, { color: accent }]}>{!summary && automaticMode ? (automaticDetectionActive ? 'Watching for a drive' : 'Automatic detection paused') : statusLabel(summary?.status, trackingActive)}</Text><Text style={styles.statusHint}>{summary?.status === 'recording' ? (trackingActive ? 'You can lock your phone' : 'Checking iOS background tracking') : summary?.status === 'paused' ? 'GPS capture is stopped' : summary?.status === 'finishing' ? 'Points are safe on this phone' : automaticMode ? (automaticDetectionActive ? 'JourneyDeck will start when driving is detected' : 'Check Always Allow location access') : 'Start when you begin driving'}</Text></View>
              <View style={styles.metrics}>{metrics.map(([label, value]) => <View style={styles.metric} key={label}><Text style={styles.metricLabel}>{label}</Text><Text style={styles.metricValue}>{value}</Text></View>)}</View>
              {!active && !automaticMode && <PrimaryButton label="Start recording" onPress={start} disabled={busy} />}
              {summary?.status === 'recording' && <View style={styles.actionRow}><SecondaryButton label="Pause" onPress={pause} disabled={busy} /><PrimaryButton label="Finish" onPress={finish} disabled={busy} /></View>}
              {summary?.status === 'paused' && <View style={styles.actionRow}><SecondaryButton label="Resume" onPress={resume} disabled={busy} /><PrimaryButton label="Finish" onPress={finish} disabled={busy} /></View>}
              {((summary?.queuedCount ?? 0) > 0 || (summary?.musicQueuedCount ?? 0) > 0) && <SecondaryButton label={summary?.status === 'finishing' ? 'Finish & sync again' : 'Sync saved data'} onPress={syncNow} disabled={busy} />}
              {summary?.status === 'finishing' && (summary?.queuedCount ?? 0) === 0 && (summary?.musicQueuedCount ?? 0) === 0 && <PrimaryButton label="Finish & save" onPress={syncNow} disabled={busy} />}
            </>
          )}
          {syncStage !== 'idle' ? <SyncStatus stage={syncStage} /> : busy ? <View style={styles.progressRow}><ActivityIndicator color="#9b7cff" /><Text style={styles.progressText}>{busyLabel}</Text></View> : null}
          {!!notice && <Text style={styles.notice}>{notice}</Text>}
          <View style={styles.warning}><Text style={styles.warningTitle}>{automaticMode ? 'AUTOMATIC DETECTION' : 'KEEP THE RECORDER RUNNING'}</Text><Text style={styles.warningText}>{automaticMode ? 'JourneyDeck looks for sustained driving speed and waits five parked minutes before finishing. Force-quitting the app stops automatic detection until you reopen it.' : 'Locking your iPhone is fine. Force-quitting the app from the app switcher stops iOS background location until you reopen it.'}</Text></View>
          <Text style={styles.footer}>Private single-iPhone recorder • {connection ? 'Connected' : 'Not connected'}</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

export default function App() {
  return <JourneyDeckShell recorder={<RecorderScreen />} />;
}

type ButtonProps = { label: string; onPress: () => void; disabled?: boolean };
function PrimaryButton({ label, onPress, disabled }: ButtonProps) { return <Pressable onPress={onPress} disabled={disabled} style={({ pressed }) => [styles.primaryButton, (disabled || pressed) && styles.buttonMuted]}><Text style={styles.primaryButtonText}>{label}</Text></Pressable>; }
function SecondaryButton({ label, onPress, disabled }: ButtonProps) { return <Pressable onPress={onPress} disabled={disabled} style={({ pressed }) => [styles.secondaryButton, (disabled || pressed) && styles.buttonMuted]}><Text style={styles.secondaryButtonText}>{label}</Text></Pressable>; }
function Check({ ready, label }: { ready: boolean; label: string }) { return <View style={styles.checkRow}><Text style={styles.check}>{ready ? '✓' : '○'}</Text><Text style={styles.checkText}>{label}</Text></View>; }
function SyncStatus({ stage }: { stage: Exclude<SyncStage, 'idle'> }) {
  const presentation = syncPresentation(stage);
  return <View style={[styles.syncCard, { borderColor: presentation.color }]} accessible accessibilityLabel={`${presentation.title}. ${presentation.detail}`}>
    {presentation.spinning ? <ActivityIndicator color={presentation.color} /> : <View style={[styles.syncDot, { backgroundColor: presentation.color }]} />}
    <View style={styles.syncCopy}><Text style={[styles.syncTitle, { color: presentation.color }]}>{presentation.title}</Text><Text style={styles.syncDetail}>{presentation.detail}</Text></View>
  </View>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 }, safeArea: { flex: 1, backgroundColor: '#08070d' }, content: { padding: 22, paddingTop: 34, paddingBottom: 48, gap: 18 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 13, marginBottom: 8 }, logo: { width: 48, height: 48, borderRadius: 16, backgroundColor: '#ff7b54', alignItems: 'center', justifyContent: 'center', shadowColor: '#ff7b54', shadowOpacity: 0.35, shadowRadius: 18 }, logoText: { color: '#fff', fontSize: 25, fontWeight: '900' },
  eyebrow: { color: '#8d869c', fontSize: 11, fontWeight: '800', letterSpacing: 2.2 }, title: { color: '#f8f5ff', fontSize: 28, fontWeight: '800', letterSpacing: -0.7 },
  card: { backgroundColor: '#14111d', borderWidth: 1, borderColor: '#292338', borderRadius: 24, padding: 20, gap: 13 }, cardTitle: { color: '#fff', fontSize: 22, fontWeight: '800' }, body: { color: '#aca5b9', fontSize: 15, lineHeight: 22, marginBottom: 5 }, label: { color: '#888096', fontSize: 10, fontWeight: '800', letterSpacing: 1.4, marginTop: 5 }, input: { backgroundColor: '#0c0a11', borderWidth: 1, borderColor: '#332c42', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 14, color: '#fff', fontSize: 15 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 10 }, check: { color: '#43e6ae', fontSize: 21, fontWeight: '800', width: 24 }, checkText: { color: '#d4cede', fontSize: 15 },
  statusCard: { alignItems: 'center', backgroundColor: '#121019', borderWidth: 1, borderRadius: 26, paddingVertical: 30, paddingHorizontal: 20 }, statusDot: { width: 12, height: 12, borderRadius: 6, marginBottom: 12 }, statusText: { fontSize: 27, fontWeight: '800' }, statusHint: { color: '#8f879b', fontSize: 14, marginTop: 6 },
  metrics: { flexDirection: 'row', backgroundColor: '#121019', borderRadius: 20, overflow: 'hidden' }, metric: { flex: 1, alignItems: 'center', paddingVertical: 18, borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: '#302a3a' }, metricLabel: { color: '#766f83', fontSize: 9, fontWeight: '800', letterSpacing: 1.2 }, metricValue: { color: '#f4f0fb', fontSize: 18, fontVariant: ['tabular-nums'], fontWeight: '700', marginTop: 7 },
  primaryButton: { minHeight: 58, borderRadius: 17, backgroundColor: '#ff7b54', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 22, flex: 1 }, primaryButtonText: { color: '#160a06', fontSize: 16, fontWeight: '800' }, secondaryButton: { minHeight: 58, borderRadius: 17, backgroundColor: '#1c1726', borderWidth: 1, borderColor: '#3c324c', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 22, flex: 1 }, secondaryButtonText: { color: '#e8e1f1', fontSize: 16, fontWeight: '700' }, buttonMuted: { opacity: 0.55 }, actionRow: { flexDirection: 'row', gap: 12 },
  progressRow: { alignItems: 'center', flexDirection: 'row', gap: 10, justifyContent: 'center', minHeight: 28 }, progressText: { color: '#b9afc7', fontSize: 14 },
  syncCard: { alignItems: 'center', backgroundColor: '#121019', borderWidth: 1, borderRadius: 16, flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingVertical: 14 }, syncDot: { width: 10, height: 10, borderRadius: 5 }, syncCopy: { flex: 1 }, syncTitle: { fontSize: 14, fontWeight: '800' }, syncDetail: { color: '#938b9f', fontSize: 12, lineHeight: 17, marginTop: 3 },
  notice: { color: '#b9afc7', textAlign: 'center', lineHeight: 20 }, warning: { backgroundColor: '#17121b', borderLeftColor: '#9b7cff', borderLeftWidth: 3, borderRadius: 12, padding: 15 }, warningTitle: { color: '#c2b3ff', fontSize: 10, fontWeight: '900', letterSpacing: 1.1 }, warningText: { color: '#9c94a8', fontSize: 13, lineHeight: 19, marginTop: 5 }, footer: { color: '#5e5868', fontSize: 11, textAlign: 'center', marginTop: 4 },
});
