export type ThemeAnimationDiagnostic = Readonly<{
  at: string;
  event: string;
  attempt: number;
  details?: Readonly<Record<string, string | number | boolean>>;
}>;

const EVENT = /^[a-z][a-z0-9_]{0,47}$/;
const VALUE = /^[a-z0-9][a-z0-9._:-]{0,63}$/i;

export function sanitizeThemeAnimationDiagnostic(value: unknown): ThemeAnimationDiagnostic | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<ThemeAnimationDiagnostic>;
  if (!EVENT.test(candidate.event ?? '') || !Number.isInteger(candidate.attempt) || (candidate.attempt ?? 0) < 0
    || !Number.isFinite(Date.parse(candidate.at ?? ''))) return null;
  const details: Record<string, string | number | boolean> = {};
  if (candidate.details && typeof candidate.details === 'object') {
    for (const [key, item] of Object.entries(candidate.details)) {
      if (!EVENT.test(key)) continue;
      if (typeof item === 'boolean') details[key] = item;
      else if (typeof item === 'number' && Number.isFinite(item)) details[key] = Math.round(item);
      else if (typeof item === 'string' && VALUE.test(item)) details[key] = item;
    }
  }
  return { at: candidate.at!, event: candidate.event!, attempt: candidate.attempt!, ...(Object.keys(details).length ? { details } : {}) };
}

export function retainThemeAnimationDiagnostics(values: unknown[], now = Date.now()) {
  return values.map(sanitizeThemeAnimationDiagnostic).filter((value): value is ThemeAnimationDiagnostic => {
    if (!value) return false;
    const age = now - Date.parse(value.at);
    return age >= 0 && age <= 24 * 60 * 60 * 1000;
  }).slice(-80);
}

export function formatThemeAnimationDiagnostics(values: unknown[], now = Date.now()) {
  const entries = retainThemeAnimationDiagnostics(values, now);
  if (!entries.length) return 'Theme animation diagnostics\nNo theme animation events recorded in the last 24 hours.';
  return `Theme animation diagnostics\n${entries.map(entry => {
    const details = Object.entries(entry.details ?? {}).map(([key, value]) => `${key}=${value}`).join(' ');
    return `${entry.at} attempt=${entry.attempt} ${entry.event}${details ? ` ${details}` : ''}`;
  }).join('\n')}`.slice(0, 18000);
}
