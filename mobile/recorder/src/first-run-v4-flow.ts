// The V4 onboarding's four steps and how saved progress maps onto them. Pure, so it can be tested directly.
import type { FirstRunStage } from './first-run-onboarding';

export type V4Stage = 'welcome' | 'location' | 'music' | 'photos';
export const V4_STEPS: readonly V4Stage[] = ['welcome', 'location', 'music', 'photos'];

/** Older saved progress (the 9-step flow) resumes at the nearest V4 step. */
export function v4Stage(stage: Exclude<FirstRunStage, 'complete'>): V4Stage {
  switch (stage) {
    case 'welcome': return 'welcome';
    case 'recording': case 'location': return 'location';
    case 'places': case 'music': return 'music';
    default: return 'photos';
  }
}

export function nextV4Stage(stage: V4Stage): V4Stage | 'complete' {
  const index = V4_STEPS.indexOf(stage);
  return V4_STEPS[index + 1] ?? 'complete';
}

export function previousV4Stage(stage: V4Stage): V4Stage | null {
  const index = V4_STEPS.indexOf(stage);
  return index > 0 ? V4_STEPS[index - 1]! : null;
}
