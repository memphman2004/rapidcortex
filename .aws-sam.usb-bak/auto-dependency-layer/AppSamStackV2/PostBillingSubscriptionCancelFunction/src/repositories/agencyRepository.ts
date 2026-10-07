import { GetCommand, PutCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import type { AgencyTenant } from "rapid-cortex-shared";
import { ddb } from "./baseRepository.js";
import { env } from "../lib/env.js";

/** Map legacy Dynamo attribute names onto the neutral billing fields Rapid Cortex exposes. */
export function normalizeAgencyItem(raw: Record<string, unknown>): AgencyTenant {
  const base = { ...raw };
  const customerRef =
    (base.externalBillingCustomerId as string | undefined) ??
    (base.stripeCustomerId as string | undefined) ??
    (base.squareCustomerId as string | undefined);
  const subscriptionRef =
    (base.externalBillingSubscriptionId as string | undefined) ??
    (base.stripeSubscriptionId as string | undefined) ??
    (base.squareSubscriptionId as string | undefined);
  delete base.stripeCustomerId;
  delete base.stripeSubscriptionId;
  delete base.squareCustomerId;
  delete base.squareSubscriptionId;

  let paymentMethod = base.paymentMethod as AgencyTenant["paymentMethod"] | string | undefined;
  if (paymentMethod === "stripe") {
    paymentMethod = "invoice";
  }

  if (customerRef) base.externalBillingCustomerId = customerRef;
  if (subscriptionRef) base.externalBillingSubscriptionId = subscriptionRef;
  base.paymentMethod = paymentMethod;

  return base as unknown as AgencyTenant;
}

export function agencyItemForPersist(agency: AgencyTenant): Record<string, unknown> {
  const out: Record<string, unknown> = { ...agency };
  return out;
}

export class AgencyRepository {
  async put(agency: AgencyTenant): Promise<void> {
    await ddb.send(
      new PutCommand({
        TableName: env.agenciesTable,
        Item: agencyItemForPersist(agency),
      }),
    );
  }

  async get(agencyId: string): Promise<AgencyTenant | null> {
    const res = await ddb.send(
      new GetCommand({
        TableName: env.agenciesTable,
        Key: { agencyId },
      }),
    );
    const item = res.Item as Record<string, unknown> | undefined;
    if (!item) return null;
    return normalizeAgencyItem(item);
  }

  async listAgencyIds(): Promise<string[]> {
    const ids: string[] = [];
    let exclusiveStartKey: Record<string, unknown> | undefined;
    do {
      const res = await ddb.send(
        new ScanCommand({
          TableName: env.agenciesTable,
          ProjectionExpression: "agencyId",
          ExclusiveStartKey: exclusiveStartKey,
        }),
      );
      for (const item of res.Items ?? []) {
        const id = item.agencyId;
        if (typeof id === "string") ids.push(id);
      }
      exclusiveStartKey = res.LastEvaluatedKey as Record<string, unknown> | undefined;
    } while (exclusiveStartKey);
    return ids;
  }

  /**
   * **Full-table scan — rcsuperadmin/support tooling ONLY.** Forbidden for dispatcher-scoped workloads.
   * TODO(prod) — Section 3.1: replace with keyed query/list pattern; never expose unfiltered scans to SaaS callers.
   */
  async listRecent(limit = 200): Promise<AgencyTenant[]> {
    const res = await ddb.send(
      new ScanCommand({
        TableName: env.agenciesTable,
        Limit: limit,
      }),
    );
    return ((res.Items as Record<string, unknown>[]) ?? []).map(normalizeAgencyItem);
  }
}
