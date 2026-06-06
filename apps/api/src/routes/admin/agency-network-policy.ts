import type { APIGatewayProxyEventV2 } from "aws-lambda";
import type { UserContext } from "rapid-cortex-shared";
import {
  addNetworkCidrBodySchema,
  emergencyOverrideRequestBodySchema,
  grantEmergencyOverrideBodySchema,
  patchAgencyNetworkPolicyBodySchema,
} from "rapid-cortex-shared";
import {
  authFailure,
  badRequest,
  badRequestFromZod,
  forbidden,
  jsonStatus,
  notFound,
  ok,
  serverError,
} from "../../lib/response.js";
import { AgencyNetworkPolicyService } from "../../services/agencyNetworkPolicyService.js";

const service = new AgencyNetworkPolicyService();

function pathParts(rawPath: string): string[] {
  return (rawPath.split("?")[0] ?? "").split("/").filter(Boolean);
}

function resolveAgencyNetworkPath(rawPath: string): {
  agencyId: string;
  tail: string[];
} | null {
  const parts = pathParts(rawPath);
  const idx = parts.findIndex((p, i) => p === "admin" && parts[i + 1] === "agencies");
  if (idx < 0) return null;
  const agencyId = parts[idx + 2];
  if (!agencyId || parts[idx + 3] !== "network-policy") return null;
  return { agencyId, tail: parts.slice(idx + 4) };
}

export async function handleAgencyNetworkPolicyAdminRoute(
  event: APIGatewayProxyEventV2,
  user: UserContext,
) {
  const route = resolveAgencyNetworkPath(event.rawPath ?? "");
  if (!route) return jsonStatus({ error: "Not found" }, 404);
  const { agencyId, tail } = route;
  const method = event.requestContext.http.method;

  try {
    if (tail.length === 0 && method === "GET") {
      const data = await service.getPolicy(agencyId, user);
      return ok({ data });
    }
    if (tail.length === 0 && method === "PATCH") {
      const raw = JSON.parse(event.body ?? "{}");
      const parsed = patchAgencyNetworkPolicyBodySchema.safeParse(raw);
      if (!parsed.success) return badRequestFromZod(parsed.error);
      const policy = await service.patchPolicy(agencyId, user, parsed.data);
      return ok({ data: { policy } });
    }
    if (tail[0] === "cidrs" && tail.length === 1 && method === "POST") {
      const raw = JSON.parse(event.body ?? "{}");
      const parsed = addNetworkCidrBodySchema.safeParse(raw);
      if (!parsed.success) return badRequestFromZod(parsed.error);
      const policy = await service.addCidr(agencyId, user, parsed.data);
      return ok({ data: { policy } });
    }
    if (tail[0] === "cidrs" && tail.length === 1 && method === "DELETE") {
      const cidr =
        event.queryStringParameters?.cidr ?? event.queryStringParameters?.encodedCidr ?? "";
      if (!cidr) return badRequest("Missing cidr query parameter.");
      const policy = await service.removeCidr(agencyId, user, cidr);
      return ok({ data: { policy } });
    }
    if (tail[0] === "emergency-override" && method === "POST") {
      const raw = JSON.parse(event.body ?? "{}");
      const parsedGrant = grantEmergencyOverrideBodySchema.safeParse(raw);
      if (!parsedGrant.success) return badRequestFromZod(parsedGrant.error);
      const data = await service.grantEmergencyOverride(agencyId, user, parsedGrant.data);
      return ok({ data });
    }
    if (tail[0] === "audit" && method === "GET") {
      const items = await service.listAudit(agencyId, user);
      return ok({ data: { items } });
    }
    return jsonStatus({ error: "Not found" }, 404);
  } catch (e) {
    if (e instanceof Error) {
      if (e.message === "FORBIDDEN") return forbidden();
      if (e.message === "NOT_FOUND") return notFound();
      if (e.message === "IP_ALLOWLIST_EMPTY") {
        return badRequest("Cannot enable IP allowlist without at least one CIDR.");
      }
      if (e.message === "TIME_SCHEDULE_EMPTY") {
        return badRequest("Cannot enable time restriction without an enabled schedule day.");
      }
      if (e.message.startsWith("SCHEDULE_INVALID:")) {
        return badRequest(e.message.replace("SCHEDULE_INVALID:", ""));
      }
      if (e.message === "INVALID_CIDR") return badRequest("Invalid CIDR.");
      if (e.message === "LAST_CIDR") {
        return badRequest("Cannot remove the last CIDR while IP allowlist is enabled.");
      }
    }
    return serverError();
  }
}

export async function handleAgencyNetworkPolicyCheckRoute(
  event: APIGatewayProxyEventV2,
  user: UserContext,
) {
  const result = await service.checkAccess(event, user);
  return {
    statusCode: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
    body: JSON.stringify({ data: result }),
  };
}

export async function handleAgencyEmergencyOverrideRequestRoute(
  event: APIGatewayProxyEventV2,
  user: UserContext,
) {
  try {
    const raw = JSON.parse(event.body ?? "{}");
    const parsedReq = emergencyOverrideRequestBodySchema.safeParse(raw);
    if (!parsedReq.success) return badRequestFromZod(parsedReq.error);
    const data = await service.requestEmergencyOverride(user, parsedReq.data);
    return ok({ data });
  } catch (e) {
    if (e instanceof Error && e.message === "OVERRIDE_DISABLED") {
      return badRequest("Emergency override is not enabled for this agency.");
    }
    return serverError();
  }
}
