import type { APIGatewayProxyWebsocketEventV2 } from "aws-lambda";
import type { UserContext } from "rapid-cortex-shared";
import { getUserContextFromIdToken } from "../auth.js";

/** API Gateway may send query params on $connect; @types/aws-lambda omits them on V2 websocket events. */
type WebSocketConnectEvent = APIGatewayProxyWebsocketEventV2 & {
  queryStringParameters?: Record<string, string | undefined> | null;
};

function tokenFromConnectEvent(event: WebSocketConnectEvent): string | null {
  const fromQuery = event.queryStringParameters?.token?.trim();
  if (fromQuery) return fromQuery;
  const hdr =
    (event as { headers?: Record<string, string | undefined> }).headers?.authorization ??
    (event as { headers?: Record<string, string | undefined> }).headers?.Authorization;
  const match = hdr?.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

/**
 * Resolve Cognito user for WebSocket $connect (token via query `token` or Authorization header).
 */
export async function getUserContextFromWebSocket(
  event: APIGatewayProxyWebsocketEventV2,
): Promise<UserContext | null> {
  const token = tokenFromConnectEvent(event as WebSocketConnectEvent);
  if (!token) return null;
  return getUserContextFromIdToken(token);
}
