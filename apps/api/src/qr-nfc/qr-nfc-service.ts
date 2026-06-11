import { ulid } from "ulid";
import type { CreateQRNFCInput, QRNFCRecord, QRNFCPublicRecord, UpdateQRNFCInput, UserContext } from "rapid-cortex-shared";
import {
  createQRNFCSchema,
  migrateLegacyRapidCortexRoleTokenValue,
  updateQRNFCSchema,
} from "rapid-cortex-shared";
import {
  AUDIT_EVENT_TYPES,
  canManageQrNfcCodes,
  canViewQrNfcCodes,
  isQrNfcPlatformRole,
  resolveQrNfcAgencyId,
} from "rapid-cortex-security";
import { generateQRCodeBase64, qrColorsForVertical, qrNfcReportUrl } from "../lib/qr-generator.js";
import { env } from "../lib/env.js";
import { makeId } from "../lib/ids.js";
import { AuditRepository } from "../repositories/auditRepository.js";
import { AgencyRepository } from "../repositories/agencyRepository.js";
import { QrNfcRepository } from "../repositories/qrNfcRepository.js";

const repo = new QrNfcRepository();
const auditRepo = new AuditRepository();
const agencies = new AgencyRepository();

function appBaseUrl(): string {
  return (env.appBaseUrl ?? "https://app.rapidcortex.us").replace(/\/$/, "");
}

function assertManage(user: UserContext, agencyId: string): void {
  if (!canManageQrNfcCodes(user, agencyId)) {
    const err = new Error("FORBIDDEN");
    (err as Error & { statusCode?: number }).statusCode = 403;
    throw err;
  }
}

function assertView(user: UserContext, agencyId: string): void {
  if (!canViewQrNfcCodes(user, agencyId)) {
    const err = new Error("FORBIDDEN");
    (err as Error & { statusCode?: number }).statusCode = 403;
    throw err;
  }
}

export class QrNfcService {
  async create(user: UserContext, input: unknown): Promise<QRNFCRecord> {
    const parsed = createQRNFCSchema.safeParse(input);
    if (!parsed.success) {
      const err = new Error("VALIDATION");
      (err as Error & { zodError?: unknown; statusCode?: number }).statusCode = 400;
      (err as Error & { zodError?: unknown }).zodError = parsed.error;
      throw err;
    }
    const agencyId = resolveQrNfcAgencyId(user, parsed.data.agencyId);
    assertManage(user, agencyId);

    const agency = await agencies.get(agencyId);
    const qrId = ulid();
    const url = qrNfcReportUrl(qrId, appBaseUrl());
    const colors = qrColorsForVertical(parsed.data.vertical);
    const qrImageBase64 = await generateQRCodeBase64({
      url,
      size: 400,
      errorLevel: "H",
      ...colors,
    });

    const now = new Date().toISOString();
    const ttl = parsed.data.expiresAt
      ? Math.floor(new Date(parsed.data.expiresAt).getTime() / 1000)
      : undefined;

    const record: QRNFCRecord = {
      agencyId,
      agencyName: agency?.name ?? agencyId,
      qrId,
      name: parsed.data.name,
      description: parsed.data.description,
      zoneId: parsed.data.zoneId,
      zoneName: parsed.data.zoneName,
      vertical: parsed.data.vertical,
      reportType: parsed.data.reportType,
      nfcEnabled: parsed.data.nfcEnabled ?? true,
      nfcTagId: parsed.data.nfcTagId,
      active: true,
      url,
      qrImageBase64,
      scanCount: 0,
      nfcTapCount: 0,
      totalEngagements: 0,
      createdBy: user.userId,
      createdByRole: migrateLegacyRapidCortexRoleTokenValue(user.role) ?? user.role,
      createdAt: now,
      updatedAt: now,
      ...(ttl ? { ttl } : {}),
    };

    await repo.put(record);
    await auditRepo.create({
      eventId: makeId("audit"),
      agencyId,
      actorId: user.userId,
      type: AUDIT_EVENT_TYPES.QR_CODE_CREATED,
      details: {
        actorRole: record.createdByRole,
        targetAgencyId: agencyId,
        qrId,
        name: record.name,
        vertical: record.vertical,
        url,
      },
      createdAt: now,
      resourceType: "integration",
      resourceId: qrId,
    });

    return record;
  }

  async list(
    user: UserContext,
    opts: { agencyId?: string; vertical?: QRNFCRecord["vertical"]; active?: boolean },
  ) {
    const agencyId = resolveQrNfcAgencyId(user, opts.agencyId);
    assertView(user, agencyId);
    return repo.listByAgency(agencyId, opts);
  }

