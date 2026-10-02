import type { APIGatewayProxyEventV2, APIGatewayProxyHandlerV2 } from "aws-lambda";
import { z } from "zod";
import {
  cadBridgeVendorSchema,
  cadSlotPathToken,
  cadSlotSchema,
  isRcInternalOperator,
  parseCadSlotPathToken,
  type CADSlot,
} from "rapid-cortex-shared";
import { AUDIT_EVENT_TYPES, AuthorizationService, type Permission } from "rapid-cortex-security";
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
  serviceUnavailable,
  unauthorized,
} from "../../lib/response.js";
import { AuditRepository } from "../../repositories/auditRepository.js";
import { validateEido } from "../../c2c/eido/validator.js";
import { getC2cRuntime, resetC2cRuntime } from "../../c2c/runtime.js";
import { getRegionalUnits } from "../../c2c/avl/regional-map-api.js";
import { getAgencySlots, patchSlot } from "../../c2c/slots.js";

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
  const idx = path.indexOf("/api/c2c/");
  const tail = idx >= 0 ? path.slice(idx + "/api/c2c/".length) : "";
  return tail.split("/").filter(Boolean).map(decodeURIComponent);
}

function resolveAgencyId(user: { role: string; agencyId: string }, event: APIGatewayProxyEventV2): string {
  const requested = event.queryStringParameters?.agencyId?.trim();
  if (isRcInternalOperator(user.role) && requested) return requested;
  return user.agencyId;
}

function webhookUrlFor(agencyId: string, slot: CADSlot): string {
  const base = (env.cadPublicApiBaseUrl || env.appBaseUrl).replace(/\/$/, "");
  return `${base}/api/public/c2c/${encodeURIComponent(agencyId)}/${cadSlotPathToken(slot)}/events`;
}

function parseSlotToken(token: string): CADSlot | null {
  return parseCadSlotPathToken(token) ?? (cadSlotSchema.safeParse(token.toUpperCase()).success ? (token.toUpperCase() as CADSlot) : null);
}

const transferBodySchema = z.object({
  targetAgencyId: z.string().min(1),
  reason: z.string().min(1).optional(),
  autoDispatch: z.boolean().optional(),
});

const agencyBodySchema = z.object({
  agencyId: z.string().min(1),
  agencyName: z.string().min(1),
  agencyType: z.enum(["LAW_ENFORCEMENT", "FIRE", "EMS", "COMBINED"]),
  jurisdictionCodes: z.array(z.string()).default([]),
  dataShareAgreements: z.array(z.string()).default([]),
});

const ruleBodySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
  enabled: z.boolean(),
  priority: z.number().int(),
  sourceAgencies: z.union([z.literal("*"), z.array(z.string())]),
  conditions: z.array(z.record(z.unknown())),
  targetAgencies: z.array(z.string()),
  action: z.enum(["FORWARD", "ALERT", "FORWARD_AND_ALERT"]),
  requiresApproval: z.boolean(),
  autoDispatch: z.boolean(),
});

