import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { AuthorizationService } from "rapid-cortex-security";
import {
  createStakeholderPageBodySchema,
  listStakeholderPagesQuerySchema,
  patchStakeholderPageBodySchema,
} from "rapid-cortex-shared";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../lib/auth.js";
import {
  badRequest,
  badRequestFromZod,
  forbidden,
  notFound,
  ok,
  serverError,
  serviceUnavailable,
  unauthorized,
} from "../lib/response.js";
import { StakeholderPageService } from "../services/stakeholderPageService.js";

const service = new StakeholderPageService();
const auth = new AuthorizationService();

function mapErr(e: unknown) {
  const msg = e instanceof Error ? e.message : String(e);
  const statusCode = (e as Error & { statusCode?: number }).statusCode;
  if (msg === "FORBIDDEN_PERMISSION" && statusCode === 403) return forbidden();
  if (msg === "STAKEHOLDER_PAGES_DISABLED") return serviceUnavailable("Stakeholder pages are not enabled");
  if (msg === "NOT_FOUND") return notFound();
  if (msg === "FORBIDDEN" || msg === "TENANT_MISMATCH") return forbidden();
  if (msg === "SLUG_TAKEN") return badRequest("Slug is already in use");
  if (msg === "INVALID_PASSWORD") return unauthorized("Invalid page password");
  if (msg === "EXPIRED") return { statusCode: 410, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: "Page expired" }) };
  if (msg.startsWith("VALIDATION:")) return badRequest(msg.slice("VALIDATION:".length));
  return serverError();
}

function pagePasswordHeader(event: { headers?: Record<string, string | undefined> }): string | undefined {
  const h = event.headers ?? {};
  return h["x-page-password"] ?? h["X-Page-Password"];
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const routeKey = event.routeKey ?? "";

    if (routeKey === "GET /api/public/status/{slug}") {
      const slug = event.pathParameters?.slug;
      if (!slug) return notFound();
      const out = await service.getPublicBySlug(slug, pagePasswordHeader(event));
      if ("requiresPassword" in out && out.requiresPassword) {
        return unauthorized("Page password required");
      }
      return ok(out);
    }

    const user = await getUserContext(event);
    if (!user) return unauthorized();
    if (!isUserAccountActive(user)) return unauthorized(ACCOUNT_INACTIVE_MESSAGE);

    const pageId = event.pathParameters?.pageId;

    if (routeKey === "POST /api/stakeholder-pages") {
      auth.assertCanPerform(user, "command.status_pages");
      const parsed = createStakeholderPageBodySchema.safeParse(JSON.parse(event.body ?? "{}"));
      if (!parsed.success) return badRequestFromZod(parsed.error);
      const created = await service.create(user, parsed.data);
      return ok(created, 201);
    }

    if (routeKey === "GET /api/stakeholder-pages") {
      auth.assertCanPerform(user, "command.status_pages");
      const q = listStakeholderPagesQuerySchema.safeParse(event.queryStringParameters ?? {});
      if (!q.success) return badRequestFromZod(q.error);
      if (!q.data.incidentId) return badRequest("incidentId query parameter required");
      return ok(await service.list(user, q.data.incidentId));
    }

    if (routeKey === "GET /api/stakeholder-pages/{pageId}") {
      auth.assertCanPerform(user, "command.status_pages");
      if (!pageId) return notFound();
      return ok(await service.get(user, pageId));
    }

    if (routeKey === "PATCH /api/stakeholder-pages/{pageId}") {
      auth.assertCanPerform(user, "command.status_pages");
      if (!pageId) return notFound();
      const parsed = patchStakeholderPageBodySchema.safeParse(JSON.parse(event.body ?? "{}"));
      if (!parsed.success) return badRequestFromZod(parsed.error);
      return ok(await service.patch(user, pageId, parsed.data));
    }

    if (routeKey === "DELETE /api/stakeholder-pages/{pageId}") {
      auth.assertCanPerform(user, "command.status_pages");
      if (!pageId) return notFound();
      await service.delete(user, pageId);
      return { statusCode: 204, headers: {}, body: "" };
    }

    return notFound();
  } catch (e) {
    return mapErr(e);
  }
};
