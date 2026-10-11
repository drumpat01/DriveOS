import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createApp } from "../src/app.js";
import { fixtureDatabase, root } from "./helpers.js";
import {
  assertCampaignAppStoreHrefs,
  assertDefaultAppStoreHrefs,
  canonicalUrlForPath,
  classifyConsoleError,
  compareGeneratedAtSince,
  evaluateLoginUmami,
  evaluatePublicPageHtml,
  extractAppStoreHrefs,
  extractDocumentTitle,
  findForbiddenTrialPhrases,
  findUmamiScripts,
  formatCheckLine,
  formatHumanReport,
  headlineMatches,
  joinBasePath,
  loadExpectations,
  parseJsonLdBlocks,
  parseVerifyLiveArgs,
  validateExpectations,
  withCacheBust
} from "../../tools/verify-live/lib.mjs";

const expectations = loadExpectations();
const APP_STORE = expectations.appStore.baseUrl;
const CAMPAIGN_QUERY = `pt=${expectations.appStore.providerToken}&ct=${expectations.campaign.expectedCampaignToken}&mt=${expectations.appStore.mediaType}`;

test("verify-live argument parser accepts --base, --json, and --since", () => {
  assert.deepEqual(parseVerifyLiveArgs([]), { base: "https://journeydeck.me", json: false, since: null });
  assert.deepEqual(parseVerifyLiveArgs(["--json", "--base", "http://127.0.0.1:8795/", "--since", "2026-10-11T12:55:00Z"]), {
    base: "http://127.0.0.1:8795",
    json: true,
    since: "2026-10-11T12:55:00Z"
  });
  assert.deepEqual(parseVerifyLiveArgs(["--base=https://journeydeck.me", "--since=2026-10-11T20:31:30Z"]), {
    base: "https://journeydeck.me",
    json: false,
    since: "2026-10-11T20:31:30Z"
  });
  assert.throws(() => parseVerifyLiveArgs(["--base"]), /requires a URL/);
  assert.throws(() => parseVerifyLiveArgs(["--unknown"]), /Unknown argument/);
});

test("expectations loader reads the checked-in file and rejects incomplete objects", () => {
  assert.deepEqual(expectations.publicPages, [
    "/",
    "/apple-music-soundtrack",
    "/private-driving-journal",
    "/support",
    "/privacy",
    "/terms"
  ]);
  assert.equal(expectations.umami.websiteId, "a5f66e11-ec7d-4133-8e1a-f8e6c08593af");
  assert.equal(expectations.umami.dataDomains, "journeydeck.me");
  assert.deepEqual(expectations.forbiddenTrialPhrases, ["3-day", "plus trial", "free trial"]);
  assert.equal(expectations.appStore.baseUrl, "https://apps.apple.com/us/app/journeydeck/id6806502526");
  assert.equal(expectations.appStore.providerToken, "129344416");
  assert.equal(expectations.appStore.mediaType, "8");
  assert.equal(expectations.campaign.query, "?utm_source=x&utm_medium=social&utm_campaign=launch_oct13");
  assert.equal(expectations.campaign.expectedCampaignToken, "x-launch_oct13");
  assert.equal(expectations.headlines.default.lead, "Take the road.");
  assert.equal(expectations.headlines.default.accent, "Keep the story.");
  assert.equal(expectations.headlines.x.lead, "Keep the drive.");
  assert.equal(expectations.headlines.x.accent, "Keep the song.");
  assert.throws(() => validateExpectations({}), /publicPages/);
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "journeydeck-verify-live-"));
  const filePath = path.join(directory, "expectations.json");
  fs.writeFileSync(filePath, JSON.stringify({ ...expectations, umami: { scriptSrc: expectations.umami.scriptSrc } }), "utf8");
  assert.throws(() => loadExpectations(filePath), /umami is incomplete/);
  fs.rmSync(directory, { recursive: true, force: true });
});

