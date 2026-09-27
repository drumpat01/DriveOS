/**
 * AI assistants the V4 connector screen explains. The JourneyDeck connector is a
 * standard remote MCP server with OAuth, so any assistant that supports custom
 * MCP connectors can use it; these are the ones with written setup steps.
 * Claude, ChatGPT and Grok were each connected and tested against the staging
 * connector on 2026-09-27; these steps follow what their web apps showed then.
 */
export type ConnectorAssistantId = 'claude' | 'chatgpt' | 'grok' | 'other';

export type ConnectorAssistant = {
  id: ConnectorAssistantId;
  name: string;
  /** Short label for the picker. */
  label: string;
  /** Steps before pasting the address. */
  addSteps: readonly string[];
  /** Where the assistant's connector settings live, when it has a web address. */
  settingsUrl?: string;
  note?: string;
};

export const CONNECTOR_ASSISTANTS: readonly ConnectorAssistant[] = [
  { id: 'claude', name: 'Claude', label: 'Claude', addSteps: ['In Claude, open Settings → Connectors → Add custom connector.'] },
  {
    id: 'chatgpt', name: 'ChatGPT', label: 'ChatGPT',
    addSteps: ['In ChatGPT, open Plugins, then choose Add → Create MCP App.', 'Name it JourneyDeck and keep Authentication set to OAuth.'],
    note: 'Tick “I understand and want to continue”, then Create. ChatGPT opens JourneyDeck’s sign-in page.',
  },
  { id: 'grok', name: 'Grok', label: 'Grok', addSteps: ['Open grok.com/connectors, choose New Connector, then Custom, and name it JourneyDeck.'], settingsUrl: 'https://grok.com/connectors', note: 'Grok opens JourneyDeck’s sign-in in a pop-up window.' },
  {
    id: 'other', name: 'your assistant', label: 'Other',
    addSteps: ['In any app that supports custom MCP connectors (for example Claude Desktop, Cursor or VS Code), add a remote connector.'],
    note: 'Choose OAuth sign-in if the app asks.',
  },
];

export function connectorAssistant(id: ConnectorAssistantId): ConnectorAssistant {
  return CONNECTOR_ASSISTANTS.find(assistant => assistant.id === id) ?? CONNECTOR_ASSISTANTS[0];
}
