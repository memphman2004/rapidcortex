/**
 * Pure invoice calculation engine.
 * No AWS SDK dependencies — safe to import in web, tests, and Lambdas.
 * All monetary arithmetic uses integer cents except call overage (0.3¢), which is rounded.
 */

import {
  OVERAGE_RATES,
  PRICING_TABLE_VERSION,
  resolveTier,
} from "./pricing-table.js";
import type {
  AgencyBillingConfig,
  AutomatedInvoice,
  AutomatedInvoiceLine,
  InvoicePreviewResult,
  MonthlyUsageSnapshot,
} from "./invoice-types.js";

/** Calendar year/month for an automated invoice (not catalog cadence `BillingPeriod`). */
export interface InvoiceCalendarPeriod {
  year: number;
  month: number;
}

export interface ComputeInvoiceOptions {
  config: AgencyBillingConfig;
  usage: MonthlyUsageSnapshot;
  period: InvoiceCalendarPeriod;
  sequenceNumber: number;
  dryRun?: boolean;
}

const BILLING_TZ = "America/New_York";

export function computeInvoice(opts: ComputeInvoiceOptions): AutomatedInvoice {
  const { config, usage, period, sequenceNumber } = opts;

  const periodStr = formatBillingPeriod(period);
  const invoiceDate = lastDayOfMonth(period.year, period.month);
  const dueDate = addDays(invoiceDate, 30);

  const lines: AutomatedInvoiceLine[] = [];
  let sortOrder = 0;

  function addLine(partial: Omit<AutomatedInvoiceLine, "lineId" | "sortOrder">): void {
    lines.push({ lineId: newLineId(), sortOrder: ++sortOrder, ...partial });
  }

  const isEnterprise = config.planId === "enterprise";
  const tier = resolveTier(config.planId, config.contractedDispatcherSeats);

  let baseFeeCents: number;
  let tierLabel: string;
  let includedDispatcher: number;
  let includedAdmin: number;
  let includedCalls: number;
  let includedStorageGb: number;
  let dispatcherOverageCents: number;
  let adminOverageCents: number;

  if (isEnterprise) {
    if (!config.customMonthlyFeeCents) {
      throw new Error(`Enterprise agency ${config.agencyId} has no customMonthlyFeeCents`);
    }
    baseFeeCents = config.customMonthlyFeeCents;
    tierLabel = "Enterprise — Custom";
    includedDispatcher = config.contractedDispatcherSeats;
    includedAdmin = config.contractedAdminSeats;
    includedCalls = 999_999_999;
    includedStorageGb = 999_999_999;
    dispatcherOverageCents = config.customDispatcherOverageCents ?? 7500;
    adminOverageCents = 5000;
  } else {
    if (!tier) {
      throw new Error(
        `Cannot resolve tier for plan=${config.planId} seats=${config.contractedDispatcherSeats}`,
      );
    }
    baseFeeCents = tier.monthlyFeeCents;
    tierLabel = tier.label;
    includedDispatcher = tier.includedDispatcherSeats;
    includedAdmin = tier.includedAdminSeats;
    includedCalls = tier.includedCallVolume;
    includedStorageGb = tier.includedStorageGb;
    dispatcherOverageCents = tier.dispatcherSeatOverageCents;
    adminOverageCents = tier.adminSeatOverageCents;
  }

  const isProRated = isFirstBillingMonth(config.goLiveDate, period);
  let proRationFactor = 1;
  let proRationDays: number | undefined;
  const monthDays = daysInMonth(period.year, period.month);

  if (isProRated) {
    const live = parseIsoDateParts(config.goLiveDate);
    const daysActive = monthDays - live.day + 1;
    proRationFactor = daysActive / monthDays;
    proRationDays = daysActive;
  }

  const adjustedBase = roundCents(baseFeeCents * proRationFactor);

  addLine({
    category: "base_subscription",
    description: `${tierLabel} — Base subscription${
      isProRated ? ` (pro-rated ${proRationDays}/${monthDays} days)` : ""
    }`,
    quantity: isProRated ? proRationDays! : 1,
    unitLabel: isProRated ? "day" : "month",
    unitPriceCents: isProRated ? roundCents(baseFeeCents / monthDays) : baseFeeCents,
    amountCents: adjustedBase,
  });

  const extraDispatcher = Math.max(0, usage.activeDispatcherSeats - includedDispatcher);
  if (extraDispatcher > 0) {
    addLine({
      category: "seat_overage",
      description: `Dispatcher seat overage (${usage.activeDispatcherSeats} active, ${includedDispatcher} included)`,
      quantity: extraDispatcher,
      unitLabel: "seat/mo",
      unitPriceCents: dispatcherOverageCents,
      amountCents: extraDispatcher * dispatcherOverageCents,
    });
  }

  const extraAdmin = Math.max(0, usage.activeAdminSeats - includedAdmin);
  if (extraAdmin > 0) {
    addLine({
      category: "seat_overage",
      description: `Admin/supervisor seat overage (${usage.activeAdminSeats} active, ${includedAdmin} included)`,
      quantity: extraAdmin,
      unitLabel: "seat/mo",
      unitPriceCents: adminOverageCents,
      amountCents: extraAdmin * adminOverageCents,
    });
  }

  const extraCalls = Math.max(0, usage.totalCallsProcessed - includedCalls);
  if (extraCalls > 0) {
    const callOverageCents = roundCents(extraCalls * OVERAGE_RATES.callsPerCallCents);
    addLine({
      category: "usage_overage",
      description: `Call volume overage (${usage.totalCallsProcessed.toLocaleString()} calls, ${includedCalls.toLocaleString()} included)`,
      quantity: extraCalls,
      unitLabel: "call",
      unitPriceCents: OVERAGE_RATES.callsPerCallCents,
      amountCents: callOverageCents,
    });
  }

  const extraStorageGb = Math.max(0, usage.storageGb - includedStorageGb);
  if (extraStorageGb > 0) {
    addLine({
      category: "usage_overage",
      description: `Storage overage (${usage.storageGb.toFixed(1)} GB, ${includedStorageGb} GB included)`,
      quantity: extraStorageGb,
      unitLabel: "GB/mo",
      unitPriceCents: OVERAGE_RATES.storagePerGbCents,
      amountCents: Math.ceil(extraStorageGb) * OVERAGE_RATES.storagePerGbCents,
    });
  }

  if (usage.transcriptionMinutes > 0 && !isEnterprise && config.planId === "essential") {
    const tranCents = roundCents(usage.transcriptionMinutes * OVERAGE_RATES.transcriptionPerMinuteCents);
    if (tranCents > 0) {
      addLine({
        category: "usage_overage",
        description: `Transcription overage (${usage.transcriptionMinutes.toLocaleString()} min)`,
        quantity: usage.transcriptionMinutes,
        unitLabel: "min",
        unitPriceCents: OVERAGE_RATES.transcriptionPerMinuteCents,
        amountCents: tranCents,
      });
    }
  }

  if (usage.translationRequests > 0 && config.planId === "essential") {
    const transCents = roundCents(usage.translationRequests * OVERAGE_RATES.translationPerRequestCents);
    if (transCents > 0) {
      addLine({
        category: "usage_overage",
        description: `Translation request overage (${usage.translationRequests.toLocaleString()} requests)`,
        quantity: usage.translationRequests,
        unitLabel: "request",
        unitPriceCents: OVERAGE_RATES.translationPerRequestCents,
        amountCents: transCents,
      });
    }
  }

  if (usage.archiveStorageGb > 0) {
    addLine({
      category: "usage_overage",
      description: `Archive storage (${usage.archiveStorageGb.toFixed(1)} GB)`,
      quantity: Math.ceil(usage.archiveStorageGb),
      unitLabel: "GB/mo",
      unitPriceCents: OVERAGE_RATES.archiveStoragePerGbCents,
      amountCents: Math.ceil(usage.archiveStorageGb) * OVERAGE_RATES.archiveStoragePerGbCents,
    });
  }

  if (usage.dataExportGb > 0) {
    addLine({
      category: "usage_overage",
      description: `Data export (${usage.dataExportGb.toFixed(2)} GB)`,
      quantity: Math.ceil(usage.dataExportGb),
      unitLabel: "GB",
      unitPriceCents: OVERAGE_RATES.dataExportPerGbCents,
      amountCents: Math.ceil(usage.dataExportGb) * OVERAGE_RATES.dataExportPerGbCents,
    });
  }

  const extraPhotoBlocks = Math.max(0, Math.floor(usage.photosCount / 100));
  if (extraPhotoBlocks > 0 && !isEnterprise) {
    addLine({
      category: "usage_overage",
      description: `Photo storage (${usage.photosCount.toLocaleString()} photos)`,
      quantity: extraPhotoBlocks,
      unitLabel: "100 photos",
      unitPriceCents: OVERAGE_RATES.photosPer100Cents,
      amountCents: extraPhotoBlocks * OVERAGE_RATES.photosPer100Cents,
    });
  }

  const activeAddons = config.addons.filter((a) => !a.disabledAt);
  for (const addon of activeAddons) {
    const adjustedAddonFee = roundCents(addon.monthlyFeeCents * proRationFactor);
    addLine({
      category: "addon",
      description: addon.label,
      quantity: 1,
      unitLabel: "month",
      unitPriceCents: addon.monthlyFeeCents,
      amountCents: adjustedAddonFee,
    });
  }

  const mrcSubtotal = lines
    .filter((l) => l.category !== "discount" && l.category !== "one_time")
    .reduce((acc, l) => acc + l.amountCents, 0);
  const addonSubtotal = lines.filter((l) => l.category === "addon").reduce((acc, l) => acc + l.amountCents, 0);

  const invoiceInstant = new Date(`${invoiceDate}T12:00:00Z`);
  const activeDiscounts = config.discounts.filter(
    (d) => !d.expiresAt || new Date(d.expiresAt) >= invoiceInstant,
  );

  let bundleApplied = false;
  let totalDiscountCents = 0;

  for (const discount of activeDiscounts) {
    const basisPoints = discount.basisPoints;
    const applyTo =
      discount.appliesTo === "addons" ? addonSubtotal : mrcSubtotal;

    const discountAmt = roundCents((applyTo * basisPoints) / 10000);
    if (discountAmt <= 0) continue;

    if (discount.type === "bundleAddon3Plus") {
      if (bundleApplied) continue;
      if (activeAddons.length < 3) continue;
      bundleApplied = true;
    }

    totalDiscountCents += discountAmt;
    addLine({
      category: "discount",
      description: `Discount: ${discount.label} (${(basisPoints / 100).toFixed(0)}% off ${discount.appliesTo})`,
      quantity: 1,
      unitLabel: "discount",
      unitPriceCents: -discountAmt,
      amountCents: -discountAmt,
    });
  }

  const subtotalCents = lines.filter((l) => l.amountCents > 0).reduce((acc, l) => acc + l.amountCents, 0);
  const discountCents = totalDiscountCents;
  const totalCents = Math.max(0, subtotalCents - discountCents);

  const seqStr = String(sequenceNumber).padStart(4, "0");
  const agencySlug = config.agencyId.slice(0, 10).toUpperCase().replace(/[^A-Z0-9]/g, "");
  const invoiceId = `INV-${period.year}${String(period.month).padStart(2, "0")}-${agencySlug}-${seqStr}`;

  const now = new Date().toISOString();

  return {
    invoiceId,
    agencyId: config.agencyId,
    agencyName: config.agencyName,
    billingPeriod: periodStr,
    invoiceDate,
    dueDate,
    billingContactEmail: config.billingContactEmail,
    billingContactName: config.billingContactName,
    poNumber: config.poNumber,
    paymentMethod: config.paymentMethod,
    planId: config.planId,
    planLabel: config.planId.charAt(0).toUpperCase() + config.planId.slice(1),
    tierLabel,
    lines,
    subtotalCents,
    discountCents,
    totalCents,
    pricingVersion: PRICING_TABLE_VERSION,
    status: "draft",
    sequenceNumber,
    proRated: isProRated,
    proRationDays,
    proRationTotal: isProRated ? adjustedBase : undefined,
    createdAt: now,
    updatedAt: now,
    ttl: Math.floor(Date.now() / 1000) + 2555 * 86400,
  };
}

