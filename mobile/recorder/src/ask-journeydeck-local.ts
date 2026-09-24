import type { AskProfile, AskSnapshot } from './ask-journeydeck-archive';

// Both engines already run in native JavaScriptCore for Siri. Metro also bundles
// them here so the in-app answer rules can change through a compatible OTA.
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
  membership(): Promise<{ nativeModuleAvailable: boolean; tier: 'free' | 'paid' }>;
  verifiedFullHistory?: () => Promise<boolean>;
  planner?: (question: string, context: string, now: number) => Promise<Record<string, unknown> | null>;
  isActive(): boolean;
  uuid(): string;
  now(): number;
};

const FREE_HISTORY_MS = 45 * 86_400_000;
const TICKET_MS = 5 * 60_000;

/** In-app only. Siri continues to use its own authenticated native reader. */
export function createLocalAskRuntime(deps: LocalAskDependencies) {
  const tickets = new Map<string, Ticket>();

  function check(userID: string, epoch?: string) {
    const current = deps.profile();
    if (!deps.isActive() || !current || current.id !== userID || (epoch && current.epoch !== epoch)) {
      throw new Error('The active profile changed or the app locked. Ask again.');
    }
    return current;
  }

  async function historyAccess(now: number) {
    // Preview flags and local preferences cannot grant paid history. The new
    // bridge uses the native Ask reader's independent verified StoreKit check.
    const membership = await deps.membership().catch(() => ({ nativeModuleAvailable: false, tier: 'free' as const }));
    if (!membership.nativeModuleAvailable || membership.tier !== 'paid') {
      return { boundary: now - FREE_HISTORY_MS, legacyPaid: false };
    }
    if (!deps.verifiedFullHistory) return { boundary: now - FREE_HISTORY_MS, legacyPaid: true };
    const verified = await deps.verifiedFullHistory().catch(() => false);
    return { boundary: verified ? 0 : now - FREE_HISTORY_MS, legacyPaid: false };
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
    savedPlan: Record<string, unknown> | null = null, allowNativeFallback = false): Promise<AskAnswer | null> {
    if (!question || question.length > 500) return { status: 'unavailable', text: 'Please keep your question under 500 characters.', evidence: [] };
    const identity = check(userID), now = deps.now(), { boundary, legacyPaid } = await historyAccess(now);
    check(userID, identity.epoch);
    let plan = savedPlan;
    let answer: EngineAnswer;
    if (plan) {
      const snapshot = deps.snapshot(userID, boundary, now, true);
      if (snapshot.profile.epoch !== identity.epoch) throw new Error('The active profile changed. Ask again.');
      answer = queryEngine.execute(plan, snapshot.input, previous);
    } else {
      const snapshot = deps.snapshot(userID, boundary, now, false);
      if (snapshot.profile.epoch !== identity.epoch) throw new Error('The active profile changed. Ask again.');
      answer = askEngine.answer(question, snapshot.input, previous);
      if (answer.status === 'clarify') {
        if (!deps.planner) return previous ? answer : null; // Preserve the installed binary's AI path.
        const modelContext = JSON.stringify(queryEngine.modelContext(previous, now));
        if (modelContext.length > 4000) return { status: 'unavailable', text: 'This follow-up is too long. Ask a new question.', evidence: [] };
        const raw = await deps.planner(question, modelContext, now);
        check(userID, identity.epoch);
        plan = raw ? queryEngine.normalizeModelPlan(question, raw, previous !== null) : null;
        if (plan) {
          // Inference sees no archive rows. Read fresh rows only after it finishes.
          const fresh = deps.snapshot(userID, boundary, deps.now(), true);
          if (fresh.profile.epoch !== identity.epoch) throw new Error('The active profile changed. Ask again.');
          answer = queryEngine.execute(plan, fresh.input, previous);
        }
      }
    }
    if (legacyPaid && allowNativeFallback && answer.status === 'historyLimited') return null;
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
      return evaluate(userID, question, prior?.context ?? null, null, !prior);
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
