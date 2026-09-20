/** A caller deadline is not cancellation. Retain the native lock until the
 * actual request settles, including across late success/failure responses. */
export function createCloudKitRequestGate(timeoutMs = 120_000) {
  let active: Promise<unknown> | null = null;
  return async function request<T>(work: () => Promise<T>): Promise<T> {
    if (active) throw new Error('Private iCloud is recovering an earlier request. Local changes remain queued; retry sync shortly.');
    const raw = Promise.resolve().then(work);
    active = raw;
    void raw.then(() => { if (active === raw) active = null; }, () => { if (active === raw) active = null; });
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([raw, new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('Private iCloud response timed out. Local changes remain queued; retry sync shortly.')), timeoutMs);
      })]);
    } finally { clearTimeout(timer); }
  };
}