test("HTML helpers parse metadata, Umami, JSON-LD, and ignore generic trial terms", () => {
  const html = `<!doctype html><html><head>
    <title>JourneyDeck: Take the road. Keep the story.</title>
    <meta name="description" content="A private journal.">
    <link rel="canonical" href="https://journeydeck.me/">
    <meta property="og:title" content="JourneyDeck: Take the road. Keep the story.">
    <meta property="og:description" content="A private journal.">
    <meta property="og:url" content="https://journeydeck.me/">
    <meta property="og:image" content="https://journeydeck.me/assets/beta/share-card.png?v=1">
    <script defer src="https://cloud.umami.is/script.js" data-website-id="a5f66e11-ec7d-4133-8e1a-f8e6c08593af" data-domains="journeydeck.me"></script>
    <script type="application/ld+json">{"@type":"Organization","name":"JourneyDeck"}</script>
  </head><body>
    <h1 id="hero-title">Take the road.<br><span class="gold">Keep the story.</span></h1>
    <a href="https://apps.apple.com/us/app/journeydeck/id6806502526">Get the app</a>
    <a href="https://apps.apple.com/us/app/journeydeck/id6806502526?see-all=reviews">Reviews</a>
    <p>Available products, price, billing period, trial terms, and included features are shown before purchase.</p>
  </body></html>`;
  const title = extractDocumentTitle(html);
  assert.equal(title.count, 1);
  assert.match(String(title.value), /Take the road/);
  assert.equal(findUmamiScripts(html, expectations).length, 1);
  const jsonLd = parseJsonLdBlocks(['{"@type":"Organization","name":"JourneyDeck"}']);
  assert.equal(jsonLd.pass, true);
  assert.equal(jsonLd.count, 1);
  assert.deepEqual(findForbiddenTrialPhrases(html, expectations.forbiddenTrialPhrases), []);
  assert.deepEqual(findForbiddenTrialPhrases("Enjoy a 3-day Plus trial or a Free trial today.", expectations.forbiddenTrialPhrases), [
    "3-day",
    "plus trial",
    "free trial"
  ]);
  const broken = parseJsonLdBlocks(["{not-json"]);
  assert.equal(broken.pass, false);
  const checks = evaluatePublicPageHtml(html, "/", expectations, 200);
  assert.ok(checks.every((check) => check.pass), checks.filter((check) => !check.pass).map((check) => check.name).join(","));
  assert.equal(canonicalUrlForPath("/", expectations), "https://journeydeck.me/");
  assert.equal(canonicalUrlForPath("/support", expectations), "https://journeydeck.me/support");
  assert.equal(headlineMatches("Take the road.\nKeep the story.", expectations.headlines.default), true);
  assert.equal(headlineMatches("Keep the drive. Keep the song.", expectations.headlines.x), true);
  assert.equal(headlineMatches("Take the road. Keep the story.", expectations.headlines.x), false);
});

test("App Store href assertions keep campaign tokens, reviews, and the served default hrefs", () => {
  const served = [APP_STORE, `${APP_STORE}?see-all=reviews`];
  const campaign = [`${APP_STORE}?${CAMPAIGN_QUERY}`, `${APP_STORE}?see-all=reviews&${CAMPAIGN_QUERY}`];
  const campaignCheck = assertCampaignAppStoreHrefs(campaign, expectations);
  assert.equal(campaignCheck.pass, true, campaignCheck.problems.join("; "));
  const missingReviews = assertCampaignAppStoreHrefs([`${APP_STORE}?${CAMPAIGN_QUERY}`], expectations);
  assert.equal(missingReviews.pass, false);
  const defaultCheck = assertDefaultAppStoreHrefs(served, served, expectations);
  assert.equal(defaultCheck.pass, true, defaultCheck.problems.join("; "));
  const rewritten = assertDefaultAppStoreHrefs(campaign, served, expectations);
  assert.equal(rewritten.pass, false);
  assert.deepEqual(extractAppStoreHrefs(`<a href="${APP_STORE}"></a><a href="/support"></a>`, expectations), [APP_STORE]);
});

