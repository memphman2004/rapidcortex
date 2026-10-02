import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { ok, serverError } from "../../lib/response.js";
import { emptyColumns, SupportTicketRepository } from "../../repositories/supportTicketRepository.js";
import { requireRcTicketOperator } from "./auth.js";

const repo = new SupportTicketRepository();

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const auth = await requireRcTicketOperator(event);
  if ("error" in auth) return auth.error;

  const q = event.queryStringParameters ?? {};
  try {
    const data = await repo.listBoard({
      channel: q.channel?.trim() || undefined,
      severity: q.severity?.trim() || undefined,
      agencyId: q.agencyId?.trim() || undefined,
    });
    return ok({ success: true, data });
  } catch (error) {
    if (error instanceof Error && error.message === "TICKETS_TABLE_NOT_CONFIGURED") {
      return ok({
        success: true,
        data: { columns: emptyColumns(), metrics: {
          totalOpen: 0,
          sev1Active: 0,
          sev2Active: 0,
          resolvedThisMonth: 0,
          avgResolutionHours: null,
          oldestOpenHours: null,
        } },
      });
    }
    console.error("[get-ticket-board]", error);
    return serverError();
  }
};
