/**
 * Smoke test for AI Feature Gate.
 * Run: npx tsx scripts/smoke-ai-gate.ts
 * Requires: AGENCY_ID, TEST_SUPERVISOR_TOKEN, API_BASE_URL
 * Optional: TEST_DISPATCHER_TOKEN (403 check)
 */

const BASE = process.env.API_BASE_URL!;
const AGENCY = process.env.AGENCY_ID!;
const TOKEN = process.env.TEST_SUPERVISOR_TOKEN!;
const HEADERS = {
  Authorization: `Bearer ${TOKEN}`,
  "Content-Type": "application/json",
};

async function run() {
  if (!BASE || !AGENCY || !TOKEN) {
    throw new Error("Set API_BASE_URL, AGENCY_ID, TEST_SUPERVISOR_TOKEN");
  }

  console.log("→ GET current config");
  const get1 = await fetch(`${BASE}/api/agency/${AGENCY}/config/ai-mode`, { headers: HEADERS });
  console.log("  Status:", get1.status, await get1.json());

  console.log("→ PUT disable all AI");
  const disable = await fetch(`${BASE}/api/agency/${AGENCY}/config/ai-mode`, {
    method: "PUT",
    headers: HEADERS,
    body: JSON.stringify({ enabled: false, reason: "Smoke test — manual mode" }),
  });
  console.log("  Status:", disable.status, await disable.json());

  console.log("→ GET config — expect aiEnabled=false");
  const get2 = await fetch(`${BASE}/api/agency/${AGENCY}/config/ai-mode`, { headers: HEADERS });
  const cfg2 = (await get2.json()) as {
    aiEnabled: boolean;
    features: Record<string, boolean>;
  };
  if (cfg2.aiEnabled !== false) throw new Error("FAIL: aiEnabled should be false");
  if (!Object.values(cfg2.features).every((v) => v === false)) {
    throw new Error("FAIL: all features should be false");
  }
  console.log("  PASS");

  console.log("→ PUT re-enable AI");
  const enable = await fetch(`${BASE}/api/agency/${AGENCY}/config/ai-mode`, {
    method: "PUT",
    headers: HEADERS,
    body: JSON.stringify({ enabled: true, reason: "Smoke test — restore AI" }),
  });
  console.log("  Status:", enable.status, await enable.json());

  console.log("→ GET audit history");
  const audit = await fetch(`${BASE}/api/agency/${AGENCY}/config/ai-mode/audit`, {
    headers: HEADERS,
  });
  const auditData = (await audit.json()) as { history: unknown[] };
  if (!Array.isArray(auditData.history) || auditData.history.length < 2) {
    throw new Error("FAIL: should have at least 2 audit records");
  }
  console.log("  PASS: audit records =", auditData.history.length);

  const dispatcherToken = process.env.TEST_DISPATCHER_TOKEN;
  if (dispatcherToken) {
    console.log("→ PUT dispatcher attempt — expect 403");
    const forbidden = await fetch(`${BASE}/api/agency/${AGENCY}/config/ai-mode`, {
      method: "PUT",
      headers: { ...HEADERS, Authorization: `Bearer ${dispatcherToken}` },
      body: JSON.stringify({ enabled: false }),
    });
    if (forbidden.status !== 403) {
      throw new Error(`FAIL: expected 403, got ${forbidden.status}`);
    }
    console.log("  PASS: 403 as expected");
  } else {
    console.log("→ SKIP dispatcher 403 (TEST_DISPATCHER_TOKEN unset)");
  }

  console.log("\n✓ All AI gate smoke tests passed");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
