import {
  patchAgencyCadModuleBodySchema,
  patchUserCadAccessBodySchema,
  type UserContext,
} from "rapid-cortex-shared";
import { badRequest, badRequestFromZod, forbidden, jsonStatus, ok, serverError } from "../../lib/response.js";
import { CadModuleError, CadModuleService } from "../../services/cadModuleService.js";

const service = new CadModuleService();

type CadEvent = {
  rawPath?: string;
  body?: string | null;
  pathParameters?: Record<string, string | undefined>;
  requestContext: { http: { method: string } };
  isBase64Encoded?: boolean;
};

function decodePath(rawPath: string): string[] {
  return (rawPath.split("?")[0] ?? "")
    .split("/")
    .filter(Boolean)
    .map((part) => {
      try {
        return decodeURIComponent(part);
      } catch {
        return part;
      }
    });
}

function readBody(event: CadEvent): unknown {
  const raw =
    event.isBase64Encoded && event.body ? Buffer.from(event.body, "base64").toString("utf8") : (event.body ?? "{}");
  return JSON.parse(raw);
}

function fail(error: unknown) {
  if (error instanceof SyntaxError) return badRequest("Invalid JSON request body");
  if (error instanceof CadModuleError) {
    return jsonStatus({ error: error.message, ...error.details }, error.statusCode);
  }
  const name =
    typeof error === "object" && error && "name" in error ? String((error as { name?: string }).name) : "";
  if (name === "ConditionalCheckFailedException") return jsonStatus({ error: "Agency not found" }, 404);
  console.error(
    JSON.stringify({
      msg: "cad_module_route_failed",
      error: error instanceof Error ? error.message : "unknown",
    }),
  );
  return serverError();
}

export async function handleCadModuleRoute(event: CadEvent, user: UserContext) {
  const method = event.requestContext.http.method;
  const parts = decodePath(event.rawPath ?? "");
  try {
    if (method === "GET" && parts[0] === "api" && parts[1] === "agency" && parts[2] === "cad-module" && parts.length === 3) {
      const data = await service.getForActor(user);
      return ok({ data });
    }

    const tenants = parts.findIndex((part, index) => part === "admin" && parts[index + 1] === "tenants");
    const agencyId = (tenants >= 0 ? parts[tenants + 2] : event.pathParameters?.tenantId)?.trim();
    const tail = tenants >= 0 ? parts.slice(tenants + 3) : [];
    if (!agencyId || tail[0] !== "cad-module") return forbidden();

    if (method === "GET" && tail.length === 1) {
      const data = await service.getForAgency(agencyId, user);
      return ok({ data });
    }

    if (method === "PATCH" && tail.length === 1) {
      const parsed = patchAgencyCadModuleBodySchema.safeParse(readBody(event));
      if (!parsed.success) return badRequestFromZod(parsed.error);
      const data = await service.setAgencyEnabled(agencyId, user, parsed.data);
      return ok({ data });
    }

    if (method === "PATCH" && tail[1] === "users" && tail[2] && tail.length === 3) {
      const parsed = patchUserCadAccessBodySchema.safeParse(readBody(event));
      if (!parsed.success) return badRequestFromZod(parsed.error);
      const data = await service.setUserAccess(agencyId, tail[2], user, parsed.data);
      return ok({ data });
    }

    return jsonStatus({ error: "Not found" }, 404);
  } catch (error) {
    return fail(error);
  }
}
