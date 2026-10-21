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
  evaluateLaunchBadge,
  evaluateLoginUmami,
  evaluateSiteHealth,
  evaluateInsightsCsp,
  evaluateNotFoundAppStore,
  evaluateOfferSchema,
  evaluatePublicPageHtml,
  evaluateRetiredPage,
  evaluateRobotsTxt,
  evaluateRedirect,
  evaluateRemovedPublicImages,
  evaluateSamplePublicImages,
  evaluateUmamiScripts,
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
  runChecksContinuing,
  scriptSrcHost,
  validateExpectations,
  withCacheBust
} from "../../tools/verify-live/lib.mjs";

const expectations = loadExpectations();
const RETIRED_HTML = `<!doctype html><html><head><meta name="robots" content="noindex"><title>The old web app has been retired · JourneyDeck</title></head><body><h1>The old web app has been retired.</h1></body></html>`;
const RETIRED_HEADERS = { robots: "noindex", cacheControl: "no-store" };
const APP_STORE = expectations.appStore.baseUrl;
const CAMPAIGN_QUERY = `pt=${expectations.appStore.providerToken}&ct=${expectations.campaign.expectedCt}&mt=${expectations.appStore.mediaType}`;

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
    "/road-trip-journal-app",
    "/road-trip-tracker-app",
    "/travel-journal-app-with-photos",
    "/driving-history-app",
    "/route-66-road-trip-journal",
    "/pacific-coast-highway-road-trip-journal",
    "/national-parks-road-trip-journal",
    "/texas-hill-country-road-trip-journal",
    "/tesla-drive-journal",
    "/support",
    "/privacy",
    "/terms"
  ]);
  assert.deepEqual(expectations.retiredPages, {
    status: 410,
    robots: "noindex",
    cacheControl: "no-store",
    phrase: "The old web app has been retired",
    paths: ["/app", "/wife", "/wife.html", "/index.html", "/spotify-callback", "/login.html", "/login"]
  });
  assert.equal(evaluateRetiredPage(RETIRED_HTML, "/wife.html", expectations.retiredPages, 410, RETIRED_HEADERS).pass, true);
  assert.equal(evaluateRetiredPage(RETIRED_HTML, "/wife.html", expectations.retiredPages, 302, RETIRED_HEADERS).pass, false);
  assert.equal(evaluateRetiredPage(RETIRED_HTML, "/wife.html", expectations.retiredPages, 410, { robots: "noindex, nofollow", cacheControl: "no-store" }).pass, false);
  assert.equal(evaluateRetiredPage("<html><head><meta name=\"robots\" content=\"noindex\"></head></html>", "/app", expectations.retiredPages, 410, RETIRED_HEADERS).pass, false);
  assert.throws(() => validateExpectations({ ...expectations, retiredPages: { ...expectations.retiredPages, status: 302 } }), /retiredPages status/);
  assert.throws(() => validateExpectations({ ...expectations, retiredPages: { ...expectations.retiredPages, paths: ["/"] } }), /public page/);
  assert.deepEqual(expectations.redirects, [
    { path: "/homeworld", status: 301, location: "https://studio.journeydeck.me/homeworld" },
    { path: "/homeworld/", status: 301, location: "https://studio.journeydeck.me/homeworld" }
  ]);
  assert.equal(evaluateRedirect(301, "https://studio.journeydeck.me/homeworld", expectations.redirects[0]).pass, true);
  assert.equal(evaluateRedirect(404, null, expectations.redirects[0]).pass, false);
  assert.equal(expectations.umami.websiteId, "a5f66e11-ec7d-4133-8e1a-f8e6c08593af");
  assert.equal(expectations.umami.dataDomains, "journeydeck.me");
  assert.deepEqual(expectations.forbiddenTrialPhrases, ["3-day"]);
  assert.deepEqual(expectations.forbiddenPricePhrases, ["0.99", "24.99", "$39.99/year", "per week", "weekly"]);
  assert.deepEqual(expectations.requiredPricingPhrases, ["$39.99/yr", "7-day free trial"]);
  assert.equal(expectations.maxMetaDescriptionLength, 155);
  assert.equal(expectations.robotsTxt.contentSignal, "Content-Signal: ai-train=no, search=yes, ai-input=yes");
  assert.deepEqual(expectations.contentSecurityPolicy.scriptHosts, ["https://static.cloudflareinsights.com"]);
  assert.deepEqual(expectations.contentSecurityPolicy.connectHosts, ["https://cloudflareinsights.com"]);
  assert.throws(() => validateExpectations({ ...expectations, robotsTxt: { contentSignal: "Content-Signal: ai-train=no, search=yes, ai-input=no" } }), /AI answers/);
  assert.throws(() => validateExpectations({ ...expectations, contentSecurityPolicy: { scriptHosts: [], connectHosts: [] } }), /Cloudflare Web Analytics/);
  assert.equal(expectations.appStore.baseUrl, "https://apps.apple.com/us/app/journeydeck/id6806502526");
  assert.equal(expectations.appStore.providerToken, "129344416");
  assert.equal(expectations.appStore.mediaType, "8");
  assert.equal(expectations.appStore.notFoundPath, "/not-a-published-page");
  assert.equal(expectations.appStore.pageCampaigns["/"], "home");
  assert.equal(expectations.appStore.pageCampaigns["/tesla-drive-journal"], "tesla_page");
  assert.equal(expectations.pages["/tesla-drive-journal"].headline, "The trip, later");
  assert.deepEqual(expectations.pages["/tesla-drive-journal"].requiredPricingPhrases, [
    "JourneyDeck Plus, $39.99/yr, 7-day free trial for new subscribers"
  ]);
  assert.ok(expectations.pages["/tesla-drive-journal"].forbiddenPhrases.includes("2.99"));
  assert.ok(expectations.pages["/tesla-drive-journal"].forbiddenPhrases.includes("monthly"));
  assert.ok(expectations.pages["/tesla-drive-journal"].forbiddenPhrases.includes("$39.99/year"));
  assert.ok(expectations.pages["/tesla-drive-journal"].requiredPhrases.includes("Plus keeps your full history and Atlas, and adds automatic drive and charging history with Tessie."));
  assert.ok(expectations.pages["/tesla-drive-journal"].requiredPhrases.includes("Neither one shows a Tesla drive."));
  assert.ok(expectations.pages["/tesla-drive-journal"].requiredPhrases.includes("Keep your Tesla drives and charging history on your iPhone."));
  assert.ok(expectations.pages["/tesla-drive-journal"].requiredPhrases.includes("Try the free trial of JourneyDeck Plus, then $39.99 a year."));
  assert.equal(expectations.appStore.pageCampaigns["/apple-music-soundtrack"], "soundtrack");
  assert.equal(expectations.appStore.pageCampaigns["/private-driving-journal"], "private_journal");
  assert.equal(expectations.appStore.pageCampaigns["/road-trip-journal-app"], "road_trip");
  assert.equal(expectations.appStore.pageCampaigns["/road-trip-tracker-app"], "road_trip_tracker");
  assert.equal(expectations.appStore.pageCampaigns["/travel-journal-app-with-photos"], "travel_journal");
  assert.equal(expectations.appStore.pageCampaigns["/driving-history-app"], "driving_history");
  assert.equal(expectations.appStore.pageCampaigns["/route-66-road-trip-journal"], "route_66");
  assert.equal(expectations.appStore.pageCampaigns["/pacific-coast-highway-road-trip-journal"], "route_pacific_coast_highway");
  assert.equal(expectations.appStore.pageCampaigns["/national-parks-road-trip-journal"], "route_national_parks");
  assert.equal(expectations.appStore.pageCampaigns["/texas-hill-country-road-trip-journal"], "route_texas_hill_country");
  assert.equal(expectations.appStore.pageCampaigns["/support"], "site");
  assert.equal(expectations.appStore.pageCampaigns["/privacy"], "site");
  assert.equal(expectations.appStore.pageCampaigns["/terms"], "site");
  assert.equal(expectations.appStore.pageCampaigns[expectations.appStore.notFoundPath], "site");
  for (const pathname of [...expectations.publicPages, expectations.appStore.notFoundPath]) {
    const ct = expectations.appStore.pageCampaigns[pathname];
    assert.match(ct, /^[a-z0-9_-]{1,40}$/, pathname);
  }
  assert.throws(() => validateExpectations({ ...expectations, appStore: { ...expectations.appStore, pageCampaigns: {} } }), /pageCampaigns/);
  assert.equal(expectations.campaign.query, "?utm_source=x&utm_medium=social&utm_campaign=launch_oct13");
  assert.equal(expectations.campaign.expectedCt, "x-launch_oct13");
  assert.equal(expectations.headlines.default.lead, "A road trip journal");
  assert.equal(expectations.headlines.default.accent, "for your iPhone.");
  assert.equal(expectations.headlines.x.lead, "Keep the drive.");
  assert.equal(expectations.headlines.x.accent, "Keep the song.");
  assert.deepEqual(expectations.removedPublicImages.urls, [
    "/assets/v4/05-soundtrack.webp",
    "/assets/v2/soundtrack.webp?v=1",
    "/assets/v2/soundtrack.jpg"
  ]);
  assert.deepEqual(expectations.removedPublicImages.pages, ["/", "/apple-music-soundtrack"]);
  assert.deepEqual(expectations.removedPublicImages.forbidden, [
    "/assets/v4/05-soundtrack.webp",
    "/assets/v2/soundtrack.webp",
    "/assets/v2/soundtrack.jpg"
  ]);
  assert.throws(() => validateExpectations({ ...expectations, removedPublicImages: { urls: [], pages: ["/"], forbidden: ["/assets/v2/soundtrack.webp"] } }), /removedPublicImages\.urls/);
  const removedChecks = evaluateRemovedPublicImages(
    expectations,
    {
      "/": "<img src=\"/assets/v4/05-soundtrack-sample.webp\"><img src=\"/assets/v4/02-journey.webp\">",
      "/apple-music-soundtrack": "<img src=\"/assets/v2/soundtrack-sample.webp?v=1\">"
    },
    expectations.removedPublicImages.urls.map((url) => ({ url, status: 404, cacheControl: "public, max-age=0" }))
  );
  assert.ok(removedChecks.every((check) => check.pass), removedChecks.filter((check) => !check.pass).map((check) => check.name).join(","));
  const leaked = evaluateRemovedPublicImages(
    expectations,
    { "/": "<img src=\"/assets/v4/05-soundtrack.webp\">", "/apple-music-soundtrack": "<img src=\"/assets/v2/soundtrack-sample.webp?v=1\">" },
    [{ url: "/assets/v4/05-soundtrack.webp", status: 200, cacheControl: "public, max-age=604800" }]
  );
  assert.equal(leaked.every((check) => check.pass), false);
  assert.deepEqual(expectations.samplePublicImages.assets.map((asset) => asset.url), [
    "/assets/v4/05-soundtrack-sample.webp",
    "/assets/v2/soundtrack-sample.webp?v=1",
    "/assets/v2/soundtrack-sample.jpg"
  ]);
  assert.deepEqual(expectations.samplePublicImages.pages, {
    "/": "/assets/v4/05-soundtrack-sample.webp",
    "/apple-music-soundtrack": "/assets/v2/soundtrack-sample.webp?v=1"
  });
  assert.throws(() => validateExpectations({ ...expectations, samplePublicImages: { assets: [], pages: { "/": "/assets/v4/05-soundtrack-sample.webp" } } }), /samplePublicImages\.assets/);
  const sampleChecks = evaluateSamplePublicImages(
    expectations,
    {
      "/": "<img src=\"/assets/v4/05-soundtrack-sample.webp\">",
      "/apple-music-soundtrack": "<img src=\"/assets/v2/soundtrack-sample.webp?v=1\">"
    },
    expectations.samplePublicImages.assets.map((asset) => ({ url: asset.url, status: 200, contentType: asset.contentType }))
  );
  assert.ok(sampleChecks.every((check) => check.pass), sampleChecks.filter((check) => !check.pass).map((check) => check.name).join(","));
  const wrongType = evaluateSamplePublicImages(
    expectations,
    { "/": "<img src=\"/assets/v4/02-journey.webp\">", "/apple-music-soundtrack": "<img src=\"/assets/v2/soundtrack-sample.webp?v=1\">" },
    [{ url: "/assets/v4/05-soundtrack-sample.webp", status: 200, contentType: "text/plain" }]
  );
  assert.equal(wrongType.every((check) => check.pass), false);
  assert.equal(expectations.launchBadge.productHref, "https://tools.launchllama.co/products/journeydeck?utm_source=badge&utm_medium=referral");
  assert.equal(expectations.launchBadge.imageSrc, "https://tools.launchllama.co/featured-badge-white.jpg?v=5");
  assert.equal(expectations.launchBadge.imageAlt, "Featured on Launch");
  assert.equal(expectations.launchBadge.imageWidth, "200");
  assert.equal(expectations.launchBadge.imageHeight, "52");
  assert.equal(expectations.launchBadge.mcpHref, "https://launchmcp.co/?utm_source=badge&utm_medium=referral");
  assert.equal(expectations.launchBadge.mcpText, "Launch MCP");
  assert.deepEqual(expectations.pageSnippets["/"], [
    'id="templates"',
    'data-umami-event="templates-click" href="https://studio.journeydeck.me/?utm_source=journeydeck&utm_medium=referral&utm_campaign=crosslink"'
  ]);
  assert.deepEqual(expectations.pageSnippets["/terms"], [
    'id="studio-products"',
    "within 7 days of purchase and I’ll refund you."
  ]);
  assert.throws(() => validateExpectations({ ...expectations, pageSnippets: { "/terms": ["hello"] } }), /7-day refund line/);
  assert.throws(() => validateExpectations({ ...expectations, pageSnippets: { ...expectations.pageSnippets, "/": ['id="templates"'] } }), /templates section/);
  assert.throws(() => validateExpectations({}), /publicPages/);
  assert.throws(() => validateExpectations({ ...expectations, launchBadge: {} }), /launchBadge is incomplete/);
  assert.equal(expectations.footerLinks.forbiddenHref, "/login");
  assert.equal(expectations.footerLinks.homeStudioHref, "https://studio.journeydeck.me/?utm_source=journeydeck&utm_medium=referral&utm_campaign=crosslink");
  assert.equal(expectations.footerLinks.homeStudioText, "From the studio: Road Trip templates");
  assert.throws(() => validateExpectations({ ...expectations, footerLinks: {} }), /footerLinks is incomplete/);
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "journeydeck-verify-live-"));
  const filePath = path.join(directory, "expectations.json");
  fs.writeFileSync(filePath, JSON.stringify({ ...expectations, umami: { scriptSrc: expectations.umami.scriptSrc } }), "utf8");
  assert.throws(() => loadExpectations(filePath), /umami is incomplete/);
  fs.rmSync(directory, { recursive: true, force: true });
});

