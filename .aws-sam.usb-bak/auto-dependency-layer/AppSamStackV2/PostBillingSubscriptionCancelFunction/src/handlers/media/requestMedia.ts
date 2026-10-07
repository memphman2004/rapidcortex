import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { AuthorizationService } from "rapid-cortex-security";
import { requestIncidentMediaBodySchema } from "rapid-cortex-shared";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../../lib/auth.js";
import {
  badRequest,
  forbidden,
  notFound,
  ok,
  serverError,
  serviceUnavailable,
  unauthorized,
  badRequestFromZod,
} from "../../lib/response.js";
import { MediaService } from "../../services/mediaService.js";

const service = new MediaService();
const authz = new AuthorizationService();

function mapErr(e: unknown) {
  const msg = e instanceof Error ? e.message : String(e);
  const statusCode = (e as Error & { statusCode?: number }).statusCode;
  if (msg === "FORBIDDEN_PERMISSION" && statusCode === 403) return forbidden();
  if (msg.startsWith("VALIDATION:")) return badRequest(msg.slice("VALIDATION:".length));
  if (msg === "NOT_FOUND") return notFound();
  if (msg === "FORBIDDEN" || msg === "TENANT_MISMATCH") return forbidden();
  if (msg === "FORBIDDEN_ROLE") return forbidden();
  if (msg === "INCIDENT_MEDIA_DISABLED" || msg === "INCIDENT_MEDIA_TABLE_NOT_CONFIGURED") {
    return serviceUnavailable("Incident media is not enabled for this deployment");
  }
  if (msg === "MISSING_PUBLIC_BASE_URL") {
    return badRequest(
      "Public base URL is not configured. Set INCIDENT_MEDIA_PUBLIC_BASE_URL or pass publicAppBaseUrl.",
    );
  }
  return serverError();
}

export async function requestMediaHandler(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> {
  try {
    const user = await getUserContext(event);
    if (!user) return unauthorized();
    if (!isUserAccountActive(user)) return unauthorized(ACCOUNT_INACTIVE_MESSAGE);
    authz.assertCanPerform(user, "workspace.caller_media");
    if (!authz.canDispatch(user) || user.role === "auditor") return forbidden();

    const incidentId = event.pathParameters?.id;
    if (!incidentId) return notFound();

    const raw = JSON.parse(event.body ?? "{}");
    const parsed = requestIncidentMediaBodySchema.safeParse(raw);
    if (!parsed.success) {
      return badRequestFromZod(parsed.error);
    }
    const out = await service.requestMedia(incidentId, user, parsed.data);
    return ok(out, 201);
  } catch (e) {
    return mapErr(e);
  }
}
