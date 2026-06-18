import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { withCorrelationHeaders } from "../../lib/correlation.js";
import { badRequest, forbidden, ok, serverError } from "../../lib/response.js";
import {
  getCampusOnboardingChecklist,
  patchCampusOnboardingChecklist,
} from "../../onboarding/campus-onboarding-service.js";
import { requireCampusRouteContext } from "./campus-route-context.js";

export const getHandler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const ctx = await requireCampusRouteContext(event, "view");
    if ("response" in ctx) return ctx.response;

    const checklist = await getCampusOnboardingChecklist(ctx.campusCode);
    return withCorrelationHeaders(event, ok({ checklist }));
  } catch (error) {
    console.error("[campus-onboarding-checklist-get]", error);
    return withCorrelationHeaders(event, serverError());
  }
};

export const patchHandler: APIGatewayProxyHandlerV2 = async (event) => {
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
      const checklist = await patchCampusOnboardingChecklist({
        campusCode: ctx.campusCode,
        agencyId: ctx.agencyId,
        actorId: ctx.user.userId,
        body,
      });
      return withCorrelationHeaders(event, ok({ checklist }));
    } catch (error) {
      if (error instanceof Error && error.message === "FORBIDDEN_TENANT") {
        return withCorrelationHeaders(event, forbidden());
      }
      throw error;
    }
  } catch (error) {
    console.error("[campus-onboarding-checklist-patch]", error);
    return withCorrelationHeaders(event, serverError());
  }
};
