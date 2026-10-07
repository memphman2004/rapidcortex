import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { z } from "zod";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../../lib/auth.js";
import { badRequestFromZod, ok, unauthorized } from "../../lib/response.js";
import { ApiClientsManagementService } from "../../services/apiClientsManagementService.js";

const bodySchema = z.object({
  status: z.enum(["disabled", "revoked"]),
});

const svc = new ApiClientsManagementService();

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const user = await getUserContext(event);
  if (!user) return unauthorized();
  if (!isUserAccountActive(user)) return unauthorized(ACCOUNT_INACTIVE_MESSAGE);
  const clientId = event.pathParameters?.clientId;
  if (!clientId) return ok({ error: "clientId required" }, 400);
  const parsed = bodySchema.safeParse(JSON.parse(event.body ?? "{}"));
  if (!parsed.success) return badRequestFromZod(parsed.error);
  try {
    await svc.patchStatus(user, clientId, {
      status: parsed.data.status,
      agencyId: event.queryStringParameters?.agencyId ?? null,
    });
    return ok({ ok: true });
  } catch (e: unknown) {
    if (e instanceof Error && e.message === "FORBIDDEN") return ok({ error: "Forbidden" }, 403);
    if (e instanceof Error && e.message === "NOT_FOUND") return ok({ error: "Not found" }, 404);
    throw e;
  }
};
