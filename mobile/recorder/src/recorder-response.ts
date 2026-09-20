/**
 * Bounds a read or an idempotent acknowledgement of already committed data.
 * This does not cancel native work. Never use it to blindly retry Start,
 * Pause, Resume or any mutation without a native identity/expiry fence.
 */
export async function waitForRecorderResponse<T>(response: Promise<T>, code: string, timeoutMs = 10_000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([response, new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(code)), timeoutMs);
    })]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}
