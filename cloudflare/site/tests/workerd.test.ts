import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { unstable_dev, type Unstable_DevWorker } from "wrangler";
import { breakSignature, createTestChain, requestBody, signRealtimeRequest } from "./chain.ts";

const freeCpuLimitMs = 10;

function percentile(values: number[], p: number) {
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[index] ?? 0;
}

async function traceDurations(worker: Unstable_DevWorker, startedMs: number) {
  const response = await fetch(`http://${worker.address}:${worker.port}/cdn-cgi/local/explorer/api/local/observability/query`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      sql: `SELECT duration_ms, start_ms FROM spans WHERE service = 'journeydeck-site' AND name = 'POST' AND parent_id IS NULL AND start_ms >= ${startedMs} ORDER BY start_ms ASC`
    })
  });
  const body = await response.json() as { result?: { rows?: unknown[][] } };
  return (body.result?.rows ?? []).map(row => Number(row[0])).filter(value => Number.isFinite(value));
}

test("workerd serves phase-one assets and measures retention time", async () => {
  const chain = createTestChain();
  const persistTo = mkdtempSync(join(tmpdir(), "journeydeck-site-dev-"));
  const worker = await unstable_dev(new URL("../src/index.ts", import.meta.url).pathname, {
    config: new URL("../wrangler.jsonc", import.meta.url).pathname,
    local: true,
    logLevel: "error",
    inspectorPort: 0,
    persistTo,
    vars: {
      ALLOW_RETENTION_TEST_ROOT: "true",
      RETENTION_TEST_ROOT_BASE64: chain.rootDer.toString("base64")
    },
    experimental: { disableExperimentalWarning: true, disableDevRegistry: true }
  });
  try {
    const home = await worker.fetch("https://journeydeck.me/");
    const homeHtml = await home.text();
    assert.equal(home.status, 200);
    assert.match(homeHtml, /JourneyDeck: Take the road\. Keep the story\./);
    assert.equal(homeHtml.includes("<title>JourneyDeck</title>"), false);
    assert.equal(home.headers.get("cache-control"), "public, max-age=0");
    assert.equal(home.headers.get("cache-control")?.includes("must-revalidate"), false);
    assert.match(home.headers.get("link") || "", /api-catalog/);

    const privacy = await worker.fetch("https://journeydeck.me/privacy.html");
    assert.equal(privacy.status, 200);
    assert.match(await privacy.text(), /Privacy Policy/);

    const slashed = await worker.fetch("https://journeydeck.me/privacy/");
    assert.equal(slashed.status, 404);
    assert.equal(slashed.headers.get("x-robots-tag"), "noindex, nofollow");
    assert.equal(slashed.headers.get("cache-control"), "public, max-age=0");

    const terms = await worker.fetch("https://journeydeck.me/terms");
    assert.equal(terms.status, 200);
    assert.equal(terms.headers.get("cache-control"), "public, max-age=0");
    assert.equal(terms.headers.get("content-type"), "text/html; charset=utf-8");

    const script = await worker.fetch("https://journeydeck.me/app.js");
    assert.equal(script.status, 200);
    assert.equal(script.headers.get("content-type"), "application/javascript; charset=utf-8");

    const icon = await worker.fetch("https://journeydeck.me/favicon.ico");
    assert.equal(icon.status, 200);
    assert.equal(icon.headers.get("content-type"), "image/vnd.microsoft.icon");

    const directory = await worker.fetch("https://journeydeck.me/assets/");
    assert.equal(directory.status, 403);
    assert.equal(directory.headers.get("cache-control"), null);
    assert.equal(directory.headers.get("content-type"), "application/json; charset=utf-8");
    assert.deepEqual(await directory.json(), { statusCode: 403, error: "Forbidden", message: "Forbidden" });

    const journal = await worker.fetch("https://journeydeck.me/driving-journal", { redirect: "manual" });
    assert.equal(journal.status, 301);
    assert.equal(journal.headers.get("location"), "/private-driving-journal");
    assert.equal(journal.headers.get("content-type"), null);

    const payload = signRealtimeRequest(chain, requestBody());
    const startedMs = Date.now();
    for (let index = 0; index < 5; index += 1) {
      const signed = index === 0 ? payload : signRealtimeRequest(chain, requestBody({ requestIdentifier: `warm-${index}` }));
      const response = await worker.fetch("https://journeydeck.me/retention-messaging-api", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ signedPayload: signed })
      });
      assert.equal(response.status, 200, await response.text());
    }
    await new Promise(resolve => setTimeout(resolve, 200));
    const durations = await traceDurations(worker, startedMs);
    const rejected = await worker.fetch("https://journeydeck.me/retention-messaging-api", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ signedPayload: breakSignature(payload) })
    });
    assert.equal(rejected.status, 401, await rejected.text());

    assert.ok(durations.length >= 2, `expected retention span durations, saw ${JSON.stringify(durations)}`);
    const coldMs = durations[0] ?? 0;
    const warmMs = durations.slice(1);
    const warmP95 = percentile(warmMs, 95);
    // Local workerd traces store span duration, not tail cpuTime. Verification is
    // CPU-bound, so duration is an upper bound on the CPU time for that request.
    const report = {
      unit: "workerd span duration_ms (upper bound on CPU)",
      coldMs,
      warmMs,
      warmP95Ms: warmP95,
      freeLimitMs: freeCpuLimitMs,
      coldExceedsFree: coldMs > freeCpuLimitMs,
      warmP95ExceedsFree: warmP95 > freeCpuLimitMs,
      sampleCount: durations.length
    };
    console.log(`PHASE0_CPU ${JSON.stringify(report)}`);
    assert.equal(Number.isFinite(coldMs), true);
  } finally {
    await worker.stop();
    chain.cleanup();
    rmSync(persistTo, { recursive: true, force: true });
  }
});