export function previewInvoice(
  config: AgencyBillingConfig,
  usage: MonthlyUsageSnapshot,
  period: InvoiceCalendarPeriod,
): InvoicePreviewResult {
  const warnings: string[] = [];

  if (!usage.snapshotAt) {
    warnings.push("No usage snapshot found — using zero usage. Actual invoice may differ.");
  }

  const invoice = computeInvoice({
    config,
    usage,
    period,
    sequenceNumber: 9999,
    dryRun: true,
  });

  return { invoice, warnings };
}

export function formatBillingPeriod(period: InvoiceCalendarPeriod): string {
  return `${period.year}-${String(period.month).padStart(2, "0")}`;
}

export function parseBillingPeriod(period: string): InvoiceCalendarPeriod {
  const [year, month] = period.split("-").map((p) => Number(p));
  if (!year || !month || month < 1 || month > 12) {
    throw new Error(`Invalid billing period: ${period}`);
  }
  return { year, month };
}

/** Calendar date in a named IANA zone — used so last-day billing stays on the ET month. */
export function calendarDateInTimeZone(
  timeZone: string = BILLING_TZ,
  now: Date = new Date(),
): { year: number; month: number; day: number } {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = Object.fromEntries(fmt.formatToParts(now).map((p) => [p.type, p.value]));
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
  };
}

