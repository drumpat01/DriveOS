import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, AppState, KeyboardAvoidingView, Linking, Platform, Pressable,
  ScrollView, StatusBar, StyleSheet, Text, TextInput, View,
} from 'react-native';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, RadialGradient as SvgRadialGradient, Rect, Stop } from 'react-native-svg';
import { ObserveRoot } from 'expo-observe';

import './src/location-task';
import { NeonWidget, QuietInset } from './src/neon-widget-outline';
import { HeaderArtwork } from './src/header-artwork';
import { loadConnection, loadOrCreateDeviceId, saveConnection, type Connection } from './src/credentials';
import { flushAllQueuedMusicBestEffort, flushRecording, pingRecorder } from './src/api';
import {
  activeSession, beginLocalSession, completeSessionLocally, getSessionSummary, initializeDatabase,
  getLiveRecorderSnapshot, recordLocations, setLocalStatus, type LocalSessionStatus, type QueuedPoint, type SessionSummary,
} from './src/storage';
import { decideRecovery } from './src/recovery';
import { syncPresentation, type SyncStage } from './src/sync-status';
import {
  isAutomaticDetectionActive, isLocationTrackingActive, startAutomaticDetection,
  startLocationTracking, stopAutomaticDetection, stopLocationTracking,
} from './src/tracking';
import { JourneyDeckShell } from './src/shell';
import { appDataClient } from './src/app-data';
import { recognizeAndQueueActiveSessionMusic, sampleAppleMusicForActiveSession } from './src/music-capture';
import { authorizeShazamMicrophone } from './modules/journeydeck-music';
import { queueLastFmForCompletedSession, syncPendingLastFmBestEffort } from './src/lastfm-sync';
import { loadAutomaticDriveEvent, loadAutomaticDriveState, resetAutomaticDriveState } from './src/automatic-drive-state';
import { subscribeJourneyDeckRequestPolicy } from './src/network-activity';
import {
  loadRecordingModePreferences, subscribeRecordingMode, type RecordingModePreferences,
} from './src/recording-mode';
import {
  configureNativeAutomaticRecorder, finishNativeAutomaticJourney, getNativeAutomaticRecorderStatus,
  isNativeAutomaticSession, pauseNativeAutomaticJourney, resumeNativeAutomaticJourney,
} from './modules/journeydeck-recorder';
import { getCurrentUser } from './src/auth';
import { processPendingCompletionJobs } from './src/completion-jobs';
import { syncNativeRecorderInbox } from './src/native-recorder-inbox';
import { NATIVE_AUTOMATIC_RECORDER_ENABLED, TESSIE_INTEGRATION_ENABLED } from './src/release-features';
import { configureJourneyDeckObservability, observeJourneyDeckEvent, observeJourneyDeckEventOnce } from './src/observability';
import { tessieAutomaticRecordingEligible } from './src/tessie-direct';

configureJourneyDeckObservability();

const DEFAULT_SERVER_URL = 'https://journeydeck.me';
const messageOf = (error: unknown) => error instanceof Error ? error.message : 'Something unexpected happened.';

