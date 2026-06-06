import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { PublishCommand, SNSClient } from "@aws-sdk/client-sns";
import { AUDIT_EVENT_TYPES, AuthorizationService } from "rapid-cortex-security";
import {
  cadWritebackApprovalBodySchema,
  cadWritebackBodySchema,
  isRcsuperadmin,
  type CadWritebackAuditRecord,
  type CadWritebackBody,
  type UserContext,
} from "rapid-cortex-shared";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../../lib/auth.js";
import { getCadWriteAdapter } from "../../lib/cad/adapters/index.js";
import { env } from "../../lib/env.js";
import { makeId } from "../../lib/ids.js";
import { AuditRepository } from "../../repositories/auditRepository.js";
import { CadIntegrationRepository, type CadIntegrationRecord } from "../../repositories/cadIntegrationRepository.js";
import { CadWritebackAuditRepository } from "../../repositories/cadWritebackAuditRepository.js";
import { IncidentRepository } from "../../repositories/incidentRepository.js";
import { incidentTimelineLogger } from "../../lib/incidentTimelineLogger.js";
import { requireAddon } from "../../middleware/requireAddon.js";
import {
  badRequest,
  badRequestFromZod,
  forbidden,
  jsonStatus,
  notFound,
  ok,
  serverError,
  unauthorized,
} from "../../lib/response.js";
import { ulid } from "ulid";

const authz = new AuthorizationService();
const incidentsRepo = new IncidentRepository();
const integrationRepo = new CadIntegrationRepository();
const writebackAuditRepo = new CadWritebackAuditRepository();
const auditRepo = new AuditRepository();
const sns = new SNSClient({ region: env.region });
const requireCadAddon = requireAddon("cad.");

function cors204() {
  return {
    statusCode: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
      "Access-Control-Allow-Headers": "authorization,content-type",
    },
  };
}

function canSubmitCadWriteback(user: UserContext): boolean {
  if (isRcsuperadmin(user)) return true;
  return (
    user.role === "dispatcher" ||
    user.role === "supervisor" ||
    user.role === "agencyadmin" ||
    user.role === "agencyit"
  );
}

function canReviewCadWriteback(user: UserContext): boolean {
  if (isRcsuperadmin(user)) return true;
  return authz.canAccessSupervisorRoutes(user) || user.role === "agencyadmin" || user.role === "agencyit";
}

function integrationConfigStrings(config: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(config)) {
    if (v === undefined || v === null) continue;
    out[k] = typeof v === "string" ? v : JSON.stringify(v);
  }
  return out;
}

/** Strip obvious PII patterns from free text for audit storage. */
function redactForAudit(text: string, maxLen: number): string {
  let t = text.slice(0, maxLen);
  t = t.replace(/\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b/g, "[redacted-email]");
  t = t.replace(/\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/g, "[redacted-phone]");
  return t;
}

function sanitizedPayloadJson(payload: CadWritebackBody): string {
  const safe: CadWritebackBody = {
    ...payload,
    narrative: redactForAudit(payload.narrative, 2000),
    notes: payload.notes ? redactForAudit(payload.notes, 500) : undefined,
  };
  return JSON.stringify(safe);
}

