const string = { type: "string" } as const;
const number = { type: "number" } as const;
const integer = { type: "integer" } as const;

const placeProperties = {
  id: string, label: string, address: string, category: string,
  latitude: number, longitude: number, visitCount: integer, arrivals: integer,
  departures: integer, firstSeenAt: string, lastSeenAt: string
} as const;
const placeRequired = Object.keys(placeProperties);
const place = { type: "object", additionalProperties: false, required: placeRequired, properties: placeProperties } as const;

const patternProperties = {
  id: string, title: string, narrative: string, source: string, target: string,
  sourceLabel: string, targetLabel: string, sourceAddress: string, targetAddress: string,
  sourceLatitude: number, sourceLongitude: number, targetLatitude: number, targetLongitude: number,
  driveCount: integer, type: string, inferredType: string, confidenceLabel: string,
  confirmationStatus: { type: "string", enum: ["suggested"] }
} as const;
const pattern = { type: "object", additionalProperties: false, required: Object.keys(patternProperties), properties: patternProperties } as const;

const lineFeature = {
  type: "object", additionalProperties: false, required: ["type", "properties", "geometry"],
  properties: {
    type: { type: "string", const: "Feature" },
    properties: { type: "object", additionalProperties: false, required: ["distanceMiles", "palette"], properties: { distanceMiles: number, palette: integer } },
    geometry: { type: "object", additionalProperties: false, required: ["type", "coordinates"], properties: { type: { type: "string", const: "LineString" }, coordinates: { type: "array", minItems: 2, maxItems: 2, items: { type: "array", minItems: 2, maxItems: 2, items: number } } } }
  }
} as const;

export const bootstrapSchema = {
  type: "object", additionalProperties: false,
  required: ["schemaVersion", "generatedAtUtc", "sourceWatermark", "summary", "places", "representativeLines", "patterns", "changeInsights"],
  properties: {
    schemaVersion: integer, generatedAtUtc: string, sourceWatermark: string,
    summary: { type: "object", additionalProperties: false, required: ["placeCount", "connectionCount", "journeyCount", "homeJourneyCount", "totalMiles"], properties: { placeCount: integer, connectionCount: integer, journeyCount: integer, homeJourneyCount: integer, totalMiles: number } },
    places: { type: "array", items: place },
    representativeLines: { type: "object", additionalProperties: false, required: ["type", "features"], properties: { type: { type: "string", const: "FeatureCollection" }, features: { type: "array", items: lineFeature } } },
    patterns: { type: "array", maxItems: 10, items: pattern },
    changeInsights: { type: "array", minItems: 3, maxItems: 3, items: { type: "object", additionalProperties: false, required: ["type", "direction", "title", "narrative", "confidence"], properties: { type: string, direction: string, title: string, narrative: string, confidence: string } } }
  }
} as const;

const connection = { type: "object", additionalProperties: false, required: ["source", "target", "driveCount", "totalMiles", "firstSeenAt", "lastSeenAt", "otherPlaceId"], properties: { source: string, target: string, driveCount: integer, totalMiles: number, firstSeenAt: string, lastSeenAt: string, otherPlaceId: string } } as const;
export const placeDetailSchema = { type: "object", additionalProperties: false, required: [...placeRequired, "connections"], properties: { ...placeProperties, connections: { type: "array", items: connection } } } as const;
export const patternQueueSchema = { type: "object", additionalProperties: false, required: ["items", "nextCursor"], properties: { items: { type: "array", maxItems: 10, items: pattern }, nextCursor: { anyOf: [string, { type: "null" }] } } } as const;
const atlasMapFeature = {
  type: "object", additionalProperties: false, required: ["type", "properties", "geometry"],
  properties: {
    type: { type: "string", const: "Feature" },
    properties: { type: "object", additionalProperties: false, required: ["kind", "journeyCount", "distanceMiles"], properties: { kind: { type: "string", enum: ["corridor", "journey"] }, journeyCount: integer, distanceMiles: number, journeyId: string, startedAt: string } },
    geometry: { type: "object", additionalProperties: false, required: ["type", "coordinates"], properties: { type: { type: "string", const: "LineString" }, coordinates: { type: "array", minItems: 2, maxItems: 2, items: { type: "array", minItems: 2, maxItems: 2, items: number } } } }
  }
} as const;
export const atlasMapSchema = {
  type: "object", additionalProperties: false, required: ["mode", "zoom", "totalInView", "returned", "truncated", "bounds", "data"],
  properties: {
    mode: { type: "string", enum: ["corridors", "journeys"] }, zoom: number, totalInView: integer, returned: integer, truncated: { type: "boolean" },
    bounds: { type: "object", additionalProperties: false, required: ["west", "south", "east", "north"], properties: { west: number, south: number, east: number, north: number } },
    data: { type: "object", additionalProperties: false, required: ["type", "features"], properties: { type: { type: "string", const: "FeatureCollection" }, features: { type: "array", maxItems: 1200, items: atlasMapFeature } } }
  }
} as const;
export const savedSchema = { type: "object", additionalProperties: false, required: ["saved", "updatedAtUtc"], properties: { saved: { type: "boolean" }, id: string, status: string, updatedAtUtc: string } } as const;
