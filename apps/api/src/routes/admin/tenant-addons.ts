import {
  patchTenantAddonBodySchema,
  type UserContext,
} from "rapid-cortex-shared";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../../lib/auth.js";
import {
  badRequest,
  badRequestFromZod,
  conflict,
  forbidden,
  jsonStatus,
  ok,
  serverError,
  unauthorized,
} from "../../lib/response.js";
import { TenantAddonService } from "../../services/tenantAddonService.js";

const service = new TenantAddonService();

export function pathTenantId(
  rawPath: string,
  pathParameters?: Record<string, string | undefined>,
): { tenantId: string; tail: string[] } | null {
  const parts = (rawPath.split("?")[0] ?? "").split("/").filter(Boolean);
  const idx = parts.findIndex((p, i) => p === "admin" && parts[i + 1] === "tenants");
  const tenantIdFromPath = idx >= 0 ? parts[idx + 2] : undefined;
  const tenantId =
    pathParameters?.tenantId?.trim() ||
    pathParameters?.agencyId?.trim() ||
    tenantIdFromPath?.trim();
  if (!tenantId) return null;
  const tail = idx >= 0 ? parts.slice(idx + 3) : [];
  return { tenantId, tail };
}

function clientMeta(event: {
  requestContext?: { http?: { sourceIp?: string } };
  headers?: Record<string, string | undefined>;
}): { ip?: string; ua?: string } {
  const ip = event.requestContext?.http?.sourceIp;
  const ua = event.headers?.["user-agent"] ?? event.headers?.["User-Agent"];
  return { ip, ua };
}

export async function handleTenantAddonsAdminRoute(
  event: {
    rawPath?: string;
    body?: string | null;
    queryStringParameters?: Record<string, string | undefined>;
    pathParameters?: Record<string, string | undefined>;
    requestContext: { http: { method: string; sourceIp?: string } };
    headers?: Record<string, string | undefined>;
    isBase64Encoded?: boolean;
  },
  user: UserContext,
) {
  let requestTenantId: string | null = null;
  let requestTail: string[] = [];
  let requestMethod = event.requestContext.http.method;
  try {
    const parsed = pathTenantId(event.rawPath ?? "", event.pathParameters);
    if (!parsed) return badRequest("Invalid path");
    const { tenantId, tail } = parsed;
    const method = event.requestContext.http.method;
    requestTenantId = tenantId;
    requestTail = tail;
    requestMethod = method;

    const rawPath = event.rawPath ?? "";
    const isEntitlementsGet =
      method === "GET" &&
      (tail[0] === "entitlements" || rawPath.endsWith("/entitlements") || rawPath.endsWith("/entitlements/"));

    if (isEntitlementsGet) {
      const data = await service.getEntitlementsAdmin(tenantId, user);
      return ok({ data });
    }

    if (
      method === "GET" &&
      ((tail[0] === "entitlements" && tail[1] === "audit") || rawPath.includes("/entitlements/audit"))
    ) {
      const limit = event.queryStringParameters?.limit
        ? Number.parseInt(event.queryStringParameters.limit, 10)
        : 50;
      const items = await service.listAudit(tenantId, user, limit);
      return ok({ data: { items } });
    }

    if (tail.length === 2 && tail[0] === "invoice" && tail[1] === "current" && method === "GET") {
      const invoice = await service.getCurrentInvoice(tenantId, user);
      return ok({ data: { invoice } });
    }

    if (tail.length === 1 && tail[0] === "entitlements" && method === "PATCH") {
      const bodyRaw = event.isBase64Encoded && event.body
        ? Buffer.from(event.body, "base64").toString("utf8")
        : (event.body ?? "{}");
      const parsedBody = patchTenantAddonBodySchema.safeParse(JSON.parse(bodyRaw));
      if (!parsedBody.success) return badRequestFromZod(parsedBody.error);
      const meta = clientMeta(event);
      const result = await service.patchAddon(tenantId, user, parsedBody.data, "api", meta.ip, meta.ua);
      return ok({ data: result });
    }

    return jsonStatus({ error: "Not found" }, 404);
  } catch (e) {
    const errorName =
      typeof e === "object" && e && "name" in e && typeof (e as { name?: unknown }).name === "string"
        ? (e as { name: string }).name
        : undefined;
    const errorMessage =
      e instanceof Error
        ? e.message
        : typeof e === "object" && e && "message" in e && typeof (e as { message?: unknown }).message === "string"
          ? (e as { message: string }).message
          : String(e);

    console.error("tenant-addons route failure", {
      method: requestMethod,
      tenantId: requestTenantId,
      tail: requestTail,
      errorName,
      errorMessage,
    });

    if (e instanceof SyntaxError) {
      return badRequest("Invalid JSON request body");
    }

    if (e instanceof Error) {
      if (e.message === "FORBIDDEN") return forbidden();
      if (e.message === "CONCURRENT_MODIFICATION") {
        return conflict("Record was modified by another user — please refresh.");
      }
      if (e.message === "ADDON_INCLUDED_IN_PLAN") {
        const plan = (e as Error & { plan?: string }).plan ?? "plan";
        return jsonStatus(
          {
            error: "ADDON_INCLUDED_IN_PLAN",
            message: `This feature is included in the ${plan} plan and cannot be toggled.`,
          },
          409,
        );
      }
      if (e.message === "ADDON_VERTICAL_MISMATCH") {
        const verticalRequired = (e as Error & { verticalRequired?: string }).verticalRequired ?? "tenant";
        return jsonStatus(
          {
            error: "ADDON_VERTICAL_MISMATCH",
            message: `This add-on requires the ${verticalRequired} vertical for this tenant.`,
          },
          409,
        );
      }
    }
    if (errorName === "ValidationException") {
      return badRequest(errorMessage || "Invalid entitlements update payload");
    }
    return serverError();
  }
}

export async function handleAgencyEntitlementsRoute(
  event: { requestContext: { http: { method: string } } },
  user: UserContext,
) {
  try {
    if (event.requestContext.http.method !== "GET") return jsonStatus({ error: "Method not allowed" }, 405);
    const data = await service.getEntitlementsAgency(user);
    return ok({ data });
  } catch (e) {
    if (e instanceof Error && e.message === "FORBIDDEN") return forbidden();
    return serverError();
  }
}

export const getEntitlementsHandler = async (
  event: Parameters<typeof handleTenantAddonsAdminRoute>[0],
) => {
  const user = await getUserContext(event as Parameters<typeof getUserContext>[0]);
  if (!user) return unauthorized();
  if (!isUserAccountActive(user)) return unauthorized(ACCOUNT_INACTIVE_MESSAGE);
  return handleTenantAddonsAdminRoute(event, user);
};