function parseSinceParam(since: string | undefined): string | undefined {
  if (!since?.trim()) return undefined;
  const s = since.trim();
  const m = /^(\d+)h$/i.exec(s);
  if (m) {
    const hours = Number.parseInt(m[1], 10);
    if (hours > 0 && hours <= 720) {
      return new Date(Date.now() - hours * 3600_000).toISOString();
    }
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s;
  return undefined;
}

function pickActiveIntegration(rows: CadIntegrationRecord[]): CadIntegrationRecord | null {
  const active = rows.filter((r) => r.status === "active");
  return active[0] ?? null;
}

async function publishOps(subject: string, message: Record<string, unknown>): Promise<void> {
  const arn = env.opsSnsTopicArn.trim();
  if (!arn) return;
  await sns.send(
    new PublishCommand({
      TopicArn: arn,
      Subject: subject.slice(0, 100),
      Message: JSON.stringify(message),
    }),
  );
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const method = event.requestContext.http.method;
    if (method === "OPTIONS") return cors204();

    if (!env.cadWritebackAuditTable) {
      return jsonStatus({ error: "CAD write-back audit storage is not configured." }, 503);
    }

    const user = await getUserContext(event);
    if (!user) return unauthorized();
    if (!isUserAccountActive(user)) return unauthorized(ACCOUNT_INACTIVE_MESSAGE);
    const addonGate = await requireCadAddon(event, user);
    if (addonGate) return addonGate;

    const rawPath = event.rawPath ?? "";

    const writebackMatch = /^\/api\/cad\/writeback\/([^/]+)$/.exec(rawPath);
    if (writebackMatch && method === "POST") {
      if (!canSubmitCadWriteback(user)) return forbidden();
      if (!env.cadWritebackEnabled) {
        return badRequest("CAD write-back is not enabled for this environment");
      }
      if (!env.cadIntegrationsTable) {
        return jsonStatus({ error: "CAD integrations are not configured." }, 503);
      }

      const incidentId = decodeURIComponent(writebackMatch[1]);
      const parsed = cadWritebackBodySchema.safeParse(JSON.parse(event.body ?? "{}"));
      if (!parsed.success) return badRequestFromZod(parsed.error);

      const incident = await incidentsRepo.get(incidentId);
      if (!incident || incident.agencyId !== user.agencyId) {
        return forbidden("Incident not found or access denied");
      }
      const cadIncidentId = incident.cadIncidentId?.trim();
      if (!cadIncidentId) {
        return badRequest("Incident must have a CAD incident ID for write-back");
      }

      const integrations = await integrationRepo.listByAgency(user.agencyId);
      const integration = pickActiveIntegration(integrations);
      if (!integration) {
        return badRequest("No active CAD integration configured");
      }

      const now = new Date().toISOString();
      const ttl = Math.floor(Date.now() / 1000) + 90 * 86400;
      const approvalId = ulid();
      const cfg = integrationConfigStrings(integration.config);

      if (env.cadWritebackRequiresApproval) {
        const row: CadWritebackAuditRecord = {
          id: approvalId,
          incidentId,
          agencyId: user.agencyId,
          userId: user.userId,
          userEmail: user.email,
          cadSystem: integration.vendor,
          integrationId: integration.id,
          action: "updated",
          payload: sanitizedPayloadJson(parsed.data),
          status: "pending_approval",
          createdAt: now,
          ttl,
        };
        await writebackAuditRepo.create(row);
        const preview = redactForAudit(parsed.data.narrative, 100);
        await publishOps("CAD Write-Back Approval Required", {
          approvalId,
          incidentId,
          agencyId: user.agencyId,
          submittedBy: user.email,
          narrativePreview: `${preview}${parsed.data.narrative.length > 100 ? "…" : ""}`,
        });
        return jsonStatus({ ok: true, status: "pending_approval", approvalId }, 202);
      }

      const adapter = getCadWriteAdapter(integration.vendor);
      const result = await adapter.submit({
        incident,
        payload: parsed.data,
        config: cfg,
        cadIncidentId,
      });

      const auditRow: CadWritebackAuditRecord = {
        id: approvalId,
        incidentId,
        agencyId: user.agencyId,
        userId: user.userId,
        userEmail: user.email,
        cadSystem: integration.vendor,
        integrationId: integration.id,
        action: "updated",
        payload: sanitizedPayloadJson(parsed.data),
        cadResponse: result.cadResponse?.slice(0, 8000),
        status: result.success ? "success" : "failed",
        errorMessage: result.errorMessage,
        createdAt: now,
        ttl,
      };
      await writebackAuditRepo.create(auditRow);

      await auditRepo.create({
        eventId: makeId("aud"),
        agencyId: user.agencyId,
        actorId: user.userId,
        incidentId,
        type: result.success ? AUDIT_EVENT_TYPES.CAD_WRITEBACK_SUBMITTED : AUDIT_EVENT_TYPES.CAD_WRITEBACK_FAILED,
        details: {
          writebackId: approvalId,
          integrationId: integration.id,
          vendor: integration.vendor,
          success: result.success,
          errorMessage: result.errorMessage,
        },
        createdAt: now,
        resourceType: "incident",
        resourceId: incidentId,
      });

      if (!result.success) {
        return jsonStatus(
          { ok: false, status: "failed", error: result.errorMessage ?? "CAD write-back failed" },
          502,
        );
      }

      await incidentTimelineLogger.emit({
        incidentId,
        agencyId: user.agencyId,
        kind: "cad_synced",
        source: "cad",
        actorId: user.userId,
        actorRole: user.role,
        payload: {
          integrationId: integration.id,
          vendor: integration.vendor,
          writebackId: approvalId,
        },
        timestamp: now,
      });

      return ok({ ok: true, status: "submitted", cadResponse: result.cadResponse });
    }

    if (rawPath === "/api/admin/cad-writeback-approvals" && method === "GET") {
      if (!canReviewCadWriteback(user)) return forbidden();
      const qs = event.queryStringParameters ?? {};
      const status = qs.status?.trim();
      const sinceIso = parseSinceParam(qs.since);
      const items = await writebackAuditRepo.listByAgency(user.agencyId, status, sinceIso);
      return ok({ items });
    }

    const approveMatch = /^\/api\/admin\/cad-writeback-approvals\/([^/]+)\/approve$/.exec(rawPath);
    if (approveMatch && method === "POST") {
      if (!canReviewCadWriteback(user)) return forbidden();
      const id = decodeURIComponent(approveMatch[1]);
      const record = await writebackAuditRepo.getById(id);
      if (!record || record.agencyId !== user.agencyId) return notFound();
      if (record.status !== "pending_approval") {
        return badRequest("Record is not pending approval");
      }
      if (record.userId === user.userId) {
        return forbidden("You cannot approve your own CAD write-back submission");
      }

      const integration = await integrationRepo.getById(user.agencyId, record.integrationId);
      if (!integration) return badRequest("CAD integration no longer exists");

      const payloadParsed = cadWritebackBodySchema.safeParse(JSON.parse(record.payload));
      if (!payloadParsed.success) return badRequest("Stored payload is invalid; reject and resubmit");

      const incident = await incidentsRepo.get(record.incidentId);
      if (!incident || incident.agencyId !== user.agencyId) return notFound();
      const cadIncidentId = incident.cadIncidentId?.trim();
      if (!cadIncidentId) return badRequest("Incident no longer has a CAD incident ID");

      const adapter = getCadWriteAdapter(integration.vendor);
      const cfg = integrationConfigStrings(integration.config);
      const result = await adapter.submit({
        incident,
        payload: payloadParsed.data,
        config: cfg,
        cadIncidentId,
      });

      const now = new Date().toISOString();
      if (!result.success) {
        await writebackAuditRepo.update(id, {
          status: "failed",
          errorMessage: result.errorMessage,
          cadResponse: result.cadResponse?.slice(0, 8000),
        });
        await auditRepo.create({
          eventId: makeId("aud"),
          agencyId: user.agencyId,
          actorId: user.userId,
          incidentId: record.incidentId,
          type: AUDIT_EVENT_TYPES.CAD_WRITEBACK_FAILED,
          details: { writebackId: id, phase: "approve", errorMessage: result.errorMessage },
          createdAt: now,
          resourceType: "incident",
          resourceId: record.incidentId,
        });
        return jsonStatus({ ok: false, error: result.errorMessage ?? "CAD write-back failed" }, 502);
      }

      await writebackAuditRepo.update(id, {
        status: "approved",
        approvedBy: user.userId,
        approvedAt: now,
        cadResponse: result.cadResponse?.slice(0, 8000),
      });

      await auditRepo.create({
        eventId: makeId("aud"),
        agencyId: user.agencyId,
        actorId: user.userId,
        incidentId: record.incidentId,
        type: AUDIT_EVENT_TYPES.CAD_WRITEBACK_APPROVED,
        details: { writebackId: id, integrationId: integration.id },
        createdAt: now,
        resourceType: "incident",
        resourceId: record.incidentId,
      });

      await publishOps("Your CAD write-back was approved", {
        type: "cad.writeback.approved",
        writebackId: id,
        incidentId: record.incidentId,
        agencyId: user.agencyId,
        submitterEmail: record.userEmail,
        approverEmail: user.email,
      });

      return ok({ ok: true, cadResponse: result.cadResponse });
    }

    const rejectMatch = /^\/api\/admin\/cad-writeback-approvals\/([^/]+)\/reject$/.exec(rawPath);
    if (rejectMatch && method === "POST") {
      if (!canReviewCadWriteback(user)) return forbidden();
      const id = decodeURIComponent(rejectMatch[1]);
      const parsed = cadWritebackApprovalBodySchema.safeParse(JSON.parse(event.body ?? "{}"));
      if (!parsed.success) return badRequestFromZod(parsed.error);

      const record = await writebackAuditRepo.getById(id);
      if (!record || record.agencyId !== user.agencyId) return notFound();
      if (record.status !== "pending_approval") {
        return badRequest("Record is not pending approval");
      }

      const now = new Date().toISOString();
      const notes = parsed.data.notes?.trim() ?? "";
      await writebackAuditRepo.update(id, {
        status: "rejected",
        rejectedBy: user.userId,
        rejectedAt: now,
        rejectionReason: notes || "rejected",
      });

      await auditRepo.create({
        eventId: makeId("aud"),
        agencyId: user.agencyId,
        actorId: user.userId,
        incidentId: record.incidentId,
        type: AUDIT_EVENT_TYPES.CAD_WRITEBACK_REJECTED,
        details: { writebackId: id, notes },
        createdAt: now,
        resourceType: "incident",
        resourceId: record.incidentId,
      });

      await publishOps("Your CAD write-back was rejected", {
        type: "cad.writeback.rejected",
        writebackId: id,
        incidentId: record.incidentId,
        agencyId: user.agencyId,
        submitterEmail: record.userEmail,
        rejectedBy: user.email,
        notes,
      });

      return ok({ ok: true });
    }

    return notFound();
  } catch (e) {
    console.error(
      JSON.stringify({
        type: "cad.writeback.error",
        message: e instanceof Error ? e.message : "unknown",
      }),
    );
    return serverError();
  }
};
