#!/usr/bin/env node
import { chromium } from "@playwright/test";
import {
  DEFAULT_BASE_URL,
  READYZ_CAVEAT,
  assertCampaignAppStoreHrefs,
  assertDefaultAppStoreHrefs,
  classifyConsoleError,
  compareGeneratedAtSince,
  errorMessage,
  evaluateLoginUmami,
  evaluateNotFoundAppStore,
  evaluatePublicPageHtml,
  evaluateUnauthenticatedPage,
  evaluateRedirect,
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

let args = { base: DEFAULT_BASE_URL, json: false, since: null };
let expectations;
try {
  args = parseVerifyLiveArgs(process.argv.slice(2));
  expectations = loadExpectations();
} catch (error) {
  const timestamp = new Date().toISOString();
  const checks = [makeCheck("verifier", false, { error: errorMessage(error) })];
  if (args.json || process.argv.includes("--json")) {
    process.stdout.write(`${JSON.stringify({ ok: false, base: args.base, timestamp, checks, blockedRequests: [], consoleErrors: [] }, null, 2)}\n`);
  } else {
    process.stdout.write(formatHumanReport({ checks, base: args.base, timestamp, ok: false }));
  }
  process.exit(1);
}
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
  try {
    const response = await fetch(url, { redirect: "manual" });
    const text = await response.text();
    return {
      url,
      status: response.status,
      location: response.headers.get("location"),
      text,
      json: json ? safeJson(text) : null
    };
  } catch (error) {
    return {
      url,
      status: 0,
      location: null,
      text: "",
      json: null,
      error: errorMessage(error)
    };
  }
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

function appStoreHrefsFrom(hrefs) {
  return hrefs.filter((href) => {
    try {
      return expectations.blocked.appStoreHosts.includes(new URL(href, args.base).hostname);
    } catch {
      return false;
    }
  });
}

function failBrowserViewport(viewport, error, phases) {
  const message = errorMessage(error);
  for (const phase of phases) {
    recordCheck(makeCheck(`browser ${viewport.name} ${phase}`, false, { error: message }));
  }
}

async function runCampaignVisit(browser, viewport) {
  const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } });
  try {
    const page = await context.newPage();
    await installVerifierRoutes(page);
    await page.goto(withCacheBust(joinBasePath(args.base, `/${expectations.campaign.query}`), cacheToken), { waitUntil: "load" });
    await page.waitForSelector("#hero-title");
    await page.waitForFunction((token) => {
      return [...document.querySelectorAll("a[href]")].some((anchor) => {
        try {
          return new URL(anchor.href).searchParams.get("ct") === token;
        } catch {
          return false;
        }
      });
    }, expectations.campaign.expectedCt);
    const state = await readPageState(page);
    cspViolations.push(...state.violations);
    const hrefs = appStoreHrefsFrom(state.hrefs);
    recordCheck(makeCheck(
      `browser ${viewport.name} campaign headline`,
      headlineMatches(state.headline, expectations.headlines.x),
      normalizeHeadline(state.headline)
    ));
    const hrefCheck = assertCampaignAppStoreHrefs(hrefs, expectations);
    recordCheck(makeCheck(
      `browser ${viewport.name} campaign app-store-hrefs`,
      hrefCheck.pass,
      { hrefs, problems: hrefCheck.problems }
    ));
  } catch (error) {
    failBrowserViewport(viewport, error, ["campaign headline", "campaign app-store-hrefs"]);
  } finally {
    await context.close().catch(() => {});
  }
}

async function runDefaultVisit(browser, viewport, servedHomeHrefs) {
  const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } });
  try {
    const page = await context.newPage();
    await installVerifierRoutes(page);
    await page.goto(withCacheBust(joinBasePath(args.base, "/"), cacheToken), { waitUntil: "load" });
    await page.waitForSelector("#hero-title");
    await page.waitForFunction(() => [...document.scripts].some((script) => String(script.src || "").includes("/campaign.js")));
    const state = await readPageState(page);
    cspViolations.push(...state.violations);
    const hrefs = appStoreHrefsFrom(state.hrefs);
    recordCheck(makeCheck(
      `browser ${viewport.name} default headline`,
      headlineMatches(state.headline, expectations.headlines.default),
      normalizeHeadline(state.headline)
    ));
    const hrefCheck = assertDefaultAppStoreHrefs(hrefs, servedHomeHrefs, expectations);
    recordCheck(makeCheck(
      `browser ${viewport.name} default app-store-hrefs`,
      hrefCheck.pass,
      { hrefs, served: servedHomeHrefs, problems: hrefCheck.problems }
    ));
  } catch (error) {
    failBrowserViewport(viewport, error, ["default headline", "default app-store-hrefs"]);
  } finally {
    await context.close().catch(() => {});
  }
}

