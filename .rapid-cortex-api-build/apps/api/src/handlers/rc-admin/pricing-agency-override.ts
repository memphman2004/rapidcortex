import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import type { AgencyOverrideRequest } from "rapid-cortex-shared";
import { isRcsuperadmin } from "rapid-cortex-shared";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../../lib/auth.js";
import { ok, serverError, unauthorized } from "../../lib/response.js";
import { writeAgencyOverride } from "../../pricing/pricing-store.js";

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const user = await getUserContext(event);
  if (!user) return unauthorized();
  if (!isUserAccountActive(user)) return unauthorized(ACCOUNT_INACTIVE_MESSAGE);
  if (!isRcsuperadmin(user)) return ok({ error: "Forbidden" }, 403);

  let body: unknown;
  try {
    body = JSON.parse(event.body ?? "{}");
  } catch {
    return ok({ error: "Invalid JSON" }, 400);
  }

  const req = body as AgencyOverrideRequest;
  if (!req.agencyId || !req.itemId || !req.overridePrice || !req.reason?.trim()) {
    return ok({ error: "agencyId, itemId, overridePrice, and reason are required" }, 400);
  }

  try {
    await writeAgencyOverride(
      {
        agencyId: req.agencyId,
        itemId: req.itemId,
        overridePrice: req.overridePrice,
        reason: req.reason.trim(),
        appliedBy: user.email,
        appliedAt: new Date().toISOString(),
      },
      user.userId,
      user.email,
    );
    return ok({ ok: true });
  } catch (error) {
    console.error("[pricing-agency-override]", error);
    return serverError();
  }
};