function enrichCompletedJourney(connection: Connection | null, sessionId: string) {
  void processPendingCompletionJobs({ connection, sessionId }).then(() => {
    if (connection) void flushAllQueuedMusicBestEffort(connection);
  }).catch(() => {});
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

function routeDistanceMiles(points: QueuedPoint[]) {
  const toRadians = (degrees: number) => degrees * Math.PI / 180;
  const meters = points.slice(1).reduce((total, point, index) => {
    const previous = points[index]!;
    const latitudeDelta = toRadians(point.latitude - previous.latitude);
    const longitudeDelta = toRadians(point.longitude - previous.longitude);
    const chord = Math.sin(latitudeDelta / 2) ** 2
      + Math.cos(toRadians(previous.latitude)) * Math.cos(toRadians(point.latitude)) * Math.sin(longitudeDelta / 2) ** 2;
    return total + 12_742_000 * Math.asin(Math.sqrt(chord));
  }, 0);
  return meters / 1609.344;
}

function RecorderScreen({ onClose, presentation = 'screen', showManualSongButton = false, onJourneyChange, onActivityChange }: {
  onClose: () => void;
  presentation?: 'screen' | 'home';
  showManualSongButton?: boolean;
  onJourneyChange?: () => void;
  onActivityChange?: (active: boolean) => void;
}) {
  const insets = useSafeAreaInsets();
  const [connection, setConnection] = useState<Connection | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [serverUrl, setServerUrl] = useState(DEFAULT_SERVER_URL);
  const [token, setToken] = useState('');
  const [summary, setSummary] = useState<SessionSummary | null>(null);
  const [distanceMiles, setDistanceMiles] = useState(0);
  const [foregroundPermission, setForegroundPermission] = useState(false);
  const [backgroundPermission, setBackgroundPermission] = useState(false);
  const [taskAvailable, setTaskAvailable] = useState(false);
  const [trackingActive, setTrackingActive] = useState(false);
  const [automaticDetectionActive, setAutomaticDetectionActive] = useState(false);
  const [recorderInitialized, setRecorderInitialized] = useState(false);
  const [recordingPreferences, setRecordingPreferences] = useState<RecordingModePreferences>(() => loadRecordingModePreferences());
  const operation = useRef<Promise<void>>(Promise.resolve());
  const refreshPending = useRef<Promise<void> | null>(null);
  const busyRef = useRef(false);
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
    const locationPermissionsReady = foreground.status === 'granted' && background.status === 'granted';
    let taskRunning = false;
    if (available) {
      try { taskRunning = await isLocationTrackingActive(); } catch { taskRunning = false; }
    }
    let expoAutomaticDetectorRunning = false;
    if (available) {
      try { expoAutomaticDetectorRunning = await isAutomaticDetectionActive(); } catch { expoAutomaticDetectorRunning = false; }
    }
    const nativeRecorder = await getNativeAutomaticRecorderStatus().catch(() => null);
    await syncNativeRecorderInbox().catch(() => undefined);
    const automaticTaskRunning = NATIVE_AUTOMATIC_RECORDER_ENABLED
      ? Boolean(nativeRecorder?.significantMonitoring || nativeRecorder?.preciseTracking)
      : expoAutomaticDetectorRunning || Boolean(nativeRecorder?.recording);
    const current = activeSession();
    const currentIsNative = isNativeAutomaticSession(current?.id);
    const recordingTransportRunning = currentIsNative ? Boolean(nativeRecorder?.recording) : taskRunning;
    const action = decideRecovery(current?.status ?? null, recordingTransportRunning, locationPermissionsReady && (currentIsNative || available));
    if (action === 'stop-orphaned-task' || action === 'stop-paused-task' || action === 'stop-and-finish') {
      if (!currentIsNative && taskRunning) await stopLocationTracking();
      taskRunning = false;
    }
    if (action === 'restart-recording' && current) {
      observeJourneyDeckEvent('database.recovery_started', { action: 'restart_recording' });
      try {
        if (currentIsNative) {
          const resumed = await resumeNativeAutomaticJourney();
          if (!resumed.recording) throw new Error('iOS did not confirm native background recording.');
        } else {
          if (!(await startLocationTracking())) throw new Error('iOS did not confirm background location tracking.');
          await captureCurrentPoint(true);
          taskRunning = true;
        }
        void sampleAppleMusicForActiveSession({ force: true });
        setNotice('Recording resumed. A brief route gap may remain; existing points are safe.');
      } catch {
        if (currentIsNative) await pauseNativeAutomaticJourney().catch(() => undefined);
        else setLocalStatus(current.id, 'paused');
        taskRunning = false;
        setNotice('Recording paused because background tracking is unavailable. Existing points are safe; the interruption may have left a route gap.');
      }
    }
    if (action === 'pause-interrupted-recording' && current) {
      observeJourneyDeckEvent('database.recovery_started', { action: 'pause_interrupted' });
      if (currentIsNative) {
        await pauseNativeAutomaticJourney().catch(() => undefined);
      } else if (taskRunning) {
        try { await stopLocationTracking(); } catch {}
        taskRunning = false;
        setLocalStatus(current.id, 'paused');
      }
      setNotice('Recording paused because required location access or background tracking is unavailable. Existing points are safe; the interruption may have left a route gap.');
    }
    if (action === 'stop-and-finish' && current) {
      observeJourneyDeckEvent('database.recovery_started', { action: 'finish_interrupted' });
      if (currentIsNative) {
        await finishNativeAutomaticJourney();
        await syncNativeRecorderInbox();
      }
      else completeSessionLocally(current.id, Boolean(connection));
      enrichCompletedJourney(connection, current.id);
      setSyncStage('saved');
      setNotice('Journey finished in your on-device archive. Optional backup continues in the background.');
    }
    const reconciled = activeSession();
    const liveSnapshot = getLiveRecorderSnapshot();
    setSummary(reconciled ? getSessionSummary(reconciled.id) : null);
    setDistanceMiles(liveSnapshot.session ? routeDistanceMiles(liveSnapshot.route) : 0);
    setForegroundPermission(foreground.status === 'granted');
    setBackgroundPermission(background.status === 'granted');
    setTaskAvailable(available);
    setTrackingActive(currentIsNative ? Boolean(nativeRecorder?.recording) : taskRunning);
    setAutomaticDetectionActive(automaticTaskRunning);
    const automaticEvent = NATIVE_AUTOMATIC_RECORDER_ENABLED && nativeRecorder?.lastEvent && nativeRecorder.lastEventAt
      ? { kind: nativeRecorder.lastEvent, occurredAt: nativeRecorder.lastEventAt }
      : loadAutomaticDriveEvent();
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

  const reconcileAutomaticRecorder = useCallback(async () => {
    if (!deviceId) return false;
    const tessieEligible = TESSIE_INTEGRATION_ENABLED && recordingPreferences.onboardingCompleted && recordingPreferences.mode === 'automatic'
      ? await tessieAutomaticRecordingEligible()
      : false;
    const current = activeSession();
    const automaticState = loadAutomaticDriveState();
    const finishingExistingAutomaticJourney = Boolean(current && automaticState.automaticSessionId === current.id);
    const shouldRun = Boolean(foregroundPermission && backgroundPermission && (tessieEligible || finishingExistingAutomaticJourney));
    if (NATIVE_AUTOMATIC_RECORDER_ENABLED) {
      await stopAutomaticDetection().catch(() => undefined);
      const status = await configureNativeAutomaticRecorder(shouldRun, getCurrentUser().id, deviceId);
      await syncNativeRecorderInbox();
      return Boolean(status.significantMonitoring || status.preciseTracking);
    }

    // Build 13 fallback: keep the proven Expo automatic detector as the public
    // owner while the corrected native confirmation burst is physically
    // validated. If a native journey was already recording, let it finish
    // rather than starting a duplicate.
    const nativeStatus = await configureNativeAutomaticRecorder(false, getCurrentUser().id, deviceId);
    let active = false;
    if (nativeStatus.recording || nativeStatus.paused) {
      await stopAutomaticDetection().catch(() => undefined);
      active = true;
    } else if (shouldRun) {
      active = await startAutomaticDetection();
      if (active) observeJourneyDeckEventOnce('recorder.armed', 'expo', { engine: 'expo' });
    } else {
      await stopAutomaticDetection().catch(() => undefined);
    }
    await syncNativeRecorderInbox();
    if (!shouldRun) resetAutomaticDriveState();
    return active;
  }, [backgroundPermission, deviceId, foregroundPermission, recordingPreferences]);

  useEffect(() => {
    let cancelled = false;
    void reconcileAutomaticRecorder()
      .then(active => { if (!cancelled) setAutomaticDetectionActive(active); })
      .catch(() => { if (!cancelled) setAutomaticDetectionActive(false); });
    return () => { cancelled = true; };
  }, [reconcileAutomaticRecorder]);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([loadOrCreateDeviceId(), loadConnection()]).then(([localDeviceId, saved]) => {
      if (cancelled) return;
      setDeviceId(localDeviceId);
      if (saved) { setConnection(saved); setServerUrl(saved.serverUrl); }
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let mounted = true;
    void refresh().catch(() => {}).finally(() => { if (mounted) setRecorderInitialized(true); });
    void processPendingCompletionJobs({ connection, limit: 12 }).catch(() => {});
    void sampleAppleMusicForActiveSession({ force: true });
    void syncPendingLastFmBestEffort();
    let ticks = 0;
    const timer = setInterval(() => {
      setClock(value => value + 1);
      ticks += 1;
      if (ticks % 5 === 0 && !busyRef.current) void refresh().catch(() => {});
      if (ticks % 30 === 0) void processPendingCompletionJobs({ connection, limit: 12 }).catch(() => {});
      if (ticks % 60 === 0) void syncPendingLastFmBestEffort();
    }, 1000);
    const subscription = AppState.addEventListener('change', state => {
      if (state !== 'active' || busyRef.current) return;
      void reconcileAutomaticRecorder()
        .then(setAutomaticDetectionActive)
        .catch(() => setAutomaticDetectionActive(false));
      void refresh().catch(() => {});
      void sampleAppleMusicForActiveSession({ force: true });
      void processPendingCompletionJobs({ connection, limit: 12 }).catch(() => {});
      void syncPendingLastFmBestEffort();
    });
    return () => { mounted = false; clearInterval(timer); subscription.remove(); };
  }, [connection, reconcileAutomaticRecorder, refresh]);

  useEffect(() => {
    if (!connection) return;
    return subscribeJourneyDeckRequestPolicy(blocked => {
      if (!blocked) {
        void processPendingCompletionJobs({ connection, limit: 12 }).catch(() => {});
      }
    });
  }, [connection]);

  const active = Boolean(summary && summary.status !== 'completed');
  const permissionsReady = foregroundPermission && backgroundPermission && taskAvailable;
  const accent = summary?.status === 'recording' && trackingActive ? '#43e6ae' : summary?.status === 'paused' ? '#ffb45c' : '#9b7cff';

  useEffect(() => {
    onActivityChange?.(active);
    return () => onActivityChange?.(false);
  }, [active, onActivityChange]);

  const withBusy = useCallback(async (work: () => Promise<void>, label = 'Working…') => {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true); setBusyLabel(label); setSyncStage('idle'); setNotice('');
    try { await runExclusive(work); }
    catch (error) { const message = messageOf(error); setNotice(message); Alert.alert('JourneyDeck Recorder', message); }
    finally { await refresh().catch(() => {}); busyRef.current = false; setBusy(false); onJourneyChange?.(); }
  }, [onJourneyChange, refresh, runExclusive]);

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
    if (foreground.status !== 'granted') {
      if (!foreground.canAskAgain) {
        Alert.alert('Location is disabled', 'Open iPhone Settings and allow JourneyDeck to use location.', [
          { text: 'Not now', style: 'cancel' },
          { text: 'Open Settings', onPress: () => void Linking.openSettings() },
        ]);
        return;
      }
      throw new Error('Location access is required to record a journey.');
    }
    const background = await Location.requestBackgroundPermissionsAsync();
    if (background.status !== 'granted') {
      if (!background.canAskAgain) {
        Alert.alert('Always Allow is needed', 'Open iPhone Settings, choose Location, then select Always so journeys can continue with the screen locked.', [
          { text: 'Not now', style: 'cancel' },
          { text: 'Open Settings', onPress: () => void Linking.openSettings() },
        ]);
        return;
      }
      throw new Error('Choose “Always Allow” so recording continues with the screen locked.');
    }
    if (!(await TaskManager.isAvailableAsync())) throw new Error('Background recording requires the installed JourneyDeck build, not Expo Go.');
    setNotice('Background location is ready.');
  }, 'Checking location access…');

  const start = () => withBusy(async () => {
    if (!deviceId) throw new Error('The local recorder is still getting ready.');
    if (!permissionsReady) throw new Error('Enable background location first.');
    const session = beginLocalSession(deviceId);
    try { if (!(await startLocationTracking())) throw new Error('iOS did not confirm background location tracking.'); await captureCurrentPoint(true); }
    catch (error) { setLocalStatus(session.id, 'paused'); throw error; }
    void sampleAppleMusicForActiveSession({ force: true });
    setNotice('Recording started and is being saved on this iPhone.');
  }, 'Starting background recording…');

  const pause = () => withBusy(async () => {
    if (!summary) return;
    if (isNativeAutomaticSession(summary.id)) {
      const status = await pauseNativeAutomaticJourney();
      if (!status.paused) throw new Error('The native journey could not be paused safely.');
    } else {
      await captureCurrentPoint(); await stopLocationTracking(); setLocalStatus(summary.id, 'paused');
    }
    setNotice('Recording paused. Every captured point remains on this phone.');
  }, 'Pausing recording…');

  const resume = () => withBusy(async () => {
    if (!summary) return;
    if (isNativeAutomaticSession(summary.id)) {
      const status = await resumeNativeAutomaticJourney();
      if (!status.recording) throw new Error('iOS did not confirm native background recording.');
    } else {
      setLocalStatus(summary.id, 'recording');
      try { if (!(await startLocationTracking())) throw new Error('iOS did not confirm background location tracking.'); await captureCurrentPoint(true); }
      catch (error) { setLocalStatus(summary.id, 'paused'); throw error; }
    }
    void sampleAppleMusicForActiveSession({ force: true });
    setNotice('Recording resumed on this iPhone.');
  }, 'Resuming recording…');

  const identifySong = () => withBusy(async () => {
    const permission = await authorizeShazamMicrophone();
    if (permission !== 'authorized') throw new Error('Allow microphone access to identify a song. JourneyDeck never records or saves the audio.');
    const result = await recognizeAndQueueActiveSessionMusic(10_000, { allowAdHoc: true });
    if (result.status === 'queued' && result.observation) {
      setNotice(`Saved “${result.observation.track}” by ${result.observation.artist} at this point in your journey.`);
      return;
    }
    if (result.status === 'duplicate' && result.observation) {
      setNotice(`“${result.observation.track}” is already saved for this journey.`);
      return;
    }
    if (result.status === 'no_match') {
      setNotice('No song matched this time. Tap Identify Song again while the music is playing clearly.');
      return;
    }
    setNotice('JourneyDeck is already listening. Wait a moment, then try again.');
  }, 'Listening for this song…');

  const finishSession = useCallback(async (currentSummary: SessionSummary) => {
    busyRef.current = true; setBusy(true); setSyncStage('saving'); setNotice('');
    try {
      await runExclusive(async () => {
        if (isNativeAutomaticSession(currentSummary.id)) {
          const status = await finishNativeAutomaticJourney();
          if (status.sessionId === currentSummary.id && status.recording) throw new Error('The native journey is still recording.');
          await syncNativeRecorderInbox();
        } else {
          await captureCurrentPoint();
          await stopLocationTracking();
          setLocalStatus(currentSummary.id, 'finishing');
          completeSessionLocally(currentSummary.id, Boolean(connection));
        }
        resetAutomaticDriveState();
        setTrackingActive(false);
        enrichCompletedJourney(connection, currentSummary.id);
        setSummary(null);
        setSyncStage('saved');
        setNotice('Journey finished in your on-device archive. Optional backup continues in the background.');
      });
    } catch (error) {
      const message = messageOf(error);
      setSyncStage('idle');
      setNotice(message);
      Alert.alert('JourneyDeck Recorder', message);
    } finally {
      busyRef.current = false;
      setBusy(false);
      void refresh().catch(() => {});
      onJourneyChange?.();
    }
  }, [connection, onJourneyChange, refresh, runExclusive]);

  const finish = () => {
    if (!summary) return;
    Alert.alert('Finish this journey?', 'Recording will stop and the journey will appear immediately in your on-device archive.', [
      { text: 'Keep recording', style: 'cancel' },
      { text: 'Finish journey', style: 'destructive', onPress: () => void finishSession(summary) },
    ]);
  };

  const syncNow = () => withBusy(async () => {
    if (!connection || !summary) return;
    setSyncStage('syncing');
    try {
      if (summary.status === 'finishing') {
        completeSessionLocally(summary.id); enrichCompletedJourney(connection, summary.id); setSummary(null); setSyncStage('saved'); setNotice('Journey finished in your on-device archive. Optional backup continues in the background.');
        return;
      }
      await flushRecording(connection, summary.id); setSyncStage('synced'); setNotice('GPS points are synced. Music details continue syncing independently.');
    } catch (error) {
      setSyncStage('retry');
      throw error;
    }
  }, 'Syncing to JourneyDeck…');

  const metrics = useMemo(() => [
    ['TIME', durationLabel(summary?.startedAt)], ['POINTS', String(summary?.pointCount ?? 0)], [connection ? 'GPS QUEUED' : 'GPS SAVED', String(summary?.queuedCount ?? 0)], [connection ? 'MUSIC QUEUED' : 'MUSIC SAVED', String(summary?.musicQueuedCount ?? 0)],
  ], [connection, summary]);
  const automaticMode = TESSIE_INTEGRATION_ENABLED && recordingPreferences.onboardingCompleted && recordingPreferences.mode === 'automatic';

  if (presentation === 'home') {
    const recording = summary?.status === 'recording';
    const paused = summary?.status === 'paused';
    const startupPending = !deviceId || !recorderInitialized;
    const showStartPortal = !active && !automaticMode && (startupPending || permissionsReady);
    return (
      <View style={styles.homeRecorderStack}>
        {showStartPortal ? (
          <HomeRecorderStartPortal onPress={start} disabled={busy || startupPending} showProgress={busy} />
        ) : (
          <View style={styles.homeRecorderCard}>
            <View style={styles.homeRecorderStatusRow}>
              <View style={styles.homeRecorderPulseOuter}><View style={[styles.homeRecorderPulseMiddle, paused && styles.homeRecorderPulsePaused]}><View style={[styles.homeRecorderPulseCore, paused && styles.homeRecorderPulseCorePaused]} /></View></View>
              <View style={styles.homeRecorderStatusCopy}>
                <Text style={[styles.homeRecorderEyebrow, paused && styles.homeRecorderEyebrowPaused]}>{active ? paused ? 'PAUSED' : 'RECORDING' : automaticMode ? 'TESLA AUTOMATION' : 'READY'}</Text>
                <Text style={styles.homeRecorderBody}>{active ? paused ? 'Your journey is paused.' : 'Your journey is being remembered.' : automaticMode ? 'Waiting for Tessie to confirm your drive.' : 'Ready to remember your next drive.'}</Text>
              </View>
              {busy && <ActivityIndicator color="#ff795b" size="small" />}
            </View>

            {active && <View style={styles.homeRecorderMetrics}>
              <View style={styles.homeRecorderMetric}><SymbolView name="clock" tintColor="#a49baa" size={22} /><Text style={styles.homeRecorderMetricValue}>{durationLabel(summary?.startedAt)}</Text></View>
              <View style={styles.homeRecorderMetricDivider} />
              <View style={styles.homeRecorderMetric}><SymbolView name="road.lanes" tintColor="#a49baa" size={22} /><Text style={styles.homeRecorderMetricValue}>{distanceMiles.toFixed(1)} <Text style={styles.homeRecorderMetricUnit}>MI</Text></Text></View>
              <View style={styles.homeRecorderMetricDivider} />
              <View style={styles.homeRecorderMetric}><SymbolView name="location.fill" tintColor="#a49baa" size={22} /><Text style={styles.homeRecorderMetricLabel}>GPS SAVED</Text><Text style={styles.homeRecorderMetricValue}>{summary?.pointCount ?? 0}</Text></View>
            </View>}
          </View>
        )}

        {startupPending ? null
          : !permissionsReady ? <HomeRecorderPrimaryAction label="Enable Location" symbol="location.fill" onPress={enablePermissions} disabled={busy} />
          : !active && !automaticMode ? null
          : recording ? <>
            {showManualSongButton && <Pressable disabled={busy} onPress={identifySong} style={({ pressed }) => [styles.homeRecorderIdentify, pressed && styles.homeRecorderPressed]}>
              <LinearGradient colors={['rgba(88,43,148,0.96)', 'rgba(20,13,30,0.96)']} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={styles.homeRecorderIdentifyIcon}><SymbolView name="music.note" tintColor="#d595ff" size={27} /></LinearGradient>
              <View style={styles.homeRecorderIdentifyCopy}><Text style={styles.homeRecorderIdentifyTitle}>Identify Song</Text><Text style={styles.homeRecorderIdentifyBody}>Tap once for each song you want to remember.</Text></View>
              <Text style={styles.homeRecorderChevron}>›</Text>
            </Pressable>}
            <HomeRecorderPrimaryAction label="End Journey" symbol="waveform" onPress={finish} disabled={busy} />
          </>
          : paused ? <>
            <Pressable disabled={busy} onPress={resume} style={({ pressed }) => [styles.homeRecorderIdentify, pressed && styles.homeRecorderPressed]}><View style={styles.homeRecorderIdentifyIcon}><SymbolView name="play.fill" tintColor="#d595ff" size={24} /></View><View style={styles.homeRecorderIdentifyCopy}><Text style={styles.homeRecorderIdentifyTitle}>Resume Journey</Text><Text style={styles.homeRecorderIdentifyBody}>Continue saving your route.</Text></View><Text style={styles.homeRecorderChevron}>›</Text></Pressable>
            <HomeRecorderPrimaryAction label="End Journey" symbol="waveform" onPress={finish} disabled={busy} />
          </> : null}
        {!!notice && <Text style={styles.homeRecorderNotice}>{notice}</Text>}
      </View>
    );
  }

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
          <RecorderAtmosphere />
          <Pressable accessibilityRole="button" accessibilityLabel="Back to Live" onPress={onClose} style={styles.liveBackButton}><Text style={styles.liveBackText}>‹  Live</Text></Pressable>
          <View style={styles.recorderArtHeader}><HeaderArtwork source={require('./assets/recorder-header-hero-v2.jpg')} /></View>

          {!deviceId ? (
            <NeonWidget radius={22} style={styles.card}><ActivityIndicator color="#9b7cff" /><Text style={styles.body}>Preparing the private on-device recorder…</Text></NeonWidget>
          ) : !permissionsReady ? (
            <NeonWidget radius={22} style={styles.card}>
              <Text style={styles.cardTitle}>Allow background location</Text>
              <Text style={styles.body}>JourneyDeck needs “Always Allow” so it can keep recording while your phone is locked or another app is open.</Text>
              <Check ready={foregroundPermission} label="Location while using the app" />
              <Check ready={backgroundPermission} label="Location in the background" />
              <Check ready={taskAvailable} label="Native recorder build" />
              <PrimaryButton label="Enable location" onPress={enablePermissions} disabled={busy} />
            </NeonWidget>
          ) : (
            <>
              <NeonWidget radius={22} tone="hero" style={[styles.statusCard, { borderColor: accent }]}><View style={[styles.statusDot, { backgroundColor: accent }]} /><Text style={[styles.statusText, { color: accent }]}>{!summary && automaticMode ? (automaticDetectionActive ? 'Watching for a drive' : 'Automatic detection paused') : statusLabel(summary?.status, trackingActive)}</Text><Text style={styles.statusHint}>{summary?.status === 'recording' ? (trackingActive ? 'You can lock your phone' : 'Checking iOS background tracking') : summary?.status === 'paused' ? 'GPS capture is stopped' : summary?.status === 'finishing' ? 'Points are safe on this phone' : automaticMode ? (automaticDetectionActive ? 'JourneyDeck will start when driving is detected' : 'Check Always Allow location access') : 'Start when you begin driving'}</Text></NeonWidget>
              <View style={styles.metrics}>{metrics.map(([label, value], index) => <QuietInset radius={16} accent={index === 0 ? '#ff795b' : index === 1 ? '#ff4d87' : index === 2 ? '#a66cff' : '#5aa7ff'} style={styles.metric} key={label}><Text style={styles.metricLabel}>{label}</Text><Text style={styles.metricValue} numberOfLines={1}>{value}</Text></QuietInset>)}</View>
              {!active && !automaticMode && <PrimaryButton label="Start recording" onPress={start} disabled={busy} />}
              {summary?.status === 'recording' && <View style={styles.actionRow}><SecondaryButton label="Pause" onPress={pause} disabled={busy} /><PrimaryButton label="Finish" onPress={finish} disabled={busy} /></View>}
              {summary?.status === 'paused' && <View style={styles.actionRow}><SecondaryButton label="Resume" onPress={resume} disabled={busy} /><PrimaryButton label="Finish" onPress={finish} disabled={busy} /></View>}
              {summary?.status === 'recording' && <NeonWidget radius={22} style={styles.manualRecognitionCard}>
                <Text style={styles.manualRecognitionKicker}>MANUAL SONG RECOGNITION</Text>
                <Text style={styles.manualRecognitionTitle}>Save what is playing now</Text>
                <Text style={styles.manualRecognitionBody}>Tap once for each song you want on this journey. JourneyDeck listens for about 10 seconds, saves the match and timestamp, then turns the microphone off.</Text>
                <View style={styles.manualRecognitionAction}><SecondaryButton label="Identify Song" onPress={identifySong} disabled={busy} /></View>
                <Text style={styles.manualRecognitionSafety}>Only tap while safely stopped, or ask a passenger.</Text>
              </NeonWidget>}
              {connection && ((summary?.queuedCount ?? 0) > 0 || (summary?.musicQueuedCount ?? 0) > 0) && <SecondaryButton label={summary?.status === 'finishing' ? 'Finish & sync again' : 'Back up saved data'} onPress={syncNow} disabled={busy} />}
              {!connection && summary?.status === 'finishing' && <PrimaryButton label="Finish & save" onPress={() => void finishSession(summary)} disabled={busy} />}
            </>
          )}
          {!connection && deviceId ? (
            <NeonWidget radius={22} style={styles.card}>
              <Text style={styles.cardTitle}>Optional owner backup</Text>
              <Text style={styles.body}>Recording works entirely on this iPhone. Existing JourneyDeck owners can connect a legacy server only to migrate or back up old data.</Text>
              <Text style={styles.label}>JOURNEYDECK ADDRESS</Text>
              <TextInput value={serverUrl} onChangeText={setServerUrl} autoCapitalize="none" autoCorrect={false} keyboardType="url" style={styles.input} />
              <Text style={styles.label}>RECORDER KEY</Text>
              <TextInput value={token} onChangeText={setToken} autoCapitalize="none" autoCorrect={false} secureTextEntry placeholder="Paste your private key" placeholderTextColor="#655f74" style={styles.input} />
              <SecondaryButton label="Connect owner backup" onPress={connect} disabled={busy} />
            </NeonWidget>
          ) : null}
          {syncStage !== 'idle' ? <SyncStatus stage={syncStage} /> : busy ? <View style={styles.progressRow}><ActivityIndicator color="#9b7cff" /><Text style={styles.progressText}>{busyLabel}</Text></View> : null}
          {!!notice && <Text style={styles.notice}>{notice}</Text>}
          <View style={styles.warning}><Text style={styles.warningTitle}>{automaticMode ? 'AUTOMATIC DETECTION' : 'KEEP THE RECORDER RUNNING'}</Text><Text style={styles.warningText}>{automaticMode ? 'JourneyDeck looks for sustained driving speed and waits five parked minutes before finishing. Force-quitting the app stops automatic detection until you reopen it.' : 'Locking your iPhone is fine. Force-quitting the app from the app switcher stops iOS background location until you reopen it.'}</Text></View>
          <Text style={styles.footer}>Private on-device recorder • {connection ? 'Owner backup connected' : 'No server required'}</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function RecorderAtmosphere() {
  return <Svg pointerEvents="none" viewBox="0 0 430 1250" preserveAspectRatio="none" style={styles.atmosphere}><Defs><SvgRadialGradient id="recorderTopBloom" cx="50%" cy="3%" rx="68%" ry="34%"><Stop offset="0" stopColor="#8d4fff" stopOpacity="0.25" /><Stop offset="0.5" stopColor="#642eb2" stopOpacity="0.08" /><Stop offset="1" stopColor="#642eb2" stopOpacity="0" /></SvgRadialGradient><SvgRadialGradient id="recorderSideBloom" cx="100%" cy="55%" rx="78%" ry="36%"><Stop offset="0" stopColor="#4ca7ff" stopOpacity="0.17" /><Stop offset="0.55" stopColor="#704cff" stopOpacity="0.05" /><Stop offset="1" stopColor="#704cff" stopOpacity="0" /></SvgRadialGradient><SvgRadialGradient id="recorderLowBloom" cx="0%" cy="88%" rx="82%" ry="30%"><Stop offset="0" stopColor="#ff6540" stopOpacity="0.13" /><Stop offset="1" stopColor="#ff6540" stopOpacity="0" /></SvgRadialGradient></Defs><Rect width="430" height="1250" fill="url(#recorderTopBloom)" /><Rect width="430" height="1250" fill="url(#recorderSideBloom)" /><Rect width="430" height="1250" fill="url(#recorderLowBloom)" /></Svg>;
}

