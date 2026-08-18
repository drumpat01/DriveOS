export type AtlasJourney = {
  id: string;
  startedAt: string;
  startingLocation: string;
  rawStartingLocation?: string;
  startingLatitude: number;
  startingLongitude: number;
  endingLocation: string;
  rawEndingLocation?: string;
  endingLatitude: number;
  endingLongitude: number;
  miles: number;
};

export type AtlasPlace = {
  id: string;
  label: string;
  address: string;
  category: string;
  latitude: number;
  longitude: number;
  visitCount: number;
  arrivals: number;
  departures: number;
  firstSeenAt: string;
  lastSeenAt: string;
};

export type AtlasPattern = {
  id: string;
  title: string;
  narrative: string;
  source: string;
  target: string;
  sourceLabel: string;
  targetLabel: string;
  sourceAddress: string;
  targetAddress: string;
  sourceLatitude: number;
  sourceLongitude: number;
  targetLatitude: number;
  targetLongitude: number;
  driveCount: number;
  type: string;
  inferredType: string;
  confidenceLabel: string;
  confirmationStatus: "suggested";
};

export type AtlasBootstrap = {
  schemaVersion: number;
  generatedAtUtc: string;
  sourceWatermark: string;
  summary: { placeCount: number; connectionCount: number; journeyCount: number; totalMiles: number };
  places: AtlasPlace[];
  representativeLines: { type: "FeatureCollection"; features: Array<{ type: "Feature"; properties: { distanceMiles: number; palette: number }; geometry: { type: "LineString"; coordinates: [[number, number], [number, number]] } }> };
  patterns: AtlasPattern[];
  changeInsights: Array<{ type: string; direction: string; title: string; narrative: string; confidence: string }>;
};