  async listGlobal(
    user: UserContext,
    opts: { agencyId?: string; vertical?: QRNFCRecord["vertical"]; active?: boolean },
  ) {
    const role = migrateLegacyRapidCortexRoleTokenValue(user.role) ?? user.role;
    if (!isQrNfcPlatformRole(role)) {
      const err = new Error("FORBIDDEN");
      (err as Error & { statusCode?: number }).statusCode = 403;
      throw err;
    }
    return repo.listGlobal(opts);
  }

  async get(user: UserContext, qrId: string, requestedAgencyId?: string): Promise<QRNFCRecord | null> {
    const record = await repo.getByQrId(qrId);
    if (!record) return null;
    const agencyId = resolveQrNfcAgencyId(user, requestedAgencyId ?? record.agencyId);
    assertView(user, record.agencyId);
    if (!isQrNfcPlatformRole(migrateLegacyRapidCortexRoleTokenValue(user.role) ?? user.role)) {
      if (record.agencyId !== user.agencyId) {
        const err = new Error("FORBIDDEN");
        (err as Error & { statusCode?: number }).statusCode = 403;
        throw err;
      }
    }
    void agencyId;
    return record;
  }

  async update(user: UserContext, qrId: string, input: unknown): Promise<QRNFCRecord | null> {
    const parsed = updateQRNFCSchema.safeParse(input);
    if (!parsed.success) {
      const err = new Error("VALIDATION");
      (err as Error & { zodError?: unknown; statusCode?: number }).statusCode = 400;
      (err as Error & { zodError?: unknown }).zodError = parsed.error;
      throw err;
    }
    const existing = await repo.getByQrId(qrId);
    if (!existing) return null;
    assertManage(user, existing.agencyId);
    if (!isQrNfcPlatformRole(migrateLegacyRapidCortexRoleTokenValue(user.role) ?? user.role)) {
      if (existing.agencyId !== user.agencyId) {
        const err = new Error("FORBIDDEN");
        (err as Error & { statusCode?: number }).statusCode = 403;
        throw err;
      }
    }
    const updated = await repo.update(existing.agencyId, qrId, parsed.data as UpdateQRNFCInput);
    if (updated) {
      await auditRepo.create({
        eventId: makeId("audit"),
        agencyId: existing.agencyId,
        actorId: user.userId,
        type: AUDIT_EVENT_TYPES.QR_NFC_CODE_UPDATED,
        details: { qrId, patch: parsed.data },
        createdAt: new Date().toISOString(),
        resourceType: "integration",
        resourceId: qrId,
      });
    }
    return updated;
  }

  async deactivate(user: UserContext, qrId: string): Promise<QRNFCRecord | null> {
    const existing = await repo.getByQrId(qrId);
    if (!existing) return null;
    assertManage(user, existing.agencyId);
    const updated = await repo.update(existing.agencyId, qrId, { active: false });
    if (updated) {
      await auditRepo.create({
        eventId: makeId("audit"),
        agencyId: existing.agencyId,
        actorId: user.userId,
        type: AUDIT_EVENT_TYPES.QR_CODE_DEACTIVATED,
        details: {
          actorRole: migrateLegacyRapidCortexRoleTokenValue(user.role) ?? user.role,
          targetAgencyId: existing.agencyId,
          qrId,
        },
        createdAt: new Date().toISOString(),
        resourceType: "integration",
        resourceId: qrId,
      });
    }
    return updated;
  }

  async engage(qrId: string, medium: "qr" | "nfc" | "direct" | "url"): Promise<QRNFCPublicRecord | { active: false; vertical: QRNFCRecord["vertical"] }> {
    const record = await repo.getByQrId(qrId);
    if (!record) {
      const err = new Error("NOT_FOUND");
      (err as Error & { statusCode?: number }).statusCode = 404;
      throw err;
    }
    if (!record.active) {
      return { active: false, vertical: record.vertical };
    }
    await repo.incrementEngagement(record.agencyId, qrId, medium);
    const agency = await agencies.get(record.agencyId);
    return {
      active: true,
      qrId: record.qrId,
      agencyId: record.agencyId,
      agencyName: agency?.name ?? record.agencyName ?? record.agencyId,
      zoneName: record.zoneName,
      vertical: record.vertical,
      reportType: record.reportType,
      medium,
    };
  }
}
