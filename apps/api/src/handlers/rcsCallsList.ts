import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { rcsCallsListQuerySchema } from "rapid-cortex-shared";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../lib/auth.js";
import { badRequestFromZod, forbidden, serverError, serviceUnavailable, unauthorized } from "../lib/response.js";
import { env } from "../lib/env.js";
import { requireAddon } from "../middleware/requireAddon.js";
import { canReadRcs } from "../features/rcs/rcs-authz.js";
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

    if (!canReadRcs(user)) return forbidden();

    const parsed = rcsCallsListQuerySchema.safeParse(event.queryStringParameters ?? {});
    if (!parsed.success) return badRequestFromZod(parsed.error);

    const items = await repo.listCallsByAgency(user.agencyId, {
      state: parsed.data.state,
      limit: parsed.data.limit,
    });

    return rcsJson({ items });
  } catch (e) {
    console.error("rcsCallsList", e);
    return serverError();
  }
};