test("HTML helpers parse metadata, Umami, JSON-LD, and ignore generic trial terms", () => {
  const html = `<!doctype html><html><head>
    <title>JourneyDeck: Take the road. Keep the story.</title>
    <meta name="description" content="Your private journal.">
    <link rel="canonical" href="https://journeydeck.me/">
    <meta property="og:title" content="JourneyDeck: Take the road. Keep the story.">
    <meta property="og:description" content="Your private journal.">
    <meta property="og:url" content="https://journeydeck.me/">
    <meta property="og:image" content="https://journeydeck.me/assets/beta/share-card.png?v=1">
    <script defer src="https://cloud.umami.is/script.js" data-website-id="a5f66e11-ec7d-4133-8e1a-f8e6c08593af" data-domains="journeydeck.me"></script>
    <script type="application/ld+json">{"@type":"Organization","name":"JourneyDeck"}</script>
  </head><body>
    <h1 id="hero-title">Take the road.<br><span class="gold">Keep the story.</span></h1>
    <section id="templates"><a data-umami-event="templates-click" href="https://studio.journeydeck.me/?utm_source=journeydeck&utm_medium=referral&utm_campaign=crosslink">See the templates</a></section>
    <a href="https://apps.apple.com/us/app/journeydeck/id6806502526?pt=129344416&ct=home&mt=8">Get the app</a>
    <a href="https://apps.apple.com/us/app/journeydeck/id6806502526?see-all=reviews&pt=129344416&ct=home&mt=8">Reviews</a>
    <p>Available products, price, billing period, trial terms, and included features are shown before purchase.</p>
    <p>Free to record. Plus is $39.99/yr, with a 7-day free trial.</p>
    <footer><span style="display:inline-block;text-align:center;font-family:system-ui,sans-serif;line-height:1;">
  <a href="https://tools.launchllama.co/products/journeydeck?utm_source=badge&utm_medium=referral" target="_blank" rel="noopener noreferrer" style="display:block;line-height:0;">
  <img src="https://tools.launchllama.co/featured-badge-white.jpg?v=5"
    alt="Featured on Launch"
    width="200" height="52" style="display:block;border:0;" />
</a>
  <a href="https://launchmcp.co/?utm_source=badge&utm_medium=referral" target="_blank" rel="noopener noreferrer" style="display:block;margin-top:-2px;padding-top:0;font-size:7px;font-weight:600;color:#888;text-decoration:none;line-height:1;letter-spacing:0.02em;">Launch MCP</a>
</span><a href="https://studio.journeydeck.me/?utm_source=journeydeck&utm_medium=referral&utm_campaign=crosslink">From the studio: Road Trip templates</a></footer>
  </body></html>`;
  const title = extractDocumentTitle(html);
  assert.equal(title.count, 1);
  assert.match(String(title.value), /Take the road/);
  assert.equal(findUmamiScripts(html, expectations).length, 1);
  const jsonLd = parseJsonLdBlocks(['{"@type":"Organization","name":"JourneyDeck"}']);
  assert.equal(jsonLd.pass, true);
  assert.equal(jsonLd.count, 1);
  assert.deepEqual(findForbiddenTrialPhrases(html, expectations.forbiddenTrialPhrases), []);
  // The previous ban was "3-day", "plus trial", and "free trial".
  // Only "3-day" remains, so a 7-day free trial and the legal phrase "trial terms" both pass.
  assert.deepEqual(findForbiddenTrialPhrases("Enjoy a 3-day Plus trial or a Free trial today.", expectations.forbiddenTrialPhrases), [
    "3-day"
  ]);
  assert.deepEqual(findForbiddenTrialPhrases("Plus is $39.99/yr, with a 7-day free trial.", expectations.forbiddenTrialPhrases), []);
  assert.deepEqual(findForbiddenTrialPhrases("Plus is $39.99/year, with a 7-day free trial.", expectations.forbiddenPricePhrases), [
    "$39.99/year"
  ]);
  assert.deepEqual(findForbiddenTrialPhrases("US$0.99 per week or US$24.99 per year", expectations.forbiddenPricePhrases), [
    "0.99",
    "24.99",
    "per week"
  ]);
  const broken = parseJsonLdBlocks(["{not-json"]);
  assert.equal(broken.pass, false);
  const checks = evaluatePublicPageHtml(html, "/", expectations, 200);
  assert.ok(checks.every((check) => check.pass), checks.filter((check) => !check.pass).map((check) => check.name).join(","));
  const longDescription = "x".repeat(156);
  const longHtml = html.replace('name="description" content="Your private journal."', `name="description" content="${longDescription}"`);
  const longChecks = evaluatePublicPageHtml(longHtml, "/", expectations, 200);
  assert.equal(longChecks.find((check) => check.name === "page:/ meta-description")?.pass, false);
  assert.equal(canonicalUrlForPath("/", expectations), "https://journeydeck.me/");
  assert.equal(canonicalUrlForPath("/support", expectations), "https://journeydeck.me/support");
  assert.equal(headlineMatches("A road trip journal\nfor your iPhone.", expectations.headlines.default), true);
  assert.equal(headlineMatches("Keep the drive. Keep the song.", expectations.headlines.x), true);
  assert.equal(headlineMatches("Take the road. Keep the story.", expectations.headlines.x), false);
  const badgeCheck = checks.find((check) => check.name === "page:/ launch-badge");
  assert.equal(badgeCheck?.pass, true);
  assert.equal(evaluateLaunchBadge("<footer></footer>", expectations).pass, false);
  assert.equal(evaluateLaunchBadge(html, expectations).pass, true);
  const supportChecks = evaluatePublicPageHtml(html, "/support", expectations, 200);
  assert.equal(supportChecks.some((check) => check.name === "page:/support launch-badge"), false);
  assert.equal(checks.find((check) => check.name === "page:/ studio-link")?.pass, true);
  assert.equal(checks.find((check) => check.name === "page:/ no-footer-login")?.pass, true);
  assert.equal(supportChecks.find((check) => check.name === "page:/support no-footer-login")?.pass, true);
  assert.equal(supportChecks.some((check) => check.name === "page:/support studio-link"), false);
  const withLogin = html.replace("</footer>", '<a href="/login">Sign in</a></footer>');
  const loginFooter = evaluatePublicPageHtml(withLogin, "/", expectations, 200);
  assert.equal(loginFooter.find((check) => check.name === "page:/ no-footer-login")?.pass, false);
  assert.equal(checks.find((check) => check.name === "page:/ description-voice")?.pass, true);
  assert.equal(checks.find((check) => check.name === "page:/ snippets")?.pass, true);
});

