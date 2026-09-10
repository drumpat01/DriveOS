// RevenueCat mirrors billing only. StoreKit remains the access authority.
export type BillingObserverDependencies = {
  configure: () => boolean;
  userId: () => Promise<string>;
  sync: () => Promise<unknown>;
  readMarker: () => Promise<string | null>;
  writeMarker: (value: string) => Promise<void>;
};

export function createBillingObserver(deps: BillingObserverDependencies) {
  let inFlight: Promise<void> | null = null;
  return {
    start() {
      try { return deps.configure(); } catch { return false; }
    },
    sync(force = false): Promise<void> {
      if (inFlight) return inFlight;
      inFlight = (async () => {
        try {
          if (!deps.configure()) return;
          const id = await deps.userId();
          // Persist only after success; offline failures retry at the next check.
          if (!force && await deps.readMarker() === id) return;
          await deps.sync();
          await deps.writeMarker(id);
        } catch {
          // Billing telemetry cannot turn an Apple success into a failed purchase.
        }
      })().finally(() => { inFlight = null; });
      return inFlight;
    },
  };
}
