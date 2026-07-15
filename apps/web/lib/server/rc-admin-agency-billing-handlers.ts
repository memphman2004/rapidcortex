import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  ADDON_CATALOG,
  type AddonDefinition,
  type AddonKey,
  type TenantAddonState,
} from "rapid-cortex-shared";
import {
  agencyQuery,
  ensureBillingCustomerForAgency,
  resolveBillingCustomerId,
  upstreamBillingFetch,
  upstreamBillingJson,
} from "@/lib/server/rc-admin-billing-upstream";
import {
  addDaysIso,
  buildAgencyInvoicePrefillLines,
  mapLineItems,
  resolveAgencyPlanMonthlyRate,
  toUiInvoice,
  uiLineItemsToCreatePayload,
  type AgencyBillingSummary,
  type UiAgencyInvoice,
  type UiLineItem,
} from "@/lib/rc-admin/agency-invoice-view";

type RouteCtx = { params: Promise<{ agencyId: string }> };
type InvoiceRouteCtx = { params: Promise<{ agencyId: string; invoiceId: string }> };
type AddonRouteCtx = { params: Promise<{ agencyId: string; code: string }> };

import type { FeatureAddOnRow } from "@/lib/rc-admin/feature-add-on-types";

function errorResponse(status: number, message: string) {
  return NextResponse.json({ error: message, message }, { status });
}

async function fetchAgencyRecord(request: NextRequest, agencyId: string) {
  return upstreamBillingJson<Record<string, unknown>>(
    request,
    `/api/agencies/${encodeURIComponent(agencyId)}`,
  );
}

async function fetchBillingProfile(request: NextRequest, agencyId: string) {
  return upstreamBillingJson<Record<string, unknown>>(
    request,
    `/api/agencies/${encodeURIComponent(agencyId)}/billing-profile`,
  );
}

async function fetchBillingCustomers(request: NextRequest, agencyId: string) {
  return upstreamBillingJson<{ items?: Array<Record<string, unknown>> }>(
    request,
    `/api/billing/customers?${agencyQuery(agencyId)}`,
  );
}

async function fetchInvoiceDetail(request: NextRequest, agencyId: string, invoiceId: string) {
  return upstreamBillingJson<Record<string, unknown> & { lineItems?: unknown[] }>(
    request,
    `/api/billing/invoices/${encodeURIComponent(invoiceId)}?${agencyQuery(agencyId)}`,
  );
}

function addonUnitPrice(def: AddonDefinition): number {
  if (def.billingType === "one_time") return def.oneTimePrice;
  return def.monthlyPrice;
}

function addonBillingCycle(def: AddonDefinition): "monthly" | "one_time" {
  return def.billingType === "one_time" ? "one_time" : "monthly";
}

function mapAddonRow(key: AddonKey, state: TenantAddonState | undefined): FeatureAddOnRow | null {
  if (!state?.enabled) return null;
  const def = ADDON_CATALOG.find((a) => a.key === key);
  if (!def) return null;
  return {
    id: key,
    name: def.name,
    category: def.category,
    description: def.description,
    unitPrice: state.overridePriceCents != null ? state.overridePriceCents / 100 : addonUnitPrice(def),
    billingCycle: addonBillingCycle(def),
    enabledAt: state.enabledAt,
    enabledBy: state.enabledBy,
    status: "enabled",
    serviceCode: key,
  };
}

async function loadBillingSummary(request: NextRequest, agencyId: string): Promise<
  | { ok: true; summary: AgencyBillingSummary }
  | { ok: false; status: number; message: string }
