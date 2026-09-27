/**
 * What the JourneyDeck connector may share with AI assistants (V4).
 *
 * Saved as the private preference `connector.privacy.v1`, which syncs through
 * the existing PrivatePreference record. The connector reads it from iCloud and
 * filters every answer (journeydeck-data-mcp `packages/core/privacy.js`); the
 * defaults and field names here must match that file. Journey summaries (dates,
 * miles, place names) are always shared. Home and Work stay masked, including
 * route points and markers within 300 m, unless the user shares them.
 */
export const CONNECTOR_PRIVACY_KEY = 'connector.privacy.v1';

export type ConnectorPrivacy = {
  music: boolean;
  routes: boolean;
  memories: boolean;
  photos: boolean;
  homeWork: boolean;
};

export type ConnectorPrivacyKey = keyof ConnectorPrivacy;

export const DEFAULT_CONNECTOR_PRIVACY: Readonly<ConnectorPrivacy> = Object.freeze({ music: true, routes: true, memories: true, photos: true, homeWork: false });

export const CONNECTOR_PRIVACY_OPTIONS: readonly { key: ConnectorPrivacyKey; title: string; detail: string; symbol: string }[] = [
  { key: 'music', title: 'Music', detail: 'Songs played on each drive and your most-played music.', symbol: 'music.note' },
  { key: 'routes', title: 'Routes & locations', detail: 'GPS tracks and exact coordinates of places and markers.', symbol: 'point.topleft.down.to.point.bottomright.curvepath' },
  { key: 'memories', title: 'Memories & markers', detail: 'Memories, collections, and marker notes.', symbol: 'mappin.and.ellipse' },
  { key: 'photos', title: 'Photos', detail: 'Photos attached to memories and markers.', symbol: 'photo' },
  { key: 'homeWork', title: 'Home & Work locations', detail: 'When off, their coordinates and anything within 300 m are hidden. The names Home and Work still appear.', symbol: 'house' },
];

/** Missing or malformed fields fall back one by one, matching the connector. */
export function normalizeConnectorPrivacy(value: unknown): ConnectorPrivacy {
  const settings = { ...DEFAULT_CONNECTOR_PRIVACY };
  if (value && typeof value === 'object') {
    for (const key of Object.keys(DEFAULT_CONNECTOR_PRIVACY) as ConnectorPrivacyKey[]) {
      const field = (value as Record<string, unknown>)[key];
      if (typeof field === 'boolean') settings[key] = field;
    }
  }
  return settings;
}

/** Plain-language summary for the settings row, e.g. "Sharing all but photos · Home & Work hidden". */
export function connectorPrivacySummary(settings: ConnectorPrivacy): string {
  const off = CONNECTOR_PRIVACY_OPTIONS.filter(option => option.key !== 'homeWork' && !settings[option.key]).map(option => option.title.toLowerCase());
  const sharing = off.length === 0 ? 'Sharing everything' : off.length === 4 ? 'Journey summaries only' : `Sharing all but ${off.join(', ')}`;
  return `${sharing} · Home & Work ${settings.homeWork ? 'shared' : 'hidden'}`;
}
