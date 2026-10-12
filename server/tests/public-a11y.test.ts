import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../src/app.js";
import { fixtureDatabase, root } from "./helpers.js";

const publicPages = ["/", "/privacy", "/support", "/terms", "/apple-music-soundtrack", "/private-driving-journal"];

test("public pages expose a skip link, 24px tap targets, and contrast overlay CSS", async () => {
  const fixture = fixtureDatabase();
  const runtime = await createApp({ databasePath: fixture.filename, root, allowTestAuth: true, legacyUpstream: "", mode: "web" });
  try {
    const css = await runtime.app.inject({ method: "GET", url: "/public-a11y.css?v=1" });
    assert.equal(css.statusCode, 200, css.body);
    assert.match(String(css.headers["content-type"]), /text\/css/);
    assert.equal(css.headers["cache-control"], "public, max-age=31536000, immutable");
    assert.match(css.body, /\.skip-link/);
    assert.match(css.body, /min-height: 24px/);
    assert.match(css.body, /min-width: 24px/);
    assert.match(css.body, /flex-wrap: nowrap/);
    assert.match(css.body, /#081832f8/);
    assert.doesNotMatch(css.body, /[\u2013\u2014]/);

    for (const url of publicPages) {
      const page = await runtime.app.inject({ method: "GET", url });
      assert.equal(page.statusCode, 200, url);
      assert.match(page.body, /class="skip-link" href="#main">Skip to content<\/a>/, url);
      assert.match(page.body, /id="main"/, url);
      assert.match(page.body, /href="\/public-a11y\.css\?v=1"/, url);
      assert.match(String(page.headers["content-security-policy"]), /default-src 'self'/, url);
    }

    const missing = await runtime.app.inject({ method: "GET", url: "/missing-public-page" });
    assert.equal(missing.statusCode, 404);
    assert.match(missing.body, /class="skip-link" href="#main">Skip to content<\/a>/);
    assert.match(missing.body, /href="\/public-a11y\.css\?v=1"/);
  } finally {
    await runtime.app.close();
    fixture.cleanup();
  }
});
