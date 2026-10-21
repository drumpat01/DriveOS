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
    assert.match(homeHtml, /href="https:\/\/studio\.journeydeck\.me\/\?utm_source=journeydeck&utm_medium=referral&utm_campaign=crosslink"/);
    assert.equal(homeHtml.includes('href="/login"'), false);
    assert.equal(homeHtml.includes("<title>JourneyDeck</title>"), false);
    assert.equal(home.headers.get("cache-control"), "public, max-age=0");
    assert.equal(home.headers.get("cache-control")?.includes("must-revalidate"), false);
    assert.match(home.headers.get("link") || "", /api-catalog/);
    const homeCsp = home.headers.get("content-security-policy") || "";
    assert.match(homeCsp, /script-src[^;]*https:\/\/static\.cloudflareinsights\.com/);
    assert.match(homeCsp, /connect-src[^;]*https:\/\/cloudflareinsights\.com/);
    assert.match(homeCsp, /img-src[^;]*https:\/\/followx\.today/);
    assert.doesNotMatch(homeCsp, /(?:script-src|connect-src)[^;]*https:\/\/followx\.today/);
    assert.match(homeHtml, /<footer\b[^>]*>[\s\S]*href="https:\/\/followx\.today\/b\/journeydeck\.me"[\s\S]*<\/footer>/);

    const robots = await worker.fetch("https://journeydeck.me/robots.txt");
    assert.equal(robots.status, 200);
    assert.equal(robots.headers.get("content-type"), "text/plain; charset=utf-8");
    assert.equal(robots.headers.get("x-robots-tag"), null);
    const robotsBody = await robots.text();
    assert.match(robotsBody, /^Content-Signal: ai-train=no, search=yes, ai-input=yes$/m);
    assert.equal(robotsBody.includes("ai-input=no"), false);

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

    const llms = await worker.fetch("https://journeydeck.me/llms.txt");
    assert.equal(llms.status, 200);
    assert.equal(llms.headers.get("content-type"), "text/plain; charset=utf-8");
    assert.equal(llms.headers.get("cache-control"), "public, max-age=0");
    assert.equal(llms.headers.get("x-robots-tag"), null);
    assert.match(await llms.text(), /\$39\.99\/yr(?!e)/);

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
    // workerd's timer is 1 ms and it has no CPU counter. Fresh isolates
    // measured cold handler wall from 8 ms to 14 ms, so this assertion is
    // Apple's 700 ms budget. Warm requests below are the Free-plan steady state.
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

    const ready = await worker.fetch("http://127.0.0.1/readyz");
    assert.equal(ready.status, 200);
    assert.equal(ready.headers.get("cache-control"), "no-store");
    assert.deepEqual(await ready.json(), { ok: true, service: "journeydeck-site" });
    const healthHead = await worker.fetch("http://127.0.0.1/healthz", { method: "HEAD" });
    assert.equal(healthHead.status, 200);
    assert.equal(healthHead.headers.get("cache-control"), "no-store");
    assert.equal(await healthHead.text(), "");
    const healthPost = await worker.fetch("http://127.0.0.1/healthz", { method: "POST", body: "{}" });
    assert.equal(healthPost.status, 405);
    assert.equal(healthPost.headers.get("allow"), "GET, HEAD");
    await healthPost.arrayBuffer();
    assert.equal(hits.some(hit => hit.includes("healthz") || hit.includes("readyz") || hit.includes("onrender")), false);

    const beforeRetired = hits.length;
    const api = await worker.fetch("http://127.0.0.1/api/anything", { method: "POST", body: "{}" });
    assert.equal(api.status, 410);
    assert.equal(api.headers.get("cache-control"), "no-store");
    assert.deepEqual(await api.json(), { error: "gone", message: "This API has been retired." });
    const login = await worker.fetch("http://127.0.0.1/login");
    assert.equal(login.status, 410);
    const loginHtml = await login.text();
    assert.match(loginHtml, /The old web app has been retired\./);
    assert.match(loginHtml, /apps\.apple\.com\/us\/app\/journeydeck\/id6806502526/);
    assert.match(loginHtml, /href="\/"/);
    assert.equal(login.headers.get("x-robots-tag"), "noindex");
    const appPath = await worker.fetch("http://127.0.0.1/app/library");
    assert.equal(appPath.status, 410);
    const wife = await worker.fetch("http://127.0.0.1/wife");
    assert.equal(wife.status, 410);
    await wife.arrayBuffer();
    await appPath.arrayBuffer();
    for (const path of ["/index.html", "/login.html", "/wife.html", "/spotify-callback"]) {
      const retiredFile = await worker.fetch(`http://127.0.0.1${path}`, { method: "POST", body: "{}" });
      assert.equal(retiredFile.status, 410, path);
      assert.match(await retiredFile.text(), /The old web app has been retired\./, path);
    }
    const home = await worker.fetch("http://127.0.0.1/");
    assert.equal(home.status, 200);
    const homeHtml = await home.text();
    assert.match(homeHtml, /Take the road\. Keep the story\./);
    assert.equal(homeHtml.includes("The old web app has been retired."), false);
    assert.equal(hits.length, beforeRetired);
  } finally {
    await worker.stop();
    await new Promise<void>(resolve => origin.server.close(() => resolve()));
    chain.cleanup();
  }
});
