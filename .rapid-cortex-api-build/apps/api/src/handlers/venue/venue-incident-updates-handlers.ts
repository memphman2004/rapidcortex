import type { APIGatewayProxyHandlerV2, APIGatewayProxyResultV2 } from "aws-lambda";
import {
  venueIncidentStatusPatchSchema,
  venueIncidentUpdateBodySchema,
} from "rapid-cortex-shared";
import { AuthorizationService } from "rapid-cortex-security";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../../lib/auth.js";
import { withCorrelationHeaders } from "../../lib/correlation.js";
import { operationalPasswordBlock } from "../../lib/operationalPasswordGate.js";
import {
  badRequest,
  forbidden,
  jsonStatus,
  notFound,
  ok,
  serverError,
  unauthorized,
} from "../../lib/response.js";
import { venueCodeFromAgencyId } from "../vertical/agency-id.js";
import { canSupervisorVenueOps } from "../vertical/agency-route-context.js";
import {
  listVenueIncidentUpdates,
  patchVenueIncidentStatus,
  postVenueIncidentUpdate,
} from "./venue-incident-updates-service.js";

const authz = new AuthorizationService();

function parseBody(event: { body?: string | null }): unknown {
  try {
    return event.body ? JSON.parse(event.body) : {};
  } catch {
    return null;
  }
}

function actorLabel(user: { email?: string; role: string }): string {
  const email = user.email?.trim();
  if (email) return email.split("@")[0] ?? "Dispatcher";
  return user.role.replace(/^VENUE_/, "").replace(/_/g, " ") || "Dispatcher";
}

async function requireVenueUser(event: Parameters<APIGatewayProxyHandlerV2>[0]) {
  const user = await getUserContext(event);
  if (!user) return { response: withCorrelationHeaders(event, unauthorized()) } as const;
  if (!isUserAccountActive(user)) {
    return { response: withCorrelationHeaders(event, unauthorized(ACCOUNT_INACTIVE_MESSAGE)) } as const;
  }
  const pwd = operationalPasswordBlock(user);
  if (pwd) return { response: withCorrelationHeaders(event, pwd) } as const;

  try {
    authz.assertCanPerform(user, "venue.dashboard.view");
  } catch {
    return { response: withCorrelationHeaders(event, forbidden()) } as const;
  }

  const agencyId = user.agencyId?.trim();
  if (!agencyId) {
    return { response: withCorrelationHeaders(event, forbidden("Agency claim required")) } as const;
  }

  const incidentId = event.pathParameters?.incidentId?.trim();
  if (!incidentId) {
    return { response: withCorrelationHeaders(event, badRequest("incidentId is required")) } as const;
  }

  return {
    user,
    agencyId,
    incidentId,
    venueCode: venueCodeFromAgencyId(agencyId),
  } as const;
}

/** GET/POST /api/incidents/{incidentId}/updates */
export const updates = async (
  event: Parameters<APIGatewayProxyHandlerV2>[0],
): Promise<APIGatewayProxyResultV2> => {
  try {
    const resolved = await requireVenueUser(event);
    if ("response" in resolved) {
      return resolved.response as APIGatewayProxyResultV2;
    }
    const { user, agencyId, incidentId, venueCode } = resolved;

    if (event.requestContext.http.method === "GET") {
      const rows = await listVenueIncidentUpdates(venueCode, incidentId);
      return withCorrelationHeaders(event, ok({ updates: rows }));
    }

    if (event.requestContext.http.method !== "POST") {
      return withCorrelationHeaders(event, jsonStatus({ error: "Method not allowed" }, 405));
    }

    if (!canSupervisorVenueOps(user)) {
      return withCorrelationHeaders(event, forbidden());
    }

    const body = parseBody(event);
    if (body === null) return withCorrelationHeaders(event, badRequest("Invalid JSON body"));
    const parsed = venueIncidentUpdateBodySchema.safeParse(body);
    if (!parsed.success) return withCorrelationHeaders(event, badRequest("message is required"));

    const update = await postVenueIncidentUpdate({
      agencyId,
      venueCode,
      incidentId,
      actorId: user.userId,
      actorLabel: actorLabel(user),
      body: parsed.data,
    });
    return withCorrelationHeaders(event, ok({ update }));
  } catch (error) {
    const statusCode = (error as { statusCode?: number }).statusCode;
    if (statusCode === 404) return withCorrelationHeaders(event, notFound("Incident not found"));
    console.error("[venue-incident-updates]", error);
    return withCorrelationHeaders(event, serverError());
  }
};

/** PATCH /api/incidents/{incidentId}/status */
export const status = async (
  event: Parameters<APIGatewayProxyHandlerV2>[0],
): Promise<APIGatewayProxyResultV2> => {
  try {
    const resolved = await requireVenueUser(event);
    if ("response" in resolved) {
      return resolved.response as APIGatewayProxyResultV2;
    }
    const { user, agencyId, incidentId, venueCode } = resolved;

    if (event.requestContext.http.method !== "PATCH") {
      return withCorrelationHeaders(event, jsonStatus({ error: "Method not allowed" }, 405));
    }

    if (!canSupervisorVenueOps(user)) {
      return withCorrelationHeaders(event, forbidden());
    }

    const body = parseBody(event);
    if (body === null) return withCorrelationHeaders(event, badRequest("Invalid JSON body"));
    const parsed = venueIncidentStatusPatchSchema.safeParse(body);
    if (!parsed.success) return withCorrelationHeaders(event, badRequest("Invalid status"));

    const result = await patchVenueIncidentStatus({
      agencyId,
      venueCode,
      incidentId,
      actorId: user.userId,
      actorLabel: actorLabel(user),
      body: parsed.data,
    });
    return withCorrelationHeaders(event, ok(result));
  } catch (error) {
    const statusCode = (error as { statusCode?: number }).statusCode;
    if (statusCode === 404) return withCorrelationHeaders(event, notFound("Incident not found"));
    console.error("[venue-incident-status]", error);
    return withCorrelationHeaders(event, serverError());
  }
};
