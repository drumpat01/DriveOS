import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { CONNECTOR_PRIVACY_KEY, CONNECTOR_PRIVACY_OPTIONS, DEFAULT_CONNECTOR_PRIVACY, connectorPrivacySummary, normalizeConnectorPrivacy } from '../src/connector-privacy.ts';

test('connector sharing defaults share everything except Home and Work, like the connector', () => {
  assert.equal(CONNECTOR_PRIVACY_KEY, 'connector.privacy.v1');
  assert.deepEqual(DEFAULT_CONNECTOR_PRIVACY, { music: true, routes: true, memories: true, photos: true, homeWork: false });
  assert.deepEqual(CONNECTOR_PRIVACY_OPTIONS.map(option => option.key), ['music', 'routes', 'memories', 'photos', 'homeWork']);
});

test('saved settings fall back field by field, so a partial or malformed value never shares more', () => {
  assert.deepEqual(normalizeConnectorPrivacy(null), DEFAULT_CONNECTOR_PRIVACY);
  assert.deepEqual(normalizeConnectorPrivacy('yes'), DEFAULT_CONNECTOR_PRIVACY);
  assert.deepEqual(normalizeConnectorPrivacy({ music: false, homeWork: 'true', extra: 1 }), { ...DEFAULT_CONNECTOR_PRIVACY, music: false });
});

test('the settings row summarizes what is shared', () => {
  assert.equal(connectorPrivacySummary(DEFAULT_CONNECTOR_PRIVACY), 'Sharing everything · Home & Work hidden');
  assert.equal(connectorPrivacySummary({ ...DEFAULT_CONNECTOR_PRIVACY, photos: false, homeWork: true }), 'Sharing all but photos · Home & Work shared');
  assert.equal(connectorPrivacySummary({ music: false, routes: false, memories: false, photos: false, homeWork: false }), 'Journey summaries only · Home & Work hidden');
});

test('the connector screen is V4-only and saves through the synced private preference', () => {
  const shell = readFileSync(new URL('../src/shell.tsx', import.meta.url), 'utf8');
  const screen = readFileSync(new URL('../src/connector-settings.tsx', import.meta.url), 'utf8');
  assert.match(shell, /V4_CONNECTOR_ENABLED && <View style=\{styles\.settingsHubSection\}>/);
  assert.match(shell, /connector=\{V4_CONNECTOR_ENABLED \? \{/);
  assert.match(screen, /upsertPrivatePreference\(profileId, CONNECTOR_PRIVACY_KEY, next\)/);
});

test('the connector screen offers Claude, ChatGPT, Grok and other MCP apps, each with setup steps', async () => {
  const { CONNECTOR_ASSISTANTS, connectorAssistant } = await import('../src/connector-assistants.ts');
  assert.deepEqual(CONNECTOR_ASSISTANTS.map(assistant => assistant.id), ['claude', 'chatgpt', 'grok', 'other']);
  assert.ok(CONNECTOR_ASSISTANTS.every(assistant => assistant.addSteps.length > 0 && assistant.label.length <= 8));
  assert.match(connectorAssistant('chatgpt').addSteps.join(' '), /Add → Create MCP App/);
  assert.doesNotMatch(connectorAssistant('chatgpt').addSteps.join(' '), /Developer mode/);
  assert.equal(connectorAssistant('grok').settingsUrl, 'https://grok.com/connectors');
  assert.equal(connectorAssistant('nope' as never).id, 'claude');
  const screen = readFileSync(new URL('../src/connector-settings.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(screen.replace('Connect JourneyDeck to Claude, ChatGPT, Grok', ''), /\bClaude\b/, 'no Claude-only copy outside the intro');
});
