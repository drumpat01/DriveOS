// The V4 onboarding's four steps and how saved progress maps onto them. Pure, so it can be tested directly.
import type { FirstRunStage } from './first-run-onboarding';

export type V4Stage = 'welcome' | 'sync' | 'location' | 'music' | 'photos';
export const V4_STEPS: readonly V4Stage[] = ['welcome', 'location', 'music', 'photos'];
/** iPad only views what iPhone records: it signs in and syncs instead of setting up location and music. */
export const V4_IPAD_STEPS: readonly V4Stage[] = ['welcome', 'sync', 'photos'];
export const v4Steps = (ipad: boolean): readonly V4Stage[] => ipad ? V4_IPAD_STEPS : V4_STEPS;

/** Older saved progress (the 9-step flow) resumes at the nearest V4 step. */
export function v4Stage(stage: Exclude<FirstRunStage, 'complete'>, ipad = false): V4Stage {
  if (ipad) return stage === 'welcome' ? 'welcome' : ['photos', 'membership', 'tessie', 'instructions'].includes(stage) ? 'photos' : 'sync';
  switch (stage) {
    case 'sync': return 'music';
    case 'welcome': return 'welcome';
    case 'recording': case 'location': return 'location';
    case 'places': case 'music': return 'music';
    default: return 'photos';
  }
}

export function nextV4Stage(stage: V4Stage, ipad = false): V4Stage | 'complete' {
  const steps = v4Steps(ipad), index = steps.indexOf(stage);
  return steps[index + 1] ?? 'complete';
}

export function previousV4Stage(stage: V4Stage, ipad = false): V4Stage | null {
  const steps = v4Steps(ipad), index = steps.indexOf(stage);
  return index > 0 ? steps[index - 1]! : null;
}

/**
 * "I have an account" skips the welcome deck only. iPad has nothing else to set up, but an iPhone
 * still needs location and music on this device; ending there left the old pickers to ask instead.
 */
export function haveAccountStage(ipad = false): V4Stage | 'complete' {
  return ipad ? 'complete' : 'location';
}
