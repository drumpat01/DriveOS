import { File, Paths } from 'expo-file-system';
import { formatStartupFailure, installStartupErrorRecorder } from './startup-error-recorder';

// Cache only the last redacted fatal error locally; never upload automatically.
const errorFile = () => new File(Paths.cache, 'journeydeck-last-js-failure.json');

try {
  installStartupErrorRecorder(
    (globalThis as typeof globalThis & { ErrorUtils?: Parameters<typeof installStartupErrorRecorder>[0] }).ErrorUtils,
    failure => errorFile().write(JSON.stringify(failure)),
    () => {
      // Read lazily so the recorder is installed before app modules start loading.
      const updates = require('expo-updates') as typeof import('expo-updates');
      return `Runtime: ${updates.runtimeVersion ?? 'unknown'} / Update: ${updates.updateId ?? 'embedded'} / Embedded: ${updates.isEmbeddedLaunch}`;
    },
  );
} catch {
  // Unsupported environments keep their existing error handler.
}

export function readStartupFailure(): string {
  try {
    const file = errorFile();
    if (!file.exists) return formatStartupFailure(null);
    if (file.size > 64000) return 'Local JavaScript failure report exceeded its size limit.';
    const report = formatStartupFailure(JSON.parse(file.textSync()));
    if (report.startsWith('No recent')) file.delete();
    return report;
  } catch { return 'Could not read the local JavaScript failure report.'; }
}
