import { GetCommand, PutCommand, ScanCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import type { ContactSalesLeadBody, SalesLeadStatus } from "rapid-cortex-shared";
import { env } from "../lib/env.js";
import { ddb } from "./baseRepository.js";

export type SalesLeadRecord = ContactSalesLeadBody & {
  leadId: string;
  createdAt: string;
  /** Ingest channel — contact-sales form vs Ring waitlist, etc. */
  source?: string;
  status?: SalesLeadStatus;
  notes?: string;
  assignee?: string;
  updatedAt?: string;
  updatedBy?: string;
};

export type RingWaitlistLeadRecord = {
  leadId: string;
  email: string;
  source: string;
  requestedState?: string | null;
  requestedCity?: string | null;
  createdAt: string;
  status?: SalesLeadStatus;
  notes?: string;
  assignee?: string;
  updatedAt?: string;
  updatedBy?: string;
};

export type AnySalesLeadRecord = SalesLeadRecord | RingWaitlistLeadRecord;

function table(): string {
  const t = env.salesLeadsTable?.trim();
  if (!t) throw new Error("SALES_LEADS_TABLE_NOT_CONFIGURED");
  return t;
}

function sortByCreatedDesc(items: AnySalesLeadRecord[]): AnySalesLeadRecord[] {
  return items.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

export class SalesLeadRepository {
  async putLead(lead: SalesLeadRecord): Promise<void> {
    await ddb.send(
      new PutCommand({
        TableName: table(),
        Item: {
          ...lead,
          source: lead.source ?? "contact-sales",
          status: lead.status ?? "new",
        },
      }),
    );
  }

  async putRingWaitlistLead(lead: RingWaitlistLeadRecord): Promise<void> {
    await ddb.send(
      new PutCommand({
        TableName: table(),
        Item: {
          ...lead,
          status: lead.status ?? "new",
        },
      }),
    );
  }

  async getById(leadId: string): Promise<AnySalesLeadRecord | null> {
    const out = await ddb.send(
      new GetCommand({
        TableName: table(),
        Key: { leadId },
      }),
    );
    return (out.Item as AnySalesLeadRecord | undefined) ?? null;
  }

  /**
   * Scan-based inbox (table has PK=leadId only; no createdAt GSI yet).
   * Caps page size for RC Admin CRM; newest first.
   */
  async listRecent(limit = 200): Promise<AnySalesLeadRecord[]> {
    const max = Math.min(Math.max(limit, 1), 500);
    const items: AnySalesLeadRecord[] = [];
    let exclusiveStartKey: Record<string, unknown> | undefined;

    do {
      const out = await ddb.send(
        new ScanCommand({
          TableName: table(),
          ExclusiveStartKey: exclusiveStartKey,
          Limit: Math.min(100, max - items.length),
        }),
      );
      for (const item of out.Items ?? []) {
        items.push(item as AnySalesLeadRecord);
      }
      exclusiveStartKey = out.LastEvaluatedKey as Record<string, unknown> | undefined;
    } while (exclusiveStartKey && items.length < max);

    return sortByCreatedDesc(items).slice(0, max);
  }

  async updateCrmFields(
    leadId: string,
    patch: {
      status?: SalesLeadStatus;
      notes?: string;
      assignee?: string;
      updatedBy: string;
    },
  ): Promise<AnySalesLeadRecord | null> {
    const existing = await this.getById(leadId);
    if (!existing) return null;

    const now = new Date().toISOString();
    const sets: string[] = ["updatedAt = :updatedAt", "updatedBy = :updatedBy"];
    const values: Record<string, unknown> = {
      ":updatedAt": now,
      ":updatedBy": patch.updatedBy,
    };

    if (patch.status !== undefined) {
      sets.push("#status = :status");
      values[":status"] = patch.status;
    }
    if (patch.notes !== undefined) {
      sets.push("notes = :notes");
      values[":notes"] = patch.notes;
    }
    if (patch.assignee !== undefined) {
      sets.push("assignee = :assignee");
      values[":assignee"] = patch.assignee;
    }

    await ddb.send(
      new UpdateCommand({
        TableName: table(),
        Key: { leadId },
        UpdateExpression: `SET ${sets.join(", ")}`,
        ExpressionAttributeNames: patch.status !== undefined ? { "#status": "status" } : undefined,
        ExpressionAttributeValues: values,
        ConditionExpression: "attribute_exists(leadId)",
      }),
    );

    return this.getById(leadId);
  }
}
