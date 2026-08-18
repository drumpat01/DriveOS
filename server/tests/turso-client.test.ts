import assert from "node:assert/strict";
import test from "node:test";
import { decodeTursoRows, tursoHttpUrl } from "../src/turso-client.js";

test("converts a libsql database URL to the Turso HTTPS endpoint", () => {
  assert.equal(tursoHttpUrl("libsql://driveos.example.turso.io"), "https://driveos.example.turso.io");
  assert.throws(() => tursoHttpUrl("https://driveos.example.turso.io"), /valid libsql/);
});

test("decodes Turso cells using the existing string-compatible representation", () => {
  assert.deepEqual(decodeTursoRows({
    cols: [{ name: "id" }, { name: "count" }, { name: "optional" }, { name: "blob" }],
    rows: [[{ type: "text", value: "drive-1" }, { type: "integer", value: "42" }, { type: "null" }, { type: "blob", base64: "AQI=" }]]
  }), [{ id: "drive-1", count: "42", optional: null, blob: "AQI=" }]);
});