test("readyz --since compares Atlas snapshot time, not deploy time", () => {
  const newer = compareGeneratedAtSince("2026-10-11T20:31:30.000Z", "2026-10-11T12:55:00.000Z");
  assert.equal(newer.pass, true);
  const older = compareGeneratedAtSince("2026-10-11T12:55:00.000Z", "2026-10-11T20:31:30.000Z");
  assert.equal(older.pass, false);
  const missing = compareGeneratedAtSince(null, "2026-10-11T12:55:00.000Z");
  assert.equal(missing.pass, false);
  const skipped = compareGeneratedAtSince("2026-10-11T20:31:30.000Z", null);
  assert.equal(skipped.compared, false);
  assert.equal(skipped.pass, true);
  const invalid = compareGeneratedAtSince("2026-10-11T20:31:30.000Z", "not-a-date");
  assert.equal(invalid.pass, false);
});

test("cache-busting, URL joining, CSP classification, and report text stay ASCII-hyphen clean", () => {
  assert.equal(joinBasePath("http://127.0.0.1:8795/", "/support"), "http://127.0.0.1:8795/support");
  assert.match(withCacheBust("https://journeydeck.me/", "abc"), /[?&]jd_verify=abc/);
  assert.match(withCacheBust("https://journeydeck.me/?utm_source=x", "abc"), /utm_source=x/);
  assert.equal(classifyConsoleError("Failed to load resource: net::ERR_FAILED https://gateway.umami.is/api/send").label, "blocked by verifier");
  assert.equal(classifyConsoleError("Failed to load resource: net::ERR_FAILED https://gateway.umami.is/api/send").fail, false);
  assert.equal(classifyConsoleError("Refused to connect because it violates the following Content Security Policy directive").fail, true);
  assert.equal(classifyConsoleError("Image failed to load").fail, false);
  const line = formatCheckLine({ name: "readyz", pass: true, observed: { generatedAtUtc: "2026-10-11T20:31:30.000Z" } });
  assert.match(line, /^PASS readyz /);
  assert.doesNotMatch(line, /[\u2013\u2014]/);
  const report = formatHumanReport({
    checks: [{ name: "readyz", pass: true, observed: { ok: true } }],
    base: "http://127.0.0.1:8795",
    timestamp: "2026-10-11T21:00:00.000Z",
    ok: true,
    readyz: { generatedAtUtc: "2026-10-11T20:31:30.000Z" }
  });
  assert.match(report, /service restart \/ snapshot time/);
  assert.match(report, /^PASS$/m);
  assert.doesNotMatch(report, /[\u2013\u2014]/);
  assert.doesNotMatch(report, /deploy time/);
});

test("in-process web app HTML satisfies the verify-live public page checks", async () => {
  const fixture = fixtureDatabase();
  const runtime = await createApp({ databasePath: fixture.filename, root, allowTestAuth: true, legacyUpstream: "", mode: "web" });
  try {
    for (const pathname of expectations.publicPages) {
      const page = await runtime.app.inject({ method: "GET", url: pathname });
      const checks = evaluatePublicPageHtml(page.body, pathname, expectations, page.statusCode);
      assert.ok(checks.every((check) => check.pass), `${pathname}: ${checks.filter((check) => !check.pass).map((check) => `${check.name} ${JSON.stringify(check.observed)}`).join("; ")}`);
    }
    const login = await runtime.app.inject({ method: "GET", url: expectations.loginPath });
    const loginChecks = evaluateLoginUmami(login.body, expectations, login.statusCode);
    assert.ok(loginChecks.every((check) => check.pass), loginChecks.filter((check) => !check.pass).map((check) => check.name).join(","));
    const ready = await runtime.app.inject({ method: "GET", url: "/readyz" });
    assert.equal(ready.statusCode, 200);
    const body = JSON.parse(ready.body) as { ok?: boolean; atlas?: { generatedAtUtc?: string | null } };
    assert.equal(body.ok, true);
    assert.equal(typeof body.atlas?.generatedAtUtc, "string");
    const comparison = compareGeneratedAtSince(body.atlas?.generatedAtUtc ?? null, "2000-01-01T00:00:00.000Z");
    assert.equal(comparison.pass, true);
  } finally {
    await runtime.app.close();
    fixture.cleanup();
  }
});
