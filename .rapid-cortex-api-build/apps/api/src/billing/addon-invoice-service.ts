import { GetCommand, PutCommand, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import {
  addonCatalogPriceCents,
  getAddonByKey,
  type AddonKey,
  type BillingType,
  type InvoiceLineItemDelta,
} from "rapid-cortex-shared";
import { env } from "../lib/env.js";
import { makeId } from "../lib/ids.js";
import { ddb } from "../repositories/baseRepository.js";

type InvoiceRow = {
  invoiceId: string;
  agencyId: string;
  status: string;
  subtotal?: number;
  discount?: number;
  tax?: number;
  total?: number;
  invoiceDate?: string;
  dueDate?: string;
  addonLineItems?: Array<Record<string, unknown>>;
  updatedAt?: string;
};

function nowIso(): string {
  return new Date().toISOString();
}

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function billingCycleBounds(anchorDay: number, at = new Date()): {
  cycleStart: Date;
  cycleEnd: Date;
  daysInCycle: number;
  daysRemaining: number;
} {
  const year = at.getUTCFullYear();
  const month = at.getUTCMonth();
  const day = at.getUTCDate();
  const dim = daysInMonth(year, month);
  const startDay = Math.min(Math.max(1, anchorDay), dim);
  let cycleStart = new Date(Date.UTC(year, month, startDay));
  if (day < startDay) {
    const prevMonth = month === 0 ? 11 : month - 1;
    const prevYear = month === 0 ? year - 1 : year;
    const prevDim = daysInMonth(prevYear, prevMonth);
    const prevStart = Math.min(Math.max(1, anchorDay), prevDim);
    cycleStart = new Date(Date.UTC(prevYear, prevMonth, prevStart));
  }
  const nextMonth = cycleStart.getUTCMonth() === 11 ? 0 : cycleStart.getUTCMonth() + 1;
  const nextYear = cycleStart.getUTCMonth() === 11 ? cycleStart.getUTCFullYear() + 1 : cycleStart.getUTCFullYear();
  const nextDim = daysInMonth(nextYear, nextMonth);
  const nextStartDay = Math.min(Math.max(1, anchorDay), nextDim);
  const cycleEnd = new Date(Date.UTC(nextYear, nextMonth, nextStartDay));
  const msPerDay = 86_400_000;
  const daysInCycle = Math.max(1, Math.round((cycleEnd.getTime() - cycleStart.getTime()) / msPerDay));
  const daysRemaining = Math.max(0, Math.round((cycleEnd.getTime() - at.getTime()) / msPerDay));
  return { cycleStart, cycleEnd, daysInCycle, daysRemaining };
}

function computeProRataCents(monthlyCents: number, daysRemaining: number, daysInCycle: number): number {
  if (monthlyCents <= 0 || daysRemaining <= 0) return 0;
  return Math.round((monthlyCents * daysRemaining) / daysInCycle);
}

export class AddonInvoiceService {
  private lineItemId(tenantId: string, addonKey: AddonKey): string {
    return `addon#${tenantId}#${addonKey}`;
  }

  async applyAddonChange(
    tenantId: string,
    addonKey: AddonKey,
    enabled: boolean,
    billingType: BillingType,
    overridePriceCents: number | undefined,
    forceImmediateDisable: boolean,
  ): Promise<{ invoiceId: string; lineItemId: string; proRataAmount: number; delta: InvoiceLineItemDelta }> {
    const def = getAddonByKey(addonKey);
    const catalogCents = addonCatalogPriceCents(def);
    const monthlyCents = overridePriceCents ?? catalogCents;
    const lineItemId = this.lineItemId(tenantId, addonKey);
    const { daysInCycle, daysRemaining } = billingCycleBounds(1);
    const previousItem = await this.getLineItem(lineItemId);
    const previousMonthlyCents = previousItem
      ? Math.round(Number(previousItem.unitPrice ?? 0) * 100)
      : 0;

    let newMonthlyCents = enabled ? monthlyCents : 0;
    let proRataCents = 0;
    if (enabled && billingType === "monthly") {
      proRataCents = computeProRataCents(newMonthlyCents, daysRemaining, daysInCycle);
    } else if (!enabled && billingType === "one_time") {
      newMonthlyCents = 0;
    } else if (!enabled && forceImmediateDisable && billingType === "monthly") {
      proRataCents = -computeProRataCents(previousMonthlyCents, daysRemaining, daysInCycle);
    }

    const invoice = await this.ensureOpenInvoice(tenantId);
    const unitPrice = newMonthlyCents / 100;
    const quantity = 1;
    const amount = Number((quantity * unitPrice).toFixed(2));

    await ddb.send(
      new PutCommand({
        TableName: env.invoiceItemsTable,
        Item: {
          invoiceItemId: lineItemId,
          invoiceId: invoice.invoiceId,
          agencyId: tenantId,
          description: def.name,
          quantity,
          unitPrice,
          amount,
          status: enabled ? "active" : "removed",
          kind: billingType === "one_time" ? "one_time_fee" : "subscription",
          addonKey,
          updatedAt: nowIso(),
        },
      }),
    );

    if (proRataCents !== 0) {
      const adjId = `${lineItemId}#prorata#${Date.now()}`;
      await ddb.send(
        new PutCommand({
          TableName: env.invoiceItemsTable,
          Item: {
            invoiceItemId: adjId,
            invoiceId: invoice.invoiceId,
            agencyId: tenantId,
            description: `Pro-rated adjustment (${daysRemaining} days) — ${def.name}`,
            quantity: 1,
            unitPrice: proRataCents / 100,
            amount: proRataCents / 100,
            status: "active",
            kind: "adjustment",
            addonKey,
            updatedAt: nowIso(),
          },
        }),
      );
    }

    await this.recalculateInvoiceTotals(invoice.invoiceId, tenantId);

    const delta: InvoiceLineItemDelta = {
      lineItemId,
      description: def.name,
      previousMonthlyAmountCents: previousMonthlyCents,
      newMonthlyAmountCents: newMonthlyCents,
      deltaMonthlyAmountCents: newMonthlyCents - previousMonthlyCents,
      proRataAdjustmentCents: proRataCents,
      billingType,
      effectiveDate: nowIso(),
    };

    return {
      invoiceId: invoice.invoiceId,
      lineItemId,
      proRataAmount: proRataCents / 100,
      delta,
    };
  }

  private async getLineItem(lineItemId: string): Promise<{ unitPrice?: number } | null> {
    const out = await ddb.send(
      new GetCommand({
        TableName: env.invoiceItemsTable,
        Key: { invoiceItemId: lineItemId },
      }),
    );
    return (out.Item as { unitPrice?: number } | undefined) ?? null;
  }

  private async ensureOpenInvoice(tenantId: string): Promise<InvoiceRow> {
    const existing = await this.findDraftInvoice(tenantId);
    if (existing) return existing;
    const t = nowIso();
    const invoiceId = makeId("inv");
    const due = new Date();
    due.setUTCDate(due.getUTCDate() + 30);
    const row: InvoiceRow = {
      invoiceId,
      agencyId: tenantId,
      status: "DRAFT",
      subtotal: 0,
      discount: 0,
      tax: 0,
      total: 0,
      invoiceDate: t.slice(0, 10),
      dueDate: due.toISOString().slice(0, 10),
      addonLineItems: [],
      updatedAt: t,
    };
    await ddb.send(
      new PutCommand({
        TableName: env.invoicesTable,
        Item: row,
      }),
    );
    return row;
  }

  private async findDraftInvoice(tenantId: string): Promise<InvoiceRow | null> {
    const out = await ddb.send(
      new QueryCommand({
        TableName: env.invoicesTable,
        IndexName: "status-dueDate-index",
        KeyConditionExpression: "#s = :draft",
        ExpressionAttributeNames: { "#s": "status" },
        ExpressionAttributeValues: { ":draft": "DRAFT" },
        Limit: 50,
      }),
    );
    const items = (out.Items as InvoiceRow[] | undefined) ?? [];
    return items.find((i) => i.agencyId === tenantId) ?? null;
  }

  private async recalculateInvoiceTotals(invoiceId: string, agencyId: string): Promise<void> {
    const itemsOut = await ddb.send(
      new QueryCommand({
        TableName: env.invoiceItemsTable,
        IndexName: "invoiceId-index",
        KeyConditionExpression: "invoiceId = :i",
        ExpressionAttributeValues: { ":i": invoiceId },
      }),
    );
    const items = ((itemsOut.Items ?? []) as Array<{ agencyId?: string; amount?: number; status?: string }>).filter(
      (x) => x.agencyId === agencyId && x.status !== "removed",
    );
    const subtotal = Number(items.reduce((sum, row) => sum + Number(row.amount ?? 0), 0).toFixed(2));
    await ddb.send(
      new UpdateCommand({
        TableName: env.invoicesTable,
        Key: { invoiceId },
        UpdateExpression: "SET subtotal = :s, #total = :t, updatedAt = :u",
        ExpressionAttributeNames: { "#total": "total" },
        ExpressionAttributeValues: {
          ":s": subtotal,
          ":t": subtotal,
          ":u": nowIso(),
        },
      }),
    );
  }

  async getCurrentOpenInvoice(tenantId: string): Promise<InvoiceRow | null> {
    return this.findDraftInvoice(tenantId);
  }
}
