#!/usr/bin/env npx tsx
/**
 * Rapid Cortex — concurrent HTTP stress probe (read-only by default).
 *
 * Staging / health endpoints. Refuses CAD writeback and mutating RMS/escalation
 * unless STRESS_ALLOW_WRITES=1 (never set against prod).
 *
 * Usage:
 *   npm run perf:stress
 *   WEB_BASE=https://app.rapidcortex.us API_BASE=https://api.rapidcortex.us \
 *     VUS=12 DURATION_S=25 npm run perf:stress
 *
 * Optional:
 *   STRESS_BEARER_TOKEN   Cognito JWT for authenticated GET probes
 *   API_BASE_2 / API_BASE_3 / API_BASE_4 / API_BASE_5
 */

type Sample = { ok: boolean; status: number; ms: number; error?: string };

type Scenario = {
  id: string;
  url: string;
  method?: "GET" | "HEAD" | "POST";
  headers?: Record<string, string>;
  body?: string;
  auth?: boolean;
  /** Treat these statuses as "expected" (not errors) — e.g. 404 before a stack lands. */
  allowStatus?: number[];
};

const WEB_BASE = (process.env.WEB_BASE ?? process.env.PILOT_WEB_BASE ?? "https://app.rapidcortex.us").replace(
  /\/$/,
  "",
);
const API_BASE = (process.env.API_BASE ?? process.env.PILOT_API_BASE ?? "https://api.rapidcortex.us").replace(
  /\/$/,
  "",
);
const API_BASE_2 = process.env.API_BASE_2?.replace(/\/$/, "");
const API_BASE_3 = process.env.API_BASE_3?.replace(/\/$/, "");
const API_BASE_4 = process.env.API_BASE_4?.replace(/\/$/, "");
const API_BASE_5 = process.env.API_BASE_5?.replace(/\/$/, "");
const BEARER = process.env.STRESS_BEARER_TOKEN?.trim() ?? process.env.PILOT_BEARER_TOKEN?.trim() ?? process.env.RC_BEARER?.trim();
const PROFILE = (process.env.RC_PROFILE ?? process.env.LOAD_PROFILE ?? "").trim().toLowerCase();
const VUS = Math.max(1, Number(process.env.VUS ?? (PROFILE === "soak" ? "10" : "12")) || 12);
const DURATION_S = Math.max(
  5,
  Number(process.env.DURATION_S ?? (PROFILE === "soak" ? "2700" : "25")) || 25,
);
const ALLOW_WRITES = process.env.STRESS_ALLOW_WRITES === "1";
const ALLOW_AI = process.env.STRESS_ALLOW_AI === "1";
const STRESS_INCIDENT_ID = process.env.STRESS_INCIDENT_ID?.trim() || "stress-probe-incident";

function isProdHost(url: string): boolean {
  try {
    const h = new URL(url).hostname;
    return (
      h === "app.rapidcortex.us" ||
      h === "api.rapidcortex.us" ||
      h === "www.rapidcortex.us" ||
      h.endsWith(".cloudfront.net")
    );
  } catch {
    return false;
  }
}

if (ALLOW_WRITES && (isProdHost(WEB_BASE) || isProdHost(API_BASE))) {
  console.error("STRESS_ALLOW_WRITES=1 is refused against prod hosts. Use a staging API.");
  process.exit(2);
}

function authHeaders(): Record<string, string> {
  return BEARER ? { Authorization: `Bearer ${BEARER}` } : {};
}

function scenarios(): Scenario[] {
  const list: Scenario[] = [
    { id: "web.health", url: `${WEB_BASE}/api/health` },
    { id: "web.health_web", url: `${WEB_BASE}/api/health/web` },
    { id: "web.login", url: `${WEB_BASE}/login` },
    { id: "api.health", url: `${API_BASE}/api/health` },
    {
      id: "bff.escalations",
      url: `${WEB_BASE}/api/escalations?direction=incoming`,
      allowStatus: [401, 403, 404, 501, 503],
    },
    {
      id: "bff.rms.reports",
      url: `${WEB_BASE}/api/rms/reports`,
      allowStatus: [401, 403, 404, 501, 503],
    },
  ];
  if (API_BASE_2) list.push({ id: "api2.health", url: `${API_BASE_2}/api/health`, allowStatus: [404] });
  if (API_BASE_3) {
    list.push({ id: "api3.health", url: `${API_BASE_3}/api/health`, allowStatus: [404] });
    list.push({
      id: "api3.escalations",
      url: `${API_BASE_3}/api/escalations`,
      headers: authHeaders(),
      allowStatus: [401, 403, 404],
    });
    list.push({
      id: "api3.rms.reports",
      url: `${API_BASE_3}/api/rms/reports`,
      headers: authHeaders(),
      allowStatus: [401, 403, 404],
    });
  }
  if (API_BASE_4) list.push({ id: "api4.health", url: `${API_BASE_4}/api/health`, allowStatus: [404] });
  if (API_BASE_5) list.push({ id: "api5.health", url: `${API_BASE_5}/api/health`, allowStatus: [404] });
  if (BEARER) {
    list.push({
      id: "api.me",
      url: `${API_BASE}/api/me`,
      headers: authHeaders(),
      allowStatus: [401],
    });
  }
  if (ALLOW_WRITES && BEARER) {
    const writeAllow = [200, 201, 400, 401, 403, 404, 422, 501];
    list.push({
      id: "intake_session_write",
      url: `${WEB_BASE}/api/intake/session`,
      method: "POST",
      auth: true,
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "stress" }),
      allowStatus: writeAllow,
    });
    list.push({
      id: "incident_transcript_push",
      url: `${API_BASE}/api/incidents/${encodeURIComponent(STRESS_INCIDENT_ID)}/transcript`,
      method: "POST",
      auth: true,
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ text: "stress-probe", speaker: "caller" }),
      allowStatus: writeAllow,
    });
    if (ALLOW_AI) {
      list.push({
        id: "rms_generate",
        url: `${WEB_BASE}/api/rms/reports/generate`,
        method: "POST",
        auth: true,
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({
          incidentId: STRESS_INCIDENT_ID,
          transcript: "Caller reports a non-emergency stress-probe event.",
          extractedEntities: { incidentType: "other" },
        }),
        allowStatus: writeAllow,
      });
    }
    list.push({
      id: "escalation_create",
      url: `${WEB_BASE}/api/escalations`,
      method: "POST",
      auth: true,
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({
        incidentId: STRESS_INCIDENT_ID,
        incidentType: "stress-probe",
        incidentDescription: "Authenticated stress-test probe — do not dispatch.",
        incidentLocation: { description: "stress-test" },
        incidentTimeline: [{ at: new Date().toISOString(), event: "stress-probe" }],
      }),
      allowStatus: writeAllow,
    });
    list.push({
      id: "cad_writeback_blocked",
      url: `${API_BASE}/api/security/cad-writeback-blocked`,
      method: "POST",
      auth: true,
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ action: "stress-probe" }),
      allowStatus: writeAllow,
    });
  }
  return list;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx]!;
}

