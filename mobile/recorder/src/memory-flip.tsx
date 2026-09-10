import { cloneElement, createContext, forwardRef, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactElement, type ReactNode } from 'react';
import { Image, Modal, Platform, StyleSheet, View, useWindowDimensions, type PressableProps } from 'react-native';
import { router } from 'expo-router';
import { captureRef, releaseCapture } from 'react-native-view-shot';
import Animated, { cancelAnimation, Easing, Extrapolation, interpolate, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { useAppTheme } from './app-theme';
import { useMotionPreferences } from './motion';
import { haptics } from './haptics';
import { useJourneyDeckNavigation } from './native-navigation-context';

type Frame = { x: number; y: number; width: number; height: number };
type Request = { id: string; node: View; hide: (hidden: boolean) => void; fallback: () => void };
type Session = Request & { token: string; frame: Frame; uri: string; window: { width: number; height: number } };
type FlipContext = { open: (request: Request) => void; activeToken?: string; destinationReady: (token: string) => void };
const MemoryFlipContext = createContext<FlipContext | null>(null);
export const MemoryFlipImageContext = createContext(false);
export const useMemoryFlip = () => useContext(MemoryFlipContext);
const ease = Easing.bezier(0.77, 0, 0.175, 1);
const measure = (node: View) => new Promise<Frame>(resolve => node.measureInWindow((x, y, width, height) => resolve({ x, y, width, height })));
const valid = (frame: Frame) => Object.values(frame).every(Number.isFinite) && frame.width > 0 && frame.height > 0;

/** Memory-only trial. The native route remains the real destination, so its
 * editors, share sheets, nested journeys and edge-back gesture stay native. */
export function MemoryFlipProvider({ children }: { children: ReactNode }) {
  const { memory } = useJourneyDeckNavigation();
  const { width, height } = useWindowDimensions();
  const { isAppActive } = useMotionPreferences();
  const current = useRef<Session | null>(null);
  const serial = useRef(0);
  const busy = useRef(false);
  const navigated = useRef(false);
  const [session, setSession] = useState<Session | null>(null);
  const [visible, setVisible] = useState(true);
  const finish = useCallback(() => {
    serial.current++;
    const old = current.current;
    current.current = null;
    old?.hide(false);
    if (old) releaseCapture(old.uri);
    busy.current = false;
    setSession(null);
  }, []);
  useEffect(() => () => {
    serial.current++;
    if (current.current) releaseCapture(current.current.uri);
  }, []);
  useEffect(() => {
    if (!isAppActive || (session && (session.window.width !== width || session.window.height !== height))) finish();
  }, [isAppActive, width, height, session, finish]);
  const open = useCallback(async (request: Request) => {
    if (busy.current || !isAppActive) return;
    busy.current = true;
    navigated.current = false;
    const attempt = ++serial.current;
    let uri: string | undefined;
    const releasePendingCapture = () => {
      if (uri) { releaseCapture(uri); uri = undefined; }
    };
    const captureTimeout = setTimeout(() => {
      releasePendingCapture();
      if (attempt !== serial.current) return;
      serial.current++;
      busy.current = false;
      request.fallback();
    }, 5000);
    try {
      const frame = await measure(request.node);
      if (attempt !== serial.current) return;
      if (!valid(frame)) throw new Error('Unmeasurable memory');
      // Capture only the tapped card, never the screen/library. This preserves
      // the exact loaded photo and typography without remounting a loading face.
      uri = await captureRef(request.node, { format: 'png', result: 'tmpfile' });
      if (attempt !== serial.current) { releasePendingCapture(); return; }
      const after = await measure(request.node);
      if (attempt !== serial.current) { releasePendingCapture(); return; }
      if (!valid(after) || Object.keys(frame).some(key => Math.abs(frame[key as keyof Frame] - after[key as keyof Frame]) > 1)) throw new Error('Memory moved during capture');
      const next = { ...request, token: String(attempt), frame, uri, window: { width, height } };
      current.current = next;
      setVisible(true);
      setSession(next);
    } catch {
      releasePendingCapture();
      if (attempt === serial.current) { busy.current = false; request.fallback(); }
    } finally {
      clearTimeout(captureTimeout);
    }
  }, [isAppActive, width, height]);
  const navigate = useCallback(() => {
    const active = current.current;
    if (!active || navigated.current) return;
    navigated.current = true;
    router.push({ pathname: '/memory/[id]', params: { id: active.id, memoryFlip: active.token } });
  }, []);
  const destinationReady = useCallback((token: string) => {
    if (current.current?.token !== token || !navigated.current) return;
    // The destination has laid out AND displayed its hero image. Keep the
    // completed face visible until that native content can replace it.
    setVisible(false);
    if (Platform.OS !== 'ios') finish();
  }, [finish]);
  useEffect(() => {
    if (!session) return;
    // A failed image decode/navigation must never strand a blocking overlay.
    const timeout = setTimeout(() => { if (current.current?.token === session.token) { navigate(); finish(); } }, 10000);
    return () => clearTimeout(timeout);
  }, [session, navigate, finish]);
  const context = useMemo(() => ({ open, activeToken: session?.token, destinationReady }), [open, session?.token, destinationReady]);
  return <MemoryFlipContext.Provider value={context}>{children}
    {session && <MemoryFlipModal key={session.token} session={session} visible={visible} renderMemory={memory}
      onOpened={() => { if (current.current?.token === session.token) navigate(); }}
      onCancelled={() => { if (current.current?.token === session.token) finish(); }}
      onDismiss={() => { if (current.current?.token === session.token) finish(); }} />}
  </MemoryFlipContext.Provider>;
}

/** Forward the native menu's ref, but consume its tap so AppleZoom and the
 * imperative fallback cannot also open a second screen. No pressed whitening. */
export const MemoryFlipPressable = forwardRef<View, PressableProps & {
  card: ReactElement<PressableProps>; memoryId: string; onSelect?: () => void;
}>(function MemoryFlipPressable({ card, memoryId, onSelect, style: _linkStyle, onPress: _linkPress, ...linkProps }, forwardedRef) {
  const flip = useMemoryFlip();
  const node = useRef<View | null>(null);
  const mounted = useRef(true);
  const [hidden, setHidden] = useState(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const baseStyle = typeof card.props.style === 'function' ? card.props.style({ pressed: false }) : card.props.style;
  return cloneElement(card, {
    ...linkProps,
    ref: (value: View | null) => {
      node.current = value;
      if (typeof forwardedRef === 'function') forwardedRef(value);
      else if (forwardedRef) forwardedRef.current = value;
    },
    collapsable: false,
    style: [baseStyle, hidden && { opacity: 0 }],
    onPressIn: undefined, onPressOut: undefined,
    accessibilityHint: 'Double tap to flip open. Touch and hold for actions.',
    onPress: event => {
      event?.preventDefault?.();
      if (!flip || !node.current) { card.props.onPress?.(event); return; }
      flip.open({ id: memoryId, node: node.current,
        hide: value => { if (mounted.current) setHidden(value); if (value) onSelect?.(); },
        fallback: () => { if (mounted.current) card.props.onPress?.(event); },
      });
    },
  } as PressableProps & { ref: (value: View | null) => void });
});

function MemoryFlipModal({ session, visible, renderMemory, onOpened, onCancelled, onDismiss }: {
  session: Session; visible: boolean; renderMemory: (id: string, onReady?: () => void) => ReactNode;
  onOpened: () => void; onCancelled: () => void; onDismiss: () => void;
}) {
  const theme = useAppTheme();
  const { reduceMotion } = useMotionPreferences();
  const progress = useSharedValue(0);
  const ready = useRef({ shown: false, front: false, back: false, started: false, closing: false, opened: false });
  const { frame: source, window: target } = session;
  const dx = target.width / 2 - (source.x + source.width / 2);
  const dy = target.height / 2 - (source.y + source.height / 2);
  useEffect(() => () => cancelAnimation(progress), [progress]);
  const opened = () => { if (!ready.current.closing) { ready.current.opened = true; onOpened(); } };
  const start = (part: 'shown' | 'front' | 'back') => {
    const state = ready.current;
    state[part] = true;
    if (!state.shown || !state.front || !state.back || state.started || state.closing) return;
    state.started = true;
    session.hide(true);
    progress.set(withTiming(1, { duration: reduceMotion ? 180 : 650, easing: ease }, finished => {
      'worklet';
      if (finished) scheduleOnRN(opened);
    }));
    void haptics.softImpact();
  };
  const close = () => {
    if (ready.current.closing || ready.current.opened) return;
    ready.current.closing = true;
    progress.set(withTiming(0, { duration: reduceMotion ? 150 : 520, easing: ease }, finished => {
      'worklet';
      if (finished) scheduleOnRN(onCancelled);
    }));
  };
  // Exact approved Atlas Flip geometry: the two faces share the same center
  // and displayed size at every point, including the edge-on crossover.
  const backdrop = useAnimatedStyle(() => ({ opacity: interpolate(progress.get(), [0, .35, 1], [0, .7, .78]) }));
  const front = useAnimatedStyle(() => ({
    opacity: reduceMotion ? 0 : interpolate(progress.get(), [0, .46, .54], [1, 1, 0], Extrapolation.CLAMP),
    transform: [{ perspective: 900 },
      { translateX: interpolate(progress.get(), [0, 1], [0, dx]) },
      { translateY: interpolate(progress.get(), [0, 1], [0, dy]) },
      { rotateY: `${interpolate(progress.get(), [0, 1], [0, 180])}deg` },
      { scaleX: interpolate(progress.get(), [0, 1], [1, target.width / source.width]) },
      { scaleY: interpolate(progress.get(), [0, 1], [1, target.height / source.height]) }],
  }));
  const back = useAnimatedStyle(() => ({
    opacity: reduceMotion ? progress.get() : interpolate(progress.get(), [0, .46, .54, 1], [0, 0, 1, 1], Extrapolation.CLAMP),
    transform: [{ perspective: 900 },
      { translateX: reduceMotion ? 0 : interpolate(progress.get(), [0, 1], [-dx, 0]) },
      { translateY: reduceMotion ? 0 : interpolate(progress.get(), [0, 1], [-dy, 0]) },
      { rotateY: reduceMotion ? '0deg' : `${interpolate(progress.get(), [0, 1], [-180, 0])}deg` },
      { scaleX: reduceMotion ? interpolate(progress.get(), [0, 1], [.96, 1]) : interpolate(progress.get(), [0, 1], [source.width / target.width, 1]) },
      { scaleY: reduceMotion ? interpolate(progress.get(), [0, 1], [.96, 1]) : interpolate(progress.get(), [0, 1], [source.height / target.height, 1]) }],
  }));
  return <Modal visible={visible} transparent statusBarTranslucent navigationBarTranslucent supportedOrientations={['portrait', 'portrait-upside-down', 'landscape-left', 'landscape-right']} animationType="none" onShow={() => start('shown')} onRequestClose={close} onDismiss={onDismiss}>
    <View style={StyleSheet.absoluteFill} accessibilityViewIsModal>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: theme.color('#08050dcc', 'surface') }, backdrop]} />
      <View testID="memory-flip-foreground" collapsable={false} pointerEvents="none" style={styles.foreground}>
        <Animated.View testID="memory-flip-front" style={[styles.face, { left: source.x, top: source.y, width: source.width, height: source.height }, front]}>
          <Image source={{ uri: session.uri }} resizeMode="stretch" onLoad={() => start('front')} onError={onCancelled} style={StyleSheet.absoluteFill} />
        </Animated.View>
        <Animated.View testID="memory-flip-back" style={[styles.face, { left: 0, top: 0, width: target.width, height: target.height, backgroundColor: theme.palette.page }, back]}>
          <MemoryFlipImageContext.Provider value>{renderMemory(session.id, () => start('back'))}</MemoryFlipImageContext.Provider>
        </Animated.View>
      </View>
    </View>
  </Modal>;
}

const styles = StyleSheet.create({
  foreground: { ...StyleSheet.absoluteFill, zIndex: 1 },
  face: { position: 'absolute', backfaceVisibility: 'hidden', overflow: 'hidden' },
});
