import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import {
  acknowledgeHospitalPreAlertBodySchema,
  createHospitalPreAlertBodySchema,
  updateHospitalPreAlertBodySchema,
  upsertHospitalProfileBodySchema,
} from "rapid-cortex-shared";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../lib/auth.js";
import {
  badRequest,
  badRequestFromZod,
  forbidden,
  notFound,
  ok,
  serverError,
  serviceUnavailable,
  unauthorized,
} from "../lib/response.js";
import { HospitalAlertService } from "../services/hospitalAlertService.js";
import { requireAddon } from "../middleware/requireAddon.js";

const service = new HospitalAlertService();
const requireHospitalAddon = requireAddon("hospital.routing or hospital.");

function mapErr(e: unknown) {
  const msg = e instanceof Error ? e.message : String(e);
  if (msg.startsWith("VALIDATION:")) return badRequest(msg.slice("VALIDATION:".length));
  if (msg === "NOT_FOUND") return notFound();
  if (msg === "FORBIDDEN" || msg === "TENANT_MISMATCH") return forbidden();
  if (
    msg === "EMERGENCY_CONNECT_DISABLED" ||
    msg === "HOSPITAL_PREALERTS_TABLE_NOT_CONFIGURED" ||
    msg === "HOSPITAL_PROFILES_TABLE_NOT_CONFIGURED"
  ) {
    return serviceUnavailable("Emergency Connect is not enabled");
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

    await service.ensureDemoHospitals(user);

    const routeKey = event.routeKey ?? "";
    const method = event.requestContext.http?.method ?? "";
    const alertId = event.pathParameters?.alertId;
    const hospitalId = event.pathParameters?.hospitalId;
    const incidentId = event.queryStringParameters?.incidentId?.trim();

    if (routeKey === "GET /api/hospitals/prealerts" || (event.rawPath === "/api/hospitals/prealerts" && method === "GET")) {
      const items = await service.listPreAlerts(user, incidentId);
      return ok({ items });
    }

    if (routeKey === "POST /api/hospitals/prealerts" || (event.rawPath === "/api/hospitals/prealerts" && method === "POST")) {
      const parsed = createHospitalPreAlertBodySchema.safeParse(JSON.parse(event.body ?? "{}"));
      if (!parsed.success) return badRequestFromZod(parsed.error);
      const created = await service.createPreAlert(user, parsed.data);
      return ok(created, 201);
    }

    if (alertId) {
      if (routeKey === "GET /api/hospitals/prealerts/{alertId}" || method === "GET") {
        const alert = await service.getPreAlert(user, alertId);
        return ok(alert);
      }

      if (routeKey === "PATCH /api/hospitals/prealerts/{alertId}" || method === "PATCH") {
        const parsed = updateHospitalPreAlertBodySchema.safeParse(JSON.parse(event.body ?? "{}"));
        if (!parsed.success) return badRequestFromZod(parsed.error);
        const updated = await service.updatePreAlert(user, alertId, parsed.data);
        return ok(updated);
      }

      if (routeKey.endsWith("/send") || event.rawPath?.endsWith("/send")) {
        const result = await service.sendPreAlert(user, alertId);
        return ok({ success: true, alertId, sentAt: result.sentAt, status: "SENT", method: result.method });
      }

      if (routeKey.endsWith("/acknowledge") || event.rawPath?.endsWith("/acknowledge")) {
        const parsed = acknowledgeHospitalPreAlertBodySchema.safeParse(JSON.parse(event.body ?? "{}"));
        if (!parsed.success) return badRequestFromZod(parsed.error);
        const updated = await service.acknowledgePreAlert(user, alertId, parsed.data);
        return ok(updated);
      }

      if (routeKey.endsWith("/cancel") || event.rawPath?.endsWith("/cancel")) {
        const updated = await service.cancelPreAlert(user, alertId);
        return ok(updated);
      }
    }

    if (routeKey === "GET /api/hospitals" || (event.rawPath === "/api/hospitals" && method === "GET")) {
      const items = await service.listHospitals(user);
      return ok({ items });
    }

    if (routeKey === "POST /api/hospitals" || (event.rawPath === "/api/hospitals" && method === "POST")) {
      const parsed = upsertHospitalProfileBodySchema.safeParse(JSON.parse(event.body ?? "{}"));
      if (!parsed.success) return badRequestFromZod(parsed.error);
      const profile = await service.upsertHospital(user, undefined, parsed.data);
      return ok(profile, 201);
    }

    if (hospitalId) {
      if (method === "GET") {
        const profile = await service.getHospital(user, hospitalId);
        return ok(profile);
      }
      if (method === "PATCH") {
        const parsed = upsertHospitalProfileBodySchema.safeParse(JSON.parse(event.body ?? "{}"));
        if (!parsed.success) return badRequestFromZod(parsed.error);
        const profile = await service.upsertHospital(user, hospitalId, parsed.data);
        return ok(profile);
      }
    }

    return notFound();
  } catch (e) {
    return mapErr(e);
  }
};
