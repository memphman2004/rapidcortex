import type { APIGatewayProxyHandler } from "aws-lambda";
import { z } from "zod";

import { respond } from "../http-response.js";
import { SurgeDetectionService } from "../../services/surge-detection-service.js";

const RequestSchema = z.object({
  callId: z.string().min(1),
  incidentId: z.string().min(1),
  agencyId: z.string().min(1),
  transcript: z.string().min(1),
  callType: z.enum(["medical", "fire", "police", "traffic", "other"]),
  timestamp: z.string().datetime(),
  location: z
    .object({
      lat: z.number(),
      lon: z.number(),
      accuracy: z.number(),
    })
    .optional(),
  caller: z.object({
    phoneNumber: z.string(),
    language: z.string(),
  }),
});

const surgeService = new SurgeDetectionService();

export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    const body = JSON.parse(event.body || "{}");
    const call = RequestSchema.parse(body);

    const assignment = await surgeService.analyzeCall(call);

    return respond(
      200,
      {
        success: true,
        data: assignment,
      },
      true,
    );
  } catch (error) {
    console.error("Error analyzing call:", error);

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
