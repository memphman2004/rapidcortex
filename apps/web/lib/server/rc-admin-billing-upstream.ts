import type { NextRequest } from "next/server";
import { COOKIE_ID_TOKEN } from "@/lib/auth/cookies";
import { resolveUpstreamApiBase } from "@/lib/comms-api-path";

type UpstreamJson = Record<string, unknown> & {
  items?: unknown[];
  error?: string;
  message?: string;
};

export async function upstreamBillingFetch(
  request: NextRequest,
  upstreamPath: string,
  init: RequestInit = {},
): Promise<Response> {
  const base = resolveUpstreamApiBase(upstreamPath);
  if (!base) {
    return new Response(
      JSON.stringify({
        error: "API_UPSTREAM_BASE_4 is not configured for billing routes",
      }),
      { status: 503, headers: { "content-type": "application/json" } },
    );
  }

  const token = request.cookies.get(COOKIE_ID_TOKEN)?.value;
  if (!token) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  const target = new URL(`${base}${upstreamPath}`);
  const headers = new Headers(init.headers);
  if (!headers.has("content-type") && init.body) {
    headers.set("content-type", "application/json");
  }
  headers.set("authorization", `Bearer ${token}`);

  try {
    return await fetch(target, {
      ...init,
      headers,
      cache: "no-store",
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Upstream request failed";
    console.error("[upstreamBillingFetch]", upstreamPath, detail);
    return new Response(
      JSON.stringify({
        error: `Billing API unreachable (${upstreamPath}): ${detail}`,
      }),
      { status: 502, headers: { "content-type": "application/json" } },
    );
  }
}

export async function upstreamBillingJson<T extends UpstreamJson = UpstreamJson>(
  request: NextRequest,
  upstreamPath: string,
  init: RequestInit = {},
): Promise<{ ok: true; data: T; status: number } | { ok: false; status: number; body: UpstreamJson }> {
  const res = await upstreamBillingFetch(request, upstreamPath, init);
  const text = await res.text();
  let body: UpstreamJson = {};
  if (text) {
    try {
      body = JSON.parse(text) as UpstreamJson;
    } catch {
      body = { error: text.slice(0, 500) };
    }
  }
  if (!res.ok) {
    return { ok: false, status: res.status, body };
  }
  return { ok: true, data: body as T, status: res.status };
}

export function agencyQuery(agencyId: string): string {
  return `agencyId=${encodeURIComponent(agencyId)}`;
}

export async function resolveBillingCustomerId(
  request: NextRequest,
  agencyId: string,
): Promise<string | null> {
  const res = await upstreamBillingJson<{ items?: Array<{ customerId?: string }> }>(
    request,
    `/api/billing/customers?${agencyQuery(agencyId)}`,
  );
  if (!res.ok) return null;
  const items = res.data.items ?? [];
  const first = items[0];
  return typeof first?.customerId === "string" ? first.customerId : null;
}

export type EnsureBillingCustomerInput = {
  agencyName: string;
  billingContactName: string;
  billingContactEmail: string;
};

export async function ensureBillingCustomerForAgency(
  request: NextRequest,
  agencyId: string,
  contacts: EnsureBillingCustomerInput,
): Promise<{ customerId: string; created: boolean } | { error: string; status: number }> {
  const existing = await resolveBillingCustomerId(request, agencyId);
  if (existing) return { customerId: existing, created: false };

  const email = contacts.billingContactEmail.trim();
  if (!email) {
    return {
      error:
        "No billing contact email on file. Set billing contact on the agency profile, then retry.",
      status: 400,
    };
  }

  const created = await upstreamBillingJson<{ customerId?: string }>(
    request,
    `/api/billing/customers?${agencyQuery(agencyId)}`,
    {
      method: "POST",
      body: JSON.stringify({
        agencyName: contacts.agencyName,
        billingContact: contacts.billingContactName || contacts.agencyName,
        email,
        paymentTerms: "NET_30",
        requiresPO: false,
        taxExempt: true,
      }),
    },
  );

  if (!created.ok) {
    return {
      error: String(created.body.error ?? created.body.message ?? "Failed to create billing customer"),
      status: created.status,
    };
  }

  const customerId = String(created.data.customerId ?? "");
  if (!customerId) {
    return { error: "Billing customer created but customerId missing in response.", status: 502 };
  }

  return { customerId, created: true };
}
