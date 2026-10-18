import assert from "node:assert/strict";
import test from "node:test";
import { unstable_dev } from "wrangler";

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