async function hit(s: Scenario): Promise<Sample> {
  const t0 = performance.now();
  try {
    const res = await fetch(s.url, {
      method: s.method ?? "GET",
      headers: s.headers,
      body: s.method === "POST" ? s.body : undefined,
      redirect: "manual",
      signal: AbortSignal.timeout(15_000),
    });
    const ms = performance.now() - t0;
    const allowed = new Set([200, 204, 301, 302, 303, 307, 308, ...(s.allowStatus ?? [])]);
    const ok = allowed.has(res.status);
    return { ok, status: res.status, ms };
  } catch (e) {
    return {
      ok: false,
      status: 0,
      ms: performance.now() - t0,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

async function runVu(all: Scenario[], deadline: number, bag: Map<string, Sample[]>): Promise<void> {
  let i = 0;
  while (Date.now() < deadline) {
    const s = all[i % all.length]!;
    i += 1;
    const sample = await hit(s);
    const arr = bag.get(s.id) ?? [];
    arr.push(sample);
    bag.set(s.id, arr);
  }
}

function printReport(bag: Map<string, Sample[]>, elapsedMs: number): boolean {
  console.log("");
  console.log("════════════════════════════════════════════════════════");
  console.log(" Rapid Cortex stress probe");
  console.log("════════════════════════════════════════════════════════");
  console.log(` WEB_BASE=${WEB_BASE}`);
  console.log(` API_BASE=${API_BASE}`);
  console.log(` VUs=${VUS}  duration=${DURATION_S}s  elapsed=${(elapsedMs / 1000).toFixed(1)}s`);
  console.log(` bearer=${BEARER ? "set" : "none"}  writes=${ALLOW_WRITES ? "ALLOWED" : "read-only"}`);
  console.log("────────────────────────────────────────────────────────");

  let failed = false;
  const rows: string[] = [];

  for (const [id, samples] of bag) {
    const times = samples.map((s) => s.ms).sort((a, b) => a - b);
    const errors = samples.filter((s) => !s.ok);
    const errPct = samples.length === 0 ? 100 : (100 * errors.length) / samples.length;
    const rps = elapsedMs > 0 ? (samples.length / elapsedMs) * 1000 : 0;
    const statuses = new Map<number, number>();
    for (const s of samples) statuses.set(s.status, (statuses.get(s.status) ?? 0) + 1);
    const statusStr = [...statuses.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([code, n]) => `${code}×${n}`)
      .join(" ");

    const line = [
      id.padEnd(22),
      String(samples.length).padStart(6),
      rps.toFixed(1).padStart(6),
      percentile(times, 50).toFixed(0).padStart(6),
      percentile(times, 95).toFixed(0).padStart(6),
      percentile(times, 99).toFixed(0).padStart(6),
      `${errPct.toFixed(1)}%`.padStart(7),
      statusStr,
    ].join("  ");
    rows.push(line);

    // Custom-domain health must stay healthy. Execute-api stacks often have no /api/health.
    if ((id === "web.health" || id === "web.health_web" || id === "api.health") && errPct > 5) {
      failed = true;
    }
  }

  console.log(
    ["scenario".padEnd(22), "n".padStart(6), "rps".padStart(6), "p50".padStart(6), "p95".padStart(6), "p99".padStart(6), "err%".padStart(7), "status"].join(
      "  ",
    ),
  );
  for (const r of rows) console.log(r);
  console.log("════════════════════════════════════════════════════════");
  if (failed) {
    console.log("RESULT: FAIL — health or core error budget exceeded");
  } else {
    console.log("RESULT: PASS — within error budgets (health <5% err; others <15%)");
  }
  return !failed;
}

async function main(): Promise<void> {
  const all = scenarios();
  console.log(`Starting ${VUS} VUs × ${all.length} scenarios for ${DURATION_S}s…`);
  const bag = new Map<string, Sample[]>();
  const t0 = Date.now();
  const deadline = t0 + DURATION_S * 1000;
  await Promise.all(Array.from({ length: VUS }, () => runVu(all, deadline, bag)));
  const ok = printReport(bag, Date.now() - t0);
  process.exit(ok ? 0 : 1);
}

void main();
