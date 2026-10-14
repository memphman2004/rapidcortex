import { ulid } from "ulid";
import type {
  CampusAgencyConfig,
  QRNFCRecord,
  QRNFCPublicRecord,
  QRNFCWriteEvent,
  UpdateQRNFCInput,
  UserContext,
} from "rapid-cortex-shared";
import {
  createQRNFCSchema,
  isEscortIqEnabled,
  isCampusAlertsFeatureEnabled,
  isMarketingSiteQrRecord,
  migrateLegacyRapidCortexRoleTokenValue,
  resolveCampusInfoTab,
  resolveCampusInstitutionType,
  safetyPointGisImportCommitSchema,
  safetyPointGisImportPreviewSchema,
  toPublicCampusInfoTab,
  TRADE_SHOW_SITE_AGENCY_ID,
  tradeShowDestFromQrId,
  tradeShowSiteDisplayName,
  tradeShowUrlFor,
  updateQRNFCSchema,
  isTradeShowSiteQrId,
} from "rapid-cortex-shared";
import {
  AUDIT_EVENT_TYPES,
  canManageQrNfcCodes,
  canProgramQrNfcTags,
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
import { resolveAgencyCallNumber } from "./resolve-call-number.js";
import { bindQrLocationCameras } from "./qr-nfc-camera-bind.js";
import { formatPhoneDisplay } from "rapid-cortex-shared";
import { upsertCampusBuildingFromQr } from "../campus/campus-building-from-qr.js";

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


function buildLocationDescription(record: Pick<QRNFCRecord, "buildingName" | "buildingId" | "floor" | "room" | "zoneName" | "name">): string | undefined {
  const parts = [
    record.buildingName ?? record.buildingId,
    record.floor ? `Floor ${record.floor}` : undefined,
    record.room ? `Room ${record.room}` : undefined,
    record.zoneName,
  ].filter(Boolean);
  if (parts.length) return parts.join(" · ");
  return record.name?.trim() || undefined;
}

function locationFieldsFromInput(
  data: {
    latitude?: number;
    longitude?: number;
    coordinateSource?: QRNFCRecord["coordinateSource"];
    horizontalAccuracyMeters?: number;
    buildingName?: string;
    room?: string;
    indoorMapId?: string;
    indoorFeatureId?: string;
    verificationStatus?: QRNFCRecord["verificationStatus"];
  },
  actorId: string,
  now: string,
  existing?: QRNFCRecord | null,
): Partial<QRNFCRecord> {
  const hasCoords = data.latitude != null && data.longitude != null;
  if (!hasCoords && data.buildingName == null && data.room == null && data.indoorMapId == null) {
    return {};
  }
  const out: Partial<QRNFCRecord> = {};
  if (data.buildingName != null) out.buildingName = data.buildingName;
  if (data.room != null) out.room = data.room;
  if (data.indoorMapId != null) out.indoorMapId = data.indoorMapId;
  if (data.indoorFeatureId != null) out.indoorFeatureId = data.indoorFeatureId;
  if (hasCoords) {
    out.latitude = data.latitude;
    out.longitude = data.longitude;
    out.coordinateSource = data.coordinateSource ?? "MANUAL";
    if (data.horizontalAccuracyMeters != null) {
      out.horizontalAccuracyMeters = data.horizontalAccuracyMeters;
    }
    out.locationCapturedAt = existing?.locationCapturedAt ?? now;
    out.lastLocationUpdatedAt = now;
    out.locationUpdatedBy = actorId;
    // GPS / map capture never silently verifies — default UNVERIFIED.
    out.verificationStatus =
      data.verificationStatus === "VERIFIED"
        ? "UNVERIFIED"
        : data.verificationStatus ?? "UNVERIFIED";
    const logEntry = {
      at: now,
      by: actorId,
      latitude: data.latitude!,
      longitude: data.longitude!,
      coordinateSource: out.coordinateSource!,
      verificationStatus: out.verificationStatus!,
    };
    const prev = existing?.locationChangeLog ?? [];
    out.locationChangeLog = [...prev, logEntry].slice(-25);
  }
  return out;
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

    const callNumber = await resolveAgencyCallNumber(agencyId, parsed.data.callNumber);

    const record: QRNFCRecord = {
      agencyId,
      agencyName: agency?.name ?? agencyId,
      qrId,
      name: parsed.data.name,
      description: parsed.data.description,
      zoneId: parsed.data.zoneId,
      zoneName: parsed.data.zoneName,
      ...(parsed.data.buildingId?.trim() ? { buildingId: parsed.data.buildingId.trim() } : {}),
      ...(parsed.data.floor?.trim() ? { floor: parsed.data.floor.trim() } : {}),
      ...(parsed.data.cameraIds?.length ? { cameraIds: parsed.data.cameraIds } : {}),
      ...(parsed.data.vehicleId?.trim() ? { vehicleId: parsed.data.vehicleId.trim() } : {}),
      ...(parsed.data.stationId?.trim() ? { stationId: parsed.data.stationId.trim() } : {}),
      ...(parsed.data.routeId?.trim() ? { routeId: parsed.data.routeId.trim() } : {}),
      ...(parsed.data.siteCode?.trim() ? { siteCode: parsed.data.siteCode.trim().toUpperCase() } : {}),
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
      nfcWriteLog: [],
      createdBy: user.userId,
      createdByRole: migrateLegacyRapidCortexRoleTokenValue(user.role) ?? user.role,
      createdAt: now,
      updatedAt: now,
      ...(callNumber ? { callNumber } : {}),
      ...(ttl ? { ttl } : {}),
      ...locationFieldsFromInput(parsed.data, user.userId, now, null),
    };

    await repo.put(record);
    if (record.vertical === "campus") {
      try {
        await upsertCampusBuildingFromQr(record);
      } catch (err) {
        console.warn("[qr-nfc] campus building sync on create failed", qrId, err);
      }
    }
    if (
      (record.vertical === "campus" || record.vertical === "venue" || record.vertical === "transit") &&
      (record.cameraIds?.length ?? 0) > 0
    ) {
      try {
        await bindQrLocationCameras({
          agencyId,
          vertical: record.vertical,
          qrId,
          nextCameraIds: record.cameraIds ?? [],
        });
      } catch (err) {
        console.warn("[qr-nfc] camera bind on create failed", qrId, err);
      }
    }
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
    const items = await repo.listByAgency(agencyId, opts);
    return items.filter((row) => !isMarketingSiteQrRecord(row));
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
    const items = await repo.listGlobal(opts);
    return items.filter((row) => !isMarketingSiteQrRecord(row));
  }

  async listSiteUsage(user: UserContext) {
    assertView(user, user.agencyId);
    const ids = ["site-home", "site-demo"] as const;
    const items = await Promise.all(
      ids.map(async (qrId) => {
        const dest = tradeShowDestFromQrId(qrId);
        if (!dest) return null;
        const record = await repo.get(TRADE_SHOW_SITE_AGENCY_ID, qrId);
        return {
          qrId,
          destinationId: dest,
          name: record?.name ?? tradeShowSiteDisplayName(dest),
          url: record?.url ?? tradeShowUrlFor(dest),
          scanCount: record?.scanCount ?? 0,
          nfcTapCount: record?.nfcTapCount ?? 0,
          totalEngagements: record?.totalEngagements ?? 0,
          ...(record?.lastEngagementAt ? { lastEngagementAt: record.lastEngagementAt } : {}),
        };
      }),
    );
    return items.filter((row): row is NonNullable<typeof row> => row !== null);
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
    if (isTradeShowSiteQrId(qrId)) {
      const err = new Error("FORBIDDEN");
      (err as Error & { statusCode?: number }).statusCode = 403;
      throw err;
    }
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
    const now = new Date().toISOString();
    const { markLocationVerified, ...rawPatch } = parsed.data as UpdateQRNFCInput & {
      markLocationVerified?: boolean;
    };
    const locationPatch = locationFieldsFromInput(rawPatch, user.userId, now, existing);
    const patch: Partial<QRNFCRecord> = { ...rawPatch, ...locationPatch };
    // Strip client-only flag / force unverified unless explicit verify.
    delete (patch as { markLocationVerified?: boolean }).markLocationVerified;
    if (markLocationVerified === true) {
      if (existing.latitude == null || existing.longitude == null) {
        if (locationPatch.latitude == null || locationPatch.longitude == null) {
          const err = new Error("VALIDATION:Cannot verify a safety point without coordinates");
          (err as Error & { statusCode?: number }).statusCode = 400;
          throw err;
        }
      }
      patch.verificationStatus = "VERIFIED";
      patch.verifiedAt = now;
      patch.verifiedBy = user.userId;
    } else if ("verificationStatus" in patch && patch.verificationStatus === "VERIFIED") {
      // Never accept VERIFIED from a generic patch — require markLocationVerified.
      patch.verificationStatus = "UNVERIFIED";
    }
    const updated = await repo.update(existing.agencyId, qrId, patch);
    if (updated?.vertical === "campus") {
      try {
        await upsertCampusBuildingFromQr(updated);
      } catch (err) {
        console.warn("[qr-nfc] campus building sync on update failed", qrId, err);
      }
    }
    if (updated && parsed.data.cameraIds && (existing.vertical === "campus" || existing.vertical === "venue" || existing.vertical === "transit")) {
      try {
        await bindQrLocationCameras({
          agencyId: existing.agencyId,
          vertical: existing.vertical,
          qrId,
          nextCameraIds: parsed.data.cameraIds,
          previousCameraIds: existing.cameraIds,
        });
      } catch (err) {
        console.warn("[qr-nfc] camera bind on update failed", qrId, err);
      }
    }
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
    if (isTradeShowSiteQrId(qrId)) {
      const err = new Error("FORBIDDEN");
      (err as Error & { statusCode?: number }).statusCode = 403;
      throw err;
    }
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

  async appendNfcWriteLog(
    user: UserContext,
    qrId: string,
    event: Omit<QRNFCWriteEvent, "eventId" | "writtenAt"> & { eventId?: string; writtenAt?: string },
  ): Promise<QRNFCRecord> {
    const existing = await repo.getByQrId(qrId);
    if (!existing) {
      const err = new Error("NOT_FOUND");
      (err as Error & { statusCode?: number }).statusCode = 404;
      throw err;
    }
    if (!canProgramQrNfcTags(user, existing.agencyId)) {
      const err = new Error("FORBIDDEN");
      (err as Error & { statusCode?: number }).statusCode = 403;
      throw err;
    }
    if (!isQrNfcPlatformRole(migrateLegacyRapidCortexRoleTokenValue(user.role) ?? user.role)) {
      if (existing.agencyId !== user.agencyId) {
        const err = new Error("FORBIDDEN");
        (err as Error & { statusCode?: number }).statusCode = 403;
        throw err;
      }
    }
    const entry: QRNFCWriteEvent = {
      eventId: event.eventId ?? makeId("nfc"),
      writtenBy: event.writtenBy,
      writtenByName: event.writtenByName ?? null,
      devicePlatform: event.devicePlatform,
      writeMethod: "native_nfc",
      bytesWritten: event.bytesWritten,
      tagType: event.tagType ?? null,
      writtenAt: event.writtenAt ?? new Date().toISOString(),
    };
    const updated = await repo.appendNfcWriteLog(existing.agencyId, qrId, entry);
    if (!updated) {
      const err = new Error("NOT_FOUND");
      (err as Error & { statusCode?: number }).statusCode = 404;
      throw err;
    }
    await auditRepo.create({
      eventId: makeId("audit"),
      agencyId: existing.agencyId,
      actorId: user.userId,
      type: AUDIT_EVENT_TYPES.MOBILE_CODE_NFC_WRITE_LOGGED,
      details: {
        qrId,
        bytesWritten: entry.bytesWritten,
        devicePlatform: entry.devicePlatform,
        tagType: entry.tagType,
      },
      createdAt: entry.writtenAt,
      resourceType: "integration",
      resourceId: qrId,
    });
    return updated;
  }

  async engage(qrId: string, medium: "qr" | "nfc" | "direct" | "url"): Promise<QRNFCPublicRecord | { active: false; vertical: QRNFCRecord["vertical"] }> {
    const dest = tradeShowDestFromQrId(qrId);
    if (dest) {
      await repo.incrementSiteEngagement(TRADE_SHOW_SITE_AGENCY_ID, qrId, medium, {
        name: tradeShowSiteDisplayName(dest),
        url: tradeShowUrlFor(dest),
      });
      return {
        active: true,
        qrId,
        agencyId: TRADE_SHOW_SITE_AGENCY_ID,
        agencyName: "NexCort iQ",
        name: tradeShowSiteDisplayName(dest),
        vertical: "911",
        reportType: "anonymous",
        medium,
      };
    }
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
    const callNumber =
      record.callNumber ?? (await resolveAgencyCallNumber(record.agencyId));
    const campusCfg = (agency as { config?: { campus?: CampusAgencyConfig } } | null)?.config?.campus;
    const institutionType =
      record.vertical === "campus"
        ? resolveCampusInstitutionType({
            institutionType: (agency as { institutionType?: unknown } | null)?.institutionType
              ?? campusCfg?.institutionType,
            campusType: campusCfg?.campusType,
          })
        : undefined;
    const infoTabPublic =
      record.vertical === "campus"
        ? toPublicCampusInfoTab(resolveCampusInfoTab(campusCfg, record.siteCode))
        : undefined;
    const collectPhone =
      record.vertical === "campus"
        ? campusCfg?.publicReportForm?.collectPhone !== false
        : undefined;
    const escortIqAvailable =
      record.vertical === "campus" &&
      isEscortIqEnabled({
        platformEnabled: env.enableEscortIq,
        tenantEnabled: campusCfg?.escortIq?.enabled === true,
        vertical: "campus",
        agencyType: (agency as { type?: string } | null)?.type,
        institutionType:
          (agency as { institutionType?: unknown } | null)?.institutionType ??
          campusCfg?.institutionType,
        campusType: campusCfg?.campusType,
      });
    const campusAlertsAvailable =
      record.vertical === "campus" &&
      isCampusAlertsFeatureEnabled({
        platformEnabled: env.enableCampusAlerts,
        tenantEnabled: campusCfg?.campusAlerts?.enabled === true,
        selfRegistrationEnabled: campusCfg?.campusAlerts?.selfRegistrationEnabled !== false,
        vertical: "campus",
        agencyType: (agency as { type?: string } | null)?.type,
        institutionType:
          (agency as { institutionType?: unknown } | null)?.institutionType ??
          campusCfg?.institutionType,
        campusType: campusCfg?.campusType,
      });
    const hasRegisteredLocation =
      record.latitude != null &&
      record.longitude != null &&
      Number.isFinite(record.latitude) &&
      Number.isFinite(record.longitude);
    const locationVerificationStatus = hasRegisteredLocation
      ? record.verificationStatus ?? "UNVERIFIED"
      : "MISSING";
    const locationDescription = buildLocationDescription(record);
    return {
      active: true,
      qrId: record.qrId,
      agencyId: record.agencyId,
      agencyName: agency?.name ?? record.agencyName ?? record.agencyId,
      name: record.name,
      zoneName: record.zoneName,
      vertical: record.vertical,
      reportType: record.reportType,
      medium,
      ...(institutionType ? { institutionType } : {}),
      ...(collectPhone !== undefined ? { collectPhone } : {}),
      ...(infoTabPublic ? { infoTab: infoTabPublic } : {}),
      ...(escortIqAvailable ? { escortIqAvailable: true } : {}),
      ...(campusAlertsAvailable ? { campusAlertsAvailable: true } : {}),
      ...(locationDescription ? { locationDescription } : {}),
      ...(record.buildingName ? { buildingName: record.buildingName } : {}),
      ...(record.floor ? { floor: record.floor } : {}),
      hasRegisteredLocation,
      locationVerificationStatus,
      ...(callNumber
        ? {
            callNumber,
            callNumberDisplay: formatPhoneDisplay(callNumber),
          }
        : {}),
    };
  }

  /**
   * GIS / CSV bulk import preview — validates rows and resolves tenant matches.
   * Never writes. Coordinate updates stay UNVERIFIED until explicit verify.
   */
  async previewGisImport(
    user: UserContext,
    input: unknown,
  ): Promise<{
    agencyId: string;
    valid: Array<{
      safetyPointId: string;
      siteCode?: string;
      buildingName?: string;
      floor?: string;
      zone?: string;
      latitude: number;
      longitude: number;
      name?: string;
    }>;
    unmatched: Array<{ safetyPointId: string; reason: string }>;
    invalid: Array<{ row: unknown; errors: string[] }>;
    summary: { total: number; valid: number; unmatched: number; invalid: number };
  }> {
    const parsed = safetyPointGisImportPreviewSchema.safeParse(input);
    if (!parsed.success) {
      const err = new Error("VALIDATION");
      (err as Error & { zodError?: unknown; statusCode?: number }).statusCode = 400;
      (err as Error & { zodError?: unknown }).zodError = parsed.error;
      throw err;
    }
    const agencyId = resolveQrNfcAgencyId(user, parsed.data.agencyId);
    assertManage(user, agencyId);

    const valid: Array<(typeof parsed.data.rows)[number] & { name?: string }> = [];
    const unmatched: Array<{ safetyPointId: string; reason: string }> = [];
    const invalid: Array<{ row: unknown; errors: string[] }> = [];

    for (const row of parsed.data.rows) {
      const existing = await repo.getByQrId(row.safetyPointId);
      if (!existing) {
        unmatched.push({
          safetyPointId: row.safetyPointId,
          reason: "No QR/NFC code with this id — import never creates new codes or URLs",
        });
        continue;
      }
      if (existing.agencyId !== agencyId) {
        unmatched.push({
          safetyPointId: row.safetyPointId,
          reason: "Code belongs to a different agency (tenant isolation)",
        });
        continue;
      }
      if (isTradeShowSiteQrId(existing.qrId) || isMarketingSiteQrRecord(existing)) {
        unmatched.push({
          safetyPointId: row.safetyPointId,
          reason: "Marketing / site codes cannot receive GIS coordinates",
        });
        continue;
      }
      valid.push({ ...row, name: existing.name });
    }

    return {
      agencyId,
      valid,
      unmatched,
      invalid,
      summary: {
        total: parsed.data.rows.length,
        valid: valid.length,
        unmatched: unmatched.length,
        invalid: invalid.length,
      },
    };
  }

  /**
   * Controlled GIS commit — updates coordinates only for matched tenant codes.
   * Preserves qrId/url; forces UNVERIFIED; never auto-verifies.
   */
  async commitGisImport(
    user: UserContext,
    input: unknown,
  ): Promise<{
    agencyId: string;
    updated: number;
    skipped: number;
    results: Array<{ safetyPointId: string; status: "updated" | "skipped"; reason?: string }>;
  }> {
    const parsed = safetyPointGisImportCommitSchema.safeParse(input);
    if (!parsed.success) {
      const err = new Error("VALIDATION");
      (err as Error & { zodError?: unknown; statusCode?: number }).statusCode = 400;
      (err as Error & { zodError?: unknown }).zodError = parsed.error;
      throw err;
    }
    const agencyId = resolveQrNfcAgencyId(user, parsed.data.agencyId);
    assertManage(user, agencyId);
    const now = new Date().toISOString();
    const results: Array<{ safetyPointId: string; status: "updated" | "skipped"; reason?: string }> = [];
    let updated = 0;
    let skipped = 0;

    for (const row of parsed.data.rows) {
      const existing = await repo.getByQrId(row.safetyPointId);
      if (!existing || existing.agencyId !== agencyId) {
        skipped += 1;
        results.push({
          safetyPointId: row.safetyPointId,
          status: "skipped",
          reason: !existing ? "not_found" : "cross_tenant",
        });
        continue;
      }
      if (isTradeShowSiteQrId(existing.qrId)) {
        skipped += 1;
        results.push({ safetyPointId: row.safetyPointId, status: "skipped", reason: "site_code" });
        continue;
      }
      const locationPatch = locationFieldsFromInput(
        {
          latitude: row.latitude,
          longitude: row.longitude,
          coordinateSource: "GIS_IMPORT",
          buildingName: row.buildingName,
          verificationStatus: "UNVERIFIED",
        },
        user.userId,
        now,
        existing,
      );
      const patch: Partial<QRNFCRecord> = {
        ...locationPatch,
        ...(row.floor != null ? { floor: row.floor } : {}),
        ...(row.zone != null ? { zoneName: row.zone } : {}),
        ...(row.siteCode != null ? { siteCode: row.siteCode } : {}),
        // Never change public URL or qrId — preserve stable links + historical snapshots.
      };
      await repo.update(existing.agencyId, existing.qrId, patch);
      updated += 1;
      results.push({ safetyPointId: row.safetyPointId, status: "updated" });
    }

    try {
      await auditRepo.create({
        eventId: makeId("audit"),
        agencyId,
        actorId: user.userId,
        type: AUDIT_EVENT_TYPES.QR_NFC_CODE_UPDATED,
        details: {
          action: "gis_import_commit",
          updated,
          skipped,
          rowCount: parsed.data.rows.length,
        },
        createdAt: now,
        resourceType: "integration",
        resourceId: agencyId,
      });
    } catch (err) {
      console.warn("[qr-nfc] gis import audit failed", err);
    }

    return { agencyId, updated, skipped, results };
  }
}
