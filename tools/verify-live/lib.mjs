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
  if (typeof raw.loginPath !== "string" || !raw.loginPath.startsWith("/")) throw new Error("expectations.loginPath must be a path");
  if (typeof raw.canonicalOrigin !== "string") throw new Error("expectations.canonicalOrigin is required");
  if (!raw.umami?.scriptSrc || !raw.umami?.websiteId || !raw.umami?.dataDomains) throw new Error("expectations.umami is incomplete");
  if (!Array.isArray(raw.forbiddenTrialPhrases) || raw.forbiddenTrialPhrases.length === 0) throw new Error("expectations.forbiddenTrialPhrases must be a non-empty array");
  if (!raw.appStore?.baseUrl || !raw.appStore?.providerToken || !raw.appStore?.mediaType) throw new Error("expectations.appStore is incomplete");
  if (!raw.campaign?.query || !raw.campaign?.expectedCt) throw new Error("expectations.campaign is incomplete");
  if (!raw.headlines?.default?.lead || !raw.headlines?.default?.accent) throw new Error("expectations.headlines.default is incomplete");
  if (!raw.headlines?.x?.lead || !raw.headlines?.x?.accent) throw new Error("expectations.headlines.x is incomplete");
  if (!Array.isArray(raw.viewports) || raw.viewports.length === 0) throw new Error("expectations.viewports must be a non-empty array");
  if (!raw.blocked?.analyticsHost || !Array.isArray(raw.blocked?.appStoreHosts)) throw new Error("expectations.blocked is incomplete");
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

export function findUmamiScripts(html, expectations) {
  return [...html.matchAll(/<script\b[^>]*>/gi)]
    .map((match) => match[0])
    .filter((tag) => {
      const src = attrValue(tag, "src");
      const websiteId = attrValue(tag, "data-website-id");
      const domains = attrValue(tag, "data-domains");
      return src === expectations.umami.scriptSrc
        && websiteId === expectations.umami.websiteId
        && domains === expectations.umami.dataDomains;
    });
}

export function findForbiddenTrialPhrases(html, phrases) {
  const lower = html.toLowerCase();
  return phrases.filter((phrase) => lower.includes(String(phrase).toLowerCase()));
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
    originPath: `${url.origin}${url.pathname}`,
    pt: url.searchParams.get("pt"),
    ct: url.searchParams.get("ct"),
    mt: url.searchParams.get("mt"),
    seeAll: url.searchParams.get("see-all")
  };
}

export function extractAppStoreHrefs(html, expectations) {
  return extractAnchorHrefs(html).filter((href) => isAppStoreHref(href, expectations));
}

export function assertCampaignAppStoreHrefs(hrefs, expectations) {
  const inspected = hrefs.map((href) => inspectAppStoreHref(href, expectations));
  const problems = [];
  if (inspected.length === 0) problems.push("no App Store links found");
  for (const item of inspected) {
    if (item.pt !== expectations.appStore.providerToken) problems.push(`${item.href} missing pt=${expectations.appStore.providerToken}`);
    if (item.ct !== expectations.campaign.expectedCt) problems.push(`${item.href} missing ct=${expectations.campaign.expectedCt}`);
    if (item.mt !== expectations.appStore.mediaType) problems.push(`${item.href} missing mt=${expectations.appStore.mediaType}`);
  }
  const reviews = inspected.filter((item) => item.seeAll === expectations.appStore.reviewsParam);
  if (reviews.length === 0) problems.push(`no App Store reviews link kept see-all=${expectations.appStore.reviewsParam}`);
  return {
    pass: problems.length === 0,
    observed: inspected,
    problems
  };
}

export function assertDefaultAppStoreHrefs(hrefs, servedHrefs, expectations) {
  const inspected = hrefs.map((href) => inspectAppStoreHref(href, expectations));
  const problems = [];
  if (inspected.length === 0) problems.push("no App Store links found");
  for (const item of inspected) {
    if (item.pt !== null) problems.push(`${item.href} has pt`);
    if (item.ct !== null) problems.push(`${item.href} has ct`);
    if (item.mt !== null) problems.push(`${item.href} has mt`);
  }
  const browserSet = new Set(hrefs);
  const servedSet = new Set(servedHrefs);
  if (browserSet.size !== servedSet.size || [...servedSet].some((href) => !browserSet.has(href))) {
    problems.push("browser App Store hrefs do not match the HTML as served");
  }
  return {
    pass: problems.length === 0,
    observed: { browser: inspected, served: servedHrefs },
    problems
  };
}

export function headlineMatches(text, headline) {
  const normalized = normalizeHeadline(text);
  return normalized.includes(normalizeHeadline(headline.lead)) && normalized.includes(normalizeHeadline(headline.accent));
}

export function normalizeHeadline(text) {
  return String(text || "").replace(/\s+/g, " ").trim();
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
  const umami = findUmamiScripts(html, expectations);
  const trialHits = findForbiddenTrialPhrases(html, expectations.forbiddenTrialPhrases);
  return [
    makeCheck(`page:${pathname} status`, statusCode === 200, statusCode),
    makeCheck(`page:${pathname} title`, title.count === 1 && Boolean(title.value), title),
    makeCheck(`page:${pathname} meta-description`, description.count === 1 && Boolean(description.value), description),
    makeCheck(`page:${pathname} canonical`, canonical.count === 1 && canonical.value === expectedCanonical, { ...canonical, expected: expectedCanonical }),
    makeCheck(`page:${pathname} og:title`, ogTitle.count === 1 && Boolean(ogTitle.value), ogTitle),
    makeCheck(`page:${pathname} og:description`, ogDescription.count === 1 && Boolean(ogDescription.value), ogDescription),
    makeCheck(`page:${pathname} og:url`, ogUrl.count === 1 && ogUrl.value === expectedCanonical, { ...ogUrl, expected: expectedCanonical }),
    makeCheck(`page:${pathname} og:image`, ogImage.count === 1 && Boolean(ogImage.value), ogImage),
    makeCheck(`page:${pathname} json-ld`, jsonLd.pass, { count: jsonLd.count, errors: jsonLd.errors }),
    makeCheck(`page:${pathname} umami`, umami.length === 1, { count: umami.length, websiteId: expectations.umami.websiteId, dataDomains: expectations.umami.dataDomains }),
    makeCheck(`page:${pathname} trial-wording`, trialHits.length === 0, { forbidden: trialHits })
  ];
}

export function evaluateLoginUmami(html, expectations, statusCode) {
  const umami = findUmamiScripts(html, expectations);
  return [
    makeCheck(`page:${expectations.loginPath} status`, statusCode === 200, statusCode),
    makeCheck(`page:${expectations.loginPath} umami`, umami.length === 0, { count: umami.length })
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
