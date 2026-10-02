/**
 * Consolidated Venue RFP 2396IP HTTP router (case, evidence, audit, reports, analytics, forms, export).
 * Mounted on AppSam5 as ANY /api/venue/{venueCode}/rfp/{proxy+}
 */
import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import {
  venueCaseActionBodySchema,
  venueCustodyTransferBodySchema,
  venueEvidenceConfirmBodySchema,
  venueEvidenceUploadBodySchema,
  venueFormSchemaPutBodySchema,
  venueIntegrationImportBodySchema,
  venueSecureShareBodySchema,
} from "rapid-cortex-shared";
import { withCorrelationHeaders } from "../../lib/correlation.js";
import {
  badRequest,
  forbidden,
  notFound,
  ok,
  serverError,
} from "../../lib/response.js";
import { getCaseDetail, performCaseAction } from "../venue-case-service.js";
import {
  confirmEvidenceUpload,
  listCustodyChain,
  listEvidenceForIncident,
  presignEvidenceDownload,
  requestEvidenceUpload,
  sealVenueEvidence,
  transferCustody,
} from "../venue-evidence-service.js";
import { listVenueRfpAudit } from "../venue-rfp-audit.js";
import {
  distributeVenueReport,
  generateVenueIncidentReport,
  listVenueReports,
} from "../venue-report-pdf-service.js";
import {
  exportVenueIncidentsCsv,
  getVenueAnalytics,
  getVenueFormSchema,
  putVenueFormSchema,
  runVenueIntegrationImport,
} from "../venue-reporting-service.js";
import { requireVenueRouteContext } from "./venue-route-context.js";

function mapErr(event: Parameters<APIGatewayProxyHandlerV2>[0], e: unknown) {
  const msg = e instanceof Error ? e.message : String(e);
  const status = (e as { statusCode?: number }).statusCode;
  if (msg === "NOT_FOUND" || /not found/i.test(msg) || status === 404) {
    return withCorrelationHeaders(event, notFound());
  }
  if (
    msg === "TENANT_MISMATCH" ||
    msg === "FORBIDDEN_PERMISSION" ||
    /forbidden/i.test(msg) ||
    status === 403
  ) {
    return withCorrelationHeaders(event, forbidden());
  }
  if (msg.startsWith("VALIDATION:") || status === 400 || status === 422) {
    return withCorrelationHeaders(event, badRequest(msg.replace(/^VALIDATION:/, "")));
  }
  console.error("[venue-rfp-http]", e);
  return withCorrelationHeaders(event, serverError());
}

function clientIp(event: Parameters<APIGatewayProxyHandlerV2>[0]): string | undefined {
  const headers = event.headers ?? {};
  return (
    headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    headers["X-Forwarded-For"]?.split(",")[0]?.trim() ||
    undefined
  );
}

function parseJson(body: string | undefined): unknown {
  if (!body?.trim()) return {};
  try {
    return JSON.parse(body) as unknown;
  } catch {
    throw Object.assign(new Error("VALIDATION:Invalid JSON body"), { statusCode: 400 });
  }
}