function App() {
  return <JourneyDeckShell recorder={RecorderScreen} />;
}

export default ObserveRoot.wrap(App);

type ButtonProps = { label: string; onPress: () => void; disabled?: boolean };
function PrimaryButton({ label, onPress, disabled }: ButtonProps) { return <Pressable onPress={onPress} disabled={disabled} style={({ pressed }) => [styles.primaryButton, (disabled || pressed) && styles.buttonMuted]}><Text style={styles.primaryButtonText}>{label}</Text></Pressable>; }
function SecondaryButton({ label, onPress, disabled }: ButtonProps) { return <Pressable onPress={onPress} disabled={disabled} style={({ pressed }) => [styles.secondaryButton, (disabled || pressed) && styles.buttonMuted]}><Text style={styles.secondaryButtonText}>{label}</Text></Pressable>; }
function Check({ ready, label }: { ready: boolean; label: string }) { return <View style={styles.checkRow}><Text style={styles.check}>{ready ? '✓' : '○'}</Text><Text style={styles.checkText}>{label}</Text></View>; }
function HomeRecorderStartPortal({ onPress, disabled, showProgress = false }: { onPress: () => void; disabled?: boolean; showProgress?: boolean }) {
  return <Pressable
    testID="home-start-journey-portal"
    accessibilityRole="button"
    accessibilityLabel="Start Journey"
    accessibilityHint="Begins recording your route on this iPhone."
    accessibilityState={{ disabled: Boolean(disabled) }}
    disabled={disabled}
    onPress={onPress}
    style={({ pressed }) => [styles.homeRecorderStartPortal, pressed && styles.homeRecorderStartPortalPressed]}
  >
    <View style={styles.homeRecorderStartPortalCanvas}>
      <HomeRecorderStartPortalAtmosphere />
      <View pointerEvents="none" style={styles.homeRecorderStartPortalOutline} />
      <View pointerEvents="none" style={styles.homeRecorderStartPortalStatus}>
        <View style={styles.homeRecorderStartPortalPulseOuter}>
          <View style={styles.homeRecorderStartPortalPulseMiddle}>
            <View style={styles.homeRecorderStartPortalPulseCore} />
          </View>
        </View>
        <Text style={styles.homeRecorderStartPortalEyebrow}>READY</Text>
        <Text style={styles.homeRecorderStartPortalBody}>Ready to remember your next drive.</Text>
      </View>
      <View pointerEvents="none" style={styles.homeRecorderStartPortalAction}>
        <Text style={styles.homeRecorderStartPortalTitle}>Start Journey</Text>
        {showProgress ? <ActivityIndicator color="#fff6f1" size="small" /> : <SymbolView name="arrow.right" tintColor="#fff6f1" size={31} />}
      </View>
    </View>
  </Pressable>;
}
function HomeRecorderStartPortalAtmosphere() {
  return <Svg pointerEvents="none" viewBox="0 0 360 360" preserveAspectRatio="none" style={styles.homeRecorderStartPortalAtmosphere}>
    <Defs>
      <SvgRadialGradient id="startPortalGlass" cx="50%" cy="45%" rx="49%" ry="45%">
        <Stop offset="0" stopColor="#07050d" stopOpacity="0.68" />
        <Stop offset="0.56" stopColor="#090610" stopOpacity="0.46" />
        <Stop offset="0.78" stopColor="#0b0712" stopOpacity="0.11" />
        <Stop offset="0.88" stopColor="#0b0712" stopOpacity="0" />
        <Stop offset="1" stopColor="#0b0712" stopOpacity="0" />
      </SvgRadialGradient>
      <SvgRadialGradient id="startPortalCoral" cx="50%" cy="54%" rx="82%" ry="78%" fx="50%" fy="70%">
        <Stop offset="0" stopColor="#ff405f" stopOpacity="0.62" />
        <Stop offset="0.35" stopColor="#ff4f66" stopOpacity="0.42" />
        <Stop offset="0.68" stopColor="#ff7654" stopOpacity="0.18" />
        <Stop offset="1" stopColor="#ff7654" stopOpacity="0.10" />
      </SvgRadialGradient>
      <SvgRadialGradient id="startPortalHalo" cx="50%" cy="30%" rx="34%" ry="25%">
        <Stop offset="0" stopColor="#ff795b" stopOpacity="0.12" />
        <Stop offset="0.82" stopColor="#ff795b" stopOpacity="0" />
        <Stop offset="1" stopColor="#ff795b" stopOpacity="0" />
      </SvgRadialGradient>
    </Defs>
    <Rect width="360" height="360" fill="url(#startPortalGlass)" />
    <Rect width="360" height="360" rx="30" ry="30" fill="url(#startPortalCoral)" />
    <Rect width="360" height="360" fill="url(#startPortalHalo)" />
  </Svg>;
}
function HomeRecorderPrimaryAction({ label, symbol, onPress, disabled }: { label: string; symbol: SFSymbol; onPress: () => void; disabled?: boolean }) {
  return <Pressable disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.homeRecorderPrimary, pressed && styles.homeRecorderPressed]}>
    <LinearGradient colors={['#ff7654', '#ff376f']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
    <View style={styles.homeRecorderPrimaryIcon}><SymbolView name={symbol} tintColor="#fff4ee" size={26} /></View>
    <Text style={styles.homeRecorderPrimaryText}>{label}</Text>
    <Text style={styles.homeRecorderPrimaryArrow}>›</Text>
  </Pressable>;
}
function SyncStatus({ stage }: { stage: Exclude<SyncStage, 'idle'> }) {
  const presentation = syncPresentation(stage);
  return <View style={[styles.syncCard, { borderColor: presentation.color }]} accessible accessibilityLabel={`${presentation.title}. ${presentation.detail}`}>
    {presentation.spinning ? <ActivityIndicator color={presentation.color} /> : <View style={[styles.syncDot, { backgroundColor: presentation.color }]} />}
    <View style={styles.syncCopy}><Text style={[styles.syncTitle, { color: presentation.color }]}>{presentation.title}</Text><Text style={styles.syncDetail}>{presentation.detail}</Text></View>
  </View>;
}

