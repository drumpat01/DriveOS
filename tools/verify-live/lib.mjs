import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const DEFAULT_BASE_URL = "https://journeydeck.me";

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
  const retired = raw.retiredPages;
  if (!retired || typeof retired !== "object" || Array.isArray(retired)) throw new Error("expectations.retiredPages must be an object");
  if (retired.status !== 410) throw new Error("expectations.retiredPages status must be 410");
  if (retired.robots !== "noindex") throw new Error("expectations.retiredPages robots must be noindex");
  if (retired.cacheControl !== "no-store") throw new Error("expectations.retiredPages cacheControl must be no-store");
  if (typeof retired.phrase !== "string" || !retired.phrase.trim()) throw new Error("expectations.retiredPages phrase is required");
  if (!Array.isArray(retired.paths) || retired.paths.length === 0) throw new Error("expectations.retiredPages.paths must be a non-empty array");
  const retiredPaths = new Set();
  for (const path of retired.paths) {
    if (typeof path !== "string" || !path.startsWith("/")) throw new Error("expectations.retiredPages.paths entries must start with /");
    if (retiredPaths.has(path)) throw new Error(`expectations.retiredPages.paths duplicates ${path}`);
    retiredPaths.add(path);
    if (raw.publicPages.includes(path)) throw new Error(`expectations.retiredPages path ${path} is a public page`);
  }
  if (!Array.isArray(raw.redirects)) throw new Error("expectations.redirects must be an array");
  for (const redirect of raw.redirects) {
    if (!redirect || typeof redirect !== "object") throw new Error("expectations.redirects entries must be objects");
    if (typeof redirect.path !== "string" || !redirect.path.startsWith("/")) throw new Error("expectations.redirects path must start with /");
    if (redirect.status !== 301) throw new Error("expectations.redirects status must be 301");
    if (typeof redirect.location !== "string" || !/^https:\/\/[^/\s]+\/.+/.test(redirect.location)) throw new Error("expectations.redirects location must be an https URL");
  }
  if (typeof raw.loginPath !== "string" || !raw.loginPath.startsWith("/")) throw new Error("expectations.loginPath must be a path");
  if (!retiredPaths.has(raw.loginPath)) throw new Error("expectations.retiredPages.paths must include loginPath");
  const health = raw.health;
  if (!health || typeof health !== "object" || Array.isArray(health)) throw new Error("expectations.health must be an object");
  if (health.status !== 200) throw new Error("expectations.health status must be 200");
  if (health.cacheControl !== "no-store") throw new Error("expectations.health cacheControl must be no-store");
  if (health.contentType !== "application/json") throw new Error("expectations.health contentType must be application/json");
  if (!health.body || health.body.ok !== true || health.body.service !== "journeydeck-site" || Object.keys(health.body).length !== 2) {
    throw new Error("expectations.health body must be the site Worker health JSON");
  }
  if (!Array.isArray(health.paths) || !health.paths.includes("/healthz") || !health.paths.includes("/readyz")) {
    throw new Error("expectations.health.paths must include /healthz and /readyz");
  }
  for (const path of health.paths) {
    if (typeof path !== "string" || !path.startsWith("/")) throw new Error("expectations.health.paths entries must start with /");
  }
  if (!Array.isArray(health.absentHeaders) || !health.absentHeaders.includes("rndr-id")) {
    throw new Error("expectations.health.absentHeaders must include rndr-id");
  }
  for (const field of ["atlas", "generatedAtUtc", "legacyCompatibilityReachable", "snapshotStale"]) {
    if (!Array.isArray(health.absentFields) || !health.absentFields.includes(field)) {
      throw new Error(`expectations.health.absentFields must include ${field}`);
    }
  }
  if (typeof raw.canonicalOrigin !== "string") throw new Error("expectations.canonicalOrigin is required");
  if (!raw.umami?.scriptSrc || !raw.umami?.websiteId || !raw.umami?.dataDomains) throw new Error("expectations.umami is incomplete");
  if (!Array.isArray(raw.forbiddenTrialPhrases) || raw.forbiddenTrialPhrases.length === 0) throw new Error("expectations.forbiddenTrialPhrases must be a non-empty array");
  if (!Array.isArray(raw.forbiddenPricePhrases) || raw.forbiddenPricePhrases.length === 0) throw new Error("expectations.forbiddenPricePhrases must be a non-empty array");
  if (!raw.forbiddenPricePhrases.includes("$39.99/year")) throw new Error("expectations.forbiddenPricePhrases must include $39.99/year");
  if (!Array.isArray(raw.requiredPricingPhrases) || raw.requiredPricingPhrases.length === 0) throw new Error("expectations.requiredPricingPhrases must be a non-empty array");
  if (!raw.requiredPricingPhrases.includes("$39.99/yr")) throw new Error("expectations.requiredPricingPhrases must include $39.99/yr");
  if (raw.maxMetaDescriptionLength !== 155) throw new Error("expectations.maxMetaDescriptionLength must be 155");
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
  const sample = raw.samplePublicImages;
  if (!sample || !Array.isArray(sample.assets) || sample.assets.length === 0) throw new Error("expectations.samplePublicImages.assets is required");
  for (const asset of sample.assets) {
    if (typeof asset?.url !== "string" || !asset.url.startsWith("/") || typeof asset.contentType !== "string" || !asset.contentType.startsWith("image/")) {
      throw new Error("expectations.samplePublicImages.assets entries need a path and an image content type");
    }
  }
  if (!sample.pages || typeof sample.pages !== "object" || Array.isArray(sample.pages)) throw new Error("expectations.samplePublicImages.pages is required");
  for (const [pathname, token] of Object.entries(sample.pages)) {
    if (!pathname.startsWith("/") || typeof token !== "string" || token.length === 0) throw new Error("expectations.samplePublicImages.pages entries must map a path to an image path");
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
  const footerLinks = raw.footerLinks;
  if (
    !footerLinks
    || typeof footerLinks !== "object"
    || Array.isArray(footerLinks)
    || footerLinks.forbiddenHref !== "/login"
    || typeof footerLinks.homeStudioHref !== "string"
    || !footerLinks.homeStudioHref.startsWith("https://studio.journeydeck.me/")
    || typeof footerLinks.homeStudioText !== "string"
    || !footerLinks.homeStudioText.trim()
  ) {
    throw new Error("expectations.footerLinks is incomplete");
  }
  if (raw.robotsTxt?.contentSignal !== "Content-Signal: ai-train=no, search=yes, ai-input=yes") {
    throw new Error("expectations.robotsTxt.contentSignal must allow AI answers");
  }
  const csp = raw.contentSecurityPolicy;
  if (!Array.isArray(csp?.scriptHosts) || !csp.scriptHosts.includes("https://static.cloudflareinsights.com") || !Array.isArray(csp?.connectHosts) || !csp.connectHosts.includes("https://cloudflareinsights.com")) {
    throw new Error("expectations.contentSecurityPolicy must allow the Cloudflare Web Analytics beacon");
  }
  if (!Array.isArray(csp.imgHosts) || !csp.imgHosts.includes("https://followx.today")) {
    throw new Error("expectations.contentSecurityPolicy must allow https://followx.today images");
  }
  if (
    typeof raw.followxBadge?.href !== "string"
    || !raw.followxBadge.href.startsWith("https://followx.today/")
    || typeof raw.followxBadge?.imageSrc !== "string"
    || !raw.followxBadge.imageSrc.startsWith("https://followx.today/")
    || !raw.followxBadge.imageSrc.includes("theme=dark")
    || typeof raw.followxBadge.imageAlt !== "string"
    || !raw.followxBadge.imageAlt.trim()
    || typeof raw.followxBadge.imageWidth !== "string"
    || !/^\d+$/.test(raw.followxBadge.imageWidth)
    || typeof raw.followxBadge.imageHeight !== "string"
    || !/^\d+$/.test(raw.followxBadge.imageHeight)
  ) {
    throw new Error("expectations.followxBadge is incomplete");
  }
  const homeSnippets = raw.pageSnippets?.["/"];
  if (!Array.isArray(homeSnippets) || !homeSnippets.includes('id="templates"') || !homeSnippets.some((snippet) => snippet.includes("templates-click"))) {
    throw new Error("expectations.pageSnippets./ must include the templates section");
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
    .map((tag) => {
      const src = attrValue(tag, "src");
      const scheduledSrc = attrValue(tag, "data-umami-src");
      const effective = scriptSrcHost(src) === expectedHost ? src : scheduledSrc;
      return {
        src: effective,
        websiteId: attrValue(tag, "data-website-id"),
        dataDomains: attrValue(tag, "data-domains")
      };
    })
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

export function healthCheckName(path) {
  return String(path || "").replace(/^\//, "") || "health";
}

export function evaluateSiteHealth(path, spec, statusCode, body, headers = {}) {
  const expectedBody = spec.body;
  const actual = body && typeof body === "object" && !Array.isArray(body) ? body : {};
  const actualKeys = Object.keys(actual).sort();
  const expectedKeys = Object.keys(expectedBody).sort();
  const bodyMatches = actualKeys.length === expectedKeys.length
    && expectedKeys.every((key) => actual[key] === expectedBody[key]);
  const cacheControl = headers.cacheControl == null ? null : String(headers.cacheControl);
  const contentType = headers.contentType == null ? null : String(headers.contentType);
  const cacheOk = cacheControl != null && cacheControl.trim().toLowerCase() === String(spec.cacheControl).toLowerCase();
  const typeOk = contentType != null && contentType.toLowerCase().startsWith(String(spec.contentType).toLowerCase());
  const rndrId = headers.rndrId == null || headers.rndrId === "" ? null : String(headers.rndrId);
  const headerAbsent = spec.absentHeaders.includes("rndr-id") ? rndrId == null : true;
  const presentFields = spec.absentFields.filter((field) => Object.prototype.hasOwnProperty.call(actual, field));
  const nestedGeneratedAt = actual.atlas && typeof actual.atlas === "object" && actual.atlas.generatedAtUtc != null;
  if (nestedGeneratedAt && !presentFields.includes("generatedAtUtc")) presentFields.push("generatedAtUtc");
  return makeCheck(healthCheckName(path), statusCode === spec.status && bodyMatches && cacheOk && typeOk && headerAbsent && presentFields.length === 0, {
    status: statusCode,
    body: actual,
    cacheControl,
    contentType,
    rndrId,
    presentFields
  });
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

export function footerHtml(html) {
  return html.match(/<footer\b[^>]*>[\s\S]*?<\/footer>/i)?.[0] ?? "";
}

export function evaluateFooterLinks(html, pathname, expectations) {
  const footer = footerHtml(html);
  const spec = expectations.footerLinks;
  const forbidden = new RegExp(`href\\s*=\\s*["']${escapeRegExp(spec.forbiddenHref)}["']`, "i");
  const loginPresent = forbidden.test(footer);
  const checks = [
    makeCheck(`page:${pathname} no-footer-login`, !loginPresent, { present: loginPresent })
  ];
  if (pathname === "/") {
    const anchor = `<a href="${spec.homeStudioHref}">${spec.homeStudioText}</a>`;
    const present = footer.includes(anchor);
    checks.push(makeCheck(`page:${pathname} studio-link`, present, {
      href: spec.homeStudioHref,
      text: spec.homeStudioText,
      present
    }));
  }
  return checks;
}

export function evaluateFollowxBadge(html, pathname, expectations) {
  const badge = expectations.followxBadge;
  const footer = footerHtml(html);
  const href = `href="${badge.href}"`;
  const image = `src="${badge.imageSrc}" alt="${badge.imageAlt}" width="${badge.imageWidth}" height="${badge.imageHeight}"`;
  const observed = {
    href: footer.includes(href),
    imageSrc: footer.includes(image)
  };
  return makeCheck(`page:${pathname} followx-badge`, observed.href && observed.imageSrc, observed);
}

export function evaluateFollowxCsp(csp, expectations) {
  const value = String(csp || "");
  const directive = (name) => value.split(";").map((part) => part.trim()).find((part) => part.startsWith(name)) || "";
  const imgHosts = expectations.contentSecurityPolicy?.imgHosts || [];
  const imgSrc = directive("img-src");
  const imgOk = imgHosts.length > 0 && imgHosts.every((host) => imgSrc.includes(host));
  return makeCheck("csp followx", imgOk, { imgOk });
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

const SECOND_PERSON = /\b(you|your|yours|yourself)\b/i;
const FIRST_PERSON = /\b(I|we|us|our|ours|my|mine)\b/;
const TESSIE_NAME = /tessie/i;

export function descriptionMentionsTessie(value) {
  return typeof value === "string" && TESSIE_NAME.test(value);
}

export function descriptionSpeaksToYou(value) {
  return typeof value === "string" && value.length > 0 && SECOND_PERSON.test(value) && !FIRST_PERSON.test(value);
}

export function collectTypedNodes(node, type, found = []) {
  if (!node || typeof node !== "object") return found;
  if (Array.isArray(node)) {
    for (const item of node) collectTypedNodes(item, type, found);
    return found;
  }
  if (node["@type"] === type) found.push(node);
  for (const value of Object.values(node)) collectTypedNodes(value, type, found);
  return found;
}

export function appStoreOfferUrl(pathname, expectations) {
  const ct = expectations.appStore?.pageCampaigns?.[pathname];
  if (typeof ct !== "string" || !expectations.appStore?.baseUrl) return null;
  return `${expectations.appStore.baseUrl}?pt=${expectations.appStore.providerToken}&ct=${ct}&mt=${expectations.appStore.mediaType}`;
}

export function offerSchemaProblems(offer, expectedUrl) {
  const problems = [];
  if (offer?.price !== "39.99") problems.push("price");
  if (offer?.priceCurrency !== "USD") problems.push("priceCurrency");
  if (offer?.availability !== "https://schema.org/InStock") problems.push("availability");
  if (!expectedUrl || offer?.url !== expectedUrl) problems.push("url");
  const spec = offer?.priceSpecification;
  if (!spec || spec["@type"] !== "UnitPriceSpecification" || spec.price !== "39.99" || spec.priceCurrency !== "USD" || spec.billingDuration !== "P1Y") {
    problems.push("billingDuration");
  }
  return problems;
}

export function evaluateOfferSchema(html, pathname, expectations) {
  const parsed = parseJsonLdBlocks(extractJsonLdBlocks(html));
  const offers = [];
  for (const block of parsed.parsed) collectTypedNodes(block, "Offer", offers);
  if (offers.length === 0) return null;
  const expectedUrl = appStoreOfferUrl(pathname, expectations);
  const problems = offers.flatMap((offer) => offerSchemaProblems(offer, expectedUrl));
  return makeCheck(`page:${pathname} offer`, problems.length === 0, {
    count: offers.length,
    expectedUrl,
    problems
  });
}

export function evaluateRobotsTxt(text, status, expectations) {
  const line = expectations.robotsTxt?.contentSignal;
  const body = String(text ?? "");
  const pass = status === 200 && typeof line === "string" && body.split(/\r?\n/).includes(line) && !body.includes("ai-input=no");
  return makeCheck("robots.txt content-signal", pass, { status, line });
}

export function evaluateInsightsCsp(csp, expectations) {
  const value = String(csp || "");
  const directive = (name) => value.split(";").map((part) => part.trim()).find((part) => part.startsWith(name)) || "";
  const scriptHosts = expectations.contentSecurityPolicy?.scriptHosts || [];
  const connectHosts = expectations.contentSecurityPolicy?.connectHosts || [];
  const scriptOk = scriptHosts.length > 0 && scriptHosts.every((host) => directive("script-src").includes(host));
  const connectOk = connectHosts.length > 0 && connectHosts.every((host) => directive("connect-src").includes(host));
  return makeCheck("csp cloudflare-insights", scriptOk && connectOk, { scriptOk, connectOk });
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
  const twitterDescription = extractNamedMetas(html, "twitter:description");
  const jsonLd = parseJsonLdBlocks(extractJsonLdBlocks(html));
  const umami = evaluateUmamiScripts(findUmamiScripts(html, expectations), expectations, { requireOne: true });
  const pageCopy = pageCopyFor(expectations, pathname);
  const pricingPhrases = pageCopy?.requiredPricingPhrases?.length
    ? pageCopy.requiredPricingPhrases
    : expectations.requiredPricingPhrases;
  const trialHits = findForbiddenTrialPhrases(html, expectations.forbiddenTrialPhrases);
  const priceHits = findForbiddenTrialPhrases(html, expectations.forbiddenPricePhrases);
  const missingPricing = findMissingRequiredPhrases(html, pricingPhrases);
  const maxDescription = expectations.maxMetaDescriptionLength;
  const descriptionFits = (extracted) => extracted.count === 1
    && typeof extracted.value === "string"
    && extracted.value.length > 0
    && extracted.value.length <= maxDescription;
  const voiceOk = (extracted) => extracted.count === 1 && descriptionSpeaksToYou(extracted.value);
  const checks = [
    makeCheck(`page:${pathname} status`, statusCode === 200, statusCode),
    makeCheck(`page:${pathname} title`, title.count === 1 && Boolean(title.value), title),
    makeCheck(`page:${pathname} meta-description`, descriptionFits(description), { ...description, max: maxDescription }),
    makeCheck(`page:${pathname} description-voice`, voiceOk(description) && voiceOk(ogDescription) && (twitterDescription.count === 0 || voiceOk(twitterDescription)), {
      description: description.value,
      ogDescription: ogDescription.value,
      twitterDescription: twitterDescription.value
    }),
    makeCheck(`page:${pathname} canonical`, canonical.count === 1 && canonical.value === expectedCanonical, { ...canonical, expected: expectedCanonical }),
    makeCheck(`page:${pathname} og:title`, ogTitle.count === 1 && Boolean(ogTitle.value), ogTitle),
    makeCheck(`page:${pathname} og:description`, descriptionFits(ogDescription), { ...ogDescription, max: maxDescription }),
    makeCheck(`page:${pathname} no-tessie-description`, !descriptionMentionsTessie(description.value) && !descriptionMentionsTessie(ogDescription.value) && !descriptionMentionsTessie(twitterDescription.value), {
      description: description.value,
      ogDescription: ogDescription.value,
      twitterDescription: twitterDescription.value
    }),
    makeCheck(`page:${pathname} og:url`, ogUrl.count === 1 && ogUrl.value === expectedCanonical, { ...ogUrl, expected: expectedCanonical }),
    makeCheck(`page:${pathname} og:image`, ogImage.count === 1 && Boolean(ogImage.value), ogImage),
    ...(twitterDescription.count > 0
      ? [makeCheck(`page:${pathname} twitter:description`, descriptionFits(twitterDescription), { ...twitterDescription, max: maxDescription })]
      : []),
    makeCheck(`page:${pathname} json-ld`, jsonLd.pass, { count: jsonLd.count, errors: jsonLd.errors }),
    makeCheck(`page:${pathname} umami`, umami.pass, umami.observed),
    makeCheck(`page:${pathname} trial-wording`, trialHits.length === 0, { forbidden: trialHits }),
    makeCheck(`page:${pathname} pricing`, priceHits.length === 0 && missingPricing.length === 0, { forbidden: priceHits, missing: missingPricing })
  ];
  const offer = evaluateOfferSchema(html, pathname, expectations);
  if (offer) checks.push(offer);
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
  checks.push(evaluateFollowxBadge(html, pathname, expectations));
  checks.push(...evaluateFooterLinks(html, pathname, expectations));
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

export function evaluateSamplePublicImages(expectations, pages, assets) {
  const sample = expectations.samplePublicImages;
  const checks = [];
  for (const [pathname, token] of Object.entries(sample.pages)) {
    const html = pages[pathname] ?? "";
    checks.push(makeCheck(`sample-image ${pathname}`, html.includes(token), { token }));
  }
  for (const asset of assets) {
    const expected = sample.assets.find((item) => item.url === asset.url);
    const contentType = String(asset.contentType || "");
    const typeOk = Boolean(expected) && contentType.includes(expected.contentType);
    checks.push(makeCheck(`sample-image ${asset.url}`, asset.status === 200 && typeOk, {
      status: asset.status,
      contentType,
      expected: expected?.contentType ?? null
    }));
  }
  return checks;
}

export function inspectRetiredPage(html, spec, statusCode, headers = {}) {
  const robots = headers.robots == null ? null : String(headers.robots);
  const cacheControl = headers.cacheControl == null ? null : String(headers.cacheControl);
  const meta = extractNamedMetas(String(html || ""), "robots");
  const metaRobots = meta.value;
  const expectedRobots = String(spec.robots).toLowerCase();
  const headerNoindex = robots != null && robots.trim().toLowerCase() === expectedRobots;
  const metaNoindex = meta.count === 1 && String(metaRobots || "").trim().toLowerCase() === expectedRobots;
  const cacheOk = cacheControl != null && cacheControl.trim().toLowerCase() === String(spec.cacheControl).toLowerCase();
  const phraseOk = String(html || "").includes(spec.phrase);
  const statusOk = statusCode === spec.status;
  return {
    statusOk,
    noindex: headerNoindex && metaNoindex,
    cacheOk,
    phraseOk,
    pass: statusOk && headerNoindex && metaNoindex && cacheOk && phraseOk,
    observed: {
      status: statusCode,
      expectedStatus: spec.status,
      robots,
      metaRobots,
      cacheControl,
      expectedCacheControl: spec.cacheControl,
      phrase: phraseOk
    }
  };
}

export function evaluateRetiredPage(html, path, spec, statusCode, headers = {}) {
  const inspected = inspectRetiredPage(html, spec, statusCode, headers);
  return makeCheck(`retired:${path}`, inspected.pass, inspected.observed);
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
    makeCheck(`page:${pathname} app-store`, appStore.pass, { problems: appStore.problems, hrefs }),
    evaluateFollowxBadge(html, pathname, expectations)
  ];
}

export function evaluateLoginUmami(html, expectations, statusCode, headers = {}) {
  const inspected = inspectRetiredPage(html, expectations.retiredPages, statusCode, headers);
  const umami = evaluateUmamiScripts(findUmamiScripts(html, expectations), expectations, { requireOne: false });
  return [
    makeCheck(`page:${expectations.loginPath} status`, inspected.statusOk, statusCode),
    makeCheck(`page:${expectations.loginPath} noindex`, inspected.noindex && inspected.cacheOk && inspected.phraseOk, inspected.observed),
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
    const body = readyz.body && typeof readyz.body === "object" ? readyz.body : readyz;
    lines.push(`readyz ok=${body.ok ?? "null"} service=${body.service ?? "null"}`);
  }
  return `${lines.join("\n")}\n`;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
