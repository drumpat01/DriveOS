import { CreateJourneyMarkerButton } from './src/journey-markers';
import { requestJourneyLocationAccess } from './src/location-permissions';
import { IpadRecorderControls } from './src/ipad-home';
import { AppThemeProvider, useAppTheme, useThemedStyles } from './src/app-theme';
import { journeyDeckSemanticColors } from './src/journeydeck-design-tokens';
import { AppIconProvider } from './src/app-icon-preference';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, AppState, KeyboardAvoidingView, Linking, Platform, Pressable,
  ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { randomUUID } from 'expo-crypto';
import { LinearGradient } from 'expo-linear-gradient';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, RadialGradient as SvgRadialGradient, Rect, Stop } from 'react-native-svg';
import { ObserveRoot } from 'expo-observe';
import Reanimated, {
  Extrapolation, FadeIn, FadeInDown, FadeInUp, FadeOut, LinearTransition, cancelAnimation, interpolate,
  useAnimatedStyle, useSharedValue, withRepeat, withSpring, withTiming,
} from 'react-native-reanimated';

import './src/location-task';
import { NeonWidget, NeonWidgetOutline, QuietInset } from './src/neon-widget-outline';
import { HeaderArtwork } from './src/header-artwork';
import { loadConnection, loadOrCreateDeviceId, saveConnection, type Connection } from './src/credentials';
import { flushAllQueuedMusicBestEffort, flushRecording, pingRecorder } from './src/api';
import {
  activeSession, beginLocalSession, completeSessionLocally, getSessionSummary, initializeDatabase,
  getLiveRecorderSnapshot, recordLocations, setLocalStatus, type LiveRecorderSnapshot, type LocalSessionStatus, type QueuedPoint, type SessionSummary,
} from './src/storage';
import { decideRecovery } from './src/recovery';
import { syncPresentation, type SyncStage } from './src/sync-status';
import {
  isAutomaticDetectionActive, isLocationTrackingActive, startAutomaticDetection,
  startLocationTracking, stopAutomaticDetection, stopLocationTracking,
} from './src/tracking';
import { JourneyDeckShell } from './src/shell';
import { JourneyDeckNativeStack } from './src/native-navigation';
import { DisplayLayoutProvider } from './src/display-layout';
import { CardMotionProvider } from './src/card-detail-link';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { appDataClient } from './src/app-data';
import { HiddenJourneyNotice } from './src/hidden-journey-notice';
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
  configureNativeManualRecorder, isNativeManualRecorderAvailable, startNativeManualJourney,
  subscribeNativeRecorderStatus,
} from './modules/journeydeck-recorder';
import { getCurrentUser } from './src/auth';
import { processPendingCompletionJobs } from './src/completion-jobs';
import { syncNativeRecorderInbox } from './src/native-recorder-inbox';
import { NATIVE_AUTOMATIC_RECORDER_ENABLED, TESSIE_INTEGRATION_ENABLED, V3_FIFTY_STATES_ENABLED } from './src/release-features';
import { configureJourneyDeckObservability, observeJourneyDeckEvent, observeJourneyDeckEventOnce } from './src/observability';
import { tessieAutomaticRecordingEligible } from './src/tessie-direct';
import { manualRecordingFailsafeNotice } from './src/manual-recording-failsafe';
import { recorderClockRunning, recorderDurationLabel, updateRecorderClock, type RecorderClock } from './src/recorder-clock';
import type { ActiveJourneyProgress } from './src/tessie-home-widgets';
import { acceptRecorderStatusEvent, recorderEventStopTime, recorderRefreshMayPublish, recorderStatusEventNeedsRefresh, recorderStatusEventStopsClock, type RecorderStatusEventState } from './src/recorder-status-events';
import { waitForRecorderResponse } from './src/recorder-response';
import { DatabaseStartupGate } from './src/database-startup-gate';
import { haptics } from './src/haptics';
import { MOTION_SPRINGS, motionDuration, useMotionPreferences } from './src/motion';
import { RouteTraceMoment } from './src/delight-ui';
import {
  evaluateCurrentManualRecordingFailsafe, finishManualRecordingForFailsafe,
} from './src/manual-recording-failsafe-runtime';

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

type JourneyCompletionMoment = Readonly<{
  id: string;
  coordinates: [number, number][];
  distanceMiles: number;
  elapsed: string;
  pointCount: number;
}>;

function completionMomentFromSnapshot(snapshot: LiveRecorderSnapshot, fallback: SessionSummary): JourneyCompletionMoment {
  const route = snapshot.route;
  return {
    id: fallback.id,
    coordinates: route.map(point => [point.longitude, point.latitude]),
    distanceMiles: routeDistanceMiles(route),
    elapsed: durationLabel(snapshot.session?.startedAt ?? fallback.startedAt),
    pointCount: route.length,
  };
}

