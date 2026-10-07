import { IncidentRepository } from "../repositories/incidentRepository.js";
import { AuditRepository } from "../repositories/auditRepository.js";
import { AgencyRepository } from "../repositories/agencyRepository.js";
import { makeId } from "../lib/ids.js";
import { env } from "../lib/env.js";
import { buildRetentionFields, buildIncidentDedupe } from "../lib/retentionPolicy.js";
import type {
  Incident,
  PatchIncidentDispatcherBody,
  PatchIncidentLegalHoldBody,
  SopProtocolOverlayState,
  UserContext,
} from "rapid-cortex-shared";
import { normalizeAddressForIndex } from "rapid-cortex-shared";
import { AUDIT_EVENT_TYPES, AgencyScopeResolver, TenantAccessGuard, isAdminRole } from "rapid-cortex-security";
import { resolveIncidentRead } from "../lib/incidentReadAccess.js";
import { LegalHoldRepository } from "../repositories/legalHoldRepository.js";

const incidentRepo = new IncidentRepository();
const auditRepo = new AuditRepository();
const agencyRepo = new AgencyRepository();
const legalHoldRepo = new LegalHoldRepository();

export class IncidentService {
  async create(
    title: string,
    source: Incident["source"],
    user: UserContext,
    opts?: { callerAddressLine?: string },
  ): Promise<Incident> {
    const now = new Date().toISOString();
    const callerAddressLine = opts?.callerAddressLine?.trim() || null;
    const callerAddressNormalized = callerAddressLine
      ? normalizeAddressForIndex(callerAddressLine)
      : null;

    const incident: Incident = {
      incidentId: makeId("inc"),
      agencyId: user.agencyId,
      title,
      category: "unknown",
      urgency: "moderate",
      status: "active",
      source,
      confidence: null,
      escalationFlag: false,
      summary: "",
      createdAt: now,
      updatedAt: now,
      callerAddressLine,
      callerAddressNormalized: callerAddressNormalized && callerAddressNormalized.length > 0
        ? callerAddressNormalized
        : null,
    };

    const tenant = await agencyRepo.get(user.agencyId);
    const ret = buildRetentionFields("incident", {
      agencyConfig: tenant?.config,
      anchorIso: now,
      policyId: env.defaultRetentionPolicyId,
      dedupe: buildIncidentDedupe(incident.incidentId),
      envDefaults: env,
    });
    Object.assign(incident, {
      ...ret,
      legalHold: false,
    });

    await incidentRepo.create(incident);

    await auditRepo.create({
      eventId: makeId("audit"),
      agencyId: user.agencyId,
      incidentId: incident.incidentId,
      actorId: user.userId,
      type: "incident.created",
      details: { title, source },
      createdAt: now,
      resourceType: "incident",
      resourceId: incident.incidentId,
    });

    return incident;
  }

  async list(user: UserContext, queryAgencyId?: string) {
    const agencyId = AgencyScopeResolver.requiredIncidentListAgencyId(user, queryAgencyId);
    return incidentRepo.listByAgency(agencyId);
  }

  async get(incidentId: string, user: UserContext) {
    const resolved = await resolveIncidentRead(incidentId, user);
    return resolved?.incident ?? null;
  }

  private canApplyDispatcherActions(user: UserContext): boolean {
    return (
      user.role === "dispatcher" ||
      user.role === "supervisor" ||
      user.role === "agencyadmin" ||
      user.role === "agencyit" ||
      user.role === "rcsuperadmin"
    );
  }

