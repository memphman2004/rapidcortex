import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../../lib/auth.js";
import { forbidden, serverError, unauthorized } from "../../lib/response.js";
import { AdminAnalyticsService } from "../../services/adminAnalyticsService.js";

const service = new AdminAnalyticsService();

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const user = await getUserContext(event);
    if (!user) return unauthorized();
    if (!isUserAccountActive(user)) return unauthorized(ACCOUNT_INACTIVE_MESSAGE);
    const q = event.queryStringParameters ?? {};
    const agencyId = q.agencyId ?? user.agencyId;
    const summary = await service.getCachedSummary(user, agencyId);
    if (!summary) {
      return {
        statusCode: 404,
        headers: { "Content-Type": "text/plain" },
        body: "No cached analytics for this agency. Run refresh first.",
      };
    }
    const csv = service.toCsv(summary);
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="analytics-${summary.agencyId}.csv"`,
      },
      body: csv,
    };
  } catch (error) {
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return forbidden();
    }
    return serverError();
  }
};
