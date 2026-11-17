import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { z } from "zod";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../../lib/auth.js";
import { badRequest, badRequestFromZod, forbidden, notFound, ok, serverError, unauthorized } from "../../lib/response.js";
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
  if (!clientId) return badRequest("clientId required");
  let rawBody: unknown;
  try { rawBody = JSON.parse(event.body ?? "{}"); } catch { return badRequest("Invalid JSON body"); }
  const parsed = bodySchema.safeParse(rawBody);
  if (!parsed.success) return badRequestFromZod(parsed.error);
  try {
    await svc.patchStatus(user, clientId, {
      status: parsed.data.status,
      agencyId: event.queryStringParameters?.agencyId ?? null,
    });
    return ok({ ok: true });
  } catch (e: unknown) {
    if (e instanceof Error && e.message === "FORBIDDEN") return forbidden();
    if (e instanceof Error && e.message === "NOT_FOUND") return notFound("API client not found");
    return serverError();
  }
};
