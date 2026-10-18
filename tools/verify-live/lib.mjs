import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const DEFAULT_BASE_URL = "https://journeydeck.me";
export const READYZ_CAVEAT = "generatedAtUtc is the Atlas snapshot time (service restart / snapshot time), not deploy time. It changes when the service restarts. On 2026-10-11 it moved to 20:31:30Z with no new commit on main since the 12:55Z deploy, so it proves a restart after the given time, not that a specific commit is live.";

const TOOL_DIR = dirname(fileURLToPath(import.meta.url));
export const DEFAULT_EXPECTATIONS_PATH = join(TOOL_DIR, "expectations.json");

export function expectationsPath() {
  return DEFAULT_EXPECTATIONS_PATH;
}

export function parseVerifyLiveArgs(argv) {
  const result = { base: DEFAULT_BASE_URL, json: false, since: null };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--json") {
      result.json = true;
      continue;
    }
    if (arg === "--base") {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) throw new Error("--base requires a URL");
      result.base = normalizeBaseUrl(value);
      index += 1;
      continue;
    }
    if (arg.startsWith("--base=")) {
      result.base = normalizeBaseUrl(arg.slice("--base=".length));
      continue;
    }
    if (arg === "--since") {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) throw new Error("--since requires an ISO timestamp");
      result.since = value;
      index += 1;
      continue;
    }
    if (arg.startsWith("--since=")) {
      result.since = arg.slice("--since=".length);
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }
  return result;
}

export function normalizeBaseUrl(value) {
  const parsed = new URL(value);
  if (!/^https?:$/.test(parsed.protocol)) throw new Error(`Unsupported --base protocol: ${value}`);
  parsed.hash = "";
  parsed.search = "";
  const href = parsed.toString();
  return href.endsWith("/") ? href.slice(0, -1) : href;
}

export function joinBasePath(base, pathAndQuery) {
  return new URL(pathAndQuery, `${normalizeBaseUrl(base)}/`).toString();
}

export function withCacheBust(url, token = `t${Date.now().toString(36)}`) {
  const parsed = new URL(url);
  parsed.searchParams.set("jd_verify", token);
  return parsed.toString();
}

export function loadExpectations(filePath = DEFAULT_EXPECTATIONS_PATH) {
  const raw = JSON.parse(readFileSync(filePath, "utf8"));
  return validateExpectations(raw);
}

