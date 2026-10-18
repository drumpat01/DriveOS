import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import type { SiteEnv } from "../src/env.ts";
import { HEALTH_BODY } from "../src/health.ts";
import worker from "../src/index.ts";
import { probePathFor, parseRouteList } from "../src/routes.ts";

const routes = parseRouteList(readFileSync(new URL("../route-list.csv", import.meta.url), "utf8"));

function siteEnv(): SiteEnv {
  return {
    ASSETS: {
      async fetch(input: RequestInfo | URL) {
        const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url);
        return new Response(url.pathname, { status: 200, headers: { "content-type": "text/plain; charset=utf-8", etag: "W/\"asset\"" } });
      }
    }
  };
}

test("GET and HEAD health routes are Worker JSON and do not fetch", async () => {
  const calls: string[] = [];
  const previous = globalThis.fetch;
  globalThis.fetch = async input => {
    calls.push(String(input));
    return new Response("upstream", {
      status: 599,
      headers: {
        "x-render-origin-server": "render",
        "rndr-id": "render"
      }
    });
  };
  try {
    const env = siteEnv();
    for (const path of ["/healthz", "/readyz", "/healthz?device=1", "/readyz?atlas=1"]) {
      const get = await worker.fetch(new Request(`https://journeydeck.me${path}`), env);
      assert.equal(get.status, 200, path);
      assert.equal(get.headers.get("cache-control"), "no-store", path);
      assert.equal(get.headers.get("content-type"), "application/json; charset=utf-8", path);
      assert.equal(get.headers.get("x-render-origin-server"), null, path);
      assert.equal(get.headers.get("rndr-id"), null, path);
      assert.equal(await get.text(), JSON.stringify(HEALTH_BODY), path);

      const head = await worker.fetch(new Request(`https://journeydeck.me${path}`, { method: "HEAD" }), env);
      assert.equal(head.status, 200, `HEAD ${path}`);
      assert.equal(head.headers.get("cache-control"), "no-store", `HEAD ${path}`);
      assert.equal(head.headers.get("content-type"), "application/json; charset=utf-8", `HEAD ${path}`);
      assert.equal(head.headers.get("x-render-origin-server"), null, `HEAD ${path}`);
      assert.equal(await head.text(), "", `HEAD ${path}`);
    }
    for (const path of ["/healthz", "/readyz"]) {
      for (const method of ["POST", "PUT", "PATCH", "DELETE", "OPTIONS"]) {
        const denied = await worker.fetch(new Request(`https://journeydeck.me${path}`, {
          method,
          body: method === "OPTIONS" ? undefined : "{}"
        }), env);
        assert.equal(denied.status, 405, `${method} ${path}`);
        assert.equal(denied.headers.get("allow"), "GET, HEAD", `${method} ${path}`);
        assert.equal(denied.headers.get("cache-control"), "no-store", `${method} ${path}`);
        assert.equal(denied.headers.get("content-type"), "application/json; charset=utf-8", `${method} ${path}`);
        assert.deepEqual(await denied.json(), { error: "Method not allowed." }, `${method} ${path}`);
      }
      const nested = await worker.fetch(new Request(`https://journeydeck.me${path}/extra`), env);
      assert.equal(nested.status, 404, `${path}/extra`);
      await nested.arrayBuffer();
    }
    assert.deepEqual(calls, []);
  } finally {
    globalThis.fetch = previous;
  }
});

test("no route fetches onrender", async () => {
  const calls: string[] = [];
  const previous = globalThis.fetch;
  globalThis.fetch = async input => {
    const url = String(input);
    calls.push(url);
    throw new Error(`unexpected fetch ${url}`);
  };
  try {
    const env = siteEnv();
    for (const route of routes) {
      if (route.worker_action === "none") continue;
      const method = route.method === "ALL" ? "POST" : route.method;
      const response = await worker.fetch(new Request(new URL(probePathFor(route), "https://journeydeck.me"), {
        method,
        body: method === "GET" || method === "HEAD" ? undefined : "{}"
      }), env);
      assert.equal(calls.length, 0, `${method} ${route.path}`);
      await response.arrayBuffer();
    }
    assert.deepEqual(calls.filter(url => url.toLowerCase().includes("onrender")), []);
    assert.equal(calls.length, 0);
    assert.equal(routes.some(route => route.phase1_owner === "passthrough" || route.target === "RENDER_ORIGIN"), false);
    const siteRoot = join(import.meta.dirname, "..");
    for (const file of ["src/index.ts", "src/env.ts", "src/health.ts", "wrangler.jsonc"]) {
      assert.equal(readFileSync(join(siteRoot, file), "utf8").toLowerCase().includes("onrender"), false, file);
    }
  } finally {
    globalThis.fetch = previous;
  }
});
