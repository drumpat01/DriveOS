/**
 * Connected AI assistants (V4 Settings → AI Assistants). The connector's
 * /app/connections API (journeydeck-data-mcp `packages/connector/src/app-api.js`)
 * lists the assistants connected to this account, each with the switches the
 * user chose when connecting it or changed here since. The app-wide switches
 * in `connector-privacy.ts` still apply on top: an assistant sees a category
 * only when both allow it.
 *
 * The app proves it owns the account with a secret kept on this phone
 * (`connector-app-link.ts`); only SHA-256 digests of it sync to iCloud, as the
 * private preference below. Kept free of React Native imports so Node tests
 * can check it.
 */
import { CONNECTOR_PRIVACY_OPTIONS, normalizeConnectorPrivacy, type ConnectorPrivacy, type ConnectorPrivacyKey } from './connector-privacy.ts';

export const CONNECTOR_APP_LINK_KEY = 'connector.app-link.v1';

/** The API lives on the connector's origin, next to its /mcp address. */
export function connectionsBaseUrl(mcpUrl: string | null): string | null {
  if (!mcpUrl) return null;
  try { return `${new URL(mcpUrl).origin}/app/connections`; } catch { return null; }
}

/** Digest inputs; must match `appLinkDigests` in the connector's app-api.js. */
export const appLinkDigestInputs = (secret: string) => ({ id: `journeydeck-app-link:id:${secret}`, verifier: `journeydeck-app-link:verify:${secret}` });

export type AppLink = { id: string; verifier: string };

const HEX_64 = /^[0-9a-f]{64}$/;
export function parseAppLink(value: unknown): AppLink | null {
  if (!value || typeof value !== 'object') return null;
  const { id, verifier } = value as Record<string, unknown>;
  return typeof id === 'string' && typeof verifier === 'string' && HEX_64.test(id) && HEX_64.test(verifier) ? { id, verifier } : null;
}

/** 32 random bytes as unpadded base64url (43 characters), the form the connector accepts. */
export function encodeAppLinkSecret(bytes: Uint8Array): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    const chars = i + 2 < bytes.length ? 4 : i + 1 < bytes.length ? 3 : 2;
    for (let c = 0; c < chars; c++) out += alphabet[(n >> (18 - 6 * c)) & 63];
  }
  return out;
}

export const isAppLinkSecret = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9_-]{43,128}$/.test(value);

export type SharingSource = 'app' | 'consent' | 'default';

export type ConnectedAssistant = {
  id: string;
  clientId: string;
  name: string;
  host: string | null;
  connectedAt: string;
  lastUsedAt: string | null;
  sharing: ConnectorPrivacy;
  sharingSource: SharingSource;
};

export type ConnectionsResult = { connections: ConnectedAssistant[]; appSharing: ConnectorPrivacy };

export type ConnectionsErrorCode = 'not_linked' | 'reconnect' | 'icloud' | 'loading' | 'not_found' | 'offline' | 'unknown';

const ALL_SHARED: ConnectorPrivacy = { music: true, routes: true, memories: true, photos: true, homeWork: true };

/** Per-assistant switches: a missing field means "no narrower than the app", unlike app-wide settings. */
function assistantSharing(value: unknown): ConnectorPrivacy {
  const out = { ...ALL_SHARED };
  if (value && typeof value === 'object') for (const key of Object.keys(ALL_SHARED) as ConnectorPrivacyKey[]) {
    const field = (value as Record<string, unknown>)[key];
    if (typeof field === 'boolean') out[key] = field;
  }
  return out;
}

const text = (value: unknown, max = 200) => (typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : null);
const isoOrNull = (value: unknown) => (typeof value === 'string' && Number.isFinite(Date.parse(value)) ? value : null);

export function parseConnectedAssistant(value: unknown): ConnectedAssistant | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  const id = text(v.id, 300);
  const clientId = text(v.clientId, 2000);
  const connectedAt = isoOrNull(v.connectedAt);
  if (!id || !clientId || !connectedAt) return null;
  const source = v.sharingSource === 'app' || v.sharingSource === 'consent' ? v.sharingSource : 'default';
  return { id, clientId, name: text(v.name, 80) ?? 'Assistant', host: text(v.host, 253), connectedAt, lastUsedAt: isoOrNull(v.lastUsedAt), sharing: assistantSharing(v.sharing), sharingSource: source };
}

export function parseConnections(value: unknown): ConnectionsResult | null {
  if (!value || typeof value !== 'object' || !Array.isArray((value as { connections?: unknown }).connections)) return null;
  const v = value as { connections: unknown[]; appSharing?: unknown };
  return { connections: v.connections.map(parseConnectedAssistant).filter((c): c is ConnectedAssistant => c !== null), appSharing: normalizeConnectorPrivacy(v.appSharing) };
}

/** What the assistant can actually read: its own switch and the app-wide one. */
export function effectiveSharing(assistant: ConnectorPrivacy, app: ConnectorPrivacy): ConnectorPrivacy {
  const out = { ...assistant };
  for (const key of Object.keys(out) as ConnectorPrivacyKey[]) out[key] = assistant[key] && app[key];
  return out;
}

/** One line for a collapsed row, e.g. "Music, routes and photos · Home & Work hidden". */
export function sharingSummary(sharing: ConnectorPrivacy): string {
  const shown = CONNECTOR_PRIVACY_OPTIONS.filter(o => o.key !== 'homeWork' && sharing[o.key]).map(o => SHORT[o.key]);
  const list = shown.length === 0 ? 'Journey summaries only' : shown.length === 4 ? 'Everything' : joinList(shown);
  return `${capitalize(list)} · Home & Work ${sharing.homeWork ? 'shared' : 'hidden'}`;
}

const SHORT: Record<ConnectorPrivacyKey, string> = { music: 'music', routes: 'routes', memories: 'memories', photos: 'photos', homeWork: 'Home & Work' };
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const joinList = (items: string[]) => (items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`);

/** "Connected Sep 27 · Used today" in the viewer's calendar. */
export function connectionDates(assistant: Pick<ConnectedAssistant, 'connectedAt' | 'lastUsedAt'>, now = new Date()): string {
  const connected = `Connected ${new Date(assistant.connectedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', ...(new Date(assistant.connectedAt).getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}) })}`;
  if (!assistant.lastUsedAt) return `${connected} · Not used yet`;
  return `${connected} · Used ${relativeDay(new Date(assistant.lastUsedAt), now)}`;
}

function relativeDay(date: Date, now: Date): string {
  const day = (d: Date) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  const days = Math.round((day(now) - day(date)) / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export const CONNECTIONS_ERROR_TEXT: Record<ConnectionsErrorCode, string> = {
  not_linked: 'This iPhone isn’t linked to your connections yet. Sync iCloud, then connect an assistant or ask it one question.',
  reconnect: 'The Apple sign-in behind your connections has expired. Reconnect JourneyDeck in any assistant.',
  icloud: 'iCloud didn’t answer. Try again in a moment.',
  loading: 'Your library is still loading on the connector. Try again in a moment.',
  not_found: 'That assistant isn’t connected any more.',
  offline: 'Couldn’t reach JourneyDeck’s connector. Check your connection and try again.',
  unknown: 'Something went wrong. Try again.',
};

export function connectionsErrorCode(status: number, body: unknown): ConnectionsErrorCode {
  const error = body && typeof body === 'object' ? (body as { error?: unknown }).error : null;
  if (error === 'not_linked' || error === 'reconnect' || error === 'icloud' || error === 'loading' || error === 'not_found') return error;
  if (status === 401) return 'not_linked';
  return 'unknown';
}
