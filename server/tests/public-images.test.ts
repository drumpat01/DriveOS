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
    assert.match(home.body, /rel="preload" as="image" href="\/assets\/beta\/grand-touring-home-800\.webp\?v=1" imagesrcset="\/assets\/beta\/grand-touring-home-800\.webp\?v=1 800w, \/assets\/beta\/grand-touring-home-1600\.webp\?v=1 1600w"/);
    assert.doesNotMatch(home.body, /rel="preload"[^>]*01-today/);
    assert.match(home.body, /01-today-400\.webp\?v=1/);
    assert.match(home.body, /01-today\.webp\?v=1 660w/);
    assert.match(home.body, /imagesrcset="/);
    assert.match(home.body, /imagesizes="/);
    assert.match(home.body, /fetchpriority="high"/);
    assert.match(home.body, /srcset="\/assets\/v4\/01-today-400\.webp\?v=1 400w/);
    assert.doesNotMatch(home.body, /data-feature="Today"[^>]*<img[^>]*loading="lazy"/);
    assert.match(home.body, /grand-touring-home-800\.webp\?v=1 800w/);
    assert.match(home.body, /grand-touring-home-1600\.webp\?v=1 1600w/);
    assert.match(home.body, /class="hero-photo" src="\/assets\/beta\/grand-touring-home-800\.webp\?v=1"/);
    assert.match(home.body, /favicon-32\.png\?v=app-logo-1/);
    assert.match(home.body, /\/assets\/favicon\.png\?v=app-logo-1/);

    assert.equal(home.body.includes("/assets/v4/05-soundtrack.webp"), false);
    assert.equal(home.body.includes("/assets/v2/soundtrack.webp"), false);
    assert.equal(home.body.includes("/assets/v2/soundtrack.jpg"), false);
    assert.match(home.body, /data-feature="Soundtrack"[\s\S]*?src="\/assets\/v4\/05-soundtrack-sample-400\.webp\?v=1" width="660" height="1434" alt="JourneyDeck Soundtrack screen with this month's road anthem, Golden Hour Highway by The Marlow Set, and listening stats from sample drives\."/);
    assert.match(home.body, /05-soundtrack-sample-400\.avif\?v=1 400w, \/assets\/v4\/05-soundtrack-sample\.avif\?v=1 660w/);
    assert.match(home.body, /05-soundtrack-sample-400\.webp\?v=1 400w, \/assets\/v4\/05-soundtrack-sample\.webp\?v=1 660w/);
    assert.match(home.body, /class="showcase-visual"[^>]*><picture>[\s\S]*?src="\/assets\/v4\/02-journey-400\.webp\?v=1" width="660" height="1434"/);
    assert.match(home.body, /02-journey-400\.avif\?v=1 400w, \/assets\/v4\/02-journey\.avif\?v=1 660w/);
    assert.match(home.body, /grand-touring-memories-400\.webp\?v=1 400w, \/assets\/beta\/grand-touring-memories-800\.webp\?v=1 800w/);
    assert.match(home.body, /grand-touring-memories-400\.avif\?v=1 400w/);
    const tourScript = await runtime.app.inject({ method: "GET", url: "/beta.js?v=v4-1" });
    assert.equal(tourScript.statusCode, 200, tourScript.body);
    assert.match(tourScript.body, /title: 'Hear the memory again\.'/);
    assert.match(tourScript.body, /The songs you played belong to the story/);

    for (const [url, mime] of [
      ["/assets/v4/01-today-400.webp?v=1", /image\/webp/],
      ["/assets/v4/01-today.webp?v=1", /image\/webp/],
      ["/assets/v4/02-journey.webp", /image\/webp/],
      ["/assets/v4/05-soundtrack-sample.webp", /image\/webp/],
      ["/assets/v2/soundtrack-sample.webp", /image\/webp/],
      ["/assets/v2/soundtrack-sample.webp?v=1", /image\/webp/],
      ["/assets/v2/soundtrack-sample.jpg", /image\/jpeg/],
      ["/assets/beta/grand-touring-home-800.webp?v=1", /image\/webp/],
      ["/assets/beta/grand-touring-home-1600.webp?v=1", /image\/webp/],
      ["/assets/v4/02-journey-400.webp?v=1", /image\/webp/],
      ["/assets/v4/02-journey-400.avif?v=1", /image\/avif/],
      ["/assets/v4/02-journey.avif?v=1", /image\/avif/],
      ["/assets/v4/05-soundtrack-sample-400.webp?v=1", /image\/webp/],
      ["/assets/v4/05-soundtrack-sample.avif?v=1", /image\/avif/],
      ["/assets/beta/grand-touring-memories-400.webp?v=1", /image\/webp/],
      ["/assets/beta/grand-touring-memories-800.avif?v=1", /image\/avif/],
      ["/assets/beta/journeydeck-pulse.svg?v=1", /image\/svg\+xml/],
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
      "/assets/v4/02-journey-400.avif?v=1",
      "/assets/v4/05-soundtrack-sample.webp?v=1",
      "/assets/beta/grand-touring-memories-800.webp?v=1",
      "/assets/beta/journeydeck-pulse.svg?v=1",
      "/assets/favicon-32.png?v=app-logo-1",
      "/assets/v2/soundtrack-sample.webp?v=1"
    ]) {
      const versioned = await runtime.app.inject({ method: "GET", url });
      assert.equal(versioned.headers["cache-control"], "public, max-age=31536000, immutable", url);
    }

    for (const url of ["/assets/v4/05-soundtrack.webp", "/assets/v2/soundtrack.webp", "/assets/v2/soundtrack.webp?v=1", "/assets/v2/soundtrack.jpg"]) {
      const removed = await runtime.app.inject({ method: "GET", url });
      assert.equal(removed.statusCode, 404, url);
      assert.doesNotMatch(String(removed.headers["content-type"] || ""), /image\//, url);
      assert.doesNotMatch(String(removed.headers["cache-control"] || ""), /immutable|max-age=31536000|max-age=604800/, url);
    }

    const soundtrack = await runtime.app.inject({ method: "GET", url: "/apple-music-soundtrack" });
    assert.equal(soundtrack.statusCode, 200, soundtrack.body);
    assert.match(soundtrack.body, /src="\/assets\/v2\/soundtrack-sample\.webp\?v=1" width="600" height="1304" loading="lazy" alt="JourneyDeck Soundtrack screen with this month's road anthem, Golden Hour Highway by The Marlow Set, and listening stats from sample drives\."/);
    assert.equal(soundtrack.body.includes("/assets/v4/05-soundtrack.webp"), false);
    assert.equal(soundtrack.body.includes("/assets/v2/soundtrack.webp"), false);
    assert.equal(soundtrack.body.includes("/assets/v2/soundtrack.jpg"), false);
    assert.doesNotMatch(soundtrack.body, /<picture/);

    const htmlRoutes = [
      "/",
      "/apple-music-soundtrack",
      "/private-driving-journal",
      "/road-trip-journal-app",
      "/travel-journal-app-iphone",
      "/road-trip-tracker-app",
      "/travel-journal-app-with-photos",
      "/driving-history-app",
      "/route-66-road-trip-journal",
      "/pacific-coast-highway-road-trip-journal",
      "/national-parks-road-trip-journal",
      "/texas-hill-country-road-trip-journal",
      "/tesla-drive-journal",
      "/support",
      "/support.html",
      "/privacy",
      "/privacy.html",
      "/terms",
      "/terms.html",
      "/login",
      "/login.html",
      "/index.html",
      "/api-docs",
      "/wife",
      "/wife.html",
      "/app",
      "/spotify-callback",
      "/beta",
      "/beta.html",
      "/landing.html",
      "/a-page-that-does-not-exist"
    ];
    for (const url of htmlRoutes) {
      const page = await runtime.app.inject({
        method: "GET",
        url,
        headers: { "x-journeydeck-test-auth": "owner" }
      });
      assert.match(String(page.headers["content-type"]), /text\/html/, url);
      assert.equal(page.body.includes("/assets/v4/05-soundtrack.webp"), false, url);
      assert.equal(page.body.includes("/assets/v2/soundtrack.webp"), false, url);
      assert.equal(page.body.includes("/assets/v2/soundtrack.jpg"), false, url);
    }
  } finally {
    await runtime.app.close();
    fixture.cleanup();
  }
});
