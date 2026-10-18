const FAILURE_LIMIT = 5;
const BLOCK_MS = 30_000;
const WINDOW_MS = 15 * 60_000;
const UNKNOWN_CLIENT = "unknown";

export const LOGIN_RETRY_AFTER_SECONDS = BLOCK_MS / 1000;
export const LOGIN_THROTTLE_MESSAGE = "Too many login attempts. Please wait and try again.";

const throttledLoginPaths = new Set(["/api/auth/login", "/api/auth/passkey/verify"]);

type FailureState = {
  count: number;
  lastFailure: number;
  blockedUntil: number | null;
};

export function isThrottledLogin(method: string, pathname: string) {
  return method === "POST" && throttledLoginPaths.has(pathname);
}

export class LoginThrottle {
  private readonly states = new Map<string, FailureState>();

  allowed(clientIp: string, now = Date.now()): boolean {
    const state = this.states.get(this.key(clientIp));
    if (!state?.blockedUntil) return true;
    return now >= state.blockedUntil;
  }

  recordFailure(clientIp: string, now = Date.now()): void {
    const key = this.key(clientIp);
    const existing = this.states.get(key);
    const state: FailureState = !existing || now > existing.lastFailure + WINDOW_MS
      ? { count: 0, lastFailure: now, blockedUntil: null }
      : existing;
    state.count += 1;
    state.lastFailure = now;
    if (state.count >= FAILURE_LIMIT) state.blockedUntil = now + BLOCK_MS;
    this.states.set(key, state);
    this.prune(now);
  }

  clear(clientIp: string): void {
    this.states.delete(this.key(clientIp));
  }

  observe(clientIp: string, statusCode: number, now = Date.now()): void {
    if (statusCode === 401) this.recordFailure(clientIp, now);
    else if (statusCode >= 200 && statusCode < 300) this.clear(clientIp);
  }

  private key(clientIp: string) {
    return clientIp || UNKNOWN_CLIENT;
  }

  private prune(now: number) {
    if (this.states.size < 4096) return;
    for (const [key, state] of this.states) {
      const blocked = state.blockedUntil !== null && now < state.blockedUntil;
      if (!blocked && now > state.lastFailure + WINDOW_MS) this.states.delete(key);
    }
  }
}
