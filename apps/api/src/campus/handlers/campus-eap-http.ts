import type { APIGatewayProxyHandlerV2, APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import { AuthorizationService } from "rapid-cortex-security";
import {
  campusAutomationRuleUpsertBodySchema,
  campusEapListQuerySchema,
  campusEapMatchQuerySchema,
  campusEapUpsertBodySchema,
} from "rapid-cortex-shared";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../../lib/auth.js";
import { withCorrelationHeaders } from "../../lib/correlation.js";
import { env } from "../../lib/env.js";
import { operationalPasswordBlock } from "../../lib/operationalPasswordGate.js";
import {
  badRequest,
  badRequestFromZod,
  forbidden,
  notFound,
  ok,
  serverError,
  unauthorized,
} from "../../lib/response.js";
import { canAccessCampusTenant } from "../campus-access.js";
import {
  deleteCampusEap,
  listCampusAutomationRules,
  listCampusEaps,
  matchCampusEapForIncident,
  putCampusAutomationRules,
  upsertCampusEap,
} from "../campus-eap-service.js";

const authz = new AuthorizationService();

function pathOf(event: Parameters<APIGatewayProxyHandlerV2>[0]): string {
  return event.rawPath ?? event.requestContext?.http?.path ?? "";
}

function methodOf(event: Parameters<APIGatewayProxyHandlerV2>[0]): string {
  return (event.requestContext?.http?.method ?? "GET").toUpperCase();
}

function parseJson(body: string | undefined): unknown {
  try {
    return JSON.parse(body ?? "{}");
  } catch {
    throw new Error("INVALID_JSON");
  }
}

function featureOff(): APIGatewayProxyStructuredResultV2 {
  return {
    statusCode: 503,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ error: "Campus EAP feature is disabled" }),
  };
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    if (!env.enableCampusEap) {
      return withCorrelationHeaders(event, featureOff());
    }

    const user = await getUserContext(event);
    if (!user) return withCorrelationHeaders(event, unauthorized());
    if (!isUserAccountActive(user)) {
      return withCorrelationHeaders(event, unauthorized(ACCOUNT_INACTIVE_MESSAGE));
    }
    const pwd = operationalPasswordBlock(user);
    if (pwd) return withCorrelationHeaders(event, pwd);

    const path = pathOf(event);
    const method = methodOf(event);
    const agencyId = user.agencyId ?? "";
    if (!agencyId) return withCorrelationHeaders(event, forbidden("agencyId required"));

    if (method === "GET" && path.endsWith("/eap/match")) {
      authz.assertCanPerform(user, "campus.eap.view" as never);
      const parsed = campusEapMatchQuerySchema.safeParse(event.queryStringParameters ?? {});
      if (!parsed.success) return withCorrelationHeaders(event, badRequestFromZod(parsed.error));
      if (!canAccessCampusTenant(user, parsed.data.campusCode)) {
        return withCorrelationHeaders(event, forbidden("Campus code mismatch"));
      }
      const checklist = await matchCampusEapForIncident(
        parsed.data.campusCode,
        parsed.data.buildingCode,
        parsed.data.type,
      );
      return withCorrelationHeaders(event, ok({ checklist }));
    }

    if (method === "GET" && path.endsWith("/automation-rules")) {
      authz.assertCanPerform(user, "campus.eap.view" as never);
      const campusCode = event.queryStringParameters?.campusCode;
      if (!campusCode) return withCorrelationHeaders(event, badRequest("campusCode is required"));
      if (!canAccessCampusTenant(user, campusCode)) {
        return withCorrelationHeaders(event, forbidden("Campus code mismatch"));
      }
      const rules = await listCampusAutomationRules(campusCode);
      return withCorrelationHeaders(event, ok({ rules }));
    }

    if (method === "PUT" && path.endsWith("/automation-rules")) {
      authz.assertCanPerform(user, "campus.eap.manage" as never);
      const parsed = campusAutomationRuleUpsertBodySchema.safeParse(parseJson(event.body));
      if (!parsed.success) return withCorrelationHeaders(event, badRequestFromZod(parsed.error));
      if (!canAccessCampusTenant(user, parsed.data.campusCode)) {
        return withCorrelationHeaders(event, forbidden("Campus code mismatch"));
      }
      const rules = await putCampusAutomationRules(agencyId, user.userId, parsed.data);
      return withCorrelationHeaders(event, ok({ rules }));
    }

    if (method === "GET" && path.endsWith("/eap")) {
      authz.assertCanPerform(user, "campus.eap.view" as never);
      const parsed = campusEapListQuerySchema.safeParse(event.queryStringParameters ?? {});
      if (!parsed.success) return withCorrelationHeaders(event, badRequestFromZod(parsed.error));
      if (!canAccessCampusTenant(user, parsed.data.campusCode)) {
        return withCorrelationHeaders(event, forbidden("Campus code mismatch"));
      }
      const eaps = await listCampusEaps(parsed.data.campusCode);
      return withCorrelationHeaders(event, ok({ eaps }));
    }

    if (method === "POST" && path.endsWith("/eap")) {
      authz.assertCanPerform(user, "campus.eap.manage" as never);
      const parsed = campusEapUpsertBodySchema.safeParse(parseJson(event.body));
      if (!parsed.success) return withCorrelationHeaders(event, badRequestFromZod(parsed.error));
      if (!canAccessCampusTenant(user, parsed.data.campusCode)) {
        return withCorrelationHeaders(event, forbidden("Campus code mismatch"));
      }
      const eap = await upsertCampusEap(agencyId, user.userId, parsed.data);
      return withCorrelationHeaders(event, ok({ eap }, 201));
    }

    const eapIdMatch = /\/eap\/([^/]+)$/.exec(path);
    if (eapIdMatch && (method === "PATCH" || method === "DELETE")) {
      authz.assertCanPerform(user, "campus.eap.manage" as never);
      const eapId = decodeURIComponent(eapIdMatch[1] ?? "");
      const campusCode =
        event.queryStringParameters?.campusCode ||
        (method === "PATCH"
          ? (parseJson(event.body) as { campusCode?: string }).campusCode
          : undefined);
      if (!campusCode) return withCorrelationHeaders(event, badRequest("campusCode is required"));
      if (!canAccessCampusTenant(user, campusCode)) {
        return withCorrelationHeaders(event, forbidden("Campus code mismatch"));
      }
      if (method === "DELETE") {
        await deleteCampusEap(campusCode, eapId, agencyId, user.userId);
        return withCorrelationHeaders(event, ok({ deleted: true }));
      }
      const rawBody = parseJson(event.body);
      const parsed = campusEapUpsertBodySchema.safeParse({
        ...(typeof rawBody === "object" && rawBody !== null ? rawBody : {}),
        eapId,
        campusCode,
      });
      if (!parsed.success) return withCorrelationHeaders(event, badRequestFromZod(parsed.error));
      const eap = await upsertCampusEap(agencyId, user.userId, parsed.data);
      return withCorrelationHeaders(event, ok({ eap }));
    }

    return withCorrelationHeaders(event, notFound());
  } catch (error) {
    if (error instanceof Error && error.message === "INVALID_JSON") {
      return withCorrelationHeaders(event, badRequest("Invalid JSON"));
    }
    if (error instanceof Error && error.message === "FORBIDDEN_PERMISSION") {
      return withCorrelationHeaders(event, forbidden());
    }
    if (error instanceof Error && error.message === "NOT_FOUND") {
      return withCorrelationHeaders(event, notFound());
    }
    console.error("[campus-eap]", error);
    return withCorrelationHeaders(event, serverError());
  }
};
