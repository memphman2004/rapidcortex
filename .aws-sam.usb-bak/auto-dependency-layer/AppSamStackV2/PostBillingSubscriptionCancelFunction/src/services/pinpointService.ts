import { createHash, randomBytes } from "node:crypto";
import type {
  CreatePinpointLinkBody,
  PinpointLinkDispatcherBrief,
  PinpointLinkDispatcherDetail,
  PinpointLinkPublicView,
  PinpointLocationCaptureBody,
  UserContext,
} from "rapid-cortex-shared";
import {
  PINPOINT_CONFIG,
  createPinpointLinkBodySchema,
  pinpointLocationCaptureBodySchema,
} from "rapid-cortex-shared";
import { AUDIT_EVENT_TYPES, TenantAccessGuard } from "rapid-cortex-security";
import { env } from "../lib/env.js";
import { makeId } from "../lib/ids.js";
import { classifyLocationConfidence } from "../lib/location-confidence.js";
import { AuditRepository } from "../repositories/auditRepository.js";
import { PinpointLinkRepository, type PinpointLinkDdbItem } from "../repositories/pinpointLinkRepository.js";
import { resolveIncidentRead } from "../lib/incidentReadAccess.js";
import { sendIncidentMediaLinkSms } from "./sms/smsProviderFactory.js";

const linkRepo = new PinpointLinkRepository();
const auditRepo = new AuditRepository();

function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

function newOpaqueToken(): string {
  return randomBytes(32).toString("base64url");
}

function assertPinpointEnabled(): void {
  if (!env.enablePinpoint) throw new Error("PINPOINT_DISABLED");
  if (!env.pinpointLinksTable) throw new Error("PINPOINT_LINKS_TABLE_NOT_CONFIGURED");
}

export class PinpointService {
  async createLink(
    incidentId: string,
    user: UserContext,
    rawBody: unknown,
  ): Promise<{ linkId: string; token: string; publicUrl: string }> {
    assertPinpointEnabled();
    const body = createPinpointLinkBodySchema.parse(rawBody) as CreatePinpointLinkBody;
    const resolved = await resolveIncidentRead(incidentId, user);
    if (!resolved) throw new Error("NOT_FOUND");
    const { incident } = resolved;
    TenantAccessGuard.assertIncidentAccess(incident, user);

    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const recent = (await linkRepo.listByIncident(incidentId, incident.agencyId, 80)).filter(
      (l) => l.createdAt >= since && l.status === "active",
    );
    if (recent.length >= PINPOINT_CONFIG.MAX_LINKS_PER_HOUR) {
      throw new Error("VALIDATION:Too many Pinpoint links in the last hour for this incident.");
    }

    const token = newOpaqueToken();
    const tokenHash = hashToken(token);
    const linkId = makeId("ppl");
    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + PINPOINT_CONFIG.LINK_EXPIRY_MINUTES * 60 * 1000).toISOString();
    const ttl = Math.floor(Date.parse(expiresAt) / 1000) + 3600;

    const base =
      body.publicAppBaseUrl?.replace(/\/$/, "") ||
      env.pinpointPublicBaseUrl?.replace(/\/$/, "") ||
      env.silentTextPublicBaseUrl?.replace(/\/$/, "") ||
      "";
    if (!base) throw new Error("MISSING_PUBLIC_BASE_URL");

    const publicUrl = `${base}/pinpoint/t/${encodeURIComponent(token)}`;
    const msg = `Rapid Cortex: help responders find you. Optional — tap to share your phone location once: ${publicUrl}`;

