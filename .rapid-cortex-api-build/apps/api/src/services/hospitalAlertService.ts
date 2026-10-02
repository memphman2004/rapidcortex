import type {
  AcknowledgeHospitalPreAlertBody,
  CreateHospitalPreAlertBody,
  HospitalPreAlert,
  HospitalProfile,
  UpdateHospitalPreAlertBody,
  UpsertHospitalProfileBody,
  UserContext,
} from "rapid-cortex-shared";
import {
  validateQualifiedMedicalLanguage,
  hospitalPreAlertSchema,
} from "rapid-cortex-shared";
import { isRcsuperadmin } from "rapid-cortex-shared";
import { AuthorizationService, AUDIT_EVENT_TYPES, type Permission } from "rapid-cortex-security";
import { resolveIncidentRead } from "../lib/incidentReadAccess.js";
import { incidentTimelineLogger } from "../lib/incidentTimelineLogger.js";
import { env } from "../lib/env.js";
import { makeId } from "../lib/ids.js";
import { HospitalPreAlertRepository } from "../repositories/hospitalPreAlertRepository.js";
import { HospitalProfileRepository } from "../repositories/hospitalProfileRepository.js";
import { AuditRepository } from "../repositories/auditRepository.js";

const preAlertRepo = new HospitalPreAlertRepository();
const profileRepo = new HospitalProfileRepository();
const auditRepo = new AuditRepository();
const authz = new AuthorizationService();

const SENDABLE: HospitalPreAlert["status"][] = ["DRAFT", "READY_TO_SEND"];

function assertEnabled(): void {
  if (!env.enableEmergencyConnect || !env.hospitalPreAlertsTable) {
    const err = new Error("EMERGENCY_CONNECT_DISABLED");
    (err as Error & { statusCode?: number }).statusCode = 503;
    throw err;
  }
}

function assertPermission(user: UserContext, permission: Permission): void {
  if (!authz.canPerform(user, permission)) {
    const err = new Error("FORBIDDEN");
    (err as Error & { statusCode?: number }).statusCode = 403;
    throw err;
  }
}

function assertMedicalLanguage(...texts: string[]): void {
  for (const text of texts) {
    const issues = validateQualifiedMedicalLanguage(text);
    if (issues.length > 0) {
      const err = new Error(`VALIDATION:${issues[0]}`);
      (err as Error & { statusCode?: number }).statusCode = 400;
      throw err;
    }
  }
}

async function assertIncidentTenant(user: UserContext, incidentId: string): Promise<string> {
  const resolved = await resolveIncidentRead(incidentId, user);
  if (!resolved) {
    const err = new Error("FORBIDDEN");
    (err as Error & { statusCode?: number }).statusCode = 403;
    throw err;
  }
  if (user.agencyId !== resolved.incident.agencyId && !isRcsuperadmin(user)) {
    const err = new Error("TENANT_MISMATCH");
    (err as Error & { statusCode?: number }).statusCode = 403;
    throw err;
  }
  return resolved.incident.agencyId;
}

async function assertAlertTenant(user: UserContext, alert: HospitalPreAlert): Promise<void> {
  if (!isRcsuperadmin(user) && user.agencyId !== alert.agencyId) {
    const err = new Error("TENANT_MISMATCH");
    (err as Error & { statusCode?: number }).statusCode = 403;
    throw err;
  }
}

export type SendHospitalPreAlertResult = {
  success: boolean;
  method: string;
  sentAt: string;
};

export class HospitalAlertService {
  async listPreAlerts(user: UserContext, incidentId?: string): Promise<HospitalPreAlert[]> {
    assertEnabled();
    assertPermission(user, "emergency_connect.view");
    if (incidentId) {
      await assertIncidentTenant(user, incidentId);
      const items = await preAlertRepo.listByIncident(incidentId);
      return items.filter((a) => isRcsuperadmin(user) || a.agencyId === user.agencyId);
    }
    return preAlertRepo.listByAgency(user.agencyId);
  }

  async getPreAlert(user: UserContext, alertId: string): Promise<HospitalPreAlert> {
    assertEnabled();
    assertPermission(user, "emergency_connect.view");
    const alert = await preAlertRepo.get(user.agencyId, alertId);
    if (!alert) {
      const err = new Error("NOT_FOUND");
      (err as Error & { statusCode?: number }).statusCode = 404;
      throw err;
    }
    await assertAlertTenant(user, alert);
    return alert;
  }