> {
  const [agencyRes, profileRes, customersRes] = await Promise.all([
    fetchAgencyRecord(request, agencyId),
    fetchBillingProfile(request, agencyId),
    fetchBillingCustomers(request, agencyId),
  ]);

  if (!agencyRes.ok) {
    return {
      ok: false,
      status: agencyRes.status,
      message: String(agencyRes.body.error ?? "Agency not found"),
    };
  }

  const agency = agencyRes.data;
  const profile = profileRes.ok ? profileRes.data : {};
  const contacts = (profile.contacts ?? {}) as Record<string, unknown>;
  const customer = customersRes.ok ? (customersRes.data.items ?? [])[0] : undefined;

  const subscription = (profile.subscription ?? {}) as Record<string, unknown>;
  const plan = String(subscription.planId ?? profile.assignedPlanId ?? "RC CORE");

  return {
    ok: true,
    summary: {
      agencyId,
      agencyName: String(agency.name ?? agencyId),
      billingContactEmail: String(
        customer?.email ??
          contacts.billingContactEmail ??
          agency.billingEmail ??
          agency.primaryContactEmail ??
          "",
      ),
      billingContactName: String(
        customer?.billingContact ??
          contacts.billingContactName ??
          agency.primaryContactName ??
          agency.name ??
          "",
      ),
      plan,
      currentMonthlyRate: Number(customer?.currentMonthlyRate ?? 0),
      customerId: customer?.customerId ? String(customer.customerId) : undefined,
    },
  };
}

async function loadEnabledAddOnRows(
  request: NextRequest,
  agencyId: string,
): Promise<FeatureAddOnRow[]> {
  const res = await upstreamBillingJson<{
    data?: { entitlements?: { addons?: Record<string, TenantAddonState> } };
  }>(request, `/api/admin/tenants/${encodeURIComponent(agencyId)}/entitlements`);
  if (!res.ok) return [];
  const addons = res.data.data?.entitlements?.addons ?? {};
  return Object.entries(addons)
    .map(([key, state]) => mapAddonRow(key as AddonKey, state))
    .filter(Boolean) as FeatureAddOnRow[];
}

async function createInvoiceForAgency(
  request: NextRequest,
  agencyId: string,
  input: {
    invoiceDate: string;
    dueDate: string;
    poNumber?: string;
    notes?: string;
    lineItems: UiLineItem[];
    customerId: string;
  },
): Promise<
  | { ok: true; invoice: Record<string, unknown>; lineItems: UiLineItem[] }
  | { ok: false; status: number; message: string }
> {
  const payload = {
    customerId: input.customerId,
    invoiceDate: input.invoiceDate,
    dueDate: input.dueDate,
    poNumber: input.poNumber,
    notes: input.notes,
    currency: "USD",
    discount: 0,
    tax: 0,
    lineItems: uiLineItemsToCreatePayload(input.lineItems),
  };

  const created = await upstreamBillingJson<Record<string, unknown>>(
    request,
    `/api/billing/invoices?${agencyQuery(agencyId)}`,
    { method: "POST", body: JSON.stringify(payload) },
  );

  if (!created.ok) {
    return {
      ok: false,
      status: created.status,
      message: String(created.body.error ?? created.body.message ?? "Failed to create invoice"),
    };
  }

  const invoiceId = String(created.data.invoiceId ?? "");
  const detail = invoiceId ? await fetchInvoiceDetail(request, agencyId, invoiceId) : null;
  const mappedLineItems = detail?.ok ? mapLineItems(detail.data.lineItems ?? []) : input.lineItems;

  return { ok: true, invoice: created.data, lineItems: mappedLineItems };
}

async function sendInvoiceWithPdf(
  request: NextRequest,
  agencyId: string,
  invoiceId: string,
): Promise<{ ok: true } | { ok: false; status: number; message: string }> {
  const pdf = await upstreamBillingJson(
    request,
    `/api/billing/invoices/${encodeURIComponent(invoiceId)}/regenerate-pdf?${agencyQuery(agencyId)}`,
    { method: "POST", body: JSON.stringify({}) },
  );
  if (!pdf.ok) {
    return {
      ok: false,
      status: pdf.status,
      message: String(pdf.body.error ?? "Failed to generate invoice PDF"),
    };
  }

  const sent = await upstreamBillingJson(
    request,
    `/api/billing/invoices/${encodeURIComponent(invoiceId)}/send?${agencyQuery(agencyId)}`,
    { method: "POST", body: JSON.stringify({}) },
  );
  if (!sent.ok) {
    return {
      ok: false,
      status: sent.status,
      message: String(sent.body.error ?? "Failed to send invoice"),
    };
  }

  return { ok: true };
}

