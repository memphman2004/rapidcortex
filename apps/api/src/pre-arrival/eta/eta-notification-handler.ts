import type { APIGatewayProxyHandlerV2, EventBridgeEvent, Handler } from "aws-lambda";
import {
  buildEtaMessage,
  classifyEtaTrigger,
  dispatcherEtaUpdateSchema,
  shouldSendEtaNotification,
  type EtaNotificationTrigger,
  type UnitEtaEvent,
} from "rapid-cortex-shared";
import { AuthorizationService, AUDIT_EVENT_TYPES } from "rapid-cortex-security";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../../lib/auth.js";
import { env } from "../../lib/env.js";
import {
  badRequest,
  forbidden,
  notFound,
  ok,
  serverError,
  serviceUnavailable,
  unauthorized,
} from "../../lib/response.js";
import { AuditRepository } from "../../repositories/auditRepository.js";
import { preArrivalSessionStore } from "../session-store.js";
import { sendPreArrivalSms } from "../sms.js";
import { recordEtaNotification } from "./eta-session-store.js";

const authz = new AuthorizationService();
const auditRepo = new AuditRepository();

function makeId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export async function processEtaEvent(params: {
  incidentId: string;
  agencyId?: string;
  etaMinutes: number | null;
  trigger: EtaNotificationTrigger;
  unitId?: string;
}): Promise<{ sent: boolean; reason?: string }> {
  if (!env.enablePreArrivalIq) return { sent: false, reason: "disabled" };

  const session = await preArrivalSessionStore.getActiveByIncident(params.incidentId, params.agencyId);
  if (!session) return { sent: false, reason: "no_session" };
  if (!session.callerPhoneE164) return { sent: false, reason: "no_phone" };

  const trigger =
    params.trigger === "unit_dispatched" && params.etaMinutes !== null
      ? classifyEtaTrigger(params.etaMinutes, !session.lastEtaNotifiedAt)
      : params.trigger;

  if (
    !shouldSendEtaNotification({
      trigger,
      newEtaMinutes: params.etaMinutes,
      lastKnownEtaMinutes: session.lastKnownEtaMinutes,
      lastEtaNotifiedAt: session.lastEtaNotifiedAt,
    })
  ) {
    return { sent: false, reason: "throttled" };
  }

  const messageBody = buildEtaMessage(trigger, params.etaMinutes);
  const sms = await sendPreArrivalSms({
    phoneE164: session.callerPhoneE164,
    message: messageBody,
    agencyId: session.agencyId,
    incidentId: session.incidentId,
  });

  if (sms.ok) {
    await recordEtaNotification({
      agencyId: session.agencyId,
      sessionToken: session.sessionToken,
      trigger,
      etaMinutes: params.etaMinutes,
      messageBody,
      unitId: params.unitId,
    });
    try {
      await auditRepo.create({
        eventId: makeId("audit"),
        agencyId: session.agencyId,
        incidentId: session.incidentId,
        actorId: "system:eta",
        type:
          trigger === "on_scene"
            ? AUDIT_EVENT_TYPES.PRE_ARRIVAL_ON_SCENE
            : AUDIT_EVENT_TYPES.PRE_ARRIVAL_ETA_SENT,
        details: { sessionToken: session.sessionToken, trigger, etaMinutes: params.etaMinutes },
        createdAt: new Date().toISOString(),
        resourceType: "session",
        resourceId: session.sessionToken,
      });
    } catch {
      /* never abort on audit */
    }
  }

  return { sent: sms.ok, reason: sms.ok ? undefined : sms.errorCode };
}

export const eventHandler: Handler<EventBridgeEvent<string, UnitEtaEvent>> = async (event) => {
  const detail = event.detail;
  const detailType = event["detail-type"] ?? "";
  const etaMinutes =
    detailType === "unit.on_scene" || detail.trigger === "on_scene" ? null : detail.etaMinutes;
  const trigger: EtaNotificationTrigger =
    detail.trigger ??
    (detailType === "unit.on_scene"
      ? "on_scene"
      : detailType === "unit.eta_updated"
        ? "eta_updated"
        : "unit_dispatched");

  return processEtaEvent({
    incidentId: detail.incidentId,
    agencyId: detail.agencyId,
    etaMinutes,
    trigger,
    unitId: detail.unitId,
  });
};

export const apiHandler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    if (!env.enablePreArrivalIq) return serviceUnavailable("Pre-Arrival iQ is not enabled");
    if (!env.preArrivalSessionsTable) return serviceUnavailable("Pre-Arrival iQ is not configured");

    const user = await getUserContext(event);
    if (!user) return unauthorized();
    if (!isUserAccountActive(user)) return unauthorized(ACCOUNT_INACTIVE_MESSAGE);
    authz.assertCanPerform(user, "workspace.caller_media");
    if (!authz.canDispatch(user) || user.role === "auditor") {
      return forbidden("Role cannot update Pre-Arrival ETA");
    }

    const incidentId = event.pathParameters?.id ?? event.pathParameters?.incidentId;
    if (!incidentId) return notFound("Missing incident id");

    const parsed = dispatcherEtaUpdateSchema.safeParse({
      ...JSON.parse(event.body ?? "{}"),
      dispatcherId: user.userId,
    });
    if (!parsed.success) return badRequest(parsed.error.message);

    const result = await processEtaEvent({
      incidentId,
      agencyId: user.agencyId,
      etaMinutes: parsed.data.etaMinutes,
      trigger: "dispatcher_manual",
    });

    return ok(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "FORBIDDEN_PERMISSION") return forbidden();
    if (msg === "NOT_FOUND") return notFound();
    console.error(JSON.stringify({ type: "pre_arrival.eta.api_error", err: msg }));
    return serverError();
  }
};
