import {
  ApiGatewayManagementApiClient,
  GoneException,
  PostToConnectionCommand,
} from "@aws-sdk/client-apigatewaymanagementapi";
import { env } from "../env.js";
import { WebSocketConnectionRepository } from "../../repositories/websocketConnectionRepository.js";

const connections = new WebSocketConnectionRepository();

export type WebSocketOutboundMessage = {
  type: string;
  data: Record<string, unknown>;
};

function managementClient(): ApiGatewayManagementApiClient | null {
  const endpoint = env.websocketApiEndpoint?.trim();
  if (!endpoint) return null;
  return new ApiGatewayManagementApiClient({ endpoint });
}

export async function sendWebSocketMessage(params: {
  userId: string;
  message: WebSocketOutboundMessage;
}): Promise<void> {
  if (!env.websocketConnectionsTable?.trim() || !env.websocketApiEndpoint?.trim()) {
    return;
  }
  const rows = await connections.listByUserId(params.userId);
  if (rows.length === 0) return;
  await Promise.allSettled(
    rows.map((row) => sendToConnection(row.connectionId, params.message)),
  );
}

export async function broadcastToAgency(params: {
  agencyId: string;
  message: WebSocketOutboundMessage;
  excludeUserId?: string;
}): Promise<void> {
  if (!env.websocketConnectionsTable?.trim() || !env.websocketApiEndpoint?.trim()) {
    return;
  }
  const rows = await connections.listByAgencyId(params.agencyId);
  const targets = params.excludeUserId
    ? rows.filter((r) => r.userId !== params.excludeUserId)
    : rows;
  if (targets.length === 0) return;
  await Promise.allSettled(
    targets.map((row) => sendToConnection(row.connectionId, params.message)),
  );
}

async function sendToConnection(
  connectionId: string,
  message: WebSocketOutboundMessage,
): Promise<void> {
  const client = managementClient();
  if (!client) return;
  try {
    await client.send(
      new PostToConnectionCommand({
        ConnectionId: connectionId,
        Data: Buffer.from(JSON.stringify(message)),
      }),
    );
  } catch (e) {
    if (e instanceof GoneException || (e as { statusCode?: number }).statusCode === 410) {
      await connections.deleteByConnectionId(connectionId);
      return;
    }
    throw e;
  }
}