export async function billingSummaryHandler(request: NextRequest, ctx: RouteCtx) {
  const { agencyId } = await ctx.params;
  const loaded = await loadBillingSummary(request, agencyId);
  if (!loaded.ok) return errorResponse(loaded.status, loaded.message);

  let summary = loaded.summary;
  if (!summary.customerId) {
    const ensured = await ensureBillingCustomerForAgency(request, agencyId, {
      agencyName: summary.agencyName,
      billingContactName: summary.billingContactName,
      billingContactEmail: summary.billingContactEmail,
    });
    if ("customerId" in ensured) {
      summary = {
        ...summary,
        customerId: ensured.customerId,
        billingCustomerAutoCreated: ensured.created,
      };
    }
  }

  const enabledAddOns = await loadEnabledAddOnRows(request, agencyId);
  summary = {
    ...summary,
    currentMonthlyRate: resolveAgencyPlanMonthlyRate(summary),
    suggestedLineItems: buildAgencyInvoicePrefillLines(summary, enabledAddOns),
  };

  return NextResponse.json(summary);
}

export async function listInvoicesHandler(request: NextRequest, ctx: RouteCtx) {
  const { agencyId } = await ctx.params;
  const [listRes, summaryLoaded] = await Promise.all([
    upstreamBillingJson<{ items?: Array<Record<string, unknown>> }>(
      request,
      `/api/billing/invoices?${agencyQuery(agencyId)}`,
    ),
    loadBillingSummary(request, agencyId),
  ]);

  if (!listRes.ok) {
    return errorResponse(listRes.status, String(listRes.body.error ?? "Failed to load invoices"));
  }

  const billingContactEmail = summaryLoaded.ok ? summaryLoaded.summary.billingContactEmail : "";
  const agencyName = summaryLoaded.ok ? summaryLoaded.summary.agencyName : agencyId;

  const rows = listRes.data.items ?? [];
  const enriched = await Promise.all(
    rows.slice(0, 50).map(async (row) => {
      const invoiceId = String(row.invoiceId ?? "");
      if (!invoiceId) return null;
      const detail = await fetchInvoiceDetail(request, agencyId, invoiceId);
      const lineItems = detail.ok ? mapLineItems(detail.data.lineItems ?? []) : [];
      return toUiInvoice(row, lineItems, billingContactEmail, agencyName);
    }),
  );

  return NextResponse.json(enriched.filter(Boolean) as UiAgencyInvoice[]);
}

export async function createInvoiceHandler(request: NextRequest, ctx: RouteCtx) {
  const { agencyId } = await ctx.params;
  const body = (await request.json()) as {
    billingPeriod?: string;
    invoiceDate?: string;
    dueDate?: string;
    poNumber?: string;
    notes?: string;
    lineItems?: UiLineItem[];
  };

  const lineItems = body.lineItems ?? [];
  if (lineItems.length === 0) {
    return errorResponse(400, "At least one line item is required.");
  }
  if (lineItems.some((item) => !item.description.trim())) {
    return errorResponse(400, "All line items must have a description.");
  }

  const customerId = await resolveBillingCustomerId(request, agencyId);
  let resolvedCustomerId = customerId;
  if (!resolvedCustomerId) {
    const loaded = await loadBillingSummary(request, agencyId);
    if (!loaded.ok) return errorResponse(loaded.status, loaded.message);
    const ensured = await ensureBillingCustomerForAgency(request, agencyId, {
      agencyName: loaded.summary.agencyName,
      billingContactName: loaded.summary.billingContactName,
      billingContactEmail: loaded.summary.billingContactEmail,
    });
    if ("error" in ensured) return errorResponse(ensured.status, ensured.error);
    resolvedCustomerId = ensured.customerId;
  }

  const today = new Date().toISOString().slice(0, 10);
  const invoiceDate = body.invoiceDate ?? today;
  const dueDate = body.dueDate ?? addDaysIso(invoiceDate, 30);
  const billingPeriod = body.billingPeriod ?? invoiceDate.slice(0, 7);
  void billingPeriod;

  const created = await createInvoiceForAgency(request, agencyId, {
    customerId: resolvedCustomerId,
    invoiceDate,
    dueDate,
    poNumber: body.poNumber,
    notes: body.notes,
    lineItems,
  });

  if (!created.ok) return errorResponse(created.status, created.message);

  const summaryRes = await loadBillingSummary(request, agencyId);
  const billingContactEmail = summaryRes.ok ? summaryRes.summary.billingContactEmail : "";
  const agencyName = summaryRes.ok ? summaryRes.summary.agencyName : agencyId;

  return NextResponse.json(
    toUiInvoice(created.invoice, created.lineItems, billingContactEmail, agencyName),
    { status: 201 },
  );
}

