import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { venueCamerasQuerySchema } from "rapid-cortex-shared";
import { withCorrelationHeaders } from "../../lib/correlation.js";
import { badRequest, ok, serverError } from "../../lib/response.js";
import { requireAgencyRoute } from "../vertical/agency-route-context.js";
import { getCamerasForSection, listVenueCameras } from "./venue-camera-registry-service.js";

/** GET /api/venue/{agencyId}/cameras?section={sectionId}&limit=2 */
export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const ctx = await requireAgencyRoute(event, "venue.dashboard.view");
    if ("response" in ctx) return ctx.response;

    const parsed = venueCamerasQuerySchema.safeParse(event.queryStringParameters ?? {});
    if (!parsed.success) {
      return withCorrelationHeaders(event, badRequest("Invalid query parameters"));
    }

    const { section, limit = 2 } = parsed.data;
    const cameras = section
      ? await getCamerasForSection(ctx.agencyId, section, limit)
      : (await listVenueCameras(ctx.agencyId)).map((c) => ({
          cameraId: c.cameraId,
          displayName: c.displayName,
          kvsChannelName: c.kvsChannelName,
          vendor: c.vendor,
          ptzCapable: c.ptzCapable,
          status: c.status,
        }));

    return withCorrelationHeaders(event, ok({ cameras }));
  } catch (error) {
    console.error("[getCamerasForSection]", error);
    return withCorrelationHeaders(event, serverError());
  }
};
