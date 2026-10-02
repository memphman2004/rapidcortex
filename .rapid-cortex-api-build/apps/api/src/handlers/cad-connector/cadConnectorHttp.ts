import type { APIGatewayProxyEventV2, APIGatewayProxyHandlerV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { AuthorizationService, AUDIT_EVENT_TYPES } from "rapid-cortex-security";
import type { Permission } from "rapid-cortex-security";
import {
  cadAuditListQuerySchema,
  cadConnectorCreateBodySchema,
  cadConnectorUpdateBodySchema,
  cadFieldMappingsPutBodySchema,
  cadIncidentListQuerySchema,
  cadRoutingRulesPutBodySchema,
  cadWriteBackApproveBodySchema,
  cadWriteBackListQuerySchema,
  cadWriteBackRejectBodySchema,
  cadWriteBackSubmitBodySchema,
  type CadWriteBackRequest,
  type UserContext,
} from "rapid-cortex-shared";
import {
  CadAdapterRegistry,
  CadRoutingEngine,
  cadConnectorAuditStore,
  cadConnectorService,
  cadIngestionService,
  cadUnifiedIncidentStore,
  cadWriteBackStore,
  newWriteBackId,
  sanitizeConnectorForClient,
  stripRawVendorPayload,
} from "rapid-cortex-integrations/cad";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../../lib/auth.js";
import { withCorrelationHeaders } from "../../lib/correlation.js";
import { makeId } from "../../lib/ids.js";
import {
  badRequest,
  badRequestFromZod,
  forbidden,
  jsonStatus,
  notFound,
  ok,
  serverError,
  serviceUnavailable,
  unauthorized,
} from "../../lib/response.js";
import { requireAddon } from "../../middleware/requireAddon.js";
import { AuditRepository } from "../../repositories/auditRepository.js";
import { cadConnectorEnabled } from "./cadConnectorFlag.js";

const authz = new AuthorizationService();
const auditRepo = new AuditRepository();
const requireCadConnectorAddon = requireAddon("cad.connector");
const writeBackWindow = new Map<string, number[]>();

function methodOf(event: APIGatewayProxyEventV2): string {
  return (event.requestContext.http?.method ?? "GET").toUpperCase();
}

function rawPathOf(event: APIGatewayProxyEventV2): string {
  return event.rawPath ?? "";
}

function match(event: APIGatewayProxyEventV2, method: string, pattern: RegExp): boolean {
  if (methodOf(event) !== method) return false;
  const routeKey = event.routeKey ?? "";
  const path = rawPathOf(event);
  return pattern.test(routeKey.replace(/^[A-Z]+\s+/, "")) || pattern.test(path);
}

function parseBody(event: APIGatewayProxyEventV2): unknown {
  try {
    return event.body ? JSON.parse(event.body) : {};
  } catch {
    return null;
  }
}

function deny(event: APIGatewayProxyEventV2, user: UserContext, permission: Permission): APIGatewayProxyResultV2 | null {
  if (authz.canPerform(user, permission)) return null;
  return withCorrelationHeaders(event, forbidden());
}

function rateLimitWriteBack(connectorId: string): boolean {
  const now = Date.now();
  const windowMs = 60_000;
  const hits = (writeBackWindow.get(connectorId) ?? []).filter((ts) => now - ts < windowMs);
  if (hits.length >= 30) {
    writeBackWindow.set(connectorId, hits);
    return false;
  }
  hits.push(now);
  writeBackWindow.set(connectorId, hits);
  return true;
}

function canSkipWriteBackApproval(user: UserContext): boolean {
  const role = String(user.role ?? "");
  return (
    role === "agencyit" ||
    role === "agencyadmin" ||
    role === "rcadmin" ||
    role === "rcsuperadmin" ||
    role === "rcitadmin"
  );
}

async function writePlatformAudit(params: {
  user: UserContext;
  type: string;
  connectorId?: string;
  resourceType: "cad_connector" | "cad_unified_incident" | "cad_writeback";
  resourceId: string;
  details: Record<string, unknown>;
}): Promise<void> {
  await auditRepo.create({
    eventId: makeId("audit"),
    agencyId: params.user.agencyId,
    actorId: params.user.userId,
    type: params.type,
    details: { ...params.details, connectorId: params.connectorId },
    createdAt: new Date().toISOString(),
    resourceType: params.resourceType,
    resourceId: params.resourceId,
  });
  await cadConnectorAuditStore.append({
    agencyId: params.user.agencyId,
    actorId: params.user.userId,
    type: params.type,
    connectorId: params.connectorId,
    detail: params.details,
  });
}

async function deliverWriteBack(
  user: UserContext,
  writeBack: CadWriteBackRequest,
  overrideUnhealthy?: { justification: string },
): Promise<CadWriteBackRequest> {
  const incident = await cadUnifiedIncidentStore.get(user.agencyId, writeBack.unifiedId);
  if (!incident) {
    return { ...writeBack, status: "failed", resultMessage: "Incident not found" };
  }
  const connectors = await cadConnectorService.list(user.agencyId);
  const resolvedConnectors = [];
  for (const c of connectors) {
    const full = await cadConnectorService.getResolved(user.agencyId, c.connectorId);
    if (full) resolvedConnectors.push(full);
  }
  const rules = await cadConnectorService.getAgencyRoutingRules(user.agencyId);
  const routed = CadRoutingEngine.resolve(writeBack, resolvedConnectors, incident, rules);
  if (!routed.ok) {
    const next: CadWriteBackRequest = {
      ...writeBack,
      status: routed.reason === "no_route" ? "no_route" : "failed",
      resultMessage: routed.reason,
      auditTrail: [
        ...writeBack.auditTrail,
        { at: new Date().toISOString(), actorId: user.userId, action: "route_failed", detail: routed.reason },
      ],
    };
    await cadWriteBackStore.put(next);
    await writePlatformAudit({
      user,
      type:
        routed.reason === "no_route"
          ? AUDIT_EVENT_TYPES.CAD_WRITEBACK_NO_ROUTE
          : AUDIT_EVENT_TYPES.CAD_WRITEBACK_FAILED,
      connectorId: writeBack.resolvedConnectorId,
      resourceType: "cad_writeback",
      resourceId: writeBack.writeBackId,
      details: { reason: routed.reason },
    });
    return next;
  }
  const target = resolvedConnectors.find((c) => c.connectorId === routed.connectorId);
  if (!target) {
    return { ...writeBack, status: "no_route", resultMessage: "no_route" };
  }
  const health = target.lastHealthCheck?.status;
  if (health !== "healthy") {
    if (!overrideUnhealthy?.justification) {
      const blocked: CadWriteBackRequest = {
        ...writeBack,
        resolvedConnectorId: target.connectorId,
        status: "failed",
        resultMessage: "connector_unhealthy",
        auditTrail: [
          ...writeBack.auditTrail,
          { at: new Date().toISOString(), actorId: user.userId, action: "blocked_unhealthy" },
        ],
      };
      await cadWriteBackStore.put(blocked);
      return blocked;
    }
  }
  const adapter = CadAdapterRegistry.resolve(target.vendorId);
  const credentials = await cadConnectorService.resolveCredentials(target);
  const submitted: CadWriteBackRequest = {
    ...writeBack,
    resolvedConnectorId: target.connectorId,
    status: "submitted",
    submittedAt: new Date().toISOString(),
    auditTrail: [
      ...writeBack.auditTrail,
      {
        at: new Date().toISOString(),
        actorId: user.userId,
        action: "submitted",
        detail: overrideUnhealthy ? `override:${overrideUnhealthy.justification.slice(0, 80)}` : undefined,
      },
    ],
  };
  await cadWriteBackStore.put(submitted);
  const result = await adapter.submitWriteBack({ config: target, credentials, writeBack: submitted });
  const delivered: CadWriteBackRequest = {
    ...submitted,
    status: result.success ? "delivered" : "failed",
    resultCode: result.vendorResponseCode,
    resultMessage: result.success ? "delivered" : result.errorMessage,
    auditTrail: [
      ...submitted.auditTrail,
      {
        at: new Date().toISOString(),
        actorId: user.userId,
        action: result.success ? "delivered" : "failed",
        detail: result.errorMessage,
      },
    ],
  };
  await cadWriteBackStore.put(delivered);
  await writePlatformAudit({
    user,
    type: result.success ? AUDIT_EVENT_TYPES.CAD_WRITEBACK_DELIVERED : AUDIT_EVENT_TYPES.CAD_WRITEBACK_FAILED,
    connectorId: target.connectorId,
    resourceType: "cad_writeback",
    resourceId: writeBack.writeBackId,
    details: { success: result.success, resultCode: result.vendorResponseCode },
  });
  return delivered;
}

async function gated(
  event: APIGatewayProxyEventV2,
): Promise<{ user: UserContext } | { response: APIGatewayProxyResultV2 }> {
  if (!cadConnectorEnabled()) {
    return { response: withCorrelationHeaders(event, serviceUnavailable("CAD Connector is not enabled")) };
  }
  const user = await getUserContext(event);
  if (!user) return { response: withCorrelationHeaders(event, unauthorized()) };
  if (!isUserAccountActive(user)) {
    return { response: withCorrelationHeaders(event, unauthorized(ACCOUNT_INACTIVE_MESSAGE)) };
  }
  const addonGate = await requireCadConnectorAddon(event, user);
  if (addonGate) return { response: withCorrelationHeaders(event, addonGate) };
  return { user };
}

/**
 * Multi-CAD Connector HTTP router (`/api/cad-connector/*`).
 * 22 operations share this Lambda (SAM size); ingest/health are separate scheduled functions.
 */
export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    if (methodOf(event) === "OPTIONS") {
      return {
        statusCode: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
          "Access-Control-Allow-Headers": "authorization,content-type",
        },
      };
    }

    const ctx = await gated(event);
    if ("response" in ctx) return ctx.response;
    const { user } = ctx;
    const agencyId = user.agencyId;
    const connectorId = event.pathParameters?.connectorId?.trim();
    const unifiedId = event.pathParameters?.unifiedId?.trim();
    const writeBackId = event.pathParameters?.writeBackId?.trim();

    if (match(event, "GET", /^\/api\/cad-connector\/connectors\/?$/)) {
      const denied = deny(event, user, "cad.connector.view");
      if (denied) return denied;
      const items = (await cadConnectorService.list(agencyId)).map(sanitizeConnectorForClient);
      return withCorrelationHeaders(event, ok({ items }));
    }

    if (match(event, "POST", /^\/api\/cad-connector\/connectors\/?$/)) {
      const denied = deny(event, user, "cad.connector.manage");
      if (denied) return denied;
      const body = parseBody(event);
      if (body === null) return withCorrelationHeaders(event, badRequest("Invalid JSON body"));
      const parsed = cadConnectorCreateBodySchema.safeParse(body);
      if (!parsed.success) return withCorrelationHeaders(event, badRequestFromZod(parsed.error));
      if (parsed.data.vendorId === "generic_rest" && parsed.data.authType !== "api_key" && parsed.data.authType !== "basic") {
        return withCorrelationHeaders(event, badRequest("generic_rest supports api_key or basic auth only"));
      }
      const created = await cadConnectorService.create(agencyId, user.userId, {
        vendorId: parsed.data.vendorId,
        displayName: parsed.data.displayName,
        department: parsed.data.department,
        connectionMode: parsed.data.connectionMode,
        pollingIntervalSeconds: parsed.data.pollingIntervalSeconds,
        baseUrl: parsed.data.baseUrl,
        authType: parsed.data.authType,
        apiKey: parsed.data.apiKey,
        username: parsed.data.username,
        password: parsed.data.password,
        accessToken: parsed.data.accessToken,
        clientCert: parsed.data.clientCert,
        clientKey: parsed.data.clientKey,
        fieldMappings: parsed.data.fieldMappings,
        routingRules: parsed.data.routingRules?.map((rule, index) => ({
          ...rule,
          ruleId: rule.ruleId ?? `cadr_${index}`,
        })),
        enabled: parsed.data.enabled,
      });
      await writePlatformAudit({
        user,
        type: AUDIT_EVENT_TYPES.CAD_CONNECTOR_CREATED,
        connectorId: created.connectorId,
        resourceType: "cad_connector",
        resourceId: created.connectorId,
        details: { vendorId: created.vendorId, displayName: created.displayName },
      });
      return withCorrelationHeaders(event, ok({ connector: sanitizeConnectorForClient(created) }, 201));
    }

    if (match(event, "GET", /^\/api\/cad-connector\/connectors\/[^/]+\/?$/) && connectorId) {
      const denied = deny(event, user, "cad.connector.view");
      if (denied) return denied;
      const row = await cadConnectorService.get(agencyId, connectorId);
      if (!row) return withCorrelationHeaders(event, notFound("Connector not found"));
      return withCorrelationHeaders(event, ok({ connector: sanitizeConnectorForClient(row) }));
    }

    if (match(event, "PUT", /^\/api\/cad-connector\/connectors\/[^/]+\/?$/) && connectorId) {
      const denied = deny(event, user, "cad.connector.manage");
      if (denied) return denied;
      const body = parseBody(event);
      if (body === null) return withCorrelationHeaders(event, badRequest("Invalid JSON body"));
      const parsed = cadConnectorUpdateBodySchema.safeParse(body);
      if (!parsed.success) return withCorrelationHeaders(event, badRequestFromZod(parsed.error));
      const updated = await cadConnectorService.update(agencyId, connectorId, parsed.data);
      if (!updated) return withCorrelationHeaders(event, notFound("Connector not found"));
      await writePlatformAudit({
        user,
        type: AUDIT_EVENT_TYPES.CAD_CONNECTOR_UPDATED,
        connectorId,
        resourceType: "cad_connector",
        resourceId: connectorId,
        details: { fields: Object.keys(parsed.data) },
      });
      return withCorrelationHeaders(event, ok({ connector: sanitizeConnectorForClient(updated) }));
    }

    if (match(event, "DELETE", /^\/api\/cad-connector\/connectors\/[^/]+\/?$/) && connectorId) {
      const denied = deny(event, user, "cad.connector.delete");
      if (denied) return denied;
      const okDel = await cadConnectorService.softDelete(agencyId, connectorId);
      if (!okDel) return withCorrelationHeaders(event, notFound("Connector not found"));
      await writePlatformAudit({
        user,
        type: AUDIT_EVENT_TYPES.CAD_CONNECTOR_DELETED,
        connectorId,
        resourceType: "cad_connector",
        resourceId: connectorId,
        details: { softDelete: true },
      });
      return withCorrelationHeaders(event, ok({ deleted: true }));
    }

    if (match(event, "POST", /^\/api\/cad-connector\/connectors\/[^/]+\/enable\/?$/) && connectorId) {
      const denied = deny(event, user, "cad.connector.manage");
      if (denied) return denied;
      const updated = await cadConnectorService.setEnabled(agencyId, connectorId, true);
      if (!updated) return withCorrelationHeaders(event, notFound("Connector not found"));
      await writePlatformAudit({
        user,
        type: AUDIT_EVENT_TYPES.CAD_CONNECTOR_ENABLED,
        connectorId,
        resourceType: "cad_connector",
        resourceId: connectorId,
        details: { enabled: true },
      });
      return withCorrelationHeaders(event, ok({ connector: sanitizeConnectorForClient(updated) }));
    }

    if (match(event, "POST", /^\/api\/cad-connector\/connectors\/[^/]+\/disable\/?$/) && connectorId) {
      const denied = deny(event, user, "cad.connector.manage");
      if (denied) return denied;
      const updated = await cadConnectorService.setEnabled(agencyId, connectorId, false);
      if (!updated) return withCorrelationHeaders(event, notFound("Connector not found"));
      await writePlatformAudit({
        user,
        type: AUDIT_EVENT_TYPES.CAD_CONNECTOR_DISABLED,
        connectorId,
        resourceType: "cad_connector",
        resourceId: connectorId,
        details: { enabled: false },
      });
      return withCorrelationHeaders(event, ok({ connector: sanitizeConnectorForClient(updated) }));
    }

    if (match(event, "POST", /^\/api\/cad-connector\/connectors\/[^/]+\/health-check\/?$/) && connectorId) {
      const denied = deny(event, user, "cad.health.view");
      if (denied) return denied;
      const config = await cadConnectorService.getResolved(agencyId, connectorId);
      if (!config) return withCorrelationHeaders(event, notFound("Connector not found"));
      const adapter = CadAdapterRegistry.resolve(config.vendorId);
      const credentials = await cadConnectorService.resolveCredentials(config);
      const health = await adapter.healthCheck({ config, credentials });
      await cadConnectorService.updateHealth(agencyId, connectorId, health);
      await writePlatformAudit({
        user,
        type: AUDIT_EVENT_TYPES.CAD_CONNECTOR_HEALTH_CHECK,
        connectorId,
        resourceType: "cad_connector",
        resourceId: connectorId,
        details: { status: health.status, latencyMs: health.latencyMs },
      });
      return withCorrelationHeaders(event, ok({ health }));
    }

    if (match(event, "POST", /^\/api\/cad-connector\/connectors\/[^/]+\/test-fetch\/?$/) && connectorId) {
      const denied = deny(event, user, "cad.connector.manage");
      if (denied) return denied;
      const config = await cadConnectorService.getResolved(agencyId, connectorId);
      if (!config) return withCorrelationHeaders(event, notFound("Connector not found"));
      const adapter = CadAdapterRegistry.resolve(config.vendorId);
      const credentials = await cadConnectorService.resolveCredentials(config);
      const fetched = await adapter.fetchIncidents({ config, credentials, limit: 5 });
      await writePlatformAudit({
        user,
        type: AUDIT_EVENT_TYPES.CAD_CONNECTOR_TEST_FETCH,
        connectorId,
        resourceType: "cad_connector",
        resourceId: connectorId,
        details: { rawCount: fetched.rawCount, normalizedCount: fetched.normalizedCount },
      });
      return withCorrelationHeaders(
        event,
        ok({
          fetchedAt: fetched.fetchedAt,
          rawCount: fetched.rawCount,
          normalizedCount: fetched.normalizedCount,
          errors: fetched.errors,
          incidents: fetched.incidents.map(stripRawVendorPayload),
        }),
      );
    }

    if (match(event, "GET", /^\/api\/cad-connector\/connectors\/[^/]+\/mappings\/?$/) && connectorId) {
      const denied = deny(event, user, "cad.fieldmapping.manage");
      if (denied) return denied;
      const row = await cadConnectorService.get(agencyId, connectorId);
      if (!row) return withCorrelationHeaders(event, notFound("Connector not found"));
      return withCorrelationHeaders(event, ok({ mappings: row.fieldMappings }));
    }

    if (match(event, "PUT", /^\/api\/cad-connector\/connectors\/[^/]+\/mappings\/?$/) && connectorId) {
      const denied = deny(event, user, "cad.fieldmapping.manage");
      if (denied) return denied;
      const body = parseBody(event);
      if (body === null) return withCorrelationHeaders(event, badRequest("Invalid JSON body"));
      const parsed = cadFieldMappingsPutBodySchema.safeParse(body);
      if (!parsed.success) return withCorrelationHeaders(event, badRequestFromZod(parsed.error));
      const mappings = parsed.data.mappings.map((m, i) => ({
        ...m,
        mappingId: m.mappingId ?? `map_${i}_${Date.now()}`,
      }));
      const updated = await cadConnectorService.replaceMappings(agencyId, connectorId, mappings);
      if (!updated) return withCorrelationHeaders(event, notFound("Connector not found"));
      await writePlatformAudit({
        user,
        type: AUDIT_EVENT_TYPES.CAD_FIELDMAPPING_UPDATED,
        connectorId,
        resourceType: "cad_connector",
        resourceId: connectorId,
        details: { count: mappings.length },
      });
      return withCorrelationHeaders(event, ok({ mappings: updated.fieldMappings }));
    }

    if (match(event, "GET", /^\/api\/cad-connector\/routing-rules\/?$/)) {
      const denied = deny(event, user, "cad.routing.manage");
      if (denied) return denied;
      const rules = await cadConnectorService.getAgencyRoutingRules(agencyId);
      return withCorrelationHeaders(event, ok({ rules }));
    }

    if (match(event, "PUT", /^\/api\/cad-connector\/routing-rules\/?$/)) {
      const denied = deny(event, user, "cad.routing.manage");
      if (denied) return denied;
      const body = parseBody(event);
      if (body === null) return withCorrelationHeaders(event, badRequest("Invalid JSON body"));
      const parsed = cadRoutingRulesPutBodySchema.safeParse(body);
      if (!parsed.success) return withCorrelationHeaders(event, badRequestFromZod(parsed.error));
      const rules = parsed.data.rules.map((rule, i) => ({
        ...rule,
        ruleId: rule.ruleId ?? `cadr_${i}_${Date.now()}`,
      }));
      await cadConnectorService.replaceAgencyRoutingRules(agencyId, rules, user.userId);
      await writePlatformAudit({
        user,
        type: AUDIT_EVENT_TYPES.CAD_ROUTING_UPDATED,
        resourceType: "cad_connector",
        resourceId: agencyId,
        details: { count: rules.length },
      });
      return withCorrelationHeaders(event, ok({ rules }));
    }

    if (match(event, "GET", /^\/api\/cad-connector\/incidents\/?$/)) {
      const denied = deny(event, user, "cad.incidents.view");
      if (denied) return denied;
      const parsed = cadIncidentListQuerySchema.safeParse(event.queryStringParameters ?? {});
      if (!parsed.success) return withCorrelationHeaders(event, badRequestFromZod(parsed.error));
      const listed = await cadUnifiedIncidentStore.list({
        agencyId,
        status: parsed.data.status,
        connectorId: parsed.data.connectorId,
        department: parsed.data.department,
        activeOnly: parsed.data.activeOnly,
        limit: parsed.data.limit ?? 50,
        cursor: parsed.data.cursor ? { unifiedId: parsed.data.cursor } : undefined,
      });
      return withCorrelationHeaders(
        event,
        ok({
          items: listed.items.map(stripRawVendorPayload),
          nextCursor: listed.nextCursor,
        }),
      );
    }

    if (match(event, "GET", /^\/api\/cad-connector\/incidents\/[^/]+\/duplicates\/?$/) && unifiedId) {
      const denied = deny(event, user, "cad.incidents.view");
      if (denied) return denied;
      const items = await cadUnifiedIncidentStore.listDuplicates(agencyId, unifiedId);
      return withCorrelationHeaders(event, ok({ items: items.map(stripRawVendorPayload) }));
    }

    if (match(event, "GET", /^\/api\/cad-connector\/incidents\/[^/]+\/?$/) && unifiedId) {
      const denied = deny(event, user, "cad.incidents.view");
      if (denied) return denied;
      const incident = await cadUnifiedIncidentStore.get(agencyId, unifiedId);
      if (!incident) return withCorrelationHeaders(event, notFound("Incident not found"));
      return withCorrelationHeaders(event, ok({ incident: stripRawVendorPayload(incident) }));
    }

    if (match(event, "POST", /^\/api\/cad-connector\/write-back\/?$/)) {
      const denied = deny(event, user, "cad.writeback.submit");
      if (denied) return denied;
      const body = parseBody(event);
      if (body === null) return withCorrelationHeaders(event, badRequest("Invalid JSON body"));
      const parsed = cadWriteBackSubmitBodySchema.safeParse(body);
      if (!parsed.success) return withCorrelationHeaders(event, badRequestFromZod(parsed.error));
      const incident = await cadUnifiedIncidentStore.get(agencyId, parsed.data.unifiedId);
      if (!incident) return withCorrelationHeaders(event, notFound("Incident not found"));
      const connectors = await cadConnectorService.list(agencyId);
      const rules = await cadConnectorService.getAgencyRoutingRules(agencyId);
      const now = new Date().toISOString();
      const draft: CadWriteBackRequest = {
        writeBackId: newWriteBackId(),
        agencyId,
        unifiedId: parsed.data.unifiedId,
        requestedByUserId: user.userId,
        requestedAt: now,
        status: "pending_routing",
        payload: parsed.data.payload,
        auditTrail: [{ at: now, actorId: user.userId, action: "submitted" }],
      };
      const routed = CadRoutingEngine.resolve(draft, connectors, incident, rules);
      if (!routed.ok) {
        const blocked: CadWriteBackRequest = { ...draft, status: "no_route", resultMessage: routed.reason };
        await cadWriteBackStore.put(blocked);
        await writePlatformAudit({
          user,
          type: AUDIT_EVENT_TYPES.CAD_WRITEBACK_NO_ROUTE,
          resourceType: "cad_writeback",
          resourceId: blocked.writeBackId,
          details: { reason: routed.reason },
        });
        return withCorrelationHeaders(event, ok({ writeBack: blocked }, 201));
      }
      if (!rateLimitWriteBack(routed.connectorId)) {
        return withCorrelationHeaders(event, jsonStatus({ error: "rate_limited", code: "WRITEBACK_RATE_LIMIT" }, 429));
      }
      const requiresApproval = routed.rule.requireSupervisorApproval || !canSkipWriteBackApproval(user);
      const pending: CadWriteBackRequest = {
        ...draft,
        resolvedConnectorId: routed.connectorId,
        status: requiresApproval ? "pending_approval" : "approved",
        supervisorApprovalByUserId: requiresApproval ? undefined : user.userId,
        supervisorApprovalAt: requiresApproval ? undefined : now,
      };
      await cadWriteBackStore.put(pending);
      await writePlatformAudit({
        user,
        type: AUDIT_EVENT_TYPES.CAD_WRITEBACK_SUBMITTED,
        connectorId: routed.connectorId,
        resourceType: "cad_writeback",
        resourceId: pending.writeBackId,
        details: { unifiedId: pending.unifiedId, status: pending.status },
      });
      if (!requiresApproval) {
        const delivered = await deliverWriteBack(user, pending);
        return withCorrelationHeaders(event, ok({ writeBack: delivered }, 201));
      }
      return withCorrelationHeaders(event, ok({ writeBack: pending }, 201));
    }

    if (match(event, "GET", /^\/api\/cad-connector\/write-back\/?$/)) {
      const denied = deny(event, user, "cad.writeback.view_queue");
      if (denied) return denied;
      const parsed = cadWriteBackListQuerySchema.safeParse(event.queryStringParameters ?? {});
      if (!parsed.success) return withCorrelationHeaders(event, badRequestFromZod(parsed.error));
      const items = await cadWriteBackStore.list({
        agencyId,
        status: parsed.data.status,
        unifiedId: parsed.data.unifiedId,
        limit: parsed.data.limit ?? 50,
      });
      return withCorrelationHeaders(event, ok({ items }));
    }

    if (match(event, "GET", /^\/api\/cad-connector\/write-back\/[^/]+\/?$/) && writeBackId) {
      const denied = deny(event, user, "cad.writeback.view_queue");
      if (denied) return denied;
      const row = await cadWriteBackStore.get(agencyId, writeBackId);
      if (!row) return withCorrelationHeaders(event, notFound("Write-back not found"));
      return withCorrelationHeaders(event, ok({ writeBack: row }));
    }

    if (match(event, "POST", /^\/api\/cad-connector\/write-back\/[^/]+\/approve\/?$/) && writeBackId) {
      const denied = deny(event, user, "cad.writeback.approve");
      if (denied) return denied;
      const body = parseBody(event) ?? {};
      const parsed = cadWriteBackApproveBodySchema.safeParse(body);
      if (!parsed.success) return withCorrelationHeaders(event, badRequestFromZod(parsed.error));
      if (parsed.data.overrideUnhealthy && !parsed.data.justification) {
        return withCorrelationHeaders(event, badRequest("justification is required to override an unhealthy connector"));
      }
      const existing = await cadWriteBackStore.get(agencyId, writeBackId);
      if (!existing) return withCorrelationHeaders(event, notFound("Write-back not found"));
      if (existing.status !== "pending_approval") {
        return withCorrelationHeaders(event, badRequest("Write-back is not pending approval"));
      }
      const approved: CadWriteBackRequest = {
        ...existing,
        status: "approved",
        supervisorApprovalByUserId: user.userId,
        supervisorApprovalAt: new Date().toISOString(),
        auditTrail: [
          ...existing.auditTrail,
          { at: new Date().toISOString(), actorId: user.userId, action: "approved" },
        ],
      };
      await cadWriteBackStore.put(approved);
      await writePlatformAudit({
        user,
        type: AUDIT_EVENT_TYPES.CAD_WRITEBACK_APPROVED,
        connectorId: approved.resolvedConnectorId,
        resourceType: "cad_writeback",
        resourceId: approved.writeBackId,
        details: { unifiedId: approved.unifiedId },
      });
      const delivered = await deliverWriteBack(
        user,
        approved,
        parsed.data.overrideUnhealthy && parsed.data.justification
          ? { justification: parsed.data.justification }
          : undefined,
      );
      return withCorrelationHeaders(event, ok({ writeBack: delivered }));
    }

    if (match(event, "POST", /^\/api\/cad-connector\/write-back\/[^/]+\/reject\/?$/) && writeBackId) {
      const denied = deny(event, user, "cad.writeback.reject");
      if (denied) return denied;
      const body = parseBody(event);
      if (body === null) return withCorrelationHeaders(event, badRequest("Invalid JSON body"));
      const parsed = cadWriteBackRejectBodySchema.safeParse(body);
      if (!parsed.success) return withCorrelationHeaders(event, badRequestFromZod(parsed.error));
      const existing = await cadWriteBackStore.get(agencyId, writeBackId);
      if (!existing) return withCorrelationHeaders(event, notFound("Write-back not found"));
      if (existing.status !== "pending_approval") {
        return withCorrelationHeaders(event, badRequest("Write-back is not pending approval"));
      }
      const rejected: CadWriteBackRequest = {
        ...existing,
        status: "rejected",
        rejectReason: parsed.data.reason,
        supervisorApprovalByUserId: user.userId,
        supervisorApprovalAt: new Date().toISOString(),
        auditTrail: [
          ...existing.auditTrail,
          { at: new Date().toISOString(), actorId: user.userId, action: "rejected", detail: parsed.data.reason.slice(0, 120) },
        ],
      };
      await cadWriteBackStore.put(rejected);
      await writePlatformAudit({
        user,
        type: AUDIT_EVENT_TYPES.CAD_WRITEBACK_REJECTED,
        connectorId: rejected.resolvedConnectorId,
        resourceType: "cad_writeback",
        resourceId: rejected.writeBackId,
        details: { unifiedId: rejected.unifiedId },
      });
      return withCorrelationHeaders(event, ok({ writeBack: rejected }));
    }

    if (match(event, "GET", /^\/api\/cad-connector\/status\/?$/)) {
      if (!authz.canPerform(user, "cad.incidents.view") && !authz.canPerform(user, "cad.health.view")) {
        return withCorrelationHeaders(event, forbidden());
      }
      const items = (await cadConnectorService.list(agencyId)).map((c) => ({
        connectorId: c.connectorId,
        displayName: c.displayName,
        department: c.department,
        vendorId: c.vendorId,
        enabled: c.enabled,
        lastHealthCheck: c.lastHealthCheck,
        lastSyncAt: c.lastSyncAt,
      }));
      return withCorrelationHeaders(event, ok({ items }));
    }

    if (match(event, "GET", /^\/api\/cad-connector\/audit\/?$/)) {
      const denied = deny(event, user, "cad.audit.view");
      if (denied) return denied;
      const parsed = cadAuditListQuerySchema.safeParse(event.queryStringParameters ?? {});
      if (!parsed.success) return withCorrelationHeaders(event, badRequestFromZod(parsed.error));
      const items = await cadConnectorAuditStore.list({
        agencyId,
        connectorId: parsed.data.connectorId,
        type: parsed.data.type,
        limit: parsed.data.limit ?? 50,
      });
      return withCorrelationHeaders(event, ok({ items }));
    }

    if (match(event, "POST", /^\/api\/cad-connector\/internal\/ingest\/[^/]+\/?$/) && connectorId) {
      if (user.role !== "rcsuperadmin" && user.role !== "rcadmin") {
        return withCorrelationHeaders(event, forbidden());
      }
      const config = await cadConnectorService.getResolved(agencyId, connectorId);
      if (!config) return withCorrelationHeaders(event, notFound("Connector not found"));
      const result = await cadIngestionService.ingestConnector(config, user.userId);
      return withCorrelationHeaders(event, ok({ result }));
    }

    return withCorrelationHeaders(event, notFound());
  } catch (err) {
    console.error("cadConnectorHttp", err);
    return withCorrelationHeaders(event, serverError());
  }
};