test("offer schema requires the annual unit price, the page App Store url, and in-stock availability", () => {
  const url = `${APP_STORE}?pt=${expectations.appStore.providerToken}&ct=home&mt=${expectations.appStore.mediaType}`;
  const offer = {
    "@context": "https://schema.org",
    "@type": "Offer",
    url,
    price: "39.99",
    priceCurrency: "USD",
    availability: "https://schema.org/InStock",
    priceSpecification: {
      "@type": "UnitPriceSpecification",
      price: "39.99",
      priceCurrency: "USD",
      billingDuration: "P1Y"
    }
  };
  const wrap = (value: unknown) => `<script type="application/ld+json">${JSON.stringify(value)}</script>`;
  const check = evaluateOfferSchema(wrap(offer), "/", expectations);
  assert.equal(check?.pass, true, JSON.stringify(check?.observed));
  const monthly = structuredClone(offer);
  monthly.priceSpecification.billingDuration = "P1M";
  const monthlyCheck = evaluateOfferSchema(wrap(monthly), "/", expectations);
  assert.equal(monthlyCheck?.pass, false);
  assert.ok((monthlyCheck?.observed as { problems: string[] }).problems.includes("billingDuration"));
  const wrongUrl = evaluateOfferSchema(wrap({ ...offer, url: "https://example.com/plus" }), "/", expectations);
  assert.equal(wrongUrl?.pass, false);
  assert.ok((wrongUrl?.observed as { problems: string[] }).problems.includes("url"));
  assert.equal(evaluateOfferSchema("<html></html>", "/", expectations), null);
  const robots = evaluateRobotsTxt("User-agent: *\nContent-Signal: ai-train=no, search=yes, ai-input=yes\nAllow: /\n", 200, expectations);
  assert.equal(robots.pass, true);
  assert.equal(evaluateRobotsTxt("Content-Signal: ai-train=no, search=yes, ai-input=no\n", 200, expectations).pass, false);
  const csp = "script-src 'self' https://static.cloudflareinsights.com; connect-src 'self' https://cloudflareinsights.com";
  assert.equal(evaluateInsightsCsp(csp, expectations).pass, true);
  assert.equal(evaluateInsightsCsp("script-src 'self'; connect-src 'self'", expectations).pass, false);
});

