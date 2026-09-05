import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { ZodError } from "zod";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../lib/auth.js";
import { withCorrelationHeaders } from "../lib/correlation.js";
import { env } from "../lib/env.js";
import { operationalPasswordBlock } from "../lib/operationalPasswordGate.js";
import {
  badRequest,
  badRequestFromZod,
  forbidden,
  notFound,
  ok,
  serverError,
  unauthorized,
} from "../lib/response.js";
import {
  issueOnboardingPacketDownload,
  listOnboardingPackets,
} from "../onboarding/onboarding-packets-service.js";

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    if (!env.enableVerticalOnboarding) {
      return withCorrelationHeaders(event, notFound());
    }
    const user = await getUserContext(event);
    if (!user) return withCorrelationHeaders(event, unauthorized());
    if (!isUserAccountActive(user)) {
      return withCorrelationHeaders(event, unauthorized(ACCOUNT_INACTIVE_MESSAGE));
    }
    const pwd = operationalPasswordBlock(user);
    if (pwd) return withCorrelationHeaders(event, pwd);

    const method = event.requestContext.http.method.toUpperCase();
    if (method === "GET") {
      const body = await listOnboardingPackets(user);
      return withCorrelationHeaders(event, ok(body));
    }
    if (method === "POST") {
      let raw: unknown = {};
      try {
        raw = event.body?.trim() ? JSON.parse(event.body) : {};
      } catch {
        return withCorrelationHeaders(event, badRequest("Invalid JSON body"));
      }
      const issued = await issueOnboardingPacketDownload(user, raw);
      return withCorrelationHeaders(event, ok(issued));
    }
    return withCorrelationHeaders(event, badRequest("Method not allowed"));
  } catch (error) {
    if (error instanceof ZodError) {
      return withCorrelationHeaders(event, badRequestFromZod(error));
    }
    if (error instanceof Error && error.message === "FORBIDDEN_PERMISSION") {
      return withCorrelationHeaders(event, forbidden());
    }
    const code = (error as Error & { code?: string }).code;
    if (code === "FORBIDDEN_VERTICAL") return withCorrelationHeaders(event, forbidden());
    if (code === "INVALID_KEY") return withCorrelationHeaders(event, badRequest("Invalid packet key"));
    if (code === "NOT_FOUND") return withCorrelationHeaders(event, notFound("Packet file not found"));
    console.error("[onboarding-packets]", error);
    return withCorrelationHeaders(event, serverError());
  }
};
