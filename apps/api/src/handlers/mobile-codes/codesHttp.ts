/**
 * Mobile `/api/codes` facade for venue/campus QR codes.
 *
 * Production path: thin-wraps `QrNfcService` (`/api/qr-nfc`) when `QR_NFC_CODES_TABLE` is set.
 * Dev/mock path: in-memory store when the table is unset or `SAFE_SOUND_MOCK=true`.
 *
 * Field mapping: `qrId` → `codeId`, `zoneName` → `zone`, `active` → `status`, `url` → `reportUrl`/`nfcUrl`.
 */
import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import type { QRNFCRecord, RCCode, UserContext } from "rapid-cortex-shared";
import {
  createCodePayloadSchema,
  logNfcWritePayloadSchema,
  updateCodePayloadSchema,
} from "rapid-cortex-shared";
import {
  AUDIT_EVENT_TYPES,
  canManageQrNfcCodes,
  canProgramQrNfcTags,
  canViewQrNfcCodes,
  resolveQrNfcAgencyId,
} from "rapid-cortex-security";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../../lib/auth.js";
import {
  badRequest,
  badRequestFromZod,
  forbidden,
  notFound,
  serverError,
  unauthorized,
} from "../../lib/response.js";
import { env } from "../../lib/env.js";
import { makeId } from "../../lib/ids.js";
import { AuditRepository } from "../../repositories/auditRepository.js";
import { QrNfcService } from "../../qr-nfc/qr-nfc-service.js";
import { httpMethod, mobileError, mobileOk, parseJsonBody } from "../safe-sound/shared.js";

const auditRepo = new AuditRepository();
const qrService = new QrNfcService();
const mockCodes = new Map<string, RCCode>();

function nfcUrlFromReportUrl(reportUrl: string): string {
  return reportUrl.includes("?") ? `${reportUrl}&medium=nfc` : `${reportUrl}?medium=nfc`;
}