    const sms = await sendIncidentMediaLinkSms(
      {
        smsProvider: env.smsProvider,
        smsPrimaryProvider: env.smsPrimaryProvider,
        deploymentStage: env.deploymentStage,
        incidentMediaSmsMock: env.incidentMediaSmsMock || env.pinpointSmsMock,
        mockSmsProvider: env.mockSmsProvider,
        awsRegion: env.region,
        awsSmsRegion: env.awsSmsRegion,
        awsSmsUseSimulator: env.awsSmsUseSimulator,
        twilioSecretArn: env.incidentMediaTwilioSecretArn,
        awsSmsConfigurationSetName: env.awsSmsConfigurationSetName,
        awsSmsPoolId: env.awsSmsPoolId,
      },
      {
        toPhoneE164: body.callerPhoneE164,
        messageBody: msg,
        agencyId: incident.agencyId,
        incidentId,
        messageType: "pinpoint_location",
      },
    );

    const row: PinpointLinkDdbItem = {
      linkId,
      tokenHash,
      agencyId: incident.agencyId,
      incidentId,
      status: "active",
      createdAt: now,
      updatedAt: now,
      expiresAt,
      pings: [],
      callerPhoneE164: body.callerPhoneE164,
      smsSentAt: sms.status === "sent" ? now : null,
      smsProviderRef: sms.messageId ?? null,
      ttl,
    };
    await linkRepo.put(row);

    await auditRepo.create({
      eventId: makeId("aud"),
      agencyId: incident.agencyId,
      incidentId,
      actorId: user.userId,
      type: AUDIT_EVENT_TYPES.PINPOINT_LINK_GENERATED,
      details: { linkId, smsStatus: sms.status },
      createdAt: now,
      resourceType: "incident",
      resourceId: linkId,
    });

