import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import {
  alertAcknowledgeBodySchema,
  alertDispatchBodySchema,
  alertGroupUpsertBodySchema,
  alertOrganizationUpsertBodySchema,
  alertRecipientImportBodySchema,
  alertSmsOptoutBodySchema,
  alertTemplateTypeSchema,
  alertTemplateUpsertBodySchema,
  alertVerticalSchema,
  isConfirmDispatchToken,
  toE164,
  type AlertVertical,
} from "rapid-cortex-shared";
import { AuthorizationService, AUDIT_EVENT_TYPES, type Permission } from "rapid-cortex-security";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../../lib/auth.js";
import { withCorrelationHeaders } from "../../lib/correlation.js";
import { env } from "../../lib/env.js";
import { makeId } from "../../lib/ids.js";
import {
  badRequest,
  badRequestFromZod,
  forbidden,
  notFound,
  ok,
  serverError,
  serviceUnavailable,
  unauthorized,
} from "../../lib/response.js";
import { AuditRepository } from "../../repositories/auditRepository.js";
import {
  dispatchOccupantAlert,
  ensureDefaultOrganization,
  ensureSystemCatalog,
  importRecipients,
  isStartKeyword,
  isStopKeyword,
} from "../../alerts/service.js";
import { alertsStore } from "../../alerts/store.js";

const authz = new AuthorizationService();
const auditRepo = new AuditRepository();

function parseBody(raw: string | undefined): unknown {
  try {
    return JSON.parse(raw ?? "{}");
  } catch {
    return null;
  }
}

function rest(path: string): string[] {
  const idx = path.indexOf("/api/alerts/");
  const tail = idx >= 0 ? path.slice(idx + "/api/alerts/".length) : "";
  return tail.split("/").filter(Boolean);
}

function requirePerm(user: { role: string; agencyId: string; userId: string }, perm: Permission) {
  if (!authz.canPerform(user, perm)) {
    throw Object.assign(new Error("FORBIDDEN"), { statusCode: 403 });
  }
}

function verticalFromQuery(event: { queryStringParameters?: Record<string, string | undefined> | null }): AlertVertical {
  const raw = event.queryStringParameters?.vertical ?? "campus";
  const parsed = alertVerticalSchema.safeParse(raw);
  return parsed.success ? parsed.data : "campus";
}

