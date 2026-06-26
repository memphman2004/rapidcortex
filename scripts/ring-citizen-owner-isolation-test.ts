#!/usr/bin/env npx tsx
/**
 * Ring citizen owner isolation — verifies RINGOWNER records cannot authenticate as agency JWTs.
 *
 * Runtime checks (no Cognito session required for public oauth start):
 * - Protected agency routes return 401 without Authorization
 * - Protected agency routes return 401 with a garbage bearer shaped like a ringAccountId
 * - Public oauth start is reachable without JWT (302/403/404/429 — not 401)
 *
 * Code-review assertion (not runtime-testable):
 * - `isRingAuthorizedRole()` in `apps/api/src/integrations/ring/ring-auth.ts` must never
 *   receive claims derived from `RingCitizenOwnerRepository` / RINGOWNER# rows. Citizen
 *   linking uses `public-oauth-start.ts` / `public-callback.ts` only — no Cognito groups,
 *   no `getUserContext()`, no `RingAccountRepository.upsertLinkedAccount`.
 *
 * Required env:
 *   API_URL     Stack 1 / BFF base for JWT-protected route probes (default: api.rapidcortex.us)
 *   API_URL_4   Stack 4 base for public ring oauth start (Ring routes)
 *   AGENCY_A_ID Existing agency id for oauth start probe (e.g. test-agency)
 *
 * Optional:
 *   VERBOSE=1
 */
const API1 = (process.env.API_URL ?? process.env.API_UPSTREAM_BASE ?? "https://api.rapidcortex.us")
  .trim()
  .replace(/\/$/, "");
const API4 = (process.env.API_URL_4 ?? process.env.API_UPSTREAM_BASE_4 ?? "").trim().replace(/\/$/, "");
const AGENCY_ID = process.env.AGENCY_A_ID?.trim() ?? "test-agency";
const VERBOSE = process.env.VERBOSE === "1";

if (!API4) {
  console.error("Missing required env: API_URL_4 (or API_UPSTREAM_BASE_4)");
  process.exit(1);
}

type Verdict = "PASS" | "FAIL" | "SKIP";
const results: { name: string; verdict: Verdict; detail?: string }[] = [];

function record(name: string, verdict: Verdict, detail?: string) {
  results.push({ name, verdict, detail });
  const icon = verdict === "PASS" ? "✅" : verdict === "FAIL" ? "❌" : "⏭ ";
  console.log(`${icon} ${verdict.padEnd(4)} — ${name}${detail ? `\n       ${detail}` : ""}`);
}

async function fetchStatus(
  base: string,
  path: string,
  init?: RequestInit,
): Promise<{ status: number; location?: string }> {
  const r = await fetch(`${base}${path}`, { ...init, cache: "no-store", redirect: "manual" });
  const location = r.headers.get("location") ?? undefined;
  if (VERBOSE) console.log(`     ${init?.method ?? "GET"} ${base}${path} → ${r.status}`, location ?? "");
  return { status: r.status, location };
}

const FAKE_RING_BEARER = "ring:test-agency:citizen:deadbeefdeadbeefdeadbeefdeadbeef";

async function main() {
  console.log("Ring citizen owner isolation\n");
  console.log(`Protected routes → ${API1}`);
  console.log(`Public ring oauth → ${API4}\n`);

  const meNoAuth = await fetchStatus(API1, "/api/me");
  record(
    "GET /api/me without Authorization → 401",
    meNoAuth.status === 401 ? "PASS" : "FAIL",
    `status=${meNoAuth.status}`,
  );

  const meFakeRing = await fetchStatus(API1, "/api/me", {
    headers: { Authorization: `Bearer ${FAKE_RING_BEARER}` },
  });
  record(
    "GET /api/me with ringAccountId-shaped bearer → 401",
    meFakeRing.status === 401 ? "PASS" : "FAIL",
    `status=${meFakeRing.status}`,
  );

  const incidentsNoAuth = await fetchStatus(API1, "/api/incidents");
  record(
    "GET /api/incidents without Authorization → 401",
    incidentsNoAuth.status === 401 ? "PASS" : "FAIL",
    `status=${incidentsNoAuth.status}`,
  );

  const usersNoAuth = await fetchStatus(
    API1,
    `/api/agencies/${encodeURIComponent(AGENCY_ID)}/users`,
  );
  record(
    "GET /api/agencies/{agencyId}/users without Authorization → 401/403/404",
    usersNoAuth.status === 401 || usersNoAuth.status === 403 || usersNoAuth.status === 404
      ? "PASS"
      : "FAIL",
    `status=${usersNoAuth.status}`,
  );

  const oauthStart = await fetchStatus(
    API4,
    `/api/public/ring/oauth/start?agencyId=${encodeURIComponent(AGENCY_ID)}`,
  );
  const oauthOk =
    oauthStart.status === 302 ||
    oauthStart.status === 403 ||
    oauthStart.status === 404 ||
    oauthStart.status === 429 ||
    oauthStart.status === 503;
  record(
    "GET /api/public/ring/oauth/start (no JWT) not 401",
    oauthOk && oauthStart.status !== 401 ? "PASS" : "FAIL",
    `status=${oauthStart.status}${oauthStart.location ? ` location=${oauthStart.location.slice(0, 80)}` : ""}`,
  );

  const fails = results.filter((r) => r.verdict === "FAIL").length;
  console.log(`\n${results.length - fails}/${results.length} passed`);
  if (fails > 0) process.exit(1);
}

void main();
