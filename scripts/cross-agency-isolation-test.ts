#!/usr/bin/env npx tsx
/**
 * Rapid Cortex — Cross-Agency Tenant Isolation Test Suite (P0 Go/No-Go gate)
 *
 * Probes cross-tenant read/write paths using two agency JWTs. Routes match the
 * split HttpApi stacks (1–4) deployed behind api.rapidcortex.us + execute-api bases.
 *
 * Required env:
 *   API_URL          Stack 1 (incidents, agencies, /api/me, admin users)
 *   AGENCY_A_JWT     Agency A bearer token
 *   AGENCY_B_JWT     Agency B bearer token
 *   AGENCY_A_ID      e.g. test-agency
 *   AGENCY_B_ID      e.g. test-campus-uga
 *
 * Optional:
 *   API_URL_2        Stack 2 (audit, QA scorecards, media)
 *   API_URL_3        Stack 3 (platform summary)
 *   API_URL_4        Stack 4 (billing, Ring)
 *   AGENCY_A_ADMIN_JWT  Admin token for Agency A (incident seed)
 *   VERBOSE=1
 */
import { randomUUID } from "node:crypto";

const API1 = (process.env.API_URL ?? "").trim().replace(/\/$/, "");
const API2 = (process.env.API_URL_2 ?? API1).trim().replace(/\/$/, "");
const API3 = (process.env.API_URL_3 ?? API1).trim().replace(/\/$/, "");
const API4 = (process.env.API_URL_4 ?? API1).trim().replace(/\/$/, "");
const JWT_A = process.env.AGENCY_A_JWT?.trim() ?? "";
const JWT_B = process.env.AGENCY_B_JWT?.trim() ?? "";
const ADMIN_A = process.env.AGENCY_A_ADMIN_JWT?.trim() ?? "";
const AID_A = process.env.AGENCY_A_ID?.trim() ?? "test-agency";
const AID_B = process.env.AGENCY_B_ID?.trim() ?? "test-campus-uga";
const VERBOSE = process.env.VERBOSE === "1";

if (!API1 || !JWT_A || !JWT_B) {
  console.error("Missing required env: API_URL, AGENCY_A_JWT, AGENCY_B_JWT");
  process.exit(1);
}

type Verdict = "PASS" | "FAIL" | "WARN" | "SKIP";
const results: { name: string; verdict: Verdict; detail?: string }[] = [];

function record(name: string, verdict: Verdict, detail?: string) {
  results.push({ name, verdict, detail });
  const icon = verdict === "PASS" ? "✅" : verdict === "FAIL" ? "❌" : verdict === "WARN" ? "⚠️ " : "⏭ ";
  console.log(`${icon} ${verdict.padEnd(4)} — ${name}${detail ? `\n       ${detail}` : ""}`);
}

function baseForPath(path: string): string {
  if (path.startsWith("/api/audit/") || path.startsWith("/api/qa/")) return API2;
  if (path.startsWith("/api/platform/")) return API3;
  if (
    path.startsWith("/api/integrations/ring/") ||
    path.includes("/billing") ||
    path.startsWith("/api/admin/tenants/")
  ) {
    return API4;
  }
  if (path.includes("/media") && path.includes("/incidents/")) return API2;
  return API1;
}