export async function createFirstInvoiceHandler(request: NextRequest, ctx: RouteCtx) {
  try {
    const { agencyId } = await ctx.params;
    const body = (await request.json().catch(() => ({}))) as { send?: boolean };
    const shouldSend = body.send !== false;

    const loaded = await loadBillingSummary(request, agencyId);
    if (!loaded.ok) return errorResponse(loaded.status, loaded.message);

    const ensured = await ensureBillingCustomerForAgency(request, agencyId, {
      agencyName: loaded.summary.agencyName,
      billingContactName: loaded.summary.billingContactName,
      billingContactEmail: loaded.summary.billingContactEmail,
    });
    if ("error" in ensured) return errorResponse(ensured.status, ensured.error);

    const listRes = await upstreamBillingJson<{ items?: unknown[] }>(
      request,
      `/api/billing/invoices?${agencyQuery(agencyId)}`,
    );
    if (!listRes.ok) {
      return errorResponse(
        listRes.status,
        String(listRes.body.error ?? listRes.body.message ?? "Failed to check existing invoices"),
      );
    }
    if ((listRes.data.items ?? []).length > 0) {
      return errorResponse(409, "This agency already has invoices. Use Create invoice instead.");
    }

    const today = new Date().toISOString().slice(0, 10);
    const enabledAddOns = await loadEnabledAddOnRows(request, agencyId);
    const lineItems = buildAgencyInvoicePrefillLines(loaded.summary, enabledAddOns);

    const created = await createInvoiceForAgency(request, agencyId, {
      customerId: ensured.customerId,
      invoiceDate: today,
      dueDate: addDaysIso(today, 30),
      notes: "Initial platform invoice — created from Platform Command billing hub.",
      lineItems,
    });
    if (!created.ok) return errorResponse(created.status, created.message);

    const invoiceId = String(created.invoice.invoiceId ?? "");
    let sent = false;
    let sendError: string | undefined;
    if (shouldSend && invoiceId) {
      const sendResult = await sendInvoiceWithPdf(request, agencyId, invoiceId);
      if (sendResult.ok) {
        sent = true;
      } else {
        // Keep the draft — PDF/email failures must not look like a total create failure.
        sendError = sendResult.message;
        console.error("[createFirstInvoice] send failed; draft retained", {
          agencyId,
          invoiceId,
          sendError,
        });
      }
    }

    const uiInvoice = toUiInvoice(
      {
        ...created.invoice,
        ...(sent ? { status: "SENT", emailedAt: new Date().toISOString() } : {}),
      },
      created.lineItems,
      loaded.summary.billingContactEmail,
      loaded.summary.agencyName,
    );

    return NextResponse.json(
      {
        invoice: uiInvoice,
        billingCustomerAutoCreated: ensured.created,
        sent,
        ...(sendError
          ? {
              sendError,
              message: `Invoice saved as draft, but send failed: ${sendError}`,
            }
          : {}),
      },
      { status: 201 },
    );
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Unknown error";
    console.error("[createFirstInvoiceHandler]", detail);
    return errorResponse(500, `Failed to create first invoice: ${detail}`);
  }
}

export async function sendInvoiceHandler(request: NextRequest, ctx: InvoiceRouteCtx) {
  const { agencyId, invoiceId } = await ctx.params;
  const sent = await sendInvoiceWithPdf(request, agencyId, invoiceId);
  if (!sent.ok) return errorResponse(sent.status, sent.message);
  return NextResponse.json({ ok: true, invoiceId, status: "SENT" });
}

export async function markPaidHandler(request: NextRequest, ctx: InvoiceRouteCtx) {
  const { agencyId, invoiceId } = await ctx.params;
  const res = await upstreamBillingJson(
    request,
    `/api/billing/invoices/${encodeURIComponent(invoiceId)}/mark-paid?${agencyQuery(agencyId)}`,
    { method: "POST", body: JSON.stringify({}) },
  );
  if (!res.ok) {
    return errorResponse(res.status, String(res.body.error ?? "Failed to mark invoice paid"));
  }
  return NextResponse.json(res.data);
}

