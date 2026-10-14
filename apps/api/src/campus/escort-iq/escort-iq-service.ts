import { createHash, randomBytes } from "node:crypto";
import {
  assertEscortIqHigherEdCampus,
  createEscortSessionBodySchema,
  isEscortIqEnabled,
  type CreateEscortSessionBody,
  type EscortSessionPublic,
  type EscortSessionStaff,
  type UserContext,
} from "rapid-cortex-shared";
import { AUDIT_EVENT_TYPES } from "rapid-cortex-security";
import { env } from "../../lib/env.js";
import { makeId } from "../../lib/ids.js";
import { AuditRepository } from "../../repositories/auditRepository.js";
import { AgencyRepository } from "../../repositories/agencyRepository.js";
import { QrNfcRepository } from "../../repositories/qrNfcRepository.js";
import { PinpointService } from "../../services/pinpointService.js";
import { ESCORT_IQ_KEYS } from "./escort-iq-keys.js";
import { EscortIqRepository, type EscortSessionDdbItem } from "./escort-iq-repository.js";

const repo = new EscortIqRepository();
const agencies = new AgencyRepository();
const qrRepo = new QrNfcRepository();
const auditRepo = new AuditRepository();
const pinpoint = new PinpointService();

function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

function newOpaqueToken(): string {
  return randomBytes(32).toString("base64url");
}

function referenceCode(escortId: string): string {
  return `ESC-${escortId.replace(/^esc_/, "").slice(0, 8).toUpperCase()}`;
}

function toPublic(session: EscortSessionStaff): EscortSessionPublic {
  return {
    escortId: session.escortId,
    referenceCode: session.referenceCode,
    status: session.status,
    methods: session.methods,
    destination: session.destination,
    startingLocationSnapshot: session.startingLocationSnapshot,
    requestedAt: session.requestedAt,
    pickupEtaAt: session.pickupEtaAt,
    destinationEtaAt: session.destinationEtaAt,
    assignedEscortDisplayName: session.assignedEscortDisplayName,
    assignedEscortUnit: session.assignedEscortUnit,
    oversightStatus: session.oversightStatus,
    locationSharingActive: Boolean(session.pinpointLinkId) && session.status === "ACTIVE",
    expiresAt: session.completedAt ? undefined : undefined,
  };
}

function assertPlatformEnabled(): void {
  if (!env.enableEscortIq) {
    const err = new Error("ESCORT_IQ_DISABLED");
    (err as Error & { statusCode?: number }).statusCode = 503;
    throw err;
  }
}

async function resolveCampusAgency(agencyId: string) {
  const agency = await agencies.get(agencyId);
  if (!agency) {
    const err = new Error("NOT_FOUND");
    (err as Error & { statusCode?: number }).statusCode = 404;
    throw err;
  }
  const campus = (agency as { config?: { campus?: Record<string, unknown> } }).config?.campus;
  assertEscortIqHigherEdCampus({
    vertical: "campus",
    agencyType: (agency as { type?: string }).type,
    institutionType:
      (agency as { institutionType?: unknown }).institutionType ?? campus?.institutionType,
    campusType: campus?.campusType,
  });
  const escortCfg = campus?.escortIq as { enabled?: boolean } | undefined;
  if (
    !isEscortIqEnabled({
      platformEnabled: env.enableEscortIq,
      tenantEnabled: escortCfg?.enabled === true,
      vertical: "campus",
      agencyType: (agency as { type?: string }).type,
      institutionType:
        (agency as { institutionType?: unknown }).institutionType ?? campus?.institutionType,
      campusType: campus?.campusType,
    })
  ) {
    const err = new Error("ESCORT_IQ_NOT_ENABLED");
    (err as Error & { statusCode?: number }).statusCode = 403;
    throw err;
  }
  return { agency, campus, escortCfg };
}

export class EscortIqService {
  /** Public engage hint — never throws for ineligible tenants; returns false. */
  async isAvailableForAgency(agencyId: string): Promise<boolean> {
    try {
      assertPlatformEnabled();
      await resolveCampusAgency(agencyId);
      return true;
    } catch {
      return false;
    }
  }