const slotPatchSchema = z.object({
  enabled: z.boolean().optional(),
  inboundEnabled: z.boolean().optional(),
  outboundEnabled: z.boolean().optional(),
  label: z.string().min(1).max(80).optional(),
  vendor: cadBridgeVendorSchema.optional(),
  baseUrl: z.string().url().optional(),
});

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    if (!env.enableC2cHub) {
      return withCorrelationHeaders(event, serviceUnavailable("C2C hub is not enabled"));
    }
    const user = await getUserContext(event);
    if (!user) return withCorrelationHeaders(event, unauthorized());
    if (!isUserAccountActive(user)) return withCorrelationHeaders(event, unauthorized(ACCOUNT_INACTIVE_MESSAGE));

    const tenantAgencyId = resolveAgencyId(user, event);
    if (!isRcInternalOperator(user.role) && user.agencyId !== tenantAgencyId) {
      return withCorrelationHeaders(event, forbidden());
    }

    const method = event.requestContext.http.method.toUpperCase();
    const parts = rest(event.rawPath ?? "");
    const body = parseBody(event.body);
    if (event.body && body === null) return withCorrelationHeaders(event, badRequest("Invalid JSON"));
    const qs = event.queryStringParameters ?? {};

    if (method === "GET" && parts[0] === "slots" && parts.length === 1) {
      requireAnyPerm(user, ["cad.connector.view", "cad.connector.manage"]);
      const config = await getAgencySlots(tenantAgencyId);
      return withCorrelationHeaders(
        event,
        ok({
          agencyId: tenantAgencyId,
          writebackEnabled: env.cadWritebackEnabled,
          slots: config.slots.map((slot) => ({
            ...slot,
            webhookUrl: webhookUrlFor(tenantAgencyId, slot.slot),
          })),
          updatedAt: config.updatedAt,
        }),
      );
    }

    if (method === "PATCH" && parts[0] === "slots" && parts[1]) {
      requirePerm(user, "cad.connector.manage");
      const cadSlot = parseSlotToken(parts[1]);
      const parsed = slotPatchSchema.safeParse(body);
      if (!cadSlot) return withCorrelationHeaders(event, badRequest("Unknown CAD slot"));
      if (!parsed.success) return withCorrelationHeaders(event, badRequestFromZod(parsed.error));
      const config = await patchSlot(tenantAgencyId, cadSlot, parsed.data);
      resetC2cRuntime(tenantAgencyId);
      await auditRepo
        .create({
          eventId: makeId("aud"),
          agencyId: tenantAgencyId,
          actorId: user.userId,
          type: AUDIT_EVENT_TYPES.CAD_BRIDGE_EVENT,
          details: { hub: "c2c", action: "slot.patch", slot: cadSlot, patch: parsed.data },
          createdAt: new Date().toISOString(),
          resourceType: "incident",
          resourceId: `${tenantAgencyId}:${cadSlot}`,
        })
        .catch(() => undefined);
      return withCorrelationHeaders(
        event,
        ok({
          agencyId: tenantAgencyId,
          slots: config.slots.map((s) => ({ ...s, webhookUrl: webhookUrlFor(tenantAgencyId, s.slot) })),
          updatedAt: config.updatedAt,
        }),
      );
    }

    const runtime = await getC2cRuntime(tenantAgencyId);

    if (method === "POST" && parts[0] === "incidents" && parts.length === 1) {
      requirePerm(user, "cad.writeback.submit");
      const valid = validateEido(body);
      if (!valid.ok) return withCorrelationHeaders(event, badRequest(valid.error.map((e) => e.message).join("; ")));
      if (
        !isRcInternalOperator(user.role) &&
        valid.value.header.SenderAgencyId &&
        !valid.value.header.SenderAgencyId.startsWith(`${tenantAgencyId}:`) &&
        valid.value.header.SenderAgencyId !== tenantAgencyId
      ) {
        return withCorrelationHeaders(event, forbidden());
      }
      const result = await runtime.router.routeNewIncident(valid.value);
      await auditRepo
        .create({
          eventId: makeId("aud"),
          agencyId: tenantAgencyId,
          actorId: user.userId,
          type: AUDIT_EVENT_TYPES.CAD_BRIDGE_EVENT,
          details: { hub: "c2c", incidentId: result.incidentId, targets: result.targets.length },
          createdAt: new Date().toISOString(),
          resourceType: "incident",
          resourceId: result.incidentId,
        })
        .catch(() => undefined);
      return withCorrelationHeaders(event, ok(result));
    }

    if (method === "PUT" && parts[0] === "incidents" && parts[1] && parts.length === 2) {
      requirePerm(user, "cad.writeback.submit");
      const valid = validateEido(body);
      if (!valid.ok) return withCorrelationHeaders(event, badRequest(valid.error.map((e) => e.message).join("; ")));
      const result = await runtime.router.routeNewIncident(valid.value);
      return withCorrelationHeaders(event, ok(result));
    }

    if (method === "POST" && parts[0] === "incidents" && parts[2] === "transfer") {
      requirePerm(user, "cad.writeback.submit");
      const parsed = transferBodySchema.safeParse(body);
      if (!parsed.success) return withCorrelationHeaders(event, badRequestFromZod(parsed.error));
      const valid = validateEido((body as { eido?: unknown }).eido ?? body);
      if (!valid.ok) return withCorrelationHeaders(event, badRequest("transfer requires a valid EIDO envelope"));
      const result = await runtime.router.routeTransferRequest({
        header: { ...valid.value.header, MessageType: "TRANSFER_REQUEST" },
        incident: valid.value.incident,
        transfer: {
          TargetAgencyId: parsed.data.targetAgencyId,
          Reason: "MUTUAL_AID",
          AutoDispatch: parsed.data.autoDispatch ?? false,
          RequiresAcknowledgment: true,
          Notes: parsed.data.reason,
        },
      });
      return withCorrelationHeaders(event, ok(result));
    }

    if (method === "GET" && parts[0] === "incidents" && parts.length === 1) {
      requireAnyPerm(user, ["cad.incidents.view", "cad.connector.view"]);
      const slotFilter = qs.agencyId?.trim();
      const items = slotFilter
        ? await runtime.tracker.listActive(slotFilter)
        : (
            await Promise.all(
              runtime.slots.slots.map((slot) => runtime.tracker.listActive(`${tenantAgencyId}:${slot.slot}`)),
            )
          ).flat();
      return withCorrelationHeaders(event, ok({ items }));
    }

    if (method === "POST" && parts[0] === "units" && parts[1] === "status") {
      requirePerm(user, "cad.writeback.submit");
      return withCorrelationHeaders(event, ok({ accepted: true }));
    }

    if (method === "GET" && parts[0] === "health" && parts.length === 1) {
      requirePerm(user, "cad.health.view");
      return withCorrelationHeaders(event, ok(await runtime.health.getSystemHealth()));
    }

    if (method === "GET" && parts[0] === "health" && parts[1]) {
      requirePerm(user, "cad.health.view");
      return withCorrelationHeaders(event, ok(await runtime.health.getAgencyHealth(parts[1])));
    }

    if (method === "GET" && parts[0] === "avl" && parts[1] === "units") {
      requireAnyPerm(user, ["cad.incidents.view", "cad.health.view"]);
      const agencies = (qs.agencies ?? runtime.slots.slots.map((s) => `${tenantAgencyId}:${s.slot}`).join(","))
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const statuses = qs.status?.split(",").filter(Boolean);
      const units = await getRegionalUnits(runtime.avl, agencies, statuses);
      return withCorrelationHeaders(event, ok({ units }));
    }

    if (method === "POST" && parts[0] === "admin" && parts[1] === "agencies") {
      requirePerm(user, "cad.connector.manage");
      const parsed = agencyBodySchema.safeParse(body);
      if (!parsed.success) return withCorrelationHeaders(event, badRequestFromZod(parsed.error));
      await runtime.registry.registerAgency(parsed.data);
      return withCorrelationHeaders(event, ok({ agency: parsed.data }));
    }

    if (method === "PUT" && parts[0] === "admin" && parts[1] === "agencies" && parts[2]) {
      requirePerm(user, "cad.connector.manage");
      const parsed = agencyBodySchema.partial().safeParse(body);
      if (!parsed.success) return withCorrelationHeaders(event, badRequestFromZod(parsed.error));
      const existing = await runtime.registry.getAgency(parts[2]);
      if (!existing) return withCorrelationHeaders(event, notFound("Agency not registered"));
      const next = { ...existing, ...parsed.data, agencyId: parts[2] };
      await runtime.registry.registerAgency(next);
      return withCorrelationHeaders(event, ok({ agency: next }));
    }

    if (method === "GET" && parts[0] === "admin" && parts[1] === "rules") {
      requirePerm(user, "cad.connector.view");
      return withCorrelationHeaders(event, ok({ rules: await runtime.rules.listRules() }));
    }

    if (method === "POST" && parts[0] === "admin" && parts[1] === "rules") {
      requirePerm(user, "cad.connector.manage");
      const parsed = ruleBodySchema.safeParse(body);
      if (!parsed.success) return withCorrelationHeaders(event, badRequestFromZod(parsed.error));
      const now = new Date().toISOString();
      await runtime.rules.addRule({
        ...parsed.data,
        conditions: parsed.data.conditions as never,
        createdAt: now,
        updatedAt: now,
        createdBy: user.userId,
      });
      return withCorrelationHeaders(event, ok({ ruleId: parsed.data.id }));
    }

    if (method === "PUT" && parts[0] === "admin" && parts[1] === "rules" && parts[2]) {
      requirePerm(user, "cad.connector.manage");
      await runtime.rules.updateRule(parts[2], (body ?? {}) as never);
      return withCorrelationHeaders(event, ok({ ruleId: parts[2] }));
    }

    if (method === "GET" && parts[0] === "reporting" && parts[1] === "activity") {
      requirePerm(user, "cad.audit.view");
      const items = await runtime.audit.list({ agencyId: qs.agencyId });
      return withCorrelationHeaders(event, ok({ items }));
    }

    return withCorrelationHeaders(event, notFound("Unknown C2C route"));
  } catch (err) {
    if (err instanceof Error && err.message === "FORBIDDEN") {
      return withCorrelationHeaders(event, forbidden());
    }
    throw err;
  }
};