export async function voidInvoiceHandler(request: NextRequest, ctx: InvoiceRouteCtx) {
  const { agencyId, invoiceId } = await ctx.params;
  const res = await upstreamBillingJson(
    request,
    `/api/billing/invoices/${encodeURIComponent(invoiceId)}/void?${agencyQuery(agencyId)}`,
    { method: "POST", body: JSON.stringify({}) },
  );
  if (!res.ok) {
    return errorResponse(res.status, String(res.body.error ?? "Failed to void invoice"));
  }
  return NextResponse.json(res.data);
}

export async function downloadPdfHandler(request: NextRequest, ctx: InvoiceRouteCtx) {
  const { agencyId, invoiceId } = await ctx.params;
  const res = await upstreamBillingFetch(
    request,
    `/api/billing/invoices/${encodeURIComponent(invoiceId)}/pdf?${agencyQuery(agencyId)}`,
  );
  const text = await res.text();
  if (!res.ok) {
    let message = "Failed to retrieve PDF";
    try {
      const parsed = JSON.parse(text) as { error?: string };
      message = parsed.error ?? message;
    } catch {
      // ignore
    }
    return errorResponse(res.status, message);
  }

  let payload: { pdfUrl?: string } = {};
  try {
    payload = JSON.parse(text) as { pdfUrl?: string };
  } catch {
    return errorResponse(502, "Invalid PDF response from billing API");
  }

  if (payload.pdfUrl) {
    return NextResponse.redirect(payload.pdfUrl);
  }
  return errorResponse(404, "Invoice PDF not generated yet. Send the invoice first.");
}

export async function listAddOnsHandler(request: NextRequest, ctx: RouteCtx) {
  const { agencyId } = await ctx.params;
  const res = await upstreamBillingJson<{
    data?: { entitlements?: { addons?: Record<string, TenantAddonState> } };
  }>(request, `/api/admin/tenants/${encodeURIComponent(agencyId)}/entitlements`);
  if (!res.ok) {
    return errorResponse(res.status, String(res.body.error ?? "Failed to load add-ons"));
  }

  const addons = res.data.data?.entitlements?.addons ?? {};
  const rows = Object.entries(addons)
    .map(([key, state]) => mapAddonRow(key as AddonKey, state))
    .filter(Boolean) as FeatureAddOnRow[];

  return NextResponse.json(rows);
}

export async function updateAddOnsHandler(request: NextRequest, ctx: RouteCtx) {
  const { agencyId } = await ctx.params;
  const body = (await request.json()) as { add?: string[] };
  const codes = body.add ?? [];
  if (codes.length === 0) {
    return NextResponse.json({ ok: true, added: 0 });
  }

  let added = 0;
  for (const code of codes) {
    const res = await upstreamBillingJson(
      request,
      `/api/admin/tenants/${encodeURIComponent(agencyId)}/entitlements`,
      {
        method: "PATCH",
        body: JSON.stringify({ addonKey: code, enabled: true }),
      },
    );
    if (res.ok) added += 1;
  }

  return NextResponse.json({ ok: true, added });
}

export async function disableAddOnHandler(request: NextRequest, ctx: AddonRouteCtx) {
  const { agencyId, code } = await ctx.params;
  const res = await upstreamBillingJson(
    request,
    `/api/admin/tenants/${encodeURIComponent(agencyId)}/entitlements`,
    {
      method: "PATCH",
      body: JSON.stringify({ addonKey: code, enabled: false }),
    },
  );
  if (!res.ok) {
    return errorResponse(res.status, String(res.body.error ?? "Failed to disable add-on"));
  }
  return NextResponse.json({ ok: true, removed: code });
}

export function catalogAddOnRows(): FeatureAddOnRow[] {
  return ADDON_CATALOG.map((def) => ({
    id: def.key,
    name: def.name,
    category: def.category,
    description: def.description,
    unitPrice: addonUnitPrice(def),
    billingCycle: addonBillingCycle(def),
    status: "disabled" as const,
    serviceCode: def.key,
  }));
}