export function validateExpectations(raw) {
  if (!raw || typeof raw !== "object") throw new Error("expectations.json must be an object");
  if (!Array.isArray(raw.publicPages) || raw.publicPages.length === 0) throw new Error("expectations.publicPages must be a non-empty array");
  if (!Array.isArray(raw.unauthenticatedPages)) throw new Error("expectations.unauthenticatedPages must be an array");
  for (const page of raw.unauthenticatedPages) {
    if (!page || typeof page !== "object") throw new Error("expectations.unauthenticatedPages entries must be objects");
    if (typeof page.path !== "string" || !page.path.startsWith("/")) throw new Error("expectations.unauthenticatedPages path must start with /");
    if (page.status !== 302) throw new Error("expectations.unauthenticatedPages status must be 302");
    if (typeof page.location !== "string" || !page.location.startsWith("/")) throw new Error("expectations.unauthenticatedPages location must be a path");
  }
  if (!Array.isArray(raw.redirects)) throw new Error("expectations.redirects must be an array");
  for (const redirect of raw.redirects) {
    if (!redirect || typeof redirect !== "object") throw new Error("expectations.redirects entries must be objects");
    if (typeof redirect.path !== "string" || !redirect.path.startsWith("/")) throw new Error("expectations.redirects path must start with /");
    if (redirect.status !== 301) throw new Error("expectations.redirects status must be 301");
    if (typeof redirect.location !== "string" || !/^https:\/\/[^/\s]+\/.+/.test(redirect.location)) throw new Error("expectations.redirects location must be an https URL");
  }
  if (typeof raw.loginPath !== "string" || !raw.loginPath.startsWith("/")) throw new Error("expectations.loginPath must be a path");
  if (typeof raw.canonicalOrigin !== "string") throw new Error("expectations.canonicalOrigin is required");
  if (!raw.umami?.scriptSrc || !raw.umami?.websiteId || !raw.umami?.dataDomains) throw new Error("expectations.umami is incomplete");
  if (!Array.isArray(raw.forbiddenTrialPhrases) || raw.forbiddenTrialPhrases.length === 0) throw new Error("expectations.forbiddenTrialPhrases must be a non-empty array");
  if (!Array.isArray(raw.forbiddenPricePhrases) || raw.forbiddenPricePhrases.length === 0) throw new Error("expectations.forbiddenPricePhrases must be a non-empty array");
  if (!Array.isArray(raw.requiredPricingPhrases) || raw.requiredPricingPhrases.length === 0) throw new Error("expectations.requiredPricingPhrases must be a non-empty array");
  if (!raw.appStore?.baseUrl || !raw.appStore?.providerToken || !raw.appStore?.mediaType) throw new Error("expectations.appStore is incomplete");
  if (typeof raw.appStore.notFoundPath !== "string" || !raw.appStore.notFoundPath.startsWith("/")) throw new Error("expectations.appStore.notFoundPath is required");
  if (!raw.appStore.pageCampaigns || typeof raw.appStore.pageCampaigns !== "object") throw new Error("expectations.appStore.pageCampaigns is incomplete");
  for (const pathname of [...raw.publicPages, raw.appStore.notFoundPath]) {
    const ct = raw.appStore.pageCampaigns[pathname];
    if (typeof ct !== "string" || !/^[a-z0-9_-]{1,40}$/.test(ct)) {
      throw new Error(`expectations.appStore.pageCampaigns[${pathname}] must be a campaign token of at most 40 characters`);
    }
  }
  if (!raw.campaign?.query || !raw.campaign?.expectedCt) throw new Error("expectations.campaign is incomplete");
  if (!raw.headlines?.default?.lead || !raw.headlines?.default?.accent) throw new Error("expectations.headlines.default is incomplete");
  if (!raw.headlines?.x?.lead || !raw.headlines?.x?.accent) throw new Error("expectations.headlines.x is incomplete");
  if (!Array.isArray(raw.viewports) || raw.viewports.length === 0) throw new Error("expectations.viewports must be a non-empty array");
  if (!raw.blocked?.analyticsHost || !Array.isArray(raw.blocked?.appStoreHosts)) throw new Error("expectations.blocked is incomplete");
  const removed = raw.removedPublicImages;
  if (!removed || !Array.isArray(removed.urls) || removed.urls.length === 0) throw new Error("expectations.removedPublicImages.urls is required");
  if (!Array.isArray(removed.pages) || removed.pages.length === 0) throw new Error("expectations.removedPublicImages.pages is required");
  if (!Array.isArray(removed.forbidden) || removed.forbidden.length === 0) throw new Error("expectations.removedPublicImages.forbidden is required");
  if (raw.pages != null) {
    if (typeof raw.pages !== "object" || Array.isArray(raw.pages)) throw new Error("expectations.pages must be an object");
    for (const [pathname, page] of Object.entries(raw.pages)) {
      if (!raw.publicPages.includes(pathname)) throw new Error(`expectations.pages[${pathname}] is not a public page`);
      if (!page || typeof page !== "object") throw new Error(`expectations.pages[${pathname}] must be an object`);
      if (page.headline != null && (typeof page.headline !== "string" || !page.headline.trim())) {
        throw new Error(`expectations.pages[${pathname}].headline must be text`);
      }
      for (const key of ["requiredPricingPhrases", "requiredPhrases", "forbiddenPhrases"]) {
        if (page[key] == null) continue;
        if (!Array.isArray(page[key]) || page[key].some((phrase) => typeof phrase !== "string" || !phrase.trim())) {
          throw new Error(`expectations.pages[${pathname}].${key} must be an array of phrases`);
        }
      }
    }
  }
  if (
    !raw.launchBadge?.productHref
    || !raw.launchBadge?.imageSrc
    || !raw.launchBadge?.imageAlt
    || raw.launchBadge.imageWidth == null
    || raw.launchBadge.imageHeight == null
    || !raw.launchBadge?.mcpHref
    || !raw.launchBadge?.mcpText
  ) {
    throw new Error("expectations.launchBadge is incomplete");
  }
  const termsSnippets = raw.pageSnippets?.["/terms"];
  if (!Array.isArray(termsSnippets) || termsSnippets.some((snippet) => typeof snippet !== "string" || snippet.length === 0)) {
    throw new Error("expectations.pageSnippets./terms must list the studio products snippets");
  }
  if (!termsSnippets.includes('id="studio-products"') || !termsSnippets.some((snippet) => snippet.includes("7 days of purchase"))) {
    throw new Error('expectations.pageSnippets./terms must include id="studio-products" and the 7-day refund line');
  }
  return raw;
}

