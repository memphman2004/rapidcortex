import { GetCommand, PutCommand, QueryCommand, ScanCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import {
  createBillingServiceBodySchema,
  canAccessRcFinancePortal,
  isRcsuperadmin,
  patchBillingServiceBodySchema,
  PLATFORM_AGENCY_ID,
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
const serviceIdSchema = z.string().min(1).max(120);

function nowIso(): string {
  return new Date().toISOString();
}

function billingTail(rawPath: string): string[] {
  const clean = rawPath.split("?")[0] ?? "";
  const parts = clean.split("/").filter(Boolean);
  const idx = parts.findIndex((p, i) => p === "billing" && parts[i + 1] === "services");
  if (idx < 0) return [];
  return parts.slice(idx + 2);
}

function getAgencyScope(user: UserContext, queryAgencyId?: string): string | null {
  const q = (queryAgencyId ?? "").trim();
  if (q) return q;
  if (user.agencyId?.trim()) return user.agencyId.trim();
  if (isRcsuperadmin(user) || canAccessRcFinancePortal(user.role)) return PLATFORM_AGENCY_ID;
  return null;
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

export async function handleBillingServicesRoute(event: {
  rawPath?: string;
  body?: string | null;
  queryStringParameters?: Record<string, string | undefined>;
  requestContext: { http: { method: string } };
  isBase64Encoded?: boolean;
}, user: UserContext) {
  try {
    const method = event.requestContext.http.method;
    const tail = billingTail(event.rawPath ?? "");
    const serviceId = tail[0];
    const scopeAgencyId = getAgencyScope(user, event.queryStringParameters?.agencyId);
    if (!scopeAgencyId) return badRequest("agencyId query required when acting as RC Super Admin (rcsuperadmin)");

    if (tail.length === 0 && method === "POST") {
      const bodyRaw =
        event.isBase64Encoded && event.body
          ? Buffer.from(event.body, "base64").toString("utf8")
          : (event.body ?? "{}");
      const parsed = createBillingServiceBodySchema.safeParse(JSON.parse(bodyRaw));
      if (!parsed.success) return badRequestFromZod(parsed.error);
      const t = nowIso();
      const serviceIdValue = makeId("svc");
      const item = {
        serviceId: serviceIdValue,
        agencyId: scopeAgencyId,
        ...parsed.data,
        isDeleted: false,
        createdAt: t,
        updatedAt: t,
      };
      await ddb.send(
        new PutCommand({
          TableName: env.serviceCatalogTable,
          Item: item,
          ConditionExpression: "attribute_not_exists(serviceId)",
        }),
      );
      await createAudit(user, scopeAgencyId, "service_created", "service", serviceIdValue, { action: "service_created" });
      return ok(item, 201);
    }

    if (tail.length === 0 && method === "GET") {
      const activeFilter = (event.queryStringParameters?.active ?? "").trim().toLowerCase();
      const includeOnlyActive = activeFilter === "true";
      const out = await ddb.send(
        new ScanCommand({
          TableName: env.serviceCatalogTable,
          FilterExpression:
            includeOnlyActive
              ? "agencyId = :agencyId AND active = :active AND (attribute_not_exists(isDeleted) OR isDeleted = :false)"
              : "agencyId = :agencyId AND (attribute_not_exists(isDeleted) OR isDeleted = :false)",
          ExpressionAttributeValues: includeOnlyActive
            ? {
                ":agencyId": scopeAgencyId,
                ":active": true,
                ":false": false,
              }
            : {
                ":agencyId": scopeAgencyId,
                ":false": false,
              },
        }),
      );
      return ok({ items: out.Items ?? [] });
    }

    if (!serviceId) return notFound();
    const parsedServiceId = serviceIdSchema.safeParse(serviceId);
    if (!parsedServiceId.success) return badRequestFromZod(parsedServiceId.error);

    if (tail.length === 1 && method === "GET") {
      const out = await ddb.send(
        new GetCommand({
          TableName: env.serviceCatalogTable,
          Key: { serviceId },
        }),
      );
      const item = out.Item as Record<string, unknown> | undefined;
      if (!item || item.agencyId !== scopeAgencyId || item.isDeleted === true) return notFound("Service not found");
      return ok(item);
    }

    if (tail.length === 1 && method === "PATCH") {
      const bodyRaw =
        event.isBase64Encoded && event.body
          ? Buffer.from(event.body, "base64").toString("utf8")
          : (event.body ?? "{}");
      const parsed = patchBillingServiceBodySchema.safeParse(JSON.parse(bodyRaw));
      if (!parsed.success) return badRequestFromZod(parsed.error);
      if (Object.keys(parsed.data).length === 0) return badRequest("No fields to update");

      const existing = await ddb.send(
        new GetCommand({
          TableName: env.serviceCatalogTable,
          Key: { serviceId },
        }),
      );
      const current = existing.Item as Record<string, unknown> | undefined;
      if (!current || current.agencyId !== scopeAgencyId || current.isDeleted === true) return notFound("Service not found");

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
          TableName: env.serviceCatalogTable,
          Key: { serviceId },
          UpdateExpression: `SET ${setParts.join(", ")}`,
          ExpressionAttributeNames: names,
          ExpressionAttributeValues: values,
          ReturnValues: "ALL_NEW",
        }),
      );
      await createAudit(user, scopeAgencyId, "service_updated", "service", serviceId, { action: "service_updated" });
      return ok(updated.Attributes ?? {});
    }

    if (tail.length === 1 && method === "DELETE") {
      const existing = await ddb.send(
        new GetCommand({
          TableName: env.serviceCatalogTable,
          Key: { serviceId },
        }),
      );
      const current = existing.Item as Record<string, unknown> | undefined;
      if (!current || current.agencyId !== scopeAgencyId || current.isDeleted === true) return notFound("Service not found");

      const updatedAt = nowIso();
      await ddb.send(
        new UpdateCommand({
          TableName: env.serviceCatalogTable,
          Key: { serviceId },
          UpdateExpression:
            "SET active = :active, isDeleted = :isDeleted, deactivatedAt = :deactivatedAt, updatedAt = :updatedAt",
          ExpressionAttributeValues: {
            ":active": false,
            ":isDeleted": true,
            ":deactivatedAt": updatedAt,
            ":updatedAt": updatedAt,
          },
        }),
      );
      await createAudit(user, scopeAgencyId, "service_deleted", "service", serviceId, { action: "service_deactivated" });
      return ok({ serviceId, active: false, deleted: true });
    }

    return jsonStatus({ error: "Not found" }, 404);
  } catch (error) {
    if (error instanceof SyntaxError) return badRequest("Invalid JSON body");
    if (error instanceof Error && error.message === "FORBIDDEN") return forbidden();
    return serverError();
  }
}
