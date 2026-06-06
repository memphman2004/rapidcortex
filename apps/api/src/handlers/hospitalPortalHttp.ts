import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import {
  manualCapacityUpdateBodySchema,
  registerHospitalUserBodySchema,
} from "rapid-cortex-shared";
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
import { HospitalPortalService } from "../services/hospitalPortalService.js";
import { requireAddon } from "../middleware/requireAddon.js";

const service = new HospitalPortalService();
const requireHospitalAddon = requireAddon("hospital.routing or hospital.");

function mapErr(e: unknown) {
  const msg = e instanceof Error ? e.message : String(e);
  if (msg === "NOT_FOUND") return notFound();
  if (
    msg === "FORBIDDEN" ||
    msg === "TENANT_MISMATCH" ||
    msg === "HOSPITAL_NOT_ASSIGNED" ||
    msg === "HOSPITAL_ID_REQUIRED"
  ) {
    return forbidden();
  }
  if (
    msg === "HOSPITAL_ROUTING_DISABLED" ||
    msg === "HOSPITAL_CAPACITY_TABLE_NOT_CONFIGURED" ||
    msg === "HOSPITAL_PROFILES_TABLE_NOT_CONFIGURED"
  ) {
    return serviceUnavailable("Hospital portal is not enabled");
  }
  return serverError();
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const user = await getUserContext(event);
    if (!user) return unauthorized();
    if (!isUserAccountActive(user)) return unauthorized(ACCOUNT_INACTIVE_MESSAGE);
    const addonGate = await requireHospitalAddon(event, user);
    if (addonGate) return addonGate;

    const method = event.requestContext.http?.method ?? "";
    const routeKey = event.routeKey ?? "";
    const qs = event.queryStringParameters ?? {};

    if (
      routeKey === "GET /api/hospital-portal/context" ||
      event.rawPath === "/api/hospital-portal/context"
    ) {
      const context = await service.getPortalContext(user, qs.hospitalId);
      return ok(context);
    }

    if (
      routeKey === "POST /api/hospital-portal/capacity" ||
      (event.rawPath === "/api/hospital-portal/capacity" && method === "POST")
    ) {
      const parsed = manualCapacityUpdateBodySchema.safeParse(JSON.parse(event.body ?? "{}"));
      if (!parsed.success) return badRequestFromZod(parsed.error);
      const capacity = await service.manualUpdateCapacity(user, parsed.data, qs.hospitalId);
      return ok(capacity);
    }

    if (
      routeKey === "GET /api/hospital-portal/capacity/history" ||
      event.rawPath === "/api/hospital-portal/capacity/history"
    ) {
      const limit = Math.min(50, Math.max(1, Number.parseInt(qs.limit ?? "10", 10) || 10));
      const items = await service.listCapacityHistory(user, limit, qs.hospitalId);
      return ok({ items });
    }

    if (
      routeKey === "POST /api/hospital-portal/users" ||
      (event.rawPath === "/api/hospital-portal/users" && method === "POST")
    ) {
      const parsed = registerHospitalUserBodySchema.safeParse(JSON.parse(event.body ?? "{}"));
      if (!parsed.success) return badRequestFromZod(parsed.error);
      const result = await service.registerHospitalUser(user, parsed.data);
      return ok(result);
    }

    return notFound();
  } catch (e) {
    console.error("hospitalPortalHttp", e);
    return mapErr(e);
  }
};
