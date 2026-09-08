import type { APIGatewayProxyHandlerV2, APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import { AuthorizationService, type Permission } from "rapid-cortex-security";
import {
  cleryAsrPolicyPatchBodySchema,
  cleryClassifyBodySchema,
  cleryCreateRecordBodySchema,
  cleryCsaCreateBodySchema,
  cleryCsaUpdateBodySchema,
  cleryDclPatchBodySchema,
  cleryPublicSettingsPatchBodySchema,
  cleryRecordStatusSchema,
  cleryTimelyWarningBodySchema,
  cleryUnfoundBodySchema,
  cleryZonePatchBodySchema,
  canUnfoundCrime,
  UNFOUND_FORBIDDEN_MESSAGE,
} from "rapid-cortex-shared";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../../lib/auth.js";
import { withCorrelationHeaders } from "../../lib/correlation.js";
import { env } from "../../lib/env.js";
import { operationalPasswordBlock } from "../../lib/operationalPasswordGate.js";
import {
  badRequest,
  badRequestFromZod,
  forbidden,
  notFound,
  ok,
  serverError,
  unauthorized,
} from "../../lib/response.js";
import { canAccessCampusTenant } from "../campus-access.js";
import {
  classifyCleryRecord,
  createCleryRecordFromIncident,
  deactivateCsa,
  generateAsrArtifacts,
  getAsrPreview,
  getCleryRecord,
  getComplianceDashboard,
  getSuggestion,
  listCleryRecords,
  listCsa,
  listDailyCrimeLog,
  listOverdueCleryRecords,
  listZonesWithConfig,
  patchDclDisposition,
  patchZone,
  recordTimelyWarning,
  saveAsrPolicy,
  savePublicSettings,
  unfoundCleryRecord,
  upsertCsa,
  buildAsrPdf,
  buildEdExportCsv,
} from "../clery-act/service.js";
import { cleryActStore } from "../clery-act/store.js";

const authz = new AuthorizationService();

function pathOf(event: Parameters<APIGatewayProxyHandlerV2>[0]): string {
  return event.rawPath ?? event.requestContext?.http?.path ?? "";
}

function methodOf(event: Parameters<APIGatewayProxyHandlerV2>[0]): string {
  return (event.requestContext?.http?.method ?? "GET").toUpperCase();
}

function parseJson(body: string | undefined): unknown {
  try {
    return JSON.parse(body ?? "{}");
  } catch {
    throw new Error("INVALID_JSON");
  }
}

function restAfter(path: string, marker: string): string[] {
  const idx = path.indexOf(marker);
  const tail = idx >= 0 ? path.slice(idx + marker.length) : "";
  return tail.split("/").filter(Boolean);
}

function requirePerm(user: { role: string; agencyId: string; userId: string }, perm: Permission) {
  if (!authz.canPerform(user, perm)) {
    throw Object.assign(new Error("FORBIDDEN_PERMISSION"), { statusCode: 403 });
  }
}

function featureOff(): APIGatewayProxyStructuredResultV2 {
  return {
    statusCode: 503,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ error: "Clery Act module is disabled" }),
  };
}

