import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../src/app.js";
import { fixtureDatabase, root } from "./helpers.js";

const publicPages = ["/", "/privacy", "/support", "/terms", "/apple-music-soundtrack", "/private-driving-journal"];

test("public marketing copy uses JourneyDeck 4.0, matching hero App Store labels, and annual Plus pricing", async () => {
  const fixture = fixtureDatabase();
  const runtime = await createApp({ databasePath: fixture.filename, root, allowTestAuth: true, legacyUpstream: "", mode: "web" });
  try {
    const home = await runtime.app.inject({ method: "GET", url: "/" });
    assert.equal(home.statusCode, 200, home.body);
    assert.match(home.body, /JOURNEYDECK 4\.0/);
    assert.match(home.body, /class="button app-store-button" href="https:\/\/apps\.apple\.com\/us\/app\/journeydeck\/id6806502526"/);
    assert.match(home.body, /<small>Download on the<\/small>App Store/);
    assert.match(home.body, /class="closing-actions"[\s\S]*app-store-button/);
    assert.doesNotMatch(home.body, /JOURNEYDECK 2\.0|JourneyDeck 2\.0/);

    const soundtrack = await runtime.app.inject({ method: "GET", url: "/apple-music-soundtrack" });
    assert.equal(soundtrack.statusCode, 200, soundtrack.body);
    assert.match(soundtrack.body, /THE SOUNDTRACK \/ JOURNEYDECK 4\.0/);
    assert.match(soundtrack.body, /Soundtracks in JourneyDeck 4\.0/);
    assert.match(soundtrack.body, /Download on the App Store/);
    assert.doesNotMatch(soundtrack.body, /JOURNEYDECK 2\.0|JourneyDeck 2\.0/);

    const journal = await runtime.app.inject({ method: "GET", url: "/private-driving-journal" });
    assert.equal(journal.statusCode, 200, journal.body);
    assert.match(journal.body, /class="contact" href="https:\/\/apps\.apple\.com\/us\/app\/journeydeck\/id6806502526">Download on the App Store/);
    assert.doesNotMatch(journal.body, /Start free on iPhone/);
    assert.match(journal.body, /sit with the road\. It is not a navigation app or an automatic cloud trip log\./);
    assert.match(journal.body, /everyday drives and longer trips, without/);
    assert.doesNotMatch(journal.body, /[\u2013\u2014]/);

    for (const url of publicPages) {
      const page = await runtime.app.inject({ method: "GET", url });
      assert.equal(page.statusCode, 200, url);
      assert.match(page.body, /\$39\.99\/year/, url);
      assert.match(page.body, /7-day free trial/, url);
      // The old trial-wording ban covered "3-day", "plus trial", and "free trial".
      // Only the 3-day wording stays forbidden. A 7-day free trial is the annual offer.
      assert.doesNotMatch(page.body, /3-day/i, url);
      assert.doesNotMatch(page.body, /0\.99/, url);
      assert.doesNotMatch(page.body, /24\.99/, url);
    }

    const terms = await runtime.app.inject({ method: "GET", url: "/terms" });
    assert.match(terms.body, /trial terms/);
  } finally {
    await runtime.app.close();
    fixture.cleanup();
  }
});
