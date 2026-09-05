import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { ZodError } from "zod";
import { withCorrelationHeaders } from "../../lib/correlation.js";
import { badRequest, badRequestFromZod, forbidden, ok, serverError } from "../../lib/response.js";
import {
  getCampusIntegrationQuestionnaire,
  saveCampusIntegrationQuestionnaire,
} from "../../onboarding/campus-onboarding-service.js";
import { requireCampusRouteContext } from "./campus-route-context.js";

export const getHandler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const ctx = await requireCampusRouteContext(event, "view");
    if ("response" in ctx) return ctx.response;

    const questionnaire = await getCampusIntegrationQuestionnaire(ctx.campusCode);
    return withCorrelationHeaders(event, ok({ questionnaire }));
  } catch (error) {
    console.error("[campus-onboarding-integrations-get]", error);
    return withCorrelationHeaders(event, serverError());
  }
};

export const putHandler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const ctx = await requireCampusRouteContext(event, "manage");
    if ("response" in ctx) return ctx.response;

    let body: unknown;
    try {
      body = event.body ? JSON.parse(event.body) : {};
    } catch {
      return withCorrelationHeaders(event, badRequest("Invalid JSON body"));
    }

    try {
      const questionnaire = await saveCampusIntegrationQuestionnaire({
        campusCode: ctx.campusCode,
        agencyId: ctx.agencyId,
        actorId: ctx.user.userId,
        body,
      });
      return withCorrelationHeaders(event, ok({ questionnaire }));
    } catch (error) {
      if (error instanceof ZodError) {
        return withCorrelationHeaders(event, badRequestFromZod(error));
      }
      if (error instanceof Error && error.message === "FORBIDDEN_TENANT") {
        return withCorrelationHeaders(event, forbidden());
      }
      throw error;
    }
  } catch (error) {
    console.error("[campus-onboarding-integrations-put]", error);
    return withCorrelationHeaders(event, serverError());
  }
};