  async createPublicSession(
    rawBody: unknown,
  ): Promise<{ session: EscortSessionPublic; trackingToken?: string; publicToken: string }> {
    assertPlatformEnabled();
    const body = createEscortSessionBodySchema.parse(rawBody) as CreateEscortSessionBody;
    if (body.methods.includes("GPS") && body.gpsConsent !== true) {
      const err = new Error("VALIDATION:GPS consent is required for Live GPS Escort.");
      (err as Error & { statusCode?: number }).statusCode = 400;
      throw err;
    }

    const record = await qrRepo.getByQrId(body.qrId);
    if (!record?.active || record.vertical !== "campus") {
      const err = new Error("NOT_FOUND");
      (err as Error & { statusCode?: number }).statusCode = 404;
      throw err;
    }

    await resolveCampusAgency(record.agencyId);
    const campusMatch = record.agencyId.trim().match(/(?:test-)?campus-(.+)$/i);
    const campusCode = (campusMatch?.[1] ?? record.agencyId).toUpperCase();

    const escortId = makeId("esc");
    const now = new Date().toISOString();
    const publicToken = newOpaqueToken();
    const publicTokenHash = hashToken(publicToken);
    const ttl = Math.floor(Date.now() / 1000) + 48 * 3600;

    const needsPhysical = body.methods.includes("PHYSICAL");
    const session: EscortSessionDdbItem = {
      pk: ESCORT_IQ_KEYS.pk(campusCode),
      sk: ESCORT_IQ_KEYS.sessionSk(escortId),
      entityType: "ESCORT_SESSION",
      publicTokenHash,
      escortId,
      referenceCode: referenceCode(escortId),
      agencyId: record.agencyId,
      campusCode,
      siteCode: record.siteCode,
      qrId: record.qrId,
      safetyPointName: record.name,
      status: "REQUESTED",
      methods: body.methods,
      destination: body.destination,
      startingLocationSnapshot: {
        building: record.buildingId ?? undefined,
        floor: record.floor ?? undefined,
        zone: record.zoneName ?? record.zoneId ?? undefined,
        verificationStatus: "registered_qr",
      },
      requestedAt: now,
      oversightStatus: needsPhysical ? "PENDING" : "UNAVAILABLE",
      callbackPhoneLast4: body.callbackPhoneE164
        ? `***-***-${body.callbackPhoneE164.slice(-4)}`
        : undefined,
      updatedAt: now,
      ttl,
    };

    await repo.putSession(session);
    await repo.putToken({
      pk: ESCORT_IQ_KEYS.tokenPk(publicTokenHash),
      sk: ESCORT_IQ_KEYS.tokenSk(),
      entityType: "ESCORT_TOKEN",
      agencyId: record.agencyId,
      campusCode,
      escortId,
      ttl,
    });

    let trackingToken: string | undefined;
    if (body.methods.includes("GPS") && body.gpsConsent) {
      try {
        const share = await pinpoint.createInlineQrShare({
          agencyId: record.agencyId,
          incidentId: escortId,
          rcli: record.qrId,
          callerPhoneE164: body.callbackPhoneE164,
          consentGrantedAt: now,
        });
        if (share) {
          trackingToken = share.token;
          await repo.updateSession(campusCode, escortId, {
            pinpointLinkId: share.linkId,
            status: "ACTIVE",
            startedAt: now,
          });
          session.status = "ACTIVE";
          session.startedAt = now;
          session.pinpointLinkId = share.linkId;
        }
      } catch (err) {
        console.warn("[escort-iq] pinpoint share failed", err);
      }
    }

    try {
      await auditRepo.create({
        eventId: makeId("audit"),
        agencyId: record.agencyId,
        actorId: "public-escort",
        type: AUDIT_EVENT_TYPES.PUBLIC_REPORT_SUBMITTED,
        details: {
          source: "escort_iq",
          escortId,
          methods: body.methods,
          medium: body.medium,
        },
        createdAt: now,
        resourceType: "integration",
        resourceId: escortId,
      });
    } catch {
      // non-fatal
    }

    return { session: toPublic(session), trackingToken, publicToken };
  }

  async getPublicByToken(token: string): Promise<EscortSessionPublic> {
    assertPlatformEnabled();
    const row = await repo.getByTokenHash(hashToken(token));
    if (!row) {
      const err = new Error("NOT_FOUND");
      (err as Error & { statusCode?: number }).statusCode = 404;
      throw err;
    }
    const session = await repo.getSession(row.campusCode, row.escortId);
    if (!session || session.agencyId !== row.agencyId) {
      const err = new Error("NOT_FOUND");
      (err as Error & { statusCode?: number }).statusCode = 404;
      throw err;
    }
    await resolveCampusAgency(session.agencyId);
    return toPublic(session);
  }

  async listForCampus(campusCode: string, user: UserContext): Promise<EscortSessionStaff[]> {
    assertPlatformEnabled();
    const agencyId = String(user.agencyId ?? "").trim();
    if (!agencyId) {
      const err = new Error("FORBIDDEN");
      (err as Error & { statusCode?: number }).statusCode = 403;
      throw err;
    }
    await resolveCampusAgency(agencyId);
    const items = await repo.listByCampus(campusCode);
    return items.filter((i) => i.agencyId === agencyId);
  }

  async getForStaff(
    campusCode: string,
    escortId: string,
    user: UserContext,
  ): Promise<EscortSessionStaff> {
    assertPlatformEnabled();
    const agencyId = String(user.agencyId ?? "").trim();
    await resolveCampusAgency(agencyId);
    const session = await repo.getSession(campusCode, escortId);
    if (!session || session.agencyId !== agencyId) {
      const err = new Error("NOT_FOUND");
      (err as Error & { statusCode?: number }).statusCode = 404;
      throw err;
    }
    return session;
  }
}
