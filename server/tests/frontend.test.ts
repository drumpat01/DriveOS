import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { root } from "./helpers.js";

test("Atlas startup uses one bootstrap and no browser graph reconstruction or DOM markers", () => {
  const source = fs.readFileSync(path.join(root, "web", "features", "mobility-graph.js"), "utf8");
  assert.equal((source.match(/api\/atlas\/bootstrap/g) || []).length, 1);
  assert.doesNotMatch(source, /api\/atlas\/journeys|api\/mobility-graph|api\/drives|buildImportedJourneyRoutines|representativeJourneyFeatures|new\s+maplibregl\.Marker|localStorage/);
  assert.match(source, /addSource\('mobility-connections'/); assert.match(source, /addSource\('mobility-places'/); assert.match(source, /cluster:true/); assert.match(source, /api\/atlas\/places\/\$\{encodeURIComponent\(node\.id\)\}/);
  assert.match(source, /api\/atlas\/map\?\$\{query\}/); assert.match(source, /new URLSearchParams\(\{west:/); assert.match(source, /map\.on\('moveend'/); assert.match(source, /zoom in for individual journeys/);
});
