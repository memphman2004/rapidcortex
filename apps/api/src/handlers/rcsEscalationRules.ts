import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { rcsEscalationRulesPutSchema } from "rapid-cortex-shared";
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
import { canManageEscalationRules } from "../features/rcs/rcs-authz.js";
import { RcsRepository } from "../features/rcs/rcs-repository.js";
import { rcsJson } from "../features/rcs/rcs-api-response.js";

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
    if (!canManageEscalationRules(user)) return forbidden();

    const method = (event.requestContext.http?.method ?? "GET").toUpperCase();

    if (method === "GET") {
      const rules = await repo.getEscalationRules(user.agencyId);
      return rcsJson({ rules });
    }

    if (method === "PUT") {
      const parsed = rcsEscalationRulesPutSchema.safeParse(JSON.parse(event.body ?? "{}"));
      if (!parsed.success) return badRequestFromZod(parsed.error);
      const now = new Date().toISOString();
      const rules = {
        agencyId: user.agencyId,
        ...parsed.data,
        updatedAt: now,
        updatedByUserId: user.userId,
      };
      await repo.putEscalationRules(rules);
      return rcsJson({ rules });
    }

    return forbidden();
  } catch (e) {
    console.error("rcsEscalationRules", e);
    return serverError();
  }
};
