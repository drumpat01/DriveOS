import { requireOptionalNativeModule } from 'expo';
import { randomUUID } from 'expo-crypto';
import { AppState } from 'react-native';
import { readAskSnapshot, currentAskProfile } from './ask-journeydeck-archive';
import { createLocalAskRuntime, type AskAnswer } from './ask-journeydeck-local';
import { prepareJourneyDeckDatabase } from './database-startup';
import { getActiveLocalUserId } from './local-store';
import { V3_ASK_JOURNEYDECK_ENABLED } from './release-features';

export type AskEvidence = { kind: 'journey' | 'memory'; id: string; label: string };
export type { AskAnswer } from './ask-journeydeck-local';
type NativeAsk = {
  askJourneyDeckAsync?: (question: string, userID: string, context: string | null) => Promise<AskAnswer>;
  resolveJourneyDeckAnswerAsync?: (ticket: string, userID: string) => Promise<AskAnswer>;
  planJourneyDeckQuestionAsync?: (question: string, context: string, now: number) => Promise<Record<string, unknown> | null>;
};
const native = requireOptionalNativeModule<NativeAsk>('JourneyDeckRecorder');
const local = createLocalAskRuntime({
  profile: currentAskProfile,
  snapshot: readAskSnapshot,
  planner: native?.planJourneyDeckQuestionAsync?.bind(native),
  isActive: () => AppState.currentState === 'active',
  uuid: randomUUID,
  now: Date.now,
});
AppState.addEventListener('change', state => { if (state !== 'active') local.clear(); });
export const isAskJourneyDeckAvailable = V3_ASK_JOURNEYDECK_ENABLED && Boolean(native?.askJourneyDeckAsync && native?.resolveJourneyDeckAnswerAsync);
export const ASK_EXAMPLES = ['How many miles did I drive this week?', 'When was my last journey?', 'What was my top artist this month?'];

export async function askJourneyDeck(userID: string, question: string, context?: string): Promise<AskAnswer> {
  if (!isAskJourneyDeckAvailable) return unavailable();
  assertProfile(userID);
  await prepareJourneyDeckDatabase();
  const answer = await local.ask(userID, question, context) ?? await native!.askJourneyDeckAsync!(question, userID, context ?? null);
  assertProfile(userID);
  assertAnswerProfile(answer, userID);
  return answer;
}
export async function resolveJourneyDeckAnswer(userID: string, ticket: string): Promise<AskAnswer> {
  if (!isAskJourneyDeckAvailable) return unavailable();
  assertProfile(userID);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(ticket)) return { status: 'unavailable', text: 'This answer link is invalid. Ask a new question.', evidence: [] };
  await prepareJourneyDeckDatabase();
  const answer = await local.resolve(userID, ticket) ?? await native!.resolveJourneyDeckAnswerAsync!(ticket, userID);
  assertProfile(userID);
  assertAnswerProfile(answer, userID);
  return answer;
}
function assertProfile(userID: string) {
  if (getActiveLocalUserId() !== userID) throw new Error('The active profile changed. Ask your question again.');
}
function assertAnswerProfile(answer: AskAnswer, userID: string) {
  if (answer.status === 'answered' && answer.profileId !== userID) throw new Error('The answer belongs to a different profile. Ask again.');
}
function unavailable(): AskAnswer {
  return { status: 'unavailable', text: 'Ask JourneyDeck needs the new V3 native preview. This installed version does not include its question engine yet.', evidence: [] };
}
