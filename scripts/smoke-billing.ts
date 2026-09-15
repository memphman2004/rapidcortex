#!/usr/bin/env npx tsx
/**
 * Smoke test for automated billing API routes.
 * Usage:
 *   API_BASE=https://api4.example.com \
 *   RC_ADMIN_TOKEN=<jwt> \
 *   AGENCY_TOKEN=<agency-jwt> \
 *   npx tsx scripts/smoke-billing.ts
 */

const API = (process.env.API_BASE ?? "").replace(/\/$/, "");
const ADMIN_TOKEN = process.env.RC_ADMIN_TOKEN ?? "";
const AGENCY_TOKEN = process.env.AGENCY_TOKEN ?? "";

type Result = { id: string; pass: boolean; detail?: string };
const results: Result[] = [];

function check(id: string, pass: boolean, detail?: string): void {
  results.push({ id, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"} — ${id}${detail ? ` (${detail})` : ""}`);
}

async function run(): Promise<void> {
  if (!API) {
    console.error("API_BASE not set");
    process.exit(1);
  }

  const unauth = await fetch(`${API}/api/billing/automated-invoices`);
  check("admin-unauth-401-or-403", unauth.status === 401 || unauth.status === 403, String(unauth.status));

  if (!ADMIN_TOKEN) {
    console.log("SKIP — remaining checks (RC_ADMIN_TOKEN not set)");
  } else {
    const listRes = await fetch(`${API}/api/billing/automated-invoices`, {
      headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
    });
    const list = (await listRes.json()) as { invoices?: unknown };
    check("admin-list-200", listRes.status === 200, String(listRes.status));
    check("admin-list-has-array", Array.isArray(list?.invoices));

    const filtRes = await fetch(`${API}/api/billing/automated-invoices?status=sent&limit=5`, {
      headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
    });
    check("admin-filter-status-200", filtRes.status === 200, String(filtRes.status));

    const previewRes = await fetch(`${API}/api/billing/automated-invoices/preview`, {
      method: "POST",
      headers: { Authorization: `Bearer ${ADMIN_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        agencyId: "test-agency",
        billingPeriod: new Date().toISOString().slice(0, 7),
      }),
    });
    const preview = (await previewRes.json()) as { invoice?: { totalCents?: number } };
    check("admin-preview-200-or-404", previewRes.status === 200 || previewRes.status === 404, String(previewRes.status));
    if (previewRes.status === 200) {
      check("preview-has-invoice", !!preview?.invoice);
      check("preview-has-totalCents", typeof preview?.invoice?.totalCents === "number");
    }

    const patchRes = await fetch(`${API}/api/billing/automated-invoices/INV-NOTEXIST-0000`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${ADMIN_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ status: "paid" }),
    });
    check("patch-not-found-404", patchRes.status === 404 || patchRes.status === 422, String(patchRes.status));
  }

  if (AGENCY_TOKEN) {
    const agencyList = await fetch(`${API}/api/billing/automated-invoices`, {
      headers: { Authorization: `Bearer ${AGENCY_TOKEN}` },
    });
    check("agency-list-200-or-403", agencyList.status === 200 || agencyList.status === 403, String(agencyList.status));

    const previewAsAgency = await fetch(`${API}/api/billing/automated-invoices/preview`, {
      method: "POST",
      headers: { Authorization: `Bearer ${AGENCY_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ agencyId: "other-agency", billingPeriod: "2026-09" }),
    });
    check("agency-blocked-preview", previewAsAgency.status === 403, String(previewAsAgency.status));
  } else {
    console.log("SKIP — agency-list (AGENCY_TOKEN not set)");
  }

  const passed = results.filter((r) => r.pass).length;
  console.log(`\n${passed}/${results.length} checks passed`);
  if (passed < results.length) process.exit(1);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
