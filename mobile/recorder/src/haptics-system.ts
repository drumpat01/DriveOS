export type HapticIntent = 'selection' | 'soft-impact' | 'primary-action' | 'success' | 'warning' | 'error';

export type HapticCommand =
  | Readonly<{ kind: 'selection' }>
  | Readonly<{ kind: 'impact'; style: 'soft' | 'medium' }>
  | Readonly<{ kind: 'notification'; type: 'success' | 'warning' | 'error' }>;

export const HAPTIC_COMMANDS: Readonly<Record<HapticIntent, HapticCommand>> = Object.freeze({
  selection: Object.freeze({ kind: 'selection' }),
  'soft-impact': Object.freeze({ kind: 'impact', style: 'soft' }),
  'primary-action': Object.freeze({ kind: 'impact', style: 'medium' }),
  success: Object.freeze({ kind: 'notification', type: 'success' }),
  warning: Object.freeze({ kind: 'notification', type: 'warning' }),
  error: Object.freeze({ kind: 'notification', type: 'error' }),
});

const INTENT_COOLDOWNS: Readonly<Record<HapticIntent, number>> = Object.freeze({
  selection: 60,
  'soft-impact': 100,
  'primary-action': 140,
  success: 180,
  warning: 180,
  error: 180,
});

export function createHapticDispatcher({
  perform,
  isActive = () => true,
  now = Date.now,
}: {
  perform: (command: HapticCommand) => Promise<void> | void;
  isActive?: () => boolean;
  now?: () => number;
}) {
  const lastTriggeredAt = new Map<HapticIntent, number>();

  return async (intent: HapticIntent) => {
    if (!isActive()) return false;
    const currentTime = now();
    const elapsed = currentTime - (lastTriggeredAt.get(intent) ?? Number.NEGATIVE_INFINITY);
    if (elapsed >= 0 && elapsed < INTENT_COOLDOWNS[intent]) return false;
    lastTriggeredAt.set(intent, currentTime);
    try {
      await perform(HAPTIC_COMMANDS[intent]);
      return true;
    } catch {
      return false;
    }
  };
}
