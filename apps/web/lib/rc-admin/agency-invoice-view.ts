import { getPlanById } from "rapid-cortex-shared";

export type UiInvoiceStatus = "draft" | "sent" | "paid" | "void";

export type UiLineItem = {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
};

export type UiAgencyInvoice = {
  invoiceId: string;
  invoiceNumber: string;
  agencyId: string;
  agencyName: string;
  billingPeriod: string;
  invoiceDate: string;
  dueDate: string;
  status: UiInvoiceStatus;
  lineItems: UiLineItem[];
  subtotal: number;
  tax: number;
  total: number;
  poNumber?: string;
  billingContactEmail: string;
  pdfS3Key?: string;
  sentAt?: string;
  paidAt?: string;
  notes?: string;
};

export type AgencyBillingSummary = {
  agencyId: string;
  agencyName: string;
  billingContactEmail: string;
  billingContactName: string;
  plan: string;
  currentMonthlyRate: number;
  customerId?: string;
  /** True when the BFF auto-created a billing customer from agency contacts on this load. */
  billingCustomerAutoCreated?: boolean;
  /** Suggested create-invoice lines (plan + enabled add-ons) with resolved prices. */
  suggestedLineItems?: UiLineItem[];
};

/** Map display / legacy plan labels onto subscription catalog ids. */
function canonicalPlanCatalogId(plan: string): string {
  const raw = plan.trim().toLowerCase();
  const normalized = raw.replace(/[\s-]+/g, "_");
  const aliases: Record<string, string> = {
    rc_core: "essential",
    core: "essential",
    essential: "essential",
    starter: "essential",
    professional: "command",
    pro: "command",
    command: "command",
    enterprise: "enterprise_statewide",
    enterprise_statewide: "enterprise_statewide",
    statewide: "enterprise_statewide",
    rc_lite: "rc_lite",
    lite: "rc_lite",
  };
  return aliases[normalized] ?? aliases[raw] ?? normalized;
}

/** Monthly plan rate in USD major units for invoice drafts. */
export function resolveAgencyPlanMonthlyRate(
  summary: Pick<AgencyBillingSummary, "plan" | "currentMonthlyRate">,
): number {
  if (summary.currentMonthlyRate > 0) return Number(summary.currentMonthlyRate);
  const planDef = getPlanById(canonicalPlanCatalogId(summary.plan));
  if (planDef?.priceCentsMonthly != null) return planDef.priceCentsMonthly / 100;
  if (planDef?.startingPriceCentsMonthly != null) return planDef.startingPriceCentsMonthly / 100;
  return 1_999;
}

type PrefillAddOn = {
  id: string;
  name: string;
  unitPrice: number;
  billingCycle: "monthly" | "one_time";
  status?: "enabled" | "disabled";
};

/** Default invoice lines: assigned plan + enabled add-ons (editable in the create modal). */
export function buildAgencyInvoicePrefillLines(
  summary: Pick<AgencyBillingSummary, "plan" | "currentMonthlyRate">,
  addOns: PrefillAddOn[] = [],
): UiLineItem[] {
  const planPrice = resolveAgencyPlanMonthlyRate(summary);
  const planLabel = summary.plan?.trim() || "RC CORE";
  const lines: UiLineItem[] = [
    {
      id: "plan-monthly",
      description: `${planLabel} — monthly platform services`,
      quantity: 1,
      unitPrice: planPrice,
      total: planPrice,
    },
  ];

  for (const addon of addOns) {
    if (addon.status === "disabled") continue;
    const unitPrice = Number(addon.unitPrice) || 0;
    if (unitPrice <= 0) continue;
    const cadence = addon.billingCycle === "one_time" ? "one-time" : "monthly add-on";
    lines.push({
      id: `addon-${addon.id}`,
      description: `${addon.name} — ${cadence}`,
      quantity: 1,
      unitPrice,
      total: unitPrice,
    });
  }

  return lines;
}

export function mapInvoiceStatus(raw: unknown): UiInvoiceStatus {
  const s = String(raw ?? "DRAFT").toUpperCase();
  if (s === "CANCELED") return "void";
  if (s === "SENT") return "sent";
  if (s === "PAID") return "paid";
  if (s === "VOID") return "void";
  return "draft";
}

function lineTotal(quantity: number, unitPrice: number): number {
  return Number((quantity * unitPrice).toFixed(2));
}

export function mapLineItems(raw: unknown[]): UiLineItem[] {
  return raw.map((row, index) => {
    const item = row as Record<string, unknown>;
    const quantity = Number(item.quantity ?? 1);
    const unitPrice = Number(item.unitPrice ?? 0);
    const description =
      String(item.description ?? item.serviceName ?? "Service").trim() || "Service";
    const id = String(item.invoiceItemId ?? item.serviceId ?? `line-${index}`);
    return {
      id,
      description,
      quantity,
      unitPrice,
      total: Number(item.lineTotal ?? lineTotal(quantity, unitPrice)),
    };
  });
}

export function toUiInvoice(
  invoice: Record<string, unknown>,
  lineItems: UiLineItem[],
  billingContactEmail: string,
  agencyName: string,
): UiAgencyInvoice {
  const invoiceDate = String(invoice.invoiceDate ?? "").slice(0, 10);
  return {
    invoiceId: String(invoice.invoiceId ?? ""),
    invoiceNumber: String(invoice.invoiceNumber ?? invoice.invoiceId ?? ""),
    agencyId: String(invoice.agencyId ?? ""),
    agencyName,
    billingPeriod: invoiceDate.slice(0, 7) || new Date().toISOString().slice(0, 7),
    invoiceDate,
    dueDate: String(invoice.dueDate ?? "").slice(0, 10),
    status: mapInvoiceStatus(invoice.status),
    lineItems,
    subtotal: Number(invoice.subtotal ?? invoice.total ?? 0),
    tax: Number(invoice.tax ?? 0),
    total: Number(invoice.total ?? 0),
    poNumber: invoice.poNumber ? String(invoice.poNumber) : undefined,
    billingContactEmail,
    pdfS3Key: invoice.pdfS3Key ? String(invoice.pdfS3Key) : undefined,
    sentAt: invoice.emailedAt ? String(invoice.emailedAt) : undefined,
    paidAt: invoice.paidDate ? String(invoice.paidDate) : undefined,
    notes: invoice.notes ? String(invoice.notes) : undefined,
  };
}

export function uiLineItemsToCreatePayload(items: UiLineItem[]) {
  return items.map((item, index) => {
    const description = item.description.trim();
    const serviceName = description.split(" — ")[0]?.trim() || description || "Service";
    return {
      serviceName,
      description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      sortOrder: index,
    };
  });
}

export function addDaysIso(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
