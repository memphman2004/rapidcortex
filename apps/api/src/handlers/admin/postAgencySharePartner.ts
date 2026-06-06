import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { postAgencySharePartnerBodySchema } from "rapid-cortex-shared";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../../lib/auth.js";
import {
  badRequest,
  forbidden,
  notFound,
  ok,
  serverError,
  unauthorized,
  badRequestFromZod,
} from "../../lib/response.js";
import { IncidentShareService } from "../../services/incidentShareService.js";

const service = new IncidentShareService();

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const agencyId = event.pathParameters?.id;
    if (!agencyId) return badRequest("agency id required");

    const parsed = postAgencySharePartnerBodySchema.safeParse(JSON.parse(event.body ?? "{}"));
    if (!parsed.success) return badRequestFromZod(parsed.error);

    const user = await getUserContext(event);
    if (!user) return unauthorized();
    if (!isUserAccountActive(user)) return unauthorized(ACCOUNT_INACTIVE_MESSAGE);
    await service.addTrustedPartner(agencyId, parsed.data.partnerAgencyId, user);
    return ok({ ok: true }, 201);
  } catch (error) {
    if (error instanceof Error && error.message === "FORBIDDEN") return forbidden();
    if (error instanceof Error && error.message === "FEATURE_DISABLED")
      return notFound("Sharing disabled");
    return serverError();
  }
};
