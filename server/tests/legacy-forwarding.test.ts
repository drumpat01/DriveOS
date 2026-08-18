import assert from "node:assert/strict";
import test from "node:test";
import { legacyForwardingContext } from "../src/legacy-forwarding.js";

test("local compatibility upstream receives the configured public host", () => {
  assert.deepEqual(
    legacyForwardingContext("http://127.0.0.1:10001", "https://journeydeck.me"),
    {
      destinationOrigin: "https://journeydeck.me",
      destinationHost: "journeydeck.me",
      forwardedHost: "journeydeck.me",
      forwardedProtocol: "https"
    }
  );
});

test("remote compatibility upstream retains its own validated host", () => {
  assert.deepEqual(
    legacyForwardingContext("https://journeydeck.me", "https://superredux.tail1babbd.ts.net:8443"),
    {
      destinationOrigin: "https://journeydeck.me",
      destinationHost: "journeydeck.me",
      forwardedHost: "superredux.tail1babbd.ts.net:8443",
      forwardedProtocol: "https"
    }
  );
});