  async patchDispatch(
    incidentId: string,
    body: PatchIncidentDispatcherBody,
    user: UserContext,
  ): Promise<Incident | null> {
    if (!this.canApplyDispatcherActions(user)) {
      throw new Error("FORBIDDEN");
    }
    const incident = await incidentRepo.get(incidentId);
    if (!incident) return null;
    const resolved = await resolveIncidentRead(incidentId, user);
    if (!resolved || resolved.kind !== "owner") {
      throw new Error("FORBIDDEN");
    }
    TenantAccessGuard.assertIncidentAccess(incident, user);

    const now = new Date().toISOString();

    if (body.action === "mark_reviewed") {
      await incidentRepo.patchDispatchFields(incidentId, {
        dispatcherReviewAcknowledgedAt: now,
      });
      await auditRepo.create({
        eventId: makeId("audit"),
        agencyId: incident.agencyId,
        incidentId,
        actorId: user.userId,
        type: AUDIT_EVENT_TYPES.DISPATCHER_REVIEW_ACK,
        details: {},
        createdAt: now,
        resourceType: "incident",
        resourceId: incidentId,
      });
    } else if (body.action === "escalate_supervisor") {
      await incidentRepo.patchDispatchFields(incidentId, {
        escalationFlag: true,
      });
      await auditRepo.create({
        eventId: makeId("audit"),
        agencyId: incident.agencyId,
        incidentId,
        actorId: user.userId,
        type: AUDIT_EVENT_TYPES.ESCALATION_RAISED,
        details: { source: "dispatcher_action_panel" },
        createdAt: now,
        resourceType: "incident",
        resourceId: incidentId,
      });
    } else if (
      body.action === "sop_dismiss" ||
      body.action === "sop_override" ||
      body.action === "sop_clear_override" ||
      body.action === "sop_toggle_step"
    ) {
      const base: SopProtocolOverlayState = incident.sopProtocolOverlay ?? {
        recommendedProtocolPackId: null,
        incidentTypeLabel: "",
        confidence: 0,
        dismissedAt: null,
        manualProtocolPackId: null,
        completedStepIds: [],
        segmentCountAtDetection: 0,
        detectedAt: now,
      };
      let next = { ...base };
      if (body.action === "sop_dismiss") {
        next = { ...next, dismissedAt: now };
        await auditRepo.create({
          eventId: makeId("audit"),
          agencyId: incident.agencyId,
          incidentId,
          actorId: user.userId,
          type: AUDIT_EVENT_TYPES.SOP_PROTOCOL_DISMISSED,
          details: { protocolPackId: next.recommendedProtocolPackId },
          createdAt: now,
          resourceType: "incident",
          resourceId: incidentId,
        });
      } else if (body.action === "sop_override") {
        next = {
          ...next,
          manualProtocolPackId: body.protocolPackId,
          dismissedAt: null,
        };
        await auditRepo.create({
          eventId: makeId("audit"),
          agencyId: incident.agencyId,
          incidentId,
          actorId: user.userId,
          type: AUDIT_EVENT_TYPES.SOP_PROTOCOL_OVERRIDE,
          details: { protocolPackId: body.protocolPackId },
          createdAt: now,
          resourceType: "incident",
          resourceId: incidentId,
        });
      } else if (body.action === "sop_clear_override") {
        next = { ...next, manualProtocolPackId: null };
        await auditRepo.create({
          eventId: makeId("audit"),
          agencyId: incident.agencyId,
          incidentId,
          actorId: user.userId,
          type: AUDIT_EVENT_TYPES.SOP_PROTOCOL_OVERRIDE,
          details: { cleared: true },
          createdAt: now,
          resourceType: "incident",
          resourceId: incidentId,
        });
      } else if (body.action === "sop_toggle_step") {
        const set = new Set(next.completedStepIds);
        if (body.completed) set.add(body.stepId);
        else set.delete(body.stepId);
        next = { ...next, completedStepIds: [...set] };
        await auditRepo.create({
          eventId: makeId("audit"),
          agencyId: incident.agencyId,
          incidentId,
          actorId: user.userId,
          type: AUDIT_EVENT_TYPES.SOP_PROTOCOL_STEP_TOGGLED,
          details: { stepId: body.stepId, completed: body.completed },
          createdAt: now,
          resourceType: "incident",
          resourceId: incidentId,
        });
      }
      await incidentRepo.updateSopProtocolOverlay(incidentId, next);
    } else if (body.action === "caller_address") {
      const normalized = normalizeAddressForIndex(body.addressLine);
      await incidentRepo.updateCallerAddress(incidentId, {
        callerAddressLine: body.addressLine.trim(),
        callerAddressNormalized: normalized.length > 0 ? normalized : null,
      });
      await auditRepo.create({
        eventId: makeId("audit"),
        agencyId: incident.agencyId,
        incidentId,
        actorId: user.userId,
        type: "incident.caller_address_updated",
        details: {},
        createdAt: now,
        resourceType: "incident",
        resourceId: incidentId,
      });
    } else if (body.action === "cad_workspace_save") {
      const maskDispatchCb = (raw: string): string | null => {
        const d = raw.replace(/\D/g, "");
        if (!d) return null;
        if (d.length < 4) return "***";
        return `***${d.slice(-4)}`;
      };
      const urgencyFromCad = (p: "P1" | "P2" | "P3" | "P4"): Incident["urgency"] => {
        if (p === "P1") return "critical";
        if (p === "P2") return "high";
        if (p === "P4") return "low";
        return "moderate";
      };
      const patch: {
        summary?: string;
        cadNatureCode?: string | null;
        cadPriority?: string | null;
        cadLocation?: string | null;
        cadUnits?: string[] | null;
        cadCallerName?: string | null;
        cadCallerCallbackMasked?: string | null;
        urgency?: Incident["urgency"];
      } = {};
      if (body.summary !== undefined) patch.summary = body.summary;
      if (body.cadNatureCode !== undefined) patch.cadNatureCode = body.cadNatureCode;
      if (body.cadPriority !== undefined) {
        patch.cadPriority = body.cadPriority;
        patch.urgency = urgencyFromCad(body.cadPriority);
      }
      if (body.cadLocation !== undefined) patch.cadLocation = body.cadLocation;
      if (body.cadUnits !== undefined) patch.cadUnits = body.cadUnits;
      if (body.cadCallerName !== undefined) patch.cadCallerName = body.cadCallerName;
      if (body.cadCallerCallback !== undefined) {
        patch.cadCallerCallbackMasked = maskDispatchCb(body.cadCallerCallback);
      }
      if (Object.keys(patch).length > 0) {
        await incidentRepo.patchDispatcherCadWorkspace(incidentId, patch);
        await auditRepo.create({
          eventId: makeId("audit"),
          agencyId: incident.agencyId,
          incidentId,
          actorId: user.userId,
          type: AUDIT_EVENT_TYPES.CAD_DISPATCHER_WORKSPACE_SAVE,
          details: { fields: Object.keys(patch) },
          createdAt: now,
          resourceType: "incident",
          resourceId: incidentId,
        });
      }
    }

    return incidentRepo.get(incidentId);
  }

