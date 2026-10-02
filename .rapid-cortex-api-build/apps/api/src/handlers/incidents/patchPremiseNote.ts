import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { AUDIT_EVENT_TYPES } from "rapid-cortex-security";
import { patchPremiseNoteRequestSchema } from "rapid-cortex-shared";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../../lib/auth.js";
import { canAccessCallerCard } from "../../lib/callerCardRbac.js";
import {
  badRequest,
  forbidden,
  notFound,
  ok,
  serverError,
  unauthorized,
  badRequestFromZod,
} from "../../lib/response.js";
import { makeId } from "../../lib/ids.js";
import { AuditRepository } from "../../repositories/auditRepository.js";
import { CallerCardService } from "../../services/callerCardService.js";

const service = new CallerCardService();
const auditRepo = new AuditRepository();

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const incidentId = event.pathParameters?.id;
    const noteId = event.pathParameters?.noteId;
    if (!incidentId || !noteId) return notFound("Incident ID and note ID required");

    const parsed = patchPremiseNoteRequestSchema.safeParse(JSON.parse(event.body ?? "{}"));
    if (!parsed.success) return badRequestFromZod(parsed.error);

    const user = await getUserContext(event);
    if (!user) return unauthorized();
    if (!isUserAccountActive(user)) return unauthorized(ACCOUNT_INACTIVE_MESSAGE);
    if (!canAccessCallerCard(user)) return forbidden();

    let out;
    try {
      out = await service.patchPremiseNote(incidentId, noteId, user, parsed.data);
    } catch (e: unknown) {
      if (e instanceof Error && e.message === "NO_ADDRESS_ON_INCIDENT") {
        return badRequest("Set a caller address on the incident before editing premise notes.");
      }
      throw e;
    }
    if (out === null) return forbidden("Premise note unavailable, not found, or access denied");

    await auditRepo.create({
      eventId: makeId("audit"),
      agencyId: out.note.agencyId,
      incidentId,
      actorId: user.userId,
      type: AUDIT_EVENT_TYPES.PREMISE_NOTE_UPDATED,
      details: { noteId: out.note.noteId, incidentId },
      createdAt: new Date().toISOString(),
      resourceType: "incident",
      resourceId: incidentId,
    });

    return ok(out);
  } catch {
    return serverError();
  }
};
