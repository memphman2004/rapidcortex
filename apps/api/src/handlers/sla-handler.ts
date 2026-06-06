import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { AuthorizationService } from "rapid-cortex-security";
import { putSlaThresholdsBodySchema, slaHistoryQuerySchema } from "rapid-cortex-shared";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../lib/auth.js";
import {
  badRequestFromZod,
  forbidden,
  notFound,
  ok,
  serverError,
  serviceUnavailable,
  unauthorized,
} from "../lib/response.js";
import { SlaService } from "../services/slaService.js";
import { requireAddon } from "../middleware/requireAddon.js";

const service = new SlaService();
const auth = new AuthorizationService();
const requireReliabilityAddon = requireAddon("reliability.");

function mapErr(e: unknown) {
  const msg = e instanceof Error ? e.message : String(e);
  const statusCode = (e as Error & { statusCode?: number }).statusCode;
  if (msg === "FORBIDDEN_PERMISSION" && statusCode === 403) return forbidden();
  if (msg === "SLA_BACKLOG_DISABLED") return serviceUnavailable("SLA backlog tracking is not enabled");
  if (msg === "NOT_FOUND") return notFound();
  if (msg === "FORBIDDEN" || msg === "TENANT_MISMATCH") return forbidden();
  return serverError();
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const user = await getUserContext(event);
    if (!user) return unauthorized();
    if (!isUserAccountActive(user)) return unauthorized(ACCOUNT_INACTIVE_MESSAGE);
    const addonGate = await requireReliabilityAddon(event, user);
    if (addonGate) return addonGate;

    const routeKey = event.routeKey ?? "";

    if (routeKey === "GET /api/sla/status") {
      return ok(await service.getStatus(user));
    }

    if (routeKey === "GET /api/sla/thresholds") {
      auth.assertCanPerform(user, "reports.sla_config");
      return ok(await service.getThresholds(user));
    }

    if (routeKey === "PUT /api/sla/thresholds") {
      auth.assertCanPerform(user, "reports.sla_config");
      const parsed = putSlaThresholdsBodySchema.safeParse(JSON.parse(event.body ?? "{}"));
      if (!parsed.success) return badRequestFromZod(parsed.error);
      return ok(await service.putThresholds(user, parsed.data));
    }

    if (routeKey === "GET /api/sla/backlog") {
      return ok(await service.getBacklog(user));
    }

    if (routeKey === "GET /api/sla/history") {
      const q = slaHistoryQuerySchema.safeParse(event.queryStringParameters ?? {});
      if (!q.success) return badRequestFromZod(q.error);
      return ok(await service.getHistory(user, q.data.period));
    }

    return notFound();
  } catch (e) {
    return mapErr(e);
  }
};
