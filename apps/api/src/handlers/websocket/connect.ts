import type { APIGatewayProxyWebsocketHandlerV2 } from "aws-lambda";
import { getUserContextFromWebSocket } from "../../lib/auth/websocket-context.js";
import { WebSocketConnectionRepository } from "../../repositories/websocketConnectionRepository.js";

const repo = new WebSocketConnectionRepository();

export const handler: APIGatewayProxyWebsocketHandlerV2 = async (event) => {
  const connectionId = event.requestContext.connectionId;
  if (!connectionId) {
    return { statusCode: 500, body: "Missing connection id" };
  }

  try {
    const user = await getUserContextFromWebSocket(event);
    if (!user) {
      return { statusCode: 401, body: JSON.stringify({ error: "Invalid token" }) };
    }

    await repo.putConnection({
      connectionId,
      userId: user.userId,
      agencyId: user.agencyId,
      role: user.role,
      displayName: user.email ?? user.userId,
    });

    console.log(`WebSocket connected: ${user.userId} (${connectionId})`);
    return { statusCode: 200, body: JSON.stringify({ message: "Connected" }) };
  } catch (error) {
    console.error("WebSocket connect error:", error);
    return { statusCode: 500, body: JSON.stringify({ error: "Connection failed" }) };
  }
};
