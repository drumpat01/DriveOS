import {
  areJourneyDeckRequestsBlocked,
  beginNetworkActivity,
  classifyJourneyDeckRequest,
  recordBlockedJourneyDeckRequest,
} from './network-activity';
import type { NetworkActivityReason } from './network-activity';

type JourneyDeckConnection = { serverUrl: string; token: string };
type RequestOptions = { timeoutMs?: number; timeoutMessage?: string };
type EdgeRequestOptions = RequestOptions & { operation?: string; reason?: NetworkActivityReason };

export class JourneyDeckNetworkBlockedError extends Error {
  constructor() {
    super('JourneyDeck server requests are blocked for this local-only test session.');
    this.name = 'JourneyDeckNetworkBlockedError';
  }
}

function utf8ByteLength(value: string) {
  if (!/[^\x00-\x7f]/.test(value)) return value.length;
  let bytes = 0;
  for (const character of value) {
    const point = character.codePointAt(0) ?? 0;
    bytes += point <= 0x7f ? 1 : point <= 0x7ff ? 2 : point <= 0xffff ? 3 : 4;
  }
  return bytes;
}

function requestUploadBytes(body: BodyInit | null | undefined) {
  return typeof body === 'string' ? utf8ByteLength(body) : 0;
}

function reportedDownloadBytes(response: Response) {
  const value = response.headers.get('content-length');
  if (!value) return 0;
  const bytes = Number(value);
  return Number.isFinite(bytes) && bytes >= 0 ? Math.round(bytes) : 0;
}

export async function requestJourneyDeckJson<T>(
  connection: JourneyDeckConnection,
  path: string,
  init: RequestInit = {},
  options: RequestOptions = {},
): Promise<T> {
  const method = (init.method || 'GET').toUpperCase();
  const classification = classifyJourneyDeckRequest(path, method);
  const uploadBytes = requestUploadBytes(init.body);
  if (areJourneyDeckRequestsBlocked()) {
    recordBlockedJourneyDeckRequest({ ...classification, method, uploadBytes });
    throw new JourneyDeckNetworkBlockedError();
  }

  const activity = beginNetworkActivity({
    category: 'journeydeck_server',
    ...classification,
    method,
    uploadBytes,
  });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 12_000);
  try {
    const response = await fetch(`${connection.serverUrl}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        authorization: `Bearer ${connection.token}`,
        'content-type': 'application/json',
        ...init.headers,
      },
    });
    const downloadBytes = reportedDownloadBytes(response);
    const payload = await response.json().catch(() => null) as { error?: string } | null;
    activity.finish({ outcome: response.ok ? 'succeeded' : 'failed', statusCode: response.status, downloadBytes });
    if (!response.ok) throw new Error(payload?.error || `JourneyDeck returned ${response.status}.`);
    return payload as T;
  } catch (error) {
    activity.finish({ outcome: 'failed' });
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(options.timeoutMessage || 'JourneyDeck took too long to respond.');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export async function requestPrivacyEdgeJson<T>(
  edgeUrl: string,
  path: string,
  body: Record<string, string>,
  options: EdgeRequestOptions = {},
): Promise<T> {
  const serializedBody = JSON.stringify(body);
  const activity = beginNetworkActivity({
    category: 'privacy_edge',
    reason: options.reason ?? 'place_lookup',
    operation: options.operation ?? 'City label lookup',
    method: 'POST',
    uploadBytes: requestUploadBytes(serializedBody),
  });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 8_000);
  try {
    const response = await fetch(`${edgeUrl.replace(/\/$/, '')}${path}`, {
      method: 'POST',
      signal: controller.signal,
      body: serializedBody,
      headers: { accept: 'application/json', 'content-type': 'application/json', 'x-journeydeck-version': '1.7' },
    });
    const downloadBytes = reportedDownloadBytes(response);
    const payload = await response.json().catch(() => null) as { error?: string } | null;
    activity.finish({ outcome: response.ok ? 'succeeded' : 'failed', statusCode: response.status, downloadBytes });
    if (!response.ok) throw new Error(payload?.error || `JourneyDeck privacy edge returned ${response.status}.`);
    return payload as T;
  } catch (error) {
    activity.finish({ outcome: 'failed' });
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(options.timeoutMessage || 'The privacy edge took too long to respond.');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export async function requestExternalProviderJson<T>(
  url: string,
  accessToken: string,
  options: EdgeRequestOptions = {},
): Promise<T> {
  if (!/^https:\/\/api\.spotify\.com\//.test(url)) throw new Error('Unapproved music provider URL.');
  const activity = beginNetworkActivity({
    category: 'privacy_edge', reason: 'external_import', operation: options.operation ?? 'Private music import', method: 'GET', uploadBytes: 0,
  });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 10_000);
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { accept: 'application/json', authorization: `Bearer ${accessToken}` } });
    const downloadBytes = reportedDownloadBytes(response);
    const payload = await response.json().catch(() => null) as ({ error?: { message?: string } } & T) | null;
    activity.finish({ outcome: response.ok ? 'succeeded' : 'failed', statusCode: response.status, downloadBytes });
    if (!response.ok) {
      const error = new Error(payload?.error?.message || `Spotify returned ${response.status}.`) as Error & { status?: number };
      error.status = response.status;
      throw error;
    }
    return payload as T;
  } catch (error) {
    activity.finish({ outcome: 'failed' });
    if (error instanceof Error && error.name === 'AbortError') throw new Error(options.timeoutMessage || 'Spotify took too long to respond.');
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export async function requestAppleCatalogJson<T>(url: string, options: EdgeRequestOptions = {}): Promise<T> {
  if (!/^https:\/\/itunes\.apple\.com\/search\?/.test(url)) throw new Error('Unapproved Apple catalog URL.');
  const activity = beginNetworkActivity({
    category: 'privacy_edge', reason: 'external_import', operation: options.operation ?? 'Apple artwork lookup', method: 'GET', uploadBytes: 0,
  });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 8_000);
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { accept: 'application/json' } });
    const downloadBytes = reportedDownloadBytes(response);
    const payload = await response.json().catch(() => null) as T | null;
    activity.finish({ outcome: response.ok ? 'succeeded' : 'failed', statusCode: response.status, downloadBytes });
    if (!response.ok || !payload) throw new Error(`Apple catalog returned ${response.status}.`);
    return payload;
  } catch (error) {
    activity.finish({ outcome: 'failed' });
    if (error instanceof Error && error.name === 'AbortError') throw new Error(options.timeoutMessage || 'Apple artwork lookup took too long.');
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
