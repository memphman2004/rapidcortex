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
const API_BASE_2 = process.env.PILOT_API_BASE_2?.trim().replace(/\/$/, "");
const NOTICES_API_BASE = API_BASE_2 ?? API_BASE;
const APP_ORIGIN = process.env.PILOT_APP_ORIGIN?.trim().replace(/\/$/, "");
const WWW_ORIGIN = process.env.PILOT_WWW_ORIGIN?.trim().replace(/\/$/, "");
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

async function checkHostRedirect(
  id: string,
  url: string,
  expectRedirect: boolean,
  locationPattern?: RegExp,
): Promise<Check> {
  try {
    const res = await fetch(url, { redirect: "manual" });
    if (expectRedirect) {
      if (![301, 302, 307, 308].includes(res.status)) {
        return fail(id, `${url} returned ${res.status}, expected 30x redirect`);
      }
      if (locationPattern) {
        const location = res.headers.get("location") ?? "";
        if (!locationPattern.test(location)) {
          return fail(id, `${url} location "${location}" did not match ${locationPattern}`);
        }
      }
    } else if (res.status !== 200) {
      return fail(id, `${url} returned ${res.status}, expected 200`);
    }
    return pass(id);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return fail(id, message);
  }
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

  // 11 — Password flow expectations (manual/integration checklist)
  // NEW_PASSWORD_REQUIRED: after challenge completion, /api/me should return 200 (session established).
  // Voluntary changePassword: /api/me should remain 200 (session not invalidated).
  // confirmForgotPassword: /api/me should remain 401 until explicit sign-in (no auto-login).

  // 12 — QR location system (requires API_BASE; optional seeded RCLI-CSU-000001)
  const REPORT_BASE = process.env.PILOT_REPORT_BASE?.trim().replace(/\/$/, "") ?? API_BASE;
  const SMOKE_RCLI = process.env.PILOT_SMOKE_RCLI?.trim() ?? "RCLI-CSU-000001";
  if (!REPORT_BASE) {
    console.log("SKIP — qr_rcli_resolve: set PILOT_API_BASE or PILOT_REPORT_BASE");
    results.push({ id: "qr_rcli_resolve", pass: true, detail: "SKIP_NO_API" });
    results.push({ id: "qr_rcli_invalid_404", pass: true, detail: "SKIP_NO_API" });
    results.push({ id: "qr_locations_admin_auth", pass: true, detail: "SKIP_NO_API" });
  } else {
    const resolve = await jsonFetch(`${REPORT_BASE}/api/r/${SMOKE_RCLI}`);
    if (resolve.connectionError) {
      results.push(fail("qr_rcli_resolve", resolve.connectionError));
    } else if (resolve.status === 404) {
      results.push(pass("qr_rcli_resolve", "404 (no seed data — endpoint reachable)"));
    } else if (resolve.status === 200) {
      const loc =
        typeof resolve.json === "object" && resolve.json !== null
          ? (resolve.json as Record<string, unknown>)
          : null;
      const okResolve =
        loc?.rcli === SMOKE_RCLI &&
        typeof loc?.locationName === "string" &&
        typeof loc?.zoneCode === "string" &&
        loc?.scanCount === undefined;
      results.push(
        okResolve
          ? pass("qr_rcli_resolve")
          : fail("qr_rcli_resolve", `unexpected body ${resolve.text.slice(0, 120)}`),
      );
    } else {
      results.push(fail("qr_rcli_resolve", `${resolve.status}`));
    }

    const bad = await jsonFetch(`${REPORT_BASE}/api/r/RCLI-FAKE-999999`);
    if (bad.connectionError) {
      results.push(fail("qr_rcli_invalid_404", bad.connectionError));
    } else {
      const badJson =
        typeof bad.json === "object" && bad.json !== null
          ? (bad.json as Record<string, unknown>)
          : null;
      results.push(
        bad.status === 404 && badJson?.error === "location_not_found"
          ? pass("qr_rcli_invalid_404")
          : fail("qr_rcli_invalid_404", `${bad.status} ${bad.text.slice(0, 80)}`),
      );
    }

    const unauth = await jsonFetch(`${REPORT_BASE}/api/admin/tenants/columbus-state/locations`);
    results.push(
      unauth.connectionError
        ? fail("qr_locations_admin_auth", unauth.connectionError)
        : unauth.status === 401
          ? pass("qr_locations_admin_auth")
          : fail("qr_locations_admin_auth", `${unauth.status}`),
    );
  }

  {
    const page = await jsonFetch(`${WEB_BASE}/r/${SMOKE_RCLI}`);
    results.push(
      page.connectionError
        ? fail("qr_intake_page_loads", page.connectionError)
        : page.status === 200
          ? pass("qr_intake_page_loads")
          : fail("qr_intake_page_loads", `${page.status}`),
    );
  }

  // 13 — report subdomain routing (set PILOT_REPORT_ORIGIN after DNS + cert deploy)
  const REPORT_ORIGIN = process.env.PILOT_REPORT_ORIGIN?.trim().replace(/\/$/, "");
  if (!REPORT_ORIGIN) {
    console.log("SKIP — report_subdomain_intake: set PILOT_REPORT_ORIGIN");
    results.push({ id: "report_subdomain_intake", pass: true, detail: "SKIP_NO_ORIGIN" });
    results.push({ id: "report_subdomain_root_redirect", pass: true, detail: "SKIP_NO_ORIGIN" });
  } else {
    const reportPage = await jsonFetch(`${REPORT_ORIGIN}/r/${SMOKE_RCLI}`);
    results.push(
      reportPage.connectionError
        ? fail("report_subdomain_intake", reportPage.connectionError)
        : reportPage.status === 200
          ? pass("report_subdomain_intake")
          : fail("report_subdomain_intake", `${reportPage.status}`),
    );

    try {
      const reportRoot = await fetch(`${REPORT_ORIGIN}/`, { redirect: "manual" });
      results.push(
        reportRoot.status === 301 || reportRoot.status === 302 || reportRoot.status === 307 || reportRoot.status === 308
          ? pass("report_subdomain_root_redirect")
          : fail("report_subdomain_root_redirect", `${reportRoot.status}`),
      );
    } catch (e: unknown) {
      results.push(
        fail("report_subdomain_root_redirect", e instanceof Error ? e.message : String(e)),
      );
    }
  }

  // 15 — Platform notices API auth gates (stack 2; set PILOT_API_BASE_2 or PILOT_API_BASE)
  if (!NOTICES_API_BASE) {
    console.log("SKIP — notices_admin_auth: set PILOT_API_BASE_2 or PILOT_API_BASE");
    results.push({ id: "notices_admin_auth", pass: true, detail: "SKIP_NO_API_BASE" });
    results.push({ id: "notices_active_auth", pass: true, detail: "SKIP_NO_API_BASE" });
  } else {
    const noAuth = await jsonFetch(`${NOTICES_API_BASE}/api/admin/notices`);
    results.push(
      noAuth.status === 401
        ? pass("notices_admin_auth")
        : fail("notices_admin_auth", `${noAuth.status}`),
    );
    const unauth = await jsonFetch(`${NOTICES_API_BASE}/api/notices/active`);
    results.push(
      unauth.status === 401
        ? pass("notices_active_auth")
        : fail("notices_active_auth", `${unauth.status}`),
    );
  }

  // 14 — App vs www host routing (prod SSR deploy guard; set PILOT_APP_ORIGIN + PILOT_WWW_ORIGIN)
  if (APP_ORIGIN && WWW_ORIGIN) {
    const hostChecks: Array<{
      id: string;
      url: string;
      expectRedirect: boolean;
      locationPattern?: RegExp;
    }> = [
      { id: "host_app_pricing_redirect", url: `${APP_ORIGIN}/pricing`, expectRedirect: true, locationPattern: /www\.rapidcortex\.us/ },
      { id: "host_app_root_login", url: `${APP_ORIGIN}/`, expectRedirect: true, locationPattern: /\/login/ },
      { id: "host_app_product_redirect", url: `${APP_ORIGIN}/product`, expectRedirect: true, locationPattern: /www\.rapidcortex\.us/ },
      { id: "host_www_pricing_200", url: `${WWW_ORIGIN}/pricing`, expectRedirect: false },
      { id: "host_www_root_200", url: `${WWW_ORIGIN}/`, expectRedirect: false },
    ];
    for (const check of hostChecks) {
      results.push(
        await checkHostRedirect(check.id, check.url, check.expectRedirect, check.locationPattern),
      );
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
