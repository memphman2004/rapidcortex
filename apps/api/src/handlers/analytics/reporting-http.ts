import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../../lib/auth.js";
import { withCorrelationHeaders } from "../../lib/correlation.js";
import { canViewIQReporting } from "../../lib/iq-reporting-authz.js";
import { isIQVertical, queryIQDailyRecords } from "../../lib/iq-reporting-ddb.js";
import { operationalPasswordBlock } from "../../lib/operationalPasswordGate.js";
import { authFailure, badRequest, forbidden, ok, serverError } from "../../lib/response.js";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const user = await getUserContext(event);
  if (!user) return withCorrelationHeaders(event, authFailure(event));
  if (!isUserAccountActive(user)) {
    return withCorrelationHeaders(event, forbidden(ACCOUNT_INACTIVE_MESSAGE));
  }
  const pwd = operationalPasswordBlock(user);
  if (pwd) return withCorrelationHeaders(event, pwd);

  const qs = event.queryStringParameters ?? {};
  const agencyId = String(qs.agencyId ?? "").trim();
  const vertical = String(qs.vertical ?? "").trim();
  const startDate = String(qs.startDate ?? "").trim();
  const endDate = String(qs.endDate ?? "").trim();

  if (!agencyId || !isIQVertical(vertical) || !DATE_RE.test(startDate) || !DATE_RE.test(endDate)) {
    return withCorrelationHeaders(event, badRequest("Invalid query"));
  }
  if (startDate > endDate) {
    return withCorrelationHeaders(event, badRequest("Invalid date range"));
  }
  if (!canViewIQReporting(user, agencyId)) {
    return withCorrelationHeaders(event, forbidden("Forbidden"));
  }

  try {
    const current = await queryIQDailyRecords({ agencyId, vertical, startDate, endDate });
    return withCorrelationHeaders(event, ok({ success: true, current }));
  } catch (err) {
    console.error(
      JSON.stringify({
        msg: "iq_reporting_query_failed",
        error: err instanceof Error ? err.message : "unknown",
      }),
    );
    return withCorrelationHeaders(event, serverError("iQ reporting query failed"));
  }
};
