#!/usr/bin/env node
// Fails when the asset bundle would publish a file main has deleted, or when
// a text file under web/ contains a CR. The workers.dev deploy from a Windows
// checkout shipped CRLF, and a pre-#304 deploy served three private screenshots.
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { dirname, extname, join, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const BINARY_EXTENSIONS = new Set([".webp", ".png", ".jpg", ".jpeg", ".gif", ".pdf", ".zip", ".cer", ".woff", ".woff2", ".ico", ".mp4", ".avif", ".ttf", ".otf", ".eot"]);

export function parseAssetsIgnore(text) {
  return text.split(/\r?\n/).map(line => line.replace(/#.*$/, "").trim()).filter(Boolean);
}

export function isAssetsIgnored(rel, patterns) {
  const normalized = rel.split("\\").join("/");
  return patterns.some(pattern => {
    const rule = pattern.split("\\").join("/");
    if (rule.endsWith("/")) return normalized === rule.slice(0, -1) || normalized.startsWith(rule);
    return normalized === rule || normalized.endsWith(`/${rule}`);
  });
}

export function walkFiles(directory) {
  return readdirSync(directory).flatMap(name => {
    const path = join(directory, name);
    return statSync(path).isDirectory() ? walkFiles(path) : [path];
  });
}

function git(repo, args) {
  return execFileSync("git", ["-C", repo, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

export function deletedOnMain(repo, mainRef) {
  const removed = git(repo, ["log", mainRef, "--diff-filter=D", "--name-only", "--pretty=format:", "--", "web/"]);
  const present = new Set(git(repo, ["ls-tree", "-r", "--name-only", `${mainRef}:web`]).split("\n").map(line => line.trim()).filter(Boolean));
  const deleted = new Set();
  for (const line of removed.split("\n")) {
    const path = line.trim();
    if (!path.startsWith("web/")) continue;
    const rel = path.slice("web/".length);
    if (!present.has(rel)) deleted.add(rel);
  }
  return deleted;
}

export function collectProblems(repo, mainRef = "origin/main") {
  const webDir = join(repo, "web");
  const ignorePath = join(webDir, ".assetsignore");
  const patterns = existsSync(ignorePath) ? parseAssetsIgnore(readFileSync(ignorePath, "utf8")) : [];
  const rels = walkFiles(webDir).map(file => relative(webDir, file).split("\\").join("/"));
  const published = rels.filter(rel => rel !== ".assetsignore" && !isAssetsIgnored(rel, patterns));
  const problems = [];
  let deleted;
  try { deleted = deletedOnMain(repo, mainRef); }
  catch (error) {
    problems.push(`Could not read ${mainRef} to see which web/ files main deleted: ${error instanceof Error ? error.message : error}`);
    deleted = new Set();
  }
  for (const rel of published) {
    if (deleted.has(rel)) problems.push(`web/${rel} was deleted on ${mainRef} and would still be published`);
  }
  for (const rel of rels) {
    if (BINARY_EXTENSIONS.has(extname(rel).toLowerCase())) continue;
    if (readFileSync(join(webDir, rel)).includes(0x0d)) problems.push(`web/${rel} contains a CR. Text assets must be LF.`);
  }
  return problems;
}

function main() {
  const repo = process.argv[2] || join(here, "..", "..");
  const problems = collectProblems(repo);
  if (problems.length === 0) {
    console.log("predeploy check passed");
    return;
  }
  for (const problem of problems) console.error(problem);
  process.exit(1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
