import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const templateDir = path.join(root, "grok-bot-templates", "fleet-audit-dashboard");
const dashboardPath = path.join(templateDir, "dashboard", "fleet-audit-dashboard.html");

function listFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(directory, entry.name);
    return entry.isDirectory() ? listFiles(full) : [path.relative(templateDir, full).split(path.sep).join("/")];
  }).sort();
}

function read(relative: string) {
  return fs.readFileSync(path.join(templateDir, relative), "utf8");
}

function readmeTableRows(heading: string) {
  const readme = read("README.md");
  const start = readme.indexOf(`## ${heading}`);
  assert.ok(start >= 0, `README has a ${heading} section`);
  const end = readme.indexOf("\n## ", start + 3);
  return readme.slice(start, end < 0 ? undefined : end)
    .split("\n")
    .filter(line => line.startsWith("| ") && !line.startsWith("|---") && !/^\| (File|Placeholder) \|/.test(line))
    .map(line => line.split("|")[1].trim());
}

function dashboardScript() {
  const html = fs.readFileSync(dashboardPath, "utf8");
  const scripts = [...html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)];
  const data = scripts.find(match => match[1].includes('id="fleet-data"'));
  const code = scripts.find(match => !match[1].includes("type="));
  assert.ok(data && code, "the dashboard has a data block and one script");
  return { html, data: JSON.parse(data[2]), code: code[2] };
}

function loadDashboardLogic() {
  const context: Record<string, any> = {};
  vm.createContext(context);
  vm.runInContext(dashboardScript().code, context);
  return context;
}

const sample = JSON.parse(read("dashboard/sample-fleet-audit.json"));

test("fleet audit template lists every file in its README and nothing more", () => {
  const files = listFiles(templateDir);
  assert.deepEqual(readmeTableRows("What's in the folder").sort(), files);
});

test("fleet audit template documents every placeholder it uses", () => {
  const used = new Set<string>();
  for (const file of listFiles(templateDir)) {
    for (const match of read(file).matchAll(/\{\{([A-Z_]+)\}\}/g)) used.add(match[1]);
  }
  const documented = readmeTableRows("Placeholders").map(cell => cell.replace(/[{}]/g, ""));
  assert.deepEqual([...used].sort(), [...documented].sort());
});

test("fleet audit template holds no secrets, personal addresses or private file types", () => {
  const secretPatterns: Array<[string, RegExp]> = [
    ["private key", /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
    ["GitHub token", /\bgh[pousr]_[A-Za-z0-9]{20,}/],
    ["Slack token", /\bxox[abprs]-[A-Za-z0-9-]{10,}/],
    ["AWS key", /\bAKIA[0-9A-Z]{16}\b/],
    ["API key prefix", /\b(sk|pk|rk)[-_](live|test|proj|ant)[-_][A-Za-z0-9]{8,}/],
    ["JWT", /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\./],
    ["long opaque string", /\b[A-Za-z0-9+/_-]{40,}\b/],
    ["assigned credential", /\b(api[_-]?key|secret|password|token)\b\s*[:=]\s*["']?[A-Za-z0-9+/_-]{8,}/i],
    ["email address", /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/]
  ];
  for (const file of listFiles(templateDir)) {
    assert.doesNotMatch(file, /token|secret|\.(zip|env|pem|key|p12|pfx|log)$/i, `${file} has a private-looking name`);
    const text = read(file);
    for (const [label, pattern] of secretPatterns) {
      assert.doesNotMatch(text, pattern, `${file} contains a ${label}`);
    }
    const urls = [...text.matchAll(/https?:\/\/[^\s"'<>)]+/g)].map(match => match[0]);
    const allowed = file === "dashboard/fleet-audit.schema.json" ? ["https://json-schema.org/draft/2020-12/schema"] : [];
    assert.deepEqual(urls.filter(url => !allowed.includes(url)), [], `${file} links outside the template`);
  }
});

test("fleet audit dashboard is one self-contained page", () => {
  const { html } = dashboardScript();
  assert.match(html, /<meta http-equiv="Content-Security-Policy" content="default-src 'none';/);
  assert.doesNotMatch(html, /\s(src|href|action|srcset)\s*=/i, "no outside resources or links");
  assert.doesNotMatch(html, /url\(|@import|fetch\(|XMLHttpRequest|WebSocket|EventSource|sendBeacon|\.innerHTML|eval\(/);
  assert.doesNotMatch(html, /[�ÃÂ]/, "no mojibake");
});

test("fleet audit dashboard ships with the sample data", () => {
  assert.deepEqual(dashboardScript().data, sample);
});

test("fleet audit dashboard and schema agree on the allowed values", () => {
  const schema = JSON.parse(read("dashboard/fleet-audit.schema.json"));
  const logic = loadDashboardLogic();
  const routine = schema.properties.bots.items.properties.routines.items.properties;
  const finding = schema.properties.findings.items.properties;
  assert.deepEqual(Object.keys(logic.STATUSES), routine.status.enum);
  assert.deepEqual(Object.keys(logic.SEVERITIES), finding.severity.enum);
  assert.deepEqual(Object.keys(logic.KINDS), finding.kind.enum);
  assert.deepEqual(Object.keys(sample).sort(), [...schema.required].sort());
});

test("fleet audit sample data is valid and sums up the way the README says", () => {
  const logic = loadDashboardLogic();
  assert.deepEqual([...logic.validateAudit(sample)], []);
  const summary = logic.summarizeAudit(sample);
  assert.equal(summary.bots, 4);
  assert.equal(summary.routines, 8);
  assert.equal(summary.runsPerDay, 49.1);
  assert.equal(summary.overBudget, true);
  assert.equal(summary.problemRoutines, 3);
  assert.equal(summary.findings.length, 5);
  assert.equal(summary.runsSaved, 21);
  assert.deepEqual([...summary.topThree.map((finding: { id: string }) => finding.id)], ["F1", "F2", "F3"]);
  assert.deepEqual([...summary.findings.map((finding: { severity: string }) => finding.severity)], ["high", "high", "medium", "medium", "low"]);
  assert.match(read("README.md"), /4 bots, 8 routines, 49\.1 runs a day over a budget of 40, 3 routines with problems and 5 findings/);
});

test("fleet audit dashboard rejects data that doesn't match the format", () => {
  const logic = loadDashboardLogic();
  const broken = structuredClone(sample);
  broken.bots[0].routines[0].status = "great";
  broken.findings[0].routine = "morning-brief";
  broken.topThree.push("F9");
  broken.runBudgetPerDay = -1;
  const errors = [...logic.validateAudit(broken)].join("\n");
  assert.match(errors, /bots\[0\]\.routines\[0\]\.status isn't one of/);
  assert.match(errors, /findings\[0\]\.routine must be one of that bot's routine ids/);
  assert.match(errors, /topThree must be a list of up to three finding ids/);
  assert.match(errors, /runBudgetPerDay must be a number or null/);
  assert.deepEqual([...logic.validateAudit("not an audit")], ["The file isn't a fleet audit object."]);

  const unknown = structuredClone(sample);
  unknown.topThree = ["F9"];
  assert.deepEqual([...logic.validateAudit(unknown)], ["topThree names F9, which isn't a finding."]);
});
