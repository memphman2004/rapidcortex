import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import type { CatalogItem } from "rapid-cortex-shared";
import { isRcsuperadmin } from "rapid-cortex-shared";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../../lib/auth.js";
import { ok, serverError, unauthorized } from "../../lib/response.js";
import { readGlobalConfig, upsertItem } from "../../pricing/pricing-store.js";

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const user = await getUserContext(event);
  if (!user) return unauthorized();
  if (!isUserAccountActive(user)) return unauthorized(ACCOUNT_INACTIVE_MESSAGE);
  if (!isRcsuperadmin(user)) return ok({ error: "Forbidden" }, 403);

  const id = event.pathParameters?.id;
  if (!id) return ok({ error: "Item ID required" }, 400);

  let body: unknown;
  try {
    body = JSON.parse(event.body ?? "{}");
  } catch {
    return ok({ error: "Invalid JSON" }, 400);
  }

  // expectedUpdatedAt enables optimistic locking — client passes the item's current
  // updatedAt so concurrent PATCHes produce a 409 instead of a silent last-write-wins.
  const req = body as { patch?: unknown; reason?: string; expectedUpdatedAt?: string };
  if (!req.patch || typeof req.reason !== "string" || !req.reason.trim()) {
    return ok({ error: "patch (object) and reason (string) are required" }, 400);
  }

  try {
    const { items } = await readGlobalConfig();
    const before = items.find((x) => x.id === id);
    if (!before) return ok({ error: "Item not found" }, 404);

    const updated: CatalogItem = { ...before, ...(req.patch as Partial<CatalogItem>), id };
    await upsertItem(
      updated,
      user.userId,
      user.email,
      req.reason.trim(),
      before,
      req.expectedUpdatedAt,
    );
    return ok({ item: updated });
  } catch (error) {
    if (error instanceof Error && error.name === "TransactionCanceledException") {
      return ok({ error: "Conflict: item was modified by another request — reload and retry" }, 409);
    }
    console.error("[pricing-config-patch]", error);
    return serverError();
  }
};
