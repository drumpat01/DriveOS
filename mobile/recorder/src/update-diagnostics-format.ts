type LogEntry = { timestamp: number; level: string; code: string; message: string; updateId?: string; stacktrace?: string[] };

export function redactUpdateLog(value: string): string {
  return value
    .replace(/(["']?(?:token|password|secret|authorization|api[_-]?key)["']?\s*[:=]\s*)(["'])[^\r\n]*?\2/gi, '$1"[removed]"')
    .replace(/https?:\/\/[^\s"'<>]+/gi, '[URL removed]')
    .replace(/\bBearer\s+[^\s,;]+/gi, 'Bearer [removed]')
    .replace(/\b(token|password|secret|authorization|api[_-]?key)\s*[:=]\s*[^\s,;]+/gi, '$1=[removed]')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email removed]')
    .replace(/-?\d{1,3}\.\d{4,}/g, '[decimal removed]')
    .replace(/(?:file:\/\/|\/private\/|\/var\/)[^\s"']+/gi, '[device path removed]');
}

export function formatUpdateLogs(entries: LogEntry[]): string {
  const recent = [...entries].sort((a, b) => b.timestamp - a.timestamp);
  const selected = [...recent.filter(e => e.level === 'error' || e.level === 'fatal' || e.level === 'warn'),
    ...recent.filter(e => !['error', 'fatal', 'warn'].includes(e.level))].slice(0, 80);
  return selected.map(e => {
    const time = Number.isFinite(e.timestamp) ? new Date(e.timestamp).toISOString() : 'Unknown time';
    return redactUpdateLog(`${time} ${e.level} ${e.code}\n${e.updateId ? `Update ${e.updateId}\n` : ''}${e.message}\n${(e.stacktrace ?? []).slice(0, 12).join('\n')}`).slice(0, 5000);
  }).join('\n\n').slice(0, 60000) || 'No Expo update log entries were found in the last 24 hours.';
}