    return { linkId, token, publicUrl };
  }

  async listLinksBrief(incidentId: string, user: UserContext): Promise<{ items: PinpointLinkDispatcherBrief[] }> {
    assertPinpointEnabled();
    const resolved = await resolveIncidentRead(incidentId, user);
    if (!resolved) throw new Error("NOT_FOUND");
    TenantAccessGuard.assertIncidentAccess(resolved.incident, user);
    const items = await linkRepo.listByIncident(incidentId, resolved.incident.agencyId, 50);
    const brief: PinpointLinkDispatcherBrief[] = items.map((l) => ({
      linkId: l.linkId,
      status: l.status,
      createdAt: l.createdAt,
      expiresAt: l.expiresAt,
      smsSentAt: l.smsSentAt ?? null,
      lastPingAt: l.pings.length ? l.pings[l.pings.length - 1]!.capturedAt : null,
    }));
    return { items: brief };
  }

  async getDispatcherLink(incidentId: string, linkId: string, user: UserContext): Promise<PinpointLinkDispatcherDetail> {
    assertPinpointEnabled();
    const resolved = await resolveIncidentRead(incidentId, user);
    if (!resolved) throw new Error("NOT_FOUND");
    TenantAccessGuard.assertIncidentAccess(resolved.incident, user);
    const row = await linkRepo.get(linkId);
    if (!row || row.incidentId !== incidentId || row.agencyId !== resolved.incident.agencyId) throw new Error("NOT_FOUND");
    return {
      linkId: row.linkId,
      status: row.status,
      createdAt: row.createdAt,
      expiresAt: row.expiresAt,
      smsSentAt: row.smsSentAt ?? null,
      lastPingAt: row.pings.length ? row.pings[row.pings.length - 1]!.capturedAt : null,
      agencyId: row.agencyId,
      incidentId: row.incidentId,
      pings: row.pings,
      revokedAt: row.revokedAt ?? null,
    };
  }

  async revokeLink(incidentId: string, linkId: string, user: UserContext): Promise<{ ok: true }> {
    assertPinpointEnabled();
    const resolved = await resolveIncidentRead(incidentId, user);
    if (!resolved) throw new Error("NOT_FOUND");
    TenantAccessGuard.assertIncidentAccess(resolved.incident, user);
    const row = await linkRepo.get(linkId);
    if (!row || row.incidentId !== incidentId || row.agencyId !== resolved.incident.agencyId) throw new Error("NOT_FOUND");
    const now = new Date().toISOString();
    await linkRepo.put({ ...row, status: "revoked", revokedAt: now, updatedAt: now });
    await auditRepo.create({
      eventId: makeId("aud"),
      agencyId: row.agencyId,
      incidentId,
      actorId: user.userId,
      type: AUDIT_EVENT_TYPES.PINPOINT_LINK_REVOKED,
      details: { linkId },
      createdAt: now,
      resourceType: "incident",
      resourceId: linkId,
    });
    return { ok: true };
  }

  async getPublicByToken(token: string): Promise<PinpointLinkPublicView> {
    assertPinpointEnabled();
    const tokenHash = hashToken(token);
    const row = await linkRepo.getByTokenHash(tokenHash);
    if (!row) throw new Error("NOT_FOUND");
    const now = Date.now();
    if (row.status === "revoked") throw new Error("NOT_FOUND");
    if (Date.parse(row.expiresAt) < now) {
      if (row.status !== "expired") {
        await linkRepo.put({ ...row, status: "expired", updatedAt: new Date().toISOString() });
      }
      throw new Error("SESSION_EXPIRED");
    }
    return {
      linkId: row.linkId,
      incidentId: row.incidentId,
      status: row.status,
      expiresAt: row.expiresAt,
      pings: row.pings,
    };
  }

  async captureLocation(token: string, rawBody: unknown): Promise<PinpointLinkPublicView> {
    assertPinpointEnabled();
    const parsed = pinpointLocationCaptureBodySchema.safeParse(rawBody);
    if (!parsed.success) throw new Error(`VALIDATION:${parsed.error.message}`);
    const body = parsed.data as PinpointLocationCaptureBody;
    const tokenHash = hashToken(token);
    const row = await linkRepo.getByTokenHash(tokenHash);
    if (!row) throw new Error("NOT_FOUND");
    if (row.status === "revoked") throw new Error("NOT_FOUND");
    const nowMs = Date.now();
    if (Date.parse(row.expiresAt) < nowMs) {
      await linkRepo.put({ ...row, status: "expired", updatedAt: new Date().toISOString() });
      throw new Error("SESSION_EXPIRED");
    }
    if (body.accuracyM != null) {
      if (body.accuracyM < PINPOINT_CONFIG.MIN_ACCURACY_METERS || body.accuracyM > PINPOINT_CONFIG.MAX_ACCURACY_METERS) {
        throw new Error("VALIDATION:accuracyM out of allowed range");
      }
    }
    const last = row.pings[row.pings.length - 1];
    if (last) {
      const deltaSec = (nowMs - Date.parse(last.capturedAt)) / 1000;
      if (deltaSec < PINPOINT_CONFIG.LOCATION_UPDATE_RATE_LIMIT_SECONDS) {
        throw new Error("VALIDATION:Please wait before sending another location update.");
      }
    }
    const capturedAt = new Date().toISOString();
    const ping = {
      capturedAt,
      lat: body.lat,
      lng: body.lng,
      accuracyM: body.accuracyM,
      headingDeg: body.headingDeg,
      speedMps: body.speedMps,
      clientNote: body.clientNote,
    };
    const next = { ...row, pings: [...row.pings, ping].slice(-80), updatedAt: capturedAt };
    await linkRepo.put(next);

    await auditRepo.create({
      eventId: makeId("aud"),
      agencyId: row.agencyId,
      incidentId: row.incidentId,
      type: AUDIT_EVENT_TYPES.PINPOINT_LOCATION_CAPTURED,
      details: {
        linkId: row.linkId,
        confidence: classifyLocationConfidence(body.accuracyM),
      },
      createdAt: capturedAt,
      resourceType: "incident",
      resourceId: row.linkId,
    });

    return {
      linkId: next.linkId,
      incidentId: next.incidentId,
      status: next.status,
      expiresAt: next.expiresAt,
      pings: next.pings,
    };
  }
}