  async createPreAlert(user: UserContext, body: CreateHospitalPreAlertBody): Promise<HospitalPreAlert> {
    assertEnabled();
    assertPermission(user, "emergency_connect.manage");
    const agencyId = await assertIncidentTenant(user, body.incidentId);
    assertMedicalLanguage(body.chiefComplaint, body.dispatcherSummary ?? "");

    const hospital = await profileRepo.get(agencyId, body.hospitalId);
    if (!hospital?.active) {
      const err = new Error("VALIDATION:Hospital not found or inactive");
      (err as Error & { statusCode?: number }).statusCode = 400;
      throw err;
    }

    const now = new Date().toISOString();
    const alert: HospitalPreAlert = hospitalPreAlertSchema.parse({
      alertId: makeId("hpa"),
      agencyId,
      incidentId: body.incidentId,
      hospitalId: body.hospitalId,
      hospitalName: hospital.name,
      alertType: body.alertType,
      priority: body.priority ?? "MEDIUM",
      status: "DRAFT",
      chiefComplaint: body.chiefComplaint,
      patientApproxAge: body.patientApproxAge,
      patientSex: body.patientSex,
      languageNeed: body.languageNeed,
      incidentLocation: body.incidentLocation,
      destinationHospital: hospital.name,
      etaMinutes: body.etaMinutes,
      emsUnitId: body.emsUnitId,
      dispatcherSummary: body.dispatcherSummary,
      vitalsSummary: body.vitalsSummary,
      responderNotes: body.responderNotes,
      createdAt: now,
      updatedAt: now,
      createdBy: user.userId,
    });

    await preAlertRepo.put(alert);
    await auditRepo.create({
      eventId: makeId("audit"),
      agencyId,
      incidentId: body.incidentId,
      actorId: user.userId,
      type: AUDIT_EVENT_TYPES.HOSPITAL_PREALERT_CREATED,
      details: { alertId: alert.alertId, hospitalId: alert.hospitalId, alertType: alert.alertType },
      createdAt: now,
      resourceType: "hospital_prealert",
      resourceId: alert.alertId,
    });
    return alert;
  }

  async updatePreAlert(
    user: UserContext,
    alertId: string,
    body: UpdateHospitalPreAlertBody,
  ): Promise<HospitalPreAlert> {
    assertEnabled();
    assertPermission(user, "emergency_connect.manage");
    const existing = await this.getPreAlert(user, alertId);
    if (existing.status !== "DRAFT" && existing.status !== "READY_TO_SEND") {
      const err = new Error("VALIDATION:Alert cannot be edited in current status");
      (err as Error & { statusCode?: number }).statusCode = 400;
      throw err;
    }
    if (body.chiefComplaint) assertMedicalLanguage(body.chiefComplaint);
    if (body.dispatcherSummary) assertMedicalLanguage(body.dispatcherSummary);

    let hospitalName = existing.hospitalName;
    if (body.hospitalId && body.hospitalId !== existing.hospitalId) {
      const hospital = await profileRepo.get(existing.agencyId, body.hospitalId);
      if (!hospital?.active) {
        const err = new Error("VALIDATION:Hospital not found or inactive");
        (err as Error & { statusCode?: number }).statusCode = 400;
        throw err;
      }
      hospitalName = hospital.name;
    }

    const updated = await preAlertRepo.update(existing.agencyId, alertId, {
      ...body,
      hospitalName,
      destinationHospital: hospitalName,
      status: body.status ?? existing.status,
    });
    if (!updated) {
      const err = new Error("NOT_FOUND");
      (err as Error & { statusCode?: number }).statusCode = 404;
      throw err;
    }
    return updated;
  }

  async sendPreAlert(user: UserContext, alertId: string): Promise<SendHospitalPreAlertResult> {
    assertEnabled();
    assertPermission(user, "emergency_connect.manage");
    const alert = await this.getPreAlert(user, alertId);
    if (!SENDABLE.includes(alert.status)) {
      const err = new Error("VALIDATION:Alert cannot be sent in current status");
      (err as Error & { statusCode?: number }).statusCode = 400;
      throw err;
    }

    const hospital = await profileRepo.get(alert.agencyId, alert.hospitalId);
    if (!hospital) {
      const err = new Error("NOT_FOUND");
      (err as Error & { statusCode?: number }).statusCode = 404;
      throw err;
    }

    const sentAt = new Date().toISOString();
    let method = "MANUAL_CALL_LOG";
    try {
      const delivery = await this.deliverToHospital(alert, hospital);
      method = delivery.method;
      await preAlertRepo.updateStatus(alert.agencyId, alertId, "SENT", { sentAt });
      await incidentTimelineLogger.emit({
        incidentId: alert.incidentId,
        agencyId: alert.agencyId,
        kind: "hospital_prealert_sent",
        source: user.role === "dispatcher" ? "dispatcher" : "supervisor",
        actorId: user.userId,
        actorRole: user.role,
        payload: {
          alertId: alert.alertId,
          hospitalId: alert.hospitalId,
          alertType: alert.alertType,
          method,
        },
      });
      await auditRepo.create({
        eventId: makeId("audit"),
        agencyId: alert.agencyId,
        incidentId: alert.incidentId,
        actorId: user.userId,
        type: AUDIT_EVENT_TYPES.HOSPITAL_PREALERT_SENT,
        details: { alertId, hospitalId: alert.hospitalId, method },
        createdAt: sentAt,
        resourceType: "hospital_prealert",
        resourceId: alertId,
      });
      return { success: true, method, sentAt };
    } catch (e) {
      await preAlertRepo.updateStatus(alert.agencyId, alertId, "FAILED");
      await incidentTimelineLogger.emit({
        incidentId: alert.incidentId,
        agencyId: alert.agencyId,
        kind: "hospital_prealert_failed",
        source: "system",
        actorId: user.userId,
        actorRole: user.role,
        payload: { alertId: alert.alertId, hospitalId: alert.hospitalId },
      });
      throw e;
    }
  }

