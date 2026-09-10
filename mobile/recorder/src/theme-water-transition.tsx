import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Modal, Platform, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Canvas, Fill, ImageShader, Shader, Skia, useImage } from '@shopify/react-native-skia';
import { captureScreen, releaseCapture } from 'react-native-view-shot';
import { cancelAnimation, Easing, useDerivedValue, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { type ThemeId } from './theme-catalog';
import { recordThemeAnimationEvent } from './theme-animation-diagnostics';
import { createWaterThemeSession, type WaterThemeFrame } from './theme-water-session';
import {
  WATER_RIPPLE_DURATION,
  waterRippleGeometry,
  type ThemeSnapshotFrame,
  type ThemeTransitionOrigin,
} from './theme-water-geometry';
import { useCoreMotion } from './use-core-motion';
import { THEME_WATER_SHADER_SOURCE } from './theme-water-shader';

export type { ThemeTransitionOrigin } from './theme-water-geometry';

type Snapshot = Readonly<{
  uri: string;
  captureUri: string;
  frame: ThemeSnapshotFrame;
  serial: number;
}>;

const WATER_EASE = Easing.linear;
const waterThemeEffect = (() => {
  try { return Skia.RuntimeEffect.Make(THEME_WATER_SHADER_SOURCE); }
  catch { return null; }
})();

const afterPaint = () => new Promise<void>(resolve => {
  requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
});

export function useWaterThemeTransition(
  id: ThemeId,
  persist: (next: ThemeId) => void,
  setTheme: (next: ThemeId) => void,
) {
  const mounted = useRef(true);
  const attemptSerial = useRef(0);
  const activeAttempt = useRef(0);
  const retainedCapture = useRef<{ uri: string; attempt: number } | null>(null);
  const motion = useCoreMotion();
  const window = useWindowDimensions();
  const previousWindow = useRef({ width: window.width, height: window.height });
  const [frame, setFrame] = useState<WaterThemeFrame<Snapshot> | null>(null);
  const commit = useRef<{ next: ThemeId; attempt: number; resolve: () => void } | null>(null);
  const latest = useRef({ id, persist, setTheme, motion, window });
  latest.current = { id, persist, setTheme, motion, window };

  const releaseRetainedCapture = useCallback(() => {
    const retained = retainedCapture.current;
    if (!retained) return;
    retainedCapture.current = null;
    setTimeout(() => {
      try {
        releaseCapture(retained.uri);
        recordThemeAnimationEvent('temporary_file_released', retained.attempt);
      } catch {
        recordThemeAnimationEvent('temporary_release_failed', retained.attempt);
      }
    }, 250);
  }, []);

  const [session] = useState(() => createWaterThemeSession<ThemeId, Snapshot>({
    current: () => latest.current.id,
    persist: next => {
      latest.current.persist(next);
      recordThemeAnimationEvent('preference_saved', activeAttempt.current, { theme: next });
    },
    canAnimate: () => {
      const allowed = Platform.OS !== 'web' && latest.current.motion.animate && waterThemeEffect !== null;
      recordThemeAnimationEvent('animation_decision', activeAttempt.current, {
        allowed,
        platform: Platform.OS,
        app_state: latest.current.motion.appState,
        reduce_motion: latest.current.motion.reduceMotion,
        reduce_transparency: latest.current.motion.reduceTransparency,
        renderer: 'skia_modal',
        shader_ready: waterThemeEffect !== null,
      });
      return allowed;
    },
    apply: next => new Promise<void>(resolve => {
      const attempt = activeAttempt.current;
      recordThemeAnimationEvent('theme_apply_start', attempt, { theme: next });
      if (!mounted.current) { resolve(); return; }
      commit.current?.resolve();
      if (latest.current.id === next) {
        recordThemeAnimationEvent('theme_already_committed', attempt, { theme: next });
        resolve();
        return;
      }
      commit.current = { next, attempt, resolve };
      latest.current.setTheme(next);
    }),
    capture: async () => {
      const attempt = activeAttempt.current;
      const bounds = latest.current.window;
      if (!mounted.current || bounds.width <= 0 || bounds.height <= 0) throw new Error('Theme surface unavailable');
      recordThemeAnimationEvent('capture_start', attempt);
      try {
        const captureUri = await captureScreen({ format: 'png', quality: 1, result: 'tmpfile' });
        recordThemeAnimationEvent('capture_complete', attempt);
        if (!mounted.current || activeAttempt.current !== attempt) {
          try { releaseCapture(captureUri); } catch {}
          recordThemeAnimationEvent('capture_abandoned', attempt);
          throw new Error('Theme transition no longer active');
        }
        retainedCapture.current = { uri: captureUri, attempt };
        const uri = captureUri.startsWith('file://') ? captureUri : `file://${encodeURI(captureUri)}`;
        return {
          uri,
          captureUri,
          frame: { x: 0, y: 0, width: bounds.width, height: bounds.height },
          serial: attempt,
        };
      } catch (error) {
        recordThemeAnimationEvent('capture_failed', attempt, {
          stage: 'native_capture',
          error_type: error instanceof Error ? error.name : 'unknown',
        });
        throw error;
      }
    },
    show: next => {
      recordThemeAnimationEvent(next.playing ? 'water_surface_requested' : 'cover_requested', next.before.serial, { renderer: 'skia_modal' });
      if (mounted.current) setFrame(next);
    },
    clear: () => {
      const attempt = activeAttempt.current;
      recordThemeAnimationEvent('overlay_cleared', attempt);
      activeAttempt.current = 0;
      if (mounted.current) setFrame(null);
      releaseRetainedCapture();
    },
  }));

  useLayoutEffect(() => {
    const pending = commit.current;
    if (pending?.next !== id) return;
    commit.current = null;
    recordThemeAnimationEvent('theme_committed', pending.attempt, { theme: id });
    void afterPaint().then(() => {
      recordThemeAnimationEvent('theme_painted', pending.attempt, { theme: id });
      pending.resolve();
    });
  }, [id]);

  useEffect(() => {
    if (!motion.animate && session.busy) {
      recordThemeAnimationEvent('transition_settled', activeAttempt.current, {
        reason: motion.isAppActive ? 'reduce_motion' : motion.appState,
      });
      session.settle();
    }
  }, [motion.animate, motion.appState, motion.isAppActive, session]);
  useEffect(() => {
    const previous = previousWindow.current;
    if (previous.width !== window.width || previous.height !== window.height) {
      if (session.busy) recordThemeAnimationEvent('transition_settled', activeAttempt.current, { reason: 'viewport_changed' });
      session.settle();
    }
    previousWindow.current = { width: window.width, height: window.height };
  }, [window.width, window.height, session]);
  useEffect(() => {
    mounted.current = true;
    session.activate();
    return () => {
      if (session.busy) recordThemeAnimationEvent('transition_disposed', activeAttempt.current);
      mounted.current = false;
      session.dispose();
      commit.current?.resolve();
      commit.current = null;
      releaseRetainedCapture();
    };
  }, [releaseRetainedCapture, session]);

  return {
    transitionTheme: (next: ThemeId, origin?: ThemeTransitionOrigin) => {
      if (next === latest.current.id || session.busy) {
        recordThemeAnimationEvent('request_ignored', activeAttempt.current, { reason: next === latest.current.id ? 'same_theme' : 'busy' });
        return;
      }
      const attempt = ++attemptSerial.current;
      activeAttempt.current = attempt;
      recordThemeAnimationEvent('request', attempt, { from: latest.current.id, to: next, has_origin: !!origin });
      try { session.start(next, origin); }
      catch (error) {
        recordThemeAnimationEvent('preference_save_failed', attempt, { error_type: error instanceof Error ? error.name : 'unknown' });
        activeAttempt.current = 0;
        throw error;
      }
    },
    settleTransition: () => {
      if (session.busy) recordThemeAnimationEvent('transition_settled', activeAttempt.current, { reason: 'direct_theme_change' });
      session.settle();
    },
    overlay: frame ? <WaterThemeOverlay key={frame.before.serial} frame={frame} reduceTransparency={motion.reduceTransparency} /> : null,
  };
}

export function WaterThemeOverlay({ frame, reduceTransparency }: {
  frame: WaterThemeFrame<Snapshot>;
  reduceTransparency: boolean;
}) {
  const { before, playing, onReady, onFinished } = frame;
  const geometry = useMemo(() => waterRippleGeometry(before.frame, frame.origin), [before.frame, frame.origin]);
  const progress = useSharedValue(0);
  const oldScene = useImage(before.uri);
  const readiness = useRef({ modal: false, image: false, scheduled: false, mounted: true });
  const uniforms = useDerivedValue(() => ({
    ...geometry,
    progress: progress.get(),
    refraction: reduceTransparency ? 0 : 1,
  }));

  const maybeReady = useCallback(() => {
    if (!readiness.current.mounted || readiness.current.scheduled || !readiness.current.modal || !readiness.current.image) return;
    readiness.current.scheduled = true;
    void afterPaint().then(() => {
      if (!readiness.current.mounted) return;
      recordThemeAnimationEvent('overlay_ready', before.serial, { renderer: 'skia_modal' });
      onReady();
    });
  }, [before.serial, onReady]);

  useEffect(() => {
    readiness.current.mounted = true;
    recordThemeAnimationEvent('modal_mounted', before.serial);
    return () => {
      readiness.current.mounted = false;
      recordThemeAnimationEvent('modal_unmounted', before.serial);
    };
  }, [before.serial]);

  useEffect(() => {
    if (!oldScene || readiness.current.image) return;
    readiness.current.image = true;
    recordThemeAnimationEvent('snapshot_image_loaded', before.serial, {
      image_width: oldScene.width(),
      image_height: oldScene.height(),
    });
    maybeReady();
  }, [before.serial, maybeReady, oldScene]);

  const finish = useCallback(() => {
    recordThemeAnimationEvent('water_finished', before.serial);
    onFinished();
  }, [before.serial, onFinished]);

  useEffect(() => {
    if (!playing) return;
    recordThemeAnimationEvent('water_started', before.serial, {
      duration_ms: WATER_RIPPLE_DURATION,
      reduce_transparency: reduceTransparency,
      renderer: 'skia_modal',
    });
    progress.set(withTiming(1, { duration: WATER_RIPPLE_DURATION, easing: WATER_EASE }, complete => {
      if (complete) scheduleOnRN(finish);
    }));
    return () => cancelAnimation(progress);
  }, [before.serial, finish, playing, progress, reduceTransparency]);

  return <Modal
    visible
    transparent
    animationType="none"
    presentationStyle="overFullScreen"
    statusBarTranslucent
    supportedOrientations={['portrait', 'portrait-upside-down', 'landscape-left', 'landscape-right']}
    onRequestClose={onFinished}
    onShow={() => {
      recordThemeAnimationEvent('modal_shown', before.serial);
      readiness.current.modal = true;
      maybeReady();
    }}
  >
    <View
      style={styles.window}
      pointerEvents="auto"
      onStartShouldSetResponder={() => true}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Canvas
        style={[styles.surface, {
          left: before.frame.x,
          top: before.frame.y,
          width: before.frame.width,
          height: before.frame.height,
        }]}
      >
        {waterThemeEffect && oldScene && <Fill>
          <Shader source={waterThemeEffect} uniforms={uniforms}>
            <ImageShader
              image={oldScene}
              fit="fill"
              tx="clamp"
              ty="clamp"
              x={0}
              y={0}
              width={before.frame.width}
              height={before.frame.height}
            />
          </Shader>
        </Fill>}
      </Canvas>
    </View>
  </Modal>;
}

const styles = StyleSheet.create({
  window: { flex: 1, backgroundColor: 'transparent' },
  surface: { position: 'absolute', overflow: 'hidden' },
});
