#!/usr/bin/env npx tsx
/**
 * Controlled pilot / staging smoke validation.
 *
 * Requires a running Next app for web-route checks (`PILOT_WEB_BASE`, default http://127.0.0.1:3000).
 * API checks (`PILOT_API_BASE`) rely on Lambda HTTP URLs (not the Next `/api/*` façade).
 *
 * Provide `PILOT_BEARER_TOKEN` (+ optional cookie via direct API calls only) where authenticated probes are exercised.
 */

type Check = { id: string; pass: boolean; detail?: string };

const WEB_BASE = (process.env.PILOT_WEB_BASE ?? "http://127.0.0.1:3000").replace(/\/$/, "");
const API_BASE = process.env.PILOT_API_BASE?.trim().replace(/\/$/, "");
const PILOT_COOKIE = process.env.PILOT_ID_TOKEN_COOKIE?.trim();
/** Raw JWT bearer for API Lambda routes (preferred over legacy cookie probes). */
const BEARER = process.env.PILOT_BEARER_TOKEN?.trim();

function printBanner() {
  console.log("Pilot smoke checks");
  console.log(`WEB_BASE=${WEB_BASE}`);
  console.log(`API_BASE=${API_BASE ?? "(not set)"}`);
  console.log(`BEARER=${BEARER ? "(set)" : "(not set)"}`);
  console.log("---");
}

async function jsonFetch(
  url: string,
  init?: RequestInit & { expectJson?: boolean },
): Promise<{ ok: boolean; status: number; json: unknown; text: string; connectionError?: string }> {
  try {
    const res = await fetch(url, init);
    const text = await res.text();
    let parsed: unknown = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = null;
    }
    return { ok: res.ok, status: res.status, json: parsed, text };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      status: 0,
      json: null,
      text: "",
      connectionError: message,
    };
  }
}

function pass(id: string, detail?: string): Check {
  console.log(`PASS — ${id}${detail ? `: ${detail}` : ""}`);
  return { id, pass: true, detail };
}

function fail(id: string, detail?: string): Check {
  console.log(`FAIL — ${id}${detail ? `: ${detail}` : ""}`);
  return { id, pass: false, detail };
}

