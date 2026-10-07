import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { PublishCommand, SNSClient } from "@aws-sdk/client-sns";
import { AUDIT_EVENT_TYPES, AuthorizationService } from "rapid-cortex-security";
import {
  cadIncidentsQuerySchema,
  isRcsuperadmin,
  patchCadIntegrationBodySchema,
  postCadIntegrationBodySchema,
} from "rapid-cortex-shared";
import type { UserContext } from "rapid-cortex-shared";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../../lib/auth.js";
import { env } from "../../lib/env.js";
import { getCadParser } from "../../lib/cad/parsers/index.js";
import type { CadIntegrationSetupContext } from "../../lib/cad/types.js";
import { makeId } from "../../lib/ids.js";
import { AuditRepository } from "../../repositories/auditRepository.js";
import { CadIncidentRawRepository, type CadIncidentRawRecord } from "../../repositories/cadIncidentRawRepository.js";
import { CadIntegrationRepository, type CadIntegrationRecord } from "../../repositories/cadIntegrationRepository.js";
import { generateCadWebhookToken, hashCadWebhookToken } from "../../services/cad/cadWebhookSecret.js";
import type { CadWebhookIngressMessage } from "../../services/cad/cadWebhookProcessService.js";
import {
  badRequestFromZod,
  forbidden,
  notFound,
  ok,
  serverError,
  serviceUnavailable,
  unauthorized,
} from "../../lib/response.js";
import { ulid } from "ulid";

const authz = new AuthorizationService();
const integrationRepo = new CadIntegrationRepository();
const rawIncidentRepo = new CadIncidentRawRepository();
const auditRepo = new AuditRepository();
const sns = new SNSClient({ region: env.region });

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

function canViewCadIntegrations(user: UserContext): boolean {
  return authz.canAccessAdminRoutes(user) || user.role === "supervisor" || isRcsuperadmin(user);
}

function canMutateCadIntegration(user: UserContext): boolean {
  return user.role === "agencyadmin" || user.role === "agencyit" || isRcsuperadmin(user);
}

function canListCadIncidents(user: UserContext): boolean {
  return (
    user.role === "dispatcher" ||
    authz.canAccessSupervisorRoutes(user) ||
    user.role === "agencyit" ||
    user.role === "analyst" ||
    user.role === "auditor" ||
    isRcsuperadmin(user)
  );
}

function publicBase(): string {
  const b = env.cadPublicApiBaseUrl.trim();
  return (b || "https://api.rapidcortex.us").replace(/\/$/, "");
}

