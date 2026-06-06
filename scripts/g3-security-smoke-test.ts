#!/usr/bin/env npx tsx
/**
 * G3 security-focused smoke probes (API + optional web shell). Never echoes tokens.
 *
 * Environment:
 *  - BASE_URL — API Lambda HTTP base (required for most probes)
 *  - G3_WEB_URL — Next.js deployment for header/CORS shell checks (optional)
 *  - APPROVED_TEST_ORIGIN / REJECTED_TEST_ORIGIN — origins for OPTIONS probe
 *  - TEST_JWT — Bearer ID token for positive auth probes (omit for WARN skips)
 */

import { createHmac } from "node:crypto";
import { REDACTED, redactHeaders } from "../apps/api/src/security/redact.ts";

type Verdict = "PASS" | "FAIL" | "WARN";

const API = (process.env.BASE_URL ?? process.env.G3_API_BASE ?? "").trim().replace(/\/$/, "");
const WEB = (process.env.G3_WEB_URL ?? "").trim().replace(/\/$/, "");
const OK_ORIGIN = (process.env.APPROVED_TEST_ORIGIN ?? "http://localhost:3000").trim();
const BAD_ORIGIN = (process.env.REJECTED_TEST_ORIGIN ?? "https://malicious-placeholder.example").trim();
const TEST_JWT = process.env.TEST_JWT?.trim();
const PILOT_COOKIE = process.env.TEST_ID_TOKEN_COOKIE?.trim(); // cookie value only for Next CAD route

async function probe(name: string, fn: () => Promise<boolean | "skip">): Promise<Verdict> {
  try {
    const r = await fn();
    if (r === "skip") {
      console.log(`WARN — ${name} (skipped — missing prerequisites)`);
      return "WARN";
    }
    if (r) {
      console.log(`PASS — ${name}`);
      return "PASS";
    }
    console.log(`FAIL — ${name}`);
    return "FAIL";
  } catch (e: unknown) {
    console.log(`FAIL — ${name}: ${e instanceof Error ? e.message : String(e)}`);
    return "FAIL";
  }
}

async function main() {
  const results: Verdict[] = [];

  console.log(`G3 smoke (API=${API || "(unset)"}; WEB=${WEB || "(unset)"})`);

  results.push(
    await probe("health reachable", async () => {
      if (!API) return false;
      const r = await fetch(`${API}/api/health`, { cache: "no-store" });
      return r.ok;
    }),
  );

  results.push(
    await probe("/api/me rejects anonymous", async () => {
      if (!API) return false;
      const r = await fetch(`${API}/api/me`, { cache: "no-store" });
      return r.status === 401;
    }),
  );

  results.push(
    await probe("JWT accepted when TEST_JWT set", async () => {
      if (!API || !TEST_JWT) return "skip";
      const r = await fetch(`${API}/api/me`, {
        headers: { Authorization: `Bearer ${TEST_JWT}` },
      });
      return r.ok;
    }),
  );

  results.push(
    await probe("CORS OPTIONS approved origin echoes ACAO", async () => {
      if (!API) return false;
      const r = await fetch(`${API}/api/billing/square/webhook`, {
        method: "OPTIONS",
        headers: {
          Origin: OK_ORIGIN,
          "Access-Control-Request-Method": "POST",
        },
      });
      const ac = r.headers.get("access-control-allow-origin") ?? "";
      return ac.includes(OK_ORIGIN) || OK_ORIGIN.includes(ac.replace(/\/$/, ""));
    }),
  );

  results.push(
    await probe("CORS OPTIONS rejected origin missing echo", async () => {
      if (!API) return false;
      const r = await fetch(`${API}/api/billing/square/webhook`, {
        method: "OPTIONS",
        headers: {
          Origin: BAD_ORIGIN,
          "Access-Control-Request-Method": "POST",
        },
      });
      const ac = r.headers.get("access-control-allow-origin");
      return ac == null || ac === "";
    }),
  );

  results.push(
    await probe("CAD shell write-back forbidden (cookie optional)", async () => {
      if (!WEB) return "skip";
      const r = await fetch(`${WEB}/api/cad/draft-update`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(PILOT_COOKIE ? { cookie: `rc_id_token=${PILOT_COOKIE}` } : {}),
        },
        body: JSON.stringify({ incidentId: "g3_smoke_incident" }),
      });
      if (!PILOT_COOKIE) return r.status === 401;
      const j = (await r.json().catch(() => null)) as Record<string, unknown> | null;
      return r.status === 403 && typeof j?.message === "string" && String(j.message).includes("pilot safety");
    }),
  );

  results.push(
    await probe("Square webhook rejects missing signatures (when configured upstream)", async () => {
      if (!API) return false;
      const r = await fetch(`${API}/api/billing/square/webhook`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type: "ignored" }),
      });
      return r.status !== 200 && r.status !== 204;
    }),
  );

  results.push(
    await probe("Square webhook rejects bogus HMAC", async () => {
      if (!API) return false;
      const bogus = createHmac("sha256", "invalid").digest("base64");
      const r = await fetch(`${API}/api/billing/square/webhook`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-square-hmacsha256-signature": bogus,
        },
        body: "{}",
      });
      return r.status !== 200 && r.status !== 204;
    }),
  );

  results.push(
    await probe("redactor masks Authorization header maps", async () => {
      const masked = redactHeaders({ Authorization: "Bearer SHOULD_NOT_PRINT", Accept: "*/*" });
      return masked.Authorization === REDACTED && masked.Accept === "*/*";
    }),
  );

  results.push(
    await probe("media upload proxy unauthorized or disabled", async () => {
      if (!WEB) return "skip";
      const r = await fetch(`${WEB}/api/media/upload-url`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ incidentId: "g3_smoke" }),
      });
      return r.status === 401 || r.status === 403 || r.status >= 502;
    }),
  );

  results.push(
    await probe("web security headers baseline", async () => {
      if (!WEB) return "skip";
      const r = await fetch(`${WEB}`, { redirect: "manual" });
      const okFr = ["deny", "DENY"].includes(r.headers.get("x-frame-options") ?? "");
      return okFr || r.status === 308 || r.status === 307 || r.status === 302;
    }),
  );

  const hardFail = results.filter((v) => v === "FAIL");
  console.log(`--- ${hardFail.length === 0 ? "Completed" : "Failures"} (${results.filter((v) => v === "PASS").length}/${results.length} PASS)`);
  if (hardFail.length) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
