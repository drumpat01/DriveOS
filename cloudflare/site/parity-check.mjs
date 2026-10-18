#!/usr/bin/env node
// Phase-one parity check: staging Worker vs live journeydeck.me.
// Usage:
//   node parity-check.mjs --staging https://journeydeck-site.<account>.workers.dev --live https://journeydeck.me
//   options: --routes route-list.csv  --canonical https://journeydeck.me  --no-rewrite-host
//            --only <regex on path>  --concurrency 6  --timeout 20000  --json out.json  --snapshot live-observed.json
// Read-only: only GET requests, plus one POST of "{}" to /retention-messaging-api (rejected with 400, no side effects).
// Exit codes: 0 all pass, 1 any real mismatch, 2 request errors (and no mismatches), 3 bad arguments.
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { collectProblems } from "./predeploy-check.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (name, fallback) => { const i = args.findIndex(a => a === `--${name}` || a.startsWith(`--${name}=`)); if (i < 0) return fallback; const a = args[i]; return a.includes("=") ? a.slice(a.indexOf("=") + 1) : args[i + 1]; };
const flag = name => args.includes(`--${name}`);
if (flag("help") || !opt("staging") || !opt("live")) { console.error("usage: node parity-check.mjs --staging <url> --live <url> [--routes csv] [--canonical https://journeydeck.me] [--no-rewrite-host] [--only regex] [--concurrency n] [--timeout ms] [--json file] [--snapshot file]"); process.exit(3); }
const publishProblems = collectProblems(join(here, "..", ".."));
if (publishProblems.length) {
  console.error("predeploy check failed:");
  for (const problem of publishProblems) console.error(`  ${problem}`);
  process.exit(1);
}
const origin = u => { const x = new URL(u); if (!/^https?:$/.test(x.protocol)) throw new Error(`bad url ${u}`); return x.origin; };
const STAGING = origin(opt("staging")), LIVE = origin(opt("live")), CANON = origin(opt("canonical", "https://journeydeck.me"));
const REWRITE = !flag("no-rewrite-host");
const CONC = Number(opt("concurrency", 6)), TIMEOUT = Number(opt("timeout", 20000));
const only = opt("only") ? new RegExp(opt("only")) : null;

// ---- CSV ----
function parseCsv(text) {
  const out = []; let row = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; continue; }
    if (c === '"') q = true; else if (c === ",") { row.push(cell); cell = ""; } else if (c === "\n") { row.push(cell); out.push(row); row = []; cell = ""; } else if (c !== "\r") cell += c;
  }
  if (cell || row.length) { row.push(cell); out.push(row); }
  const [head, ...rest] = out; return rest.filter(r => r.length > 1).map(r => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ""])));
}
const routes = parseCsv(readFileSync(opt("routes", join(here, "route-list.csv")), "utf8"))
  .filter(r => r.probe_compare !== "skip" && r.probe_path && r.probe_method)
  .filter(r => !only || only.test(r.probe_path));
// de-duplicate identical probes (e.g. method rows sharing one probe)
const seen = new Set(); const probes = routes.filter(r => { const k = `${r.probe_method} ${r.probe_path} ${r.probe_body}`; if (seen.has(k)) return false; seen.add(k); return true; });

// ---- host rewrite ----
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
function rewriter(base) {
  if (!REWRITE || base === CANON) return s => s;
  const u = new URL(base);
  const res = [new RegExp(esc(u.origin), "g"), new RegExp(esc(`//${u.host}`), "g"), new RegExp(esc(encodeURIComponent(u.origin)), "g")];
  const c = new URL(CANON);
  return s => s == null ? s : s.replace(res[0], c.origin).replace(res[1], `//${c.host}`).replace(res[2], encodeURIComponent(c.origin));
}
const rwStaging = rewriter(STAGING), rwLive = rewriter(LIVE);

