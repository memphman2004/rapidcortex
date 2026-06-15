import { PutCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import type { BulkDraftInvoicesResult, UserContext } from "rapid-cortex-shared";
import { AUDIT_EVENT_TYPES } from "rapid-cortex-security";
import {
  buildAgencyLineItems,
  bulkDraftNotesTag,
} from "../billing/usage-to-line-items.js";
import { env } from "../lib/env.js";
import { makeId } from "../lib/ids.js";
import { AgencyRepository } from "../repositories/agencyRepository.js";
import { AuditRepository } from "../repositories/auditRepository.js";
import { ddb } from "../repositories/baseRepository.js";
import { BillingAuditService } from "./billingAuditService.js";
import { RcAdminUsageService, type RcAdminUsageCustomerRow } from "./rcAdminUsageService.js";

const usageSvc = new RcAdminUsageService();
const agencyRepo = new AgencyRepository();
const auditRepo = new AuditRepository();
const billingAudit = new BillingAuditService();

function nowIso(): string {
  return new Date().toISOString();
}

function addDays(dateIso: string, days: number): string {
  const d = new Date(dateIso);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function monthPrefix(dateIso: string): string {
  return dateIso.slice(0, 7);
}

async function nextInvoiceNumber(agencyId: string, invoiceDate: string): Promise<string> {
  const prefix = monthPrefix(invoiceDate);
  const out = await ddb.send(
    new ScanCommand({
      TableName: env.invoicesTable,
      FilterExpression: "agencyId = :agencyId",
      ExpressionAttributeValues: { ":agencyId": agencyId },
    }),
  );
  const items = (out.Items ?? []) as Array<{ invoiceNumber?: string }>;
  const max = items.reduce((m, row) => {
    const num = row.invoiceNumber ?? "";
    const match = num.match(/^RC-(\d{4}-\d{2})-(\d{4})$/);
    if (!match || match[1] !== prefix) return m;
    return Math.max(m, Number.parseInt(match[2] ?? "0", 10));
  }, 0);
  return `RC-${prefix}-${`${max + 1}`.padStart(4, "0")}`;
}

async function resolveBillingCustomerId(agencyId: string): Promise<string | null> {
  if (!env.customersTable) return null;
  const out = await ddb.send(
    new ScanCommand({
      TableName: env.customersTable,
      FilterExpression: "agencyId = :agencyId AND (attribute_not_exists(isDeleted) OR isDeleted = :false)",
      ExpressionAttributeValues: { ":agencyId": agencyId, ":false": false },
    }),
  );
  const first = (out.Items ?? [])[0] as { customerId?: string } | undefined;
  return first?.customerId ?? null;
}

async function draftExistsForPeriod(agencyId: string, yearMonth: string): Promise<boolean> {
  if (!env.invoicesTable) return false;
  const tag = bulkDraftNotesTag(yearMonth);
  const out = await ddb.send(
    new ScanCommand({
      TableName: env.invoicesTable,
      FilterExpression:
        "agencyId = :agencyId AND #s = :draft AND contains(notes, :tag)",
      ExpressionAttributeNames: { "#s": "status" },
      ExpressionAttributeValues: {
        ":agencyId": agencyId,
        ":draft": "DRAFT",
        ":tag": tag,
      },
    }),
  );
  return (out.Items ?? []).length > 0;
}

function groupByAgency(rows: RcAdminUsageCustomerRow[]): Map<string, RcAdminUsageCustomerRow[]> {
  const map = new Map<string, RcAdminUsageCustomerRow[]>();
  for (const row of rows) {
    const list = map.get(row.agencyId) ?? [];
    list.push(row);
    map.set(row.agencyId, list);
  }
  return map;
}

async function writeDraftInvoice(params: {
  user: UserContext;
  agencyId: string;
  agencyName: string;
  customerId: string;
  yearMonth: string;
  lineItems: ReturnType<typeof buildAgencyLineItems>;
}): Promise<{ invoiceId: string; total: number; lineItemCount: number }> {
  const t = nowIso();
  const invoiceDate = `${params.yearMonth}-01`;
  const dueDate = addDays(invoiceDate, 30);
  const invoiceId = makeId("inv");
  const invoiceNumber = await nextInvoiceNumber(params.agencyId, invoiceDate);
  const computedSubtotal = Number(
    params.lineItems.reduce((sum, li) => sum + li.quantity * li.unitPrice, 0).toFixed(2),
  );
  const notes = `RC Lite usage billing — ${params.yearMonth} (${bulkDraftNotesTag(params.yearMonth)})`;

  await ddb.send(
    new PutCommand({
      TableName: env.invoicesTable,
      Item: {
        invoiceId,
        agencyId: params.agencyId,
        customerId: params.customerId,
        invoiceNumber,
        status: "DRAFT",
        subtotal: computedSubtotal,
        discount: 0,
        tax: 0,
        total: computedSubtotal,
        currency: "USD",
        invoiceDate,
        dueDate,
        notes,
        createdBy: params.user.userId,
        createdAt: t,
        updatedAt: t,
      },
    }),
  );

  for (const [i, li] of params.lineItems.entries()) {
    await ddb.send(
      new PutCommand({
        TableName: env.invoiceItemsTable,
        Item: {
          invoiceItemId: makeId("invitem"),
          invoiceId,
          agencyId: params.agencyId,
          serviceName: li.serviceName,
          description: li.description,
          quantity: li.quantity,
          unitPrice: li.unitPrice,
          lineTotal: Number((li.quantity * li.unitPrice).toFixed(2)),
          sortOrder: li.sortOrder ?? i,
          createdAt: t,
        },
      }),
    );
  }

  await auditRepo.create({
    eventId: makeId("audit"),
    agencyId: params.agencyId,
    actorId: params.user.userId,
    type: AUDIT_EVENT_TYPES.BILLING_PROFILE_UPDATED,
    resourceType: "billing",
    resourceId: invoiceId,
    details: {
      action: "bulk_draft_invoice_created",
      invoiceNumber,
      yearMonth: params.yearMonth,
      status: "DRAFT",
    },
    createdAt: t,
  });
  await billingAudit.logBillingAction(
    "bulk_draft_invoice_created",
    "invoice",
    invoiceId,
    params.user.userId,
    { agencyId: params.agencyId, yearMonth: params.yearMonth, invoiceNumber },
  );

  return { invoiceId, total: computedSubtotal, lineItemCount: params.lineItems.length };
}

export class BulkDraftInvoicesService {
  async run(params: {
    user: UserContext;
    yearMonth: string;
    dryRun: boolean;
  }): Promise<BulkDraftInvoicesResult> {
    const { user, yearMonth, dryRun } = params;
    if (!env.invoicesTable || !env.invoiceItemsTable) {
      throw new Error("INVOICES_TABLE_NOT_CONFIGURED");
    }

    let usageRows: RcAdminUsageCustomerRow[] = [];
    try {
      usageRows = await usageSvc.listCustomersForMonth(yearMonth);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("RC_LITE_USAGE_TABLE_NOT_CONFIGURED")) {
        return {
          yearMonth,
          dryRun,
          created: 0,
          skipped: 0,
          errors: ["Usage table is not configured on this API stack."],
          invoices: [],
        };
      }
      throw err;
    }

    const byAgency = groupByAgency(usageRows);
    let created = 0;
    let skipped = 0;
    const errors: string[] = [];
    const invoices: BulkDraftInvoicesResult["invoices"] = [];

    for (const [agencyId, rows] of byAgency) {
      try {
        if (await draftExistsForPeriod(agencyId, yearMonth)) {
          skipped++;
          continue;
        }

        const customerId = await resolveBillingCustomerId(agencyId);
        if (!customerId) {
          skipped++;
          continue;
        }

        const agency = await agencyRepo.get(agencyId);
        const agencyName = agency?.name?.trim() || agencyId;
        const lineItems = buildAgencyLineItems(rows);
        if (lineItems.length === 0) {
          skipped++;
          continue;
        }

        const previewTotal = Number(
          lineItems.reduce((sum, li) => sum + li.quantity * li.unitPrice, 0).toFixed(2),
        );
        const previewId = dryRun ? `preview-${agencyId}-${yearMonth}` : makeId("inv");

        if (dryRun) {
          invoices.push({
            invoiceId: previewId,
            agencyId,
            agencyName,
            total: previewTotal,
            lineItemCount: lineItems.length,
          });
          created++;
          continue;
        }

        const written = await writeDraftInvoice({
          user,
          agencyId,
          agencyName,
          customerId,
          yearMonth,
          lineItems,
        });
        invoices.push({
          invoiceId: written.invoiceId,
          agencyId,
          agencyName,
          total: written.total,
          lineItemCount: written.lineItemCount,
        });
        created++;
      } catch (err) {
        errors.push(`${agencyId}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    return { yearMonth, dryRun, created, skipped, errors, invoices };
  }
}
