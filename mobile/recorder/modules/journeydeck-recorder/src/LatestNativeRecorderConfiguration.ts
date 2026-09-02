export type NativeRecorderConfigurationTarget = {
  enabled: boolean;
  ownerUserId: string;
  deviceId: string;
};

type Waiter<T> = {
  version: number;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
};

/**
 * Serializes native recorder configuration and coalesces queued requests so a
 * stale launch-time disable can never finish after a newer enable request.
 */
export function createLatestNativeRecorderConfiguration<T>(
  apply: (target: NativeRecorderConfigurationTarget) => Promise<T>,
) {
  let requestedVersion = 0;
  let desired: { version: number; target: NativeRecorderConfigurationTarget } | null = null;
  let draining = false;
  let waiters: Waiter<T>[] = [];

  const settleThrough = (version: number, result: { value: T } | { error: unknown }) => {
    const settled = waiters.filter(waiter => waiter.version <= version);
    waiters = waiters.filter(waiter => waiter.version > version);
    settled.forEach(waiter => {
      if ('value' in result) waiter.resolve(result.value);
      else waiter.reject(result.error);
    });
  };

  const drain = async () => {
    if (draining) return;
    draining = true;
    try {
      while (desired) {
        const current = desired;
        desired = null;
        try {
          const value = await apply(current.target);
          settleThrough(current.version, { value });
        } catch (error) {
          settleThrough(current.version, { error });
        }
      }
    } finally {
      draining = false;
      if (desired) void drain();
    }
  };

  return {
    request(target: NativeRecorderConfigurationTarget): Promise<T> {
      const version = ++requestedVersion;
      desired = { version, target };
      const result = new Promise<T>((resolve, reject) => {
        waiters.push({ version, resolve, reject });
      });
      void drain();
      return result;
    },
  };
}
