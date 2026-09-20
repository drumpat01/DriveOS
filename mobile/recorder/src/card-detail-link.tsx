import { cloneElement, createContext, forwardRef, useContext, type ReactElement, type ReactNode } from 'react';
import { Platform, type PressableProps, type View } from 'react-native';
import { Link, usePreventZoomTransitionDismissal } from 'expo-router';
import type { SFSymbol } from 'expo-symbols';
import { openJourneyCardAction } from './journey-card-action';
import { useMotionPreferences } from './motion';
import { MemoryFlipPressable, useMemoryFlip } from './memory-flip';

export type CardContextAction = { id: string; title: string; icon: SFSymbol; onPress: () => void };

const CardZoomContext = createContext(false);

export function useCardDetailDismissal() {
  // Keep the familiar edge-back gesture; map pans and content scrolling must
  // not turn into whole-screen interactive dismissal.
  usePreventZoomTransitionDismissal({ unstable_dismissalBoundsRect: { maxX: 32 } });
}

/** One accessibility subscription for the entire retained navigation tree. */
export function CardMotionProvider({ children }: { children: ReactNode }) {
  const { reduceMotion } = useMotionPreferences();
  const enabled = Platform.OS === 'ios' && Number.parseInt(String(Platform.Version), 10) >= 18 && !reduceMotion;
  return <CardZoomContext.Provider value={enabled}>{children}</CardZoomContext.Provider>;
}

/** The mounted Link owns its source identity, including the return transition. */
export function CardDetailLink({ kind, id, children, onSelect, actions }: {
  kind: 'journey' | 'memory'; id: string | null | undefined;
  children: ReactElement<PressableProps>; onSelect?: () => void; actions?: CardContextAction[];
}) {
  const enabled = useContext(CardZoomContext);
  const memoryFlip = useMemoryFlip();
  if (!id || children.props.disabled) return children;
  const menuActions = actions ?? (kind === 'journey' ? [
    { id: 'edit', title: 'Edit locations', icon: 'pencil' as const, onPress: () => openJourneyCardAction(id, 'edit') },
    { id: 'share', title: 'Create share card', icon: 'square.and.arrow.up' as const, onPress: () => openJourneyCardAction(id, 'share') },
  ] : []);
  const hasMenu = Platform.OS === 'ios' && menuActions.length > 0;
  const flipMemory = kind === 'memory' && memoryFlip !== null;
  if (!enabled && !hasMenu && !flipMemory) return children;
  const card = flipMemory ? <MemoryFlipPressable card={children} memoryId={id} onSelect={onSelect} />
    : <ZoomCardPressable card={children} onSelect={onSelect} useOriginalPress={!enabled} hasMenu={hasMenu} />;
  const trigger = enabled && !flipMemory ? <Link.AppleZoom>{card}</Link.AppleZoom> : card;
  return <Link href={{ pathname: kind === 'journey' ? '/journey/[id]' : '/memory/[id]', params: { id } }} asChild>
    {hasMenu ? <Link.Trigger>{trigger}</Link.Trigger> : trigger}
    {hasMenu && <Link.Menu>{menuActions.map(action => <Link.MenuAction key={action.id} icon={action.icon} onPress={action.onPress}>{action.title}</Link.MenuAction>)}</Link.Menu>}
  </Link>;
}

// Expo's asChild Slot spreads style props as objects. Keep the original
// Pressable (including its style callback) behind this forwarding component.
const ZoomCardPressable = forwardRef<View, PressableProps & {
  card: ReactElement<PressableProps>; onSelect?: () => void; useOriginalPress: boolean; hasMenu: boolean;
}>(function ZoomCardPressable({ card, onSelect, useOriginalPress, hasMenu, style: _linkStyle, onPress, ...linkProps }, ref) {
  return cloneElement(card, {
    ...linkProps, ref, style: card.props.style, collapsable: false,
    accessibilityHint: card.props.accessibilityHint ?? (hasMenu ? 'Double tap to open. Touch and hold for actions.' : undefined),
    onPress: event => {
      // Keep the original non-zoom path (including carousel selection/scroll).
      if (useOriginalPress) { event?.preventDefault?.(); card.props.onPress?.(event); }
      else { onSelect?.(); onPress?.(event); }
    },
  } as PressableProps & { ref: typeof ref });
});
