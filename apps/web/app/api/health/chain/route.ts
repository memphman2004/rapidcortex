import { NextResponse } from "next/server";
import { getCognitoClientId, getCognitoUserPoolId } from "@/lib/auth/cognito-config";

export const dynamic = "force-dynamic";

const FETCH_MS = 12_000;

async function fetchHealthJson(base: string): Promise<{ ok: boolean; status: number; detail?: string }> {
  const url = `${base.replace(/\/$/, "")}/api/health`;
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(FETCH_MS),
    });
    const text = await res.text();
    if (!res.ok) {
      return { ok: false, status: res.status, detail: text.slice(0, 200) };
    }
    try {
      const j = JSON.parse(text) as { status?: string; service?: string };
      const apiOk = j.status === "ok" && j.service === "rapid-cortex-api";
      return { ok: apiOk, status: res.status, detail: apiOk ? undefined : "unexpected body" };
    } catch {
      return { ok: false, status: res.status, detail: "non-json body" };
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, status: 0, detail: msg };
  }
}

/**
 * Aggregated readiness for login + BFF + API stacks (no secrets).
 * Returns HTTP 200 only when critical checks pass so monitors can alert on non-200.
 * Also reachable as `GET /api/health-chain` (see `next.config.mjs` rewrite).
 */
export async function GET() {
  const apiUp = process.env.API_UPSTREAM_BASE?.trim().replace(/\/$/, "") ?? "";
  const apiUp2 = process.env.API_UPSTREAM_BASE_2?.trim().replace(/\/$/, "") ?? "";

  let apiStack1: { ok: boolean; status: number; detail?: string } | null = null;
  let apiStack2:
    | { configured: false }
    | { configured: true; ok: boolean; status: number; detail?: string } = {
    configured: false,
  };

  if (apiUp) {
    apiStack1 = await fetchHealthJson(apiUp);
  }

  if (apiUp2) {
    const health = await fetchHealthJson(apiUp2);
    apiStack2 = { configured: true, ok: health.ok, status: health.status, detail: health.detail };
  }

  const checks = {
    apiUpstreamBaseConfigured: Boolean(apiUp),
    cognitoPoolConfigured: Boolean(getCognitoUserPoolId()),
    cognitoClientConfigured: Boolean(getCognitoClientId()),
    apiStack1,
    apiStack2,
  };

  const stack1Bad = apiUp && checks.apiStack1 !== null && !checks.apiStack1.ok;
  const stack2Bad =
    apiUp2 && checks.apiStack2.configured === true && !checks.apiStack2.ok;
  const envBad =
    !checks.apiUpstreamBaseConfigured || !checks.cognitoPoolConfigured || !checks.cognitoClientConfigured;

  const ok =
    !envBad &&
    !stack1Bad &&
    !stack2Bad &&
    checks.apiStack1?.ok === true;

  const body = {
    ok,
    service: "rapid-cortex-web-health-chain",
    timestamp: new Date().toISOString(),
    checks,
    hints: [
      !checks.apiUpstreamBaseConfigured ? "Set API_UPSTREAM_BASE on the web container for BFF + password-renewal proxy." : null,
      !checks.cognitoPoolConfigured || !checks.cognitoClientConfigured
        ? "Set COGNITO_USER_POOL_ID and COGNITO_CLIENT_ID (and NEXT_PUBLIC_* for browser) on the web task."
        : null,
      stack1Bad ? `Primary API health failed (${apiUp}/api/health). Check Lambda/API Gateway and SAM deploy.` : null,
      stack2Bad ? `Secondary API health failed (${apiUp2}/api/health). RC-admin / stack-2 routes may be down.` : null,
    ].filter(Boolean),
  };

  return NextResponse.json(body, {
    status: ok ? 200 : 503,
    headers: {
      "cache-control": "no-store, no-cache, must-revalidate",
    },
  });
}
