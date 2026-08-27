import {
  areJourneyDeckRequestsBlocked,
  beginNetworkActivity,
  classifyJourneyDeckRequest,
  recordBlockedJourneyDeckRequest,
} from './network-activity';

type JourneyDeckConnection = { serverUrl: string; token: string };
type RequestOptions = { timeoutMs?: number; timeoutMessage?: string };
type EdgeRequestOptions = RequestOptions & { operation?: string };

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
    reason: 'place_lookup',
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
      throw new Error(options.timeoutMessage || 'The privacy-safe city lookup took too long.');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