async function audit(params: {
  agencyId: string;
  actorId: string;
  type: string;
  details: Record<string, unknown>;
  resourceId?: string;
}) {
  await auditRepo.create({
    eventId: makeId("audit"),
    agencyId: params.agencyId,
    actorId: params.actorId,
    type: params.type,
    details: params.details,
    createdAt: new Date().toISOString(),
    resourceType: "agency",
    resourceId: params.resourceId,
  });
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    if (!env.enableVerticalAlerts || !env.verticalAlertsTable) {
      return withCorrelationHeaders(event, serviceUnavailable("Vertical alerts are not enabled"));
    }

    const method = event.requestContext.http.method.toUpperCase();
    const path = event.rawPath ?? "";
    const parts = rest(path);
    const body = event.body ? parseBody(event.body) : {};
    if (event.body && body === null) return withCorrelationHeaders(event, badRequest("Invalid JSON"));

    const user = await getUserContext(event);
    if (!user) return withCorrelationHeaders(event, unauthorized());
    if (!isUserAccountActive(user)) {
      return withCorrelationHeaders(event, unauthorized(ACCOUNT_INACTIVE_MESSAGE));
    }
    const agencyId = user.agencyId;
    if (!agencyId) return withCorrelationHeaders(event, forbidden());

    if (method === "POST" && parts[0] === "sms" && parts[1] === "optout") {
      requirePerm(user, "alerts.recipients.manage");
      const parsed = alertSmsOptoutBodySchema.safeParse(body ?? {});
      if (!parsed.success) return withCorrelationHeaders(event, badRequestFromZod(parsed.error));
      const phone = toE164(parsed.data.From ?? parsed.data.phoneE164 ?? "") ?? undefined;
      if (!phone) return withCorrelationHeaders(event, badRequest("Phone required"));
      const keyword = (parsed.data.action ?? parsed.data.Body ?? "STOP").trim();
      const org = (await alertsStore.listOrganizations(agencyId))[0];
      if (isStartKeyword(keyword) && parsed.data.action === "START") {
        await alertsStore.deleteDnc(agencyId, phone);
      } else if (isStopKeyword(keyword) || parsed.data.action === "STOP" || !parsed.data.action) {
        await alertsStore.putDnc(agencyId, org?.organizationId ?? agencyId, phone);
        const rec = await alertsStore.findRecipientByPhoneOrEmail(agencyId, phone);
        if (rec) {
          await alertsStore.putRecipient({ ...rec, smsOptedOut: true, updatedAt: new Date().toISOString() });
        }
        await audit({
          agencyId,
          actorId: user.userId,
          type: AUDIT_EVENT_TYPES.ALERT_SMS_OPTED_OUT,
          details: { optedOut: true },
          resourceId: phone.slice(-4),
        });
      }
      return withCorrelationHeaders(event, ok({ ok: true }));
    }

    if (method === "GET" && parts[0] === "organizations" && parts.length === 1) {
      requirePerm(user, "alerts.history.view");
      const vertical = verticalFromQuery(event);
      const org = await ensureDefaultOrganization(agencyId, vertical);
      await ensureSystemCatalog(agencyId, vertical, org);
      const orgs = await alertsStore.listOrganizations(agencyId);
      return withCorrelationHeaders(event, ok({ organizations: orgs }));
    }

    if (method === "POST" && parts[0] === "organizations" && parts.length === 1) {
      requirePerm(user, "alerts.organization.manage");
      const parsed = alertOrganizationUpsertBodySchema.safeParse(body);
      if (!parsed.success) return withCorrelationHeaders(event, badRequestFromZod(parsed.error));
      const org = await ensureDefaultOrganization(agencyId, parsed.data.vertical, parsed.data.name);
      org.name = parsed.data.name;
      org.memberAgencyIds = parsed.data.memberAgencyIds ?? org.memberAgencyIds;
      org.updatedAt = new Date().toISOString();
      await alertsStore.putOrganization(org);
      await audit({
        agencyId,
        actorId: user.userId,
        type: AUDIT_EVENT_TYPES.ALERT_ORGANIZATION_UPSERTED,
        details: { organizationId: org.organizationId, vertical: org.vertical },
        resourceId: org.organizationId,
      });
      return withCorrelationHeaders(event, ok({ organization: org }));
    }

    if (parts[0] === "recipients" && parts[1] === "import" && method === "POST") {
      requirePerm(user, "alerts.recipients.manage");
      const parsed = alertRecipientImportBodySchema.safeParse(body);
      if (!parsed.success) return withCorrelationHeaders(event, badRequestFromZod(parsed.error));
      const result = await importRecipients({
        agencyId,
        vertical: parsed.data.vertical,
        organizationId: parsed.data.organizationId,
        csv: parsed.data.csv,
      });
      await audit({
        agencyId,
        actorId: user.userId,
        type: AUDIT_EVENT_TYPES.ALERT_RECIPIENTS_IMPORTED,
        details: { imported: result.imported, updated: result.updated, failed: result.failed, vertical: parsed.data.vertical },
      });
      return withCorrelationHeaders(event, ok(result));
    }

    if (method === "GET" && parts[0] === "recipients" && parts.length === 1) {
      requirePerm(user, "alerts.recipients.manage");
      const recipients = await alertsStore.listRecipients(agencyId);
      return withCorrelationHeaders(
        event,
        ok({
          recipients: recipients.map((r) => ({
            recipientId: r.recipientId,
            email: r.email,
            phoneE164: r.phoneE164 ? `${r.phoneE164.slice(0, 2)}***${r.phoneE164.slice(-4)}` : undefined,
            displayName: r.displayName,
            groupIds: r.groupIds,
            smsOptIn: r.smsOptIn,
            smsOptedOut: r.smsOptedOut,
          })),
        }),
      );
    }

    if (method === "DELETE" && parts[0] === "recipients" && parts[1]) {
      requirePerm(user, "alerts.recipients.manage");
      await alertsStore.deleteRecipient(agencyId, parts[1]);
      await audit({
        agencyId,
        actorId: user.userId,
        type: AUDIT_EVENT_TYPES.ALERT_RECIPIENT_DELETED,
        details: { recipientId: parts[1] },
        resourceId: parts[1],
      });
      return withCorrelationHeaders(event, ok({ ok: true }));
    }

    if (parts[0] === "groups" && method === "GET") {
      requirePerm(user, "alerts.history.view");
      const vertical = verticalFromQuery(event);
      const org = await ensureDefaultOrganization(agencyId, vertical);
      await ensureSystemCatalog(agencyId, vertical, org);
      const groups = (await alertsStore.listGroups(agencyId)).filter((g) => g.vertical === vertical);
      return withCorrelationHeaders(event, ok({ groups }));
    }

    if (parts[0] === "groups" && method === "POST") {
      requirePerm(user, "alerts.recipients.manage");
      const parsed = alertGroupUpsertBodySchema.safeParse(body);
      if (!parsed.success) return withCorrelationHeaders(event, badRequestFromZod(parsed.error));
      const org = await ensureDefaultOrganization(agencyId, parsed.data.vertical);
      const group = {
        groupId: makeId("grp"),
        organizationId: org.organizationId,
        agencyId,
        vertical: parsed.data.vertical,
        slug: parsed.data.slug,
        name: parsed.data.name,
        system: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await alertsStore.putGroup(group);
      await audit({
        agencyId,
        actorId: user.userId,
        type: AUDIT_EVENT_TYPES.ALERT_GROUP_UPSERTED,
        details: { groupId: group.groupId, slug: group.slug },
        resourceId: group.groupId,
      });
      return withCorrelationHeaders(event, ok({ group }));
    }

    if (parts[0] === "templates" && method === "GET") {
      requirePerm(user, "alerts.history.view");
      const vertical = verticalFromQuery(event);
      const org = await ensureDefaultOrganization(agencyId, vertical);
      await ensureSystemCatalog(agencyId, vertical, org);
      const templates = (await alertsStore.listTemplates(agencyId)).filter((t) => t.vertical === vertical);
      return withCorrelationHeaders(event, ok({ templates }));
    }

    if (parts[0] === "templates" && method === "POST") {
      requirePerm(user, "alerts.templates.manage");
      const parsed = alertTemplateUpsertBodySchema.safeParse(body);
      if (!parsed.success) return withCorrelationHeaders(event, badRequestFromZod(parsed.error));
      const typeCheck = alertTemplateTypeSchema.safeParse(parsed.data.type);
      if (!typeCheck.success) return withCorrelationHeaders(event, badRequest("Invalid template type"));
      const org = await ensureDefaultOrganization(agencyId, parsed.data.vertical);
      const tpl = {
        templateId: makeId("tpl"),
        organizationId: org.organizationId,
        agencyId,
        vertical: parsed.data.vertical,
        type: parsed.data.type,
        title: parsed.data.title,
        body: parsed.data.body,
        smsBody: parsed.data.smsBody,
        severity: parsed.data.severity,
        system: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await alertsStore.putTemplate(tpl);
      await audit({
        agencyId,
        actorId: user.userId,
        type: AUDIT_EVENT_TYPES.ALERT_TEMPLATE_UPSERTED,
        details: { templateId: tpl.templateId, type: tpl.type },
        resourceId: tpl.templateId,
      });
      return withCorrelationHeaders(event, ok({ template: tpl }));
    }

    if (parts[0] === "dispatch" && method === "POST" && parts.length === 1) {
      requirePerm(user, "alerts.dispatch");
      const parsed = alertDispatchBodySchema.safeParse(body);
      if (!parsed.success) return withCorrelationHeaders(event, badRequestFromZod(parsed.error));
      if (!isConfirmDispatchToken(parsed.data.confirmation ?? parsed.data.confirmationToken)) {
        return withCorrelationHeaders(event, badRequest("Type CONFIRM to send an occupant alert"));
      }
      try {
        const job = await dispatchOccupantAlert({
          agencyId,
          actorId: user.userId,
          displayName: agencyId,
          body: parsed.data,
          canCritical: authz.canPerform(user, "alerts.dispatch.critical"),
        });
        await audit({
          agencyId,
          actorId: user.userId,
          type: AUDIT_EVENT_TYPES.ALERT_DISPATCH_INITIATED,
          details: {
            jobId: job.jobId,
            vertical: job.vertical,
            templateType: job.templateType,
            channels: job.channels,
            estimatedRecipients: job.estimatedRecipients,
          },
          resourceId: job.jobId,
        });
        await audit({
          agencyId,
          actorId: user.userId,
          type: AUDIT_EVENT_TYPES.ALERT_DISPATCH_COMPLETED,
          details: { jobId: job.jobId, status: job.status },
          resourceId: job.jobId,
        });
        return withCorrelationHeaders(event, ok({ jobId: job.jobId, status: "DISPATCHING", job }, 202));
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        const message = err instanceof Error ? err.message : "DISPATCH_FAILED";
        if (status === 403) return withCorrelationHeaders(event, forbidden(message));
        if (status === 404) return withCorrelationHeaders(event, notFound(message));
        if (status === 429) return withCorrelationHeaders(event, ok({ error: message }, 429));
        throw err;
      }
    }

    if (parts[0] === "dispatch" && method === "GET" && parts.length === 1) {
      requirePerm(user, "alerts.history.view");
      const rawLimit = Number(event.queryStringParameters?.limit ?? "50");
      const limit = Number.isFinite(rawLimit) ? Math.min(100, Math.max(1, rawLimit)) : 50;
      const cursor = event.queryStringParameters?.cursor?.trim() || "";
      const all = await alertsStore.listJobs(agencyId);
      const start = cursor ? Math.max(0, all.findIndex((j) => j.jobId === cursor) + 1) : 0;
      const jobs = all.slice(start, start + limit);
      const next = all[start + limit];
      return withCorrelationHeaders(event, ok({ jobs, nextCursor: next?.jobId ?? null }));
    }

    if (parts[0] === "dispatch" && parts[1] && method === "GET") {
      requirePerm(user, "alerts.history.view");
      const job = await alertsStore.getJob(agencyId, parts[1]);
      if (!job) return withCorrelationHeaders(event, notFound("Job not found"));
      if (parts[2] === "status") {
        const acks = await alertsStore.listAcks(agencyId, job.jobId);
        return withCorrelationHeaders(
          event,
          ok({
            jobId: job.jobId,
            status: job.status,
            channelSummary: job.channelSummary,
            acknowledgedSessions: acks.length,
          }),
        );
      }
      if (parts[2] === "log") {
        const deliveries = await alertsStore.listDeliveries(agencyId, job.jobId);
        return withCorrelationHeaders(
          event,
          ok({
            job,
            deliveries: deliveries.map((d) => ({
              channel: d.channel,
              status: d.status,
              reason: d.reason,
              createdAt: d.createdAt,
            })),
          }),
        );
      }
      return withCorrelationHeaders(event, ok({ job }));
    }

    if (parts[0] === "dispatch" && parts[1] && parts[2] === "acknowledge" && method === "POST") {
      requirePerm(user, "alerts.history.view");
      alertAcknowledgeBodySchema.safeParse(body ?? {});
      const job = await alertsStore.getJob(agencyId, parts[1]);
      if (!job) return withCorrelationHeaders(event, notFound("Job not found"));
      await alertsStore.putAck({
        agencyId,
        organizationId: job.organizationId,
        jobId: job.jobId,
        userId: user.userId,
      });
      await audit({
        agencyId,
        actorId: user.userId,
        type: AUDIT_EVENT_TYPES.ALERT_ACKNOWLEDGED,
        details: { jobId: job.jobId },
        resourceId: job.jobId,
      });
      return withCorrelationHeaders(event, ok({ ok: true }));
    }

    return withCorrelationHeaders(event, notFound("Not found"));
  } catch (err) {
    if ((err as { statusCode?: number }).statusCode === 403 || (err as Error).message === "FORBIDDEN") {
      return withCorrelationHeaders(event, forbidden());
    }
    return withCorrelationHeaders(
      event,
      serverError(err instanceof Error ? err.message : "Internal server error"),
    );
  }
};
