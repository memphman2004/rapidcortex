import type {
  AgencyConfig,
  AgencyTenant,
  CreateAgencyInput,
  PatchAgencyInput,
  UserContext,
} from "rapid-cortex-shared";
import {
  buildAgencySlug,
  defaultAgencyNetworkPolicy,
  isRcsuperadmin,
  resolveAgencyVerticalFromTenant,
  resolveUniqueAgencySlug,
  type AgencyProfileResponse,
} from "rapid-cortex-shared";
import {
  AUDIT_EVENT_TYPES,
  AuthorizationService,
  AgencyScopeResolver,
} from "rapid-cortex-security";
import { isRcInternalOperator } from "rapid-cortex-shared";
import { makeId } from "../lib/ids.js";
import { AgencyRepository } from "../repositories/agencyRepository.js";
import { AuditRepository } from "../repositories/auditRepository.js";

const agencyRepo = new AgencyRepository();
const auditRepo = new AuditRepository();
const authz = new AuthorizationService();

function defaultConfig(agencyId: string, input: CreateAgencyInput): AgencyConfig {
  const now = new Date().toISOString();
  return {
    agencyId,
    protocolPackId: input.protocolPackId,
    aiProviderProfileId: "default",
    retentionPolicyId: input.retentionPolicyId,
    integrationMode: input.integrationMode,
    transcriptRedactionEnabled: true,
    auditExportEnabled: false,
    environmentFlags: {},
    supervisorEscalationRules: {},
    createdAt: now,
    updatedAt: now,
  };
}

export class AgencyService {
  async list(user: UserContext): Promise<AgencyTenant[]> {
    if (!authz.canManageAgencies(user)) throw new Error("FORBIDDEN");
    return agencyRepo.listRecent(500);
  }

  async create(user: UserContext, input: CreateAgencyInput): Promise<AgencyTenant> {
    if (!authz.canManageAgencies(user)) throw new Error("FORBIDDEN");

    const slugInput = {
      state: input.state,
      city: input.city,
      centerName: input.centerName,
    };
    const existingSlugs = new Set(await agencyRepo.listAgencyIds());
    const agencyId = resolveUniqueAgencySlug(slugInput, existingSlugs);
    const { stateCode } = buildAgencySlug(slugInput);

    const existing = await agencyRepo.get(agencyId);
    if (existing) {
      const err = new Error("AGENCY_EXISTS");
      (err as Error & { statusCode?: number }).statusCode = 409;
      throw err;
    }
    const now = new Date().toISOString();
    const row: AgencyTenant = {
      agencyId,
      name: input.name,
      type: input.type,
      status: "draft",
      state: stateCode.toUpperCase(),
      city: input.city,
      centerName: input.centerName,
      region: input.region,
      primaryContactName: input.primaryContactName,
      primaryContactEmail: input.primaryContactEmail,
      deploymentMode: input.deploymentMode,
      protocolPackId: input.protocolPackId,
      retentionPolicyId: input.retentionPolicyId,
      integrationMode: input.integrationMode,
      createdAt: now,
      updatedAt: now,
      createdByUserId: user.userId,
      config: defaultConfig(agencyId, input),
      networkPolicy: defaultAgencyNetworkPolicy(user.email ?? user.userId),
    };
    const vertical = input.vertical ?? "core";
    if (vertical === "campus") {
      row.type = "campus";
    } else if (vertical === "venue") {
      row.type = "venue";
    }
    const rowWithTenantFields = row as AgencyTenant & {
      vertical?: "core" | "campus" | "venue" | "hospital";
      addons?: string[];
      planTier?: "starter" | "professional" | "command" | "enterprise";
      pilotMode?: boolean;
    };
    rowWithTenantFields.vertical = vertical;
    rowWithTenantFields.addons = input.addons ?? [];
    rowWithTenantFields.planTier = input.planTier ?? "starter";
    rowWithTenantFields.pilotMode = input.pilotMode ?? false;
    if (typeof input.latitude === "number" && typeof input.longitude === "number") {
      row.latitude = input.latitude;
      row.longitude = input.longitude;
    }
    await agencyRepo.put(row);
    await auditRepo.create({
      eventId: makeId("audit"),
      agencyId: row.agencyId,
      actorId: user.userId,
      type: AUDIT_EVENT_TYPES.AGENCY_CREATED,
      details: {
        agencyId: row.agencyId,
        name: row.name,
        ...(row.latitude != null && row.longitude != null
          ? { latitude: row.latitude, longitude: row.longitude }
          : {}),
      },
      createdAt: now,
      resourceType: "agency",
      resourceId: row.agencyId,
    });
    return row;
  }