function mapQrRecordToRcCode(record: QRNFCRecord): RCCode {
  const nfcWriteLog = (record.nfcWriteLog ?? []).map((entry) => ({
    eventId: entry.eventId,
    codeId: record.qrId,
    writtenBy: entry.writtenBy,
    writtenByName: entry.writtenByName ?? null,
    devicePlatform: entry.devicePlatform,
    writeMethod: entry.writeMethod,
    bytesWritten: entry.bytesWritten,
    tagType: entry.tagType ?? null,
    writtenAt: entry.writtenAt,
  }));
  return {
    codeId: record.qrId,
    agencyId: record.agencyId,
    name: record.name,
    zone: record.zoneName ?? "",
    reportType: record.reportType,
    vertical: record.vertical === "campus" || record.vertical === "venue" ? record.vertical : "venue",
    smsNumber: record.callNumber ?? null,
    reportUrl: record.url,
    nfcUrl: nfcUrlFromReportUrl(record.url),
    status: record.active ? "active" : "inactive",
    nfcWriteLog,
    metrics: {
      nfcTaps: record.nfcTapCount,
      qrScans: record.scanCount,
      lastNfcTap: record.lastEngagementAt ?? null,
      lastQrScan: record.lastEngagementAt ?? null,
    },
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function useMockCodes(): boolean {
  return env.safeSoundMock || !env.qrNfcCodesTable;
}

function assertView(user: UserContext, agencyId: string) {
  if (!canViewQrNfcCodes(user, agencyId)) return forbidden();
  return null;
}

function assertManage(user: UserContext, agencyId: string) {
  if (!canManageQrNfcCodes(user, agencyId)) return forbidden();
  return null;
}

function assertProgram(user: UserContext, agencyId: string) {
  if (!canProgramQrNfcTags(user, agencyId)) return forbidden();
  return null;
}

async function listMockCodes(user: UserContext, agencyId: string): Promise<RCCode[]> {
  const gate = assertView(user, agencyId);
  if (gate) throw new Error("FORBIDDEN");
  return [...mockCodes.values()].filter((c) => c.agencyId === agencyId);
}

async function createMockCode(user: UserContext, agencyId: string, payload: ReturnType<typeof createCodePayloadSchema.parse>): Promise<RCCode> {
  const gate = assertManage(user, agencyId);
  if (gate) throw new Error("FORBIDDEN");
  const now = new Date().toISOString();
  const codeId = makeId("code");
  const reportUrl = `${env.appBaseUrl.replace(/\/$/, "")}/report/${codeId}`;
  const code: RCCode = {
    codeId,
    agencyId,
    name: payload.name,
    zone: payload.zone,
    reportType: payload.reportType,
    vertical: payload.vertical,
    smsNumber: payload.smsNumber ?? null,
    reportUrl,
    nfcUrl: nfcUrlFromReportUrl(reportUrl),
    status: "active",
    nfcWriteLog: [],
    metrics: { nfcTaps: 0, qrScans: 0 },
    createdAt: now,
    updatedAt: now,
  };
  mockCodes.set(`${agencyId}::${codeId}`, code);
  await auditRepo.create({
    eventId: makeId("audit"),
    agencyId,
    actorId: user.userId,
    type: AUDIT_EVENT_TYPES.MOBILE_CODE_CREATED,
    details: { codeId, name: code.name, vertical: code.vertical },
    createdAt: now,
    resourceType: "integration",
    resourceId: codeId,
  });
  return code;
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const user = await getUserContext(event);
    if (!user) return mobileError(event, unauthorized());
    if (!isUserAccountActive(user)) return mobileError(event, unauthorized(ACCOUNT_INACTIVE_MESSAGE));

    const method = httpMethod(event);
    const path = event.rawPath ?? "";
    const codeId = event.pathParameters?.codeId?.trim();
    const queryAgencyId = event.queryStringParameters?.agencyId?.trim();

    if (method === "GET" && path === "/api/codes") {
      const agencyId = resolveQrNfcAgencyId(user, queryAgencyId);
      const viewGate = assertView(user, agencyId);
      if (viewGate) return mobileError(event, viewGate);

      if (useMockCodes()) {
        const codes = await listMockCodes(user, agencyId);
        return mobileOk(event, { codes });
      }

      const items = await qrService.list(user, {
        agencyId,
        vertical: event.queryStringParameters?.vertical as "campus" | "venue" | undefined,
        active:
          event.queryStringParameters?.status === "inactive"
            ? false
            : event.queryStringParameters?.status === "active"
              ? true
              : undefined,
      });
      const codes = items.map((r) => mapQrRecordToRcCode(r as QRNFCRecord));
      return mobileOk(event, { codes });
    }

    if (method === "POST" && path === "/api/codes") {
      const body = parseJsonBody(event);
      if (body === null) return mobileError(event, badRequest("Invalid JSON"));
      const parsed = createCodePayloadSchema.safeParse(body);
      if (!parsed.success) return mobileError(event, badRequestFromZod(parsed.error));

      const agencyId = resolveQrNfcAgencyId(user, parsed.data.agencyId);
      const manageGate = assertManage(user, agencyId);
      if (manageGate) return mobileError(event, manageGate);

      if (useMockCodes()) {
        try {
          const code = await createMockCode(user, agencyId, parsed.data);
          return mobileOk(event, { code }, 201);
        } catch {
          return mobileError(event, forbidden());
        }
      }

      const record = await qrService.create(user, {
        agencyId,
        name: parsed.data.name,
        zoneName: parsed.data.zone,
        vertical: parsed.data.vertical,
        reportType: parsed.data.reportType,
        callNumber: parsed.data.smsNumber ?? undefined,
      });
      return mobileOk(event, { code: mapQrRecordToRcCode(record) }, 201);
    }

    if (!codeId) return mobileError(event, notFound());

    if (method === "GET" && path === `/api/codes/${codeId}`) {
      if (useMockCodes()) {
        const code = [...mockCodes.values()].find((c) => c.codeId === codeId);
        if (!code) return mobileError(event, notFound("Code not found"));
        const viewGate = assertView(user, code.agencyId);
        if (viewGate) return mobileError(event, viewGate);
        return mobileOk(event, { code });
      }

      const record = await qrService.get(user, codeId, queryAgencyId);
      if (!record) return mobileError(event, notFound("Code not found"));
      return mobileOk(event, { code: mapQrRecordToRcCode(record) });
    }

    if (method === "PATCH" && path === `/api/codes/${codeId}`) {
      const body = parseJsonBody(event);
      if (body === null) return mobileError(event, badRequest("Invalid JSON"));
      const parsed = updateCodePayloadSchema.safeParse(body);
      if (!parsed.success) return mobileError(event, badRequestFromZod(parsed.error));

      if (useMockCodes()) {
        const existing = [...mockCodes.values()].find((c) => c.codeId === codeId);
        if (!existing) return mobileError(event, notFound("Code not found"));
        const manageGate = assertManage(user, existing.agencyId);
        if (manageGate) return mobileError(event, manageGate);
        const now = new Date().toISOString();
        const code: RCCode = {
          ...existing,
          ...parsed.data,
          zone: parsed.data.zone ?? existing.zone,
          updatedAt: now,
        };
        mockCodes.set(`${existing.agencyId}::${codeId}`, code);
        await auditRepo.create({
          eventId: makeId("audit"),
          agencyId: existing.agencyId,
          actorId: user.userId,
          type: AUDIT_EVENT_TYPES.MOBILE_CODE_UPDATED,
          details: { codeId, patch: parsed.data },
          createdAt: now,
          resourceType: "integration",
          resourceId: codeId,
        });
        return mobileOk(event, { code });
      }

      const record = await qrService.update(user, codeId, {
        name: parsed.data.name,
        zoneName: parsed.data.zone,
        active: parsed.data.status ? parsed.data.status === "active" : undefined,
        callNumber: parsed.data.smsNumber ?? undefined,
      });
      if (!record) return mobileError(event, notFound("Code not found"));
      return mobileOk(event, { code: mapQrRecordToRcCode(record) });
    }

    if (method === "DELETE" && path === `/api/codes/${codeId}`) {
      if (useMockCodes()) {
        const existing = [...mockCodes.values()].find((c) => c.codeId === codeId);
        if (!existing) return mobileError(event, notFound("Code not found"));
        const manageGate = assertManage(user, existing.agencyId);
        if (manageGate) return mobileError(event, manageGate);
        mockCodes.delete(`${existing.agencyId}::${codeId}`);
        const now = new Date().toISOString();
        await auditRepo.create({
          eventId: makeId("audit"),
          agencyId: existing.agencyId,
          actorId: user.userId,
          type: AUDIT_EVENT_TYPES.MOBILE_CODE_DELETED,
          details: { codeId },
          createdAt: now,
          resourceType: "integration",
          resourceId: codeId,
        });
        return mobileOk(event, { success: true });
      }

      const record = await qrService.deactivate(user, codeId);
      if (!record) return mobileError(event, notFound("Code not found"));
      return mobileOk(event, { success: true });
    }

    if (method === "POST" && path.endsWith("/nfc-write")) {
      const body = parseJsonBody(event);
      if (body === null) return mobileError(event, badRequest("Invalid JSON"));
      const parsed = logNfcWritePayloadSchema.safeParse(body);
      if (!parsed.success) return mobileError(event, badRequestFromZod(parsed.error));

      const now = new Date().toISOString();
      const nfcEvent = {
        eventId: makeId("nfc"),
        codeId,
        writtenBy: parsed.data.writtenBy,
        devicePlatform: parsed.data.devicePlatform,
        writeMethod: parsed.data.writeMethod,
        bytesWritten: parsed.data.bytesWritten,
        tagType: parsed.data.tagType ?? null,
        writtenAt: now,
      };

      if (useMockCodes()) {
        const existing = [...mockCodes.values()].find((c) => c.codeId === codeId);
        if (!existing) return mobileError(event, notFound("Code not found"));
        const programGate = assertProgram(user, existing.agencyId);
        if (programGate) return mobileError(event, programGate);
        const log = [...existing.nfcWriteLog, nfcEvent];
        const code = { ...existing, nfcWriteLog: log, updatedAt: now };
        mockCodes.set(`${existing.agencyId}::${codeId}`, code);
        await auditRepo.create({
          eventId: makeId("audit"),
          agencyId: existing.agencyId,
          actorId: user.userId,
          type: AUDIT_EVENT_TYPES.MOBILE_CODE_NFC_WRITE_LOGGED,
          details: { codeId, bytesWritten: parsed.data.bytesWritten },
          createdAt: now,
          resourceType: "integration",
          resourceId: codeId,
        });
        return mobileOk(event, { event: nfcEvent }, 201);
      }

      const record = await qrService.appendNfcWriteLog(user, codeId, {
        eventId: nfcEvent.eventId,
        writtenBy: nfcEvent.writtenBy,
        devicePlatform: nfcEvent.devicePlatform,
        writeMethod: "native_nfc",
        bytesWritten: nfcEvent.bytesWritten,
        tagType: nfcEvent.tagType,
        writtenAt: now,
      });
      void record;
      return mobileOk(event, { event: nfcEvent }, 201);
    }

    return mobileError(event, notFound());
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "FORBIDDEN") return mobileError(event, forbidden());
    if (msg === "NOT_FOUND") return mobileError(event, notFound("Code not found"));
    console.error("mobile-codes codesHttp", e);
    return mobileError(event, serverError());
  }
};
