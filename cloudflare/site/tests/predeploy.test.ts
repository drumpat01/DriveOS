import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { collectProblems, deletedOnMain, isAssetsIgnored, parseAssetsIgnore } from "../predeploy-check.mjs";

const repo = join(import.meta.dirname, "..", "..", "..");
const removedScreenshots = [
  "assets/v2/soundtrack.jpg",
  "assets/v2/soundtrack.webp",
  "assets/v4/05-soundtrack.webp"
];

test("assets ignore matches the proxied html files", () => {
  const patterns = parseAssetsIgnore("# comment\nwife.html\nindex.html\nlogin.html\n");
  assert.equal(isAssetsIgnored("wife.html", patterns), true);
  assert.equal(isAssetsIgnored("assets/v2/soundtrack.webp", patterns), false);
  assert.equal(isAssetsIgnored("beta.html", patterns), false);
});

test("main deletions would fail the publish guard", () => {
  const deleted = deletedOnMain(repo, "origin/main");
  for (const rel of removedScreenshots) assert.equal(deleted.has(rel), true, rel);
  assert.equal(deleted.has("beta.html"), false);
  const problems = collectProblems(repo).filter(problem => problem.includes("would still be published"));
  assert.deepEqual(problems, []);
});

test("a text asset with CRLF fails and a binary byte does not", () => {
  const root = mkdtempSync(join(tmpdir(), "journeydeck-predeploy-"));
  const web = join(root, "web");
  mkdirSync(web);
  writeFileSync(join(web, "app.js"), "const ok = true;\r\n", { encoding: "utf8" });
  writeFileSync(join(web, "pixel.png"), Buffer.from([0x89, 0x0d, 0x0a]));
  const problems = collectProblems(root, "origin/main").filter(problem => problem.includes("CR"));
  assert.equal(problems.length, 1);
  assert.match(problems[0] || "", /web\/app\.js/);
});
