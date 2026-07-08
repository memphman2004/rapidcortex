import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { isRcsuperadmin } from "rapid-cortex-shared";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../../lib/auth.js";
import { ok, serverError, unauthorized } from "../../lib/response.js";
import { readGlobalConfig, writeGlobalConfig } from "../../pricing/pricing-store.js";

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

  const req = body as { items?: unknown; reason?: string };
  if (!Array.isArray(req.items) || typeof req.reason !== "string" || !req.reason.trim()) {
    return ok({ error: "items (array) and reason (string) are required" }, 400);
  }

  try {
    const current = await readGlobalConfig();
    const result = await writeGlobalConfig(
      req.items as Parameters<typeof writeGlobalConfig>[0],
      user.userId,
      user.email,
      req.reason.trim(),
      current.version,
    );
    return ok({
      version: result.version,
      updatedAt: result.updatedAt,
      updatedBy: user.email,
      itemCount: (req.items as unknown[]).length,
    });
  } catch (error) {
    console.error("[pricing-config-put]", error);
    return serverError();
  }
};
