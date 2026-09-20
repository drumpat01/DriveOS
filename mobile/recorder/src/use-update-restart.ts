import { useEffect, useRef } from 'react';
import { Alert, AppState } from 'react-native';
import * as Updates from 'expo-updates';
import { activeSession } from './storage';
import { getNativeAutomaticRecorderStatus } from '../modules/journeydeck-recorder';

type RestartReadiness = { ready: boolean; recorderState: string; recorderBusy: boolean };

/** A downloaded update is optional; an in-progress journey always takes priority. */
export function useUpdateRestart(readiness: RestartReadiness) {
  const update = Updates.useUpdates();
  const updateId = update.downloadedUpdate?.updateId ?? 'pending-update';
  const latest = useRef({ ...readiness, pending: update.isUpdatePending, updateId });
  latest.current = { ...readiness, pending: update.isUpdatePending, updateId };
  const announced = useRef<string | null>(null);
  const restarting = useRef(false);
  const mounted = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  useEffect(() => {
    if (!Updates.isEnabled || !update.isUpdatePending) return;
    let cancelled = false;
    const locallyReady = () => {
      const current = latest.current;
      return mounted.current && current.ready && current.pending && current.updateId === updateId
        && !current.recorderBusy && current.recorderState === 'ready'
        && AppState.currentState === 'active' && !activeSession();
    };
    const safeToRestart = async () => {
      if (!locallyReady()) return false;
      // Watch can start a journey before JS has imported its native inbox.
      const native = await getNativeAutomaticRecorderStatus();
      return (!native.nativeModuleAvailable || native.statusReliable !== false)
        && !native.recording && !native.paused && !native.sessionId && locallyReady();
    };
    const restart = async () => {
      if (!mounted.current || restarting.current) return;
      restarting.current = true;
      try {
        if (!(await safeToRestart())) {
          if (mounted.current) {
            announced.current = null;
            Alert.alert('Update can wait', 'Finish the current journey and wait for the recorder to be ready before restarting.');
          }
          return;
        }
        await Updates.reloadAsync();
      } catch {
        if (mounted.current) {
          announced.current = null;
          Alert.alert('Update will wait', 'JourneyDeck could not safely restart. Your downloaded update will be available on a later launch.');
        }
      } finally { restarting.current = false; }
    };
    const announce = async () => {
      if (cancelled || announced.current === updateId || restarting.current) return;
      try {
        if (!(await safeToRestart()) || cancelled || announced.current === updateId) return;
        announced.current = updateId;
        Alert.alert('JourneyDeck update ready', 'A new version has finished downloading. Restart JourneyDeck now to use it?', [
          { text: 'Later', style: 'cancel' },
          { text: 'Restart now', onPress: () => { void restart(); } },
        ]);
      } catch {
        // A failed status read must defer the optional update, not guess idle.
      }
    };
    void announce();
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') void announce(); });
    return () => { cancelled = true; subscription.remove(); };
  }, [readiness.ready, readiness.recorderState, readiness.recorderBusy, update.isUpdatePending, updateId]);
}
