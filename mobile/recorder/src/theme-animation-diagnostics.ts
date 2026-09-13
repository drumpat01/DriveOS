import { File, Paths } from 'expo-file-system';
import {
  formatThemeAnimationDiagnostics,
  retainThemeAnimationDiagnostics,
  sanitizeThemeAnimationDiagnostic,
  type ThemeAnimationDiagnostic,
} from './theme-animation-diagnostics-format';

const diagnosticsFile = () => new File(Paths.cache, 'journeydeck-theme-animation-diag-11.json');
const TERMINAL_EVENTS = new Set([
  'overlay_cleared',
  'preference_save_failed',
]);
const FLUSH_DELAY_MS = 2_000;
let pendingEntries: ThemeAnimationDiagnostic[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function readEntries(): ThemeAnimationDiagnostic[] {
  try {
    const file = diagnosticsFile();
    if (!file.exists || file.size > 64_000) return [];
    const parsed = JSON.parse(file.textSync());
    return Array.isArray(parsed) ? retainThemeAnimationDiagnostics(parsed) : [];
  } catch { return []; }
}

function flushPendingEntries() {
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = null;
  if (!pendingEntries.length) return;
  const entries = pendingEntries;
  pendingEntries = [];
  try {
    diagnosticsFile().write(JSON.stringify(retainThemeAnimationDiagnostics([...readEntries(), ...entries])));
  } catch {
    // Diagnostics can never participate in theme behavior.
  }
}

/** Buffers privacy-safe breadcrumbs so diagnostics do not compete with motion. */
export function recordThemeAnimationEvent(
  event: string,
  attempt: number,
  details: Record<string, unknown> = {},
) {
  try {
    const entry = sanitizeThemeAnimationDiagnostic({ at: new Date().toISOString(), event, attempt, details });
    if (!entry) return;
    pendingEntries.push(entry);
    if (TERMINAL_EVENTS.has(event)) {
      flushPendingEntries();
      return;
    }
    if (flushTimer) clearTimeout(flushTimer);
    flushTimer = setTimeout(flushPendingEntries, FLUSH_DELAY_MS);
  } catch {
    // Diagnostics can never participate in theme behavior.
  }
}

export function readThemeAnimationDiagnostics() {
  try {
    flushPendingEntries();
    return formatThemeAnimationDiagnostics(readEntries());
  }
  catch { return 'Theme animation diagnostics\nCould not read local theme animation events.'; }
}
