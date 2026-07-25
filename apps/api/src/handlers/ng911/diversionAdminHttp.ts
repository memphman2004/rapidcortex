import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { diversionWorkflowUpsertBodySchema } from "rapid-cortex-shared";
import { AuthorizationService, isSupervisorOrAdmin } from "rapid-cortex-security";
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
  deleteWorkflow,
  listSessions,
  listWorkflows,
  rotateConfig,
  upsertWorkflow,
} from "../../services/ng911/diversionService.js";

const authz = new AuthorizationService();

function parseBody(raw: string | undefined): unknown {
  try {
    return JSON.parse(raw ?? "{}");
  } catch {
    return null;
  }
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    if (!env.enableNg911Assist || !env.ng911AssistTable) {
      return serviceUnavailable("NG9-1-1 assist is not enabled for this deployment");
    }

    const user = await getUserContext(event);
    if (!user) return withCorrelationHeaders(event, unauthorized());
    if (!isUserAccountActive(user)) {
      return withCorrelationHeaders(event, unauthorized(ACCOUNT_INACTIVE_MESSAGE));
    }
    if (!isSupervisorOrAdmin(user.role) && !authz.canDispatch(user)) {
      return withCorrelationHeaders(event, forbidden());
    }

    const method = event.requestContext.http.method.toUpperCase();
    const path = event.rawPath ?? "";
    const workflowId = event.pathParameters?.workflowId?.trim();

    if (method === "GET" && path.endsWith("/diversion/workflows")) {
      const items = await listWorkflows(user.agencyId);
      return withCorrelationHeaders(event, ok({ items }));
    }

    if (method === "POST" && path.endsWith("/diversion/workflows")) {
      const body = parseBody(event.body);
      if (body === null) return withCorrelationHeaders(event, badRequest("Invalid JSON"));
      const parsed = diversionWorkflowUpsertBodySchema.safeParse(body);
      if (!parsed.success) return withCorrelationHeaders(event, badRequestFromZod(parsed.error));
      const workflow = await upsertWorkflow(user.agencyId, user.userId, parsed.data);
      return withCorrelationHeaders(event, ok({ workflow }));
    }

    if (method === "DELETE" && workflowId) {
      await deleteWorkflow(user.agencyId, user.userId, workflowId);
      return withCorrelationHeaders(event, ok({ ok: true }));
    }

    if (method === "POST" && path.endsWith("/diversion/config/rotate")) {
      const body = parseBody(event.body) as { greeting?: string; enabled?: boolean } | null;
      const result = await rotateConfig(user.agencyId, user.userId, {
        greeting: body?.greeting,
        enabled: body?.enabled,
      });
      return withCorrelationHeaders(event, ok(result));
    }

    if (method === "GET" && path.endsWith("/diversion/sessions")) {
      const limitParam = event.queryStringParameters?.limit;
      const limit = limitParam ? Math.max(1, Math.min(500, Number.parseInt(limitParam, 10) || 100)) : 100;
      const items = await listSessions(user.agencyId, limit);
      return withCorrelationHeaders(event, ok({ items, count: items.length }));
    }

    return withCorrelationHeaders(event, notFound("Unknown route"));
  } catch (error) {
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return withCorrelationHeaders(event, forbidden());
    }
    console.error("[ng911.diversionAdmin]", error);
    return withCorrelationHeaders(event, serverError());
  }
};