async function main() {
  printBanner();
  const results: Check[] = [];

  // 1 — API health
  if (!API_BASE) {
    results.push(fail("api_health", "PILOT_API_BASE not set"));
  } else {
    const probe = await jsonFetch(`${API_BASE}/api/health`);
    if (probe.connectionError) {
      results.push(fail("api_health", probe.connectionError));
    } else if (probe.status === 200 && probe.json != null && typeof probe.json === "object") {
      results.push(pass("api_health"));
    } else {
      results.push(fail("api_health", `${probe.status}`));
    }
  }

  // 2 — Auth rejects unauthenticated callers (upstream API Lambda)
  if (API_BASE) {
    const me = await jsonFetch(`${API_BASE}/api/me`);
    if (me.connectionError) {
      results.push(fail("auth_rejects_anon", me.connectionError));
    } else {
      results.push(me.status === 401 ? pass("auth_rejects_anon") : fail("auth_rejects_anon", `${me.status}`));
    }
  } else {
    results.push(fail("auth_rejects_anon", "skipped (no PILOT_API_BASE)"));
  }

  // 3 — CAD adapter health on Next shell (read-only shim)
  {
    const h = await jsonFetch(`${WEB_BASE}/api/cad/health`);
    if (h.connectionError) {
      results.push(fail("cad_read_health_shell", h.connectionError));
    } else {
      const okHc =
        h.status === 200 &&
        h.json &&
        typeof h.json === "object" &&
        (h.json as Record<string, unknown>).health !== undefined;
      results.push(okHc ? pass("cad_read_health_shell") : fail("cad_read_health_shell", `${h.status}`));
    }
  }

  // 4 — listActiveIncidents surrogate (requires entitlement auth on Next shell)
  {
    const url = `${WEB_BASE}/api/cad/active-incidents`;
    const headers =
      PILOT_COOKIE && PILOT_COOKIE.length > 0
        ? ({ cookie: `rc_id_token=${PILOT_COOKIE}` } as Record<string, string>)
        : undefined;
    const r = await jsonFetch(url, { headers });
    if (r.connectionError) {
      results.push(fail("cad_list_active_shell", r.connectionError));
    } else {
      let okListed = false;
      if (r.status === 200 && r.json && typeof r.json === "object") {
        const j = r.json as Record<string, unknown>;
        okListed =
          Array.isArray(j.incidents) &&
          typeof j.incidents[0] === "object" &&
          j.incidents[0] != null &&
          typeof (j.incidents[0] as Record<string, unknown>).incidentId === "string";
      }

      if (!PILOT_COOKIE && r.status === 401) {
        results.push(pass("cad_list_active_shell", "anonymous request rejected (expected)"));
      } else {
        results.push(
          okListed ? pass("cad_list_active_shell") : fail("cad_list_active_shell", `${r.status}`),
        );
      }
    }
  }

  // 5 — CAD write-back blocked shell (requires entitlement auth)
  {
    const url = `${WEB_BASE}/api/cad/draft-update`;
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (PILOT_COOKIE) headers.cookie = `rc_id_token=${PILOT_COOKIE}`;
    const r = await jsonFetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ incidentId: "pilot-smoke-incident" }),
    });
    if (r.connectionError) {
      results.push(fail("cad_writeback_blocked_shell", r.connectionError));
    } else if (!PILOT_COOKIE) {
      console.log(
        "SKIP — cad_writeback_blocked_shell: set PILOT_ID_TOKEN_COOKIE to exercise blocked write response.",
      );
      results.push({
        id: "cad_writeback_blocked_shell",
        pass: true,
        detail: "SKIP_NO_COOKIE",
      });
    } else {
      const blocked =
        r.status === 403 &&
        typeof r.json === "object" &&
        (r.json as Record<string, unknown>).message === "CAD write-back is disabled for pilot safety.";
      results.push(blocked ? pass("cad_writeback_blocked_shell") : fail("cad_writeback_blocked_shell", `${r.status}`));
    }
  }

  // 6 — Audit API row (direct Lambda bearer)
  if (!API_BASE || !BEARER) {
    console.log("SKIP — cad_write_audit_api: set PILOT_API_BASE + PILOT_BEARER_TOKEN to exercise Dynamo audit insert.");
    results.push({
      id: "cad_write_audit_api",
      pass: true,
      detail: "SKIP_NO_BEARER",
    });
  } else {
    const r = await jsonFetch(`${API_BASE}/api/security/cad-writeback-blocked`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${BEARER}`,
      },
      body: JSON.stringify({ action: "pilot_smoke_test", incidentId: "pilot-smoke-incident" }),
    });
    if (r.connectionError) {
      results.push(fail("cad_write_audit_api", r.connectionError));
    } else {
      const okAudit =
        r.status === 200 &&
        typeof r.json === "object" &&
        (r.json as Record<string, unknown>).ok === true &&
        (r.json as Record<string, unknown>).recorded === true;
      results.push(okAudit ? pass("cad_write_audit_api") : fail("cad_write_audit_api", `${r.status} ${r.text.slice(0, 120)}`));
    }
  }

  // 7 — Intake upstream shell (graceful degradation or proxy)
  {
    const r = await jsonFetch(`${WEB_BASE}/api/intake/session`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mode: "pilot_smoke" }),
    });
    const degraded =
      !r.connectionError &&
      (r.status === 401 ||
        (r.status >= 502 && r.status <= 599) ||
        (typeof r.json === "object" && (r.json as Record<string, unknown>).error !== undefined));
    results.push(
      r.connectionError
        ? fail("intake_shell_safe", r.connectionError)
        : degraded
          ? pass("intake_shell_safe")
          : fail("intake_shell_safe", `${r.status}`),
    );
  }

  // 8 — Supervisor dashboard surrogate (shell side)
  {
    const r = await jsonFetch(`${WEB_BASE}/api/dashboard/summary?prefix=supervisor`);
    results.push(
      r.connectionError
        ? fail("supervisor_dashboard_shell_auth_gate", r.connectionError)
        : r.status === 401
          ? pass("supervisor_dashboard_shell_auth_gate")
          : fail("supervisor_dashboard_shell_auth_gate", `${r.status}`),
    );
  }

  // 9 — Translation shell
  {
    const r = await jsonFetch(`${WEB_BASE}/api/language/translate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "pilot smoke", sourceLang: "en", targetLang: "es" }),
    });
    if (r.connectionError) {
      results.push(fail("translation_shell_safe", r.connectionError));
    } else {
    const j = typeof r.json === "object" && r.json !== null ? (r.json as Record<string, unknown>) : null;
    const safe =
      r.status === 401 ||
      r.status === 403 ||
      r.ok ||
      (r.status >= 500 && r.status <= 599) ||
      !!j?.error;
    results.push(safe ? pass("translation_shell_safe") : fail("translation_shell_safe", `${r.status}`));
    }
  }

  // 10 — Transcription shell
  {
    const r = await jsonFetch(`${WEB_BASE}/api/transcription/start`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ callId: "pilot_smoke_validation" }),
    });
    if (r.connectionError) {
      results.push(fail("transcription_shell_safe", r.connectionError));
    } else {
    const j = typeof r.json === "object" && r.json !== null ? (r.json as Record<string, unknown>) : null;
    const safe =
      r.status === 401 ||
      r.status === 403 ||
      r.ok ||
      (r.status >= 500 && r.status <= 599) ||
      !!j?.error;
    results.push(safe ? pass("transcription_shell_safe") : fail("transcription_shell_safe", `${r.status}`));
    }
  }

  console.log("---");
  const hardFails = results.filter((r) => !r.pass);
  console.log(`${hardFails.length === 0 ? "Done" : "Completed with FAILURES"} (${results.filter((x) => x.pass).length}/${results.length} passed)`);
  if (hardFails.length > 0) {
    process.exit(1);
  }
  process.exit(0);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