function toPublicIntegration(
  row: CadIntegrationRecord,
  opts?: { tokenPreview?: string },
): Omit<CadIntegrationRecord, "webhookSecretHash"> & {
  hasWebhookSecret: boolean;
  webhookUrl: string;
  setupInstructions: string;
} {
  const { webhookSecretHash: _h, ...rest } = row;
  const parser = getCadParser(row.vendor);
  const tokenPreview = opts?.tokenPreview?.trim() || "****";
  const webhookUrl = `${publicBase()}/api/cad/webhook/${encodeURIComponent(row.agencyId)}/${encodeURIComponent(row.id)}`;
  const setupCtx: CadIntegrationSetupContext = {
    id: row.id,
    agencyId: row.agencyId,
    name: row.name,
    vendor: row.vendor,
    webhookUrl,
    connectionType: row.connectionType,
    config: row.config as Record<string, unknown> | undefined,
    tokenPreview,
  };
  return {
    ...rest,
    hasWebhookSecret: Boolean(_h),
    webhookUrl,
    setupInstructions: parser.generateSetupInstructions(setupCtx),
  };
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const method = event.requestContext.http.method;
    if (method === "OPTIONS") return cors204();

    if (!env.cadIntegrationsTable || !env.cadIncidentsRawTable) {
      return serviceUnavailable("CAD integration storage is not configured.");
    }

    const user = await getUserContext(event);
    if (!user) return unauthorized();
    if (!isUserAccountActive(user)) return unauthorized(ACCOUNT_INACTIVE_MESSAGE);

    const rawPath = event.rawPath ?? "";
    const pathCadIncidents = "/api/admin/cad-incidents";
    const pathIntegrationsRoot = "/api/admin/cad-integrations";

    if (rawPath === pathCadIncidents && method === "GET") {
      if (!canListCadIncidents(user)) return forbidden();
      const parsed = cadIncidentsQuerySchema.safeParse(event.queryStringParameters ?? {});
      if (!parsed.success) return badRequestFromZod(parsed.error);
      const { integrationId, ...listOpts } = parsed.data;
      let items: CadIncidentRawRecord[];
      if (integrationId?.trim()) {
        const integ = await integrationRepo.getById(user.agencyId, integrationId.trim());
        if (!integ) {
          items = [];
        } else {
          items = await rawIncidentRepo.listByIntegration(user.agencyId, integrationId.trim(), {
            from: listOpts.from,
            limit: listOpts.limit,
          });
        }
      } else {
        items = await rawIncidentRepo.listByAgency(user.agencyId, listOpts);
      }
      return ok({ items });
    }

    if (rawPath === pathIntegrationsRoot && method === "GET") {
      if (!canViewCadIntegrations(user)) return forbidden();
      const rows = await integrationRepo.listByAgency(user.agencyId);
      return ok({ items: rows.map((r) => toPublicIntegration(r)) });
    }

    if (rawPath === pathIntegrationsRoot && method === "POST") {
      if (!canMutateCadIntegration(user)) return forbidden();
      const parsed = postCadIntegrationBodySchema.safeParse(JSON.parse(event.body ?? "{}"));
      if (!parsed.success) return badRequestFromZod(parsed.error);
      const salt = env.cadWebhookSecretSalt;
      if (!salt) return serviceUnavailable("CAD_WEBHOOK_SECRET_SALT is not configured.");
      const id = ulid();
      const now = new Date().toISOString();
      const token = generateCadWebhookToken();
      const row: CadIntegrationRecord = {
        id,
        agencyId: user.agencyId,
        name: parsed.data.name,
        vendor: parsed.data.vendor,
        status: "testing",
        connectionType: parsed.data.connectionType,
        config: parsed.data.config as Record<string, unknown>,
        webhookSecretHash: hashCadWebhookToken(salt, token),
        incidentCount: 0,
        createdAt: now,
        updatedAt: now,
      };
      await integrationRepo.create(row);
      await auditRepo.create({
        eventId: makeId("aud"),
        agencyId: user.agencyId,
        actorId: user.userId,
        type: AUDIT_EVENT_TYPES.CAD_INTEGRATION_CREATED,
        details: { integrationId: id, vendor: row.vendor, connectionType: row.connectionType },
        createdAt: now,
        resourceType: "integration",
        resourceId: id,
      });
      const tokenPreview = token.length > 4 ? `…${token.slice(-4)}` : "****";
      return ok({
        integration: toPublicIntegration(row, { tokenPreview }),
        webhookSecret: token,
      });
    }

    const prefix = `${pathIntegrationsRoot}/`;
    if (!rawPath.startsWith(prefix)) return notFound();

    const tail = rawPath.slice(prefix.length);
    const testSuffix = "/test";
    const isTest = tail.endsWith(testSuffix);
    const id = isTest ? tail.slice(0, -testSuffix.length) : tail;
    if (!id) return notFound();

    if (method === "GET") {
      if (!canViewCadIntegrations(user)) return forbidden();
      const row = await integrationRepo.getById(user.agencyId, id);
      if (!row) return notFound();
      return ok({ integration: toPublicIntegration(row) });
    }

    if (method === "PATCH") {
      if (!canMutateCadIntegration(user)) return forbidden();
      const parsed = patchCadIntegrationBodySchema.safeParse(JSON.parse(event.body ?? "{}"));
      if (!parsed.success) return badRequestFromZod(parsed.error);
      const existing = await integrationRepo.getById(user.agencyId, id);
      if (!existing) return notFound();
      const { regenerateToken, ...rest } = parsed.data;
      const salt = env.cadWebhookSecretSalt;
      const updatePayload: Parameters<typeof integrationRepo.update>[2] = { ...rest };
      let newPlainToken: string | undefined;
      if (regenerateToken) {
        if (!salt) return serviceUnavailable("CAD_WEBHOOK_SECRET_SALT is not configured.");
        newPlainToken = generateCadWebhookToken();
        updatePayload.webhookSecretHash = hashCadWebhookToken(salt, newPlainToken);
      }
      if (Object.keys(updatePayload).length === 0) {
        return ok({ integration: toPublicIntegration(existing) });
      }
      await integrationRepo.update(user.agencyId, id, updatePayload);
      const now = new Date().toISOString();
      const auditFields = [...Object.keys(rest), ...(regenerateToken ? ["regenerateToken"] : [])];
      await auditRepo.create({
        eventId: makeId("aud"),
        agencyId: user.agencyId,
        actorId: user.userId,
        type: AUDIT_EVENT_TYPES.CAD_INTEGRATION_UPDATED,
        details: { integrationId: id, fields: auditFields },
        createdAt: now,
        resourceType: "integration",
        resourceId: id,
      });
      const refreshed = await integrationRepo.getById(user.agencyId, id);
      const tokenPreview =
        newPlainToken && newPlainToken.length > 4 ? `…${newPlainToken.slice(-4)}` : undefined;
      return ok({
        integration: refreshed ? toPublicIntegration(refreshed, tokenPreview ? { tokenPreview } : undefined) : null,
        ...(newPlainToken ? { webhookSecret: newPlainToken } : {}),
      });
    }

    if (method === "DELETE") {
      if (!canMutateCadIntegration(user)) return forbidden();
      const existing = await integrationRepo.getById(user.agencyId, id);
      if (!existing) return notFound();
      await integrationRepo.delete(user.agencyId, id);
      const now = new Date().toISOString();
      await auditRepo.create({
        eventId: makeId("aud"),
        agencyId: user.agencyId,
        actorId: user.userId,
        type: AUDIT_EVENT_TYPES.CAD_INTEGRATION_DELETED,
        details: { integrationId: id },
        createdAt: now,
        resourceType: "integration",
        resourceId: id,
      });
      return ok({ deleted: true });
    }

    if (method === "POST" && isTest) {
      if (!canMutateCadIntegration(user)) return forbidden();
      const row = await integrationRepo.getById(user.agencyId, id);
      if (!row) return notFound();
      const t0 = Date.now();
      await integrationRepo.update(user.agencyId, id, { lastPingAt: new Date().toISOString() });
      const latencyMs = Date.now() - t0;
      const now = new Date().toISOString();

      let details: Record<string, unknown> = { integrationId: id, latencyMs };

      if (row.connectionType === "webhook_inbound" && env.cadWebhookIngressTopicArn) {
        const msg: CadWebhookIngressMessage = {
          v: 1,
          agencyId: user.agencyId,
          integrationId: id,
          rawBody: "{}",
          receivedAt: now,
          internalSelfTest: true,
        };
        await sns.send(
          new PublishCommand({
            TopicArn: env.cadWebhookIngressTopicArn,
            Message: JSON.stringify(msg),
          }),
        );
        details = { ...details, pipeline: "sns_ingress_self_test" };
      }

      await auditRepo.create({
        eventId: makeId("aud"),
        agencyId: user.agencyId,
        actorId: user.userId,
        type: AUDIT_EVENT_TYPES.CAD_INTEGRATION_TESTED,
        details,
        createdAt: now,
        resourceType: "integration",
        resourceId: id,
      });
      if (env.cadWebhookSnsTopicArn) {
        await sns.send(
          new PublishCommand({
            TopicArn: env.cadWebhookSnsTopicArn,
            Message: JSON.stringify({
              type: "cad.integration.test",
              agencyId: user.agencyId,
              integrationId: id,
              at: now,
            }),
          }),
        );
      }
      return ok({
        success: true,
        latencyMs,
        message:
          row.connectionType === "webhook_inbound" && env.cadWebhookIngressTopicArn ?
            "Published vendor-shaped self-test to the CAD ingress pipeline."
          : "Connectivity check recorded (no outbound vendor API in this phase).",
        details,
      });
    }

    return notFound();
  } catch (e) {
    console.error(JSON.stringify({ type: "cad.admin.error", message: e instanceof Error ? e.message : "unknown" }));
    return serverError();
  }
};
