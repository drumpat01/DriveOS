import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
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
    assert.match(home.body, /class="button app-store-button" href="https:\/\/apps\.apple\.com\/us\/app\/journeydeck\/id6806502526\?pt=129344416&ct=home&mt=8"/);
    assert.match(home.body, /<small>Download on the<\/small>App Store/);
    assert.match(home.body, /class="closing-actions"[\s\S]*app-store-button/);
    assert.doesNotMatch(home.body, /JOURNEYDECK 2\.0|JourneyDeck 2\.0/);

    const soundtrack = await runtime.app.inject({ method: "GET", url: "/apple-music-soundtrack" });
    assert.equal(soundtrack.statusCode, 200, soundtrack.body);
    assert.match(soundtrack.body, /THE SOUNDTRACK \/ JOURNEYDECK 4\.0/);
    assert.match(soundtrack.body, /I used a sample profile for this one\. This month's road anthem is Golden Hour Highway by The Marlow Set\./);
    assert.match(soundtrack.body, /alt="JourneyDeck Soundtrack screen with this month's road anthem, Golden Hour Highway by The Marlow Set, and listening stats from sample drives\."/);
    assert.doesNotMatch(soundtrack.body, /\/assets\/v2\/soundtrack\.(?:webp|jpg)|\/assets\/v4\/05-soundtrack\.webp/);
    assert.match(soundtrack.body, /Download on the App Store/);
    assert.doesNotMatch(soundtrack.body, /JOURNEYDECK 2\.0|JourneyDeck 2\.0/);

    const journal = await runtime.app.inject({ method: "GET", url: "/private-driving-journal" });
    assert.equal(journal.statusCode, 200, journal.body);
    assert.match(journal.body, /class="contact" href="https:\/\/apps\.apple\.com\/us\/app\/journeydeck\/id6806502526\?pt=129344416&ct=private_journal&mt=8">Download on the App Store/);
    assert.doesNotMatch(journal.body, /Start free on iPhone/);
    assert.match(journal.body, /sit with the road\. It is not a navigation app or an automatic cloud trip log\./);
    assert.match(journal.body, /everyday drives and longer trips, without/);
    assert.doesNotMatch(journal.body, /[\u2013\u2014]/);

    for (const url of publicPages) {
      const page = await runtime.app.inject({ method: "GET", url });
      assert.equal(page.statusCode, 200, url);
      assert.match(page.body, /\$39\.99\/yr(?!e)/, url);
      assert.doesNotMatch(page.body, /\$39\.99\/year/, url);
      assert.match(page.body, /7-day free trial/, url);
      // The old trial-wording ban covered "3-day", "plus trial", and "free trial".
      // Only the 3-day wording stays forbidden. A 7-day free trial is the annual offer.
      assert.doesNotMatch(page.body, /3-day/i, url);
      assert.doesNotMatch(page.body, /0\.99/, url);
      assert.doesNotMatch(page.body, /24\.99/, url);
    }

    const terms = await runtime.app.inject({ method: "GET", url: "/terms" });
    assert.match(terms.body, /trial terms/);
    assert.match(terms.body, /For in-app subscriptions only, refund requests are handled under Apple/);
    assert.match(terms.body, /id="studio-products"/);
    assert.match(terms.body, /within 7 days of purchase and I’ll refund you/);
    assert.match(terms.body, /mailto:support@journeydeck\.me\?subject=JourneyDeck%20Terms/);
    assert.doesNotMatch(terms.body, /journeydeckapp@gmail\.com/);
    const studio = terms.body.match(/<article class="card" id="studio-products">[\s\S]*?<\/article>/);
    assert.ok(studio, "studio products section");
    assert.equal(studio[0].match(/<a href="mailto:support@journeydeck\.me">/g)?.length, 1);
    assert.doesNotMatch(studio[0], /[\u2013\u2014]/);
  } finally {
    await runtime.app.close();
    fixture.cleanup();
  }
});

function htmlFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) return htmlFiles(path);
    return path.endsWith(".html") ? [path] : [];
  });
}

test("every web html description is 155 characters or fewer", () => {
  const files = htmlFiles(join(root, "web"));
  assert.ok(files.length > 0);
  for (const file of files) {
    const html = readFileSync(file, "utf8");
    for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
      const name = (/\b(?:name|property)\s*=\s*"([^"]+)"/i.exec(tag)?.[1] ?? "").toLowerCase();
      if (name !== "description" && name !== "og:description" && name !== "twitter:description") continue;
      const content = /\bcontent\s*=\s*"([^"]*)"/i.exec(tag)?.[1] ?? "";
      assert.ok(content.length > 0 && content.length <= 155, `${file} ${name} is ${content.length}`);
      assert.doesNotMatch(content, /[\u2013\u2014]/, `${file} ${name}`);
      assert.match(content, /\b(you|your|yours|yourself)\b/i, `${file} ${name}`);
      assert.doesNotMatch(content, /\b(I|we|us|our|ours|my|mine)\b/, `${file} ${name}`);
    }
  }
  for (const name of ["landing.html", "404.html"]) {
    assert.doesNotMatch(readFileSync(join(root, "web", name), "utf8"), /[\u2013\u2014]/, name);
  }
});
