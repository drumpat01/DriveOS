import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";
import { unstable_dev } from "wrangler";
import { DEFAULT_RETENTION_MESSAGE_ID } from "../src/retention.ts";
import { createTestChain, requestBody, signRealtimeRequest } from "./chain.ts";

test("workerd serves phase-one assets", async () => {
  const worker = await unstable_dev(new URL("../src/index.ts", import.meta.url).pathname, {
    config: new URL("../wrangler.jsonc", import.meta.url).pathname,
    local: true,
    logLevel: "error",
    inspectorPort: 0,
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
    const etag = terms.headers.get("etag");
    assert.ok(etag);
    await terms.arrayBuffer();
    const revalidated = await worker.fetch("https://journeydeck.me/terms", { headers: { "if-none-match": etag } });
    assert.equal(revalidated.status, 304);
    assert.equal(await revalidated.text(), "");

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
  } finally {
    await worker.stop();
  }
});

test("workerd retention answers without calling Render and stays inside the Apple budget", async () => {
  const hits: string[] = [];
  const origin = await new Promise<{ server: ReturnType<typeof createServer>; url: string }>(resolve => {
    const server = createServer((request, response) => {
      hits.push(`${request.method} ${request.url}`);
      response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
      response.end("{}");
    });
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      resolve({ server, url: `http://127.0.0.1:${port}` });
    });
  });
  const chain = createTestChain();
  const worker = await unstable_dev(new URL("../src/index.ts", import.meta.url).pathname, {
    config: new URL("../wrangler.jsonc", import.meta.url).pathname,
    local: true,
    logLevel: "error",
    inspectorPort: 0,
    vars: {
      RENDER_ORIGIN: origin.url,
      JOURNEYDECK_RETENTION_MESSAGE_ID: DEFAULT_RETENTION_MESSAGE_ID,
      JOURNEYDECK_RETENTION_ENVIRONMENTS: "Production,Sandbox",
      ALLOW_RETENTION_TEST_ROOT: "true",
      RETENTION_TEST_ROOT_BASE64: chain.rootDer.toString("base64")
    },
    experimental: { disableExperimentalWarning: true, disableDevRegistry: true }
  });
  try {
    const payload = JSON.stringify({ signedPayload: signRealtimeRequest(chain, requestBody()) });
    const started = performance.now();
    const accepted = await worker.fetch("http://127.0.0.1/retention-messaging-api", {
      method: "POST",
      headers: { "content-type": "application/json", "x-journeydeck-retention-timing": "1" },
      body: payload
    });
    const wallMs = performance.now() - started;
    const body = await accepted.text();
    assert.equal(accepted.status, 200, body);
    assert.deepEqual(JSON.parse(body), { message: { messageIdentifier: DEFAULT_RETENTION_MESSAGE_ID } });
    assert.equal(wallMs < 700, true, `workerd wall ${wallMs} ms`);
    const timing = accepted.headers.get("server-timing") || "";
    const handlerMs = Number(/retention;dur=([0-9.]+)/.exec(timing)?.[1]);
    const cpuMs = Number(/cpu;dur=([0-9.]+)/.exec(timing)?.[1]);
    assert.equal(Number.isFinite(handlerMs), true, timing);
    // The dev runtime's timer is 1 ms. A cold isolate's first request lands
    // around 8–10 ms, so the assertion is the Apple budget. Warm requests
    // below assert the Free-plan steady state.
    assert.equal(handlerMs < 700, true, `workerd handler wall ${handlerMs} ms`);
    if (Number.isFinite(cpuMs)) assert.equal(cpuMs < 10, true, `workerd cpu ${cpuMs} ms`);
    console.log(`workerd retention cold wall ${wallMs.toFixed(3)} ms handler ${handlerMs.toFixed(3)} ms${Number.isFinite(cpuMs) ? ` cpu ${cpuMs.toFixed(3)} ms` : ""}`);
    const warmTimes: number[] = [];
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const warm = await worker.fetch("http://127.0.0.1/retention-messaging-api", {
        method: "POST",
        headers: { "content-type": "application/json", "x-journeydeck-retention-timing": "1" },
        body: payload
      });
      assert.equal(warm.status, 200, await warm.text());
      warmTimes.push(Number(/retention;dur=([0-9.]+)/.exec(warm.headers.get("server-timing") || "")?.[1]));
    }
    const warmMax = Math.max(...warmTimes);
    assert.equal(warmMax < 10, true, `warm handler ${warmTimes.join(", ")} ms`);
    console.log(`workerd retention warm handler ${warmTimes.map(value => value.toFixed(3)).join(", ")} ms`);
    assert.equal(hits.some(hit => hit.includes("retention-messaging")), false);
    assert.equal(hits.some(hit => hit.includes("onrender.com")), false);

    const malformed = await worker.fetch("http://127.0.0.1/retention-messaging-api", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}"
    });
    assert.equal(malformed.status, 400);
    assert.deepEqual(await malformed.json(), { error: "A signed RealtimeRequestBody is required." });

    const wrongMethod = await worker.fetch("http://127.0.0.1/retention-messaging-api/");
    assert.equal(wrongMethod.status, 405);
    assert.equal(wrongMethod.headers.get("allow"), "POST");
    assert.equal(hits.some(hit => hit.includes("retention-messaging")), false);

    const proxied = await worker.fetch("http://127.0.0.1/readyz");
    assert.equal(proxied.status, 200);
    assert.equal(hits.some(hit => hit.startsWith("GET /readyz")), true);
  } finally {
    await worker.stop();
    await new Promise<void>(resolve => origin.server.close(() => resolve()));
    chain.cleanup();
  }
});