test("App Store href assertions keep campaign tokens, reviews, and the served static hrefs", () => {
  const homeQuery = `pt=${expectations.appStore.providerToken}&ct=home&mt=${expectations.appStore.mediaType}`;
  const served = [`${APP_STORE}?${homeQuery}`, `${APP_STORE}?see-all=reviews&${homeQuery}`];
  const campaign = [`${APP_STORE}?${CAMPAIGN_QUERY}`, `${APP_STORE}?see-all=reviews&${CAMPAIGN_QUERY}`];
  const campaignCheck = assertCampaignAppStoreHrefs(campaign, expectations);
  assert.equal(campaignCheck.pass, true, campaignCheck.problems.join("; "));
  const missingReviews = assertCampaignAppStoreHrefs([`${APP_STORE}?${CAMPAIGN_QUERY}`], expectations);
  assert.equal(missingReviews.pass, false);
  const duplicated = assertCampaignAppStoreHrefs([
    `${APP_STORE}?pt=${expectations.appStore.providerToken}&pt=1&ct=${expectations.campaign.expectedCt}&mt=8`,
    `${APP_STORE}?see-all=reviews&${CAMPAIGN_QUERY}`
  ], expectations);
  assert.equal(duplicated.pass, false);
  assert.match(duplicated.problems.join("; "), /duplicate pt/);
  const defaultCheck = assertDefaultAppStoreHrefs(served, served, expectations);
  assert.equal(defaultCheck.pass, true, defaultCheck.problems.join("; "));
  const bare = assertDefaultAppStoreHrefs([APP_STORE, `${APP_STORE}?see-all=reviews`], [APP_STORE, `${APP_STORE}?see-all=reviews`], expectations);
  assert.equal(bare.pass, false);
  const rewritten = assertDefaultAppStoreHrefs(campaign, served, expectations);
  assert.equal(rewritten.pass, false);
  const otherApp = "https://apps.apple.com/us/app/other/id0000000000";
  const wrongListing = assertCampaignAppStoreHrefs([`${otherApp}?${CAMPAIGN_QUERY}`, `${otherApp}?see-all=reviews&${CAMPAIGN_QUERY}`], expectations);
  assert.equal(wrongListing.pass, false);
  assert.match(wrongListing.problems.join("; "), /not the JourneyDeck App Store listing/);
  const wrongDefault = assertDefaultAppStoreHrefs(
    [`${otherApp}?${homeQuery}`, `${otherApp}?see-all=reviews&${homeQuery}`],
    [`${otherApp}?${homeQuery}`, `${otherApp}?see-all=reviews&${homeQuery}`],
    expectations
  );
  assert.equal(wrongDefault.pass, false);
  const droppedDuplicate = assertDefaultAppStoreHrefs(
    [served[0], served[0], served[1]],
    [served[0], served[0], served[0], served[1]],
    expectations
  );
  assert.equal(droppedDuplicate.pass, false);
  assert.deepEqual(extractAppStoreHrefs(`<a href="${served[0]}"></a><a href="/support"></a>`, expectations), [served[0]]);
});

