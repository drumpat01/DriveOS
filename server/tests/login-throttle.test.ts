import assert from "node:assert/strict";
import test from "node:test";
import { LoginThrottle } from "../src/login-throttle.js";

const attacker = "203.0.113.50";
const owner = "198.51.100.20";
const start = Date.parse("2026-08-10T23:00:00Z");

test("login failures throttle one client address and leave another alone", () => {
  const throttle = new LoginThrottle();
  assert.equal(throttle.allowed(attacker, start), true);
  assert.equal(throttle.allowed(owner, start), true);
  for (let attempt = 0; attempt < 4; attempt += 1) throttle.recordFailure(attacker, start);
  assert.equal(throttle.allowed(attacker, start + 1_000), true);
  throttle.recordFailure(attacker, start + 1_000);
  assert.equal(throttle.allowed(attacker, start + 2_000), false);
  assert.equal(throttle.allowed(owner, start + 2_000), true);
  assert.equal(throttle.allowed(attacker, start + 1_000 + 30_000), true);
});

test("a successful login clears only that client", () => {
  const throttle = new LoginThrottle();
  for (let attempt = 0; attempt < 5; attempt += 1) throttle.recordFailure(attacker, start);
  throttle.recordFailure(owner, start);
  throttle.observe(attacker, 200, start + 1_000);
  assert.equal(throttle.allowed(attacker, start + 1_000), true);
  throttle.observe(owner, 401, start + 2_000);
  assert.equal(throttle.allowed(owner, start + 2_000), true);
  for (let attempt = 0; attempt < 3; attempt += 1) throttle.observe(owner, 401, start + 3_000);
  assert.equal(throttle.allowed(owner, start + 4_000), false);
  assert.equal(throttle.allowed(attacker, start + 4_000), true);
});

test("failures older than 15 minutes do not accumulate", () => {
  const throttle = new LoginThrottle();
  for (let attempt = 0; attempt < 4; attempt += 1) throttle.recordFailure(attacker, start);
  const stillInside = start + (15 * 60_000);
  throttle.recordFailure(attacker, stillInside);
  assert.equal(throttle.allowed(attacker, stillInside + 1), false);

  const fresh = new LoginThrottle();
  for (let attempt = 0; attempt < 4; attempt += 1) fresh.recordFailure(attacker, start);
  const afterWindow = start + (15 * 60_000) + 1;
  fresh.recordFailure(attacker, afterWindow);
  assert.equal(fresh.allowed(attacker, afterWindow + 1), true);
  for (let attempt = 0; attempt < 4; attempt += 1) fresh.recordFailure(attacker, afterWindow + 1);
  assert.equal(fresh.allowed(attacker, afterWindow + 2), false);
});
