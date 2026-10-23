import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const web = join(import.meta.dirname, "..", "..", "web");

test("every public page footer credits JourneyDeck Studios", () => {
  const pages = readdirSync(web).filter(name => name.endsWith(".html"));
  const withFooter = pages.filter(name => /©\s*2026/.test(readFileSync(join(web, name), "utf8")));
  assert.ok(withFooter.length >= 18, `expected the public pages to carry a copyright footer, found ${withFooter.length}`);
  for (const name of withFooter) {
    const html = readFileSync(join(web, name), "utf8");
    assert.match(html, /© 2026 JourneyDeck Studios/, name);
    assert.doesNotMatch(html, /© 2026 Patrick Benjamin Stewart/, name);
  }
});
