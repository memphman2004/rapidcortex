import type { APIGatewayProxyWebsocketHandlerV2 } from "aws-lambda";
import { FIELD_RESPONDER_ROLE, isFieldResponderProductRole, responderSubscribeBodySchema } from "rapid-cortex-shared";
import { env } from "../../lib/env.js";
import { resolveIncidentRead } from "../../lib/incidentReadAccess.js";
import { ResponderConnectionsRepository } from "../../repositories/responderConnectionsRepository.js";
import { WebSocketConnectionRepository } from "../../repositories/websocketConnectionRepository.js";

const connections = new WebSocketConnectionRepository();
const responders = new ResponderConnectionsRepository();

export const handler: APIGatewayProxyWebsocketHandlerV2 = async (event) => {
  try {
    if (!env.responderConnectionsTable) {
      return { statusCode: 503, body: "Responder connections unavailable" };
    }

    const connectionId = event.requestContext.connectionId;
    if (!connectionId) return { statusCode: 400, body: "Missing connectionId" };

    const row = await connections.findByConnectionId(connectionId);
    if (!row) return { statusCode: 401, body: "Unknown connection" };

    if (!isFieldResponderProductRole(row.role) && row.role !== FIELD_RESPONDER_ROLE) {
      return { statusCode: 403, body: "field_responder role required" };
    }

    let body: unknown = {};
    try {
      body = JSON.parse(event.body ?? "{}");
    } catch {
      return { statusCode: 400, body: "Invalid JSON" };
    }
    const parsed = responderSubscribeBodySchema.safeParse(body);
    if (!parsed.success) return { statusCode: 400, body: "Invalid subscribe body" };

    const userLike = {
      userId: row.userId,
      role: row.role,
      agencyId: row.agencyId,
      displayName: row.displayName,
    };
    const resolved = await resolveIncidentRead(parsed.data.incidentId, userLike as never);
    if (!resolved) return { statusCode: 403, body: "Forbidden" };
    if (row.agencyId !== resolved.incident.agencyId && row.role !== "rcsuperadmin") {
      return { statusCode: 403, body: "Agency mismatch" };
    }

    await responders.put({
      connectionId,
      incidentId: parsed.data.incidentId,
      userId: row.userId,
      userRole: "field_responder",
      agencyId: resolved.incident.agencyId,
      displayName: row.displayName,
    });

    return { statusCode: 200, body: JSON.stringify({ ok: true, audioAuthorized: false }) };
  } catch (error) {
    console.error(
      JSON.stringify({
        type: "responder.subscribe_error",
        error: String(error),
      }),
    );
    return { statusCode: 500, body: "Internal error" };
  }
};
