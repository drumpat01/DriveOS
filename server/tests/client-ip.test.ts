import assert from "node:assert/strict";
import test from "node:test";
import { deriveClientIp, normalizeIp, parseTrustProxy } from "../src/client-ip.js";

const render = "10.21.0.8";
const cloudflare = "104.16.1.1";
const attacker = "203.0.113.50";
const owner = "198.51.100.20";
const spoof = "192.0.2.1";

test("TRUST_PROXY defaults to Render's single hop and can be turned off", () => {
  assert.equal(parseTrustProxy(undefined), 1);
  assert.equal(parseTrustProxy(""), 1);
  assert.equal(parseTrustProxy(" 1 "), 1);
  assert.equal(parseTrustProxy("true"), 1);
  assert.equal(parseTrustProxy("0"), 0);
  assert.equal(parseTrustProxy("false"), 0);
  assert.equal(parseTrustProxy("off"), 0);
  assert.equal(parseTrustProxy("none"), 0);
  assert.equal(parseTrustProxy("2"), 2);
  assert.throws(() => parseTrustProxy("cloudflare"), /TRUST_PROXY/);
  assert.throws(() => parseTrustProxy("33"), /TRUST_PROXY/);
});

test("missing forwarding headers fall back to the socket address", () => {
  assert.equal(deriveClientIp({ socketAddress: attacker, trustHops: 1 }), attacker);
  assert.equal(deriveClientIp({ socketAddress: attacker, xForwardedFor: "   ", cfConnectingIp: "", trustHops: 1 }), attacker);
  assert.equal(deriveClientIp({ socketAddress: "::ffff:203.0.113.50", trustHops: 1 }), attacker);
  assert.equal(normalizeIp("[2001:db8::10]"), "2001:db8::10");
  assert.equal(deriveClientIp({ socketAddress: "2001:DB8::10", trustHops: 1 }), "2001:db8::10");
});

test("a spoofed left-most X-Forwarded-For entry is not the client", () => {
  assert.equal(deriveClientIp({
    socketAddress: render,
    xForwardedFor: `${spoof}, ${attacker}`,
    cfConnectingIp: owner,
    trustHops: 1
  }), attacker);
});

test("multiple proxy hops keep the right-most untrusted address", () => {
  const xForwardedFor = `${spoof}, ${attacker}, ${cloudflare}`;
  assert.equal(deriveClientIp({ socketAddress: render, xForwardedFor, trustHops: 1 }), cloudflare);
  assert.equal(deriveClientIp({ socketAddress: render, xForwardedFor, cfConnectingIp: owner, trustHops: 2 }), attacker);
  assert.equal(deriveClientIp({ socketAddress: render, xForwardedFor, cfConnectingIp: owner, trustHops: 0 }), render);
});

test("CF-Connecting-IP is trusted only from a Cloudflare socket peer", () => {
  assert.equal(deriveClientIp({
    socketAddress: cloudflare,
    xForwardedFor: `${spoof}, ${attacker}`,
    cfConnectingIp: owner,
    trustHops: 1
  }), owner);
  assert.equal(deriveClientIp({
    socketAddress: render,
    xForwardedFor: `${spoof}, ${attacker}, ${cloudflare}`,
    cfConnectingIp: owner,
    trustHops: 1
  }), cloudflare);
  assert.equal(deriveClientIp({
    socketAddress: cloudflare,
    xForwardedFor: attacker,
    cfConnectingIp: `${owner}, ${attacker}`,
    trustHops: 1
  }), attacker);
  assert.equal(deriveClientIp({
    socketAddress: cloudflare,
    cfConnectingIp: ["203.0.113.8", owner],
    trustHops: 1
  }), cloudflare);
  assert.equal(deriveClientIp({
    socketAddress: cloudflare,
    xForwardedFor: attacker,
    cfConnectingIp: owner,
    trustHops: 0
  }), cloudflare);
});

test("an invalid forwarding hop stops the walk before a spoofed prefix", () => {
  assert.equal(deriveClientIp({
    socketAddress: render,
    xForwardedFor: `${attacker}, not-an-ip`,
    trustHops: 1
  }), render);
});
