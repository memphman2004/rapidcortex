/**
 * Smoke test for the RC Support Form API routes.
 * Usage:
 *   API_BASE=https://api-staging.rapidcortex.us \
 *   AGENCY_TOKEN=<jwt> \
 *   RC_ADMIN_TOKEN=<jwt> \
 *   npx tsx scripts/smoke-support-form.ts
 */

const API = (process.env.API_BASE ?? process.env.API_UPSTREAM_BASE_5 ?? "").replace(/\/$/, "");
const AGENCY_TOKEN = process.env.AGENCY_TOKEN ?? "";
const ADMIN_TOKEN = process.env.RC_ADMIN_TOKEN ?? "";

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

  const unauth = await fetch(`${API}/api/support/tickets`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      category: "technical",
      severity: "SEV4",
      subject: "Test",
      description: "Test",
    }),
  });
  check("submit-unauth-401", unauth.status === 401 || unauth.status === 403, `status=${unauth.status}`);

  if (AGENCY_TOKEN) {
    const sev1Res = await fetch(`${API}/api/support/tickets`, {
      method: "POST",
      headers: { Authorization: `Bearer ${AGENCY_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        category: "technical",
        severity: "SEV1",
        subject: "Outage",
        description: "Down",
      }),
    });
    check("submit-sev1-422", sev1Res.status === 422, `status=${sev1Res.status}`);

    const submitRes = await fetch(`${API}/api/support/tickets`, {
      method: "POST",
      headers: { Authorization: `Bearer ${AGENCY_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        category: "bug_report",
        severity: "SEV4",
        subject: "Smoke test ticket",
        description: "This is an automated smoke test. Please disregard.",
        currentPageUrl: "https://app.rapidcortex.us/smoke-test",
      }),
    });
    const submitted = (await submitRes.json()) as { ticketId?: string; slaExpectation?: string };
    check("submit-201", submitRes.status === 201, `status=${submitRes.status}`);
    check("submit-has-ticketId", Boolean(submitted?.ticketId));
    check("submit-has-sla", Boolean(submitted?.slaExpectation));

    if (ADMIN_TOKEN) {
      const boardRes = await fetch(`${API}/api/rc-internal/support-tickets/board`, {
        headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
      });
      const board = (await boardRes.json()) as { data?: { columns?: unknown; metrics?: unknown } };
      check("board-200", boardRes.status === 200, `status=${boardRes.status}`);
      check("board-has-columns", Boolean(board?.data?.columns));
      check("board-has-metrics", Boolean(board?.data?.metrics));
    }
  } else {
    console.log("AGENCY_TOKEN not set — skipped authenticated submit checks");
  }

  const failed = results.filter((r) => !r.pass);
  if (failed.length) {
    console.error(`FAILED ${failed.length}/${results.length}`);
    process.exit(1);
  }
  console.log(`OK ${results.length}/${results.length}`);
}

void run().catch((err) => {
  console.error(err);
  process.exit(1);
});
