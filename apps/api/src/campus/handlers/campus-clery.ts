import type { APIGatewayProxyHandlerV2, APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import { AuthorizationService, AUDIT_EVENT_TYPES } from "rapid-cortex-security";
import {
  cleryEntryCreateSchema,
  cleryEntryUpdateSchema,
  cleryExternalSyncBodySchema,
  cleryImportBodySchema,
  cleryReportQuerySchema,
  clerySyncFromPlatformBodySchema,
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
  buildCleryReport,
  createManualCleryEntry,
  deleteCleryEntry,
  exportCleryReportCsv,
  exportCleryReportPdf,
  fetchExternalCleryRows,
  importCleryRows,
  listCleryEntries,
  parseCleryCsv,
  syncCleryFromPlatform,
  updateCleryEntry,
} from "../campus-clery-service.js";

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

function featureOff(): APIGatewayProxyStructuredResultV2 {
  return {
    statusCode: 503,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ error: "Campus Clery feature is disabled" }),
  };
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    if (!env.enableCampusClery) {
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
    if (!agencyId) {
      return withCorrelationHeaders(event, forbidden("agencyId required"));
    }

    // GET /api/campus/clery/report
    if (method === "GET" && path.endsWith("/clery/report")) {
      authz.assertCanPerform(user, "campus.clery.view" as never);
      const parsed = cleryReportQuerySchema.safeParse({
        campusCode: event.queryStringParameters?.campusCode,
        academicYear: event.queryStringParameters?.academicYear,
        format: event.queryStringParameters?.format ?? "json",
      });
      if (!parsed.success) {
        return withCorrelationHeaders(event, badRequestFromZod(parsed.error));
      }
      if (!canAccessCampusTenant(user, parsed.data.campusCode)) {
        return withCorrelationHeaders(event, forbidden("Campus code mismatch"));
      }

      const report = await buildCleryReport({
        agencyId,
        campusCode: parsed.data.campusCode,
        academicYear: parsed.data.academicYear,
        actorId: user.userId,
      });

      if (parsed.data.format === "csv") {
        const csv = exportCleryReportCsv(report);
        return withCorrelationHeaders(event, {
          statusCode: 200,
          headers: {
            "content-type": "text/csv; charset=utf-8",
            "content-disposition": `attachment; filename="clery-${parsed.data.campusCode}-${parsed.data.academicYear}.csv"`,
          },
          body: csv,
        });
      }

      if (parsed.data.format === "pdf") {
        const pdf = await exportCleryReportPdf(report);
        return withCorrelationHeaders(event, {
          statusCode: 200,
          headers: {
            "content-type": "application/pdf",
            "content-disposition": `attachment; filename="clery-${parsed.data.campusCode}-${parsed.data.academicYear}.pdf"`,
          },
          body: pdf.toString("base64"),
          isBase64Encoded: true,
        });
      }

      return withCorrelationHeaders(event, ok({ report }));
    }

    // GET /api/campus/clery/entries
    if (method === "GET" && path.endsWith("/clery/entries")) {
      authz.assertCanPerform(user, "campus.clery.view" as never);
      const campusCode = event.queryStringParameters?.campusCode;
      const academicYear = event.queryStringParameters?.academicYear;
      if (!campusCode || !academicYear) {
        return withCorrelationHeaders(event, badRequest("campusCode and academicYear are required"));
      }
      if (!canAccessCampusTenant(user, campusCode)) {
        return withCorrelationHeaders(event, forbidden("Campus code mismatch"));
      }
      const entries = await listCleryEntries({ agencyId, campusCode, academicYear });
      return withCorrelationHeaders(event, ok({ entries }));
    }

    // POST /api/campus/clery/entries
    if (method === "POST" && path.endsWith("/clery/entries")) {
      authz.assertCanPerform(user, "campus.clery.manage" as never);
      let body: unknown;
      try {
        body = parseJson(event.body);
      } catch {
        return withCorrelationHeaders(event, badRequest("Invalid JSON"));
      }
      const parsed = cleryEntryCreateSchema.safeParse(body);
      if (!parsed.success) {
        return withCorrelationHeaders(event, badRequestFromZod(parsed.error));
      }
      if (!canAccessCampusTenant(user, parsed.data.campusCode)) {
        return withCorrelationHeaders(event, forbidden("Campus code mismatch"));
      }
      const entry = await createManualCleryEntry(parsed.data, agencyId, user.userId);
      return withCorrelationHeaders(event, ok({ entry }));
    }

    // PATCH|DELETE /api/campus/clery/entries/{entryId}
    const entryMatch = path.match(/\/clery\/entries\/([^/]+)\/?$/);
    if (entryMatch && (method === "PATCH" || method === "DELETE")) {
      authz.assertCanPerform(user, "campus.clery.manage" as never);
      const entryId = decodeURIComponent(entryMatch[1]);
      const campusCode = event.queryStringParameters?.campusCode;
      const academicYear = event.queryStringParameters?.academicYear;
      if (!campusCode || !academicYear) {
        return withCorrelationHeaders(event, badRequest("campusCode and academicYear are required"));
      }
      if (!canAccessCampusTenant(user, campusCode)) {
        return withCorrelationHeaders(event, forbidden("Campus code mismatch"));
      }

      if (method === "DELETE") {
        await deleteCleryEntry(campusCode, academicYear, entryId, agencyId, user.userId);
        return withCorrelationHeaders(event, ok({ deleted: true, entryId }));
      }

      let body: unknown;
      try {
        body = parseJson(event.body);
      } catch {
        return withCorrelationHeaders(event, badRequest("Invalid JSON"));
      }
      const parsed = cleryEntryUpdateSchema.safeParse(body);
      if (!parsed.success) {
        return withCorrelationHeaders(event, badRequestFromZod(parsed.error));
      }
      const entry = await updateCleryEntry(
        campusCode,
        academicYear,
        entryId,
        agencyId,
        user.userId,
        parsed.data,
      );
      return withCorrelationHeaders(event, ok({ entry }));
    }

    // POST /api/campus/clery/import — CSV text or JSON rows from other software
    if (method === "POST" && path.endsWith("/clery/import")) {
      authz.assertCanPerform(user, "campus.clery.manage" as never);
      let body: unknown;
      try {
        body = parseJson(event.body);
      } catch {
        return withCorrelationHeaders(event, badRequest("Invalid JSON"));
      }

      const asRecord = body as Record<string, unknown>;
      if (typeof asRecord.csv === "string") {
        const campusCode = String(asRecord.campusCode ?? "");
        const academicYear = String(asRecord.academicYear ?? "");
        const sourceSystem = String(asRecord.sourceSystem ?? "csv_upload");
        if (!campusCode || !academicYear) {
          return withCorrelationHeaders(event, badRequest("campusCode and academicYear are required"));
        }
        if (!canAccessCampusTenant(user, campusCode)) {
          return withCorrelationHeaders(event, forbidden("Campus code mismatch"));
        }
        let rows;
        try {
          rows = parseCleryCsv(asRecord.csv);
        } catch (err) {
          return withCorrelationHeaders(
            event,
            badRequest(err instanceof Error ? err.message : "Invalid CSV"),
          );
        }
        if (!rows.length) {
          return withCorrelationHeaders(event, badRequest("CSV contained no data rows"));
        }
        const result = await importCleryRows({
          agencyId,
          campusCode,
          academicYear,
          sourceSystem,
          rows,
          skipDuplicates: asRecord.skipDuplicates !== false,
          actorId: user.userId,
          source: "import",
          auditType: AUDIT_EVENT_TYPES.CAMPUS_CLERY_IMPORTED,
        });
        return withCorrelationHeaders(event, ok(result));
      }

      const parsed = cleryImportBodySchema.safeParse(body);
      if (!parsed.success) {
        return withCorrelationHeaders(event, badRequestFromZod(parsed.error));
      }
      if (!canAccessCampusTenant(user, parsed.data.campusCode)) {
        return withCorrelationHeaders(event, forbidden("Campus code mismatch"));
      }
      const result = await importCleryRows({
        agencyId,
        campusCode: parsed.data.campusCode,
        academicYear: parsed.data.academicYear,
        sourceSystem: parsed.data.sourceSystem,
        rows: parsed.data.rows,
        skipDuplicates: parsed.data.skipDuplicates,
        actorId: user.userId,
        source: "import",
        auditType: AUDIT_EVENT_TYPES.CAMPUS_CLERY_IMPORTED,
      });
      return withCorrelationHeaders(event, ok(result));
    }

    // POST /api/campus/clery/external-sync — pull from another system (mock or future live)
    if (method === "POST" && path.endsWith("/clery/external-sync")) {
      authz.assertCanPerform(user, "campus.clery.manage" as never);
      let body: unknown;
      try {
        body = parseJson(event.body);
      } catch {
        return withCorrelationHeaders(event, badRequest("Invalid JSON"));
      }
      const parsed = cleryExternalSyncBodySchema.safeParse(body);
      if (!parsed.success) {
        return withCorrelationHeaders(event, badRequestFromZod(parsed.error));
      }
      if (!canAccessCampusTenant(user, parsed.data.campusCode)) {
        return withCorrelationHeaders(event, forbidden("Campus code mismatch"));
      }

      let rows;
      try {
        rows = await fetchExternalCleryRows(parsed.data.sourceSystem, parsed.data.academicYear);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "External sync failed";
        if (msg === "EXTERNAL_MOCK_DISABLED") {
          return withCorrelationHeaders(
            event,
            badRequest("Mock external sync requires ENABLE_CAMPUS_CLERY_EXTERNAL_MOCK=1"),
          );
        }
        if (msg.startsWith("EXTERNAL_CONNECTOR_UNAVAILABLE:")) {
          return withCorrelationHeaders(
            event,
            badRequest(
              `No live connector for "${parsed.data.sourceSystem}". Upload a CSV/JSON import, or use sourceSystem "mock" in non-prod with ENABLE_CAMPUS_CLERY_EXTERNAL_MOCK=1.`,
            ),
          );
        }
        throw err;
      }

      const result = await importCleryRows({
        agencyId,
        campusCode: parsed.data.campusCode,
        academicYear: parsed.data.academicYear,
        sourceSystem: parsed.data.sourceSystem,
        rows,
        skipDuplicates: parsed.data.skipDuplicates,
        actorId: user.userId,
        source: "external_sync",
        auditType: AUDIT_EVENT_TYPES.CAMPUS_CLERY_EXTERNAL_SYNCED,
      });
      return withCorrelationHeaders(event, ok(result));
    }

    // POST /api/campus/clery/sync — pull classified Rapid Cortex campus incidents
    if (method === "POST" && path.endsWith("/clery/sync")) {
      authz.assertCanPerform(user, "campus.clery.manage" as never);
      let body: unknown;
      try {
        body = parseJson(event.body);
      } catch {
        return withCorrelationHeaders(event, badRequest("Invalid JSON"));
      }
      const parsed = clerySyncFromPlatformBodySchema.safeParse(body);
      if (!parsed.success) {
        return withCorrelationHeaders(event, badRequestFromZod(parsed.error));
      }
      if (!canAccessCampusTenant(user, parsed.data.campusCode)) {
        return withCorrelationHeaders(event, forbidden("Campus code mismatch"));
      }
      const result = await syncCleryFromPlatform({
        agencyId,
        campusCode: parsed.data.campusCode,
        academicYear: parsed.data.academicYear,
        defaultGeography: parsed.data.defaultGeography,
        actorId: user.userId,
      });
      return withCorrelationHeaders(event, ok(result));
    }

    return withCorrelationHeaders(event, notFound("Unknown Clery route"));
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "FORBIDDEN_PERMISSION") {
        return withCorrelationHeaders(event, forbidden());
      }
      if (error.message === "NOT_FOUND" || error.message === "TENANT_MISMATCH") {
        return withCorrelationHeaders(event, notFound("Clery entry not found"));
      }
      if (error.message === "FEATURE_DISABLED") {
        return withCorrelationHeaders(event, featureOff());
      }
    }
    console.error("[campus-clery]", error);
    return withCorrelationHeaders(event, serverError());
  }
};
