import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { AuthorizationService } from "rapid-cortex-security";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../../lib/auth.js";
import {
  forbidden,
  notFound,
  ok,
  serverError,
  serviceUnavailable,
  unauthorized,
} from "../../lib/response.js";
import { MediaService } from "../../services/mediaService.js";

const service = new MediaService();
const authz = new AuthorizationService();

function mapErr(e: unknown) {
  const msg = e instanceof Error ? e.message : String(e);
  const statusCode = (e as Error & { statusCode?: number }).statusCode;
  if (msg === "FORBIDDEN_PERMISSION" && statusCode === 403) return forbidden();
  if (msg === "NOT_FOUND") return notFound();
  if (msg === "FORBIDDEN" || msg === "TENANT_MISMATCH") return forbidden();
  if (msg === "INCIDENT_MEDIA_DISABLED" || msg === "INCIDENT_MEDIA_TABLE_NOT_CONFIGURED") {
    return serviceUnavailable("Incident media is not enabled for this deployment");
  }
  return serverError();
}

export async function listMediaHandler(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> {
  try {
    const user = await getUserContext(event);
    if (!user) return unauthorized();
    if (!isUserAccountActive(user)) return unauthorized(ACCOUNT_INACTIVE_MESSAGE);
    authz.assertCanPerform(user, "workspace.caller_media");
    if (!authz.canDispatch(user)) return forbidden();

    const incidentId = event.pathParameters?.incidentId ?? event.pathParameters?.id;
    if (!incidentId) return notFound();

    const out = await service.listForIncident(incidentId, user);
    return ok(out);
  } catch (e) {
    return mapErr(e);
  }
}
