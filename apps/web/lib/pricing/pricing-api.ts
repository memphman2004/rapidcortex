import type {
  GlobalPricingConfig,
  PricingAuditRecord,
  PricingOverrides,
  TenantPricingConfig,
  TenantPricingSummary,
} from "./pricing-types";

type ApiError = { ok: false; error: string; code: string };

async function pricingRequest<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const isBrowser = typeof window !== "undefined";
  const base = isBrowser ? window.location.origin : "";
  const apiBase =
    base ||
    process.env.API_UPSTREAM_BASE_4?.replace(/\/$/, "") ||
    process.env.API_UPSTREAM_BASE?.replace(/\/$/, "") ||
    "";
  if (!apiBase) throw new Error("API base URL not configured");

  const url = isBrowser ? `${base}${path}` : `${apiBase}${path}`;
  const res = await fetch(url, {
    ...init,
    credentials: isBrowser ? "include" : init?.credentials,
    headers: {
      "content-type": "application/json",
      ...init?.headers,
    },
  });

  const text = await res.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text) as unknown;
    } catch {
      body = { error: text.slice(0, 500) };
    }
  }

  if (!res.ok) {
    const err = body as Partial<ApiError> & { error?: string; message?: string };
    const message = err.error ?? err.message ?? `Request failed (${res.status})`;
    throw new Error(message);
  }

  return body as T;
}

export async function fetchGlobalPricing(): Promise<
  GlobalPricingConfig & { pricing: PricingOverrides }
> {
  return pricingRequest("/api/admin/pricing/global");
}

export async function putGlobalPricing(
  changes: PricingOverrides,
  reason: string,
): Promise<void> {
  await pricingRequest("/api/admin/pricing/global", {
    method: "PUT",
    body: JSON.stringify({ overrides: changes, reason }),
  });
}

export async function fetchTenants(): Promise<{ tenants: TenantPricingSummary[] }> {
  return pricingRequest("/api/admin/pricing/tenants");
}

export async function fetchTenantPricing(
  agencyId: string,
): Promise<TenantPricingConfig & { effectivePricing: PricingOverrides }> {
  return pricingRequest(
    `/api/admin/pricing/tenants/${encodeURIComponent(agencyId)}`,
  );
}

export async function putTenantPricing(
  agencyId: string,
  changes: PricingOverrides,
  reason: string,
): Promise<void> {
  await pricingRequest(
    `/api/admin/pricing/tenants/${encodeURIComponent(agencyId)}`,
    {
      method: "PUT",
      body: JSON.stringify({ overrides: changes, reason }),
    },
  );
}

export async function deleteTenantPricing(
  agencyId: string,
  reason: string,
): Promise<void> {
  await pricingRequest(
    `/api/admin/pricing/tenants/${encodeURIComponent(agencyId)}`,
    {
      method: "DELETE",
      body: JSON.stringify({ reason }),
    },
  );
}

export async function fetchPricingAudit(params?: {
  scope?: string;
  agencyId?: string;
  limit?: number;
  before?: string;
}): Promise<{ records: PricingAuditRecord[]; nextBefore?: string }> {
  const qs = new URLSearchParams();
  if (params?.scope) qs.set("scope", params.scope);
  if (params?.agencyId) qs.set("agencyId", params.agencyId);
  if (params?.limit) qs.set("limit", String(params.limit));
  if (params?.before) qs.set("before", params.before);
  const q = qs.toString();
  return pricingRequest(`/api/admin/pricing/audit${q ? `?${q}` : ""}`);
}
