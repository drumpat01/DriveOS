import { File, Paths } from 'expo-file-system';
import {
  formatThemeAnimationDiagnostics,
  retainThemeAnimationDiagnostics,
  sanitizeThemeAnimationDiagnostic,
  type ThemeAnimationDiagnostic,
} from './theme-animation-diagnostics-format';

const diagnosticsFile = () => new File(Paths.cache, 'journeydeck-theme-animation-diag-11.json');

function readEntries(): ThemeAnimationDiagnostic[] {
  try {
    const file = diagnosticsFile();
    if (!file.exists || file.size > 64_000) return [];
    const parsed = JSON.parse(file.textSync());
    return Array.isArray(parsed) ? retainThemeAnimationDiagnostics(parsed) : [];
  } catch { return []; }
}

/** A tiny synchronous breadcrumb write so the last stage survives termination. */
export function recordThemeAnimationEvent(
  event: string,
  attempt: number,
  details: Record<string, unknown> = {},
) {
  try {
    const entry = sanitizeThemeAnimationDiagnostic({ at: new Date().toISOString(), event, attempt, details });
    if (!entry) return;
    diagnosticsFile().write(JSON.stringify(retainThemeAnimationDiagnostics([...readEntries(), entry])));
  } catch {
    // Diagnostics can never participate in theme behavior.
  }
}

export function readThemeAnimationDiagnostics() {
  try { return formatThemeAnimationDiagnostics(readEntries()); }
  catch { return 'Theme animation diagnostics\nCould not read local theme animation events.'; }
}
