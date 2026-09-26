import { requireOptionalNativeModule } from 'expo';
import { prepareJourneyDeckDatabase } from './database-startup';
import { getActiveLocalUserId } from './local-store';
import { V3_ASK_JOURNEYDECK_ENABLED } from './release-features';

export type AskEvidence = { kind: 'journey' | 'memory'; id: string; label: string };
export type AskAnswer = {
  status: 'answered' | 'clarify' | 'historyLimited' | 'unavailable';
  text: string;
  evidence: AskEvidence[];
  ticket?: string;
  contextToken?: string;
  profileId?: string;
};
type NativeAsk = {
  askJourneyDeckAsync?: (question: string, userID: string, context: string | null) => Promise<AskAnswer>;
  resolveJourneyDeckAnswerAsync?: (ticket: string, userID: string) => Promise<AskAnswer>;
  journeyDeckAIStatusAsync?: () => Promise<{ model: string }>;
};
const native = requireOptionalNativeModule<NativeAsk>('JourneyDeckRecorder');
export const isAskJourneyDeckAvailable = V3_ASK_JOURNEYDECK_ENABLED && Boolean(native?.askJourneyDeckAsync && native?.resolveJourneyDeckAnswerAsync);
export const ASK_EXAMPLES = ['How many miles did I drive this week?', 'When was my last journey?', 'What was my top artist this month?'];
export const ASK_CANNOT_COMPUTE = 'Beep Boop. Can not compute.';

export function presentAskAnswer(answer: AskAnswer): AskAnswer {
  return answer.status === 'answered' && typeof answer.text === 'string' && answer.text.trim().length > 0
    ? answer
    : { status: answer.status === 'answered' ? 'unavailable' : answer.status, text: ASK_CANNOT_COMPUTE, evidence: [] };
}

export async function askJourneyDeckModelAvailability(): Promise<string> {
  try { return (await native?.journeyDeckAIStatusAsync?.())?.model ?? 'unavailable'; }
  catch { return 'unavailable'; }
}

export async function askJourneyDeck(userID: string, question: string, context?: string): Promise<AskAnswer> {
  if (!isAskJourneyDeckAvailable) return unavailable();
  assertProfile(userID);
  await prepareJourneyDeckDatabase();
  const answer = await native!.askJourneyDeckAsync!(question, userID, context ?? null);
  assertProfile(userID);
  assertAnswerProfile(answer, userID);
  return presentAskAnswer(answer);
}
export async function resolveJourneyDeckAnswer(userID: string, ticket: string): Promise<AskAnswer> {
  if (!isAskJourneyDeckAvailable) return unavailable();
  assertProfile(userID);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(ticket)) return unavailable();
  await prepareJourneyDeckDatabase();
  const answer = await native!.resolveJourneyDeckAnswerAsync!(ticket, userID);
  assertProfile(userID);
  assertAnswerProfile(answer, userID);
  return presentAskAnswer(answer);
}
function assertProfile(userID: string) {
  if (getActiveLocalUserId() !== userID) throw new Error('The active profile changed. Ask your question again.');
}
function assertAnswerProfile(answer: AskAnswer, userID: string) {
  if (answer.status === 'answered' && answer.profileId !== userID) throw new Error('The answer belongs to a different profile. Ask again.');
}
function unavailable(): AskAnswer {
  return { status: 'unavailable', text: ASK_CANNOT_COMPUTE, evidence: [] };
}
