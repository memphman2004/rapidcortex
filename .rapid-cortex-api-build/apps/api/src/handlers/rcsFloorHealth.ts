import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { rcsFloorHealthQuerySchema } from "rapid-cortex-shared";
import { isRcsuperadmin } from "rapid-cortex-shared";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../lib/auth.js";
import {
  badRequestFromZod,
  forbidden,
  serverError,
  serviceUnavailable,
  unauthorized,
} from "../lib/response.js";
import { env } from "../lib/env.js";
import { requireAddon } from "../middleware/requireAddon.js";
import { canViewFloorHealth } from "../features/rcs/rcs-authz.js";
import { enrichCallsWithDispatcherEmail } from "../features/rcs/rcs-dispatcher-label.js";
import { RcsRepository } from "../features/rcs/rcs-repository.js";
import { rcsJson } from "../features/rcs/rcs-api-response.js";
import { buildFloorHealthSnapshot } from "../features/rcs/rcs-intelligence.js";

const repo = new RcsRepository();
const requireRcsAddon = requireAddon("rcs.module");

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const user = await getUserContext(event);
    if (!user) return unauthorized();
    if (!isUserAccountActive(user)) return unauthorized(ACCOUNT_INACTIVE_MESSAGE);
    if (!env.enableRcs) return serviceUnavailable("Response Continuity System is not enabled");

    const addonGate = await requireRcsAddon(event, user);
    if (addonGate) return addonGate;
    if (!canViewFloorHealth(user)) return forbidden();

    const parsed = rcsFloorHealthQuerySchema.safeParse({
      agencyId: event.queryStringParameters?.agencyId,
    });
    if (!parsed.success) return badRequestFromZod(parsed.error);

    const agencyId = parsed.data.agencyId?.trim() || user.agencyId;
    if (!isRcsuperadmin(user) && agencyId !== user.agencyId) return forbidden();

    const [rawCalls, rules] = await Promise.all([
      repo.listCallsByAgency(agencyId, { openOnly: true, limit: 200 }),
      repo.getEscalationRules(agencyId),
    ]);
    const calls = await enrichCallsWithDispatcherEmail(rawCalls);

    const snapshot = buildFloorHealthSnapshot(
      agencyId,
      calls,
      rules.dispatchedWithoutArrivalSeconds,
    );
    return rcsJson(snapshot);
  } catch (e) {
    console.error("rcsFloorHealth", e);
    return serverError();
  }
};