async function runBrowserChecks(servedHomeHrefs) {
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
  } catch (error) {
    for (const viewport of expectations.viewports) {
      failBrowserViewport(viewport, error, [
        "campaign headline",
        "campaign app-store-hrefs",
        "default headline",
        "default app-store-hrefs"
      ]);
    }
    return;
  }
  try {
    for (const viewport of expectations.viewports) {
      await runCampaignVisit(browser, viewport);
      await runDefaultVisit(browser, viewport, servedHomeHrefs);
    }
  } catch (error) {
    for (const viewport of expectations.viewports) {
      const recorded = new Set(checks.filter((check) => check.name.startsWith(`browser ${viewport.name} `)).map((check) => check.name));
      for (const phase of ["campaign headline", "campaign app-store-hrefs", "default headline", "default app-store-hrefs"]) {
        const name = `browser ${viewport.name} ${phase}`;
        if (!recorded.has(name)) recordCheck(makeCheck(name, false, { error: errorMessage(error) }));
      }
    }
  } finally {
    if (browser) await browser.close().catch(() => {});
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

function writeReport(readyz) {
  const ok = checks.length > 0 && checks.every((check) => check.pass);
  const report = {
    ok,
    base: args.base,
    timestamp,
    checks,
    readyz,
    blockedRequests,
    consoleErrors
  };
  if (args.json) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else {
    process.stdout.write(formatHumanReport({ checks, base: args.base, timestamp, ok, readyz }));
  }
  process.exitCode = ok ? 0 : 1;
}

async function run() {
  let readyz = {
    status: null,
    ok: null,
    generatedAtUtc: null,
    atlas: null,
    since: args.since,
    label: "service restart / snapshot time",
    caveat: READYZ_CAVEAT
  };
  try {
    let servedHomeHrefs = [];
    for (const pathname of expectations.publicPages) {
      const page = await fetchResource(pathname);
      if (page.error) {
        recordCheck(makeCheck(`page:${pathname} status`, false, { error: page.error, status: page.status }));
        continue;
      }
      if (pathname === "/") servedHomeHrefs = extractAppStoreHrefs(page.text, expectations);
      for (const check of evaluatePublicPageHtml(page.text, pathname, expectations, page.status)) {
        recordCheck(check);
      }
    }

    const missing = await fetchResource(expectations.appStore.notFoundPath);
    if (missing.error) {
      recordCheck(makeCheck(`page:${expectations.appStore.notFoundPath} status`, false, { error: missing.error, status: missing.status }));
    } else {
      for (const check of evaluateNotFoundAppStore(missing.text, expectations, missing.status)) {
        recordCheck(check);
      }
    }

    for (const page of expectations.unauthenticatedPages) {
      const response = await fetchResource(page.path);
      if (response.error) {
        recordCheck(makeCheck(`unauthenticated:${page.path}`, false, { error: response.error, status: response.status, location: response.location }));
        continue;
      }
      recordCheck(evaluateUnauthenticatedPage(response.status, response.location, page));
    }

    for (const redirect of expectations.redirects) {
      const page = await fetchResource(redirect.path);
      if (page.error) {
        recordCheck(makeCheck(`redirect:${redirect.path}`, false, { error: page.error, status: page.status, location: page.location }));
        continue;
      }
      recordCheck(evaluateRedirect(page.status, page.location, redirect));
    }

    const login = await fetchResource(expectations.loginPath);
    if (login.error) {
      recordCheck(makeCheck(`page:${expectations.loginPath} status`, false, { error: login.error, status: login.status }));
    } else {
      for (const check of evaluateLoginUmami(login.text, expectations, login.status)) {
        recordCheck(check);
      }
    }

    await runBrowserChecks(servedHomeHrefs);
    evaluateCspCheck();

    const ready = await fetchResource("/readyz", { json: true });
    const body = ready.json && typeof ready.json === "object" ? ready.json : {};
    const generatedAtUtc = body.atlas?.generatedAtUtc ?? null;
    const readyzOk = !ready.error && ready.status === 200 && body.ok === true;
    readyz = {
      status: ready.status,
      ok: body.ok ?? null,
      generatedAtUtc,
      atlas: body.atlas ?? null,
      since: args.since,
      label: "service restart / snapshot time",
      caveat: READYZ_CAVEAT,
      ...(ready.error ? { error: ready.error } : {})
    };
    recordCheck(makeCheck("readyz", readyzOk, readyz));
    if (args.since) {
      const comparison = compareGeneratedAtSince(generatedAtUtc, args.since);
      recordCheck(makeCheck("readyz since", comparison.pass, {
        generatedAtUtc,
        since: args.since,
        reason: comparison.reason,
        label: "service restart / snapshot time"
      }));
    }
  } catch (error) {
    recordCheck(makeCheck("verifier", false, { error: errorMessage(error) }));
  }
  writeReport(readyz);
}

run().catch((error) => {
  recordCheck(makeCheck("verifier", false, { error: errorMessage(error) }));
  writeReport({
    status: null,
    ok: null,
    generatedAtUtc: null,
    atlas: null,
    since: args.since,
    label: "service restart / snapshot time",
    caveat: READYZ_CAVEAT,
    error: errorMessage(error)
  });
});