  async patchLegalHold(
    incidentId: string,
    body: PatchIncidentLegalHoldBody,
    user: UserContext,
  ): Promise<Incident | null> {
    if (!isAdminRole(user.role)) throw new Error("FORBIDDEN");
    const incident = await incidentRepo.get(incidentId);
    if (!incident) return null;
    const resolved = await resolveIncidentRead(incidentId, user);
    if (!resolved || resolved.kind !== "owner") throw new Error("FORBIDDEN");
    TenantAccessGuard.assertIncidentAccess(incident, user);

    if (body.legalHold) {
      const r = body.legalHoldReason?.trim();
      if (!r) {
        const err = new Error("VALIDATION:legalHoldReason is required when enabling a legal hold");
        (err as Error & { statusCode?: number }).statusCode = 400;
        throw err;
      }
    }

    const now = new Date().toISOString();
    await legalHoldRepo.setLegalHold(incidentId, {
      legalHold: body.legalHold,
      legalHoldReason: body.legalHold ? body.legalHoldReason?.trim() ?? null : null,
      legalHoldSetBy: user.userId,
      legalHoldSetAt: now,
    });

    await auditRepo.create({
      eventId: makeId("audit"),
      agencyId: incident.agencyId,
      incidentId,
      actorId: user.userId,
      type: body.legalHold ? AUDIT_EVENT_TYPES.LEGAL_HOLD_SET : AUDIT_EVENT_TYPES.LEGAL_HOLD_CLEARED,
      details: {
        legalHold: body.legalHold,
        legalHoldReason: body.legalHold ? body.legalHoldReason?.trim() : null,
      },
      createdAt: now,
      resourceType: "incident",
      resourceId: incidentId,
    });

    return incidentRepo.get(incidentId);
  }
}
