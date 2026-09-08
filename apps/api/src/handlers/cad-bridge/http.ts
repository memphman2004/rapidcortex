import type { APIGatewayProxyEventV2, APIGatewayProxyHandlerV2 } from "aws-lambda";
import {
  CadBridgeConfigValidationError,
  CadBridgeTransferError,
  acceptIncidentTransfer,
  buildDefaultCadBridgeConfig,
  cadBridgeConfigPutSchema,
  cadBridgeConflictResolveSchema,
  cadBridgeEnabledPatchSchema,
  cadBridgeSyncRulesPatchSchema,
  cadBridgeTransferRequestSchema,
  cancelIncidentTransfer,
  defaultTransferDestination,
  isRcInternalOperator,
  requestIncidentTransfer,
  type CADBridgeConfig,
} from "rapid-cortex-shared";
import { AUDIT_EVENT_TYPES, AuthorizationService, type Permission } from "rapid-cortex-security";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../../lib/auth.js";
import { withCorrelationHeaders } from "../../lib/correlation.js";
import { env } from "../../lib/env.js";
import { makeId } from "../../lib/ids.js";
import {
  badRequest,
  badRequestFromZod,
  conflict,
  forbidden,
  notFound,
  ok,
  serverError,
  serviceUnavailable,
  unauthorized,
} from "../../lib/response.js";
import { AuditRepository } from "../../repositories/auditRepository.js";
import { getCadBridgeAdapter } from "../../cad-bridge/adapters/index.js";
import { cadBridgeStore, isCadBridgeStoreConfigured } from "../../cad-bridge/store.js";
import { resolveCadBridgeSecret } from "../../cad-bridge/secrets.js";

const authz = new AuthorizationService();
const auditRepo = new AuditRepository();

function requirePerm(user: { role: string; agencyId: string; userId: string }, perm: Permission) {
  if (!authz.canPerform(user, perm)) throw new Error("FORBIDDEN");
}

function requireAnyPerm(user: { role: string; agencyId: string; userId: string }, perms: Permission[]) {
  if (!perms.some((perm) => authz.canPerform(user, perm))) throw new Error("FORBIDDEN");
}

