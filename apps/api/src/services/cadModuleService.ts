import { randomUUID } from "node:crypto";
import {
  cadGrantForIdentity,
  cadSeatsRemaining,
  countCadSeats,
  defaultCadScope,
  isCadConsoleVisible,
  nextAgencyCadFeature,
  nextCadUserGrants,
  type AgencyCADFeature,
  type CadScope,
  type CadUserGrant,
  type UserContext,
} from "rapid-cortex-shared";
import { defaultPermissionForRole, isRcAdmin, isRcStaff, isRcSuperAdmin } from "rapid-cortex-security";
import { BillingAuditRepository } from "../repositories/billingAuditRepository.js";
import { CadModuleRepository, type AgencyCadRecord } from "../repositories/cadModuleRepository.js";

const repo = new CadModuleRepository();
const billingAudit = new BillingAuditRepository();

export class CadModuleError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "CadModuleError";
  }
}

export type CadModuleView = {
  agencyId: string;
  agencyName: string;
  feature: AgencyCADFeature | null;
  seatCount: number;
  seatsRemaining: number;
  visible: boolean;
  grant: CadUserGrant | null;
  grants?: Record<string, CadUserGrant>;
};

function canManageAgencyLicense(actor: UserContext): boolean {
  return isRcSuperAdmin(actor.role) || defaultPermissionForRole(actor.role, "billing.addons");
}

function canManageSeats(actor: UserContext, agencyId: string): boolean {
  if (isRcSuperAdmin(actor.role) || isRcAdmin(actor.role)) return true;
  if (actor.agencyId !== agencyId) return false;
  return defaultPermissionForRole(actor.role, "users.manage_roles");
}

function canRead(actor: UserContext, agencyId: string): boolean {
  if (canManageAgencyLicense(actor) || isRcStaff(actor.role)) return true;
  if (canManageSeats(actor, agencyId)) return true;
  return actor.agencyId === agencyId;
}

function viewFor(agencyId: string, record: AgencyCadRecord, actor: UserContext, includeGrants: boolean): CadModuleView {
  const seatCount = countCadSeats(record.grants);
  const grant = cadGrantForIdentity(record.grants, actor);
  return {
    agencyId,
    agencyName: record.name,
    feature: record.feature,
    seatCount: includeGrants ? seatCount : 0,
    seatsRemaining: includeGrants ? cadSeatsRemaining(record.feature, seatCount) : 0,
    visible: isCadConsoleVisible(record.feature, grant),
    grant,
    ...(includeGrants ? { grants: record.grants } : {}),
  };
}

async function load(agencyId: string): Promise<AgencyCadRecord> {
  const record = await repo.get(agencyId);
  if (!record) throw new CadModuleError("Agency not found", 404);
  return record;
}

