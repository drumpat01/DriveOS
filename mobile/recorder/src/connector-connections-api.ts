import type { ConnectorPrivacy } from './connector-privacy.ts';
import { requestConnectorJson } from './network-request.ts';
import { connectionsErrorCode, parseConnectedAssistant, parseConnections, type ConnectedAssistant, type ConnectionsErrorCode, type ConnectionsResult } from './connector-connections-model.ts';

/** Calls the connector's /app/connections API (see connector-connections-model.ts). */
export class ConnectionsError extends Error {
  readonly code: ConnectionsErrorCode;
  constructor(code: ConnectionsErrorCode) { super(code); this.code = code; }
}

async function request(url: string, secret: string, init: { method?: 'GET' | 'PUT' | 'DELETE'; body?: string } = {}): Promise<unknown> {
  let res: { status: number; body: unknown };
  try {
    res = await requestConnectorJson(url, secret, init);
  } catch {
    throw new ConnectionsError('offline');
  }
  if (res.status < 200 || res.status >= 300) throw new ConnectionsError(connectionsErrorCode(res.status, res.body));
  return res.body;
}

export async function fetchConnections(baseUrl: string, secret: string): Promise<ConnectionsResult> {
  const result = parseConnections(await request(baseUrl, secret));
  if (!result) throw new ConnectionsError('unknown');
  return result;
}

export async function saveAssistantSharing(baseUrl: string, secret: string, id: string, sharing: ConnectorPrivacy): Promise<ConnectedAssistant> {
  const body = await request(`${baseUrl}/${encodeURIComponent(id)}`, secret, { method: 'PUT', body: JSON.stringify({ sharing }) });
  const connection = parseConnectedAssistant(body && typeof body === 'object' ? (body as { connection?: unknown }).connection : null);
  if (!connection) throw new ConnectionsError('unknown');
  return connection;
}

export async function disconnectAssistant(baseUrl: string, secret: string, id: string): Promise<void> {
  await request(`${baseUrl}/${encodeURIComponent(id)}`, secret, { method: 'DELETE' });
}
