import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { z } from "zod";
import { makeId } from "../../lib/ids.js";
import { SalesLeadRepository } from "../../repositories/salesLeadRepository.js";
import { ringJson } from "./ring-api-response.js";
import { consumeRingPublicOAuthRateSlot } from "./ring-consent-rate-limit.js";

const VALID_SOURCES = new Set(["ring-connect-waitlist"]);

const ringWaitlistLeadSchema = z
  .object({
    email: z.string().email().max(320),
    source: z.string().min(1).max(100),
    requestedState: z.string().max(2).toUpperCase().optional().nullable(),
    requestedCity: z.string().max(200).optional().nullable(),
  })
  .strict();

const repo = new SalesLeadRepository();

function clientIp(event: { requestContext?: { http?: { sourceIp?: string } } }): string {
  return event.requestContext?.http?.sourceIp?.trim() || "unknown";
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const allowed = await consumeRingPublicOAuthRateSlot(clientIp(event));
    if (!allowed) {
      return ringJson({ success: false, error: "Too many requests." }, 429);
    }

    let body: unknown;
    try {
      body = event.body ? JSON.parse(event.body) : {};
    } catch {
      return ringJson({ success: false, error: "Invalid JSON body." }, 400);
    }

    const parsed = ringWaitlistLeadSchema.safeParse(body);
    if (!parsed.success) {
      return ringJson({ success: false, error: "Invalid request body." }, 400);
    }

    const { email, source, requestedState, requestedCity } = parsed.data;

    if (!VALID_SOURCES.has(source)) {
      return ringJson({ success: false, error: "Invalid source." }, 400);
    }

    await repo.putRingWaitlistLead({
      leadId: makeId("lead"),
      email,
      source,
      requestedState: requestedState ?? null,
      requestedCity: requestedCity ?? null,
      createdAt: new Date().toISOString(),
    });

    return ringJson({ success: true }, 200);
  } catch (err) {
    console.error(
      JSON.stringify({
        msg: "ring_public_leads_error",
        error: err instanceof Error ? err.message : String(err),
      }),
    );
    return ringJson({ success: false, error: "Unable to record your request." }, 500);
  }
};