export function currentBillingPeriodEt(now: Date = new Date()): InvoiceCalendarPeriod {
  const d = calendarDateInTimeZone(BILLING_TZ, now);
  return { year: d.year, month: d.month };
}

export function emptyUsageSnapshot(
  agencyId: string,
  billingPeriod: string,
  seats: { dispatcher: number; admin: number },
): MonthlyUsageSnapshot {
  return {
    agencyId,
    billingPeriod,
    activeDispatcherSeats: seats.dispatcher,
    activeAdminSeats: seats.admin,
    totalCallsProcessed: 0,
    transcriptionMinutes: 0,
    translationRequests: 0,
    storageGb: 0,
    archiveStorageGb: 0,
    photosCount: 0,
    dataExportGb: 0,
    snapshotAt: "",
    source: "auto",
  };
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function lastDayOfMonth(year: number, month: number): string {
  const d = daysInMonth(year, month);
  return `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function addDays(isoDate: string, days: number): string {
  const { year, month, day } = parseIsoDateParts(isoDate);
  const d = new Date(Date.UTC(year, month - 1, day + days));
  return d.toISOString().slice(0, 10);
}

function isFirstBillingMonth(goLiveDate: string, period: InvoiceCalendarPeriod): boolean {
  const live = parseIsoDateParts(goLiveDate);
  return live.year === period.year && live.month === period.month;
}

function parseIsoDateParts(isoDate: string): { year: number; month: number; day: number } {
  const [year, month, day] = isoDate.slice(0, 10).split("-").map((x) => Number(x));
  return { year, month, day };
}

function roundCents(n: number): number {
  return Math.round(n);
}

function newLineId(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  return `ln-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
