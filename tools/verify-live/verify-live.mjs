#!/usr/bin/env node
import { chromium } from "@playwright/test";
import {
  READYZ_CAVEAT,
  assertCampaignAppStoreHrefs,
  assertDefaultAppStoreHrefs,
  classifyConsoleError,
  compareGeneratedAtSince,
  evaluateLoginUmami,
  evaluatePublicPageHtml,
  extractAppStoreHrefs,
  formatHumanReport,
  headlineMatches,
  joinBasePath,
  loadExpectations,
  makeCheck,
  normalizeHeadline,
  parseVerifyLiveArgs,
  withCacheBust
} from "./lib.mjs";

const args = parseVerifyLiveArgs(process.argv.slice(2));
const expectations = loadExpectations();
const timestamp = new Date().toISOString();
const cacheToken = `t${Date.now().toString(36)}`;
const checks = [];
const blockedRequests = [];
const consoleErrors = [];
const cspViolations = [];

function recordCheck(check) {
  checks.push(check);
  return check;
}

async function fetchResource(pathAndQuery, { json = false } = {}) {
  const url = withCacheBust(joinBasePath(args.base, pathAndQuery), cacheToken);
  const response = await fetch(url, { redirect: "manual" });
  const text = await response.text();
  return {
    url,
    status: response.status,
    text,
    json: json ? safeJson(text) : null
  };
}

function safeJson(text) {
  try {
    return JSON.parse(text);
  } catch (error) {
    return { parseError: error instanceof Error ? error.message : String(error), text };
  }
}

function recordBlocked(url, reason = "blocked by verifier") {
  blockedRequests.push({ url, reason });
}

async function installVerifierRoutes(page) {
  await page.route("**/*", async (route) => {
    const request = route.request();
    const url = request.url();
    let hostname = "";
    try {
      hostname = new URL(url).hostname;
    } catch {
      hostname = "";
    }
    if (hostname === expectations.blocked.analyticsHost) {
      recordBlocked(url);
      return route.abort();
    }
    if (expectations.blocked.appStoreHosts.includes(hostname)) {
      recordBlocked(url);
      return route.abort();
    }
    return route.continue();
  });
  await page.addInitScript(() => {
    window.__jdCspViolations = [];
    document.addEventListener("securitypolicyviolation", (event) => {
      window.__jdCspViolations.push({
        blockedURI: event.blockedURI,
        violatedDirective: event.violatedDirective,
        effectiveDirective: event.effectiveDirective
      });
    });
  });
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    consoleErrors.push({ text: message.text(), location: message.location() });
  });
  page.on("requestfailed", (request) => {
    const url = request.url();
    let hostname = "";
    try {
      hostname = new URL(url).hostname;
    } catch {
      hostname = "";
    }
    if (hostname === expectations.blocked.analyticsHost || expectations.blocked.appStoreHosts.includes(hostname)) {
      if (!blockedRequests.some((entry) => entry.url === url)) recordBlocked(url);
    }
  });
}

async function readPageState(page) {
  const headline = await page.locator("#hero-title").innerText();
  const hrefs = await page.locator("a[href]").evaluateAll((anchors) => anchors.map((anchor) => anchor.getAttribute("href")).filter(Boolean));
  const violations = await page.evaluate(() => window.__jdCspViolations || []);
  return { headline, hrefs, violations };
}

