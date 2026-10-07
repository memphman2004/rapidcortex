import { GetCommand, PutCommand, QueryCommand, ScanCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import {
  createBillingCustomerBodySchema,
  isRcsuperadmin,
  patchBillingCustomerBodySchema,
  type UserContext,
} from "rapid-cortex-shared";
import { AUDIT_EVENT_TYPES } from "rapid-cortex-security";
import { z } from "zod";
import { env } from "../../lib/env.js";
import { makeId } from "../../lib/ids.js";
import {
  badRequest,
  badRequestFromZod,
  forbidden,
  jsonStatus,
  notFound,
  ok,
  serverError,
} from "../../lib/response.js";
import { AuditRepository } from "../../repositories/auditRepository.js";
import { ddb } from "../../repositories/baseRepository.js";
import { BillingAuditService } from "../../services/billingAuditService.js";

const auditRepo = new AuditRepository();
const billingAuditService = new BillingAuditService();

const customerIdSchema = z.string().min(1).max(120);

function nowIso(): string {
  return new Date().toISOString();
}

function billingTail(rawPath: string): string[] {
  const clean = rawPath.split("?")[0] ?? "";
  const parts = clean.split("/").filter(Boolean);
  const customersIdx = parts.findIndex((p, i) => p === "billing" && parts[i + 1] === "customers");
  if (customersIdx < 0) return [];
  return parts.slice(customersIdx + 2);
}

function getAgencyScope(user: UserContext, queryAgencyId?: string): string | null {
  if (isRcsuperadmin(user)) return (queryAgencyId ?? user.agencyId ?? "").trim() || null;
  return user.agencyId;
}

async function createAudit(
  user: UserContext,
  agencyId: string,
  action: string,
  entityType: string,
  resourceId: string,
  details: Record<string, unknown>,
): Promise<void> {
  await auditRepo.create({
    eventId: makeId("audit"),
    agencyId,
    actorId: user.userId,
    type: AUDIT_EVENT_TYPES.BILLING_PROFILE_UPDATED,
    resourceType: "billing",
    resourceId,
    details,
    createdAt: nowIso(),
  });
  await billingAuditService.logBillingAction(action, entityType, resourceId, user.userId, {
    agencyId,
    ...details,
  });
}

export async function handleBillingCustomersRoute(event: {
  rawPath?: string;
  body?: string | null;
  queryStringParameters?: Record<string, string | undefined>;
  requestContext: { http: { method: string } };
  isBase64Encoded?: boolean;
}, user: UserContext) {
  try {
    const method = event.requestContext.http.method;
    const tail = billingTail(event.rawPath ?? "");
    const customerId = tail[0];
    const subRoute = tail[1];
    const scopeAgencyId = getAgencyScope(user, event.queryStringParameters?.agencyId);

    if (!scopeAgencyId) return badRequest("agencyId query required when acting as RC Super Admin (rcsuperadmin)");

    if (tail.length === 0 && method === "POST") {
      const bodyRaw =
        event.isBase64Encoded && event.body
          ? Buffer.from(event.body, "base64").toString("utf8")
          : (event.body ?? "{}");
      const parsed = createBillingCustomerBodySchema.safeParse(JSON.parse(bodyRaw));
      if (!parsed.success) return badRequestFromZod(parsed.error);
      const t = nowIso();
      const customerIdValue = makeId("cus");
      const item = {
        customerId: customerIdValue,
        agencyId: scopeAgencyId,
        ...parsed.data,
        isDeleted: false,
        createdAt: t,
        updatedAt: t,
      };
      await ddb.send(
        new PutCommand({
          TableName: env.customersTable,
          Item: item,
          ConditionExpression: "attribute_not_exists(customerId)",
        }),
      );
      await createAudit(user, scopeAgencyId, "customer_created", "customer", customerIdValue, { action: "customer_created" });
      return ok(item, 201);
    }

    if (tail.length === 0 && method === "GET") {
      const out = await ddb.send(
        new ScanCommand({
          TableName: env.customersTable,
          FilterExpression: "agencyId = :agencyId AND (attribute_not_exists(isDeleted) OR isDeleted = :false)",
          ExpressionAttributeValues: {
            ":agencyId": scopeAgencyId,
            ":false": false,
          },
        }),
      );
      return ok({ items: out.Items ?? [] });
    }

    if (!customerId) return notFound();
    const parsedCustomerId = customerIdSchema.safeParse(customerId);
    if (!parsedCustomerId.success) return badRequestFromZod(parsedCustomerId.error);

    if (tail.length === 1 && method === "GET") {
      const out = await ddb.send(
        new GetCommand({
          TableName: env.customersTable,
          Key: { customerId },
        }),
      );
      const item = out.Item as Record<string, unknown> | undefined;
      if (!item || item.agencyId !== scopeAgencyId || item.isDeleted === true) return notFound("Customer not found");
      return ok(item);
    }

    if (tail.length === 1 && method === "PATCH") {
      const bodyRaw =
        event.isBase64Encoded && event.body
          ? Buffer.from(event.body, "base64").toString("utf8")
          : (event.body ?? "{}");
      const parsed = patchBillingCustomerBodySchema.safeParse(JSON.parse(bodyRaw));
      if (!parsed.success) return badRequestFromZod(parsed.error);
      if (Object.keys(parsed.data).length === 0) return badRequest("No fields to update");

      const existing = await ddb.send(
        new GetCommand({
          TableName: env.customersTable,
          Key: { customerId },
        }),
      );
      const current = existing.Item as Record<string, unknown> | undefined;
      if (!current || current.agencyId !== scopeAgencyId || current.isDeleted === true) return notFound("Customer not found");

      const setParts: string[] = [];
      const names: Record<string, string> = {};
      const values: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(parsed.data)) {
        const nk = `#${k}`;
        const vk = `:${k}`;
        names[nk] = k;
        values[vk] = v;
        setParts.push(`${nk} = ${vk}`);
      }
      names["#updatedAt"] = "updatedAt";
      values[":updatedAt"] = nowIso();
      setParts.push("#updatedAt = :updatedAt");

      const updated = await ddb.send(
        new UpdateCommand({
          TableName: env.customersTable,
          Key: { customerId },
          UpdateExpression: `SET ${setParts.join(", ")}`,
          ExpressionAttributeNames: names,
          ExpressionAttributeValues: values,
          ReturnValues: "ALL_NEW",
        }),
      );
      await createAudit(user, scopeAgencyId, "customer_updated", "customer", customerId, { action: "customer_updated" });
      return ok(updated.Attributes ?? {});
    }

    if (tail.length === 1 && method === "DELETE") {
      const existing = await ddb.send(
        new GetCommand({
          TableName: env.customersTable,
          Key: { customerId },
        }),
      );
      const current = existing.Item as Record<string, unknown> | undefined;
      if (!current || current.agencyId !== scopeAgencyId || current.isDeleted === true) return notFound("Customer not found");

      const updatedAt = nowIso();
      await ddb.send(
        new UpdateCommand({
          TableName: env.customersTable,
          Key: { customerId },
          UpdateExpression: "SET isDeleted = :isDeleted, deletedAt = :deletedAt, updatedAt = :updatedAt",
          ExpressionAttributeValues: {
            ":isDeleted": true,
            ":deletedAt": updatedAt,
            ":updatedAt": updatedAt,
          },
        }),
      );
      await createAudit(user, scopeAgencyId, "customer_deleted", "customer", customerId, { action: "customer_soft_deleted" });
      return ok({ customerId, deleted: true });
    }

    if (subRoute === "invoices" && method === "GET") {
      const out = await ddb.send(
        new QueryCommand({
          TableName: env.invoicesTable,
          IndexName: "customerId-createdAt-index",
          KeyConditionExpression: "customerId = :customerId",
          FilterExpression: "agencyId = :agencyId",
          ExpressionAttributeValues: {
            ":customerId": customerId,
            ":agencyId": scopeAgencyId,
          },
          ScanIndexForward: false,
        }),
      );
      return ok({ items: out.Items ?? [] });
    }

    if (subRoute === "balance" && method === "GET") {
      const out = await ddb.send(
        new QueryCommand({
          TableName: env.invoicesTable,
          IndexName: "customerId-createdAt-index",
          KeyConditionExpression: "customerId = :customerId",
          FilterExpression: "agencyId = :agencyId",
          ExpressionAttributeValues: {
            ":customerId": customerId,
            ":agencyId": scopeAgencyId,
          },
        }),
      );
      const items = (out.Items ?? []) as Array<{ status?: string; total?: number }>;
      const outstandingStatuses = new Set(["draft", "sent", "partially_paid", "overdue", "unsent"]);
      const outstandingBalance = items.reduce((sum, invoice) => {
        if (invoice.status && outstandingStatuses.has(invoice.status)) {
          return sum + (invoice.total ?? 0);
        }
        return sum;
      }, 0);
      return ok({ customerId, outstandingBalance, currency: "USD", invoiceCount: items.length });
    }

    return jsonStatus({ error: "Not found" }, 404);
  } catch (error) {
    if (error instanceof SyntaxError) return badRequest("Invalid JSON body");
    if (error instanceof Error && error.message === "FORBIDDEN") return forbidden();
    return serverError();
  }
}