function RecorderScreen({ onClose, presentation = 'screen', showManualSongButton = false, onJourneyChange, onActivityChange, onProgressChange }: {
  onClose: () => void;
  presentation?: 'screen' | 'home' | 'ipad-home';
  showManualSongButton?: boolean;
  onJourneyChange?: () => void;
  onActivityChange?: (active: boolean) => void;
  onProgressChange?: (progress: ActiveJourneyProgress | null) => void;
}) {
  const theme = useAppTheme();
  const styles = useThemedStyles(darkStyles);
  const { isAppActive, reduceMotion } = useMotionPreferences();

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
  const [recorderClock, setRecorderClock] = useState<RecorderClock | null>(null);
  const [automaticDetectionActive, setAutomaticDetectionActive] = useState(false);
  const [recorderInitialized, setRecorderInitialized] = useState(false);
  const [recordingPreferences, setRecordingPreferences] = useState<RecordingModePreferences>(() => loadRecordingModePreferences());
  const operation = useRef<Promise<void>>(Promise.resolve());
  const refreshPending = useRef<Promise<void> | null>(null);
  const statusEventEpoch = useRef(0);
  const statusEventState = useRef<RecorderStatusEventState | null>(null);
  const eventRefreshQueued = useRef(false);
  const eventRefreshRequested = useRef(false);
  const busyRef = useRef(false);
  const announcedAutomaticEvent = useRef('');
  const [busy, setBusy] = useState(false);
  const [busyLabel, setBusyLabel] = useState('Working…');
  const [syncStage, setSyncStage] = useState<SyncStage>('idle');
  const [notice, setNotice] = useState('');
  const [completionMoment, setCompletionMoment] = useState<JourneyCompletionMoment | null>(null);
  const [clockNow, setClock] = useState(Date.now);

  const runExclusive = useCallback(async (work: () => Promise<void>) => {
    const next = operation.current.then(work, work);
    operation.current = next.catch(() => {});
    return next;
  }, []);

  const refresh = useCallback(() => {
    if (refreshPending.current) return refreshPending.current;
    const refreshEpoch = statusEventEpoch.current;
    const refreshProfileId = getCurrentUser().id;
    const pending = runExclusive(async () => {
    const stillCurrent = () => recorderRefreshMayPublish(refreshEpoch, statusEventEpoch.current,
      refreshProfileId, getCurrentUser().id);
    if (!stillCurrent()) return;
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
    await syncNativeRecorderInbox().catch(() => undefined);
    let nativeRecorder = await waitForRecorderResponse(getNativeAutomaticRecorderStatus(), 'native_recorder_status_timeout').catch(() => null);
    if (!stillCurrent()) return;
    if (recorderRefreshMayPublish(refreshEpoch, statusEventEpoch.current, refreshProfileId, getCurrentUser().id)
      && nativeRecorder?.eventStreamId && Number.isSafeInteger(nativeRecorder.eventSequence)) {
      const eventIdentity = { profileId: getCurrentUser().id, sessionId: nativeRecorder.sessionId };
      const known = statusEventState.current;
      if (!known || known.profileId !== eventIdentity.profileId || known.sessionId !== eventIdentity.sessionId
        || known.streamId !== nativeRecorder.eventStreamId || nativeRecorder.eventSequence! > known.sequence) {
        statusEventState.current = { ...eventIdentity, streamId: nativeRecorder.eventStreamId,
          sequence: nativeRecorder.eventSequence! };
      }
    }
    const automaticTaskRunning = NATIVE_AUTOMATIC_RECORDER_ENABLED
      ? Boolean(nativeRecorder?.significantMonitoring || nativeRecorder?.preciseTracking)
      : expoAutomaticDetectorRunning || Boolean(nativeRecorder?.recording);
    let current = activeSession();
    let currentIsNative = isNativeAutomaticSession(current?.id);
    // Publish transport truth before recovery/enrichment can wait or fail.
    // A completed native recorder may still have an unfinished inbox mirror.
    const initialSnapshot = getLiveRecorderSnapshot();
    const initialTracking = currentIsNative
      ? Boolean(nativeRecorder?.statusReliable !== false && nativeRecorder?.sessionId === current?.id
        && nativeRecorder?.recording && nativeRecorder?.preciseTracking) : taskRunning;
    if (recorderRefreshMayPublish(refreshEpoch, statusEventEpoch.current, refreshProfileId, getCurrentUser().id)) {
      setSummary(initialSnapshot.session);
      setTrackingActive(initialTracking);
      setRecorderClock(previous => updateRecorderClock(previous, initialSnapshot.session,
        initialTracking, Date.now(), initialSnapshot.lastPoint?.recordedAt));
    }
    await configureNativeManualRecorder(locationPermissionsReady, getCurrentUser().id, Boolean(current && !currentIsNative));
    if (!stillCurrent()) return;
    if (current?.id.startsWith('native_recording_manual_') && nativeRecorder?.recording && !taskRunning && available) {
      // Keep the existing Expo background music sampling cadence; GPS sequence
      // ownership remains exclusively in the native inbox for these sessions.
      taskRunning = await startLocationTracking().catch(() => false);
    }
    if (!current && taskRunning) { await stopLocationTracking().catch(() => undefined); taskRunning = false; }
    if (!stillCurrent()) return;
    const manualFailsafe = evaluateCurrentManualRecordingFailsafe();
    if (manualFailsafe.decision.shouldFinish && manualFailsafe.decision.reason
      && await finishManualRecordingForFailsafe(manualFailsafe.sessionId, manualFailsafe.decision, connection ?? undefined)) {
      taskRunning = false;
      setSyncStage('saved');
      setNotice(manualRecordingFailsafeNotice(manualFailsafe.decision.reason));
      current = activeSession();
      currentIsNative = isNativeAutomaticSession(current?.id);
    }
    if (!stillCurrent()) return;
    const nativeSessionCurrent = nativeRecorder?.statusReliable !== false && nativeRecorder?.sessionId === current?.id;
    const recordingTransportRunning = currentIsNative
      ? Boolean(nativeSessionCurrent && nativeRecorder?.recording && nativeRecorder?.preciseTracking) : taskRunning;
    // A stale/unreadable mirror must not pause or resume a different Watch journey.
    const recoveryStatus = currentIsNative && nativeSessionCurrent && nativeRecorder?.paused
      ? 'paused' : current?.status ?? null;
    const proposedAction = currentIsNative && !nativeSessionCurrent ? 'none'
      : decideRecovery(recoveryStatus, recordingTransportRunning, locationPermissionsReady && (currentIsNative || available));
    // The consolidated native engine reconciles its committed state on status.
    // A stale inbox mirror must not synthesize Resume over a newer Watch Pause.
    const action = currentIsNative && nativeRecorder?.eventStreamId && proposedAction === 'restart-recording'
      ? 'none' : proposedAction;
    if (action === 'stop-orphaned-task' || action === 'stop-paused-task' || action === 'stop-and-finish') {
      if (!currentIsNative && taskRunning) await stopLocationTracking();
      taskRunning = false;
    }
    if (action === 'restart-recording' && current) {
      observeJourneyDeckEvent('database.recovery_started', { action: 'restart_recording' });
      try {
        if (currentIsNative) {
          const resumed = await resumeNativeAutomaticJourney(current.id);
          if (resumed.sessionId !== current.id || resumed.statusReliable === false || resumed.lastErrorCode || !resumed.recording || !resumed.preciseTracking) throw new Error('iOS did not confirm native background recording.');
        } else {
          if (!(await startLocationTracking())) throw new Error('iOS did not confirm background location tracking.');
          await captureCurrentPoint(true);
          taskRunning = true;
        }
        void sampleAppleMusicForActiveSession({ force: true });
        setNotice('Recording resumed. A brief route gap may remain; existing points are safe.');
      } catch {
        if (currentIsNative) await pauseNativeAutomaticJourney(current.id).catch(() => undefined);
        else setLocalStatus(current.id, 'paused');
        taskRunning = false;
        setNotice(currentIsNative ? 'iOS could not confirm recording resumed. Check the recorder status before continuing; existing points remain saved.' : 'Recording paused because background tracking is unavailable. Existing points are safe; the interruption may have left a route gap.');
      }
    }
    if (action === 'pause-interrupted-recording' && current) {
      observeJourneyDeckEvent('database.recovery_started', { action: 'pause_interrupted' });
      if (currentIsNative) {
        const paused = await pauseNativeAutomaticJourney(current.id);
        if (paused.sessionId !== current.id || paused.statusReliable === false || paused.lastErrorCode || !paused.paused) throw new Error('iOS could not confirm the journey was paused.');
      } else {
        if (taskRunning) { try { await stopLocationTracking(); } catch {} }
        taskRunning = false;
        setLocalStatus(current.id, 'paused');
      }
      setNotice('Recording paused because required location access or background tracking is unavailable. Existing points are safe; the interruption may have left a route gap.');
    }
    if (action === 'stop-and-finish' && current) {
      observeJourneyDeckEvent('database.recovery_started', { action: 'finish_interrupted' });
      if (currentIsNative) {
        const finished = await finishNativeAutomaticJourney(current.id);
        if (finished.statusReliable === false || finished.sessionId === current.id || finished.lastErrorCode) throw new Error('iOS could not confirm the journey finished.');
        await syncNativeRecorderInbox();
      }
      else completeSessionLocally(current.id, Boolean(connection));
      enrichCompletedJourney(connection, current.id);
      setSyncStage('saved');
      setNotice('Journey saved on this iPhone. Library preparation and optional backup continue in the background.');
    }
    if (currentIsNative && action !== 'none' && action !== 'continue-recording' && action !== 'remain-paused') {
      await syncNativeRecorderInbox();
      nativeRecorder = await waitForRecorderResponse(getNativeAutomaticRecorderStatus(), 'native_recorder_status_timeout').catch(() => null);
    }
    const reconciled = activeSession();
    const liveSnapshot = getLiveRecorderSnapshot();
    const confirmedTracking = isNativeAutomaticSession(reconciled?.id)
      ? Boolean(nativeRecorder?.statusReliable !== false && nativeRecorder?.sessionId === reconciled?.id
        && nativeRecorder?.recording && nativeRecorder?.preciseTracking) : taskRunning;
    const refreshMayPublish = recorderRefreshMayPublish(refreshEpoch, statusEventEpoch.current,
      refreshProfileId, getCurrentUser().id);
    if (refreshMayPublish) {
      setRecorderClock(previous => updateRecorderClock(previous, liveSnapshot.session,
        confirmedTracking, Date.now(), liveSnapshot.lastPoint?.recordedAt));
      setSummary(reconciled ? getSessionSummary(reconciled.id) : null);
      setTrackingActive(confirmedTracking);
    }
    if (refreshMayPublish) {
      setDistanceMiles(liveSnapshot.session ? routeDistanceMiles(liveSnapshot.route) : 0);
      setForegroundPermission(foreground.status === 'granted');
      setBackgroundPermission(background.status === 'granted');
      setTaskAvailable(available);
      setAutomaticDetectionActive(automaticTaskRunning);
    }
    const automaticEvent = NATIVE_AUTOMATIC_RECORDER_ENABLED && nativeRecorder?.lastEvent && nativeRecorder.lastEventAt
      ? { kind: nativeRecorder.lastEvent, occurredAt: nativeRecorder.lastEventAt }
      : loadAutomaticDriveEvent();
    if (refreshMayPublish && nativeRecorder?.lastEvent === 'manual_auto_finished' && nativeRecorder.lastEventAt
      && announcedAutomaticEvent.current !== nativeRecorder.lastEventAt) {
      announcedAutomaticEvent.current = nativeRecorder.lastEventAt;
      setNotice('Journey finished automatically and is saved on this iPhone.');
    }
    if (refreshMayPublish && automaticEvent && Date.now() - Date.parse(automaticEvent.occurredAt) <= 30 * 60_000
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

  useEffect(() => subscribeNativeRecorderStatus(event => {
    const current = activeSession();
    const identity = { profileId: getCurrentUser().id, sessionId: current?.id ?? null };
    const prior = statusEventState.current?.profileId === identity.profileId
      && statusEventState.current.sessionId === identity.sessionId
      ? statusEventState.current : { ...identity, streamId: null, sequence: -1 };
    if (!recorderStatusEventNeedsRefresh(prior, event)) return;
    const accepted = acceptRecorderStatusEvent(prior, event);
    statusEventEpoch.current += 1;
    if (accepted) statusEventState.current = accepted;
    if (accepted?.streamId !== null && accepted && recorderStatusEventStopsClock(event) && current) {
      const snapshot = getLiveRecorderSnapshot();
      setTrackingActive(false);
      setRecorderClock(previous => updateRecorderClock(previous, snapshot.session, false,
        recorderEventStopTime(event, Date.now()), snapshot.lastPoint?.recordedAt));
    }
    eventRefreshRequested.current = true;
    if (eventRefreshQueued.current) return;
    eventRefreshQueued.current = true;
    void (async () => {
      try {
        while (eventRefreshRequested.current) {
          eventRefreshRequested.current = false;
          await Promise.resolve(refreshPending.current).catch(() => undefined);
          await refresh().catch(() => undefined);
        }
      } finally {
        eventRefreshQueued.current = false;
      }
    })();
  }), [refresh]);

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
      await configureNativeManualRecorder(foregroundPermission && backgroundPermission, getCurrentUser().id,
        Boolean(current && !isNativeAutomaticSession(current.id)));
      await syncNativeRecorderInbox();
      return Boolean(status.significantMonitoring || status.preciseTracking);
    }

    // Build 13 fallback: keep the proven Expo automatic detector as the public
    // owner while the corrected native confirmation burst is physically
    // validated. If a native journey was already recording, let it finish
    // rather than starting a duplicate.
    const nativeStatus = await configureNativeAutomaticRecorder(false, getCurrentUser().id, deviceId);
    await configureNativeManualRecorder(foregroundPermission && backgroundPermission, getCurrentUser().id,
      Boolean(current && !isNativeAutomaticSession(current.id)));
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
    let loaded = false, loading = false;
    const initializeCredentials = async () => {
      if (cancelled || loaded || loading) return;
      loading = true;
      try {
        const [localDeviceId, saved] = await Promise.all([loadOrCreateDeviceId(), loadConnection()]);
        if (cancelled) return;
        setDeviceId(localDeviceId);
        if (saved) { setConnection(saved); setServerUrl(saved.serverUrl); }
        loaded = true;
      } catch {
        if (!cancelled) setNotice('Device setup could not finish. Unlock your device, then return to JourneyDeck to retry. Your saved journeys remain on this device.');
      } finally { loading = false; }
    };
    void initializeCredentials();
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') void initializeCredentials(); });
    return () => { cancelled = true; subscription.remove(); };
  }, []);

  useEffect(() => {
    if (!isAppActive) return;
    let mounted = true;
    void refresh().catch(() => {}).finally(() => { if (mounted) setRecorderInitialized(true); });
    void processPendingCompletionJobs({ connection, limit: 12 }).catch(() => {});
    void sampleAppleMusicForActiveSession({ force: true });
    void syncPendingLastFmBestEffort();
    let ticks = 0;
    const timer = setInterval(() => {
      setClock(Date.now());
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
  }, [connection, isAppActive, reconcileAutomaticRecorder, refresh]);

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
  const clockTracking = trackingActive && recorderClockRunning(recorderClock, Math.max(clockNow, recorderClock?.confirmedAtMs ?? 0));
  const accent = summary?.status === 'recording' && clockTracking ? '#43e6ae' : summary?.status === 'paused' ? '#ffb45c' : '#9b7cff';

  useEffect(() => {
    if (!completionMoment || !isAppActive) return;
    const timer = setTimeout(() => setCompletionMoment(null), 5_200);
    return () => clearTimeout(timer);
  }, [completionMoment, isAppActive]);

  useEffect(() => {
    onActivityChange?.(active || busy);
    return () => onActivityChange?.(false);
  }, [active, busy, onActivityChange]);

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
    if (!(await requestJourneyLocationAccess())) return;
    if (!(await TaskManager.isAvailableAsync())) throw new Error('Background recording requires the installed JourneyDeck build, not Expo Go.');
    setNotice('Background location is ready.');
  }, 'Checking location access…');

  const start = () => withBusy(async () => {
    if (!deviceId) throw new Error('The local recorder is still getting ready.');
    if (!permissionsReady) throw new Error('Enable background location first.');
    if (isNativeManualRecorderAvailable) {
      await syncNativeRecorderInbox();
      const current = activeSession();
      if (current) throw new Error('A journey is already active.');
      await configureNativeAutomaticRecorder(false, getCurrentUser().id, deviceId);
      await configureNativeManualRecorder(true, getCurrentUser().id, false);
      const status = await startNativeManualJourney(randomUUID());
      if (!status.recording) throw new Error('Recording could not start. Check Always location access on this iPhone.');
      await syncNativeRecorderInbox();
      await startLocationTracking().catch(() => false);
      void sampleAppleMusicForActiveSession({ force: true });
      setNotice('Recording started and is being saved on this iPhone.');
      void haptics.primaryAction();
      return;
    }
    const session = beginLocalSession(deviceId);
    try { if (!(await startLocationTracking())) throw new Error('iOS did not confirm background location tracking.'); await captureCurrentPoint(true); }
    catch (error) { setLocalStatus(session.id, 'paused'); throw error; }
    void sampleAppleMusicForActiveSession({ force: true });
    setNotice('Recording started and is being saved on this iPhone.');
    void haptics.primaryAction();
  }, 'Starting background recording…');

  const pause = () => withBusy(async () => {
    if (!summary) return;
    if (isNativeAutomaticSession(summary.id)) {
      const status = await pauseNativeAutomaticJourney(summary.id);
      if (status.sessionId !== summary.id || status.statusReliable === false || status.lastErrorCode || !status.paused) throw new Error('The native journey could not be paused safely.');
      await stopLocationTracking().catch(() => undefined);
    } else {
      await captureCurrentPoint(); await stopLocationTracking(); setLocalStatus(summary.id, 'paused');
    }
    setNotice('Recording paused. Every captured point remains on this phone.');
  }, 'Pausing recording…');

  const resume = () => withBusy(async () => {
    if (!summary) return;
    if (isNativeAutomaticSession(summary.id)) {
      const status = await resumeNativeAutomaticJourney(summary.id);
      if (status.sessionId !== summary.id || status.statusReliable === false || status.lastErrorCode || !status.recording || !status.preciseTracking) throw new Error('iOS did not confirm native background recording.');
      if (summary.id.startsWith('native_recording_manual_')) await startLocationTracking().catch(() => false);
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
        let completedSnapshot = getLiveRecorderSnapshot();
        if (isNativeAutomaticSession(currentSummary.id)) {
          const status = await finishNativeAutomaticJourney(currentSummary.id);
          if (status.statusReliable === false || status.sessionId === currentSummary.id || status.lastErrorCode) throw new Error('The native journey could not be finished safely.');
          await syncNativeRecorderInbox();
          await stopLocationTracking().catch(() => undefined);
          const synchronizedSnapshot = getLiveRecorderSnapshot();
          if (synchronizedSnapshot.route.length >= completedSnapshot.route.length) completedSnapshot = synchronizedSnapshot;
        } else {
          await captureCurrentPoint();
          await stopLocationTracking();
          completedSnapshot = getLiveRecorderSnapshot();
          setLocalStatus(currentSummary.id, 'finishing');
          completeSessionLocally(currentSummary.id, Boolean(connection));
        }
        resetAutomaticDriveState();
        setTrackingActive(false);
        enrichCompletedJourney(connection, currentSummary.id);
        setCompletionMoment(completionMomentFromSnapshot(completedSnapshot, currentSummary));
        setSummary(null);
        setSyncStage('saved');
        setNotice('Journey saved on this iPhone. Library preparation and optional backup continue in the background.');
        void haptics.success();
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
    Alert.alert('Finish this journey?', 'Recording will stop and your journey will be saved on this iPhone while its library entry is prepared.', [
      { text: 'Keep recording', style: 'cancel' },
      { text: 'Finish journey', style: 'destructive', onPress: () => void finishSession(summary) },
    ]);
  };

  const syncNow = () => withBusy(async () => {
    if (!connection || !summary) return;
    setSyncStage('syncing');
    try {
      if (summary.status === 'finishing') {
        completeSessionLocally(summary.id); enrichCompletedJourney(connection, summary.id); setSummary(null); setSyncStage('saved'); setNotice('Journey saved on this iPhone. Library preparation and optional backup continue in the background.');
        return;
      }
      await flushRecording(connection, summary.id); setSyncStage('synced'); setNotice('GPS points are synced. Music details continue syncing independently.');
    } catch (error) {
      setSyncStage('retry');
      throw error;
    }
  }, 'Syncing to JourneyDeck…');

  const elapsedLabel = recorderDurationLabel(summary, recorderClock, Math.max(clockNow, recorderClock?.confirmedAtMs ?? 0));
  const progressElapsedLabel = recorderDurationLabel(summary, recorderClock, Math.max(Math.floor(clockNow / 5_000) * 5_000, recorderClock?.confirmedAtMs ?? 0));
  useEffect(() => {
    const progress = summary && summary.status !== 'completed'
      ? { startedAt: summary.startedAt, status: summary.status as ActiveJourneyProgress['status'], elapsed: progressElapsedLabel, distanceMiles, pointCount: summary.pointCount }
      : null;
    onProgressChange?.(progress);
  }, [distanceMiles, onProgressChange, progressElapsedLabel, summary]);
  const metrics = [
    ['TIME', elapsedLabel], ['POINTS', String(summary?.pointCount ?? 0)], [connection ? 'GPS QUEUED' : 'GPS SAVED', String(summary?.queuedCount ?? 0)], [connection ? 'MUSIC QUEUED' : 'MUSIC SAVED', String(summary?.musicQueuedCount ?? 0)],
  ];
  const automaticMode = TESSIE_INTEGRATION_ENABLED && recordingPreferences.onboardingCompleted && recordingPreferences.mode === 'automatic';

  if (presentation === 'ipad-home') {
    const startupPending = !deviceId || !recorderInitialized;
    const tabletStatus = startupPending ? 'loading' : summary?.status === 'finishing' ? 'finishing'
      : summary?.status === 'recording' ? 'recording' : summary?.status === 'paused' ? 'paused'
      : !permissionsReady ? 'permission' : automaticMode ? 'automatic' : 'ready';
    return <View><IpadRecorderControls status={tabletStatus} busy={busy} startLabel={V3_FIFTY_STATES_ENABLED ? 'Record Journey' : 'Start Journey'} onStart={start} onEnable={enablePermissions}
      onEnd={finish} onResume={resume} onIdentify={showManualSongButton ? identifySong : undefined} notice={notice} />
      {summary?.status === 'recording' && <CreateJourneyMarkerButton sessionId={summary.id} />}</View>;
  }

  if (presentation === 'home') {
    const recording = summary?.status === 'recording';
    const paused = summary?.status === 'paused';
    const startupPending = !deviceId || !recorderInitialized;
    const showStartPortal = !active && !automaticMode && (startupPending || permissionsReady);
    return (
      <View style={styles.homeRecorderStack}>
        <Reanimated.View layout={reduceMotion ? undefined : LinearTransition.springify().damping(22).stiffness(190)}>
        {completionMoment && !active ? (
          <JourneySavedMoment moment={completionMoment} active={isAppActive} reduceMotion={reduceMotion} onDismiss={() => setCompletionMoment(null)} />
        ) : showStartPortal ? (
          <Reanimated.View key="start-portal" exiting={reduceMotion ? undefined : FadeOut.duration(160)}>
            <HomeRecorderStartPortal onPress={start} disabled={busy || startupPending} showProgress={busy} />
          </Reanimated.View>
        ) : (
          <Reanimated.View key="live-recorder" entering={reduceMotion ? FadeIn.duration(120) : FadeInDown.duration(320).springify().damping(21)} style={styles.homeRecorderCard}>
            <View style={styles.homeRecorderStatusRow}>
              <View style={styles.homeRecorderPulseOuter}><View style={[styles.homeRecorderPulseMiddle, paused && styles.homeRecorderPulsePaused]}><View style={[styles.homeRecorderPulseCore, paused && styles.homeRecorderPulseCorePaused]} /></View></View>
              <View style={styles.homeRecorderStatusCopy}>
                <Text style={[styles.homeRecorderEyebrow, paused && styles.homeRecorderEyebrowPaused]}>{active ? paused ? 'PAUSED' : summary?.status === 'finishing' ? 'FINISHING' : clockTracking ? 'RECORDING' : 'CHECKING RECORDING' : automaticMode ? 'TESLA AUTOMATION' : 'READY'}</Text>
                <Text style={styles.homeRecorderBody}>{active ? paused ? 'Your journey is paused.' : summary?.status === 'finishing' ? 'Recording has stopped. Your journey is being saved.' : clockTracking ? 'Your journey is being remembered. Add a marker while you drive.' : 'Confirming recorder status. Saved GPS points are safe.' : automaticMode ? automaticDetectionActive ? 'Journeys are detected automatically. Your active drive will appear here.' : 'Automatic detection is paused. Check Always Allow location access.' : 'Ready to remember your next drive.'}</Text>
              </View>
              {busy && <ActivityIndicator color={theme.color("#ff795b", 'text')} size="small" />}
            </View>

            {active && <View style={styles.homeRecorderMetrics}>
              <View style={styles.homeRecorderMetric}><SymbolView name="clock" tintColor={theme.color("#a49baa", 'text')} size={22} /><Text style={styles.homeRecorderMetricValue}>{elapsedLabel}</Text></View>
              <View style={styles.homeRecorderMetricDivider} />
              <View style={styles.homeRecorderMetric}><SymbolView name="road.lanes" tintColor={theme.color("#a49baa", 'text')} size={22} /><Text style={styles.homeRecorderMetricValue}>{distanceMiles.toFixed(1)} <Text style={styles.homeRecorderMetricUnit}>MI</Text></Text></View>
              <View style={styles.homeRecorderMetricDivider} />
              <View style={styles.homeRecorderMetric}><SymbolView name="location.fill" tintColor={theme.color("#a49baa", 'text')} size={22} /><Text style={styles.homeRecorderMetricLabel}>GPS SAVED</Text><Text style={styles.homeRecorderMetricValue}>{summary?.pointCount ?? 0}</Text></View>
            </View>}
          </Reanimated.View>
        )}
        </Reanimated.View>

        {startupPending ? null
          : !permissionsReady ? <HomeRecorderPrimaryAction label="Enable Location" symbol="location.fill" onPress={enablePermissions} disabled={busy} />
          : !active && !automaticMode ? null
          : recording ? <>
            {summary && <CreateJourneyMarkerButton sessionId={summary.id} />}
            {showManualSongButton && <Pressable disabled={busy} onPress={identifySong} style={({ pressed }) => [styles.homeRecorderIdentify, pressed && styles.homeRecorderPressed]}>
              <LinearGradient colors={theme.gradient(['rgba(88,43,148,0.96)', 'rgba(20,13,30,0.96)'])} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={styles.homeRecorderIdentifyIcon}><SymbolView name="music.note" tintColor={theme.color("#d595ff", 'text')} size={27} /></LinearGradient>
              <View style={styles.homeRecorderIdentifyCopy}><Text style={styles.homeRecorderIdentifyTitle}>Identify Song</Text><Text style={styles.homeRecorderIdentifyBody}>Tap once for each song you want to remember.</Text></View>
              <Text style={styles.homeRecorderChevron}>›</Text>
            </Pressable>}
            <HomeRecorderPrimaryAction label="End Journey" symbol="waveform" onPress={finish} disabled={busy} />
          </>
          : paused ? <>
            <Pressable disabled={busy} onPress={resume} style={({ pressed }) => [styles.homeRecorderIdentify, pressed && styles.homeRecorderPressed]}><View style={styles.homeRecorderIdentifyIcon}><SymbolView name="play.fill" tintColor={theme.color("#d595ff", 'text')} size={24} /></View><View style={styles.homeRecorderIdentifyCopy}><Text style={styles.homeRecorderIdentifyTitle}>Resume Journey</Text><Text style={styles.homeRecorderIdentifyBody}>Continue saving your route.</Text></View><Text style={styles.homeRecorderChevron}>›</Text></Pressable>
            <HomeRecorderPrimaryAction label="End Journey" symbol="waveform" onPress={finish} disabled={busy} />
          </> : null}
        <HiddenJourneyNotice enabled={!active && !startupPending && !busy} notice={notice} />
      </View>
    );
  }

  return (
    <View style={styles.safeArea}>
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
          <View style={styles.recorderArtHeader}><HeaderArtwork source={require('./assets/cinematic-home-main-photo-v1.jpg')} /></View>

          {!deviceId ? (
            <NeonWidget radius={22} style={styles.card}><ActivityIndicator color={theme.color("#9b7cff", 'text')} /><Text style={styles.body}>Preparing the private on-device recorder…</Text></NeonWidget>
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
              <NeonWidget radius={22} tone="hero" style={[styles.statusCard, { borderColor: theme.color(accent, 'border') }]}><View style={[styles.statusDot, { backgroundColor: theme.color(accent, 'surface') }]} /><Text style={[styles.statusText, { color: theme.color(accent, 'text') }]}>{!summary && automaticMode ? (automaticDetectionActive ? 'Watching for a drive' : 'Automatic detection paused') : statusLabel(summary?.status, clockTracking)}</Text><Text style={styles.statusHint}>{summary?.status === 'recording' ? (clockTracking ? 'You can lock your phone' : 'Checking iOS background tracking') : summary?.status === 'paused' ? 'GPS capture is stopped' : summary?.status === 'finishing' ? 'Points are safe on this phone' : automaticMode ? (automaticDetectionActive ? 'JourneyDeck will start when driving is detected' : 'Check Always Allow location access') : 'Start when you begin driving'}</Text></NeonWidget>
              <View style={styles.metrics}>{metrics.map(([label, value], index) => <QuietInset radius={16} accent={index === 0 ? '#ff795b' : index === 1 ? '#ff4d87' : index === 2 ? '#a66cff' : '#5aa7ff'} style={styles.metric} key={label}><Text style={styles.metricLabel}>{label}</Text><Text style={styles.metricValue} numberOfLines={1}>{value}</Text></QuietInset>)}</View>
              {!active && !automaticMode && <PrimaryButton label="Start recording" onPress={start} disabled={busy} />}
              {summary?.status === 'recording' && <CreateJourneyMarkerButton sessionId={summary.id} />}
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
              <TextInput value={token} onChangeText={setToken} autoCapitalize="none" autoCorrect={false} secureTextEntry placeholder="Paste your private key" placeholderTextColor={theme.color("#655f74", 'text')} style={styles.input} />
              <SecondaryButton label="Connect owner backup" onPress={connect} disabled={busy} />
            </NeonWidget>
          ) : null}
          {syncStage !== 'idle' ? <SyncStatus stage={syncStage} /> : busy ? <View style={styles.progressRow}><ActivityIndicator color={theme.color("#9b7cff", 'text')} /><Text style={styles.progressText}>{busyLabel}</Text></View> : null}
          {!!notice && <Text style={styles.notice}>{notice}</Text>}
          <View style={styles.warning}><Text style={styles.warningTitle}>{automaticMode ? 'AUTOMATIC DETECTION' : 'KEEP THE RECORDER RUNNING'}</Text><Text style={styles.warningText}>{automaticMode ? 'JourneyDeck looks for sustained driving speed and waits five parked minutes before finishing. Force-quitting the app stops automatic detection until you reopen it.' : 'Locking your iPhone is fine. Force-quitting the app from the app switcher stops iOS background location until you reopen it.'}</Text></View>
          <Text style={styles.footer}>Private on-device recorder • {connection ? 'Owner backup connected' : 'No server required'}</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function RecorderAtmosphere() {
  const theme = useAppTheme();
  const styles = useThemedStyles(darkStyles);

  return <Svg pointerEvents="none" viewBox="0 0 430 1250" preserveAspectRatio="none" style={styles.atmosphere}><Defs><SvgRadialGradient id="recorderTopBloom" cx="50%" cy="3%" rx="68%" ry="34%"><Stop offset="0" stopColor={theme.color("#8d4fff", 'accent')} stopOpacity="0.25" /><Stop offset="0.5" stopColor={theme.color("#642eb2", 'accent')} stopOpacity="0.08" /><Stop offset="1" stopColor={theme.color("#642eb2", 'accent')} stopOpacity="0" /></SvgRadialGradient><SvgRadialGradient id="recorderSideBloom" cx="100%" cy="55%" rx="78%" ry="36%"><Stop offset="0" stopColor={theme.color("#4ca7ff", 'accent')} stopOpacity="0.17" /><Stop offset="0.55" stopColor={theme.color("#704cff", 'accent')} stopOpacity="0.05" /><Stop offset="1" stopColor={theme.color("#704cff", 'accent')} stopOpacity="0" /></SvgRadialGradient><SvgRadialGradient id="recorderLowBloom" cx="0%" cy="88%" rx="82%" ry="30%"><Stop offset="0" stopColor={theme.color("#ff6540", 'accent')} stopOpacity="0.13" /><Stop offset="1" stopColor={theme.color("#ff6540", 'accent')} stopOpacity="0" /></SvgRadialGradient></Defs><Rect width="430" height="1250" fill="url(#recorderTopBloom)" /><Rect width="430" height="1250" fill="url(#recorderSideBloom)" /><Rect width="430" height="1250" fill="url(#recorderLowBloom)" /></Svg>;
}

function App() {
  return <GestureHandlerRootView style={{ flex: 1 }}><DisplayLayoutProvider><DatabaseStartupGate><AppThemeProvider><AppIconProvider><CardMotionProvider><JourneyDeckShell recorder={RecorderScreen}><JourneyDeckNativeStack /></JourneyDeckShell></CardMotionProvider></AppIconProvider></AppThemeProvider></DatabaseStartupGate></DisplayLayoutProvider></GestureHandlerRootView>;
}

export default ObserveRoot.wrap(App);

type ButtonProps = { label: string; onPress: () => void; disabled?: boolean };
function PrimaryButton({ label, onPress, disabled }: ButtonProps) {
  const theme = useAppTheme();
  const styles = useThemedStyles(darkStyles);
 return <Pressable onPress={onPress} disabled={disabled} style={({ pressed }) => [styles.primaryButton, theme.isCustom && { backgroundColor: theme.palette.accent }, (disabled || pressed) && styles.buttonMuted]}><Text style={[styles.primaryButtonText, theme.isCustom && { color: theme.palette.onAccent }]}>{label}</Text></Pressable>; }
function SecondaryButton({ label, onPress, disabled }: ButtonProps) {
  const styles = useThemedStyles(darkStyles);
 return <Pressable onPress={onPress} disabled={disabled} style={({ pressed }) => [styles.secondaryButton, (disabled || pressed) && styles.buttonMuted]}><Text style={styles.secondaryButtonText}>{label}</Text></Pressable>; }
function Check({ ready, label }: { ready: boolean; label: string }) {
  const styles = useThemedStyles(darkStyles);
 return <View style={styles.checkRow}><Text style={styles.check}>{ready ? '✓' : '○'}</Text><Text style={styles.checkText}>{label}</Text></View>; }
function JourneySavedMoment({ moment, active, reduceMotion, onDismiss }: { moment: JourneyCompletionMoment; active: boolean; reduceMotion: boolean; onDismiss: () => void }) {
  const theme = useAppTheme();
  const styles = useThemedStyles(darkStyles);
  const metricEntrance = (delay: number) => reduceMotion ? undefined : FadeInUp.duration(300).delay(delay);
  return <Reanimated.View
    key={moment.id}
    entering={reduceMotion ? FadeIn.duration(120) : FadeInUp.duration(380).springify().damping(20)}
    exiting={reduceMotion ? undefined : FadeOut.duration(180)}
    style={styles.journeySavedMoment}
    accessible
    accessibilityRole="summary"
    accessibilityLiveRegion="polite"
    accessibilityLabel={`Journey saved. ${moment.distanceMiles.toFixed(1)} miles, ${moment.elapsed}, ${moment.pointCount} GPS points.`}
  >
    <LinearGradient pointerEvents="none" colors={theme.gradient(['rgba(91,39,110,0.96)', 'rgba(29,15,39,0.96)', 'rgba(10,8,15,0.98)'])} style={StyleSheet.absoluteFill} />
    <NeonWidgetOutline radius={26} tone="hero" />
    <Reanimated.View entering={reduceMotion ? undefined : FadeInDown.duration(280)} style={styles.journeySavedHeader}>
      <View style={styles.journeySavedCheck}><SymbolView name="checkmark" tintColor={theme.color('#130b16', 'text')} size={20} weight="bold" /></View>
      <View style={styles.homeRecorderStatusCopy}><Text style={styles.journeySavedEyebrow}>JOURNEY SAVED</Text><Text style={styles.journeySavedTitle}>Another road remembered.</Text></View>
    </Reanimated.View>
    <RouteTraceMoment coordinates={moment.coordinates} active={active} reduceMotion={reduceMotion} completed duration={1_050} />
    <View style={styles.journeySavedMetrics}>
      <Reanimated.View entering={metricEntrance(280)} style={styles.journeySavedMetric}><Text style={styles.journeySavedMetricValue}>{moment.distanceMiles.toFixed(1)}</Text><Text style={styles.journeySavedMetricLabel}>MILES</Text></Reanimated.View>
      <Reanimated.View entering={metricEntrance(350)} style={styles.journeySavedMetric}><Text style={styles.journeySavedMetricValue}>{moment.elapsed}</Text><Text style={styles.journeySavedMetricLabel}>ELAPSED</Text></Reanimated.View>
      <Reanimated.View entering={metricEntrance(420)} style={styles.journeySavedMetric}><Text style={styles.journeySavedMetricValue}>{moment.pointCount}</Text><Text style={styles.journeySavedMetricLabel}>GPS POINTS</Text></Reanimated.View>
    </View>
    <Pressable accessibilityRole="button" accessibilityLabel="Dismiss saved journey confirmation" onPress={onDismiss} style={({ pressed }) => [styles.journeySavedDismiss, pressed && styles.homeRecorderPressed]}><Text style={styles.journeySavedDismissText}>Done</Text></Pressable>
  </Reanimated.View>;
}
function HomeRecorderStartPortal({ onPress, disabled, showProgress = false, presentation = 'phone', body }: {
  onPress: () => void;
  disabled?: boolean;
  showProgress?: boolean;
  presentation?: 'phone' | 'ipad-header';
  body?: string;
}) {
  const theme = useAppTheme();
  const homeColors = journeyDeckSemanticColors(theme.id, theme.palette);
  const styles = useThemedStyles(darkStyles);
  const actionLabel = V3_FIFTY_STATES_ENABLED ? 'Record Journey' : 'Start Journey';
  const { reduceMotion, ambientMotionEnabled } = useMotionPreferences();
  const ipadHeader = presentation === 'ipad-header';
  const portalBody = body ?? (ipadHeader ? null : 'Ready to remember your next drive.');
  const pressedScale = useSharedValue(1);
  const breathe = useSharedValue(0);
  const lightSweep = useSharedValue(0);
  const motionStyle = useAnimatedStyle(() => ({ transform: [{ scale: pressedScale.get() }] }));
  const outerRingStyle = useAnimatedStyle(() => ({
    opacity: interpolate(breathe.get(), [0, 1], [0.58, 1], Extrapolation.CLAMP),
    transform: [{ scale: interpolate(breathe.get(), [0, 1], [0.94, 1.09], Extrapolation.CLAMP) }],
  }));
  const middleRingStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(breathe.get(), [0, 1], [1.04, 0.97], Extrapolation.CLAMP) }],
  }));
  const coreStyle = useAnimatedStyle(() => ({
    opacity: interpolate(breathe.get(), [0, 0.5, 1], [0.82, 1, 0.88], Extrapolation.CLAMP),
    transform: [{ scale: interpolate(breathe.get(), [0, 1], [0.9, 1.12], Extrapolation.CLAMP) }],
  }));
  const lightStyle = useAnimatedStyle(() => ({
    opacity: interpolate(lightSweep.get(), [0, 0.16, 0.78, 1], [0, 0.5, 0.42, 0], Extrapolation.CLAMP),
    transform: [
      { translateX: interpolate(lightSweep.get(), [0, 1], [-250, 250], Extrapolation.CLAMP) },
      { rotate: '-18deg' },
    ],
  }));

  useEffect(() => {
    cancelAnimation(breathe);
    cancelAnimation(lightSweep);
    breathe.set(0);
    lightSweep.set(0);
    if (!ambientMotionEnabled || disabled || V3_FIFTY_STATES_ENABLED) return;
    breathe.set(withRepeat(withTiming(1, { duration: 2_800 }), -1, true));
    lightSweep.set(withRepeat(withTiming(1, { duration: 4_600 }), -1, false));
    return () => {
      cancelAnimation(breathe);
      cancelAnimation(lightSweep);
      breathe.set(0);
      lightSweep.set(0);
    };
  }, [ambientMotionEnabled, breathe, disabled, lightSweep]);

  const pressIn = () => {
    pressedScale.set(withTiming(0.975, { duration: motionDuration('feedback', reduceMotion) }));
    void haptics.softImpact();
  };
  const pressOut = () => {
    pressedScale.set(reduceMotion ? 1 : withSpring(1, MOTION_SPRINGS.responsive));
  };

  if (V3_FIFTY_STATES_ENABLED) return <Pressable
    testID="home-start-journey-portal"
    accessibilityRole="button" accessibilityLabel={actionLabel}
    accessibilityState={{ disabled: Boolean(disabled), busy: Boolean(showProgress) }}
    disabled={disabled} onPress={onPress}
    style={({ pressed }) => ({ width: '100%', minHeight: 64, borderRadius: 20, paddingHorizontal: 20, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: homeColors.accent, opacity: disabled || pressed ? 0.6 : 1 })}
  >
    {showProgress ? <ActivityIndicator color={homeColors.onAccent} /> : <SymbolView name="record.circle" tintColor={homeColors.onAccent} size={24} />}
    <Text style={{ color: homeColors.onAccent, fontSize: 20, fontWeight: '700', flexShrink: 1 }}>{actionLabel}</Text>
    <SymbolView name="arrow.right" tintColor={homeColors.onAccent} size={22} />
  </Pressable>;

  return <Reanimated.View style={[motionStyle, ipadHeader && styles.homeRecorderStartPortalIpadFrame]}><Pressable
    testID="home-start-journey-portal"
    accessibilityRole="button"
    accessibilityLabel={actionLabel}
    accessibilityHint={`Begins recording your route on this ${ipadHeader ? 'iPad' : 'iPhone'}.`}
    accessibilityState={{ disabled: Boolean(disabled) }}
    disabled={disabled}
    onPress={onPress}
    onPressIn={pressIn}
    onPressOut={pressOut}
    style={({ pressed }) => [styles.homeRecorderStartPortal, ipadHeader && styles.homeRecorderStartPortalIpad, pressed && styles.homeRecorderStartPortalPressed]}
  >
    <View style={[styles.homeRecorderStartPortalCanvas, ipadHeader && styles.homeRecorderStartPortalCanvasIpad, theme.isLight && !theme.isCustom && { backgroundColor: 'rgba(250,244,255,0.78)', borderRadius: 30 }, theme.isCustom && { backgroundColor: `${theme.palette.card}e0`, borderRadius: 30 }]}>
      <HomeRecorderStartPortalAtmosphere />
      <View pointerEvents="none" style={styles.homeRecorderStartPortalLightClip}>
        <Reanimated.View style={[styles.homeRecorderStartPortalLight, lightStyle]}>
          <LinearGradient colors={['rgba(255,255,255,0)', 'rgba(255,232,218,0.36)', 'rgba(255,255,255,0)']} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={StyleSheet.absoluteFill} />
        </Reanimated.View>
      </View>
      <View pointerEvents="none" style={[styles.homeRecorderStartPortalOutline, theme.isLight && !theme.isCustom && { borderColor: '#694079', shadowColor: '#8e58b0' }, theme.isCustom && { borderColor: theme.isLight ? theme.palette.accent : theme.palette.chrome, shadowColor: theme.palette.accent }]} />
      <View pointerEvents="none" style={styles.homeRecorderStartPortalStatus}>
        <Reanimated.View style={[styles.homeRecorderStartPortalPulseOuter, ipadHeader && styles.homeRecorderStartPortalPulseOuterIpad, theme.isLight && !theme.isCustom && { borderColor: 'rgba(105,64,121,0.30)', backgroundColor: 'rgba(150,100,183,0.06)' }, outerRingStyle]}>
          <Reanimated.View style={[styles.homeRecorderStartPortalPulseMiddle, ipadHeader && styles.homeRecorderStartPortalPulseMiddleIpad, theme.isLight && !theme.isCustom && { borderColor: 'rgba(105,64,121,0.55)', backgroundColor: 'rgba(150,100,183,0.12)' }, middleRingStyle]}>
            <Reanimated.View style={[styles.homeRecorderStartPortalPulseCore, ipadHeader && styles.homeRecorderStartPortalPulseCoreIpad, theme.isLight && !theme.isCustom && { backgroundColor: '#75448e', shadowColor: '#985ac0' }, theme.isCustom && { backgroundColor: theme.palette.accent, shadowColor: theme.palette.accent }, coreStyle]} />
          </Reanimated.View>
        </Reanimated.View>
        <Text style={[styles.homeRecorderStartPortalEyebrow, ipadHeader && styles.homeRecorderStartPortalEyebrowIpad, theme.isLight && !theme.isCustom && { color: '#59316d' }]}>READY</Text>
        {portalBody ? <Text numberOfLines={ipadHeader ? 2 : undefined} style={[styles.homeRecorderStartPortalBody, ipadHeader && styles.homeRecorderStartPortalBodyIpad, theme.isLight && !theme.isCustom && { color: '#49354f' }]}>{portalBody}</Text> : null}
      </View>
      <View pointerEvents="none" style={[styles.homeRecorderStartPortalAction, ipadHeader && styles.homeRecorderStartPortalActionIpad]}>
        <Text style={[styles.homeRecorderStartPortalTitle, ipadHeader && styles.homeRecorderStartPortalTitleIpad, theme.isLight && !theme.isCustom && { color: '#3f2052', textShadowColor: 'transparent', textShadowRadius: 0 }]}>{actionLabel}</Text>
        {showProgress ? <ActivityIndicator color={theme.isCustom ? theme.palette.text : theme.isLight ? '#3f2052' : theme.color("#fff6f1", 'text')} size="small" /> : <SymbolView name="arrow.right" tintColor={theme.isCustom ? theme.palette.text : theme.isLight ? '#3f2052' : theme.color("#fff6f1", 'text')} size={ipadHeader ? 25 : 31} />}
      </View>
    </View>
  </Pressable></Reanimated.View>;
}
function HomeRecorderStartPortalAtmosphere() {
  const theme = useAppTheme();
  const styles = useThemedStyles(darkStyles);

  return <Svg pointerEvents="none" viewBox="0 0 360 360" preserveAspectRatio="none" style={styles.homeRecorderStartPortalAtmosphere}>
    <Defs>
      <SvgRadialGradient id="startPortalGlass" cx="50%" cy="45%" rx="49%" ry="45%">
        <Stop offset="0" stopColor={theme.isCustom ? theme.palette.card : theme.isLight ? '#faf4ff' : theme.color("#07050d", 'accent')} stopOpacity="0.68" />
        <Stop offset="0.56" stopColor={theme.isCustom ? theme.palette.card : theme.isLight ? '#faf4ff' : theme.color("#090610", 'accent')} stopOpacity="0.46" />
        <Stop offset="0.78" stopColor={theme.isCustom ? theme.palette.card : theme.isLight ? '#faf4ff' : theme.color("#0b0712", 'accent')} stopOpacity="0.11" />
        <Stop offset="0.88" stopColor={theme.color("#0b0712", 'accent')} stopOpacity="0" />
        <Stop offset="1" stopColor={theme.color("#0b0712", 'accent')} stopOpacity="0" />
      </SvgRadialGradient>
      <SvgRadialGradient id="startPortalCoral" cx="50%" cy="54%" rx="82%" ry="78%" fx="50%" fy="70%">
        <Stop offset="0" stopColor={theme.isCustom ? theme.palette.accent : theme.isLight ? '#b78dd7' : theme.color("#ff405f", 'accent')} stopOpacity="0.62" />
        <Stop offset="0.35" stopColor={theme.isCustom ? theme.palette.accent : theme.isLight ? '#bda0dc' : theme.color("#ff4f66", 'accent')} stopOpacity="0.42" />
        <Stop offset="0.68" stopColor={theme.isCustom ? theme.palette.accent : theme.isLight ? '#b995d1' : theme.color("#ff7654", 'accent')} stopOpacity="0.18" />
        <Stop offset="1" stopColor={theme.isCustom ? theme.palette.accent : theme.isLight ? '#b995d1' : theme.color("#ff7654", 'accent')} stopOpacity="0.10" />
      </SvgRadialGradient>
      <SvgRadialGradient id="startPortalHalo" cx="50%" cy="30%" rx="34%" ry="25%">
        <Stop offset="0" stopColor={theme.isCustom ? theme.palette.accent : theme.isLight ? '#985ac0' : theme.color("#ff795b", 'accent')} stopOpacity="0.12" />
        <Stop offset="0.82" stopColor={theme.isCustom ? theme.palette.accent : theme.isLight ? '#985ac0' : theme.color("#ff795b", 'accent')} stopOpacity="0" />
        <Stop offset="1" stopColor={theme.isCustom ? theme.palette.accent : theme.isLight ? '#985ac0' : theme.color("#ff795b", 'accent')} stopOpacity="0" />
      </SvgRadialGradient>
    </Defs>
    <Rect width="360" height="360" fill="url(#startPortalGlass)" />
    <Rect width="360" height="360" rx="30" ry="30" fill="url(#startPortalCoral)" />
    <Rect width="360" height="360" fill="url(#startPortalHalo)" />
  </Svg>;
}
function HomeRecorderPrimaryAction({ label, symbol, onPress, disabled }: { label: string; symbol: SFSymbol; onPress: () => void; disabled?: boolean }) {
  const theme = useAppTheme();
  const styles = useThemedStyles(darkStyles);

  return <Pressable disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.homeRecorderPrimary, pressed && styles.homeRecorderPressed]}>
    <LinearGradient colors={theme.isCustom ? [theme.palette.accent, theme.palette.accent] : theme.gradient(['#ff7654', '#ff376f'])} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
    <View style={styles.homeRecorderPrimaryIcon}><SymbolView name={symbol} tintColor={theme.isCustom ? theme.palette.onAccent : theme.color("#fff4ee", 'text')} size={26} /></View>
    <Text style={[styles.homeRecorderPrimaryText, theme.isCustom && { color: theme.palette.onAccent }]}>{label}</Text>
    <Text style={[styles.homeRecorderPrimaryArrow, theme.isCustom && { color: theme.palette.onAccent }]}>›</Text>
  </Pressable>;
}
function SyncStatus({ stage }: { stage: Exclude<SyncStage, 'idle'> }) {
  const theme = useAppTheme();
  const styles = useThemedStyles(darkStyles);

  const presentation = syncPresentation(stage);
  return <View style={[styles.syncCard, { borderColor: theme.color(presentation.color, 'border') }]} accessible accessibilityLabel={`${presentation.title}. ${presentation.detail}`}>
    {presentation.spinning ? <ActivityIndicator color={theme.color(presentation.color, 'text')} /> : <View style={[styles.syncDot, { backgroundColor: theme.color(presentation.color, 'surface') }]} />}
    <View style={styles.syncCopy}><Text style={[styles.syncTitle, { color: theme.color(presentation.color, 'text') }]}>{presentation.title}</Text><Text style={styles.syncDetail}>{presentation.detail}</Text></View>
  </View>;
}