async function req(
  method: string,
  path: string,
  jwt: string,
  body?: unknown,
): Promise<{ status: number; body: unknown }> {
  const base = baseForPath(path);
  const headers: Record<string, string> = {
    Authorization: `Bearer ${jwt}`,
    "Content-Type": "application/json",
  };
  const r = await fetch(`${base}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  let parsed: unknown;
  try {
    parsed = await r.json();
  } catch {
    parsed = null;
  }
  if (VERBOSE) console.log(`     ${method} ${base}${path} → ${r.status}`, parsed);
  return { status: r.status, body: parsed };
}

const get = (path: string, jwt: string) => req("GET", path, jwt);
const post = (path: string, jwt: string, body: unknown) => req("POST", path, jwt, body);
const put = (path: string, jwt: string, body: unknown) => req("PUT", path, jwt, body);
const patch = (path: string, jwt: string, body: unknown) => req("PATCH", path, jwt, body);

function isBlocked(status: number): boolean {
  return status === 401 || status === 403 || status === 404;
}

function unwrapItems(body: unknown): unknown[] {
  if (!body || typeof body !== "object") return [];
  const b = body as Record<string, unknown>;
  const items = b.items ?? b.incidents ?? b.data;
  return Array.isArray(items) ? items : [];
}

function agencyIdFromMe(body: unknown): string | undefined {
  if (!body || typeof body !== "object") return undefined;
  const b = body as Record<string, unknown>;
  if (typeof b.agencyId === "string") return b.agencyId;
  const user = b.user as Record<string, unknown> | undefined;
  return typeof user?.agencyId === "string" ? user.agencyId : undefined;
}

function incidentIdFrom(row: unknown): string | undefined {
  if (!row || typeof row !== "object") return undefined;
  const r = row as Record<string, unknown>;
  return (r.incidentId as string) ?? (r.id as string);
}

let incidentA: string | null = null;

async function seed() {
  console.log("\n── Seeding Agency A test data ──");
  const jwt = ADMIN_A || JWT_A;
  const title = `Isolation test ${randomUUID().slice(0, 8)}`;
  for (const token of [jwt, JWT_A]) {
    const ir = await post("/api/incidents", token, { title, source: "manual" });
    if (ir.status === 200 || ir.status === 201) {
      incidentA =
        incidentIdFrom(ir.body) ??
        incidentIdFrom((ir.body as Record<string, unknown>)?.data);
      console.log(`   Created incident: ${incidentA ?? "(unknown id)"}`);
      return;
    }
  }
  console.log(`   Incident create failed — listing existing`);
  const list = await get("/api/incidents", jwt);
  const items = unwrapItems(list.body);
  if (items.length > 0) {
    incidentA = incidentIdFrom(items[0]) ?? null;
    console.log(`   Using existing incident: ${incidentA}`);
  }
}

async function testMeEndpoint() {
  console.log("\n── 13. /api/me — agencyId claim integrity ──");
  const ra = await get("/api/me", JWT_A);
  const agA = agencyIdFromMe(ra.body);
  record(
    "/api/me returns Agency A agencyId for Agency A token",
    agA === AID_A ? "PASS" : "FAIL",
    agA !== AID_A ? `Got: ${agA}, expected: ${AID_A}` : undefined,
  );

  const rb = await get("/api/me", JWT_B);
  const agB = agencyIdFromMe(rb.body);
  record(
    "/api/me returns Agency B agencyId for Agency B token",
    agB === AID_B ? "PASS" : "FAIL",
    agB !== AID_B ? `Got: ${agB}, expected: ${AID_B}` : undefined,
  );

  record(
    "/api/me Agency A response does not expose Agency B agencyId",
    JSON.stringify(ra.body).includes(AID_B) ? "FAIL" : "PASS",
  );
  record(
    "/api/me Agency B response does not expose Agency A agencyId",
    JSON.stringify(rb.body).includes(AID_A) ? "FAIL" : "PASS",
  );
}

async function testUnauthenticated() {
  console.log("\n── 1. Unauthenticated access (no JWT) ──");
  const paths = [
    "/api/incidents",
    `/api/agencies/${AID_A}`,
    incidentA ? `/api/incidents/${incidentA}` : "/api/incidents/nonexistent-id",
    "/api/me",
    "/api/audit/events",
  ];
  for (const path of paths) {
    const base = baseForPath(path);
    const r = await fetch(`${base}${path}`, { cache: "no-store" });
    const blocked = r.status === 401 || r.status === 403;
    record(
      `Anonymous blocked: ${path}`,
      blocked ? "PASS" : "FAIL",
      blocked ? undefined : `Returned ${r.status} — should be 401/403`,
    );
  }
}

async function testIncidentList() {
  console.log("\n── 2. Incident list — cross-agency bleed ──");
  const r1 = await get(`/api/incidents?agencyId=${encodeURIComponent(AID_A)}`, JWT_B);
  const items1 = unwrapItems(r1.body);
  const contaminated1 = items1.some(
    (i) => (i as Record<string, unknown>).agencyId === AID_A,
  );
  record(
    "Agency B cannot list Agency A incidents via ?agencyId param",
    isBlocked(r1.status) || !contaminated1 ? "PASS" : "FAIL",
    contaminated1 ? `Found ${items1.length} items with Agency A agencyId` : undefined,
  );

  const r2 = await get("/api/incidents", JWT_B);
  const items2 = unwrapItems(r2.body);
  if (items2.length > 0) {
    const contaminated = items2.some(
      (i) => (i as Record<string, unknown>).agencyId === AID_A,
    );
    record(
      "Agency B own incident list contains no Agency A entries",
      contaminated ? "FAIL" : "PASS",
      contaminated ? "Found Agency A agencyId in list results" : undefined,
    );
  } else {
    record("Agency B own incident list — no PSAP incidents (expected for campus)", "PASS");
  }
}

async function testIncidentRead() {
  console.log("\n── 3. Incident read — direct ID access ──");
  if (!incidentA) {
    record("Cross-agency incident read", "SKIP", "No Agency A incident ID available");
    return;
  }
  const r = await get(`/api/incidents/${incidentA}`, JWT_B);
  record(
    `Agency B cannot read Agency A incident ${incidentA}`,
    isBlocked(r.status) ? "PASS" : "FAIL",
    isBlocked(r.status) ? undefined : `Got ${r.status}`,
  );

  const rt = await get(`/api/incidents/${incidentA}/transcript`, JWT_B);
  record(
    "Agency B cannot read Agency A incident transcript",
    isBlocked(rt.status) ? "PASS" : "FAIL",
    isBlocked(rt.status) ? undefined : `Got ${rt.status}`,
  );

  const ra = await get(`/api/incidents/${incidentA}/analysis`, JWT_B);
  record(
    "Agency B cannot read Agency A incident analysis",
    isBlocked(ra.status) ? "PASS" : "FAIL",
    isBlocked(ra.status) ? undefined : `Got ${ra.status}`,
  );

  const rm = await get(`/api/incidents/${incidentA}/media`, JWT_B);
  record(
    "Agency B cannot read Agency A incident media list",
    isBlocked(rm.status) ? "PASS" : "FAIL",
    isBlocked(rm.status) ? undefined : `Got ${rm.status}`,
  );
}

async function testIncidentMutate() {
  console.log("\n── 4. Incident mutation — cross-agency write ──");
  if (!incidentA) {
    record("Cross-agency incident mutation", "SKIP", "No Agency A incident ID available");
    return;
  }
  const ru = await patch(`/api/incidents/${incidentA}`, JWT_B, { action: "mark_reviewed" });
  record(
    "Agency B cannot update Agency A incident",
    isBlocked(ru.status) ? "PASS" : "FAIL",
    isBlocked(ru.status) ? undefined : `Got ${ru.status}`,
  );

  const rtr = await post(`/api/incidents/${incidentA}/transcript`, JWT_B, {
    text: "Injected from Agency B",
    speakerLabel: "ATTACKER",
  });
  record(
    "Agency B cannot write transcript to Agency A incident",
    isBlocked(rtr.status) ? "PASS" : "FAIL",
    isBlocked(rtr.status) ? undefined : `Got ${rtr.status}`,
  );
}

async function testAgencyProfileAndInvites() {
  console.log("\n── 6. Agency profile, invites — cross-agency access ──");

  const rp = await get(`/api/agencies/${AID_A}/profile`, JWT_B);
  record(
    "Agency B cannot read Agency A profile",
    isBlocked(rp.status) ? "PASS" : "FAIL",
    isBlocked(rp.status) ? undefined : `Got ${rp.status}`,
  );

  const ra = await get(`/api/agencies/${AID_A}`, JWT_B);
  record(
    "Agency B cannot read Agency A tenant record",
    isBlocked(ra.status) ? "PASS" : "FAIL",
    isBlocked(ra.status) ? undefined : `Got ${ra.status}`,
  );

  const ri = await post(`/api/agencies/${AID_A}/invites`, JWT_B, {
    email: `attacker-${Date.now()}@malicious.example`,
    role: "dispatcher",
  });
  record(
    "Agency B cannot invite user into Agency A",
    isBlocked(ri.status) ? "PASS" : "FAIL",
    isBlocked(ri.status) ? undefined : `Got ${ri.status}`,
  );

  const adminUsers = await get("/api/admin/users", JWT_B);
  record(
    "Agency B cannot list Cognito users via /api/admin/users",
    isBlocked(adminUsers.status) ? "PASS" : "FAIL",
    isBlocked(adminUsers.status) ? undefined : `Got ${adminUsers.status}`,
  );
}

async function testAuditLog() {
  console.log("\n── 7. Audit log — cross-agency read ──");
  const r1 = await get("/api/audit/events", JWT_B);
  if (r1.status === 200) {
    const items = unwrapItems(r1.body);
    const leaks = items.some((e) => (e as Record<string, unknown>).agencyId === AID_A);
    record(
      "Agency B audit list does not contain Agency A events",
      leaks ? "FAIL" : "PASS",
      leaks ? "Agency A agencyId found in Agency B audit results" : undefined,
    );
  } else {
    record(
      "Agency B blocked or scoped from audit events",
      isBlocked(r1.status) ? "PASS" : "WARN",
      `Status ${r1.status}`,
    );
  }

  const r2 = await get(`/api/audit/events?agencyId=${encodeURIComponent(AID_A)}`, JWT_B);
  if (r2.status === 200) {
    const items = unwrapItems(r2.body);
    const leaks = items.some((e) => (e as Record<string, unknown>).agencyId === AID_A);
    record(
      "Agency B audit with ?agencyId injection does not expose Agency A",
      leaks ? "FAIL" : "PASS",
    );
  } else {
    record("Agency B audit ?agencyId injection blocked", isBlocked(r2.status) ? "PASS" : "WARN");
  }
}

async function testQACoaching() {
  console.log("\n── 8. QA & Coaching — cross-agency access ──");
  for (const path of ["/api/qa/scorecards", "/api/qa/coaching-notes", "/api/qa/trends"]) {
    const r = await get(path, JWT_B);
    if (r.status === 200) {
      const items = unwrapItems(r.body);
      const leaks = items.some((e) => (e as Record<string, unknown>).agencyId === AID_A);
      record(`${path} — no Agency A data`, leaks ? "FAIL" : "PASS");
    } else {
      record(`Agency B blocked from ${path}`, isBlocked(r.status) ? "PASS" : "WARN", `Status ${r.status}`);
    }
  }
}

async function testAgencyIdInjection() {
  console.log("\n── 9. agencyId spoofing on create (server must use JWT) ──");
  const r = await post("/api/incidents", JWT_B, {
    title: "Injection test incident",
    source: "manual",
    agencyId: AID_A,
  } as Record<string, unknown>);
  if (r.status === 200 || r.status === 201) {
    const createdAgency = (r.body as Record<string, unknown>)?.agencyId;
    record(
      "agencyId body injection neutralised — server used JWT claim",
      createdAgency === AID_B ? "PASS" : "FAIL",
      createdAgency !== AID_B ? `agencyId=${createdAgency}` : undefined,
    );
  } else {
    record("agencyId body injection request rejected", isBlocked(r.status) ? "PASS" : "WARN");
  }
}

async function testMediaAndRing() {
  console.log("\n── 10. Ring / billing — cross-agency access ──");
  const ring = await get(`/api/integrations/ring/devices?agencyId=${encodeURIComponent(AID_A)}`, JWT_B);
  if (ring.status === 200) {
    const body = ring.body as Record<string, unknown>;
    const data = (body.data ?? body) as Record<string, unknown>;
    const devices = (data.devices ?? []) as Array<Record<string, unknown>>;
    const foreign = devices.filter((d) => d.agencyId === AID_A);
    record(
      "Ring devices ignores agencyId param — no Agency A device rows returned",
      foreign.length === 0 ? "PASS" : "FAIL",
      foreign.length > 0 ? `${foreign.length} device(s) leaked with Agency A agencyId` : undefined,
    );
  } else {
    record(
      "Agency B blocked from Ring devices",
      isBlocked(ring.status) ? "PASS" : "FAIL",
      `Status ${ring.status}`,
    );
  }

  const billing = await get(`/api/agencies/${AID_A}/billing-profile`, JWT_B);
  record(
    "Agency B blocked from Agency A billing-profile",
    isBlocked(billing.status) ? "PASS" : "FAIL",
    isBlocked(billing.status) ? undefined : `Got ${billing.status}`,
  );
}

async function testPlatformRouteBlocking() {
  console.log("\n── 11. Platform / admin routes blocked from agency JWT ──");
  const paths = [
    "/api/platform/summary",
    "/api/agencies",
    `/api/admin/tenants/${AID_A}/addons`,
  ];
  for (const path of paths) {
    const r = await get(path, JWT_A);
    record(
      `Agency A dispatcher blocked from ${path}`,
      isBlocked(r.status) ? "PASS" : "FAIL",
      isBlocked(r.status) ? undefined : `Got ${r.status} — platform route leaked`,
    );
  }
}

async function main() {
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  Rapid Cortex — Cross-Agency Tenant Isolation Test Suite");
  console.log(`  API stack 1: ${API1}`);
  console.log(`  API stack 2: ${API2}`);
  console.log(`  API stack 3: ${API3}`);
  console.log(`  API stack 4: ${API4}`);
  console.log(`  Agency A: ${AID_A}`);
  console.log(`  Agency B: ${AID_B}`);
  console.log("═══════════════════════════════════════════════════════════════");

  await seed();
  await testMeEndpoint();
  await testUnauthenticated();
  await testIncidentList();
  await testIncidentRead();
  await testIncidentMutate();
  await testAgencyProfileAndInvites();
  await testAuditLog();
  await testQACoaching();
  await testAgencyIdInjection();
  await testMediaAndRing();
  await testPlatformRouteBlocking();

  const pass = results.filter((r) => r.verdict === "PASS").length;
  const fail = results.filter((r) => r.verdict === "FAIL").length;
  const warn = results.filter((r) => r.verdict === "WARN").length;
  const skip = results.filter((r) => r.verdict === "SKIP").length;

  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log("  RESULTS");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log(`  Total: ${results.length}  ✅ PASS: ${pass}  ❌ FAIL: ${fail}  ⚠️  WARN: ${warn}  ⏭  SKIP: ${skip}`);

  if (fail > 0) {
    console.log("\n  ❌ FAILING TESTS:");
    for (const r of results.filter((x) => x.verdict === "FAIL")) {
      console.log(`     • ${r.name}${r.detail ? `\n       ${r.detail}` : ""}`);
    }
    console.log("\n  ⛔ TENANT ISOLATION P0 GATE: FAILED");
  } else if (warn > 0) {
    console.log("\n  ⚠️  WARNINGS:");
    for (const r of results.filter((x) => x.verdict === "WARN")) {
      console.log(`     • ${r.name}${r.detail ? `: ${r.detail}` : ""}`);
    }
    console.log("\n  ⚠️  TENANT ISOLATION P0 GATE: CONDITIONAL PASS");
  } else {
    console.log("\n  ✅ TENANT ISOLATION P0 GATE: PASSED");
    console.log("     Attach this output as evidence for the Go/No-Go checklist.");
  }
  console.log("═══════════════════════════════════════════════════════════════");
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error("Test runner fatal error:", e);
  process.exit(1);
});