/** Normalize proxy path after /api/venue/{venueCode}/rfp/ */
function rfpPath(event: Parameters<APIGatewayProxyHandlerV2>[0]): {
  method: string;
  parts: string[];
} {
  const method = (event.requestContext.http.method || "GET").toUpperCase();
  const proxy = event.pathParameters?.proxy?.replace(/^\/+|\/+$/g, "") ?? "";
  const raw = event.rawPath ?? "";
  // Prefer explicit proxy; fall back to stripping prefix from rawPath
  let path = proxy;
  if (!path && raw.includes("/rfp/")) {
    path = raw.split("/rfp/")[1]?.split("?")[0] ?? "";
  }
  return { method, parts: path.split("/").filter(Boolean) };
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const venueCode =
      event.pathParameters?.venueCode?.trim() || event.queryStringParameters?.venueCode?.trim();
    const { method, parts } = rfpPath(event);
    const isMutation = ["POST", "PUT", "PATCH", "DELETE"].includes(method);
    const permission = isMutation ? "incidents.update" : "incidents.view";

    const ctx = await requireVenueRouteContext(event, permission, venueCode);
    if ("response" in ctx) return ctx.response;
    const { user, venueCode: code, agencyId } = ctx;
    const actorLabel = user.email || user.userId;
    const actorRole = String(user.role);
    void clientIp(event);

    // GET form-schema | PUT form-schema
    if (parts[0] === "form-schema" && parts.length === 1) {
      if (method === "GET") {
        return withCorrelationHeaders(event, ok({ schema: await getVenueFormSchema(code) }));
      }
      if (method === "PUT") {
        const parsed = venueFormSchemaPutBodySchema.safeParse(parseJson(event.body));
        if (!parsed.success) {
          return withCorrelationHeaders(event, badRequest(parsed.error.message));
        }
        const schema = await putVenueFormSchema({
          venueCode: code,
          agencyId,
          actorId: user.userId,
          actorRole,
          body: parsed.data,
        });
        return withCorrelationHeaders(event, ok({ schema }));
      }
    }

    // GET analytics
    if (parts[0] === "analytics" && parts.length === 1 && method === "GET") {
      const out = await getVenueAnalytics({
        venueCode: code,
        agencyId,
        startDate: event.queryStringParameters?.startDate,
        endDate: event.queryStringParameters?.endDate,
      });
      return withCorrelationHeaders(event, ok(out));
    }

    // GET export/incidents
    if (parts[0] === "export" && parts[1] === "incidents" && method === "GET") {
      const out = await exportVenueIncidentsCsv({
        venueCode: code,
        agencyId,
        actorId: user.userId,
        actorRole,
        startDate: event.queryStringParameters?.startDate,
        endDate: event.queryStringParameters?.endDate,
      });
      return withCorrelationHeaders(
        event,
        ok({ format: "csv", count: out.count, csv: out.csv, contentType: "text/csv" }),
      );
    }

    // POST integrations/import
    if (parts[0] === "integrations" && parts[1] === "import" && method === "POST") {
      const parsed = venueIntegrationImportBodySchema.safeParse(parseJson(event.body));
      if (!parsed.success) {
        return withCorrelationHeaders(event, badRequest(parsed.error.message));
      }
      const out = await runVenueIntegrationImport({
        venueCode: code,
        agencyId,
        actorId: user.userId,
        actorRole,
        body: parsed.data,
      });
      return withCorrelationHeaders(event, ok(out, 201));
    }

    // GET audit
    if (parts[0] === "audit" && parts.length === 1 && method === "GET") {
      const items = await listVenueRfpAudit({
        venueCode: code,
        incidentId: event.queryStringParameters?.incidentId,
        limit: Number(event.queryStringParameters?.limit ?? 100),
      });
      return withCorrelationHeaders(event, ok({ items }));
    }

    // incidents/{incidentId}/...
    if (parts[0] === "incidents" && parts[1]) {
      const incidentId = parts[1];
      const rest = parts.slice(2);

      // GET .../case | POST .../case/actions
      if (rest[0] === "case") {
        if (rest.length === 1 && method === "GET") {
          const incident = await getCaseDetail(code, incidentId, agencyId);
          return withCorrelationHeaders(event, ok({ incident }));
        }
        if (rest[1] === "actions" && method === "POST") {
          const parsed = venueCaseActionBodySchema.safeParse(parseJson(event.body));
          if (!parsed.success) {
            return withCorrelationHeaders(event, badRequest(parsed.error.message));
          }
          const result = await performCaseAction({
            venueCode: code,
            agencyId,
            incidentId,
            actorId: user.userId,
            actorLabel,
            body: parsed.data,
          });
          return withCorrelationHeaders(event, ok({ result }));
        }
      }

      // GET .../audit
      if (rest[0] === "audit" && rest.length === 1 && method === "GET") {
        const items = await listVenueRfpAudit({ venueCode: code, incidentId, limit: 200 });
        return withCorrelationHeaders(event, ok({ items }));
      }

      // Evidence routes
      if (rest[0] === "evidence") {
        if (rest.length === 1 && method === "GET") {
          const items = await listEvidenceForIncident(code, incidentId, agencyId);
          return withCorrelationHeaders(event, ok({ items }));
        }
        if (rest[1] === "upload-url" && method === "POST") {
          const parsed = venueEvidenceUploadBodySchema.safeParse(parseJson(event.body));
          if (!parsed.success) {
            return withCorrelationHeaders(event, badRequest(parsed.error.message));
          }
          const out = await requestEvidenceUpload({
            venueCode: code,
            agencyId,
            incidentId,
            actorId: user.userId,
            actorLabel,
            body: parsed.data,
          });
          return withCorrelationHeaders(event, ok(out, 201));
        }
        if (rest[1] === "confirm" && method === "POST") {
          const parsed = venueEvidenceConfirmBodySchema.safeParse(parseJson(event.body));
          if (!parsed.success) {
            return withCorrelationHeaders(event, badRequest(parsed.error.message));
          }
          const evidence = await confirmEvidenceUpload({
            venueCode: code,
            agencyId,
            incidentId,
            actorId: user.userId,
            actorLabel,
            body: parsed.data,
          });
          return withCorrelationHeaders(event, ok({ evidence }));
        }
        if (rest[1] && rest[2] === "seal" && method === "POST") {
          const evidence = await sealVenueEvidence({
            venueCode: code,
            agencyId,
            incidentId,
            evidenceId: rest[1],
            actorId: user.userId,
            actorLabel,
            actorRole,
          });
          return withCorrelationHeaders(event, ok({ evidence }));
        }
        if (rest[1] && rest[2] === "custody" && method === "GET") {
          const items = await listCustodyChain(code, incidentId, rest[1], agencyId);
          return withCorrelationHeaders(event, ok({ items }));
        }
        if (rest[1] && rest[2] === "custody" && method === "POST") {
          const parsed = venueCustodyTransferBodySchema.safeParse(parseJson(event.body));
          if (!parsed.success) {
            return withCorrelationHeaders(event, badRequest(parsed.error.message));
          }
          const entry = await transferCustody({
            venueCode: code,
            agencyId,
            incidentId,
            actorId: user.userId,
            actorLabel,
            body: parsed.data,
          });
          return withCorrelationHeaders(event, ok({ entry }));
        }
        if (rest[1] && rest[2] === "download-url" && method === "POST") {
          const url = await presignEvidenceDownload(code, incidentId, rest[1], agencyId);
          return withCorrelationHeaders(event, ok({ downloadUrl: url, expiresIn: 300 }));
        }
      }

      // Reports
      if (rest[0] === "reports") {
        if (rest.length === 1 && method === "GET") {
          const items = await listVenueReports(code, incidentId, agencyId);
          return withCorrelationHeaders(event, ok({ items }));
        }
        if (rest.length === 1 && method === "POST") {
          const body = parseJson(event.body) as { ttlHours?: number };
          const out = await generateVenueIncidentReport({
            venueCode: code,
            agencyId,
            incidentId,
            actorId: user.userId,
            actorRole,
            actorEmail: user.email,
            ttlHours: body.ttlHours,
          });
          return withCorrelationHeaders(event, ok(out, 201));
        }
        if (rest[1] && rest[2] === "distribute" && method === "POST") {
          const parsed = venueSecureShareBodySchema.safeParse(parseJson(event.body));
          if (!parsed.success) {
            return withCorrelationHeaders(event, badRequest(parsed.error.message));
          }
          const out = await distributeVenueReport({
            venueCode: code,
            agencyId,
            incidentId,
            reportId: rest[1],
            actorId: user.userId,
            actorRole,
            body: parsed.data,
          });
          return withCorrelationHeaders(event, ok(out));
        }
      }
    }

    return withCorrelationHeaders(event, notFound("Unknown venue RFP route"));
  } catch (e) {
    return mapErr(event, e);
  }
};
