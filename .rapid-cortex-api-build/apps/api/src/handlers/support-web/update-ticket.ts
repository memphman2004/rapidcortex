import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { patchSupportTicketBodySchema } from "rapid-cortex-shared";
import { AUDIT_EVENT_TYPES } from "rapid-cortex-security";
import { makeId } from "../../lib/ids.js";
import { badRequestFromZod, ok, serverError } from "../../lib/response.js";
import { AuditRepository } from "../../repositories/auditRepository.js";
import { SupportTicketRepository } from "../../repositories/supportTicketRepository.js";
import { actorName, parseJsonBody, requireRcTicketOperator } from "./auth.js";

const repo = new SupportTicketRepository();
const auditRepo = new AuditRepository();

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const auth = await requireRcTicketOperator(event);
  if ("error" in auth) return auth.error;
  const { user } = auth;

  const ticketId = event.pathParameters?.ticketId?.trim();
  if (!ticketId) return ok({ error: "ticketId is required" }, 400);

  let parsedJson: unknown;
  try {
    parsedJson = parseJsonBody(event);
  } catch {
    return ok({ error: "Invalid JSON body" }, 400);
  }
  const parsed = patchSupportTicketBodySchema.safeParse(parsedJson);
  if (!parsed.success) return badRequestFromZod(parsed.error);

  try {
    const updated = await repo.update(ticketId, parsed.data, {
      userId: user.userId,
      name: actorName(user),
    });
    if (!updated) return ok({ error: "Ticket not found" }, 404);

    try {
      await auditRepo.create({
        eventId: makeId("audit"),
        agencyId: updated.agencyId,
        actorId: user.userId,
        type: parsed.data.status
          ? AUDIT_EVENT_TYPES.SUPPORT_TICKET_STATUS_CHANGED
          : AUDIT_EVENT_TYPES.SUPPORT_TICKET_UPDATED,
        details: { ticketId, fields: Object.keys(parsed.data), status: parsed.data.status },
        createdAt: new Date().toISOString(),
        resourceType: "support_ticket",
        resourceId: ticketId,
      });
    } catch (error) {
      console.error("[update-ticket] audit", error);
    }

    return ok({ success: true, data: updated, item: updated });
  } catch (error) {
    if (error instanceof Error && error.message === "TICKETS_TABLE_NOT_CONFIGURED") {
      return ok({ error: "Support tickets not configured" }, 503);
    }
    if (error instanceof Error && /Invalid status transition|required when/.test(error.message)) {
      return ok({ error: error.message }, 400);
    }
    console.error("[update-ticket]", error);
    return serverError();
  }
};