export function canonicalUrlForPath(pathname, expectations) {
  if (pathname === "/") return `${expectations.canonicalOrigin}/`;
  const trimmed = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return `${expectations.canonicalOrigin}${trimmed}`;
}

export function attrValue(tagHtml, name) {
  const pattern = new RegExp(`\\b${escapeRegExp(name)}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, "i");
  const match = tagHtml.match(pattern);
  return match?.[1] ?? match?.[2] ?? null;
}

export function extractDocumentTitle(html) {
  const matches = [...html.matchAll(/<title\b[^>]*>([\s\S]*?)<\/title>/gi)];
  return { count: matches.length, value: matches[0]?.[1]?.trim() ?? null };
}

export function extractNamedMetas(html, name) {
  const tags = [...html.matchAll(/<meta\b[^>]*>/gi)].map((match) => match[0]);
  const values = tags
    .filter((tag) => (attrValue(tag, "name") || "").toLowerCase() === name.toLowerCase())
    .map((tag) => attrValue(tag, "content"));
  return { count: values.length, value: values[0] ?? null };
}

export function extractPropertyMetas(html, property) {
  const tags = [...html.matchAll(/<meta\b[^>]*>/gi)].map((match) => match[0]);
  const values = tags
    .filter((tag) => (attrValue(tag, "property") || "").toLowerCase() === property.toLowerCase())
    .map((tag) => attrValue(tag, "content"));
  return { count: values.length, value: values[0] ?? null };
}

export function extractCanonicals(html) {
  const tags = [...html.matchAll(/<link\b[^>]*>/gi)].map((match) => match[0]);
  const values = tags
    .filter((tag) => (attrValue(tag, "rel") || "").toLowerCase() === "canonical")
    .map((tag) => attrValue(tag, "href"));
  return { count: values.length, value: values[0] ?? null };
}

export function extractJsonLdBlocks(html) {
  return [...html.matchAll(/<script\b[^>]*\btype\s*=\s*(["'])application\/ld\+json\1[^>]*>([\s\S]*?)<\/script>/gi)]
    .map((match) => match[2].trim());
}

export function parseJsonLdBlocks(blocks) {
  const parsed = [];
  const errors = [];
  for (const block of blocks) {
    try {
      parsed.push(JSON.parse(block));
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }
  return { count: blocks.length, parsed, errors, pass: errors.length === 0 };
}

export function scriptSrcHost(src, base = "https://journeydeck.me") {
  try {
    return new URL(String(src || ""), base).hostname.toLowerCase();
  } catch {
    return "";
  }
}

export function umamiScriptHost(expectations) {
  return scriptSrcHost(expectations.umami.scriptSrc);
}

export function findUmamiScripts(html, expectations) {
  const expectedHost = umamiScriptHost(expectations);
  return [...html.matchAll(/<script\b[^>]*>/gi)]
    .map((match) => match[0])
    .map((tag) => ({
      src: attrValue(tag, "src"),
      websiteId: attrValue(tag, "data-website-id"),
      dataDomains: attrValue(tag, "data-domains")
    }))
    .filter((script) => script.src && scriptSrcHost(script.src) === expectedHost);
}

export function evaluateUmamiScripts(scripts, expectations, { requireOne = true } = {}) {
  const observed = {
    count: scripts.length,
    scripts: scripts.map((script) => ({
      src: script.src,
      websiteId: script.websiteId,
      dataDomains: script.dataDomains
    })),
    expectedWebsiteId: expectations.umami.websiteId,
    expectedDataDomains: expectations.umami.dataDomains
  };
  if (!requireOne) {
    return { pass: scripts.length === 0, observed };
  }
  const only = scripts[0];
  const pass = scripts.length === 1
    && only.websiteId === expectations.umami.websiteId
    && only.dataDomains === expectations.umami.dataDomains;
  return { pass, observed };
}

export function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

export async function runNamedCheck(name, work) {
  try {
    const result = await work();
    if (result && typeof result === "object" && "pass" in result) {
      return makeCheck(name, result.pass, result.observed);
    }
    return makeCheck(name, true, result ?? null);
  } catch (error) {
    return makeCheck(name, false, { error: errorMessage(error) });
  }
}

export async function runChecksContinuing(steps) {
  const checks = [];
  for (const step of steps) {
    checks.push(await runNamedCheck(step.name, step.work));
  }
  return checks;
}

export function findForbiddenTrialPhrases(html, phrases) {
  const lower = html.toLowerCase();
  return phrases.filter((phrase) => lower.includes(String(phrase).toLowerCase()));
}

export function findMissingRequiredPhrases(html, phrases) {
  const source = String(html);
  return phrases.filter((phrase) => !source.includes(String(phrase)));
}

export function extractAnchorHrefs(html) {
  return [...html.matchAll(/<a\b[^>]*>/gi)]
    .map((match) => attrValue(match[0], "href"))
    .filter((href) => typeof href === "string" && href.length > 0);
}

export function isAppStoreHref(href, expectations) {
  try {
    const url = new URL(String(href || ""), expectations.canonicalOrigin);
    return url.protocol === "https:" && expectations.blocked.appStoreHosts.includes(url.hostname);
  } catch {
    return false;
  }
}

export function inspectAppStoreHref(href, expectations) {
  const url = new URL(href, expectations.appStore.baseUrl);
  return {
    href,
    originPath: `${url.origin}${url.pathname.replace(/\/$/, "")}`,
    pt: url.searchParams.get("pt"),
    ct: url.searchParams.get("ct"),
    mt: url.searchParams.get("mt"),
    seeAll: url.searchParams.get("see-all")
  };
}

export function appStoreOriginPath(expectations) {
  const url = new URL(expectations.appStore.baseUrl);
  return `${url.origin}${url.pathname.replace(/\/$/, "")}`;
}

export function hrefListsMatch(left, right) {
  if (left.length !== right.length) return false;
  const sortedLeft = [...left].sort();
  const sortedRight = [...right].sort();
  return sortedLeft.every((href, index) => href === sortedRight[index]);
}

export function extractAppStoreHrefs(html, expectations) {
  return extractAnchorHrefs(html).filter((href) => isAppStoreHref(href, expectations));
}

export function campaignParamProblems(href) {
  let url;
  try {
    url = new URL(href);
  } catch {
    return [`${href} is not a valid App Store URL`];
  }
  const problems = [];
  for (const name of ["pt", "ct", "mt"]) {
    if (url.searchParams.getAll(name).length > 1) problems.push(`${href} has duplicate ${name}`);
  }
  return problems;
}

export function assertStaticAppStoreCampaign(hrefs, expectedCt, expectations, { requireReviews = false } = {}) {
  const inspected = hrefs.map((href) => inspectAppStoreHref(href, expectations));
  const problems = [];
  if (inspected.length === 0) problems.push("no App Store links found");
  const listing = appStoreOriginPath(expectations);
  for (const item of inspected) {
    if (item.originPath !== listing) problems.push(`${item.href} is not the JourneyDeck App Store listing`);
    if (item.pt !== expectations.appStore.providerToken) problems.push(`${item.href} missing pt=${expectations.appStore.providerToken}`);
    if (item.ct !== expectedCt) problems.push(`${item.href} ct=${item.ct ?? ""} expected ${expectedCt}`);
    if (item.mt !== expectations.appStore.mediaType) problems.push(`${item.href} missing mt=${expectations.appStore.mediaType}`);
    problems.push(...campaignParamProblems(item.href));
  }
  if (requireReviews && !inspected.some((item) => item.seeAll === expectations.appStore.reviewsParam)) {
    problems.push(`no App Store reviews link kept see-all=${expectations.appStore.reviewsParam}`);
  }
  return {
    pass: problems.length === 0,
    observed: inspected,
    problems
  };
}

export function assertCampaignAppStoreHrefs(hrefs, expectations) {
  const expectedCt = expectations.campaign.expectedCt;
  const checked = assertStaticAppStoreCampaign(hrefs, expectedCt, expectations, { requireReviews: true });
  return checked;
}

export function assertDefaultAppStoreHrefs(hrefs, servedHrefs, expectations) {
  const expectedCt = expectations.appStore.pageCampaigns?.["/"];
  const browser = assertStaticAppStoreCampaign(hrefs, expectedCt, expectations, { requireReviews: true });
  const served = assertStaticAppStoreCampaign(servedHrefs, expectedCt, expectations, { requireReviews: true });
  const problems = [
    ...browser.problems,
    ...served.problems.map((problem) => `served ${problem}`)
  ];
  if (!hrefListsMatch(hrefs, servedHrefs)) {
    problems.push("browser App Store hrefs do not match the HTML as served");
  }
  return {
    pass: problems.length === 0,
    observed: { browser: browser.observed, served: servedHrefs },
    problems
  };
}

export function headlineMatches(text, headline) {
  const normalized = normalizeHeadline(text);
  return normalized.includes(normalizeHeadline(headline.lead)) && normalized.includes(normalizeHeadline(headline.accent));
}

export function normalizeHeadline(text) {
  return String(text || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

export function extractFirstHeading(html) {
  const match = String(html || "").match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i);
  return normalizeHeadline(match?.[1] || "");
}

export function pageCopyFor(expectations, pathname) {
  const page = expectations.pages?.[pathname];
  return page && typeof page === "object" ? page : null;
}

export function compareGeneratedAtSince(generatedAtUtc, sinceIso) {
  if (!sinceIso) return { compared: false, pass: true, reason: "no --since provided" };
  const sinceMs = Date.parse(sinceIso);
  if (Number.isNaN(sinceMs)) return { compared: true, pass: false, reason: `--since is not a valid ISO timestamp: ${sinceIso}` };
  if (!generatedAtUtc) return { compared: true, pass: false, reason: "generatedAtUtc is missing" };
  const generatedMs = Date.parse(generatedAtUtc);
  if (Number.isNaN(generatedMs)) return { compared: true, pass: false, reason: `generatedAtUtc is not a valid ISO timestamp: ${generatedAtUtc}` };
  if (generatedMs < sinceMs) return { compared: true, pass: false, reason: `${generatedAtUtc} is older than ${sinceIso}` };
  return { compared: true, pass: true, reason: `${generatedAtUtc} is on or after ${sinceIso}` };
}

export function classifyConsoleError(text, blockedUrls = []) {
  const message = String(text || "");
  const lower = message.toLowerCase();
  const mentionsBlocked = blockedUrls.some((url) => message.includes(url)) || /gateway\.umami\.is/i.test(message);
  if (mentionsBlocked) {
    return { fail: false, label: "blocked by verifier" };
  }
  if (lower.includes("content security policy") || lower.includes("securitypolicyviolation")) {
    return { fail: true, label: "csp" };
  }
  return { fail: false, label: "ignored" };
}

export function evaluateLaunchBadge(html, expectations) {
  const badge = expectations.launchBadge;
  const footer = html.match(/<footer\b[^>]*>[\s\S]*?<\/footer>/i)?.[0] ?? "";
  const observed = {
    productHref: footer.includes(`href="${badge.productHref}"`),
    imageSrc: footer.includes(`src="${badge.imageSrc}"`),
    imageAlt: footer.includes(`alt="${badge.imageAlt}"`),
    imageWidth: footer.includes(`width="${badge.imageWidth}"`),
    imageHeight: footer.includes(`height="${badge.imageHeight}"`),
    mcpHref: footer.includes(`href="${badge.mcpHref}"`),
    mcpText: footer.includes(`>${badge.mcpText}</a>`)
  };
  return {
    pass: Object.values(observed).every(Boolean),
    observed
  };
}

export function evaluatePublicPageHtml(html, pathname, expectations, statusCode) {
  const expectedCanonical = canonicalUrlForPath(pathname, expectations);
  const title = extractDocumentTitle(html);
  const description = extractNamedMetas(html, "description");
  const canonical = extractCanonicals(html);
  const ogTitle = extractPropertyMetas(html, "og:title");
  const ogDescription = extractPropertyMetas(html, "og:description");
  const ogUrl = extractPropertyMetas(html, "og:url");
  const ogImage = extractPropertyMetas(html, "og:image");
  const jsonLd = parseJsonLdBlocks(extractJsonLdBlocks(html));
  const umami = evaluateUmamiScripts(findUmamiScripts(html, expectations), expectations, { requireOne: true });
  const pageCopy = pageCopyFor(expectations, pathname);
  const pricingPhrases = pageCopy?.requiredPricingPhrases?.length
    ? pageCopy.requiredPricingPhrases
    : expectations.requiredPricingPhrases;
  const trialHits = findForbiddenTrialPhrases(html, expectations.forbiddenTrialPhrases);
  const priceHits = findForbiddenTrialPhrases(html, expectations.forbiddenPricePhrases);
  const missingPricing = findMissingRequiredPhrases(html, pricingPhrases);
  const checks = [
    makeCheck(`page:${pathname} status`, statusCode === 200, statusCode),
    makeCheck(`page:${pathname} title`, title.count === 1 && Boolean(title.value), title),
    makeCheck(`page:${pathname} meta-description`, description.count === 1 && Boolean(description.value), description),
    makeCheck(`page:${pathname} canonical`, canonical.count === 1 && canonical.value === expectedCanonical, { ...canonical, expected: expectedCanonical }),
    makeCheck(`page:${pathname} og:title`, ogTitle.count === 1 && Boolean(ogTitle.value), ogTitle),
    makeCheck(`page:${pathname} og:description`, ogDescription.count === 1 && Boolean(ogDescription.value), ogDescription),
    makeCheck(`page:${pathname} og:url`, ogUrl.count === 1 && ogUrl.value === expectedCanonical, { ...ogUrl, expected: expectedCanonical }),
    makeCheck(`page:${pathname} og:image`, ogImage.count === 1 && Boolean(ogImage.value), ogImage),
    makeCheck(`page:${pathname} json-ld`, jsonLd.pass, { count: jsonLd.count, errors: jsonLd.errors }),
    makeCheck(`page:${pathname} umami`, umami.pass, umami.observed),
    makeCheck(`page:${pathname} trial-wording`, trialHits.length === 0, { forbidden: trialHits }),
    makeCheck(`page:${pathname} pricing`, priceHits.length === 0 && missingPricing.length === 0, { forbidden: priceHits, missing: missingPricing })
  ];
  const requiredSnippets = expectations.pageSnippets?.[pathname];
  if (Array.isArray(requiredSnippets)) {
    const missingSnippets = findMissingRequiredPhrases(html, requiredSnippets);
    checks.push(makeCheck(`page:${pathname} snippets`, missingSnippets.length === 0, { missing: missingSnippets }));
  }
  const expectedCt = expectations.appStore?.pageCampaigns?.[pathname];
  if (expectedCt) {
    const hrefs = extractAppStoreHrefs(html, expectations);
    const appStore = assertStaticAppStoreCampaign(hrefs, expectedCt, expectations, { requireReviews: pathname === "/" });
    checks.push(makeCheck(`page:${pathname} app-store`, appStore.pass, { problems: appStore.problems, hrefs }));
  }
  if (pathname === "/") {
    const badge = evaluateLaunchBadge(html, expectations);
    checks.push(makeCheck(`page:${pathname} launch-badge`, badge.pass, badge.observed));
  }
  if (pageCopy?.headline) {
    const headline = extractFirstHeading(html);
    checks.push(makeCheck(
      `page:${pathname} headline`,
      headline === normalizeHeadline(pageCopy.headline),
      { headline, expected: pageCopy.headline }
    ));
  }
  if (pageCopy?.requiredPhrases || pageCopy?.forbiddenPhrases) {
    const forbidden = findForbiddenTrialPhrases(html, pageCopy.forbiddenPhrases || []);
    const missing = findMissingRequiredPhrases(html, pageCopy.requiredPhrases || []);
    checks.push(makeCheck(`page:${pathname} copy`, forbidden.length === 0 && missing.length === 0, { forbidden, missing }));
  }
  return checks;
}

export function evaluateRemovedPublicImages(expectations, pages, assets) {
  const removed = expectations.removedPublicImages;
  const checks = [];
  for (const pathname of removed.pages) {
    const html = pages[pathname] ?? "";
    const hits = removed.forbidden.filter((token) => html.includes(token));
    checks.push(makeCheck(`removed-image ${pathname}`, html.length > 0 && hits.length === 0, { hits }));
  }
  for (const asset of assets) {
    const cacheControl = String(asset.cacheControl || "");
    const longLived = /immutable|max-age=31536000|max-age=604800/.test(cacheControl);
    checks.push(makeCheck(`removed-image ${asset.url}`, asset.status === 404 && !longLived, {
      status: asset.status,
      cacheControl
    }));
  }
  return checks;
}

export function evaluateUnauthenticatedPage(statusCode, location, page) {
  return makeCheck(`unauthenticated:${page.path}`, statusCode === page.status && location === page.location, {
    status: statusCode,
    location,
    expectedStatus: page.status,
    expectedLocation: page.location
  });
}

export function evaluateRedirect(statusCode, location, redirect) {
  return makeCheck(`redirect:${redirect.path}`, statusCode === redirect.status && location === redirect.location, {
    status: statusCode,
    location,
    expectedStatus: redirect.status,
    expectedLocation: redirect.location
  });
}

export function evaluateNotFoundAppStore(html, expectations, statusCode) {
  const pathname = expectations.appStore.notFoundPath;
  const expectedCt = expectations.appStore.pageCampaigns?.[pathname];
  const hrefs = extractAppStoreHrefs(html, expectations);
  const appStore = assertStaticAppStoreCampaign(hrefs, expectedCt, expectations);
  return [
    makeCheck(`page:${pathname} status`, statusCode === 404, statusCode),
    makeCheck(`page:${pathname} app-store`, appStore.pass, { problems: appStore.problems, hrefs })
  ];
}

export function evaluateLoginUmami(html, expectations, statusCode) {
  const umami = evaluateUmamiScripts(findUmamiScripts(html, expectations), expectations, { requireOne: false });
  return [
    makeCheck(`page:${expectations.loginPath} status`, statusCode === 200, statusCode),
    makeCheck(`page:${expectations.loginPath} umami`, umami.pass, umami.observed)
  ];
}

export function makeCheck(name, pass, observed) {
  return { name, pass: Boolean(pass), observed };
}

export function formatCheckLine(check) {
  const status = check.pass ? "PASS" : "FAIL";
  return `${status} ${check.name} ${formatObserved(check.observed)}`;
}

export function formatObserved(observed) {
  if (observed == null) return "";
  if (typeof observed === "string" || typeof observed === "number" || typeof observed === "boolean") return String(observed);
  try {
    return JSON.stringify(observed);
  } catch {
    return String(observed);
  }
}

export function formatHumanReport({ checks, base, timestamp, ok, readyz }) {
  const lines = checks.map(formatCheckLine);
  lines.push(ok ? "PASS" : "FAIL");
  lines.push(`base=${base}`);
  lines.push(`timestamp=${timestamp}`);
  if (readyz) {
    lines.push(`readyz generatedAtUtc=${readyz.generatedAtUtc ?? "null"} (${"service restart / snapshot time"})`);
    lines.push(`readyz caveat: ${READYZ_CAVEAT}`);
  }
  return `${lines.join("\n")}\n`;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
