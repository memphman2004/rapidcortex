import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import {
  additionalDataAutoBuildBodySchema,
  additionalDataUpsertBodySchema,
  eidoImportBodySchema,
} from "rapid-cortex-shared";
import { AuthorizationService, isAgencyAdmin, isRcSuperAdmin } from "rapid-cortex-security";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../../lib/auth.js";
import { withCorrelationHeaders } from "../../lib/correlation.js";
import { env } from "../../lib/env.js";
import {
  badRequest,
  badRequestFromZod,
  forbidden,
  notFound,
  ok,
  serverError,
  serviceUnavailable,
  unauthorized,
} from "../../lib/response.js";
import {
  autoBuild,
  getAdditionalData,
  putAdditionalData,
} from "../../services/ng911/additionalDataService.js";
import { exportFromIncident, getStoredEido, importEido } from "../../services/ng911/eidoService.js";

const authz = new AuthorizationService();

function parseBody(raw: string | undefined): unknown {
  try {
    return JSON.parse(raw ?? "{}");
  } catch {
    return null;
  }
}

function mapError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (message === "NOT_FOUND") return notFound();
  if (message === "FORBIDDEN") return forbidden();
  console.error("[ng911.incidentAssist]", error);
  return serverError();
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    if (!env.enableNg911Assist || !env.ng911AssistTable) {
      return withCorrelationHeaders(
        event,
        serviceUnavailable("NG9-1-1 assist is not enabled for this deployment"),
      );
    }

    const user = await getUserContext(event);
    if (!user) return withCorrelationHeaders(event, unauthorized());
    if (!isUserAccountActive(user)) {
      return withCorrelationHeaders(event, unauthorized(ACCOUNT_INACTIVE_MESSAGE));
    }

    const method = event.requestContext.http.method.toUpperCase();
    const path = event.rawPath ?? "";
    const incidentId = event.pathParameters?.incidentId?.trim();

    // EIDO import — agencyadmin (or rcsuperadmin) only; body carries its own agencyId/incidentId.
    if (method === "POST" && path.endsWith("/eido/import")) {
      if (!isAgencyAdmin(user.role) && !isRcSuperAdmin(user.role)) {
        return withCorrelationHeaders(event, forbidden());
      }
      const parsedBody = parseBody(event.body);
      if (parsedBody === null) return withCorrelationHeaders(event, badRequest("Invalid JSON"));
      const parsed = eidoImportBodySchema.safeParse(parsedBody);
      if (!parsed.success) return withCorrelationHeaders(event, badRequestFromZod(parsed.error));
      const result = await importEido(user, parsed.data);
      return withCorrelationHeaders(event, ok(result));
    }

    // Everything below is dispatcher+ and incident-scoped.
    if (!incidentId) return withCorrelationHeaders(event, badRequest("incidentId required"));
    if (!authz.canDispatch(user)) return withCorrelationHeaders(event, forbidden());

    if (method === "GET" && path.endsWith("/eido")) {
      const includeParam = event.queryStringParameters?.includeAdditionalData;
      const includeAdditionalData = includeParam === "true" || includeParam === "1";
      const existing = await getStoredEido(user.agencyId, incidentId);
      const eido =
        existing && !includeAdditionalData
          ? existing
          : await exportFromIncident(user.agencyId, incidentId, includeAdditionalData);
      return withCorrelationHeaders(event, ok({ eido }));
    }

    if (method === "POST" && path.endsWith("/additional-data/auto-build")) {
      const parsedBody = parseBody(event.body);
      if (parsedBody === null) return withCorrelationHeaders(event, badRequest("Invalid JSON"));
      const parsed = additionalDataAutoBuildBodySchema.safeParse(parsedBody);
      if (!parsed.success) return withCorrelationHeaders(event, badRequestFromZod(parsed.error));
      const pkg = await autoBuild(user.agencyId, incidentId, user.userId, parsed.data);
      return withCorrelationHeaders(event, ok({ package: pkg }));
    }

    if (method === "GET" && path.endsWith("/additional-data")) {
      const pkg = await getAdditionalData(user.agencyId, incidentId);
      if (!pkg) return withCorrelationHeaders(event, notFound("Additional data not found"));
      return withCorrelationHeaders(event, ok({ package: pkg }));
    }

    if (method === "PUT" && path.endsWith("/additional-data")) {
      const parsedBody = parseBody(event.body);
      if (parsedBody === null) return withCorrelationHeaders(event, badRequest("Invalid JSON"));
      const parsed = additionalDataUpsertBodySchema.safeParse(parsedBody);
      if (!parsed.success) return withCorrelationHeaders(event, badRequestFromZod(parsed.error));
      const pkg = await putAdditionalData(user.agencyId, incidentId, user.userId, parsed.data);
      return withCorrelationHeaders(event, ok({ package: pkg }));
    }

    return withCorrelationHeaders(event, notFound("Unknown route"));
  } catch (error) {
    return withCorrelationHeaders(event, mapError(error));
  }
};
