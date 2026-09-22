import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyHandlerV2,
  APIGatewayProxyResultV2,
  Context,
} from "aws-lambda";
import { notFound, serverError } from "../lib/response.js";
import { matchRcsHttpRoute } from "../features/rcs/rcs-http-dispatch.js";
import { handler as listHandler } from "./rcsCallsList.js";
import { handler as startHandler } from "./rcsCallStart.js";
import { handler as stateHandler } from "./rcsCallState.js";
import { handler as closeHandler } from "./rcsCallClose.js";
import { handler as audioAlertHandler } from "./rcsAudioAlert.js";
import { handler as acknowledgeHandler } from "./rcsSupervisorAck.js";
import { handler as unitPositionHandler } from "./rcsUnitPosition.js";
import { handler as summaryHandler } from "./rcsCallSummary.js";
import { handler as handoffHandler } from "./rcsCallHandoff.js";
import { handler as floorHealthHandler } from "./rcsFloorHealth.js";
import { handler as escalationRulesHandler } from "./rcsEscalationRules.js";

type RcsHttpFn = (
  event: APIGatewayProxyEventV2,
  context: Context,
) => Promise<APIGatewayProxyResultV2>;

function asRcsHttpFn(handler: APIGatewayProxyHandlerV2): RcsHttpFn {
  return async (event, context) => {
    const result = await handler(event, context, () => undefined);
    if (result === undefined) return serverError();
    return result;
  };
}

const HANDLERS: Record<NonNullable<ReturnType<typeof matchRcsHttpRoute>>["handler"], RcsHttpFn> = {
  list: asRcsHttpFn(listHandler),
  start: asRcsHttpFn(startHandler),
  state: asRcsHttpFn(stateHandler),
  close: asRcsHttpFn(closeHandler),
  audioAlert: asRcsHttpFn(audioAlertHandler),
  acknowledge: asRcsHttpFn(acknowledgeHandler),
  unitPosition: asRcsHttpFn(unitPositionHandler),
  summary: asRcsHttpFn(summaryHandler),
  handoff: asRcsHttpFn(handoffHandler),
  floorHealth: asRcsHttpFn(floorHealthHandler),
  escalationRules: asRcsHttpFn(escalationRulesHandler),
};

function withPathParameters(
  event: APIGatewayProxyEventV2,
  extra: Record<string, string>,
): APIGatewayProxyEventV2 {
  return {
    ...event,
    pathParameters: { ...(event.pathParameters ?? {}), ...extra },
  };
}

/** Catch-all `ANY /api/rcs/{proxy+}` — dispatches to the existing per-route handlers. */
export const handler: APIGatewayProxyHandlerV2 = async (event, context) => {
  try {
    const method = event.requestContext.http?.method ?? "GET";
    const path = event.rawPath ?? event.requestContext.http?.path ?? "";
    const matched = matchRcsHttpRoute(method, path);
    if (!matched) return notFound("RCS route not found");
    return HANDLERS[matched.handler](withPathParameters(event, matched.pathParameters), context);
  } catch (e) {
    console.error("rcsHttp", e);
    return serverError();
  }
};
