import {
  deleteTenantPricingBodySchema,
  putGlobalPricingBodySchema,
  putTenantPricingBodySchema,
  type UserContext,
} from "rapid-cortex-shared";
import { AuthorizationService } from "rapid-cortex-security";
import { badRequestFromZod, forbidden, notFound, ok, serverError } from "../../lib/response.js";
import { pricingAdminService } from "../../services/pricingAdminService.js";

const authz = new AuthorizationService();

function pricingError(err: unknown) {
  if (err instanceof Error) {
    if (err.message === "FORBIDDEN_PERMISSION") {
      return forbidden("Forbidden");
    }
    if (err.message === "AGENCY_NOT_FOUND") {
      return notFound("Agency not found");
    }
    if (err.message.includes("not configured")) {
      return ok({ ok: false, error: err.message, code: "SERVICE_UNAVAILABLE" }, 503);
    }
  }
  console.error("[pricingAdmin]", err);
  return ok({ ok: false, error: "Internal server error", code: "INTERNAL_ERROR" }, 500);
}

function parseBody(event: { body?: string | null; isBase64Encoded?: boolean }): unknown {
  const raw =
    event.isBase64Encoded && event.body
      ? Buffer.from(event.body, "base64").toString("utf8")
      : (event.body ?? "{}");
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function handlePricingAdminRoute(
  event: {
    rawPath?: string;
    body?: string | null;
    isBase64Encoded?: boolean;
    queryStringParameters?: Record<string, string | undefined> | null;
    pathParameters?: Record<string, string | undefined> | null;
    requestContext: { http: { method: string } };
  },
  user: UserContext,
) {
  const method = event.requestContext.http.method;
  const path = event.rawPath ?? "";

  try {
    if (path === "/api/admin/pricing/global" && method === "GET") {
      const data = await pricingAdminService.getGlobal(user);
      return ok(data);
    }

    if (path === "/api/admin/pricing/global" && method === "PUT") {
      try {
        authz.assertCanPerform(user, "billing.revenue_view");
      } catch {
        return forbidden("Forbidden");
      }
      const parsed = putGlobalPricingBodySchema.safeParse(parseBody(event));
      if (!parsed.success) return badRequestFromZod(parsed.error);
      await pricingAdminService.putGlobal(user, parsed.data.overrides, parsed.data.reason);
      return ok({ ok: true });
    }

    if (path === "/api/admin/pricing/tenants" && method === "GET") {
      const data = await pricingAdminService.listTenants(user);
      return ok(data);
    }

    if (path === "/api/admin/pricing/audit" && method === "GET") {
      const q = event.queryStringParameters ?? {};
      const limit = q.limit ? Number(q.limit) : undefined;
      const data = await pricingAdminService.getAudit(user, {
        scope: q.scope,
        agencyId: q.agencyId,
        limit: Number.isFinite(limit) ? limit : undefined,
        before: q.before,
      });
      return ok(data);
    }

    const tenantMatch = path.match(/^\/api\/admin\/pricing\/tenants\/([^/]+)$/);
    if (tenantMatch) {
      const agencyId = decodeURIComponent(tenantMatch[1] ?? "");
      if (!agencyId) return notFound("Agency not found");

      if (method === "GET") {
        const data = await pricingAdminService.getTenant(user, agencyId);
        return ok(data);
      }

      if (method === "PUT") {
        try {
          authz.assertCanPerform(user, "billing.revenue_view");
        } catch {
          return forbidden("Forbidden");
        }
        const parsed = putTenantPricingBodySchema.safeParse(parseBody(event));
        if (!parsed.success) return badRequestFromZod(parsed.error);
        await pricingAdminService.putTenant(
          user,
          agencyId,
          parsed.data.overrides,
          parsed.data.reason,
        );
        return ok({ ok: true });
      }

      if (method === "DELETE") {
        try {
          authz.assertCanPerform(user, "billing.revenue_view");
        } catch {
          return forbidden("Forbidden");
        }
        const parsed = deleteTenantPricingBodySchema.safeParse(parseBody(event));
        if (!parsed.success) return badRequestFromZod(parsed.error);
        await pricingAdminService.deleteTenant(user, agencyId, parsed.data.reason);
        return ok({ ok: true });
      }
    }

    return notFound("Not found");
  } catch (err) {
    return pricingError(err);
  }
}
