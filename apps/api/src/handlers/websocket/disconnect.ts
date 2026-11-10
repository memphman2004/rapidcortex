import type { APIGatewayProxyWebsocketHandlerV2 } from "aws-lambda";
import { env } from "../../lib/env.js";
import { ResponderConnectionsRepository } from "../../repositories/responderConnectionsRepository.js";
import { WebSocketConnectionRepository } from "../../repositories/websocketConnectionRepository.js";

const repo = new WebSocketConnectionRepository();
const responders = new ResponderConnectionsRepository();

export const handler: APIGatewayProxyWebsocketHandlerV2 = async (event) => {
  const connectionId = event.requestContext.connectionId;
  if (!connectionId) {
    return { statusCode: 200, body: JSON.stringify({ message: "Disconnected" }) };
  }

  try {
    const existing = await repo.findByConnectionId(connectionId);
    await repo.deleteByConnectionId(connectionId);
    if (env.responderConnectionsTable?.trim()) {
      try {
        await responders.delete(connectionId);
      } catch (err) {
        console.warn(
          JSON.stringify({
            type: "responder.disconnect_cleanup_failed",
            connectionId,
            error: String(err),
          }),
        );
      }
    }
    if (existing) {
      console.log(`WebSocket disconnected: ${existing.userId} (${connectionId})`);
    }
    return { statusCode: 200, body: JSON.stringify({ message: "Disconnected" }) };
  } catch (error) {
    console.error("WebSocket disconnect error:", error);
    return { statusCode: 500, body: JSON.stringify({ error: "Disconnect failed" }) };
  }
};
