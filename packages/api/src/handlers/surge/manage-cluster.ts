import type { APIGatewayProxyHandler } from "aws-lambda";
import { z } from "zod";

import { respond } from "../http-response.js";
import { SurgeDetectionService } from "../../services/surge-detection-service.js";

const ActionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("confirm"),
    note: z.string().optional(),
  }),
  z.object({
    type: z.literal("split"),
    callIds: z.array(z.string()).min(1),
  }),
  z.object({
    type: z.literal("dismiss"),
    reason: z.string().min(1),
  }),
]);

const RequestSchema = z.object({
  action: ActionSchema,
  userId: z.string().min(1),
});

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

    const body = JSON.parse(event.body || "{}");
    const validated = RequestSchema.parse(body);

    await surgeService.manageCluster(clusterId, validated.action, validated.userId);

    return respond(
      200,
      {
        success: true,
      },
      true,
    );
  } catch (error) {
    console.error("Error managing cluster:", error);

    if (error instanceof z.ZodError) {
      return respond(
        400,
        {
          success: false,
          error: "Validation error",
          details: error.issues,
        },
        false,
      );
    }

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
