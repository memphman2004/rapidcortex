import type { APIGatewayProxyHandler } from "aws-lambda";

import { respond } from "../http-response.js";
import { SurgeDetectionService } from "../../services/surge-detection-service.js";

const surgeService = new SurgeDetectionService();

export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    const agencyId = event.queryStringParameters?.agencyId;

    if (!agencyId) {
      return respond(
        400,
        {
          success: false,
          error: "Agency ID is required",
        },
        false,
      );
    }

    const clusters = await surgeService.getActiveClusters(agencyId);

    return respond(
      200,
      {
        success: true,
        data: clusters,
      },
      true,
    );
  } catch (error) {
    console.error("Error getting clusters:", error);

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
