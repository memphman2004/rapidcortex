import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { AuthorizationService } from "rapid-cortex-security";
import { generateReportBodySchema, reportExportQuerySchema } from "rapid-cortex-shared";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../lib/auth.js";
import {
  badRequestFromZod,
  forbidden,
  notFound,
  ok,
  serverError,
  serviceUnavailable,
  unauthorized,
} from "../lib/response.js";
import { ReportService } from "../services/reportService.js";

const service = new ReportService();
const auth = new AuthorizationService();

function mapErr(e: unknown) {
  const msg = e instanceof Error ? e.message : String(e);
  const statusCode = (e as Error & { statusCode?: number }).statusCode;
  if (msg === "FORBIDDEN_PERMISSION" && statusCode === 403) return forbidden();
  if (msg === "REPORTS_DISABLED") return serviceUnavailable("Reports are not enabled");
  if (msg === "NOT_FOUND") return notFound();
  if (msg === "FORBIDDEN" || msg === "TENANT_MISMATCH") return forbidden();
  return serverError();
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const user = await getUserContext(event);
    if (!user) return unauthorized();
    if (!isUserAccountActive(user)) return unauthorized(ACCOUNT_INACTIVE_MESSAGE);

    const routeKey = event.routeKey ?? "";
    const reportId = event.pathParameters?.reportId;

    if (routeKey === "POST /api/reports") {
      auth.assertCanPerform(user, "reports.create");
      const parsed = generateReportBodySchema.safeParse(JSON.parse(event.body ?? "{}"));
      if (!parsed.success) return badRequestFromZod(parsed.error);
      const created = await service.generate(user, parsed.data);
      return ok(created, 201);
    }

    if (routeKey === "GET /api/reports") {
      auth.assertCanPerform(user, "reports.view");
      return ok(await service.list(user));
    }

    if (routeKey === "GET /api/reports/{reportId}") {
      auth.assertCanPerform(user, "reports.view");
      if (!reportId) return notFound();
      return ok(await service.get(user, reportId));
    }

    if (routeKey === "GET /api/reports/{reportId}/export") {
      auth.assertCanPerform(user, "reports.export");
      if (!reportId) return notFound();
      const q = reportExportQuerySchema.safeParse(event.queryStringParameters ?? {});
      if (!q.success) return badRequestFromZod(q.error);
      const result = await service.get(user, reportId);
      if (q.data.format === "csv") {
        const csv = service.exportCsv(result);
        return {
          statusCode: 200,
          headers: {
            "Content-Type": "text/csv",
            "Content-Disposition": `attachment; filename="report-${reportId}.csv"`,
          },
          body: csv,
        };
      }
      return ok(result);
    }

    return notFound();
  } catch (e) {
    return mapErr(e);
  }
};
