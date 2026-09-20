import { requireOptionalNativeModule } from 'expo';
import { isInternalTestingBuild } from './internal-testing';
import { V3_ASK_JOURNEYDECK_ENABLED } from './release-features';

export type SiriTestCase = { id: string; question: string };
export type SiriTestResult = { status: 'passed' | 'failed' | 'unavailable' | 'cancelled'; detail: string; question?: string; elapsedMs?: number; answer?: string; plan?: Record<string, unknown> | null; proposedPlan?: Record<string, unknown>; normalizedPlan?: Record<string, unknown>; expectedPlan?: Record<string, unknown>; validationErrors?: string[] };
export type SiriAIStatus = { model: string; testing: boolean; engineVersion: number; plannerRevision?: number; timeoutSeconds: number };
type NativeTesting = {
  journeyDeckAIStatusAsync?: () => Promise<SiriAIStatus>;
  journeyDeckEvaluationCasesAsync?: () => Promise<SiriTestCase[]>;
  evaluateJourneyDeckCaseAsync?: (id: string) => Promise<SiriTestResult>;
  cancelJourneyDeckEvaluationAsync?: () => Promise<void>;
};
const native = requireOptionalNativeModule<NativeTesting>('JourneyDeckRecorder');
export const canShowSiriTesting = V3_ASK_JOURNEYDECK_ENABLED && isInternalTestingBuild();
export const siriTesting = {
  async status(): Promise<SiriAIStatus> {
    return canShowSiriTesting && native?.journeyDeckAIStatusAsync ? native.journeyDeckAIStatusAsync()
      : { model: 'newNativeBuildRequired', testing: false, engineVersion: 0, timeoutSeconds: 30 };
  },
  async cases(): Promise<SiriTestCase[]> {
    return canShowSiriTesting && native?.journeyDeckEvaluationCasesAsync ? native.journeyDeckEvaluationCasesAsync() : [];
  },
  async run(id: string): Promise<SiriTestResult> {
    if (!canShowSiriTesting || !native?.evaluateJourneyDeckCaseAsync) return { status: 'unavailable', detail: 'Install the new internal V3 native build.' };
    return native.evaluateJourneyDeckCaseAsync(id);
  },
  async cancel(): Promise<void> { if (canShowSiriTesting) await native?.cancelJourneyDeckEvaluationAsync?.(); },
};