const styles = StyleSheet.create({
  atmosphere: { position: 'absolute', top: -45, left: -20, right: -20, height: 1250 },
  flex: { flex: 1 }, safeArea: { flex: 1, backgroundColor: '#08070d' }, content: { padding: 20, paddingTop: 34, paddingBottom: 48, gap: 18 },
  homeRecorderStack: { gap: 12 },
  homeRecorderCard: { overflow: 'hidden', borderRadius: 25, borderWidth: 1, borderColor: 'rgba(190,168,194,0.44)', backgroundColor: 'rgba(9,8,14,0.86)', paddingHorizontal: 18, paddingVertical: 20, shadowColor: '#bc6aff', shadowOpacity: 0.15, shadowRadius: 22, shadowOffset: { width: 0, height: 10 } },
  homeRecorderStatusRow: { minHeight: 94, flexDirection: 'row', alignItems: 'center', gap: 20 },
  homeRecorderStatusCopy: { flex: 1, gap: 7 },
  homeRecorderPulseOuter: { width: 100, height: 100, borderRadius: 50, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(181,255,104,0.18)', backgroundColor: 'rgba(109,167,64,0.05)', shadowColor: '#b4ff68', shadowOpacity: 0.28, shadowRadius: 20 },
  homeRecorderPulseMiddle: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(181,255,104,0.42)', backgroundColor: 'rgba(113,162,69,0.08)' },
  homeRecorderPulsePaused: { borderColor: 'rgba(255,183,92,0.45)' },
  homeRecorderPulseCore: { width: 31, height: 31, borderRadius: 16, backgroundColor: '#b4ff68', shadowColor: '#b4ff68', shadowOpacity: 1, shadowRadius: 15 },
  homeRecorderPulseCorePaused: { backgroundColor: '#ffb45c', shadowColor: '#ffb45c' },
  homeRecorderEyebrow: { color: '#b4ff68', fontSize: 14, fontWeight: '700', letterSpacing: 2.5 },
  homeRecorderEyebrowPaused: { color: '#ffb45c' },
  homeRecorderBody: { color: '#b4aaba', fontSize: 14, lineHeight: 20 },
  homeRecorderMetrics: { flexDirection: 'row', alignItems: 'center', minHeight: 105, marginTop: 18, paddingTop: 18, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(198,178,204,0.24)' },
  homeRecorderMetric: { flex: 1, minHeight: 78, alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 4 },
  homeRecorderMetricDivider: { width: StyleSheet.hairlineWidth, height: 64, backgroundColor: 'rgba(190,175,195,0.19)' },
  homeRecorderMetricValue: { color: '#fffaff', fontSize: 23, fontWeight: '400', fontVariant: ['tabular-nums'], textAlign: 'center' },
  homeRecorderMetricUnit: { fontSize: 11, fontWeight: '800' },
  homeRecorderMetricLabel: { color: '#c291ed', fontSize: 10, fontWeight: '700', letterSpacing: 0.55, textAlign: 'center' },
  homeRecorderPrimary: { minHeight: 78, overflow: 'hidden', borderRadius: 21, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, shadowColor: '#ff455f', shadowOpacity: 0.34, shadowRadius: 15, shadowOffset: { width: 0, height: 8 } },
  homeRecorderPrimaryIcon: { width: 50, height: 50, borderRadius: 25, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,122,84,0.2)' },
  homeRecorderPrimaryText: { flex: 1, color: '#fff8f5', fontSize: 22, fontWeight: '500', marginLeft: 14 },
  homeRecorderPrimaryArrow: { color: '#fff8f5', fontSize: 31, lineHeight: 32 },
  homeRecorderStartPortal: { minHeight: 360 },
  homeRecorderStartPortalPressed: { transform: [{ scale: 0.992 }] },
  homeRecorderStartPortalCanvas: { flex: 1, alignItems: 'center', paddingHorizontal: 20, paddingTop: 32, paddingBottom: 24 },
  homeRecorderStartPortalAtmosphere: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  homeRecorderStartPortalOutline: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, borderRadius: 30, borderWidth: 1, borderColor: 'rgba(255,126,88,0.92)', shadowColor: '#ff704f', shadowOpacity: 0.72, shadowRadius: 9, shadowOffset: { width: 0, height: 0 } },
  homeRecorderStartPortalStatus: { alignItems: 'center' },
  homeRecorderStartPortalPulseOuter: { width: 116, height: 116, borderRadius: 58, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,123,91,0.30)', backgroundColor: 'rgba(255,102,79,0.035)' },
  homeRecorderStartPortalPulseMiddle: { width: 78, height: 78, borderRadius: 39, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,123,91,0.55)', backgroundColor: 'rgba(255,102,79,0.055)' },
  homeRecorderStartPortalPulseCore: { width: 37, height: 37, borderRadius: 19, backgroundColor: '#ff8060', shadowColor: '#ff654f', shadowOpacity: 1, shadowRadius: 19 },
  homeRecorderStartPortalEyebrow: { color: '#ff8b69', fontSize: 14, fontWeight: '800', letterSpacing: 3.2, marginTop: 20 },
  homeRecorderStartPortalBody: { color: '#c4b7c4', fontSize: 14, lineHeight: 20, marginTop: 7, textAlign: 'center' },
  homeRecorderStartPortalAction: { flex: 1, minHeight: 112, alignItems: 'center', justifyContent: 'center', gap: 13, paddingTop: 19 },
  homeRecorderStartPortalTitle: { color: '#fff8f5', fontSize: 26, fontWeight: '500', textAlign: 'center', textShadowColor: 'rgba(255,90,79,0.45)', textShadowRadius: 12 },
  homeRecorderIdentify: { minHeight: 92, borderRadius: 22, borderWidth: 1, borderColor: 'rgba(174,119,207,0.42)', backgroundColor: 'rgba(13,9,21,0.88)', flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 17 },
  homeRecorderIdentifyIcon: { width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(182,126,255,0.3)' },
  homeRecorderIdentifyCopy: { flex: 1 },
  homeRecorderIdentifyTitle: { color: '#c78cff', fontSize: 18, fontWeight: '700' },
  homeRecorderIdentifyBody: { color: '#95899d', fontSize: 12, lineHeight: 17, marginTop: 4 },
  homeRecorderChevron: { color: '#bc9ad1', fontSize: 31, lineHeight: 32 },
  homeRecorderPressed: { opacity: 0.76, transform: [{ scale: 0.992 }] },
  homeRecorderNotice: { color: '#c9baca', fontSize: 11, lineHeight: 16, marginTop: 4 },
  liveBackButton: { alignSelf: 'flex-start', minHeight: 38, justifyContent: 'center', paddingHorizontal: 4 },
  liveBackText: { color: '#c99bff', fontSize: 15, fontWeight: '800' },
  recorderArtHeader: { alignSelf: 'stretch', marginHorizontal: -4, marginBottom: 18, overflow: 'hidden', borderRadius: 25, backgroundColor: '#08030e' }, brandRow: { flexDirection: 'row', alignItems: 'center', gap: 13, marginBottom: 8 }, logo: { width: 48, height: 48, borderRadius: 16, backgroundColor: '#ff7b54', alignItems: 'center', justifyContent: 'center', shadowColor: '#ff7b54', shadowOpacity: 0.35, shadowRadius: 18 }, logoText: { color: '#fff', fontSize: 25, fontWeight: '900' },
  eyebrow: { color: '#8d869c', fontSize: 11, fontWeight: '800', letterSpacing: 2.2 }, title: { color: '#f8f5ff', fontSize: 28, fontWeight: '800', letterSpacing: -0.7 },
  card: { backgroundColor: '#14111d', borderWidth: 1, borderColor: '#64427f', borderRadius: 24, padding: 20, gap: 13, shadowColor: '#9b61ff', shadowOpacity: 0.14, shadowRadius: 15, shadowOffset: { width: 0, height: 7 } }, cardTitle: { color: '#fff', fontSize: 21, fontWeight: '800' }, body: { color: '#aca5b9', fontSize: 15, lineHeight: 22, marginBottom: 5 }, label: { color: '#9b90a5', fontSize: 10, fontWeight: '800', letterSpacing: 1.2, marginTop: 5 }, input: { backgroundColor: '#0c0a11', borderWidth: 1, borderColor: '#59406c', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 14, color: '#fff', fontSize: 15, shadowColor: '#9b61ff', shadowOpacity: 0.1, shadowRadius: 9 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 10 }, check: { color: '#43e6ae', fontSize: 21, fontWeight: '800', width: 24 }, checkText: { color: '#d4cede', fontSize: 15 },
  statusCard: { alignItems: 'center', backgroundColor: '#121019', borderWidth: 1, borderColor: '#674788', borderRadius: 26, paddingVertical: 30, paddingHorizontal: 20, shadowColor: '#9b61ff', shadowOpacity: 0.2, shadowRadius: 20, shadowOffset: { width: 0, height: 8 } }, statusDot: { width: 12, height: 12, borderRadius: 6, marginBottom: 12, shadowOpacity: 0.9, shadowRadius: 9 }, statusText: { fontSize: 27, fontWeight: '800', textShadowColor: '#9b61ff55', textShadowRadius: 8 }, statusHint: { color: '#8f879b', fontSize: 14, marginTop: 6, textAlign: 'center' },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 }, metric: { width: '48.6%', minHeight: 76, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10, paddingVertical: 13 }, metricLabel: { color: '#9a8ea2', fontSize: 10, fontWeight: '800', letterSpacing: 0.8, textAlign: 'center' }, metricValue: { color: '#f4f0fb', fontSize: 19, fontVariant: ['tabular-nums'], fontWeight: '800', marginTop: 6, textAlign: 'center' },
  manualRecognitionCard: { backgroundColor: '#101526', borderColor: '#315e9a', padding: 18, gap: 8 }, manualRecognitionKicker: { color: '#6db5ff', fontSize: 9, fontWeight: '900', letterSpacing: 1.35 }, manualRecognitionTitle: { color: '#f7f9ff', fontSize: 19, fontWeight: '900' }, manualRecognitionBody: { color: '#a5adc0', fontSize: 13, lineHeight: 19 }, manualRecognitionAction: { flexDirection: 'row', marginTop: 5 }, manualRecognitionSafety: { color: '#70798d', fontSize: 10, lineHeight: 15, textAlign: 'center' },
  primaryButton: { minHeight: 58, borderRadius: 17, backgroundColor: '#ff7b54', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 22, flex: 1, shadowColor: '#ff6b4d', shadowOpacity: 0.48, shadowRadius: 15, shadowOffset: { width: 0, height: 7 } }, primaryButtonText: { color: '#160a06', fontSize: 16, fontWeight: '800' }, secondaryButton: { minHeight: 58, borderRadius: 17, backgroundColor: '#1c1726', borderWidth: 1, borderColor: '#654d7e', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 22, flex: 1, shadowColor: '#9b61ff', shadowOpacity: 0.24, shadowRadius: 13, shadowOffset: { width: 0, height: 6 } }, secondaryButtonText: { color: '#e8e1f1', fontSize: 16, fontWeight: '700' }, buttonMuted: { opacity: 0.55 }, actionRow: { flexDirection: 'row', gap: 12 },
  progressRow: { alignItems: 'center', flexDirection: 'row', gap: 10, justifyContent: 'center', minHeight: 28 }, progressText: { color: '#b9afc7', fontSize: 14 },
  syncCard: { alignItems: 'center', backgroundColor: '#121019', borderWidth: 1, borderColor: '#4f3d63', borderRadius: 16, flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingVertical: 14, shadowColor: '#65c9ff', shadowOpacity: 0.22, shadowRadius: 13, shadowOffset: { width: 0, height: 6 } }, syncDot: { width: 10, height: 10, borderRadius: 5, shadowOpacity: 0.8, shadowRadius: 7 }, syncCopy: { flex: 1 }, syncTitle: { fontSize: 14, fontWeight: '800' }, syncDetail: { color: '#938b9f', fontSize: 12, lineHeight: 17, marginTop: 3 },
  notice: { color: '#b9afc7', textAlign: 'center', lineHeight: 20 }, warning: { backgroundColor: '#17121b', borderLeftColor: '#9b7cff', borderLeftWidth: 3, borderRadius: 12, padding: 15, shadowColor: '#9b7cff', shadowOpacity: 0.22, shadowRadius: 13, shadowOffset: { width: 0, height: 6 } }, warningTitle: { color: '#c2b3ff', fontSize: 10, fontWeight: '900', letterSpacing: 1.1, textShadowColor: '#9b7cff66', textShadowRadius: 6 }, warningText: { color: '#9c94a8', fontSize: 13, lineHeight: 19, marginTop: 5 }, footer: { color: '#5e5868', fontSize: 11, textAlign: 'center', marginTop: 4 },
});
