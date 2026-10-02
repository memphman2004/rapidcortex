import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { AuthorizationService } from "rapid-cortex-security";
import {
  createQAProtocolTemplateBodySchema,
  createQASessionBodySchema,
  patchQAProtocolTemplateBodySchema,
  patchQASessionBodySchema,
} from "rapid-cortex-shared";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../../lib/auth.js";
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
import { QAService } from "../../services/qaService.js";
import { requireAddon } from "../../middleware/requireAddon.js";

const service = new QAService();
const authz = new AuthorizationService();
const requireQaAddon = requireAddon("supervisor_qa.");

function mapErr(e: unknown) {
  const msg = e instanceof Error ? e.message : String(e);
  if (msg === "QA_DISABLED" || msg === "QA_TABLES_NOT_CONFIGURED") {
    return serviceUnavailable("QA scoring is not enabled for this deployment");
  }
  if (msg === "NOT_FOUND") return notFound();
  if (msg === "FORBIDDEN" || msg === "TENANT_MISMATCH") return forbidden();
  if (msg === "TEMPLATE_NOT_FOUND") return notFound("Template not found");
  return serverError();
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const routeKey = event.routeKey ?? "";
    const user = await getUserContext(event);
    if (!user) return unauthorized();
    if (!isUserAccountActive(user)) return unauthorized(ACCOUNT_INACTIVE_MESSAGE);
    const addonGate = await requireQaAddon(event, user);
    if (addonGate) return addonGate;
    // INTENTIONAL: QA sessions + templates routes are not individually mapped
    // in Role Access Matrix v2.0 (which only enumerates scorecards/coaching/trends).
    // canDispatch is the correct gate for QA session lifecycle operations.
    // When matrix gains qa.sessions_* / qa.templates_* perms, replace with
    // per-route assertCanPerform.
    if (!authz.canDispatch(user)) return forbidden();

    if (routeKey === "POST /api/qa/sessions") {
      const parsed = createQASessionBodySchema.safeParse(JSON.parse(event.body ?? "{}"));
      if (!parsed.success) return badRequestFromZod(parsed.error);
      const created = await service.createSession(user, parsed.data);
      return ok(created, 201);
    }

    if (routeKey === "GET /api/qa/sessions") {
      const items = await service.listSessions(user);
      return ok({ items });
    }

    const sessionId = event.pathParameters?.id;
    if (routeKey === "GET /api/qa/sessions/{id}") {
      if (!sessionId) return notFound();
      const s = await service.getSession(user, sessionId);
      return ok(s);
    }

    if (routeKey === "PATCH /api/qa/sessions/{id}") {
      if (!sessionId) return notFound();
      const parsed = patchQASessionBodySchema.safeParse(JSON.parse(event.body ?? "{}"));
      if (!parsed.success) return badRequestFromZod(parsed.error);
      const s = await service.patchSession(user, sessionId, parsed.data);
      return ok(s);
    }

    if (routeKey === "GET /api/qa/templates") {
      const items = await service.listTemplates(user);
      return ok({ items });
    }

    if (routeKey === "POST /api/qa/templates") {
      const parsed = createQAProtocolTemplateBodySchema.safeParse(JSON.parse(event.body ?? "{}"));
      if (!parsed.success) return badRequestFromZod(parsed.error);
      const t = await service.createTemplate(user, parsed.data);
      return ok(t, 201);
    }

    const templateId = event.pathParameters?.id;
    if (routeKey === "PATCH /api/qa/templates/{id}") {
      if (!templateId) return notFound();
      const parsed = patchQAProtocolTemplateBodySchema.safeParse(JSON.parse(event.body ?? "{}"));
      if (!parsed.success) return badRequestFromZod(parsed.error);
      const t = await service.patchTemplate(user, templateId, parsed.data);
      return ok(t);
    }

    if (routeKey === "DELETE /api/qa/templates/{id}") {
      if (!templateId) return notFound();
      await service.deleteTemplate(user, templateId);
      return { statusCode: 204, headers: {}, body: "" };
    }

    return notFound();
  } catch (e) {
    return mapErr(e);
  }
};
