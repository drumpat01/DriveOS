import * as Haptics from 'expo-haptics';
import { AppState } from 'react-native';

import { createHapticDispatcher, type HapticCommand, type HapticIntent } from './haptics-system';

async function perform(command: HapticCommand) {
  if (command.kind === 'selection') return Haptics.selectionAsync();
  if (command.kind === 'impact') {
    return Haptics.impactAsync(command.style === 'soft' ? Haptics.ImpactFeedbackStyle.Soft : Haptics.ImpactFeedbackStyle.Medium);
  }
  const notificationType = command.type === 'success'
    ? Haptics.NotificationFeedbackType.Success
    : command.type === 'warning'
      ? Haptics.NotificationFeedbackType.Warning
      : Haptics.NotificationFeedbackType.Error;
  return Haptics.notificationAsync(notificationType);
}

const dispatchHaptic = createHapticDispatcher({
  perform,
  isActive: () => AppState.currentState === 'active',
});

export function triggerHaptic(intent: HapticIntent) {
  return dispatchHaptic(intent);
}

export const haptics = Object.freeze({
  selection: () => triggerHaptic('selection'),
  softImpact: () => triggerHaptic('soft-impact'),
  primaryAction: () => triggerHaptic('primary-action'),
  success: () => triggerHaptic('success'),
  warning: () => triggerHaptic('warning'),
  error: () => triggerHaptic('error'),
});