function campusFrom(query: Record<string, string | undefined> | null | undefined, bodyCampus?: string) {
  return (bodyCampus || query?.campusCode || "").trim();
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    if (!env.enableCleryModule) {
      return withCorrelationHeaders(event, featureOff());
    }

    const user = await getUserContext(event);
    if (!user) return withCorrelationHeaders(event, unauthorized());
    if (!isUserAccountActive(user)) {
      return withCorrelationHeaders(event, unauthorized(ACCOUNT_INACTIVE_MESSAGE));
    }
    const pwd = operationalPasswordBlock(user);
    if (pwd) return withCorrelationHeaders(event, pwd);

    const path = pathOf(event);
    const method = methodOf(event);
    const agencyId = user.agencyId ?? "";
    if (!agencyId) return withCorrelationHeaders(event, forbidden("agencyId required"));
    const q = event.queryStringParameters ?? {};

    const cleryParts = restAfter(path, "/api/campus/clery/");

    if (method === "GET" && cleryParts[0] === "records" && cleryParts.length === 1) {
      requirePerm(user, "clery.record.view");
      const campusCode = campusFrom(q);
      if (!campusCode || !canAccessCampusTenant(user, campusCode)) {
        return withCorrelationHeaders(event, forbidden("Campus code mismatch"));
      }
      const status = q.status ? cleryRecordStatusSchema.safeParse(q.status) : null;
      const year = q.year ? Number(q.year) : undefined;
      const records = await listCleryRecords(agencyId, {
        status: status?.success ? status.data : undefined,
        year: Number.isFinite(year) ? year : undefined,
      });
      return withCorrelationHeaders(event, ok({ records }));
    }

    if (method === "POST" && cleryParts[0] === "records" && cleryParts.length === 1) {
      requirePerm(user, "clery.record.create");
      const parsed = cleryCreateRecordBodySchema.safeParse(parseJson(event.body));
      if (!parsed.success) return withCorrelationHeaders(event, badRequestFromZod(parsed.error));
      if (!canAccessCampusTenant(user, parsed.data.campusCode)) {
        return withCorrelationHeaders(event, forbidden("Campus code mismatch"));
      }
      const record = await createCleryRecordFromIncident({
        agencyId,
        campusCode: parsed.data.campusCode,
        incidentId: parsed.data.incidentId,
        actorId: user.userId,
        reportedToInstitutionAt: parsed.data.reportedToInstitutionAt,
        cleryZoneRcli: parsed.data.cleryZoneRcli,
      });
      return withCorrelationHeaders(event, ok({ record }));
    }

    if (cleryParts[0] === "records" && cleryParts[1] && cleryParts[2] === "suggestion" && method === "GET") {
      requirePerm(user, "clery.record.review");
      const campusCode = campusFrom(q);
      if (!campusCode || !canAccessCampusTenant(user, campusCode)) {
        return withCorrelationHeaders(event, forbidden("Campus code mismatch"));
      }
      const payload = await getSuggestion(agencyId, decodeURIComponent(cleryParts[1]));
      return withCorrelationHeaders(event, ok(payload));
    }

    if (cleryParts[0] === "records" && cleryParts[1] && cleryParts[2] === "classify" && method === "PATCH") {
      requirePerm(user, "clery.record.review");
      const parsed = cleryClassifyBodySchema.safeParse(parseJson(event.body));
      if (!parsed.success) return withCorrelationHeaders(event, badRequestFromZod(parsed.error));
      if (!canAccessCampusTenant(user, parsed.data.campusCode)) {
        return withCorrelationHeaders(event, forbidden("Campus code mismatch"));
      }
      const record = await classifyCleryRecord({
        agencyId,
        recordId: decodeURIComponent(cleryParts[1]),
        actorId: user.userId,
        body: parsed.data,
      });
      return withCorrelationHeaders(event, ok({ record }));
    }

    if (cleryParts[0] === "records" && cleryParts[1] && cleryParts[2] === "unfound" && method === "PATCH") {
      requirePerm(user, "clery.record.unfound");
      const parsed = cleryUnfoundBodySchema.safeParse(parseJson(event.body));
      if (!parsed.success) return withCorrelationHeaders(event, badRequestFromZod(parsed.error));
      if (!canAccessCampusTenant(user, parsed.data.campusCode)) {
        return withCorrelationHeaders(event, forbidden("Campus code mismatch"));
      }
      const record = await unfoundCleryRecord({
        agencyId,
        recordId: decodeURIComponent(cleryParts[1]),
        actorId: user.userId,
        body: parsed.data,
      });
      return withCorrelationHeaders(event, ok({ record }));
    }

    if (cleryParts[0] === "records" && cleryParts[1] && cleryParts[2] === "timely-warning" && method === "PATCH") {
      requirePerm(user, "clery.record.review");
      const parsed = cleryTimelyWarningBodySchema.safeParse(parseJson(event.body));
      if (!parsed.success) return withCorrelationHeaders(event, badRequestFromZod(parsed.error));
      if (!canAccessCampusTenant(user, parsed.data.campusCode)) {
        return withCorrelationHeaders(event, forbidden("Campus code mismatch"));
      }
      const record = await recordTimelyWarning({
        agencyId,
        recordId: decodeURIComponent(cleryParts[1]),
        actorId: user.userId,
        required: parsed.data.required,
        declinedReason: parsed.data.declinedReason,
        alertId: parsed.data.alertId,
      });
      return withCorrelationHeaders(event, ok({
        record,
        dispatchHint: parsed.data.required
          ? {
              path: `/app/campus/${parsed.data.campusCode}/alerts`,
              templateType: "TIMELY_WARNING",
              confirmRequired: true,
            }
          : null,
      }));
    }

    if (method === "GET" && cleryParts[0] === "records" && cleryParts[1] && cleryParts.length === 2) {
      requirePerm(user, "clery.record.view");
      const campusCode = campusFrom(q);
      if (!campusCode || !canAccessCampusTenant(user, campusCode)) {
        return withCorrelationHeaders(event, forbidden("Campus code mismatch"));
      }
      const record = await getCleryRecord(agencyId, decodeURIComponent(cleryParts[1]));
      if (!record) return withCorrelationHeaders(event, notFound("Clery record not found"));
      return withCorrelationHeaders(event, ok({ record }));
    }

    if (method === "GET" && cleryParts[0] === "daily-crime-log" && cleryParts[1] === "overdue") {
      requirePerm(user, "clery.daily-crime-log.view");
      const campusCode = campusFrom(q);
      if (!campusCode || !canAccessCampusTenant(user, campusCode)) {
        return withCorrelationHeaders(event, forbidden("Campus code mismatch"));
      }
      const records = await listOverdueCleryRecords(agencyId);
      return withCorrelationHeaders(event, ok({ records }));
    }

    if (method === "GET" && cleryParts[0] === "daily-crime-log" && cleryParts.length === 1) {
      requirePerm(user, "clery.daily-crime-log.view");
      const campusCode = campusFrom(q);
      if (!campusCode || !canAccessCampusTenant(user, campusCode)) {
        return withCorrelationHeaders(event, forbidden("Campus code mismatch"));
      }
      const entries = await listDailyCrimeLog(agencyId, true);
      return withCorrelationHeaders(event, ok({ entries }));
    }

    if (method === "PATCH" && cleryParts[0] === "daily-crime-log" && cleryParts[1]) {
      requirePerm(user, "clery.daily-crime-log.manage");
      const parsed = cleryDclPatchBodySchema.safeParse(parseJson(event.body));
      if (!parsed.success) return withCorrelationHeaders(event, badRequestFromZod(parsed.error));
      if (!canAccessCampusTenant(user, parsed.data.campusCode)) {
        return withCorrelationHeaders(event, forbidden("Campus code mismatch"));
      }
      const entry = await patchDclDisposition(
        agencyId,
        decodeURIComponent(cleryParts[1]),
        user.userId,
        parsed.data.disposition,
      );
      return withCorrelationHeaders(event, ok({ entry }));
    }

    if (method === "GET" && cleryParts[0] === "csa" && cleryParts[1] === "me") {
      requirePerm(user, "clery.record.view");
      const csa = await cleryActStore.getCsa(agencyId, user.userId);
      return withCorrelationHeaders(event, ok({ csa, canUnfound: canUnfoundCrime(csa) }));
    }

    if (method === "GET" && cleryParts[0] === "csa" && cleryParts.length === 1) {
      requirePerm(user, "clery.csa.manage");
      const campusCode = campusFrom(q);
      if (!campusCode || !canAccessCampusTenant(user, campusCode)) {
        return withCorrelationHeaders(event, forbidden("Campus code mismatch"));
      }
      const items = await listCsa(agencyId);
      return withCorrelationHeaders(event, ok({ csa: items }));
    }

    if (method === "POST" && cleryParts[0] === "csa" && cleryParts.length === 1) {
      requirePerm(user, "clery.csa.manage");
      const parsed = cleryCsaCreateBodySchema.safeParse(parseJson(event.body));
      if (!parsed.success) return withCorrelationHeaders(event, badRequestFromZod(parsed.error));
      if (!canAccessCampusTenant(user, parsed.data.campusCode)) {
        return withCorrelationHeaders(event, forbidden("Campus code mismatch"));
      }
      const item = await upsertCsa(agencyId, user.userId, parsed.data);
      return withCorrelationHeaders(event, ok({ csa: item }));
    }

    if (method === "PATCH" && cleryParts[0] === "csa" && cleryParts[1]) {
      requirePerm(user, "clery.csa.manage");
      const parsed = cleryCsaUpdateBodySchema.safeParse(parseJson(event.body));
      if (!parsed.success) return withCorrelationHeaders(event, badRequestFromZod(parsed.error));
      if (!canAccessCampusTenant(user, parsed.data.campusCode)) {
        return withCorrelationHeaders(event, forbidden("Campus code mismatch"));
      }
      const existing = await cleryActStore.getCsa(agencyId, decodeURIComponent(cleryParts[1]));
      if (!existing) return withCorrelationHeaders(event, notFound("CSA not found"));
      const merged = {
        campusCode: parsed.data.campusCode,
        userId: existing.userId,
        displayName: parsed.data.displayName ?? existing.displayName,
        email: parsed.data.email ?? existing.email,
        reporterType: parsed.data.reporterType ?? existing.reporterType,
        isSwornOfficer: parsed.data.isSwornOfficer ?? existing.isSwornOfficer,
        badgeNumber: parsed.data.badgeNumber === null ? undefined : parsed.data.badgeNumber ?? existing.badgeNumber,
        isCleryCoordinator: parsed.data.isCleryCoordinator ?? existing.isCleryCoordinator,
        trainingCompletedAt: parsed.data.trainingCompletedAt === null ? undefined : parsed.data.trainingCompletedAt ?? existing.trainingCompletedAt,
        trainingExpiresAt: parsed.data.trainingExpiresAt === null ? undefined : parsed.data.trainingExpiresAt ?? existing.trainingExpiresAt,
      };
      const created = cleryCsaCreateBodySchema.safeParse(merged);
      if (!created.success) return withCorrelationHeaders(event, badRequestFromZod(created.error));
      const item = await upsertCsa(agencyId, user.userId, created.data);
      return withCorrelationHeaders(event, ok({ csa: item }));
    }

    if (method === "DELETE" && cleryParts[0] === "csa" && cleryParts[1]) {
      requirePerm(user, "clery.csa.manage");
      const campusCode = campusFrom(q);
      if (!campusCode || !canAccessCampusTenant(user, campusCode)) {
        return withCorrelationHeaders(event, forbidden("Campus code mismatch"));
      }
      await deactivateCsa(agencyId, decodeURIComponent(cleryParts[1]), user.userId);
      return withCorrelationHeaders(event, ok({ deactivated: true }));
    }

    if (method === "GET" && cleryParts[0] === "zones" && cleryParts.length === 1) {
      requirePerm(user, "clery.zones.configure");
      const campusCode = campusFrom(q);
      if (!campusCode || !canAccessCampusTenant(user, campusCode)) {
        return withCorrelationHeaders(event, forbidden("Campus code mismatch"));
      }
      const payload = await listZonesWithConfig(agencyId);
      return withCorrelationHeaders(event, ok(payload));
    }

    if (method === "PATCH" && cleryParts[0] === "zones" && cleryParts[1]) {
      requirePerm(user, "clery.zones.configure");
      const parsed = cleryZonePatchBodySchema.safeParse(parseJson(event.body));
      if (!parsed.success) return withCorrelationHeaders(event, badRequestFromZod(parsed.error));
      if (!canAccessCampusTenant(user, parsed.data.campusCode)) {
        return withCorrelationHeaders(event, forbidden("Campus code mismatch"));
      }
      const zone = await patchZone(agencyId, decodeURIComponent(cleryParts[1]), user.userId, parsed.data);
      return withCorrelationHeaders(event, ok({ zone }));
    }

    if (method === "GET" && cleryParts[0] === "asr" && cleryParts.length === 1) {
      requirePerm(user, "clery.asr.view");
      const campusCode = campusFrom(q);
      if (!campusCode || !canAccessCampusTenant(user, campusCode)) {
        return withCorrelationHeaders(event, forbidden("Campus code mismatch"));
      }
      const reports = await cleryActStore.listAsrReports(agencyId);
      return withCorrelationHeaders(event, ok({ reports }));
    }

    if (cleryParts[0] === "asr" && cleryParts[1]) {
      const year = Number(cleryParts[1]);
      if (!Number.isFinite(year)) return withCorrelationHeaders(event, badRequest("Invalid year"));
      const campusCode = campusFrom(q);

      if (method === "GET" && cleryParts[2] === "statistics") {
        requirePerm(user, "clery.asr.view");
        if (!campusCode || !canAccessCampusTenant(user, campusCode)) {
          return withCorrelationHeaders(event, forbidden("Campus code mismatch"));
        }
        const preview = await getAsrPreview(agencyId, year);
        return withCorrelationHeaders(event, ok(preview));
      }

      if (method === "GET" && (cleryParts[2] === "download" || cleryParts[2] === "ed-export")) {
        requirePerm(user, "clery.asr.view");
        if (!campusCode || !canAccessCampusTenant(user, campusCode)) {
          return withCorrelationHeaders(event, forbidden("Campus code mismatch"));
        }
        const preview = await getAsrPreview(agencyId, year);
        if (cleryParts[2] === "ed-export") {
        const institution =
          preview.disclaimer.match(/reviewed by (.+?)'s designated/)?.[1] ?? campusCode;
        const csv = buildEdExportCsv(institution, year, preview.statistics);
        return withCorrelationHeaders(event, {
          statusCode: 200,
          headers: {
            "content-type": "text/csv; charset=utf-8",
            "content-disposition": `attachment; filename="clery-ed-survey-${year}.csv"`,
          },
          body: csv,
        });
        }
        const pdf = await buildAsrPdf({
          institutionName: preview.disclaimer.match(/reviewed by (.+?)'s designated/)?.[1] ?? campusCode,
          reportYear: year,
          coverageYears: preview.coverageYears,
          statistics: preview.statistics,
        });
        return withCorrelationHeaders(event, {
          statusCode: 200,
          headers: {
            "content-type": "application/pdf",
            "content-disposition": `attachment; filename="asr-${year}.pdf"`,
          },
          body: pdf.toString("base64"),
          isBase64Encoded: true,
        });
      }

      if (method === "POST" && cleryParts[2] === "generate") {
        requirePerm(user, "clery.asr.generate");
        const body = parseJson(event.body) as { campusCode?: string };
        const code = campusFrom(q, body.campusCode);
        if (!code || !canAccessCampusTenant(user, code)) {
          return withCorrelationHeaders(event, forbidden("Campus code mismatch"));
        }
        const preview = await generateAsrArtifacts({ agencyId, reportYear: year, actorId: user.userId });
        return withCorrelationHeaders(event, ok(preview));
      }

      if (method === "PATCH" && cleryParts[2] === "policy" && cleryParts[3]) {
        requirePerm(user, "clery.asr.generate");
        const parsed = cleryAsrPolicyPatchBodySchema.safeParse(parseJson(event.body));
        if (!parsed.success) return withCorrelationHeaders(event, badRequestFromZod(parsed.error));
        if (!canAccessCampusTenant(user, parsed.data.campusCode)) {
          return withCorrelationHeaders(event, forbidden("Campus code mismatch"));
        }
        await saveAsrPolicy(agencyId, year, decodeURIComponent(cleryParts[3]), parsed.data.body, user.userId);
        return withCorrelationHeaders(event, ok({ saved: true }));
      }

      if (method === "GET" && cleryParts.length === 2) {
        requirePerm(user, "clery.asr.view");
        if (!campusCode || !canAccessCampusTenant(user, campusCode)) {
          return withCorrelationHeaders(event, forbidden("Campus code mismatch"));
        }
        const preview = await getAsrPreview(agencyId, year);
        return withCorrelationHeaders(event, ok(preview));
      }
    }

    if (method === "GET" && cleryParts[0] === "compliance") {
      requirePerm(user, "clery.compliance.view");
      const campusCode = campusFrom(q);
      if (!campusCode || !canAccessCampusTenant(user, campusCode)) {
        return withCorrelationHeaders(event, forbidden("Campus code mismatch"));
      }
      const dashboard = await getComplianceDashboard(agencyId, campusCode);
      return withCorrelationHeaders(event, ok(dashboard));
    }

    if (method === "PATCH" && cleryParts[0] === "public-settings") {
      requirePerm(user, "clery.zones.configure");
      const parsed = cleryPublicSettingsPatchBodySchema.safeParse(parseJson(event.body));
      if (!parsed.success) return withCorrelationHeaders(event, badRequestFromZod(parsed.error));
      if (!canAccessCampusTenant(user, parsed.data.campusCode)) {
        return withCorrelationHeaders(event, forbidden("Campus code mismatch"));
      }
      const settings = await savePublicSettings(agencyId, user.userId, parsed.data);
      return withCorrelationHeaders(event, ok({ settings }));
    }

    return withCorrelationHeaders(event, notFound("Unknown Clery Act route"));
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "FORBIDDEN_PERMISSION") {
        return withCorrelationHeaders(event, forbidden());
      }
      if ((error as { code?: string }).code === "UNFOUND_NOT_SWORN" || error.message === UNFOUND_FORBIDDEN_MESSAGE) {
        return withCorrelationHeaders(event, forbidden(UNFOUND_FORBIDDEN_MESSAGE));
      }
      if ((error as { code?: string }).code === "REDACTION_BLOCKED") {
        return withCorrelationHeaders(
          event,
          ok({ error: error.message, blockedTerms: (error as { blockedTerms?: string[] }).blockedTerms }, 400),
        );
      }
      if (
        (error as { code?: string }).code === "HATE_CRIME_REQUIRED" ||
        (error as { code?: string }).code === "HATE_CRIME_BIAS_REQUIRED"
      ) {
        return withCorrelationHeaders(event, badRequest(error.message));
      }
      if ((error as { code?: string }).code === "UNFOUND_LOCKED") {
        return withCorrelationHeaders(event, forbidden(error.message));
      }
      if (error.message === "NOT_FOUND" || error.message === "TENANT_MISMATCH") {
        return withCorrelationHeaders(event, notFound());
      }
      if (error.message === "FEATURE_DISABLED") {
        return withCorrelationHeaders(event, featureOff());
      }
      if (error.message === "INVALID_JSON") {
        return withCorrelationHeaders(event, badRequest("Invalid JSON"));
      }
      if (error.message === "ALREADY_UNFOUNDED") {
        return withCorrelationHeaders(event, badRequest("Record is already unfounded"));
      }
    }
    console.error("[clery-act]", error);
    return withCorrelationHeaders(event, serverError());
  }
};
