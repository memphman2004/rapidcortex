import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { AuthorizationService } from "rapid-cortex-security";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../lib/auth.js";
import {
  badRequest,
  forbidden,
  notFound,
  ok,
  serverError,
  serviceUnavailable,
  unauthorized,
} from "../lib/response.js";
import { PinpointService } from "../services/pinpointService.js";
import { SurgeService } from "../services/surgeService.js";

const pinpoint = new PinpointService();
const surge = new SurgeService();
const authz = new AuthorizationService();

function mapErr(e: unknown) {
  const msg = e instanceof Error ? e.message : String(e);
  if (msg.startsWith("VALIDATION:")) return badRequest(msg.slice("VALIDATION:".length));
  if (msg === "NOT_FOUND") return notFound();
  if (
    msg === "PINPOINT_LINKS_TABLE_NOT_CONFIGURED" ||
    msg === "PINPOINT_DISABLED" ||
    msg === "SURGE_CLUSTERS_TABLE_NOT_CONFIGURED" ||
    msg === "SURGE_DISABLED"
  ) {
    return serviceUnavailable("Feature is not available");
  }
  if (msg === "MISSING_PUBLIC_BASE_URL") {
    return badRequest("Public app URL is not configured. Set PINPOINT_PUBLIC_BASE_URL or pass publicAppBaseUrl.");
  }
  if (msg === "CLUSTER_COLLAPSED") return badRequest("Cluster no longer meets minimum size after split.");
  return serverError();
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const routeKey = event.routeKey ?? "";
    const user = await getUserContext(event);
    if (!user) return unauthorized();
    if (!isUserAccountActive(user)) return unauthorized(ACCOUNT_INACTIVE_MESSAGE);
    // INTENTIONAL: Pinpoint (caller location SMS) and Surge (related-call
    // clustering) are not in the Role Access Matrix v2.0 — they are
    // dispatcher/supervisor operational tools gated by canDispatch with auditor
    // excluded. When a `workspace.pinpoint` or `workspace.surge` permission is
    // added to the matrix, replace this with assertCanPerform.
    if (!authz.canDispatch(user) || user.role === "auditor") {
      return forbidden("Role cannot use Pinpoint or Surge");
    }

    const incidentId = event.pathParameters?.id;
    if (!incidentId) return notFound("Missing incident id");

    if (routeKey === "POST /api/incidents/{id}/pinpoint/links") {
      const body = JSON.parse(event.body ?? "{}");
      const out = await pinpoint.createLink(incidentId, user, body);
      return ok(out, 201);
    }

    if (routeKey === "GET /api/incidents/{id}/pinpoint/links") {
      const list = await pinpoint.listLinksBrief(incidentId, user);
      return ok(list);
    }

    const linkId = event.pathParameters?.linkId;
    if (routeKey === "GET /api/incidents/{id}/pinpoint/links/{linkId}") {
      if (!linkId) return notFound("Missing link id");
      const s = await pinpoint.getDispatcherLink(incidentId, linkId, user);
      return ok(s);
    }

    if (routeKey === "POST /api/incidents/{id}/pinpoint/links/{linkId}/revoke") {
      if (!linkId) return notFound("Missing link id");
      const s = await pinpoint.revokeLink(incidentId, linkId, user);
      return ok(s);
    }

    if (routeKey === "POST /api/incidents/{id}/surge/analyze") {
      const out = await surge.analyze(incidentId, user);
      return ok(out);
    }

    if (routeKey === "GET /api/incidents/{id}/surge/clusters") {
      const list = await surge.listClusters(incidentId, user);
      return ok(list);
    }

    const clusterId = event.pathParameters?.clusterId;
    if (routeKey === "GET /api/incidents/{id}/surge/clusters/{clusterId}") {
      if (!clusterId) return notFound("Missing cluster id");
      const s = await surge.getClusterDetail(incidentId, clusterId, user);
      return ok(s);
    }

    if (routeKey === "POST /api/incidents/{id}/surge/clusters/{clusterId}/confirm") {
      if (!clusterId) return notFound("Missing cluster id");
      const s = await surge.confirmCluster(incidentId, clusterId, user);
      return ok(s);
    }

    if (routeKey === "POST /api/incidents/{id}/surge/clusters/{clusterId}/dismiss") {
      if (!clusterId) return notFound("Missing cluster id");
      const s = await surge.dismissCluster(incidentId, clusterId, user);
      return ok(s);
    }

    if (routeKey === "POST /api/incidents/{id}/surge/clusters/{clusterId}/split") {
      if (!clusterId) return notFound("Missing cluster id");
      const body = JSON.parse(event.body ?? "{}");
      const s = await surge.splitCluster(incidentId, clusterId, user, body);
      return ok(s);
    }

    return notFound("Unknown route");
  } catch (e) {
    return mapErr(e);
  }
};
