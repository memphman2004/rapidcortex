import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { AuthorizationService } from "rapid-cortex-security";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../lib/auth.js";
import { operationalPasswordBlock } from "../lib/operationalPasswordGate.js";
import { badRequestFromZod, forbidden, ok, serverError, unauthorized } from "../lib/response.js";
import { IncidentService } from "../services/incidentService.js";
import { createIncidentSchema } from "rapid-cortex-shared";

const service = new IncidentService();
const authz = new AuthorizationService();

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const user = await getUserContext(event);
    if (!user) return unauthorized();
    if (!isUserAccountActive(user)) return unauthorized(ACCOUNT_INACTIVE_MESSAGE);
    const pwd = operationalPasswordBlock(user);
    if (pwd) return pwd;
    // INTENTIONAL: Role Access Matrix v2.0 has no specific "create incident"
    // permission — incident creation is a core operational action defined by
    // role capability (canDispatch) with auditor explicitly excluded as read-only.
    if (!authz.canDispatch(user) || user.role === "auditor") {
      return forbidden("Role cannot create incidents");
    }

    const parsed = createIncidentSchema.safeParse(JSON.parse(event.body ?? "{}"));
    if (!parsed.success) return badRequestFromZod(parsed.error);

    const incident = await service.create(parsed.data.title, parsed.data.source, user, {
      callerAddressLine: parsed.data.callerAddressLine,
    });

    return ok(incident, 201);
  } catch {
    return serverError();
  }
};
