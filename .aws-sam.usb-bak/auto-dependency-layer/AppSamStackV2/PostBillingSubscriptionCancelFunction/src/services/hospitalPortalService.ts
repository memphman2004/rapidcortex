import {
  CognitoIdentityProviderClient,
  AdminCreateUserCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import type {
  HospitalCapacity,
  ManualCapacityUpdateBody,
  RegisterHospitalUserBody,
  UserContext,
} from "rapid-cortex-shared";
import {
  hospitalCapacitySchema,
  manualCapacityUpdateBodySchema,
  registerHospitalUserBodySchema,
} from "rapid-cortex-shared";
import { isHospitalPortalRole } from "rapid-cortex-shared";
import { AUDIT_EVENT_TYPES, AuthorizationService, defaultPermissionForRole } from "rapid-cortex-security";
import { env } from "../lib/env.js";
import { makeId } from "../lib/ids.js";
import { AuditRepository } from "../repositories/auditRepository.js";
import { HospitalCapacityRepository } from "../repositories/hospitalCapacityRepository.js";
import { HospitalProfileRepository } from "../repositories/hospitalProfileRepository.js";

const profileRepo = new HospitalProfileRepository();
const capacityRepo = new HospitalCapacityRepository();
const auditRepo = new AuditRepository();
const authz = new AuthorizationService();

function assertPortalEnabled(): void {
  if (!env.enableHospitalRouting || !env.hospitalCapacityTable || !env.hospitalProfilesTable) {
    const err = new Error("HOSPITAL_ROUTING_DISABLED");
    (err as Error & { statusCode?: number }).statusCode = 503;
    throw err;
  }
}

function assertPermission(
  user: UserContext,
  permission: Parameters<typeof defaultPermissionForRole>[1],
): void {
  if (!defaultPermissionForRole(user.role, permission)) {
    const err = new Error("FORBIDDEN");
    (err as Error & { statusCode?: number }).statusCode = 403;
    throw err;
  }
}

function resolveHospitalId(user: UserContext, hospitalId?: string): string {
  if (isHospitalPortalRole(user.role)) {
    if (!user.hospitalId) {
      const err = new Error("HOSPITAL_NOT_ASSIGNED");
      (err as Error & { statusCode?: number }).statusCode = 403;
      throw err;
    }
    return user.hospitalId;
  }
  if (!hospitalId) {
    const err = new Error("HOSPITAL_ID_REQUIRED");
    (err as Error & { statusCode?: number }).statusCode = 400;
    throw err;
  }
  return hospitalId;
}

function bedCounts(input: { available: number; total: number }) {
  return {
    total: input.total,
    occupied: Math.max(0, input.total - input.available),
    available: input.available,
  };
}

function generateTempPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%";
  let password = "";
  for (let i = 0; i < 14; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

export class HospitalPortalService {
  async getPortalContext(user: UserContext, hospitalId?: string) {
    assertPortalEnabled();
    assertPermission(user, "hospital_portal.view");
    const resolvedHospitalId = resolveHospitalId(user, hospitalId);
    const profile = await profileRepo.get(user.agencyId, resolvedHospitalId);
    if (!profile) {
      const err = new Error("NOT_FOUND");
      (err as Error & { statusCode?: number }).statusCode = 404;
      throw err;
    }
    const capacity = await capacityRepo.getLatest(user.agencyId, resolvedHospitalId);
    return {
      hospital: {
        hospitalId: profile.hospitalId,
        name: profile.name,
        traumaLevel: profile.traumaLevel,
        pediatricCapable: profile.pediatricCapable,
      },
      capacity,
    };
  }

  async manualUpdateCapacity(
    user: UserContext,
    body: ManualCapacityUpdateBody,
    hospitalId?: string,
  ): Promise<HospitalCapacity> {
    assertPortalEnabled();
    assertPermission(user, "hospital_portal.capacity_update");
    const parsed = manualCapacityUpdateBodySchema.parse(body);
    const resolvedHospitalId = resolveHospitalId(user, hospitalId);

    const profile = await profileRepo.get(user.agencyId, resolvedHospitalId);
    if (!profile) {
      const err = new Error("NOT_FOUND");
      (err as Error & { statusCode?: number }).statusCode = 404;
      throw err;
    }

    const now = new Date().toISOString();
    const previous = await capacityRepo.getLatest(user.agencyId, resolvedHospitalId);

    const capacity: HospitalCapacity = hospitalCapacitySchema.parse({
      hospitalId: resolvedHospitalId,
      agencyId: user.agencyId,
      timestamp: now,
      availability: {
        erBeds: bedCounts(parsed.erBeds),
        icuBeds: bedCounts(parsed.icuBeds),
        ...(parsed.traumaBeds ? { traumaBeds: bedCounts(parsed.traumaBeds) } : {}),
      },
      waitTimes: {
        erWaitMinutes: parsed.waitTimeMinutes,
      },
      diversion: {
        isOnDiversion: parsed.isOnDiversion,
        diversionType: parsed.isOnDiversion ? parsed.diversionType : undefined,
        diversionReason: parsed.isOnDiversion ? parsed.diversionReason : undefined,
        diversionStartedAt:
          parsed.isOnDiversion && !previous?.diversion.isOnDiversion ? now : previous?.diversion.diversionStartedAt,
      },
      staffing: {
        erPhysicians: parsed.staffing.erPhysicians,
        erNurses: parsed.staffing.erNurses,
        adequateStaffing: parsed.staffing.adequateStaffing,
      },
      dataQuality: {
        source: "MANUAL_UPDATE",
        lastVerified: now,
        confidence: "HIGH",
      },
      updatedByUserId: user.userId,
      updatedByName: user.displayName ?? user.email,
      updateNotes: parsed.notes,
    });

    await capacityRepo.put(capacity);
    await auditRepo.create({
      eventId: makeId("audit"),
      agencyId: user.agencyId,
      actorId: user.userId,
      type: AUDIT_EVENT_TYPES.HOSPITAL_CAPACITY_UPDATED,
      details: {
        hospitalId: resolvedHospitalId,
        source: "MANUAL_UPDATE",
        erAvailable: capacity.availability.erBeds.available,
        isOnDiversion: capacity.diversion.isOnDiversion,
        updatedByName: capacity.updatedByName,
        hasNotes: Boolean(parsed.notes),
      },
      createdAt: now,
      resourceType: "hospital_capacity",
      resourceId: resolvedHospitalId,
    });

    return capacity;
  }

  async listCapacityHistory(
    user: UserContext,
    limit: number,
    hospitalId?: string,
  ): Promise<HospitalCapacity[]> {
    assertPortalEnabled();
    assertPermission(user, "hospital_portal.view");
    const resolvedHospitalId = resolveHospitalId(user, hospitalId);
    const profile = await profileRepo.get(user.agencyId, resolvedHospitalId);
    if (!profile) {
      const err = new Error("NOT_FOUND");
      (err as Error & { statusCode?: number }).statusCode = 404;
      throw err;
    }
    return capacityRepo.listRecentSnapshots(user.agencyId, resolvedHospitalId, limit);
  }

  async registerHospitalUser(
    user: UserContext,
    body: RegisterHospitalUserBody,
  ): Promise<{ success: boolean; email: string; mock: boolean }> {
    assertPortalEnabled();
    const parsed = registerHospitalUserBodySchema.parse(body);
    authz.assertAssignableHospitalRole(parsed.role);

    if (!authz.canManageHospitalUsers(user, parsed.hospitalId)) {
      const err = new Error("FORBIDDEN");
      (err as Error & { statusCode?: number }).statusCode = 403;
      throw err;
    }

    if (user.role === "hospitaladmin") {
      if (parsed.role !== "hospitalstaff") {
        const err = new Error("FORBIDDEN");
        (err as Error & { statusCode?: number }).statusCode = 403;
        throw err;
      }
      if (user.hospitalId !== parsed.hospitalId) {
        const err = new Error("FORBIDDEN");
        (err as Error & { statusCode?: number }).statusCode = 403;
        throw err;
      }
    }

    const profile = await profileRepo.get(user.agencyId, parsed.hospitalId);
    if (!profile) {
      const err = new Error("NOT_FOUND");
      (err as Error & { statusCode?: number }).statusCode = 404;
      throw err;
    }

    const poolId = env.cognitoUserPoolId;
    const mock = !poolId || env.hospitalRoutingMock;

    if (!mock) {
      const cognito = new CognitoIdentityProviderClient({ region: env.region });
      const tempPassword = generateTempPassword();
      await cognito.send(
        new AdminCreateUserCommand({
          UserPoolId: poolId,
          Username: parsed.email.toLowerCase(),
          UserAttributes: [
            { Name: "email", Value: parsed.email.toLowerCase() },
            { Name: "email_verified", Value: "true" },
            { Name: "custom:role", Value: parsed.role },
            { Name: "custom:agencyId", Value: user.agencyId },
            { Name: "custom:hospitalId", Value: parsed.hospitalId },
            { Name: "custom:firstName", Value: parsed.firstName },
            { Name: "custom:lastName", Value: parsed.lastName },
          ],
          TemporaryPassword: tempPassword,
          DesiredDeliveryMediums: ["EMAIL"],
        }),
      );
    }

    const now = new Date().toISOString();
    await auditRepo.create({
      eventId: makeId("audit"),
      agencyId: user.agencyId,
      actorId: user.userId,
      type: AUDIT_EVENT_TYPES.HOSPITAL_PORTAL_USER_REGISTERED,
      details: {
        email: parsed.email.toLowerCase(),
        hospitalId: parsed.hospitalId,
        hospitalName: profile.name,
        role: parsed.role,
        mock,
      },
      createdAt: now,
      resourceType: "user",
      resourceId: parsed.email.toLowerCase(),
    });

    return { success: true, email: parsed.email.toLowerCase(), mock };
  }
}
