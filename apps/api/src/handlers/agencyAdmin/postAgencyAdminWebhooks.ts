import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../../lib/auth.js";
import { badRequest, badRequestFromZod, forbidden, ok, serverError, unauthorized } from "../../lib/response.js";
import { ZodError } from "zod";
import { WebhooksManagementService } from "../../services/webhooksManagementService.js";

const svc = new WebhooksManagementService();

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const user = await getUserContext(event);
  if (!user) return unauthorized();
  if (!isUserAccountActive(user)) return unauthorized(ACCOUNT_INACTIVE_MESSAGE);
  try {
    let body: unknown;
    try { body = JSON.parse(event.body ?? "{}"); } catch { return badRequest("Invalid JSON body"); }
    const created = await svc.create(user, body);
    return ok(
      {
        webhook: created.webhook,
        signingSecret: created.signingSecret,
        note: "Signing secret shown once; store securely for verifier implementation.",
      },
      201,
    );
  } catch (e: unknown) {
    if (e instanceof Error && e.message === "FORBIDDEN") return forbidden();
    if (e instanceof ZodError) return badRequestFromZod(e);
    return serverError();
  }
};
