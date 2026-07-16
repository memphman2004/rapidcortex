import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { guardianCancelPayloadSchema } from "rapid-cortex-shared";
import { AUDIT_EVENT_TYPES } from "rapid-cortex-security";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../../lib/auth.js";
import {
  badRequest,
  badRequestFromZod,
  forbidden,
  notFound,
  serverError,
  unauthorized,
} from "../../lib/response.js";
import { makeId } from "../../lib/ids.js";
import { AuditRepository } from "../../repositories/auditRepository.js";
import {
  assertDeviceOwner,
  gateGuardian,
  httpMethod,
  mobileError,
  mobileOk,
  parseJsonBody,
  useGuardianMock,
} from "../safe-sound/shared.js";
import {
  getGuardianEvent,
  putGuardianEvent,
  seedMockGuardianEvent,
} from "../safe-sound/store.js";

const auditRepo = new AuditRepository();

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const gate = gateGuardian(event);
    if (gate) return gate;

    const user = await getUserContext(event);
    if (!user) return mobileError(event, unauthorized());
    if (!isUserAccountActive(user)) return mobileError(event, unauthorized(ACCOUNT_INACTIVE_MESSAGE));

    const method = httpMethod(event);
    const path = event.rawPath ?? "";
    const eventId = event.pathParameters?.eventId?.trim();
    const agencyId = user.agencyId;

    if (!eventId) return mobileError(event, notFound());

    if (method === "GET" && path === `/api/guardian/events/${eventId}`) {
      let row = await getGuardianEvent(agencyId, eventId);
      if (!row && useGuardianMock()) {
        row = {
          ...seedMockGuardianEvent(agencyId, user.userId, eventId, "guardian-demo"),
          agencyId,
        };
      }
      if (!row) return mobileError(event, notFound("Guardian event not found"));
      const ownerGate = assertDeviceOwner(user, row.ownerId);
      if (ownerGate) return mobileError(event, ownerGate);
      const { agencyId: _a, ...guardianEvent } = row;
      return mobileOk(event, { event: guardianEvent });
    }

    if (method === "POST" && path.endsWith("/cancel")) {
      let row = await getGuardianEvent(agencyId, eventId);
      if (!row && useGuardianMock()) {
        row = {
          ...seedMockGuardianEvent(agencyId, user.userId, eventId, "guardian-demo"),
          agencyId,
        };
      }
      if (!row) return mobileError(event, notFound("Guardian event not found"));

      const body = parseJsonBody(event);
      if (body === null) return mobileError(event, badRequest("Invalid JSON"));
      const parsed = guardianCancelPayloadSchema.safeParse(body);
      if (!parsed.success) return mobileError(event, badRequestFromZod(parsed.error));

      const isOwner = user.userId === row.ownerId;
      const isOperator = parsed.data.cancelledBy === "operator";
      if (!isOwner && !isOperator) {
        return mobileError(event, forbidden("Only the wearer or an operator may cancel this event"));
      }

      const now = new Date().toISOString();
      const { agencyId: _a, ...existing } = row;
      const updated = {
        ...existing,
        status: "CANCELLED" as const,
        cancelledAt: now,
        cancelledBy: parsed.data.cancelledBy,
        statusHistory: [
          ...existing.statusHistory,
          { status: "CANCELLED" as const, transitionedAt: now, detail: parsed.data.cancelledBy },
        ],
      };
      await putGuardianEvent(agencyId, updated);
      await auditRepo.create({
        eventId: makeId("audit"),
        agencyId,
        actorId: user.userId,
        type: AUDIT_EVENT_TYPES.GUARDIAN_EVENT_CANCELLED,
        details: { eventId, cancelledBy: parsed.data.cancelledBy },
        createdAt: now,
        resourceType: "incident",
        resourceId: eventId,
      });
      return mobileOk(event, { event: updated });
    }

    return mobileError(event, notFound());
  } catch (e) {
    console.error("guardian eventsHttp", e);
    return mobileError(event, serverError());
  }
};
