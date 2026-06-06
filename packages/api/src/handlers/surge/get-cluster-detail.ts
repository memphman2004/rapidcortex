import type { APIGatewayProxyHandler } from "aws-lambda";

import { respond } from "../http-response.js";
import { SurgeDetectionService } from "../../services/surge-detection-service.js";

const surgeService = new SurgeDetectionService();

export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    const clusterId = event.pathParameters?.clusterId;

    if (!clusterId) {
      return respond(
        400,
        {
          success: false,
          error: "Cluster ID is required",
        },
        false,
      );
    }

    const cluster = await surgeService.getClusterDetail(clusterId);

    if (!cluster) {
      return respond(
        404,
        {
          success: false,
          error: "Cluster not found",
        },
        false,
      );
    }

    const uniqueDetails = await surgeService.extractUniqueDetails(clusterId);

    return respond(
      200,
      {
        success: true,
        data: {
          ...cluster,
          uniqueDetails,
        },
      },
      true,
    );
  } catch (error) {
    console.error("Error getting cluster detail:", error);

    return respond(
      500,
      {
        success: false,
        error: "Internal server error",
      },
      false,
    );
  }
};
