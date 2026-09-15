import type {
  AgencyBillingConfig,
  AutomatedInvoice,
  AutomatedInvoiceStatus,
  InvoicePreviewResult,
} from "rapid-cortex-shared";

async function billingRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const base =
    typeof window !== "undefined"
      ? `${window.location.origin}/api/backend`
      : (process.env.API_UPSTREAM_BASE_4 ?? process.env.API_UPSTREAM_BASE ?? "").replace(/\/$/, "");
  if (!base) throw new Error("API base URL not configured");
  const res = await fetch(`${base}${path}`, {
    ...init,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const text = await res.text();
  const body = text ? (JSON.parse(text) as unknown) : null;
  if (!res.ok) {
    const err = body as { error?: string } | null;
    throw new Error(err?.error ?? `Request failed (${res.status})`);
  }
  return body as T;
}

export async function fetchAutomatedInvoices(params?: {
  status?: AutomatedInvoiceStatus | "all";
  agencyId?: string;
  billingPeriod?: string;
  planId?: string;
  limit?: number;
}): Promise<{ invoices: AutomatedInvoice[] }> {
  const q = new URLSearchParams();
  if (params?.status && params.status !== "all") q.set("status", params.status);
  if (params?.agencyId) q.set("agencyId", params.agencyId);
  if (params?.billingPeriod) q.set("billingPeriod", params.billingPeriod);
  if (params?.planId) q.set("planId", params.planId);
  if (params?.limit) q.set("limit", String(params.limit));
  const suffix = q.toString();
  return billingRequest(`/api/billing/automated-invoices${suffix ? `?${suffix}` : ""}`);
}

export async function fetchAutomatedInvoice(invoiceId: string): Promise<{ invoice: AutomatedInvoice }> {
  return billingRequest(`/api/billing/automated-invoices/${encodeURIComponent(invoiceId)}`);
}

export async function patchAutomatedInvoice(
  invoiceId: string,
  body: { status?: AutomatedInvoiceStatus; notes?: string; voidReason?: string },
): Promise<{ invoiceId: string; status: AutomatedInvoiceStatus; updatedAt: string }> {
  return billingRequest(`/api/billing/automated-invoices/${encodeURIComponent(invoiceId)}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function resendAutomatedInvoice(
  invoiceId: string,
): Promise<{ invoiceId: string; sent: boolean; skipped: string | null }> {
  return billingRequest(`/api/billing/automated-invoices/${encodeURIComponent(invoiceId)}/resend`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function previewAutomatedInvoice(body: {
  agencyId: string;
  billingPeriod: string;
}): Promise<InvoicePreviewResult> {
  return billingRequest("/api/billing/automated-invoices/preview", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function fetchAutomatedBillingConfig(agencyId?: string): Promise<{ config: AgencyBillingConfig }> {
  const q = agencyId ? `?agencyId=${encodeURIComponent(agencyId)}` : "";
  return billingRequest(`/api/billing/automated-config${q}`);
}
