import { redactUpdateLog } from './update-diagnostics-format.ts';

type ErrorHandler = (error: Error, isFatal?: boolean) => void;
type ErrorUtilsApi = { getGlobalHandler(): ErrorHandler; setGlobalHandler(handler: ErrorHandler): void };
export type StartupFailure = { captured: string; context: string; error: string };

/** Preserve the original exception before React Native/Expo starts recovery. */
export function installStartupErrorRecorder(
  errorUtils: ErrorUtilsApi | undefined,
  write: (failure: StartupFailure) => void,
  context: () => string,
) {
  if (!errorUtils) return;
  const previous = errorUtils.getGlobalHandler();
  let saving = false;
  errorUtils.setGlobalHandler((error, isFatal) => {
    if (isFatal && !saving) {
      saving = true;
      try {
        let details = 'Update context unavailable';
        try { details = context(); } catch {}
        write({
          captured: new Date().toISOString(),
          context: redactUpdateLog(details).slice(0, 1000),
          error: redactUpdateLog(`${error.name}: ${error.message}\n${error.stack ?? ''}`.slice(0, 16000)).slice(0, 12000),
        });
      } catch {
        // A diagnostic write must never replace or suppress the original error.
      } finally { saving = false; }
    }
    previous(error, isFatal);
  });
}

export function formatStartupFailure(value: unknown, now = Date.now()): string {
  if (!value || typeof value !== 'object') return 'No recent local JavaScript failure recorded.';
  const record = value as Partial<StartupFailure>;
  const captured = Date.parse(record.captured ?? '');
  if (!Number.isFinite(captured) || now - captured > 86400000 || captured > now
    || typeof record.context !== 'string' || typeof record.error !== 'string') {
    return 'No recent local JavaScript failure recorded.';
  }
  return redactUpdateLog(`Last fatal JavaScript error\n${record.captured}\n${record.context}\n${record.error}`).slice(0, 14000);
}