  private async deliverToHospital(
    alert: HospitalPreAlert,
    hospital: HospitalProfile,
  ): Promise<{ method: string }> {
    if (env.emergencyConnectMock) {
      return { method: "MOCK" };
    }
    switch (hospital.preferredNotificationMethod) {
      case "SECURE_DASHBOARD":
        return { method: "SECURE_DASHBOARD" };
      case "EMAIL_SECURE":
      case "SMS_NOTIFICATION_ONLY":
      case "WEBHOOK":
      case "FHIR_ENDPOINT":
        return { method: hospital.preferredNotificationMethod };
      default:
        return { method: "MANUAL_CALL_LOG" };
    }
  }

  async acknowledgePreAlert(
    user: UserContext,
    alertId: string,
    body: AcknowledgeHospitalPreAlertBody,
  ): Promise<HospitalPreAlert> {
    assertEnabled();
    assertPermission(user, "emergency_connect.manage");
    const alert = await this.getPreAlert(user, alertId);
    if (alert.status !== "SENT" && alert.status !== "UPDATED") {
      const err = new Error("VALIDATION:Alert is not awaiting acknowledgment");
      (err as Error & { statusCode?: number }).statusCode = 400;
      throw err;
    }
    const acknowledgedAt = new Date().toISOString();
    const updated = await preAlertRepo.updateStatus(alert.agencyId, alertId, "ACKNOWLEDGED", {
      acknowledgedAt,
      acknowledgedBy: body.acknowledgedBy ?? user.userId,
    });
    if (!updated) {
      const err = new Error("NOT_FOUND");
      (err as Error & { statusCode?: number }).statusCode = 404;
      throw err;
    }
    await incidentTimelineLogger.emit({
      incidentId: alert.incidentId,
      agencyId: alert.agencyId,
      kind: "hospital_prealert_acknowledged",
      source: "supervisor",
      actorId: user.userId,
      actorRole: user.role,
      payload: { alertId },
    });
    await auditRepo.create({
      eventId: makeId("audit"),
      agencyId: alert.agencyId,
      incidentId: alert.incidentId,
      actorId: user.userId,
      type: AUDIT_EVENT_TYPES.HOSPITAL_PREALERT_ACKNOWLEDGED,
      details: { alertId },
      createdAt: acknowledgedAt,
      resourceType: "hospital_prealert",
      resourceId: alertId,
    });
    return updated;
  }

  async cancelPreAlert(user: UserContext, alertId: string): Promise<HospitalPreAlert> {
    assertEnabled();
    assertPermission(user, "emergency_connect.manage");
    const alert = await this.getPreAlert(user, alertId);
    if (alert.status === "CANCELLED" || alert.status === "ACKNOWLEDGED") {
      const err = new Error("VALIDATION:Alert cannot be cancelled");
      (err as Error & { statusCode?: number }).statusCode = 400;
      throw err;
    }
    const updated = await preAlertRepo.updateStatus(alert.agencyId, alertId, "CANCELLED");
    if (!updated) {
      const err = new Error("NOT_FOUND");
      (err as Error & { statusCode?: number }).statusCode = 404;
      throw err;
    }
    await incidentTimelineLogger.emit({
      incidentId: alert.incidentId,
      agencyId: alert.agencyId,
      kind: "hospital_prealert_cancelled",
      source: user.role === "dispatcher" ? "dispatcher" : "supervisor",
      actorId: user.userId,
      actorRole: user.role,
      payload: { alertId },
    });
    await auditRepo.create({
      eventId: makeId("audit"),
      agencyId: alert.agencyId,
      incidentId: alert.incidentId,
      actorId: user.userId,
      type: AUDIT_EVENT_TYPES.HOSPITAL_PREALERT_CANCELLED,
      details: { alertId },
      createdAt: new Date().toISOString(),
      resourceType: "hospital_prealert",
      resourceId: alertId,
    });
    return updated;
  }

