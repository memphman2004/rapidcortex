import { GetCommand, PutCommand, QueryCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import type { MonetizationInvoiceRecord } from "rapid-cortex-shared";
import { env } from "../lib/env.js";
import { ddb } from "./baseRepository.js";

export type AdminInvoiceListFilters = {
  limit?: number;
  status?: string;
  agencyId?: string;
  search?: string;
  from?: string;
  to?: string;
};

function normalizeStatus(value: string): string {
  return value.trim().toLowerCase();
}

function isOverdue(row: MonetizationInvoiceRecord, now = new Date()): boolean {
  const status = normalizeStatus(row.status);
  if (status === "paid" || status === "void" || status === "canceled") return false;
  if (!row.dueDate) return false;
  const due = new Date(row.dueDate);
  return !Number.isNaN(due.getTime()) && due.getTime() < now.getTime();
}

function matchesStatusFilter(row: MonetizationInvoiceRecord, status: string): boolean {
  const filter = normalizeStatus(status);
  if (filter === "all") return true;
  if (filter === "overdue") return isOverdue(row);
  return normalizeStatus(row.status) === filter;
}

function matchesSearch(row: MonetizationInvoiceRecord, search: string): boolean {
  const q = search.trim().toLowerCase();
  if (!q) return true;
  return (
    row.invoiceId.toLowerCase().includes(q) ||
    (row.invoiceNumber ?? "").toLowerCase().includes(q) ||
    row.agencyId.toLowerCase().includes(q) ||
    (row.purchaseOrderNumber ?? "").toLowerCase().includes(q)
  );
}

function matchesDateRange(row: MonetizationInvoiceRecord, from?: string, to?: string): boolean {
  const created = row.createdAt?.slice(0, 10) ?? "";
  if (from && created < from) return false;
  if (to && created > to) return false;
  return true;
}

export class MonetizationInvoiceRepository {
  private table(): string {
    const t = env.monetizationInvoicesTable;
    if (!t) throw new Error("MONETIZATION_INVOICES_DISABLED");
    return t;
  }

  async put(row: MonetizationInvoiceRecord): Promise<void> {
    await ddb.send(new PutCommand({ TableName: this.table(), Item: row }));
  }

  async get(invoiceId: string): Promise<MonetizationInvoiceRecord | null> {
    const res = await ddb.send(new GetCommand({ TableName: this.table(), Key: { invoiceId } }));
    return (res.Item as MonetizationInvoiceRecord | undefined) ?? null;
  }

  async listByAgencyRecent(agencyId: string, limit = 48): Promise<MonetizationInvoiceRecord[]> {
    const res = await ddb.send(
      new QueryCommand({
        TableName: this.table(),
        IndexName: "agencyId-createdAt-index",
        KeyConditionExpression: "agencyId = :a",
        ExpressionAttributeValues: { ":a": agencyId },
        ScanIndexForward: false,
        Limit: limit,
      }),
    );
    return (res.Items as MonetizationInvoiceRecord[]) ?? [];
  }

  async listForFinanceAdmin(filters: AdminInvoiceListFilters = {}): Promise<MonetizationInvoiceRecord[]> {
    const limit = Math.min(filters.limit ?? 50, 100);
    const status = filters.status ?? "all";
    const fetchCap = Math.min(limit * 5, 500);
    const res = await ddb.send(
      new ScanCommand({
        TableName: this.table(),
        Limit: fetchCap,
      }),
    );
    let items = ((res.Items as MonetizationInvoiceRecord[]) ?? []).filter((row) => {
      if (filters.agencyId && row.agencyId !== filters.agencyId) return false;
      if (!matchesStatusFilter(row, status)) return false;
      if (!matchesSearch(row, filters.search ?? "")) return false;
      if (!matchesDateRange(row, filters.from, filters.to)) return false;
      return true;
    });
    items.sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
    return items.slice(0, limit);
  }

  async updateInvoice(
    invoiceId: string,
    agencyId: string,
    patch: Partial<Pick<MonetizationInvoiceRecord, "status" | "purchaseOrderNumber" | "dueDate" | "paidAt">>,
  ): Promise<MonetizationInvoiceRecord> {
    const existing = await this.get(invoiceId);
    if (!existing || existing.agencyId !== agencyId) {
      const err = new Error("INVOICE_NOT_FOUND");
      throw err;
    }
    const updated: MonetizationInvoiceRecord = {
      ...existing,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    await this.put(updated);
    return updated;
  }
}