test("health checks expect the site Worker JSON and reject Render readiness fields", () => {
  const headers = { cacheControl: "no-store", contentType: "application/json; charset=utf-8", rndrId: null };
  const worker = { ok: true, service: "journeydeck-site" };
  assert.equal(evaluateSiteHealth("/healthz", expectations.health, 200, worker, headers).pass, true);
  assert.equal(evaluateSiteHealth("/readyz", expectations.health, 200, worker, headers).pass, true);
  const renderBody = {
    ok: true,
    service: "journeydeck-site",
    legacyCompatibilityReachable: true,
    snapshotStale: false,
    atlas: { generatedAtUtc: "2026-10-11T20:31:30.000Z" }
  };
  const renderCheck = evaluateSiteHealth("/readyz", expectations.health, 200, renderBody, { ...headers, rndrId: "render" });
  assert.equal(renderCheck.pass, false);
  assert.equal((renderCheck.observed as { rndrId: string }).rndrId, "render");
  assert.ok((renderCheck.observed as { presentFields: string[] }).presentFields.includes("legacyCompatibilityReachable"));
  assert.ok((renderCheck.observed as { presentFields: string[] }).presentFields.includes("snapshotStale"));
  assert.ok((renderCheck.observed as { presentFields: string[] }).presentFields.includes("generatedAtUtc"));
  assert.throws(() => validateExpectations({ ...expectations, health: { ...expectations.health, body: { ok: true } } }), /health body/);
});