async function writeAudit(input: {
  agencyId: string;
  actor: UserContext;
  eventType: string;
  description: string;
  beforeState: unknown;
  afterState: unknown;
}): Promise<void> {
  try {
    await billingAudit.append({
      billingAuditEventId: randomUUID(),
      agencyId: input.agencyId,
      actorUserId: input.actor.userId,
      actorRole: input.actor.role,
      eventType: input.eventType,
      description: input.description,
      beforeState: input.beforeState,
      afterState: input.afterState,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.warn(
      JSON.stringify({
        msg: "cad_module_audit_failed",
        agencyId: input.agencyId,
        eventType: input.eventType,
        error: error instanceof Error ? error.message : "unknown",
      }),
    );
  }
}

export class CadModuleService {
  async getForActor(actor: UserContext): Promise<CadModuleView> {
    if (!actor.agencyId) throw new CadModuleError("Forbidden", 403);
    const record = await load(actor.agencyId);
    return viewFor(actor.agencyId, record, actor, canManageSeats(actor, actor.agencyId));
  }

  async getForAgency(agencyId: string, actor: UserContext): Promise<CadModuleView> {
    if (!canRead(actor, agencyId)) throw new CadModuleError("Forbidden", 403);
    const record = await load(agencyId);
    const manage = canManageSeats(actor, agencyId) || canManageAgencyLicense(actor);
    return viewFor(agencyId, record, actor, manage);
  }

  async setAgencyEnabled(
    agencyId: string,
    actor: UserContext,
    body: { enabled?: boolean; maxCadSeats?: number; confirmAgencyName?: string },
  ): Promise<CadModuleView> {
    if (!canManageAgencyLicense(actor)) throw new CadModuleError("Forbidden", 403);
    const record = await load(agencyId);
    const seatCount = countCadSeats(record.grants);
    const next = nextAgencyCadFeature({
      current: record.feature,
      enabled: body.enabled,
      maxCadSeats: body.maxCadSeats,
      actorId: actor.userId,
      now: new Date().toISOString(),
      seatCount,
      confirmAgencyName: body.confirmAgencyName,
      agencyName: record.name,
    });
    if ("error" in next) {
      if (next.error === "CONFIRM") {
        throw new CadModuleError(
          `This agency has ${seatCount} users with active CAD access. Type the agency name to confirm.`,
          409,
          { errorCode: "CAD_DISABLE_CONFIRMATION_REQUIRED", seatCount },
        );
      }
      if (next.error === "SEAT_CAP") {
        throw new CadModuleError(
          `Max CAD seats cannot be lower than the ${seatCount} seats already assigned.`,
          409,
          { errorCode: "CAD_SEAT_CAP", seatCount },
        );
      }
      throw new CadModuleError("Turn CAD on before setting a seat count.", 400, {
        errorCode: "CAD_ENABLE_REQUIRED",
      });
    }

    await repo.save(agencyId, next.feature, record.grants);
    const eventType =
      next.action === "disabled"
        ? "AGENCY_CAD_DISABLED"
        : next.action === "seats"
          ? "AGENCY_CAD_SEATS_UPDATED"
          : "AGENCY_CAD_ENABLED";
    await writeAudit({
      agencyId,
      actor,
      eventType,
      description: eventType,
      beforeState: record.feature,
      afterState: { feature: next.feature, maxCadSeats: next.feature.maxCadSeats, seatCount },
    });
    return viewFor(agencyId, { ...record, feature: next.feature }, actor, true);
  }

  async setUserAccess(
    agencyId: string,
    username: string,
    actor: UserContext,
    body: { enabled: boolean; cadScope?: CadScope; email?: string },
  ): Promise<CadModuleView> {
    if (!canManageSeats(actor, agencyId)) throw new CadModuleError("Forbidden", 403);
    const trimmed = username.trim();
    if (!trimmed) throw new CadModuleError("username is required", 400);
    const record = await load(agencyId);
    const previous = record.grants[trimmed] ?? null;
    if (!record.feature) {
      throw new CadModuleError("CAD is not enabled for this agency.", 409, { errorCode: "CAD_DISABLED" });
    }
    const next = nextCadUserGrants({
      grants: record.grants,
      username: trimmed,
      email: body.email,
      enabled: body.enabled,
      cadScope: body.cadScope ?? defaultCadScope("analyst"),
      feature: record.feature,
      now: new Date().toISOString(),
      actorId: actor.userId,
    });
    if ("error" in next) {
      if (next.error === "SEAT_LIMIT") {
        const max = record.feature?.maxCadSeats ?? 0;
        throw new CadModuleError(`No CAD seats remaining (${max} of ${max} used)`, 409, {
          errorCode: "CAD_SEAT_LIMIT",
          seatCount: countCadSeats(record.grants),
          maxCadSeats: max,
        });
      }
      throw new CadModuleError("CAD is not enabled for this agency.", 409, { errorCode: "CAD_DISABLED" });
    }

    await repo.save(agencyId, record.feature, next.grants);
    await writeAudit({
      agencyId,
      actor,
      eventType: body.enabled ? "CAD_SEAT_ASSIGNED" : "CAD_SEAT_REVOKED",
      description: body.enabled ? "CAD_SEAT_ASSIGNED" : "CAD_SEAT_REVOKED",
      beforeState: { targetUsername: trimmed, modules: previous?.modules ?? [], cadScope: previous?.cadScope ?? null },
      afterState: {
        targetUsername: trimmed,
        cadScope: next.grants[trimmed]?.cadScope ?? null,
        modules: next.grants[trimmed]?.modules ?? [],
      },
    });
    return viewFor(agencyId, { ...record, grants: next.grants }, actor, true);
  }
}