// ---- fetch + extract ----
const textTypes = /^(text\/|application\/(json|xml|linkset\+json|manifest\+json|javascript))/i;
async function probe(base, r) {
  const url = base + r.probe_path;
  const init = { method: r.probe_method, redirect: "manual", headers: { "user-agent": "journeydeck-parity-check/1.0", accept: "*/*" }, signal: AbortSignal.timeout(TIMEOUT) };
  if (r.probe_method === "POST") { init.body = r.probe_body || "{}"; init.headers["content-type"] = "application/json"; }
  let res, lastErr;
  for (let attempt = 0; attempt < 2; attempt++) { try { res = await fetch(url, init); break; } catch (e) { lastErr = e; } }
  if (!res) return { error: String(lastErr?.cause?.code || lastErr?.message || lastErr) };
  const buf = Buffer.from(await res.arrayBuffer());
  const h = n => res.headers.get(n) ?? "";
  const ct = h("content-type");
  const text = textTypes.test(ct) ? buf.toString("utf8") : null;
  const pick = (re) => { const m = text?.match(re); return m ? m[1].trim() : ""; };
  return {
    status: res.status, location: h("location"), contentType: ct, cacheControl: h("cache-control"), xRobotsTag: h("x-robots-tag"),
    csp: h("content-security-policy"), xfo: h("x-frame-options"), nosniff: h("x-content-type-options"), referrer: h("referrer-policy"),
    permissions: h("permissions-policy"), hsts: h("strict-transport-security"), link: h("link"), allow: h("allow"),
    canonical: pick(/<link[^>]+rel=["']canonical["'][^>]*href=["']([^"']+)/i) || pick(/<link[^>]+href=["']([^"']+)["'][^>]*rel=["']canonical["']/i),
    ogUrl: pick(/<meta[^>]+property=["']og:url["'][^>]*content=["']([^"']+)/i),
    title: pick(/<title[^>]*>([\s\S]*?)<\/title>/i).replace(/\s+/g, " "),
    text, bytesHash: createHash("sha256").update(buf).digest("hex"), size: buf.length,
  };
}
const norm = s => s == null ? "" : s.replace(/\r\n/g, "\n").replace(/[ \t]+/g, " ").replace(/\s*\n\s*/g, "\n").trim();
const hash = s => createHash("sha256").update(s).digest("hex").slice(0, 16);

function compare(r, s, l) {
  const mode = r.probe_compare;
  const fields = [["status", x => String(x.status), false], ["location", x => x.location, true], ["content-type", x => x.contentType, false], ["cache-control", x => x.cacheControl, false],
    ["x-robots-tag", x => x.xRobotsTag, false], ["csp", x => x.csp, false], ["x-frame-options", x => x.xfo, false], ["x-content-type-options", x => x.nosniff, false],
    ["referrer-policy", x => x.referrer, false], ["permissions-policy", x => x.permissions, false], ["hsts", x => x.hsts, false], ["link", x => x.link, true], ["allow", x => x.allow, false]];
  if (mode === "full") fields.push(["canonical", x => x.canonical, true], ["og:url", x => x.ogUrl, true], ["title", x => x.title, true], ["body", x => x.text == null ? x.bytesHash : norm(x.text), true]);
  if (mode === "status+headers+json") fields.push(["body", x => norm(x.text ?? x.bytesHash), true]);
  if (mode === "status+headers+bytes") fields.push(["body", x => x.bytesHash, false]);
  const real = [], rewritten = [];
  for (const [name, get, hostSensitive] of fields) {
    const sv = get(s), lv = get(l);
    if (sv === lv) continue;
    if (hostSensitive && REWRITE && rwStaging(sv) === rwLive(lv)) { rewritten.push(name); continue; }
    const show = v => name === "body" ? (v.length === 64 && /^[0-9a-f]+$/.test(v) ? v.slice(0, 16) : hash(v)) : JSON.stringify(v).slice(0, 90);
    real.push(`${name}: staging=${show(sv)} live=${show(lv)}`);
  }
  return { real, rewritten };
}

// ---- run ----
const results = [];
let idx = 0;
async function worker() {
  while (idx < probes.length) {
    const r = probes[idx++];
    const [s, l] = await Promise.all([probe(STAGING, r), probe(LIVE, r)]);
    if (s.error || l.error) { results.push({ r, verdict: "ERROR", detail: `staging=${s.error || "ok"} live=${l.error || "ok"}`, l }); continue; }
    const { real, rewritten } = compare(r, s, l);
    const expectNote = r.expected_status && String(l.status) !== r.expected_status ? `live status ${l.status} differs from route-list expected ${r.expected_status}` : "";
    results.push({ r, s, l, verdict: real.length ? "FAIL" : rewritten.length ? "PASS*" : "PASS", detail: real.join("; "), rewritten, expectNote });
  }
}
const started = new Date();
await Promise.all(Array.from({ length: Math.max(1, CONC) }, worker));
results.sort((a, b) => a.r.route_id.localeCompare(b.r.route_id));

const pad = (s, n) => (s.length > n ? s.slice(0, n - 1) + "~" : s).padEnd(n);
const ct = new Date().toLocaleString("en-US", { timeZone: "America/Chicago" });
console.log(`parity-check  staging=${STAGING}  live=${LIVE}  canonical=${CANON}  host-rewrite=${REWRITE ? "on" : "off"}`);
console.log(`run ${started.toLocaleString("en-US", { timeZone: "America/Chicago" })} -> ${ct} CT  probes=${probes.length} (from ${routes.length} probe-able route rows)`);
console.log("");
console.log(`${pad("id", 6)} ${pad("method", 6)} ${pad("path", 52)} ${pad("result", 6)} ${pad("st/lv", 9)} detail`);
console.log("-".repeat(120));
for (const x of results) {
  const st = x.s ? `${x.s.status}/${x.l.status}` : "-";
  const det = [x.detail, x.rewritten?.length ? `rewritten: ${x.rewritten.join(",")}` : "", x.expectNote].filter(Boolean).join(" | ");
  console.log(`${pad(x.r.route_id, 6)} ${pad(x.r.probe_method, 6)} ${pad(x.r.probe_path, 52)} ${pad(x.verdict, 6)} ${pad(st, 9)} ${det}`);
}
const c = v => results.filter(x => x.verdict === v).length;
console.log("-".repeat(120));
console.log(`PASS ${c("PASS")}  PASS* (equal only after host rewrite) ${c("PASS*")}  FAIL ${c("FAIL")}  ERROR ${c("ERROR")}  total ${results.length}`);
const rewrittenList = results.filter(x => x.verdict === "PASS*");
if (rewrittenList.length) { console.log("\nRewritten diffs (host-specific only, not counted as failures):"); for (const x of rewrittenList) console.log(`  ${x.r.route_id} ${x.r.probe_path}: ${x.rewritten.join(", ")}`); }
const realList = results.filter(x => x.verdict === "FAIL");
if (realList.length) { console.log("\nReal mismatches:"); for (const x of realList) console.log(`  ${x.r.route_id} ${x.r.probe_method} ${x.r.probe_path}: ${x.detail}`); }
const expectList = results.filter(x => x.expectNote);
if (expectList.length) { console.log("\nLive differs from route-list expectations (informational, not a parity failure):"); for (const x of expectList) console.log(`  ${x.r.route_id} ${x.r.probe_path}: ${x.expectNote}`); }

if (opt("json")) writeFileSync(opt("json"), JSON.stringify(results.map(x => ({ id: x.r.route_id, method: x.r.probe_method, path: x.r.probe_path, verdict: x.verdict, detail: x.detail, rewritten: x.rewritten, staging: x.s && { ...x.s, text: undefined }, live: x.l && { ...x.l, text: undefined } })), null, 2));
if (opt("snapshot")) {
  const snap = {};
  for (const x of results) if (x.l && !x.l.error) snap[`${x.r.probe_method} ${x.r.probe_path}`] = { status: x.l.status, contentType: x.l.contentType, cacheControl: x.l.cacheControl, xRobotsTag: x.l.xRobotsTag, location: x.l.location };
  writeFileSync(opt("snapshot"), JSON.stringify(snap, null, 2));
}
process.exit(c("FAIL") ? 1 : c("ERROR") ? 2 : 0);