test("cache-busting, URL joining, CSP classification, and report text stay ASCII-hyphen clean", () => {
  assert.equal(joinBasePath("http://127.0.0.1:8795/", "/support"), "http://127.0.0.1:8795/support");
  assert.match(withCacheBust("https://journeydeck.me/", "abc"), /[?&]jd_verify=abc/);
  assert.match(withCacheBust("https://journeydeck.me/?utm_source=x", "abc"), /utm_source=x/);
  assert.equal(classifyConsoleError("Failed to load resource: net::ERR_FAILED https://gateway.umami.is/api/send").label, "blocked by verifier");
  assert.equal(classifyConsoleError("Failed to load resource: net::ERR_FAILED https://gateway.umami.is/api/send").fail, false);
  assert.equal(classifyConsoleError("Refused to connect because it violates the following Content Security Policy directive").fail, true);
  assert.equal(classifyConsoleError("Image failed to load").fail, false);
  const line = formatCheckLine({ name: "readyz", pass: true, observed: { body: { ok: true, service: "journeydeck-site" } } });
  assert.match(line, /^PASS readyz /);
  assert.doesNotMatch(line, /[\u2013\u2014]/);
  const report = formatHumanReport({
    checks: [{ name: "readyz", pass: true, observed: { ok: true } }],
    base: "http://127.0.0.1:8795",
    timestamp: "2026-10-11T21:00:00.000Z",
    ok: true,
    readyz: { body: { ok: true, service: "journeydeck-site" } }
  });
  assert.match(report, /service=journeydeck-site/);
  assert.match(report, /^PASS$/m);
  assert.doesNotMatch(report, /generatedAtUtc/);
  assert.doesNotMatch(report, /[\u2013\u2014]/);
});

