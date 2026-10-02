import type { APIGatewayProxyWebsocketHandlerV2 } from "aws-lambda";
import { broadcastToAgency, sendWebSocketMessage } from "../../lib/websocket/send-message.js";
import { WebSocketConnectionRepository } from "../../repositories/websocketConnectionRepository.js";

const repo = new WebSocketConnectionRepository();

type GuestAssistEnvelope = {
  type?: string;
  data?: { text?: string; sessionId?: string };
};

export const handler: APIGatewayProxyWebsocketHandlerV2 = async (event) => {
  const connectionId = event.requestContext.connectionId;
  if (!connectionId) {
    return { statusCode: 500, body: "Missing connection id" };
  }

  let parsed: GuestAssistEnvelope = {};
  try {
    parsed = event.body ? (JSON.parse(event.body) as GuestAssistEnvelope) : {};
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: "Invalid JSON" }) };
  }

  if (parsed.type !== "guest-assist.staff.send" && parsed.type !== "guest-assist.staff.reply") {
    return { statusCode: 200, body: JSON.stringify({ message: "Default route" }) };
  }

  const row = await repo.findByConnectionId(connectionId);
  if (!row) {
    return { statusCode: 401, body: JSON.stringify({ error: "Unknown connection" }) };
  }

  const text = String(parsed.data?.text ?? "").trim();
  if (!text || text.length > 4000) {
    return { statusCode: 400, body: JSON.stringify({ error: "text is required" }) };
  }

  try {
    if (parsed.type === "guest-assist.staff.send") {
      if (row.role !== "GUEST_ASSIST") {
        return { statusCode: 403, body: JSON.stringify({ error: "Forbidden" }) };
      }
      const sessionId = row.userId.replace(/^guestassist#/, "");
      await broadcastToAgency({
        agencyId: row.agencyId,
        excludeUserId: row.userId,
        message: {
          type: "guest-assist.inbound",
          data: {
            sessionId,
            text,
            location: row.displayName,
            vertical: row.agencyId.startsWith("ga#") ? row.agencyId.slice(3) : "",
          },
        },
      });
      return { statusCode: 200, body: JSON.stringify({ ok: true }) };
    }

    if (row.role === "GUEST_ASSIST") {
      return { statusCode: 403, body: JSON.stringify({ error: "Forbidden" }) };
    }
    const sessionId = String(parsed.data?.sessionId ?? "").trim();
    if (!sessionId) {
      return { statusCode: 400, body: JSON.stringify({ error: "sessionId is required" }) };
    }
    await sendWebSocketMessage({
      userId: `guestassist#${sessionId}`,
      message: {
        type: "guest-assist.staff.message",
        data: { text, sessionId },
      },
    });
    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  } catch (error) {
    console.error("WebSocket guest-assist error:", error);
    return { statusCode: 500, body: JSON.stringify({ error: "Send failed" }) };
  }
};
