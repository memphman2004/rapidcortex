#!/usr/bin/env npx tsx
/**
 * Rapid Cortex — Stress Test Report Generator
 *
 * Reads results/k6-summary.json (produced by rc-stress-test.js handleSummary),
 * evaluates against MSA Exhibit C §C.5.1 SLA thresholds, and emits:
 *   - results/stress-report.html  — shareable HTML report with pass/fail table
 *   - results/stress-report.json  — structured JSON for CI consumption
 *
 * Usage:
 *   npx tsx scripts/generate-stress-report.ts
 *   npx tsx scripts/generate-stress-report.ts --input results/k6-summary.json
 *   npx tsx scripts/generate-stress-report.ts --input results/k6-summary.json --out results/
 *
 * CI exit codes:
 *   0 — all SLA thresholds passed
 *   1 — one or more SLA thresholds failed (or input file not found)
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { apiP95BudgetMs, errorRateBudget } from "./perf/k6-thresholds.js";

// ── CLI ──────────────────────────────────────────────────────────────────────

const { values: argv } = parseArgs({
  options: {
    input: { type: "string", default: "results/k6-summary.json" },
    out:   { type: "string", default: "results" },
  },
});

const INPUT_PATH = argv.input as string;
const OUT_DIR    = argv.out   as string;

// ── Types ─────────────────────────────────────────────────────────────────────

interface K6SummaryMeta {
  profile:     string;
  timestamp:   string;
  api_base:    string;
  web_base:    string;
  vus_max:     number | string;
  duration_ms: number;
}

interface K6SummarySLA {
  api_p95_ms:           number | null;
  api_p95_pass:         boolean;
  page_load_p95_ms:     number | null;
  page_load_pass:       boolean;
  search_p95_ms:        number | null;
  search_pass:          boolean;
  transcription_p95_ms: number | null;
  transcription_pass:   boolean;
  error_rate:           number | null;
  error_rate_pass:      boolean;
}

interface K6MetricValues {
  avg?:   number;
  min?:   number;
  med?:   number;
  max?:   number;
  "p(90)"?: number;
  "p(95)"?: number;
  "p(99)"?: number;
  count?: number;
  rate?:  number;
  value?: number;
}

interface K6Metric {
  type:   string;
  values: K6MetricValues;
}

interface K6Summary {
  meta: K6SummaryMeta;
  sla:  K6SummarySLA;
  raw:  { metrics?: Record<string, K6Metric> };
}

// ── SLA definitions — MSA Exhibit C §C.5.1 ───────────────────────────────────

interface SLAGate {
  id:          string;
  label:       string;
  msa_ref:     string;
  threshold:   string;
  actual:      number | null;
  passed:      boolean;
  unit:        string;
  note?:       string;
}

function pass(id: string, label: string, ref: string, threshold: string, actual: number | null, unit: string, note?: string): SLAGate {
  return { id, label, msa_ref: ref, threshold, actual, passed: true, unit, note };
}

function fail(id: string, label: string, ref: string, threshold: string, actual: number | null, unit: string, note?: string): SLAGate {
  return { id, label, msa_ref: ref, threshold, actual, passed: false, unit, note };
}

function gate(
  id: string,
  label: string,
  ref: string,
  threshold: string,
  actual: number | null,
  limit: number,
  unit: string,
  note?: string,
  optional = false,
): SLAGate {
  if (optional && actual === null) {
    return pass(id, label, ref, threshold, actual, unit, note ?? "Not sampled in this profile");
  }
  const passed = actual !== null && actual < limit;
  const fn = passed ? pass : fail;
  return fn(id, label, ref, threshold, actual, unit, note);
}

function buildSLAGates(summary: K6Summary): SLAGate[] {
  const { sla, meta } = summary;
  const profile = meta.profile || "load";
  const apiBudget = apiP95BudgetMs(profile);
  const errorLimitPct = errorRateBudget(profile) * 100;
  const isSmoke = profile === "smoke";

  const gates: SLAGate[] = [
    gate(
      "api_p95",
      "API Response Time (p95)",
      "MSA Exhibit C §C.5.1",
      `< ${apiBudget.toLocaleString()} ms`,
      sla.api_p95_ms,
      apiBudget,
      "ms",
      isSmoke
        ? "Smoke connectivity gate (5s budget allows Lambda cold start)"
        : "95th-percentile latency across all API group requests",
    ),
  ];

  if (!isSmoke) {
    gates.push(
      gate(
        "page_load",
        "Page Load Time (p95)",
        "MSA Exhibit C §C.5.1",
        "< 3,000 ms",
        sla.page_load_p95_ms,
        3000,
        "ms",
        "Measured at Web group requests (Next.js SSR shell)",
        true,
      ),
      gate(
        "search",
        "Search Results Latency (p95)",
        "MSA Exhibit C §C.5.1",
        "< 2,000 ms",
        sla.search_p95_ms,
        2000,
        "ms",
        "Proxied via active-incidents list endpoint (DynamoDB scan path)",
        true,
      ),
      gate(
        "transcription",
        "Transcription Latency (p95)",
        "MSA Exhibit C §C.5.1",
        "< 2,000 ms",
        sla.transcription_p95_ms,
        2000,
        "ms",
        "Translation + transcription/start endpoints combined",
        true,
      ),
    );
  }

  gates.push(
    gate(
      "error_rate",
      "HTTP Error Rate",
      "MSA Exhibit C §8.4 / §C.4",
      `< ${errorLimitPct}%`,
      sla.error_rate !== null ? sla.error_rate * 100 : null,
      errorLimitPct,
      "%",
      "All non-2xx/3xx responses across all groups",
    ),
  );

  return gates;
}

// ── AI-assisted findings generator ───────────────────────────────────────────

function generateFindings(summary: K6Summary, gates: SLAGate[]): string[] {
  const findings: string[] = [];
  const { sla, meta, raw } = summary;
  const metrics = raw.metrics ?? {};

  const allPass = gates.every((g) => g.passed);
  const failedGates = gates.filter((g) => !g.passed);
  const vusMax = typeof meta.vus_max === "number" ? meta.vus_max : 0;

  if (allPass) {
    findings.push(
      `All ${gates.length} MSA Exhibit C §C.5.1 SLA gates passed under the "${meta.profile}" load profile at ${vusMax} peak concurrent users.`,
    );
  } else {
    findings.push(
      `${failedGates.length} of ${gates.length} SLA gate(s) failed under the "${meta.profile}" load profile at ${vusMax} peak concurrent users: ${failedGates.map((g) => g.label).join(", ")}.`,
    );
  }

  // API latency analysis
  const apiP95 = sla.api_p95_ms;
  const apiBudget = apiP95BudgetMs(meta.profile);
  const apiP99 =
    metrics.api_latency_ms?.values?.["p(99)"] ??
    metrics["http_req_duration{group:::API}"]?.values?.["p(99)"] ??
    null;
  if (apiP95 !== null) {
    if (apiP95 < apiBudget * 0.4) {
      findings.push(`API p95 latency (${apiP95.toFixed(0)}ms) is well within the ${apiBudget}ms ${meta.profile} budget — headroom exists for further load increases.`);
    } else if (apiP95 < apiBudget * 0.8) {
      findings.push(`API p95 latency (${apiP95.toFixed(0)}ms) is within the ${apiBudget}ms ${meta.profile} budget. Monitor closely under heavier profiles.`);
    } else if (apiP95 < apiBudget) {
      findings.push(`API p95 latency (${apiP95.toFixed(0)}ms) is approaching the ${apiBudget}ms ${meta.profile} ceiling. Investigate Lambda cold start frequency, DynamoDB RCU allocation, and API Gateway timeout settings before production.`);
    } else {
      findings.push(`API p95 latency (${apiP95.toFixed(0)}ms) EXCEEDS the ${apiBudget}ms ${meta.profile} budget. This is a production readiness blocker. Investigate Lambda memory allocation, DynamoDB provisioned capacity, and connection pooling.`);
    }
    if (apiP99 !== null) {
      findings.push(`API p99 latency is ${apiP99.toFixed(0)}ms — the ${(apiP99 - (apiP95 ?? 0)).toFixed(0)}ms tail spread between p95 and p99 ${apiP99 - (apiP95 ?? 0) > 300 ? "indicates Lambda cold starts or DynamoDB throttling spikes affecting the tail" : "is within acceptable bounds"}.`);
    }
  }

  // Error rate analysis
  const errRate = sla.error_rate;
  const errBudget = errorRateBudget(meta.profile);
  if (errRate !== null) {
    if (errRate === 0) {
      findings.push("Zero HTTP errors recorded. All endpoints returned expected status codes across the full test duration.");
    } else if (errRate < errBudget / 10) {
      findings.push(`Error rate is ${(errRate * 100).toFixed(4)}% — effectively zero. Within the ${meta.profile} budget with significant margin.`);
    } else if (errRate >= errBudget) {
      findings.push(`Error rate of ${(errRate * 100).toFixed(2)}% EXCEEDS the ${errBudget * 100}% ${meta.profile} threshold. Review CloudWatch Lambda error logs and API Gateway 5xx metrics to identify the failing routes.`);
    }
  }

  // Auth error analysis
  const authErrCount = metrics["auth_errors"]?.values?.count ?? 0;
  if (authErrCount > 0) {
    findings.push(`${authErrCount} auth error(s) detected. BEARER_TOKEN may be expired, or Cognito token validation is failing under concurrent load. Verify token refresh logic and Cognito user pool limits.`);
  }

  // Transcription / translation
  const transcP95 = sla.transcription_p95_ms;
  if (transcP95 !== null && transcP95 > 1500) {
    findings.push(`Transcription/translation p95 latency (${transcP95.toFixed(0)}ms) is elevated. Under the load profile this may indicate Lambda cold starts on the AI inference functions. Consider provisioned concurrency for these functions in production.`);
  }

  // Profile-specific guidance
  if (meta.profile === "soak") {
    findings.push("Post-soak: verify CloudWatch for Lambda memory growth over time, DynamoDB throttle events, and WebSocket connection table item counts. Soak profiles surface gradual resource leaks not visible in short runs.");
  }

  if (meta.profile === "spike") {
    findings.push("Spike profile simulates a mass-casualty event surge. Review Lambda concurrency limits and any auto-scaling delays in ECS/Fargate (SSR tier). If the spike profile shows >5% error rate, increase Lambda reserved concurrency or enable DynamoDB auto-scaling for the incidents table.");
  }

  // SLA note per §C.5.1
  findings.push(
    "Per MSA Exhibit C §C.5.1: performance targets are best-effort commitments. The contractual SLA and service credit mechanism applies to monthly uptime (§C.1.1 / §8.4) at the 99.9% threshold, not to individual request latency.",
  );

  return findings;
}

// ── HTML report builder ───────────────────────────────────────────────────────

function fmt(v: number | null, unit: string): string {
  if (v === null) return "—";
  if (unit === "%") return `${v.toFixed(3)}%`;
  return `${v.toFixed(0)} ${unit}`;
}

function statusBadge(passed: boolean): string {
  return passed
    ? `<span class="badge pass">PASS</span>`
    : `<span class="badge fail">FAIL</span>`;
}

function buildHTML(summary: K6Summary, gates: SLAGate[], findings: string[]): string {
  const { meta } = summary;
  const overallPass = gates.every((g) => g.passed);
  const ts = new Date(meta.timestamp).toLocaleString("en-US", { timeZone: "UTC", timeZoneName: "short" });
  const durationSec = meta.duration_ms > 0 ? `${(meta.duration_ms / 1000).toFixed(0)}s` : "—";

  const gateRows = gates
    .map(
      (g) => `
      <tr class="${g.passed ? "" : "row-fail"}">
        <td>${g.label}</td>
        <td class="mono">${g.threshold}</td>
        <td class="mono">${fmt(g.actual, g.unit)}</td>
        <td>${statusBadge(g.passed)}</td>
        <td class="ref">${g.msa_ref}</td>
      </tr>`,
    )
    .join("\n");

  const findingItems = findings
    .map((f) => `<li>${f}</li>`)
    .join("\n");

  const rawMetrics = summary.raw.metrics ?? {};
  const metricsRows = Object.entries(rawMetrics)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, m]) => {
      const v = m.values;
      return `<tr>
        <td class="mono metric-name">${name}</td>
        <td class="mono">${v.avg?.toFixed(2) ?? "—"}</td>
        <td class="mono">${v["p(95)"]?.toFixed(2) ?? "—"}</td>
        <td class="mono">${v["p(99)"]?.toFixed(2) ?? "—"}</td>
        <td class="mono">${v.max?.toFixed(2) ?? "—"}</td>
        <td class="mono">${v.count ?? v.rate?.toFixed(5) ?? "—"}</td>
      </tr>`;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Rapid Cortex — Stress Test Report (${meta.profile})</title>
<style>
  :root {
    --bg:        #0d0f14;
    --surface:   #151820;
    --border:    #1e2330;
    --muted:     #5a6070;
    --body:      #9ba3b8;
    --white:     #e8eaf0;
    --blue:      #3b82f6;
    --red:       #ef4444;
    --green:     #22c55e;
    --amber:     #f59e0b;
    --mono:      'JetBrains Mono', 'Fira Code', monospace;
    --sans:      -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: var(--bg); color: var(--body); font-family: var(--sans); font-size: 14px; line-height: 1.6; }

  header {
    background: var(--surface);
    border-bottom: 1px solid var(--border);
    padding: 20px 32px;
    display: flex;
    align-items: center;
    gap: 16px;
  }
  .logo { font-size: 18px; font-weight: 700; color: var(--white); letter-spacing: -0.02em; }
  .logo span { color: var(--blue); }
  .report-type { font-size: 12px; color: var(--muted); font-weight: 500; text-transform: uppercase; letter-spacing: 0.08em; }

  .verdict-banner {
    padding: 14px 32px;
    font-size: 13px;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    border-bottom: 1px solid var(--border);
  }
  .verdict-banner.pass { background: rgba(34,197,94,0.08); color: var(--green); border-left: 3px solid var(--green); }
  .verdict-banner.fail { background: rgba(239,68,68,0.08); color: var(--red);   border-left: 3px solid var(--red);   }

  main { max-width: 1100px; margin: 0 auto; padding: 40px 32px 80px; }

  .meta-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 12px;
    margin-bottom: 40px;
  }
  .meta-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 14px 16px;
  }
  .meta-card .label { font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 4px; }
  .meta-card .value { font-size: 16px; font-weight: 600; color: var(--white); font-family: var(--mono); }

  h2 {
    font-size: 13px;
    font-weight: 600;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    margin: 0 0 16px;
    padding-bottom: 8px;
    border-bottom: 1px solid var(--border);
  }

  section { margin-bottom: 48px; }

  table { width: 100%; border-collapse: collapse; }
  th, td { padding: 10px 14px; text-align: left; border-bottom: 1px solid var(--border); }
  th { font-size: 11px; font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: 0.06em; background: var(--surface); }
  td { color: var(--body); }
  tr:hover td { background: rgba(255,255,255,0.02); }
  tr.row-fail td { background: rgba(239,68,68,0.04); }

  .mono { font-family: var(--mono); font-size: 13px; }
  .ref  { font-size: 12px; color: var(--muted); }
  .metric-name { color: var(--white); }

  .badge {
    display: inline-block;
    padding: 2px 10px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }
  .badge.pass { background: rgba(34,197,94,0.12); color: var(--green); }
  .badge.fail { background: rgba(239,68,68,0.12); color: var(--red);   }

  .findings { background: var(--surface); border: 1px solid var(--border); border-radius: 6px; padding: 20px 24px; }
  .findings li { color: var(--body); margin-bottom: 10px; line-height: 1.7; padding-left: 4px; }
  .findings li:last-child { margin-bottom: 0; color: var(--muted); font-style: italic; font-size: 13px; }

  .raw-table-wrap { overflow-x: auto; }
  .raw-table-wrap table { min-width: 700px; }

  footer {
    background: var(--surface);
    border-top: 1px solid var(--border);
    padding: 20px 32px;
    text-align: center;
    font-size: 12px;
    color: var(--muted);
  }
</style>
</head>
<body>

<header>
  <div>
    <div class="logo">Rapid<span>Cortex</span></div>
    <div class="report-type">Stress Test Report</div>
  </div>
</header>

<div class="verdict-banner ${overallPass ? "pass" : "fail"}">
  ${overallPass
    ? `✓  All SLA gates passed — Profile: ${meta.profile} — ${ts}`
    : `✗  ${gates.filter((g) => !g.passed).length} SLA gate(s) failed — Profile: ${meta.profile} — ${ts}`}
</div>

<main>

  <section>
    <div class="meta-grid">
      <div class="meta-card"><div class="label">Profile</div><div class="value">${meta.profile}</div></div>
      <div class="meta-card"><div class="label">Peak VUs</div><div class="value">${meta.vus_max}</div></div>
      <div class="meta-card"><div class="label">Generated</div><div class="value" style="font-size:13px">${ts}</div></div>
      <div class="meta-card"><div class="label">API Base</div><div class="value" style="font-size:11px;word-break:break-all">${meta.api_base}</div></div>
    </div>
  </section>

  <section>
    <h2>SLA Gate Results — MSA Exhibit C §C.5.1</h2>
    <table>
      <thead>
        <tr>
          <th>Metric</th>
          <th>Threshold</th>
          <th>Actual</th>
          <th>Status</th>
          <th>MSA Reference</th>
        </tr>
      </thead>
      <tbody>
        ${gateRows}
      </tbody>
    </table>
  </section>

  <section>
    <h2>Findings &amp; Recommendations</h2>
    <div class="findings">
      <ul>
        ${findingItems}
      </ul>
    </div>
  </section>

  <section>
    <h2>Raw k6 Metrics</h2>
    <div class="raw-table-wrap">
      <table>
        <thead>
          <tr>
            <th>Metric</th>
            <th>Avg</th>
            <th>p95</th>
            <th>p99</th>
            <th>Max</th>
            <th>Count / Rate</th>
          </tr>
        </thead>
        <tbody>
          ${metricsRows}
        </tbody>
      </table>
    </div>
  </section>

</main>

<footer>
  Rapid Cortex — Intelligence at the speed of response ·
  Report generated ${ts} ·
  SLA thresholds per MSA Exhibit C §C.5.1 and §8.4
</footer>

</body>
</html>`;
}

// ── Structured JSON report ────────────────────────────────────────────────────

interface ReportJSON {
  meta:     K6SummaryMeta;
  overall:  "PASS" | "FAIL";
  gates:    SLAGate[];
  findings: string[];
  generated_at: string;
}

function buildJSONReport(summary: K6Summary, gates: SLAGate[], findings: string[]): ReportJSON {
  return {
    meta:      summary.meta,
    overall:   gates.every((g) => g.passed) ? "PASS" : "FAIL",
    gates,
    findings,
    generated_at: new Date().toISOString(),
  };
}

// ── Entry point ───────────────────────────────────────────────────────────────

function main() {
  // Load k6 summary
  let raw: string;
  try {
    raw = readFileSync(INPUT_PATH, "utf-8");
  } catch (e) {
    console.error(`[generate-stress-report] Cannot read input file: ${INPUT_PATH}`);
    console.error((e as Error).message);
    process.exit(1);
  }

  let summary: K6Summary;
  try {
    summary = JSON.parse(raw) as K6Summary;
  } catch (e) {
    console.error(`[generate-stress-report] Failed to parse JSON: ${(e as Error).message}`);
    process.exit(1);
  }

  // Validate shape
  if (!summary.meta || !summary.sla) {
    console.error("[generate-stress-report] Input does not look like a k6-summary.json from rc-stress-test.js — missing .meta or .sla keys.");
    process.exit(1);
  }

  // Build artefacts
  const gates    = buildSLAGates(summary);
  const findings = generateFindings(summary, gates);
  const html     = buildHTML(summary, gates, findings);
  const json     = buildJSONReport(summary, gates, findings);

  // Write outputs
  mkdirSync(OUT_DIR, { recursive: true });
  const htmlPath = join(OUT_DIR, "stress-report.html");
  const jsonPath = join(OUT_DIR, "stress-report.json");
  writeFileSync(htmlPath, html, "utf-8");
  writeFileSync(jsonPath, JSON.stringify(json, null, 2), "utf-8");

  // Console summary
  const overall = json.overall;
  const failedCount = gates.filter((g) => !g.passed).length;

  console.log("");
  console.log("═══════════════════════════════════════════════════════");
  console.log(" Rapid Cortex — Stress Test Report");
  console.log("═══════════════════════════════════════════════════════");
  console.log(` Profile:  ${summary.meta.profile}`);
  console.log(` Peak VUs: ${summary.meta.vus_max}`);
  console.log(` Overall:  ${overall}`);
  console.log("");
  for (const g of gates) {
    const icon = g.passed ? "✓" : "✗";
    const actual = fmt(g.actual, g.unit);
    console.log(` ${icon}  ${g.label.padEnd(36)} ${actual.padStart(12)}  (threshold: ${g.threshold})`);
  }
  console.log("");
  console.log(` HTML report: ${htmlPath}`);
  console.log(` JSON report: ${jsonPath}`);
  console.log("═══════════════════════════════════════════════════════");
  console.log("");

  // CI exit code
  process.exit(overall === "PASS" ? 0 : 1);
}

main();