test("Umami matching counts every cloud.umami.is script, not only exact src matches", () => {
  const exact = `<script defer src="https://cloud.umami.is/script.js" data-website-id="${expectations.umami.websiteId}" data-domains="${expectations.umami.dataDomains}"></script>`;
  const queried = `<script src="https://cloud.umami.is/script.js?v=2" data-website-id="${expectations.umami.websiteId}" data-domains="${expectations.umami.dataDomains}"></script>`;
  const wrongId = `<script src="https://cloud.umami.is/script.js" data-website-id="00000000-0000-0000-0000-000000000000" data-domains="example.com"></script>`;
  const otherHost = `<script src="https://example.com/umami.js" data-website-id="${expectations.umami.websiteId}" data-domains="${expectations.umami.dataDomains}"></script>`;
  assert.equal(scriptSrcHost("https://cloud.umami.is/script.js?v=2"), "cloud.umami.is");
  assert.equal(findUmamiScripts(exact, expectations).length, 1);
  assert.equal(findUmamiScripts(queried, expectations).length, 1);
  assert.equal(findUmamiScripts(wrongId, expectations).length, 1);
  assert.equal(findUmamiScripts(`${exact}${wrongId}`, expectations).length, 2);
  assert.equal(findUmamiScripts(otherHost, expectations).length, 0);
  assert.equal(evaluateUmamiScripts(findUmamiScripts(exact, expectations), expectations, { requireOne: true }).pass, true);
  assert.equal(evaluateUmamiScripts(findUmamiScripts(queried, expectations), expectations, { requireOne: true }).pass, true);
  assert.equal(evaluateUmamiScripts(findUmamiScripts(wrongId, expectations), expectations, { requireOne: true }).pass, false);
  assert.equal(evaluateUmamiScripts(findUmamiScripts(`${exact}${wrongId}`, expectations), expectations, { requireOne: true }).pass, false);
  const extra = evaluatePublicPageHtml(`<!doctype html><html><head>
    <title>JourneyDeck</title><meta name="description" content="A private journal.">
    <link rel="canonical" href="https://journeydeck.me/"><meta property="og:title" content="JourneyDeck">
    <meta property="og:description" content="A private journal."><meta property="og:url" content="https://journeydeck.me/">
    <meta property="og:image" content="https://journeydeck.me/card.png">${exact}${wrongId}
  </head><body></body></html>`, "/", expectations, 200);
  const umamiCheck = extra.find((check) => check.name === "page:/ umami");
  assert.equal(umamiCheck?.pass, false);
  assert.equal((umamiCheck?.observed as { count: number }).count, 2);
  const loginWrong = evaluateLoginUmami(`<html><head><meta name="robots" content="noindex">${wrongId}</head><body>The old web app has been retired.</body></html>`, expectations, 410, RETIRED_HEADERS);
  assert.equal(loginWrong.find((check) => check.name === "page:/login umami")?.pass, false);
  const loginClean = evaluateLoginUmami(RETIRED_HTML, expectations, 410, RETIRED_HEADERS);
  assert.equal(loginClean.find((check) => check.name === "page:/login status")?.pass, true);
  assert.equal(loginClean.find((check) => check.name === "page:/login noindex")?.pass, true);
  assert.equal(loginClean.find((check) => check.name === "page:/login umami")?.pass, true);
  const loginLoaded = evaluateLoginUmami(RETIRED_HTML, expectations, 200, RETIRED_HEADERS);
  assert.equal(loginLoaded.find((check) => check.name === "page:/login status")?.pass, false);
  assert.equal(loginLoaded.find((check) => check.name === "page:/login umami")?.pass, true);
});