async function runBrowserChecks(servedHomeHrefs) {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const viewport of expectations.viewports) {
      const campaignContext = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } });
      const campaignPage = await campaignContext.newPage();
      await installVerifierRoutes(campaignPage);
      await campaignPage.goto(withCacheBust(joinBasePath(args.base, `/${expectations.campaign.query}`), cacheToken), { waitUntil: "load" });
      await campaignPage.waitForSelector("#hero-title");
      await campaignPage.waitForFunction((token) => {
        return [...document.querySelectorAll("a[href]")].some((anchor) => {
          try {
            return new URL(anchor.href).searchParams.get("ct") === token;
          } catch {
            return false;
          }
        });
      }, expectations.campaign.expectedCt);
      const campaignState = await readPageState(campaignPage);
      cspViolations.push(...campaignState.violations);
      const campaignHrefs = campaignState.hrefs.filter((href) => {
        try {
          const hostname = new URL(href, args.base).hostname;
          return expectations.blocked.appStoreHosts.includes(hostname);
        } catch {
          return false;
        }
      });
      recordCheck(makeCheck(
        `browser ${viewport.name} campaign headline`,
        headlineMatches(campaignState.headline, expectations.headlines.x),
        normalizeHeadline(campaignState.headline)
      ));
      const campaignHrefCheck = assertCampaignAppStoreHrefs(campaignHrefs, expectations);
      recordCheck(makeCheck(
        `browser ${viewport.name} campaign app-store-hrefs`,
        campaignHrefCheck.pass,
        { hrefs: campaignHrefs, problems: campaignHrefCheck.problems }
      ));
      await campaignContext.close();

      const defaultContext = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } });
      const defaultPage = await defaultContext.newPage();
      await installVerifierRoutes(defaultPage);
      await defaultPage.goto(withCacheBust(joinBasePath(args.base, "/"), cacheToken), { waitUntil: "load" });
      await defaultPage.waitForSelector("#hero-title");
      await defaultPage.waitForFunction(() => [...document.scripts].some((script) => String(script.src || "").includes("/campaign.js")));
      const defaultState = await readPageState(defaultPage);
      cspViolations.push(...defaultState.violations);
      const defaultHrefs = defaultState.hrefs.filter((href) => {
        try {
          const hostname = new URL(href, args.base).hostname;
          return expectations.blocked.appStoreHosts.includes(hostname);
        } catch {
          return false;
        }
      });
      recordCheck(makeCheck(
        `browser ${viewport.name} default headline`,
        headlineMatches(defaultState.headline, expectations.headlines.default),
        normalizeHeadline(defaultState.headline)
      ));
      const defaultHrefCheck = assertDefaultAppStoreHrefs(defaultHrefs, servedHomeHrefs, expectations);
      recordCheck(makeCheck(
        `browser ${viewport.name} default app-store-hrefs`,
        defaultHrefCheck.pass,
        { hrefs: defaultHrefs, served: servedHomeHrefs, problems: defaultHrefCheck.problems }
      ));
      await defaultContext.close();
    }
  } finally {
    await browser.close();
  }
}

function evaluateCspCheck() {
  const blockedUrls = blockedRequests.map((entry) => entry.url);
  const cspConsole = consoleErrors
    .map((entry) => ({ ...entry, classification: classifyConsoleError(entry.text, blockedUrls) }))
    .filter((entry) => entry.classification.fail || entry.classification.label === "blocked by verifier");
  const failing = cspConsole.filter((entry) => entry.classification.fail);
  recordCheck(makeCheck("csp console", failing.length === 0 && cspViolations.length === 0, {
    console: cspConsole,
    securitypolicyviolation: cspViolations,
    blockedByVerifier: blockedRequests
  }));
}

async function run() {
  let servedHomeHrefs = [];
  for (const pathname of expectations.publicPages) {
    const page = await fetchResource(pathname);
    if (pathname === "/") servedHomeHrefs = extractAppStoreHrefs(page.text, expectations);
    for (const check of evaluatePublicPageHtml(page.text, pathname, expectations, page.status)) {
      recordCheck(check);
    }
  }

  const login = await fetchResource(expectations.loginPath);
  for (const check of evaluateLoginUmami(login.text, expectations, login.status)) {
    recordCheck(check);
  }

  await runBrowserChecks(servedHomeHrefs);
  evaluateCspCheck();

  const ready = await fetchResource("/readyz", { json: true });
  const body = ready.json && typeof ready.json === "object" ? ready.json : {};
  const generatedAtUtc = body.atlas?.generatedAtUtc ?? null;
  const readyzOk = ready.status === 200 && body.ok === true;
  recordCheck(makeCheck("readyz", readyzOk, {
    status: ready.status,
    ok: body.ok ?? null,
    generatedAtUtc,
    atlas: body.atlas ?? null,
    label: "service restart / snapshot time",
    caveat: READYZ_CAVEAT
  }));
  if (args.since) {
    const comparison = compareGeneratedAtSince(generatedAtUtc, args.since);
    recordCheck(makeCheck("readyz since", comparison.pass, {
      generatedAtUtc,
      since: args.since,
      reason: comparison.reason,
      label: "service restart / snapshot time"
    }));
  }

  const ok = checks.every((check) => check.pass);
  const report = {
    ok,
    base: args.base,
    timestamp,
    checks,
    readyz: {
      status: ready.status,
      ok: body.ok ?? null,
      generatedAtUtc,
      atlas: body.atlas ?? null,
      since: args.since,
      label: "service restart / snapshot time",
      caveat: READYZ_CAVEAT
    },
    blockedRequests,
    consoleErrors
  };
  if (args.json) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else {
    process.stdout.write(formatHumanReport({ checks, base: args.base, timestamp, ok, readyz: report.readyz }));
  }
  process.exitCode = ok ? 0 : 1;
}

run().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack || error.message : String(error)}\n`);
  process.exitCode = 1;
});