  async listHospitals(user: UserContext): Promise<HospitalProfile[]> {
    assertEnabled();
    assertPermission(user, "emergency_connect.view");
    return profileRepo.listByAgency(user.agencyId);
  }

  async getHospital(user: UserContext, hospitalId: string): Promise<HospitalProfile> {
    assertEnabled();
    assertPermission(user, "emergency_connect.view");
    const profile = await profileRepo.get(user.agencyId, hospitalId);
    if (!profile) {
      const err = new Error("NOT_FOUND");
      (err as Error & { statusCode?: number }).statusCode = 404;
      throw err;
    }
    return profile;
  }

  async upsertHospital(
    user: UserContext,
    hospitalId: string | undefined,
    body: UpsertHospitalProfileBody,
  ): Promise<HospitalProfile> {
    assertEnabled();
    assertPermission(user, "emergency_connect.manage");
    const id = hospitalId ?? makeId("hosp");
    const existing = hospitalId ? await profileRepo.get(user.agencyId, hospitalId) : null;
    const now = new Date().toISOString();
    const profile: HospitalProfile = {
      hospitalId: id,
      agencyId: user.agencyId,
      name: body.name,
      address: body.address,
      coordinates: body.coordinates,
      phone: body.phone,
      emergencyDepartmentPhone: body.emergencyDepartmentPhone,
      traumaLevel: body.traumaLevel,
      strokeCenter: body.strokeCenter ?? existing?.strokeCenter ?? false,
      cardiacCenter: body.cardiacCenter ?? existing?.cardiacCenter ?? false,
      pediatricCapable: body.pediatricCapable ?? existing?.pediatricCapable ?? false,
      burnCenter: body.burnCenter ?? existing?.burnCenter ?? false,
      behavioralHealthCapable: body.behavioralHealthCapable ?? existing?.behavioralHealthCapable ?? false,
      preferredNotificationMethod:
        body.preferredNotificationMethod ?? existing?.preferredNotificationMethod ?? "SECURE_DASHBOARD",
      integrationType: body.integrationType ?? existing?.integrationType,
      endpointUrlSecretRef: body.endpointUrlSecretRef ?? existing?.endpointUrlSecretRef,
      active: body.active ?? existing?.active ?? true,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    await profileRepo.put(profile);
    await auditRepo.create({
      eventId: makeId("audit"),
      agencyId: user.agencyId,
      actorId: user.userId,
      type: existing
        ? AUDIT_EVENT_TYPES.HOSPITAL_PROFILE_UPDATED
        : AUDIT_EVENT_TYPES.HOSPITAL_PROFILE_CREATED,
      details: { hospitalId: id },
      createdAt: now,
      resourceType: "hospital_profile",
      resourceId: id,
    });
    return profile;
  }

  /** Demo seed — idempotent per agency (writes profiles only). */
  async ensureDemoHospitals(user: UserContext): Promise<void> {
    if (!env.emergencyConnectSeedDemo || !env.hospitalProfilesTable) return;
    const existing = await profileRepo.listByAgency(user.agencyId, false);
    if (existing.length > 0) return;
    const now = new Date().toISOString();
    const seeds = [
      {
        hospitalId: makeId("hosp"),
        name: "Metro Regional Medical Center",
        address: "100 Emergency Way",
        coordinates: { latitude: 39.7392, longitude: -104.9903 },
        phone: "+1-555-0100",
        traumaLevel: "LEVEL_1" as const,
        strokeCenter: true,
        cardiacCenter: true,
        preferredNotificationMethod: "SECURE_DASHBOARD" as const,
      },
      {
        hospitalId: makeId("hosp"),
        name: "Community General Hospital",
        address: "250 Health Park Dr",
        coordinates: { latitude: 39.75, longitude: -105.0 },
        phone: "+1-555-0200",
        traumaLevel: "LEVEL_3" as const,
        preferredNotificationMethod: "MANUAL_CALL_LOG" as const,
      },
    ];
    for (const seed of seeds) {
      await profileRepo.put({
        hospitalId: seed.hospitalId,
        agencyId: user.agencyId,
        name: seed.name,
        address: seed.address,
        coordinates: seed.coordinates,
        phone: seed.phone,
        traumaLevel: seed.traumaLevel,
        strokeCenter: seed.strokeCenter ?? false,
        cardiacCenter: seed.cardiacCenter ?? false,
        pediatricCapable: false,
        burnCenter: false,
        behavioralHealthCapable: false,
        preferredNotificationMethod: seed.preferredNotificationMethod,
        active: true,
        createdAt: now,
        updatedAt: now,
      });
    }
  }
}