test("check runner records thrown browser steps as FAIL and keeps running", async () => {
  const checks = await runChecksContinuing([
    {
      name: "browser 390x844 campaign app-store-hrefs",
      work: async () => {
        throw new Error("page.waitForFunction: Timeout 8000ms exceeded. no App Store links found");
      }
    },
    {
      name: "browser 390x844 default headline",
      work: async () => ({ pass: true, observed: "Take the road. Keep the story." })
    }
  ]);
  assert.equal(checks[0].pass, false);
  assert.match(String((checks[0].observed as { error: string }).error), /no App Store links found/);
  assert.equal(checks[1].pass, true);
  const report = formatHumanReport({
    checks,
    base: "http://127.0.0.1:8795",
    timestamp: "2026-10-11T21:00:00.000Z",
    ok: false
  });
  assert.match(report, /^FAIL browser 390x844 campaign app-store-hrefs /m);
  assert.match(report, /no App Store links found/);
  assert.match(report, /^PASS browser 390x844 default headline /m);
  assert.match(report, /^FAIL$/m);
  const json = JSON.stringify({ ok: false, checks });
  assert.match(json, /no App Store links found/);
  assert.doesNotMatch(report, /[\u2013\u2014]/);
});

test("in-process web app HTML satisfies the verify-live public page checks", async () => {
  const fixture = fixtureDatabase();
  const runtime = await createApp({ databasePath: fixture.filename, root, allowTestAuth: true, legacyUpstream: "", mode: "web" });
  try {
    for (const pathname of expectations.publicPages) {
      const page = await runtime.app.inject({ method: "GET", url: pathname });
      const checks = evaluatePublicPageHtml(page.body, pathname, expectations, page.statusCode);
      assert.ok(checks.every((check) => check.pass), `${pathname}: ${checks.filter((check) => !check.pass).map((check) => `${check.name} ${JSON.stringify(check.observed)}`).join("; ")}`);
      if (pathname === "/") {
        const csp = evaluateInsightsCsp(page.headers["content-security-policy"], expectations);
        assert.equal(csp.pass, true, JSON.stringify(csp.observed));
        assert.equal(checks.find((check) => check.name === "page:/ snippets")?.pass, true);
        assert.equal(checks.find((check) => check.name === "page:/ description-voice")?.pass, true);
        assert.equal(checks.find((check) => check.name === "page:/ offer")?.pass, true);
      }
      if (pathname === "/terms") {
        assert.match(page.body, /id="studio-products"/);
        assert.match(page.body, /within 7 days of purchase and I’ll refund you/);
        const snippets = checks.find((check) => check.name === "page:/terms snippets");
        assert.equal(snippets?.pass, true, JSON.stringify(snippets?.observed));
      }
    }
    const robots = await runtime.app.inject({ method: "GET", url: "/robots.txt" });
    const robotsCheck = evaluateRobotsTxt(robots.body, robots.statusCode, expectations);
    assert.equal(robotsCheck.pass, true, JSON.stringify(robotsCheck.observed));
    const missing = await runtime.app.inject({ method: "GET", url: expectations.appStore.notFoundPath });
    const missingChecks = evaluateNotFoundAppStore(missing.body, expectations, missing.statusCode);
    assert.ok(missingChecks.every((check) => check.pass), missingChecks.filter((check) => !check.pass).map((check) => `${check.name} ${JSON.stringify(check.observed)}`).join("; "));
  } finally {
    await runtime.app.close();
    fixture.cleanup();
  }
});