  async get(user: UserContext, agencyId: string): Promise<AgencyTenant | null> {
    AgencyScopeResolver.assertCanReadAgencyProfile(user, agencyId);
    return agencyRepo.get(agencyId);
  }

  async getProfile(user: UserContext, agencyId: string): Promise<AgencyProfileResponse | null> {
    const agency = await this.get(user, agencyId);
    if (!agency) return null;

    const vertical = resolveAgencyVerticalFromTenant(agency);
    const agencyType: AgencyProfileResponse["agencyType"] =
      vertical === "core" ? "psap" : vertical;

    return {
      id: agency.agencyId,
      name: agency.name,
      agencyType,
      type: agency.type,
      vertical: agency.vertical ?? vertical,
    };
  }

  async patch(user: UserContext, agencyId: string, patch: PatchAgencyInput): Promise<AgencyTenant> {
    AgencyScopeResolver.assertCanReadAgencyProfile(user, agencyId);
    const row = await agencyRepo.get(agencyId);
    if (!row) {
      const err = new Error("NOT_FOUND");
      (err as Error & { statusCode?: number }).statusCode = 404;
      throw err;
    }

    if (patch.status && ["suspended", "archived"].includes(patch.status) && !isRcsuperadmin(user)) {
      throw new Error("FORBIDDEN");
    }

    if (patch.platformOnboarding !== undefined && !isRcsuperadmin(user)) {
      throw new Error("FORBIDDEN");
    }

    const touchingMapPin =
      patch.latitude !== undefined ||
      patch.longitude !== undefined ||
      patch.city !== undefined ||
      patch.state !== undefined ||
      patch.region !== undefined ||
      patch.centerName !== undefined;
    if (touchingMapPin && !authz.canManageAgencies(user) && !isRcInternalOperator(user.role)) {
      throw new Error("FORBIDDEN");
    }

    if (patch.campus !== undefined) {
      AgencyScopeResolver.assertCanManageCampusSettings(user, agencyId);
      if (
        !isRcsuperadmin(user) &&
        !isRcInternalOperator(user.role) &&
        (user.role as string) !== "CAMPUS_ADMIN"
      ) {
        throw new Error("FORBIDDEN");
      }
    }

    const now = new Date().toISOString();
    const prevOnboarding = row.config.platformOnboarding;
    const nextOnboarding =
      patch.platformOnboarding !== undefined
        ? {
            steps: { ...prevOnboarding?.steps, ...patch.platformOnboarding.steps },
            notesByStep: { ...prevOnboarding?.notesByStep, ...patch.platformOnboarding.notesByStep },
            agencyNote: patch.platformOnboarding.agencyNote ?? prevOnboarding?.agencyNote,
            updatedAt: now,
          }
        : prevOnboarding;

    const next: AgencyTenant = {
      ...row,
      name: patch.name ?? row.name,
      status: patch.status ?? row.status,
      primaryContactName: patch.primaryContactName ?? row.primaryContactName,
      primaryContactEmail: patch.primaryContactEmail ?? row.primaryContactEmail,
      deploymentMode: patch.deploymentMode ?? row.deploymentMode,
      protocolPackId: patch.protocolPackId ?? row.protocolPackId,
      retentionPolicyId: patch.retentionPolicyId ?? row.retentionPolicyId,
      integrationMode: patch.integrationMode ?? row.integrationMode,
      city: patch.city ?? row.city,
      centerName: patch.centerName ?? row.centerName,
      state: patch.state ?? row.state,
      region: patch.region ?? row.region,
      updatedAt: now,
      config: {
        ...row.config,
        protocolPackId: patch.protocolPackId ?? row.config.protocolPackId,
        retentionPolicyId: patch.retentionPolicyId ?? row.config.retentionPolicyId,
        integrationMode: patch.integrationMode ?? row.config.integrationMode,
        platformOnboarding: nextOnboarding,
        sop:
          patch.sop !== undefined
            ? {
                autoDetectEnabled: patch.sop.autoDetectEnabled,
                sopDocumentS3Key: patch.sop.sopDocumentS3Key ?? row.config.sop?.sopDocumentS3Key,
              }
            : row.config.sop,
        triage: patch.triage !== undefined ? patch.triage : row.config.triage,
        wellness: patch.wellness !== undefined ? patch.wellness : row.config.wellness,
        retentionOverrideDays:
          patch.retentionOverrideDays !== undefined
            ? { ...row.config.retentionOverrideDays, ...patch.retentionOverrideDays }
            : row.config.retentionOverrideDays,
        campus:
          patch.campus !== undefined
            ? {
                ...row.config.campus,
                ...patch.campus,
                notificationPreferences: {
                  ...row.config.campus?.notificationPreferences,
                  ...patch.campus.notificationPreferences,
                },
                notificationRecipients: {
                  ...row.config.campus?.notificationRecipients,
                  ...patch.campus.notificationRecipients,
                },
                escalation: {
                  ...row.config.campus?.escalation,
                  ...patch.campus.escalation,
                  contacts: patch.campus.escalation?.contacts ?? row.config.campus?.escalation?.contacts,
                },
                publicReportForm: {
                  ...row.config.campus?.publicReportForm,
                  ...patch.campus.publicReportForm,
                },
              }
            : row.config.campus,
        updatedAt: now,
      },
    };

    if (patch.latitude === null) {
      delete next.latitude;
    } else if (typeof patch.latitude === "number") {
      next.latitude = patch.latitude;
    }
    if (patch.longitude === null) {
      delete next.longitude;
    } else if (typeof patch.longitude === "number") {
      next.longitude = patch.longitude;
    }

    const patchWithTenantFields = patch as PatchAgencyInput & {
      vertical?: "core" | "campus" | "venue" | "hospital";
      addons?: string[];
      planTier?: "starter" | "professional" | "command" | "enterprise";
      pilotMode?: boolean;
    };
    const rowWithTenantFields = row as AgencyTenant & {
      vertical?: "core" | "campus" | "venue" | "hospital";
      addons?: string[];
      planTier?: "starter" | "professional" | "command" | "enterprise";
      pilotMode?: boolean;
    };
    const nextWithTenantFields = next as AgencyTenant & {
      vertical?: "core" | "campus" | "venue" | "hospital";
      addons?: string[];
      planTier?: "starter" | "professional" | "command" | "enterprise";
      pilotMode?: boolean;
    };
    nextWithTenantFields.vertical = patchWithTenantFields.vertical ?? rowWithTenantFields.vertical ?? "core";
    nextWithTenantFields.addons = patchWithTenantFields.addons
      ? [...new Set(patchWithTenantFields.addons)]
      : (rowWithTenantFields.addons ?? []);
    nextWithTenantFields.planTier = patchWithTenantFields.planTier ?? rowWithTenantFields.planTier ?? "starter";
    nextWithTenantFields.pilotMode = patchWithTenantFields.pilotMode ?? rowWithTenantFields.pilotMode ?? false;

    await agencyRepo.put(next);
    await auditRepo.create({
      eventId: makeId("audit"),
      agencyId: next.agencyId,
      actorId: user.userId,
      type: AUDIT_EVENT_TYPES.AGENCY_UPDATED,
      details: { agencyId, patch },
      createdAt: now,
      resourceType: "agency",
      resourceId: agencyId,
    });
    return next;
  }

