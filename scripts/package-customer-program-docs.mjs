#!/usr/bin/env node
/**
 * Builds dist/rapid-cortex-customer-program-docs-<YYYYMMDD>.zip from
 * demo/customer-program-documentation-bundle.json (requires `zip` on PATH).
 */
import { execFileSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const manifestPath = path.join(root, "demo", "customer-program-documentation-bundle.json");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

const now = new Date();
const stamp =
  String(now.getUTCFullYear()) +
  String(now.getUTCMonth() + 1).padStart(2, "0") +
  String(now.getUTCDate()).padStart(2, "0");

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "rc-cust-docs-"));

function copyIntoTree(rel) {
  const src = path.join(root, rel);
  if (!fs.existsSync(src)) {
    console.error("Missing file (update the manifest or restore the path):", rel);
    process.exit(1);
  }
  const dest = path.join(tmp, rel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

for (const f of manifest.files) {
  copyIntoTree(f);
}

fs.copyFileSync(
  manifestPath,
  path.join(tmp, "customer-program-documentation-bundle.json"),
);

const readme = [
  `${manifest.title} (manifest version ${manifest.version})`,
  `Cover document: ${manifest.coverFile}`,
  ...(manifest.staticManualFile
    ? [`Complete Operations Manual (HTML): ${manifest.staticManualFile}`]
    : []),
  `Packaged (UTC): ${now.toISOString()}`,
  "",
  "Rebuild from repository root:",
  "  npm run package:customer-docs",
  "",
  "Narrative context: docs/JURISDICTION_OPERATIONS_GUIDE.md — Appendix A.",
].join("\n");
fs.writeFileSync(path.join(tmp, "README.txt"), readme);

const outDir = path.join(root, "dist");
fs.mkdirSync(outDir, { recursive: true });
const zipPath = path.join(outDir, `rapid-cortex-customer-program-docs-${stamp}.zip`);

execFileSync("zip", ["-r", "-q", zipPath, "."], { cwd: tmp, stdio: "inherit" });
fs.rmSync(tmp, { recursive: true, force: true });
console.log("Wrote", zipPath);
