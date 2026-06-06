import { AUDIT_EVENT_TYPES, AuthorizationService } from "rapid-cortex-security";
import type { IncidentShareRecord, PostIncidentShareBody, UserContext } from "rapid-cortex-shared";
import { makeId } from "../lib/ids.js";
import { env } from "../lib/env.js";
import { IncidentRepository } from "../repositories/incidentRepository.js";
import { IncidentShareRepository } from "../repositories/incidentShareRepository.js";
import { AgencySharePartnerRepository } from "../repositories/agencySharePartnerRepository.js";
import { AuditRepository } from "../repositories/auditRepository.js";

const incidentRepo = new IncidentRepository();
const shareRepo = new IncidentShareRepository();
const partnersRepo = new AgencySharePartnerRepository();
const auditRepo = new AuditRepository();
const authz = new AuthorizationService();

export class IncidentShareService {
  private assertFeatureOn(): void {
    if (!env.enableCrossJurisdictionShares || !env.incidentSharesTable) {
      const err = new Error("FEATURE_DISABLED");
      (err as Error & { statusCode?: number }).statusCode = 404;
      throw err;
    }
  }

  private canManageShares(user: UserContext): boolean {
    return authz.canAccessSupervisorRoutes(user);
  }

  async createShare(incidentId: string, body: PostIncidentShareBody, user: UserContext): Promise<IncidentShareRecord> {
    this.assertFeatureOn();
    if (!this.canManageShares(user)) {
      const err = new Error("FORBIDDEN");
      (err as Error & { statusCode?: number }).statusCode = 403;
      throw err;
    }
    const incident = await incidentRepo.get(incidentId);
    if (!incident || incident.agencyId !== user.agencyId) {
      const err = new Error("FORBIDDEN");
      (err as Error & { statusCode?: number }).statusCode = 403;
      throw err;
    }
    if (body.recipientAgencyId === incident.agencyId) {
      const err = new Error("INVALID_RECIPIENT");
      (err as Error & { statusCode?: number }).statusCode = 400;
      throw err;
    }
    const trusted = await partnersRepo.assertActiveTrust(incident.agencyId, body.recipientAgencyId);
    if (!trusted) {
      const err = new Error("PARTNER_NOT_TRUSTED");
      (err as Error & { statusCode?: number }).statusCode = 400;
      throw err;
    }
    const ttlHours = body.ttlHours ?? 72;
    const expiresMs = Date.now() + ttlHours * 60 * 60 * 1000;
    const ttlEpoch = Math.floor(expiresMs / 1000);
    const now = new Date().toISOString();
    const shareId = makeId("shr");
    const record: IncidentShareRecord = {
      shareId,
      incidentId,
      ownerAgencyId: incident.agencyId,
      recipientAgencyId: body.recipientAgencyId,
      status: "active",
      createdAt: now,
      createdByUserId: user.userId,
      ttlEpoch,
    };
    await shareRepo.create(record);
    await auditRepo.create({
      eventId: makeId("audit"),
      agencyId: incident.agencyId,
      incidentId,
      actorId: user.userId,
      type: AUDIT_EVENT_TYPES.INCIDENT_SHARE_CREATED,
      details: {
        shareId,
        recipientAgencyId: body.recipientAgencyId,
        ttlHours,
        securityCritical: true,
      },
      createdAt: now,
      resourceType: "integration",
      resourceId: shareId,
    });
    return record;
  }

  async listSharesForIncident(incidentId: string, user: UserContext): Promise<IncidentShareRecord[]> {
    this.assertFeatureOn();
    if (!this.canManageShares(user)) {
      const err = new Error("FORBIDDEN");
      (err as Error & { statusCode?: number }).statusCode = 403;
      throw err;
    }
    const incident = await incidentRepo.get(incidentId);
    if (!incident || incident.agencyId !== user.agencyId) {
      const err = new Error("FORBIDDEN");
      (err as Error & { statusCode?: number }).statusCode = 403;
      throw err;
    }
    return shareRepo.listForIncident(incidentId);
  }

  async revokeShare(incidentId: string, shareId: string, user: UserContext): Promise<void> {
    this.assertFeatureOn();
    if (!this.canManageShares(user)) {
      const err = new Error("FORBIDDEN");
      (err as Error & { statusCode?: number }).statusCode = 403;
      throw err;
    }
    const incident = await incidentRepo.get(incidentId);
    if (!incident || incident.agencyId !== user.agencyId) {
      const err = new Error("FORBIDDEN");
      (err as Error & { statusCode?: number }).statusCode = 403;
      throw err;
    }
    const row = await shareRepo.get(shareId);
    if (!row || row.incidentId !== incidentId || row.ownerAgencyId !== user.agencyId) {
      const err = new Error("NOT_FOUND");
      (err as Error & { statusCode?: number }).statusCode = 404;
      throw err;
    }
    await shareRepo.setStatus(shareId, "revoked");
    const now = new Date().toISOString();
    await auditRepo.create({
      eventId: makeId("audit"),
      agencyId: incident.agencyId,
      incidentId,
      actorId: user.userId,
      type: AUDIT_EVENT_TYPES.INCIDENT_SHARE_REVOKED,
      details: { shareId, recipientAgencyId: row.recipientAgencyId, securityCritical: true },
      createdAt: now,
      resourceType: "integration",
      resourceId: shareId,
    });
  }

  async listIncoming(user: UserContext): Promise<IncidentShareRecord[]> {
    this.assertFeatureOn();
    if (!authz.canDispatch(user)) {
      const err = new Error("FORBIDDEN");
      (err as Error & { statusCode?: number }).statusCode = 403;
      throw err;
    }
    return shareRepo.listIncomingForAgency(user.agencyId);
  }

  async addTrustedPartner(ownerAgencyId: string, partnerAgencyId: string, user: UserContext): Promise<void> {
    this.assertFeatureOn();
    authz.assertAgencyAdminManagingSameAgency(user, ownerAgencyId);
    if (!env.agencySharePartnersTable) {
      const err = new Error("FEATURE_DISABLED");
      (err as Error & { statusCode?: number }).statusCode = 404;
      throw err;
    }
    const now = new Date().toISOString();
    await partnersRepo.putTrust({
      ownerAgencyId,
      partnerAgencyId,
      status: "active",
      createdAt: now,
    });
  }
}
