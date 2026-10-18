import assert from "node:assert/strict";
import test from "node:test";
import type { SiteEnv } from "../src/env.ts";
import worker from "../src/index.ts";
import { APP_STORE_URL, RETIRED_API_BODY, retiredPageHtml } from "../src/retired.ts";

function siteEnv(): SiteEnv {
  return {
    ASSETS: {
      async fetch(input: RequestInfo | URL) {
        const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url);
        if (url.pathname === "/beta.html" || url.pathname === "/privacy.html" || url.pathname === "/support.html" || url.pathname === "/app.js") {
          return new Response(url.pathname, { status: 200, headers: { "content-type": "text/plain; charset=utf-8", etag: "W/\"asset\"" } });
        }
        return new Response("missing", { status: 404 });
      }
    },
    RENDER_ORIGIN: "https://driveos.onrender.com"
  };
}

test("the notice page names the retirement and links to the app and home", () => {
  const html = retiredPageHtml();
  assert.match(html, /The old web app has been retired\./);
  assert.match(html, /<meta name="robots" content="noindex">/);
  assert.equal(html.includes(`href="${APP_STORE_URL}"`), true);
  assert.equal(html.includes('href="/"'), true);
  assert.equal(html.includes('href="/login"'), false);
  assert.match(html, /\/public-page\.css/);
});

test("retired routes return 410 and the remaining shells still reach Render", async () => {
  const calls: string[] = [];
  const previous = globalThis.fetch;
  globalThis.fetch = async input => {
    calls.push(String(input));
    return new Response("{\"ok\":true}", { status: 200, headers: { "content-type": "application/json; charset=utf-8" } });
  };
  try {
    const env = siteEnv();
    const retired: Array<[string, string, "json" | "html"]> = [
      ["GET", "/api", "json"],
      ["GET", "/api/", "json"],
      ["GET", "/api/anything", "json"],
      ["POST", "/api/auth/login", "json"],
      ["PUT", "/api/recorder/sessions", "json"],
      ["PATCH", "/api/atlas/journeys", "json"],
      ["DELETE", "/api/photos/1", "json"],
      ["HEAD", "/api/health", "json"],
      ["OPTIONS", "/api/auth/session", "json"],
      ["GET", "/login", "html"],
      ["POST", "/login", "html"],
      ["HEAD", "/login/reset", "html"],
      ["GET", "/app", "html"],
      ["GET", "/app/library", "html"],
      ["DELETE", "/wife", "html"],
      ["GET", "/wife/home", "html"]
    ];
    for (const [method, path, kind] of retired) {
      const before = calls.length;
      const response = await worker.fetch(new Request(`https://journeydeck.me${path}`, { method, body: method === "GET" || method === "HEAD" ? undefined : "{}" }), env);
      assert.equal(calls.length, before, `${method} ${path} fetched Render`);
      assert.equal(response.status, 410, `${method} ${path}`);
      assert.equal(response.headers.get("cache-control"), "no-store", `${method} ${path}`);
      if (kind === "json") {
        assert.equal(response.headers.get("content-type"), "application/json; charset=utf-8", path);
        assert.deepEqual(await response.json(), RETIRED_API_BODY, `${method} ${path}`);
      } else {
        assert.equal(response.headers.get("content-type"), "text/html; charset=utf-8", path);
        assert.equal(response.headers.get("x-robots-tag"), "noindex", path);
        const html = await response.text();
        if (method === "HEAD") assert.equal(html, "", path);
        else {
          assert.match(html, /The old web app has been retired\./, path);
          assert.match(html, new RegExp(APP_STORE_URL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), path);
          assert.match(html, /href="\/"/, path);
        }
      }
    }

    const stillProxied = ["/healthz", "/readyz", "/spotify-callback", "/login.html", "/index.html", "/wife.html"];
    for (const path of stillProxied) {
      const response = await worker.fetch(new Request(`https://journeydeck.me${path}`), env);
      assert.equal(response.status, 200, path);
      assert.equal(calls.at(-1), `https://driveos.onrender.com${path}`, path);
    }
    assert.equal(calls.length, stillProxied.length);

    const home = await worker.fetch(new Request("https://journeydeck.me/"), env);
    assert.equal(home.status, 200);
    assert.equal(await home.text(), "/beta.html");
    const privacy = await worker.fetch(new Request("https://journeydeck.me/privacy"), env);
    assert.equal(privacy.status, 200);
    assert.equal(await privacy.text(), "/privacy.html");
    const support = await worker.fetch(new Request("https://journeydeck.me/support"), env);
    assert.equal(support.status, 200);
    assert.equal(await support.text(), "/support.html");
    const script = await worker.fetch(new Request("https://journeydeck.me/app.js"), env);
    assert.equal(script.status, 200);
    assert.equal(await script.text(), "/app.js");
    const docs = await worker.fetch(new Request("https://journeydeck.me/api-docs"), env);
    assert.notEqual(docs.status, 410);
    assert.equal(calls.length, stillProxied.length);
  } finally {
    globalThis.fetch = previous;
  }
});
