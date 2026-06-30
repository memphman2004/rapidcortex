import { PutCommand } from "@aws-sdk/lib-dynamodb";
import type { ContactSalesLeadBody } from "rapid-cortex-shared";
import { env } from "../lib/env.js";
import { ddb } from "./baseRepository.js";

export type SalesLeadRecord = ContactSalesLeadBody & {
  leadId: string;
  createdAt: string;
};

export type RingWaitlistLeadRecord = {
  leadId: string;
  email: string;
  source: string;
  requestedState?: string | null;
  requestedCity?: string | null;
  createdAt: string;
};

export class SalesLeadRepository {
  async putLead(lead: SalesLeadRecord): Promise<void> {
    const t = env.salesLeadsTable;
    if (!t) throw new Error("SALES_LEADS_TABLE not configured");
    await ddb.send(new PutCommand({ TableName: t, Item: lead }));
  }

  async putRingWaitlistLead(lead: RingWaitlistLeadRecord): Promise<void> {
    const t = env.salesLeadsTable;
    if (!t) throw new Error("SALES_LEADS_TABLE not configured");
    await ddb.send(new PutCommand({ TableName: t, Item: lead }));
  }
}
