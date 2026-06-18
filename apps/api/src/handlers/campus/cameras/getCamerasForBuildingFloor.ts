import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { campusCamerasQuerySchema } from "rapid-cortex-shared";
import { withCorrelationHeaders } from "../../../lib/correlation.js";
import { badRequest, ok, serverError } from "../../../lib/response.js";
import { requireAgencyRoute } from "../../vertical/agency-route-context.js";
import {
  getCamerasForBuildingFloor,
  listCampusCameras,
} from "./campus-camera-registry-service.js";

/** GET /api/campus/{agencyId}/cameras?building=&floor=&limit=2 */
export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const ctx = await requireAgencyRoute(event, "campus.dashboard.view");
    if ("response" in ctx) return ctx.response;

    const parsed = campusCamerasQuerySchema.safeParse(event.queryStringParameters ?? {});
    if (!parsed.success) {
      return withCorrelationHeaders(event, badRequest("Invalid query parameters"));
    }

    const { building, floor, limit = 2 } = parsed.data;
    const cameras = building
      ? await getCamerasForBuildingFloor(ctx.agencyId, building, floor, limit)
      : (await listCampusCameras(ctx.agencyId)).map((c) => ({
          cameraId: c.cameraId,
          displayName: c.displayName,
          kvsChannelName: c.kvsChannelName,
          vendor: c.vendor,
          ptzCapable: c.ptzCapable,
          status: c.status,
          buildingId: c.buildingId,
          floor: c.floor,
        }));

    return withCorrelationHeaders(event, ok({ cameras }));
  } catch (error) {
    console.error("[getCamerasForBuildingFloor]", error);
    return withCorrelationHeaders(event, serverError());
  }
};
