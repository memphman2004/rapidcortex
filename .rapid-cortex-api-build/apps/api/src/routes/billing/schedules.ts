import { GetCommand, PutCommand, QueryCommand, ScanCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import {
  billingScheduleFrequencySchema,
  createBillingScheduleBodySchema,
  isRcsuperadmin,
  patchBillingScheduleBodySchema,
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
const scheduleIdSchema = z.string().min(1).max(120);

function nowIso(): string {
  return new Date().toISOString();
}

function schedulesTail(rawPath: string): string[] {
  const clean = rawPath.split("?")[0] ?? "";
  const parts = clean.split("/").filter(Boolean);
  const idx = parts.findIndex((p, i) => p === "billing" && parts[i + 1] === "schedules");
  if (idx < 0) return [];
  return parts.slice(idx + 2);
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

function parseDateOrNull(input?: string): Date | null {
  if (!input) return null;
  const date = new Date(input);
  return Number.isNaN(date.getTime()) ? null : date;
}

function assertDateRange(startDate: string, endDate?: string): void {
  const start = parseDateOrNull(startDate);
  if (!start) throw new Error("Invalid startDate");
  if (!endDate) return;
  const end = parseDateOrNull(endDate);
  if (!end) throw new Error("Invalid endDate");
  if (end < start) throw new Error("endDate must be greater than or equal to startDate");
}

function computeNextRunDate(baseDateIso: string, frequency: z.infer<typeof billingScheduleFrequencySchema>): string {
  const base = parseDateOrNull(baseDateIso);
  if (!base) throw new Error("Invalid date for next run calculation");
  const next = new Date(base.toISOString());
  switch (frequency) {
    case "WEEKLY":
      next.setUTCDate(next.getUTCDate() + 7);
      break;
    case "MONTHLY":
      next.setUTCMonth(next.getUTCMonth() + 1);
      break;
    case "QUARTERLY":
      next.setUTCMonth(next.getUTCMonth() + 3);
      break;
    case "ANNUALLY":
      next.setUTCFullYear(next.getUTCFullYear() + 1);
      break;
  }
  return next.toISOString();
}

async function getScheduleScoped(scheduleId: string, agencyId: string) {
  const out = await ddb.send(
    new GetCommand({
      TableName: env.billingSchedulesTable,
      Key: { scheduleId },
    }),
  );
  const item = out.Item as Record<string, unknown> | undefined;
  if (!item || item.agencyId !== agencyId || item.isDeleted === true) return null;
  return item;
}

async function assertNoDuplicateSchedule(input: {
  agencyId: string;
  customerId: string;
  scheduleIdToIgnore?: string;
}): Promise<void> {
  const out = await ddb.send(
    new QueryCommand({
      TableName: env.billingSchedulesTable,
      IndexName: "customerId-index",
      KeyConditionExpression: "customerId = :customerId",
      ExpressionAttributeValues: { ":customerId": input.customerId },
    }),
  );
  const duplicate = (out.Items ?? []).some((row) => {
    const item = row as { agencyId?: string; scheduleId?: string; isDeleted?: boolean; enabled?: string };
    if (item.agencyId !== input.agencyId) return false;
    if (item.isDeleted === true) return false;
    if (input.scheduleIdToIgnore && item.scheduleId === input.scheduleIdToIgnore) return false;
    return item.enabled === "true";
  });
  if (duplicate) throw new Error("A schedule already exists for this customer");
}

export async function handleBillingSchedulesRoute(event: {
  rawPath?: string;
  body?: string | null;
  queryStringParameters?: Record<string, string | undefined>;
  requestContext: { http: { method: string } };
  isBase64Encoded?: boolean;
}, user: UserContext) {
  try {
    const method = event.requestContext.http.method;
    const tail = schedulesTail(event.rawPath ?? "");
    const scheduleId = tail[0];
    const action = tail[1];
    const scopeAgencyId = getAgencyScope(user, event.queryStringParameters?.agencyId);
    if (!scopeAgencyId) return badRequest("agencyId query required when acting as RC Super Admin (rcsuperadmin)");

    if (tail.length === 0 && method === "POST") {
      const bodyRaw =
        event.isBase64Encoded && event.body
          ? Buffer.from(event.body, "base64").toString("utf8")
          : (event.body ?? "{}");
      const parsed = createBillingScheduleBodySchema.safeParse(JSON.parse(bodyRaw));
      if (!parsed.success) return badRequestFromZod(parsed.error);

      assertDateRange(parsed.data.startDate, parsed.data.endDate);
      await assertNoDuplicateSchedule({
        agencyId: scopeAgencyId,
        customerId: parsed.data.customerId,
      });

      const t = nowIso();
      const enabled = parsed.data.enabled ?? true;
      const nextRunDate = parsed.data.nextRunDate ?? parsed.data.startDate;
      const item = {
        scheduleId: makeId("sched"),
        agencyId: scopeAgencyId,
        customerId: parsed.data.customerId,
        serviceId: parsed.data.serviceId,
        serviceName: parsed.data.serviceName,
        frequency: parsed.data.frequency,
        amount: parsed.data.amount,
        currency: parsed.data.currency.toUpperCase(),
        startDate: parsed.data.startDate,
        endDate: parsed.data.endDate,
        nextRunDate,
        lastRunDate: null,
        enabled: enabled ? "true" : "false",
        notes: parsed.data.notes,
        isDeleted: false,
        createdBy: user.userId,
        createdAt: t,
        updatedAt: t,
      };
      await ddb.send(
        new PutCommand({
          TableName: env.billingSchedulesTable,
          Item: item,
          ConditionExpression: "attribute_not_exists(scheduleId)",
        }),
      );
      await createAudit(user, scopeAgencyId, "schedule_created", "schedule", item.scheduleId, {
        action: "billing_schedule_created",
      });
      return ok(item, 201);
    }

    if (tail.length === 0 && method === "GET") {
      const out = await ddb.send(
        new ScanCommand({
          TableName: env.billingSchedulesTable,
          FilterExpression: "agencyId = :agencyId AND (attribute_not_exists(isDeleted) OR isDeleted = :isDeleted)",
          ExpressionAttributeValues: {
            ":agencyId": scopeAgencyId,
            ":isDeleted": false,
          },
        }),
      );
      const items = (out.Items ?? []).sort((a, b) =>
        String((b as { createdAt?: string }).createdAt ?? "").localeCompare(
          String((a as { createdAt?: string }).createdAt ?? ""),
        ),
      );
      return ok({ items });
    }

    if (!scheduleId) return notFound();
    const parsedScheduleId = scheduleIdSchema.safeParse(scheduleId);
    if (!parsedScheduleId.success) return badRequestFromZod(parsedScheduleId.error);

    if (tail.length === 1 && method === "GET") {
      const schedule = await getScheduleScoped(scheduleId, scopeAgencyId);
      if (!schedule) return notFound("Schedule not found");
      return ok(schedule);
    }

    if (tail.length === 1 && method === "PATCH") {
      const current = await getScheduleScoped(scheduleId, scopeAgencyId);
      if (!current) return notFound("Schedule not found");

      const bodyRaw =
        event.isBase64Encoded && event.body
          ? Buffer.from(event.body, "base64").toString("utf8")
          : (event.body ?? "{}");
      const parsed = patchBillingScheduleBodySchema.safeParse(JSON.parse(bodyRaw));
      if (!parsed.success) return badRequestFromZod(parsed.error);
      if (Object.keys(parsed.data).length === 0) return badRequest("No fields to update");

      const nextStartDate = parsed.data.startDate ?? String(current.startDate ?? "");
      const nextEndDate = parsed.data.endDate ?? (current.endDate as string | undefined);
      assertDateRange(nextStartDate, nextEndDate);

      const nextCustomerId = String(current.customerId ?? "");
      await assertNoDuplicateSchedule({
        agencyId: scopeAgencyId,
        customerId: nextCustomerId,
        scheduleIdToIgnore: scheduleId,
      });

      const nextFrequency = parsed.data.frequency ?? (current.frequency as z.infer<typeof billingScheduleFrequencySchema>);
      const nextRunDate =
        parsed.data.nextRunDate ??
        (parsed.data.frequency || parsed.data.startDate
          ? computeNextRunDate(nowIso(), nextFrequency)
          : String(current.nextRunDate ?? ""));

      const names: Record<string, string> = { "#updatedAt": "updatedAt", "#nextRunDate": "nextRunDate" };
      const values: Record<string, unknown> = { ":updatedAt": nowIso(), ":nextRunDate": nextRunDate };
      const setParts: string[] = ["#updatedAt = :updatedAt", "#nextRunDate = :nextRunDate"];
      for (const [k, v] of Object.entries(parsed.data)) {
        const nk = `#${k}`;
        const vk = `:${k}`;
        names[nk] = k;
        values[vk] = k === "enabled" ? (v ? "true" : "false") : k === "currency" ? String(v).toUpperCase() : v;
        setParts.push(`${nk} = ${vk}`);
      }

      const updated = await ddb.send(
        new UpdateCommand({
          TableName: env.billingSchedulesTable,
          Key: { scheduleId },
          UpdateExpression: `SET ${setParts.join(", ")}`,
          ExpressionAttributeNames: names,
          ExpressionAttributeValues: values,
          ReturnValues: "ALL_NEW",
        }),
      );
      await createAudit(user, scopeAgencyId, "schedule_updated", "schedule", scheduleId, {
        action: "billing_schedule_updated",
      });
      return ok(updated.Attributes ?? {});
    }

    if (tail.length === 1 && method === "DELETE") {
      const current = await getScheduleScoped(scheduleId, scopeAgencyId);
      if (!current) return notFound("Schedule not found");
      const t = nowIso();
      await ddb.send(
        new UpdateCommand({
          TableName: env.billingSchedulesTable,
          Key: { scheduleId },
          UpdateExpression: "SET isDeleted = :isDeleted, enabled = :enabled, updatedAt = :updatedAt, deletedAt = :deletedAt",
          ExpressionAttributeValues: {
            ":isDeleted": true,
            ":enabled": "false",
            ":updatedAt": t,
            ":deletedAt": t,
          },
        }),
      );
      await createAudit(user, scopeAgencyId, "schedule_deleted", "schedule", scheduleId, {
        action: "billing_schedule_deleted",
      });
      return ok({ scheduleId, deleted: true });
    }

    if (action === "enable" && method === "POST") {
      const current = await getScheduleScoped(scheduleId, scopeAgencyId);
      if (!current) return notFound("Schedule not found");
      await assertNoDuplicateSchedule({
        agencyId: scopeAgencyId,
        customerId: String(current.customerId ?? ""),
        scheduleIdToIgnore: scheduleId,
      });
      const t = nowIso();
      const nextRunDate = String(current.nextRunDate ?? current.startDate ?? t);
      const updated = await ddb.send(
        new UpdateCommand({
          TableName: env.billingSchedulesTable,
          Key: { scheduleId },
          UpdateExpression: "SET enabled = :enabled, nextRunDate = :nextRunDate, updatedAt = :updatedAt",
          ExpressionAttributeValues: {
            ":enabled": "true",
            ":nextRunDate": nextRunDate,
            ":updatedAt": t,
          },
          ReturnValues: "ALL_NEW",
        }),
      );
      await createAudit(user, scopeAgencyId, "schedule_enabled", "schedule", scheduleId, {
        action: "billing_schedule_enabled",
      });
      return ok(updated.Attributes ?? {});
    }

    if (action === "disable" && method === "POST") {
      const current = await getScheduleScoped(scheduleId, scopeAgencyId);
      if (!current) return notFound("Schedule not found");
      const updated = await ddb.send(
        new UpdateCommand({
          TableName: env.billingSchedulesTable,
          Key: { scheduleId },
          UpdateExpression: "SET enabled = :enabled, updatedAt = :updatedAt",
          ExpressionAttributeValues: {
            ":enabled": "false",
            ":updatedAt": nowIso(),
          },
          ReturnValues: "ALL_NEW",
        }),
      );
      await createAudit(user, scopeAgencyId, "schedule_disabled", "schedule", scheduleId, {
        action: "billing_schedule_disabled",
      });
      return ok(updated.Attributes ?? {});
    }

    if (action === "run-now" && method === "POST") {
      const current = await getScheduleScoped(scheduleId, scopeAgencyId);
      if (!current) return notFound("Schedule not found");
      const t = nowIso();
      const frequency = billingScheduleFrequencySchema.parse(String(current.frequency ?? ""));
      const nextRunDate = computeNextRunDate(t, frequency);
      const endDate = current.endDate ? parseDateOrNull(String(current.endDate)) : null;
      if (endDate && parseDateOrNull(nextRunDate) && parseDateOrNull(nextRunDate)! > endDate) {
        return badRequest("Next run date exceeds endDate");
      }
      const updated = await ddb.send(
        new UpdateCommand({
          TableName: env.billingSchedulesTable,
          Key: { scheduleId },
          UpdateExpression: "SET lastRunDate = :lastRunDate, nextRunDate = :nextRunDate, updatedAt = :updatedAt",
          ExpressionAttributeValues: {
            ":lastRunDate": t,
            ":nextRunDate": nextRunDate,
            ":updatedAt": t,
          },
          ReturnValues: "ALL_NEW",
        }),
      );
      await createAudit(user, scopeAgencyId, "schedule_run", "schedule", scheduleId, {
        action: "billing_schedule_run_now",
      });
      return ok(updated.Attributes ?? {});
    }

    return jsonStatus({ error: "Not found" }, 404);
  } catch (error) {
    if (error instanceof SyntaxError) return badRequest("Invalid JSON body");
    if (error instanceof z.ZodError) return badRequestFromZod(error);
    if (error instanceof Error && error.message === "FORBIDDEN") return forbidden();
    if (error instanceof Error) return badRequest(error.message);
    return serverError();
  }
}
