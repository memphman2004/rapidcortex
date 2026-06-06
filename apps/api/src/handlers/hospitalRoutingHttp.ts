import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import {
  createMciPlanBodySchema,
  hospitalAnalyticsQuerySchema,
  hospitalLeaderboardQuerySchema,
  hospitalRecommendationsBodySchema,
  updateHospitalCapacityBodySchema,
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
import { HospitalAnalyticsService } from "../services/hospitalAnalyticsService.js";
import { HospitalRoutingService } from "../services/hospitalRoutingService.js";
import { MciCoordinationService } from "../services/mciCoordinationService.js";
import { requireAddon } from "../middleware/requireAddon.js";

const service = new HospitalRoutingService();
const mciService = new MciCoordinationService();
const analyticsService = new HospitalAnalyticsService();
const requireHospitalAddon = requireAddon("hospital.routing or hospital.");
const requireHospitalMciAddon = requireAddon("hospital.mci_routing");

function mapErr(e: unknown) {
  const msg = e instanceof Error ? e.message : String(e);
  if (msg === "NOT_FOUND") return notFound();
  if (msg === "FORBIDDEN" || msg === "TENANT_MISMATCH") return forbidden();
  if (
    msg === "HOSPITAL_ROUTING_DISABLED" ||
    msg === "HOSPITAL_CAPACITY_TABLE_NOT_CONFIGURED" ||
    msg === "HOSPITAL_PROFILES_TABLE_NOT_CONFIGURED"
  ) {
    return serviceUnavailable("Hospital routing is not enabled");
  }
  return serverError();
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const user = await getUserContext(event);
    if (!user) return unauthorized();
    if (!isUserAccountActive(user)) return unauthorized(ACCOUNT_INACTIVE_MESSAGE);

    const routeKey = event.routeKey ?? "";
    const method = event.requestContext.http?.method ?? "";
    const hospitalId = event.pathParameters?.hospitalId;
    const isMciPath = (event.rawPath ?? "").includes("/api/hospitals/mci/");
    const addonGate = isMciPath
      ? await requireHospitalMciAddon(event, user)
      : await requireHospitalAddon(event, user);
    if (addonGate) return addonGate;

    if (
      routeKey === "GET /api/hospitals/capacity" ||
      (event.rawPath === "/api/hospitals/capacity" && method === "GET")
    ) {
      const items = await service.listCapacity(user);
      return ok({ items });
    }

    if (
      routeKey === "POST /api/hospitals/recommendations" ||
      (event.rawPath === "/api/hospitals/recommendations" && method === "POST")
    ) {
      const parsed = hospitalRecommendationsBodySchema.safeParse(JSON.parse(event.body ?? "{}"));
      if (!parsed.success) return badRequestFromZod(parsed.error);
      const items = await service.getRecommendations(
        user,
        parsed.data.latitude,
        parsed.data.longitude,
        parsed.data.patientNeeds,
      );
      return ok({ items });
    }

    if (hospitalId && event.rawPath?.includes("/capacity")) {
      if (method === "GET") {
        const capacity = await service.getCapacity(user, hospitalId);
        return ok(capacity);
      }
      if (method === "PUT" || method === "PATCH") {
        const parsed = updateHospitalCapacityBodySchema.safeParse(JSON.parse(event.body ?? "{}"));
        if (!parsed.success) return badRequestFromZod(parsed.error);
        const updated = await service.updateCapacity(user, hospitalId, parsed.data);
        return ok(updated);
      }
    }

    if (
      routeKey === "POST /api/hospitals/mci/distribution" ||
      (event.rawPath === "/api/hospitals/mci/distribution" && method === "POST")
    ) {
      const parsed = createMciPlanBodySchema.safeParse(JSON.parse(event.body ?? "{}"));
      if (!parsed.success) return badRequestFromZod(parsed.error);
      const plan = await mciService.createDistributionPlan(user, parsed.data);
      return ok(plan);
    }

    const incidentId = event.pathParameters?.incidentId;
    if (incidentId && event.rawPath?.includes("/mci/")) {
      if (
        routeKey === "GET /api/hospitals/mci/{incidentId}" ||
        (method === "GET" && !event.rawPath.includes("/status") && !event.rawPath.includes("/activate"))
      ) {
        const plan = await mciService.getPlan(user, incidentId);
        if (!plan) return notFound();
        return ok(plan);
      }
      if (
        routeKey === "POST /api/hospitals/mci/{incidentId}/activate" ||
        (event.rawPath?.includes("/activate") && method === "POST")
      ) {
        const plan = await mciService.activatePlan(user, incidentId);
        return ok(plan);
      }
      if (
        routeKey === "GET /api/hospitals/mci/{incidentId}/status" ||
        (event.rawPath?.includes("/status") && method === "GET")
      ) {
        const status = await mciService.getMciStatus(user, incidentId);
        return ok(status);
      }
    }

    if (hospitalId && event.rawPath?.includes("/analytics")) {
      const qs = event.queryStringParameters ?? {};
      if (event.rawPath?.includes("/leaderboard")) {
        const parsed = hospitalLeaderboardQuerySchema.safeParse(qs);
        if (!parsed.success) return badRequestFromZod(parsed.error);
        const items = await analyticsService.getPerformanceLeaderboard(user, parsed.data.days);
        return ok({ items });
      }
      const parsed = hospitalAnalyticsQuerySchema.safeParse({ ...qs, hospitalId });
      if (!parsed.success) return badRequestFromZod(parsed.error);
      if (method === "GET" && event.rawPath?.includes("/performance")) {
        const score = await analyticsService.calculatePerformanceScore(
          user,
          hospitalId,
          parsed.data.days,
        );
        return ok(score);
      }
      if (method === "GET") {
        const items = await analyticsService.getDailyMetrics(user, hospitalId, parsed.data.days);
        return ok({ items });
      }
      if (method === "POST" && qs.date) {
        const metrics = await analyticsService.aggregateDailyMetrics(user, hospitalId, qs.date);
        if (!metrics) return notFound();
        return ok(metrics);
      }
    }

    if (
      routeKey === "GET /api/hospitals/analytics/leaderboard" ||
      event.rawPath === "/api/hospitals/analytics/leaderboard"
    ) {
      const parsed = hospitalLeaderboardQuerySchema.safeParse(event.queryStringParameters ?? {});
      if (!parsed.success) return badRequestFromZod(parsed.error);
      const items = await analyticsService.getPerformanceLeaderboard(user, parsed.data.days);
      return ok({ items });
    }

    return notFound();
  } catch (e) {
    console.error("hospitalRoutingHttp", e);
    return mapErr(e);
  }
};