const darkStyles = StyleSheet.create({
  atmosphere: { position: 'absolute', top: -45, left: -20, right: -20, height: 1250 },
  flex: { flex: 1 }, safeArea: { flex: 1, backgroundColor: '#08070d' }, content: { padding: 20, paddingTop: 34, paddingBottom: 48, gap: 18 },
  homeRecorderStack: { gap: 16 },
  homeRecorderCard: { overflow: 'hidden', borderRadius: 25, borderWidth: 1, borderColor: 'rgba(190,168,194,0.44)', backgroundColor: 'rgba(9,8,14,0.86)', paddingHorizontal: 18, paddingVertical: 20, shadowColor: '#bc6aff', shadowOpacity: 0.15, shadowRadius: 22, shadowOffset: { width: 0, height: 10 } },
  journeySavedMoment: { minHeight: 330, overflow: 'hidden', borderRadius: 26, padding: 18, gap: 15, shadowColor: '#bc6aff', shadowOpacity: 0.3, shadowRadius: 24, shadowOffset: { width: 0, height: 12 } },
  journeySavedHeader: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  journeySavedCheck: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: '#b4ff68', shadowColor: '#b4ff68', shadowOpacity: 0.75, shadowRadius: 15 },
  journeySavedEyebrow: { color: '#b4ff68', fontSize: 10, fontWeight: '900', letterSpacing: 2.1 },
  journeySavedTitle: { color: '#fffaff', fontSize: 21, lineHeight: 25, fontWeight: '800' },
  journeySavedMetrics: { flexDirection: 'row', gap: 8 },
  journeySavedMetric: { flex: 1, minHeight: 66, alignItems: 'center', justifyContent: 'center', borderRadius: 15, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(206,179,219,0.28)', backgroundColor: 'rgba(8,6,12,0.42)' },
  journeySavedMetricValue: { color: '#fffaff', fontSize: 17, lineHeight: 22, fontWeight: '900', fontVariant: ['tabular-nums'] },
  journeySavedMetricLabel: { color: '#ad99b8', fontSize: 8, fontWeight: '900', letterSpacing: 1.05, marginTop: 3 },
  journeySavedDismiss: { minHeight: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: 'rgba(180,255,104,0.12)', borderWidth: 1, borderColor: 'rgba(180,255,104,0.32)' },
  journeySavedDismissText: { color: '#d9ffb7', fontSize: 12, fontWeight: '900', letterSpacing: 0.7 },
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
  homeRecorderStartPortalIpadFrame: { width: '100%', maxWidth: '100%', height: 190 },
  homeRecorderStartPortalIpad: { width: '100%', minHeight: 190, flex: 1 },
  homeRecorderStartPortalPressed: { transform: [{ scale: 0.992 }] },
  homeRecorderStartPortalCanvas: { flex: 1, alignItems: 'center', paddingHorizontal: 20, paddingTop: 32, paddingBottom: 24 },
  homeRecorderStartPortalCanvasIpad: { paddingHorizontal: 12, paddingTop: 12, paddingBottom: 10, justifyContent: 'space-between' },
  homeRecorderStartPortalAtmosphere: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  homeRecorderStartPortalLightClip: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, borderRadius: 30, overflow: 'hidden' },
  homeRecorderStartPortalLight: { position: 'absolute', top: -70, bottom: -70, left: '50%', width: 130 },
  homeRecorderStartPortalOutline: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, borderRadius: 30, borderWidth: 1, borderColor: 'rgba(255,126,88,0.92)', shadowColor: '#ff704f', shadowOpacity: 0.72, shadowRadius: 9, shadowOffset: { width: 0, height: 0 } },
  homeRecorderStartPortalStatus: { alignItems: 'center' },
  homeRecorderStartPortalPulseOuter: { width: 116, height: 116, borderRadius: 58, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,123,91,0.30)', backgroundColor: 'rgba(255,102,79,0.035)' },
  homeRecorderStartPortalPulseOuterIpad: { width: 70, height: 70, borderRadius: 35 },
  homeRecorderStartPortalPulseMiddle: { width: 78, height: 78, borderRadius: 39, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,123,91,0.55)', backgroundColor: 'rgba(255,102,79,0.055)' },
  homeRecorderStartPortalPulseMiddleIpad: { width: 48, height: 48, borderRadius: 24 },
  homeRecorderStartPortalPulseCore: { width: 37, height: 37, borderRadius: 19, backgroundColor: '#ff8060', shadowColor: '#ff654f', shadowOpacity: 1, shadowRadius: 19 },
  homeRecorderStartPortalPulseCoreIpad: { width: 23, height: 23, borderRadius: 12, shadowRadius: 13 },
  homeRecorderStartPortalEyebrow: { color: '#ff8b69', fontSize: 14, fontWeight: '800', letterSpacing: 3.2, marginTop: 20 },
  homeRecorderStartPortalEyebrowIpad: { fontSize: 10, letterSpacing: 2.4, marginTop: 5 },
  homeRecorderStartPortalBody: { color: '#c4b7c4', fontSize: 14, lineHeight: 20, marginTop: 7, textAlign: 'center' },
  homeRecorderStartPortalBodyIpad: { fontSize: 11, lineHeight: 14, marginTop: 2 },
  homeRecorderStartPortalAction: { flex: 1, minHeight: 112, alignItems: 'center', justifyContent: 'center', gap: 13, paddingTop: 19 },
  homeRecorderStartPortalActionIpad: { minHeight: 42, flex: 0, flexDirection: 'row', gap: 9, paddingTop: 3 },
  homeRecorderStartPortalTitle: { color: '#fff8f5', fontSize: 26, fontWeight: '500', textAlign: 'center', textShadowColor: 'rgba(255,90,79,0.45)', textShadowRadius: 12 },
  homeRecorderStartPortalTitleIpad: { fontSize: 20 },
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
