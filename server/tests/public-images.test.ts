import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../src/app.js";
import { fixtureDatabase, root } from "./helpers.js";

test("home page hero and scenic photos use versioned responsive srcset", async () => {
  const fixture = fixtureDatabase();
  const runtime = await createApp({ databasePath: fixture.filename, root, allowTestAuth: true, legacyUpstream: "", mode: "web" });
  try {
    const home = await runtime.app.inject({ method: "GET", url: "/" });
    assert.equal(home.statusCode, 200, home.body);
    assert.match(home.body, /rel="preload" as="image"/);
    assert.match(home.body, /01-today-400\.webp\?v=1/);
    assert.match(home.body, /01-today\.webp\?v=1 660w/);
    assert.match(home.body, /imagesrcset="/);
    assert.match(home.body, /imagesizes="/);
    assert.match(home.body, /fetchpriority="high"/);
    assert.match(home.body, /srcset="\/assets\/v4\/01-today-400\.webp\?v=1 400w/);
    assert.doesNotMatch(home.body, /data-feature="Today"[^>]*<img[^>]*loading="lazy"/);
    assert.match(home.body, /grand-touring-home-800\.webp\?v=1 800w/);
    assert.match(home.body, /grand-touring-home-1600\.webp\?v=1 1600w/);
    assert.match(home.body, /favicon-32\.png\?v=app-logo-1/);
    assert.match(home.body, /\/assets\/favicon\.png\?v=app-logo-1/);

    for (const [url, mime] of [
      ["/assets/v4/01-today-400.webp?v=1", /image\/webp/],
      ["/assets/v4/01-today.webp?v=1", /image\/webp/],
      ["/assets/beta/grand-touring-home-800.webp?v=1", /image\/webp/],
      ["/assets/beta/grand-touring-home-1600.webp?v=1", /image\/webp/],
      ["/assets/v2/soundtrack.webp?v=1", /image\/webp/],
      ["/assets/favicon-32.png?v=app-logo-1", /image\/png/],
      ["/favicon.ico", /image\/x-icon|image\/vnd\.microsoft\.icon|image\/png|application\/octet-stream/],
      ["/assets/medallions/soundtrack-100-redline-pick.webp", /image\/webp/],
      ["/assets/medallions/first-note-dark-pick.webp", /image\/webp/]
    ] as const) {
      const asset = await runtime.app.inject({ method: "GET", url });
      assert.equal(asset.statusCode, 200, url);
      assert.match(String(asset.headers["content-type"]), mime, url);
    }

    for (const url of [
      "/assets/v4/01-today-400.webp?v=1",
      "/assets/beta/grand-touring-home-800.webp?v=1",
      "/assets/beta/grand-touring-home-1600.webp?v=1",
      "/assets/v2/soundtrack.webp?v=1",
      "/assets/favicon-32.png?v=app-logo-1"
    ]) {
      const versioned = await runtime.app.inject({ method: "GET", url });
      assert.equal(versioned.headers["cache-control"], "public, max-age=31536000, immutable", url);
    }

    const soundtrack = await runtime.app.inject({ method: "GET", url: "/apple-music-soundtrack" });
    assert.equal(soundtrack.statusCode, 200, soundtrack.body);
    assert.match(soundtrack.body, /\/assets\/v2\/soundtrack\.webp\?v=1/);
    assert.doesNotMatch(soundtrack.body, /\/assets\/v2\/soundtrack\.jpg"/);
  } finally {
    await runtime.app.close();
    fixture.cleanup();
  }
});
