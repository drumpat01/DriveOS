import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  CONNECTOR_APP_LINK_KEY, appLinkDigestInputs, connectionDates, connectionsBaseUrl, connectionsErrorCode, effectiveSharing, encodeAppLinkSecret,
  isAppLinkSecret, parseAppLink, parseConnections, sharingSummary,
} from '../src/connector-connections-model.ts';
import { DEFAULT_CONNECTOR_PRIVACY } from '../src/connector-privacy.ts';

const sha = (text: string) => createHash('sha256').update(text).digest('hex');

test('the link secret is 43 base64url characters, as the connector requires', () => {
  for (let i = 0; i < 20; i++) {
    const bytes = randomBytes(32);
    const secret = encodeAppLinkSecret(bytes);
    assert.equal(secret, bytes.toString('base64url'));
    assert.ok(isAppLinkSecret(secret));
  }
  assert.equal(isAppLinkSecret('short'), false);
  assert.equal(isAppLinkSecret('a'.repeat(42) + '='), false);
});

test('link digests match the connector: same prefixes, and only digests reach iCloud', () => {
  assert.equal(CONNECTOR_APP_LINK_KEY, 'connector.app-link.v1');
  const inputs = appLinkDigestInputs('s3cret');
  assert.deepEqual(inputs, { id: 'journeydeck-app-link:id:s3cret', verifier: 'journeydeck-app-link:verify:s3cret' });
  const link = { id: sha(inputs.id), verifier: sha(inputs.verifier) };
  assert.deepEqual(parseAppLink(link), link);
  assert.equal(parseAppLink({ id: link.id, verifier: 'S3CRET' }), null);
  assert.equal(parseAppLink({ id: link.id.toUpperCase(), verifier: link.verifier }), null);
  const source = readFileSync(new URL('../src/connector-app-link.ts', import.meta.url), 'utf8');
  assert.match(source, /SecureStore\.setItemAsync\(secretKey\(profileId\), secret/);
  assert.doesNotMatch(source, /upsertPrivatePreference\([^)]*secret\)/, 'the secret itself is never saved as a synced preference');
});

test('connections parse defensively; missing per-assistant switches never hide more than the app', () => {
  const result = parseConnections({
    appSharing: { photos: false },
    connections: [
      { id: 'g1', clientId: 'https://claude.ai/oauth/mcp', name: 'Claude', host: 'claude.ai', connectedAt: '2026-09-27T10:00:00Z', lastUsedAt: null, sharing: { music: false }, sharingSource: 'consent' },
      { id: 'g2', clientId: 'dcr', connectedAt: '2026-09-20T10:00:00Z', sharing: 'yes', sharingSource: 'weird' },
      { id: '', clientId: 'x', connectedAt: '2026-09-20T10:00:00Z' },
      { id: 'g3', clientId: 'x', connectedAt: 'not a date' },
    ],
  });
  assert.ok(result);
  assert.deepEqual(result.connections.map(c => c.id), ['g1', 'g2']);
  assert.deepEqual(result.connections[0].sharing, { music: false, routes: true, memories: true, photos: true, homeWork: true });
  assert.equal(result.connections[1].name, 'Assistant');
  assert.equal(result.connections[1].sharingSource, 'default');
  assert.deepEqual(result.appSharing, { ...DEFAULT_CONNECTOR_PRIVACY, photos: false });
  assert.equal(parseConnections({ connections: 'nope' }), null);
});

test('an assistant sees a category only when both its switch and the app-wide one allow it', () => {
  const assistant = { music: false, routes: true, memories: true, photos: true, homeWork: true };
  const app = { music: true, routes: true, memories: true, photos: false, homeWork: false };
  assert.deepEqual(effectiveSharing(assistant, app), { music: false, routes: true, memories: true, photos: false, homeWork: false });
});

test('rows summarize what each assistant can read', () => {
  assert.equal(sharingSummary({ music: true, routes: true, memories: true, photos: true, homeWork: false }), 'Everything · Home & Work hidden');
  assert.equal(sharingSummary({ music: true, routes: false, memories: true, photos: false, homeWork: true }), 'Music and memories · Home & Work shared');
  assert.equal(sharingSummary({ music: true, routes: true, memories: false, photos: true, homeWork: false }), 'Music, routes and photos · Home & Work hidden');
  assert.equal(sharingSummary({ music: false, routes: false, memories: false, photos: false, homeWork: false }), 'Journey summaries only · Home & Work hidden');
});

test('connection dates read in calendar days', () => {
  const now = new Date(2026, 8, 27, 18);
  assert.equal(connectionDates({ connectedAt: new Date(2026, 8, 20, 9).toISOString(), lastUsedAt: null }, now), 'Connected Sep 20 · Not used yet');
  assert.equal(connectionDates({ connectedAt: new Date(2026, 8, 20, 9).toISOString(), lastUsedAt: new Date(2026, 8, 27, 1).toISOString() }, now), 'Connected Sep 20 · Used today');
  assert.equal(connectionDates({ connectedAt: new Date(2026, 8, 20, 9).toISOString(), lastUsedAt: new Date(2026, 8, 26, 23).toISOString() }, now), 'Connected Sep 20 · Used yesterday');
  assert.equal(connectionDates({ connectedAt: new Date(2025, 11, 2).toISOString(), lastUsedAt: new Date(2026, 8, 1).toISOString() }, now), 'Connected Dec 2, 2025 · Used Sep 1');
});

test('API errors map to messages the screen can show', () => {
  assert.equal(connectionsErrorCode(404, { error: 'not_linked' }), 'not_linked');
  assert.equal(connectionsErrorCode(409, { error: 'reconnect' }), 'reconnect');
  assert.equal(connectionsErrorCode(401, null), 'not_linked');
  assert.equal(connectionsErrorCode(500, { error: 'boom' }), 'unknown');
});

test('the API lives on the connector origin', () => {
  assert.equal(connectionsBaseUrl('https://mcp-staging.journeydeck.me/mcp'), 'https://mcp-staging.journeydeck.me/app/connections');
  assert.equal(connectionsBaseUrl(null), null);
  assert.equal(connectionsBaseUrl('not a url'), null);
});