  /**
   * Cross-tenant HQ pins for RC Admin national deployments map.
   * Only agencies with both latitude and longitude are returned as markers.
   */
  async listDeploymentsMap(user: UserContext): Promise<{
    markers: Array<{
      agencyId: string;
      name: string;
      type: AgencyTenant["type"];
      status: AgencyTenant["status"];
      vertical?: AgencyTenant["vertical"];
      state: string;
      city?: string;
      region?: string;
      latitude: number;
      longitude: number;
    }>;
    missingCoordinatesCount: number;
    totalAgencies: number;
  }> {
    if (!authz.canManageAgencies(user) && !isRcInternalOperator(user.role)) {
      throw new Error("FORBIDDEN");
    }
    const agencies = await agencyRepo.listRecent(500);
    const markers = [];
    let missingCoordinatesCount = 0;
    for (const agency of agencies) {
      const lat = agency.latitude;
      const lng = agency.longitude;
      if (
        typeof lat !== "number" ||
        typeof lng !== "number" ||
        !Number.isFinite(lat) ||
        !Number.isFinite(lng)
      ) {
        missingCoordinatesCount += 1;
        continue;
      }
      markers.push({
        agencyId: agency.agencyId,
        name: agency.name,
        type: agency.type,
        status: agency.status,
        vertical: resolveAgencyVerticalFromTenant(agency),
        state: agency.state,
        city: agency.city,
        region: agency.region,
        latitude: lat,
        longitude: lng,
      });
    }
    return {
      markers,
      missingCoordinatesCount,
      totalAgencies: agencies.length,
    };
  }
}