function parseBody(raw: string | undefined): unknown {
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function rest(path: string): string[] {
  const idx = path.indexOf("/api/cad-bridge/");
  const tail = idx >= 0 ? path.slice(idx + "/api/cad-bridge/".length) : "";
  return tail.split("/").filter(Boolean).map(decodeURIComponent);
}

function resolveAgencyId(
  user: { role: string; agencyId: string },
  event: APIGatewayProxyEventV2,
): string {
  const requested = event.queryStringParameters?.agencyId?.trim();
  if (isRcInternalOperator(user.role) && requested) return requested;
  return user.agencyId;
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    if (!env.enableCadBridge || !isCadBridgeStoreConfigured()) {
      return withCorrelationHeaders(event, serviceUnavailable("CAD bridge is not enabled"));
    }
    const user = await getUserContext(event);
    if (!user) return withCorrelationHeaders(event, unauthorized());
    if (!isUserAccountActive(user)) return withCorrelationHeaders(event, unauthorized(ACCOUNT_INACTIVE_MESSAGE));

    const agencyId = resolveAgencyId(user, event);
    if (!isRcInternalOperator(user.role) && user.agencyId !== agencyId) {
      return withCorrelationHeaders(event, forbidden());
    }

    const method = event.requestContext.http.method.toUpperCase();
    const parts = rest(event.rawPath ?? "");
    const body = parseBody(event.body);
    if (event.body && body === null) return withCorrelationHeaders(event, badRequest("Invalid JSON"));

    if (method === "GET" && parts[0] === "config" && parts.length === 1) {
      requireAnyPerm(user, ["cad.connector.view", "cad.incidents.view", "cad.health.view"]);
      const existing = await cadBridgeStore.getConfig(agencyId);
      const config = existing ?? buildDefaultCadBridgeConfig(agencyId, makeId("br"));
      return withCorrelationHeaders(
        event,
        ok({
          config,
          brokerNotice:
            "Rapid Cortex is the broker, not the source of truth. If RC is unavailable, both CADs keep operating independently and only stop syncing until RC recovers.",
          writebackEnabled: env.cadWritebackEnabled,
          mockMode: env.cadBridgeMock,
        }),
      );
    }

    if (method === "PUT" && parts[0] === "config" && parts.length === 1) {
      requirePerm(user, "cad.connector.manage");
      const parsed = cadBridgeConfigPutSchema.safeParse(body);
      if (!parsed.success) return withCorrelationHeaders(event, badRequestFromZod(parsed.error));
      const existing = await cadBridgeStore.getConfig(agencyId);
      const now = new Date().toISOString();
      const next: CADBridgeConfig = {
        ...(existing ?? buildDefaultCadBridgeConfig(agencyId, parsed.data.bridgeId ?? makeId("br"))),
        ...parsed.data,
        agencyId,
        bridgeId: parsed.data.bridgeId ?? existing?.bridgeId ?? makeId("br"),
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      };
      try {
        await cadBridgeStore.putConfig(next, existing?.updatedAt);
      } catch (err) {
        if (err instanceof CadBridgeConfigValidationError) {
          return withCorrelationHeaders(event, badRequest(err.message));
        }
        const name = err && typeof err === "object" && "name" in err ? String(err.name) : "";
        if (name === "ConditionalCheckFailedException") {
          return withCorrelationHeaders(event, conflict("Bridge config was updated by another operator"));
        }
        throw err;
      }
      await auditRepo.create({
        eventId: makeId("aud"),
        agencyId,
        actorId: user.userId,
        type: AUDIT_EVENT_TYPES.CAD_BRIDGE_CONFIG_UPDATED,
        details: { enabled: next.enabled, primaryCAD: next.primaryCAD },
        createdAt: now,
        resourceType: "cad_bridge",
        resourceId: next.bridgeId,
      });
      return withCorrelationHeaders(event, ok({ config: next }));
    }

    if (method === "PATCH" && parts[0] === "config" && parts[1] === "enabled") {
      requirePerm(user, "cad.connector.manage");
      const parsed = cadBridgeEnabledPatchSchema.safeParse(body);
      if (!parsed.success) return withCorrelationHeaders(event, badRequestFromZod(parsed.error));
      const existing = await cadBridgeStore.getConfig(agencyId);
      if (!existing) return withCorrelationHeaders(event, notFound("Bridge config not found"));
      const next = { ...existing, enabled: parsed.data.enabled, updatedAt: new Date().toISOString() };
      await cadBridgeStore.putConfig(next, existing.updatedAt);
      return withCorrelationHeaders(event, ok({ config: next }));
    }

    if (method === "PATCH" && parts[0] === "config" && parts[1] === "sync-rules") {
      requirePerm(user, "cad.connector.manage");
      const parsed = cadBridgeSyncRulesPatchSchema.safeParse(body);
      if (!parsed.success) return withCorrelationHeaders(event, badRequestFromZod(parsed.error));
      const existing = await cadBridgeStore.getConfig(agencyId);
      if (!existing) return withCorrelationHeaders(event, notFound("Bridge config not found"));
      const next = {
        ...existing,
        syncRules: { ...existing.syncRules, ...parsed.data },
        updatedAt: new Date().toISOString(),
      };
      await cadBridgeStore.putConfig(next, existing.updatedAt);
      return withCorrelationHeaders(event, ok({ config: next }));
    }

    if (method === "GET" && parts[0] === "health") {
      requirePerm(user, "cad.health.view");
      const config = await cadBridgeStore.getConfig(agencyId);
      const [cbA, cbB, bufferSize] = await Promise.all([
        cadBridgeStore.getCircuitBreaker(agencyId, "CAD_A"),
        cadBridgeStore.getCircuitBreaker(agencyId, "CAD_B"),
        cadBridgeStore.countBuffered(agencyId),
      ]);
      return withCorrelationHeaders(
        event,
        ok({
          enabled: Boolean(config?.enabled),
          mockMode: env.cadBridgeMock,
          writebackEnabled: env.cadWritebackEnabled,
          brokerNotice:
            "Rapid Cortex is the broker, not the source of truth. Both CADs remain independently operational if RC is unavailable.",
          cadA: { vendor: config?.cadA.vendor, circuit: cbA?.state ?? "CLOSED", inbound: config?.cadA.inboundEnabled },
          cadB: { vendor: config?.cadB.vendor, circuit: cbB?.state ?? "CLOSED", inbound: config?.cadB.inboundEnabled },
          pendingBufferSize: bufferSize,
        }),
      );
    }

    if (method === "GET" && parts[0] === "conflicts") {
      requirePerm(user, "cad.health.view");
      const items = await cadBridgeStore.listConflicts(agencyId);
      return withCorrelationHeaders(event, ok({ items }));
    }

    if (method === "POST" && parts[0] === "conflicts" && parts[2] === "resolve") {
      requirePerm(user, "cad.writeback.approve");
      const parsed = cadBridgeConflictResolveSchema.safeParse({ ...(body as object), conflictId: parts[1] });
      if (!parsed.success) return withCorrelationHeaders(event, badRequestFromZod(parsed.error));
      const items = await cadBridgeStore.listConflicts(agencyId);
      const found = items.find((c) => c.conflictId === parsed.data.conflictId);
      if (!found) return withCorrelationHeaders(event, notFound("Conflict not found"));
      const incident = await cadBridgeStore.getIncident(agencyId, found.rcIncidentId);
      if (!incident) return withCorrelationHeaders(event, notFound("Incident not found"));
      const keepSlot = parsed.data.keepSlot ?? (parsed.data.resolution === "PRIMARY_WINS" ? (await cadBridgeStore.getConfig(agencyId))?.primaryCAD ?? "CAD_A" : "CAD_A");
      const keepValue = keepSlot === "CAD_A" ? found.cadAValue : found.cadBValue;
      const nextIncident = {
        ...incident,
        pendingConflicts: incident.pendingConflicts.filter((c) => c.conflictId !== found.conflictId),
        syncState: incident.pendingConflicts.filter((c) => c.conflictId !== found.conflictId).length ? "CONFLICT" as const : "IN_SYNC" as const,
        updatedAt: new Date().toISOString(),
        ...(found.field === "priority" || found.field === "type" || found.field === "status" || found.field === "location"
          ? { [found.field]: keepValue }
          : {}),
      };
      await cadBridgeStore.saveIncident(nextIncident);
      await cadBridgeStore.deleteConflict(agencyId, found.conflictId);
      await auditRepo.create({
        eventId: makeId("aud"),
        agencyId,
        actorId: user.userId,
        type: AUDIT_EVENT_TYPES.CAD_BRIDGE_CONFLICT_RESOLVED,
        details: { conflictId: found.conflictId, resolution: parsed.data.resolution, rcIncidentId: incident.rcIncidentId },
        createdAt: new Date().toISOString(),
        resourceType: "cad_bridge_incident",
        resourceId: incident.rcIncidentId,
      });
      return withCorrelationHeaders(event, ok({ incident: nextIncident }));
    }

    if (method === "GET" && parts[0] === "audit") {
      requirePerm(user, "cad.audit.view");
      const rcIncidentId = event.queryStringParameters?.rcIncidentId?.trim();
      if (!rcIncidentId) return withCorrelationHeaders(event, badRequest("rcIncidentId is required"));
      const items = await cadBridgeStore.listAudit(agencyId, rcIncidentId);
      return withCorrelationHeaders(event, ok({ items }));
    }

    if (method === "GET" && parts[0] === "incidents" && parts[1]) {
      requireAnyPerm(user, ["cad.connector.view", "cad.incidents.view"]);
      const incident = await cadBridgeStore.getIncident(agencyId, parts[1]);
      if (!incident) return withCorrelationHeaders(event, notFound("Incident not found"));
      return withCorrelationHeaders(event, ok({ incident }));
    }

    if (method === "POST" && parts[0] === "incidents" && parts[2] === "transfer" && !parts[3]) {
      requirePerm(user, "cad.writeback.submit");
      const parsed = cadBridgeTransferRequestSchema.safeParse(body ?? {});
      const incident = await cadBridgeStore.getIncident(agencyId, parts[1]);
      if (!incident) return withCorrelationHeaders(event, notFound("Incident not found"));
      const toSlot = parsed.success ? parsed.data.toSlot : defaultTransferDestination(incident);
      const config = await cadBridgeStore.getConfig(agencyId);
      const next = requestIncidentTransfer({
        incident,
        requestedBy: user.userId,
        toSlot,
        nowIso: new Date().toISOString(),
        timeoutSeconds: config?.transferTimeoutSeconds ?? 300,
      });
      await cadBridgeStore.saveIncident(next);
      await auditRepo.create({
        eventId: makeId("aud"),
        agencyId,
        actorId: user.userId,
        type: AUDIT_EVENT_TYPES.CAD_BRIDGE_TRANSFER,
        details: { action: "REQUESTED", rcIncidentId: next.rcIncidentId, toSlot },
        createdAt: next.updatedAt,
        resourceType: "cad_bridge_incident",
        resourceId: next.rcIncidentId,
      });
      return withCorrelationHeaders(event, ok({ incident: next }));
    }

    if (method === "POST" && parts[0] === "incidents" && parts[2] === "transfer" && parts[3] === "accept") {
      requirePerm(user, "cad.writeback.approve");
      const incident = await cadBridgeStore.getIncident(agencyId, parts[1]);
      if (!incident) return withCorrelationHeaders(event, notFound("Incident not found"));
      const next = acceptIncidentTransfer({
        incident,
        acceptedBy: user.userId,
        nowIso: new Date().toISOString(),
      });
      await cadBridgeStore.saveIncident(next);
      await auditRepo.create({
        eventId: makeId("aud"),
        agencyId,
        actorId: user.userId,
        type: AUDIT_EVENT_TYPES.CAD_BRIDGE_TRANSFER,
        details: { action: "ACCEPTED", rcIncidentId: next.rcIncidentId, owner: next.owner },
        createdAt: next.updatedAt,
        resourceType: "cad_bridge_incident",
        resourceId: next.rcIncidentId,
      });
      return withCorrelationHeaders(event, ok({ incident: next }));
    }

    if (method === "POST" && parts[0] === "incidents" && parts[2] === "transfer" && parts[3] === "cancel") {
      requirePerm(user, "cad.writeback.approve");
      const incident = await cadBridgeStore.getIncident(agencyId, parts[1]);
      if (!incident) return withCorrelationHeaders(event, notFound("Incident not found"));
      const next = cancelIncidentTransfer({ incident, nowIso: new Date().toISOString() });
      await cadBridgeStore.saveIncident(next);
      return withCorrelationHeaders(event, ok({ incident: next }));
    }

    if (method === "POST" && parts[0] === "test-connection") {
      requirePerm(user, "cad.connector.manage");
      const config = await cadBridgeStore.getConfig(agencyId);
      if (!config) return withCorrelationHeaders(event, notFound("Bridge config not found"));
      const slot = (body as { slot?: string } | null)?.slot === "CAD_B" ? "CAD_B" : "CAD_A";
      const slotConfig = slot === "CAD_A" ? config.cadA : config.cadB;
      const adapter = getCadBridgeAdapter(slotConfig.vendor);
      const synthetic = JSON.stringify({
        eventType: "INCIDENT_CREATED",
        incidentData: { incidentId: "RC-SYNTHETIC", callType: "TEST", priority: 3, status: "ACTIVE" },
      });
      const parsedEvent = await adapter.parseInbound(synthetic, {}, agencyId);
      const canonical = adapter.toCanonical(parsedEvent);
      let live = { attempted: false, ok: false as boolean };
      if (!env.cadBridgeMock && env.cadWritebackEnabled && slotConfig.baseUrl) {
        live.attempted = true;
        try {
          await resolveCadBridgeSecret(slotConfig.apiKeySecretArn, "apiKey");
          const res = await fetch(`${slotConfig.baseUrl}${adapter.getEndpoints().health}`, {
            method: "GET",
            signal: AbortSignal.timeout(slotConfig.timeoutMs),
          });
          live.ok = res.ok;
        } catch {
          live.ok = false;
        }
      }
      await auditRepo.create({
        eventId: makeId("aud"),
        agencyId,
        actorId: user.userId,
        type: AUDIT_EVENT_TYPES.CAD_BRIDGE_TEST_CONNECTION,
        details: { slot, vendor: slotConfig.vendor, mock: env.cadBridgeMock, live },
        createdAt: new Date().toISOString(),
        resourceType: "cad_bridge",
        resourceId: config.bridgeId,
      });
      return withCorrelationHeaders(
        event,
        ok({
          ok: true,
          slot,
          vendor: slotConfig.vendor,
          parsedEventType: parsedEvent.eventType,
          canonicalType: canonical.type,
          mockMode: env.cadBridgeMock,
          live,
        }),
      );
    }

    return withCorrelationHeaders(event, notFound("Unknown route"));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message === "FORBIDDEN") return withCorrelationHeaders(event, forbidden());
    if (error instanceof CadBridgeTransferError) return withCorrelationHeaders(event, badRequest(error.message));
    console.error("[cad-bridge.http]", error);
    return withCorrelationHeaders(event, serverError());
  }
};
