import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { addSupportTicketNoteBodySchema } from "rapid-cortex-shared";
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
  const parsed = addSupportTicketNoteBodySchema.safeParse(parsedJson);
  if (!parsed.success) return badRequestFromZod(parsed.error);

  try {
    const updated = await repo.addNote(ticketId, parsed.data.text, {
      userId: user.userId,
      name: actorName(user),
    });
    if (!updated) return ok({ error: "Ticket not found" }, 404);

    try {
      await auditRepo.create({
        eventId: makeId("audit"),
        agencyId: updated.agencyId,
        actorId: user.userId,
        type: AUDIT_EVENT_TYPES.SUPPORT_TICKET_NOTE_ADDED,
        details: { ticketId },
        createdAt: new Date().toISOString(),
        resourceType: "support_ticket",
        resourceId: ticketId,
      });
    } catch (error) {
      console.error("[add-ticket-note] audit", error);
    }

    return ok({ success: true, data: updated, item: updated });
  } catch (error) {
    if (error instanceof Error && error.message === "TICKETS_TABLE_NOT_CONFIGURED") {
      return ok({ error: "Support tickets not configured" }, 503);
    }
    console.error("[add-ticket-note]", error);
    return serverError();
  }
};
