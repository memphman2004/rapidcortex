#!/usr/bin/env node
/**
 * Fails CI if common secret / key material patterns appear in tracked source (excluding docs that describe patterns).
 * Run: node scripts/check-repo-secrets.mjs
 */
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const ALLOWLIST_PATH_SUBSTRINGS = [
  `${path.sep}node_modules${path.sep}`,
  `${path.sep}.next${path.sep}`,
  `${path.sep}dist${path.sep}`,
  `${path.sep}npm-audit-report.json`,
  "check-repo-secrets.mjs",
  "SECURITY_HARDENING_AUDIT.md",
  "CJIS_ALIGNMENT_NOTES.md",
];

const PATTERNS = [
  { name: "AWS access key id", re: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: "Private key PEM", re: /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
  { name: "GitHub PAT classic", re: /\bghp_[A-Za-z0-9]{20,}\b/ },
  { name: "Slack bot token", re: /\bxoxb-[0-9]+-[0-9]+-[A-Za-z0-9]+\b/ },
];

function shouldSkip(file) {
  const n = file.replace(/\\/g, "/");
  return ALLOWLIST_PATH_SUBSTRINGS.some((s) => n.includes(s.replace(/\//g, path.sep)));
}

function trackedFiles() {
  try {
    const out = execSync("git ls-files", { cwd: ROOT, encoding: "utf8" });
    return out
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .map((f) => path.join(ROOT, f));
  } catch {
    console.warn("check-repo-secrets: not a git repo or git ls-files failed; scanning apps/ packages/ infra/ docs/");
    const dirs = ["apps", "packages", "infra", "scripts"];
    const files = [];
    function walk(d) {
      if (!fs.existsSync(d)) return;
      for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, ent.name);
        if (ent.isDirectory()) {
          if (ent.name === "node_modules" || ent.name === ".next" || ent.name === "dist") continue;
          walk(p);
        } else files.push(p);
      }
    }
    for (const d of dirs) walk(path.join(ROOT, d));
    return files;
  }
}

let failed = false;
for (const file of trackedFiles()) {
  if (shouldSkip(file)) continue;
  const ext = path.extname(file);
  if (![".ts", ".tsx", ".js", ".mjs", ".cjs", ".json", ".yaml", ".yml", ".env", ".example", ".md", ".sh"].includes(ext))
    continue;
  let content;
  try {
    content = fs.readFileSync(file, "utf8");
  } catch {
    continue;
  }
  for (const { name, re } of PATTERNS) {
    if (re.test(content)) {
      console.error(`[check-repo-secrets] ${name} pattern matched: ${path.relative(ROOT, file)}`);
      failed = true;
    }
  }
}

if (failed) {
  console.error("\ncheck-repo-secrets: remove or redact matched material before merge.\n");
  process.exit(1);
}
console.log("check-repo-secrets: no blocked patterns in scanned files.");
process.exit(0);
