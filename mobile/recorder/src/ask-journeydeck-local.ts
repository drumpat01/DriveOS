import type { AskProfile, AskSnapshot } from './ask-journeydeck-archive';

// Legacy Expo answer path retained for regression comparison. The app now calls
// JourneyDeckAskService for both typed and Siri questions.
const askEngine = require('../modules/journeydeck-recorder/ios/AskResources/ask-engine.js') as {
  answer(question: string, input: AskSnapshot, previous: unknown): EngineAnswer;
};
const queryEngine = require('../modules/journeydeck-recorder/ios/AskResources/ask-query-engine.js') as {
  modelContext(previous: unknown, now: number): unknown;
  normalizeModelPlan(question: string, raw: Record<string, unknown>, hasPrior: boolean): Record<string, unknown> | null;
  execute(plan: Record<string, unknown>, input: AskSnapshot, previous: unknown): EngineAnswer;
};

export type AskAnswer = {
  status: 'answered' | 'clarify' | 'historyLimited' | 'unavailable';
  text: string;
  evidence: { kind: 'journey' | 'memory'; id: string; label: string }[];
  ticket?: string;
  contextToken?: string;
  profileId?: string;
};
type EngineAnswer = AskAnswer & { context?: Record<string, unknown> | null };
type Ticket = {
  userID: string;
  epoch: string;
  question: string;
  previous: Record<string, unknown> | null;
  context: Record<string, unknown> | null;
  plan: Record<string, unknown> | null;
  expires: number;
};

export type LocalAskDependencies = {
  profile(): AskProfile | null;
  snapshot(userID: string, cutoff: number, now: number, analysis: boolean): { input: AskSnapshot; profile: AskProfile };
  planner?: (question: string, context: string, now: number) => Promise<Record<string, unknown> | null>;
  isActive(): boolean;
  uuid(): string;
  now(): number;
};

const TICKET_MS = 5 * 60_000;

/** Regression fixture for the prior Expo reader; not wired into the app. */
export function createLocalAskRuntime(deps: LocalAskDependencies) {
  const tickets = new Map<string, Ticket>();

  function check(userID: string, epoch?: string) {
    const current = deps.profile();
    if (!deps.isActive() || !current || current.id !== userID || (epoch && current.epoch !== epoch)) {
      throw new Error('The active profile changed or the app locked. Ask again.');
    }
    return current;
  }

  function trimTickets(now: number) {
    for (const [id, ticket] of tickets) if (ticket.expires <= now) tickets.delete(id);
    while (tickets.size > 16) tickets.delete(tickets.keys().next().value!);
  }

  function finish(answer: EngineAnswer, userID: string, epoch: string, question: string,
    previous: Record<string, unknown> | null, plan: Record<string, unknown> | null, now: number): AskAnswer {
    check(userID, epoch);
    if (answer.status !== 'answered') return { status: answer.status, text: answer.text, evidence: answer.evidence };
    const context = answer.context ?? null;
    if (context?.version === 1 && ['latestJourney', 'firstJourney', 'longestJourney'].includes(String(context.metric))) {
      context.journeyIds = answer.evidence.filter(e => e.kind === 'journey').map(e => e.id);
    }
    const ticket = deps.uuid();
    tickets.set(ticket, { userID, epoch, question, previous, context, plan, expires: now + TICKET_MS });
    trimTickets(now);
    return { status: 'answered', text: answer.text, evidence: answer.evidence,
      ticket, contextToken: ticket, profileId: userID };
  }

  async function evaluate(userID: string, question: string, previous: Record<string, unknown> | null,
    savedPlan: Record<string, unknown> | null = null): Promise<AskAnswer | null> {
    if (!question || question.length > 500) return { status: 'unavailable', text: 'Please keep your question under 500 characters.', evidence: [] };
    const identity = check(userID), now = deps.now(), boundary = 0;
    check(userID, identity.epoch);
    let plan = savedPlan;
    let answer: EngineAnswer;
    if (plan) {
      const snapshot = deps.snapshot(userID, boundary, now, true);
      if (snapshot.profile.epoch !== identity.epoch) throw new Error('The active profile changed. Ask again.');
      answer = queryEngine.execute(plan, snapshot.input, previous);
    } else {
      if (deps.planner) {
        const modelContext = JSON.stringify(queryEngine.modelContext(previous, now));
        if (modelContext.length > 4000) return { status: 'unavailable', text: 'This follow-up is too long. Ask a new question.', evidence: [] };
        let raw: Record<string, unknown> | null = null;
        try { raw = await deps.planner(question, modelContext, now); }
        catch { /* Apple Intelligence can be unavailable or busy; use the local rules below. */ }
        check(userID, identity.epoch);
        plan = raw ? queryEngine.normalizeModelPlan(question, raw, previous !== null) : null;
        if (plan) {
          // Inference sees no archive rows. Read fresh rows only after it finishes.
          const fresh = deps.snapshot(userID, boundary, deps.now(), true);
          if (fresh.profile.epoch !== identity.epoch) throw new Error('The active profile changed. Ask again.');
          answer = queryEngine.execute(plan, fresh.input, previous);
          return finish(answer, userID, identity.epoch, question, previous, plan, now);
        }
      }
      const snapshot = deps.snapshot(userID, boundary, now, false);
      if (snapshot.profile.epoch !== identity.epoch) throw new Error('The active profile changed. Ask again.');
      answer = askEngine.answer(question, snapshot.input, previous);
      if (answer.status === 'clarify' && !deps.planner && !previous) return null; // Older binaries still own their native AI path.
    }
    return finish(answer, userID, identity.epoch, question, previous, plan, now);
  }

  return {
    async ask(userID: string, question: string, contextToken?: string): Promise<AskAnswer | null> {
      const now = deps.now(); trimTickets(now);
      const prior = contextToken ? tickets.get(contextToken) : undefined;
      if (contextToken && !prior) return null; // A native Siri or earlier native answer ticket.
      const profile = check(userID);
      if (prior && (prior.userID !== userID || prior.epoch !== profile.epoch)) {
        throw new Error('The active profile changed. Ask again.');
      }
      return evaluate(userID, question, prior?.context ?? null);
    },
    async resolve(userID: string, ticketID: string): Promise<AskAnswer | null> {
      const now = deps.now(); trimTickets(now);
      const ticket = tickets.get(ticketID);
      if (!ticket) return null; // Native Siri tickets remain native.
      check(userID, ticket.epoch);
      if (ticket.userID !== userID) throw new Error('The active profile changed. Ask again.');
      return evaluate(userID, ticket.question, ticket.previous, ticket.plan);
    },
    clear() { tickets.clear(); },
  };
}
