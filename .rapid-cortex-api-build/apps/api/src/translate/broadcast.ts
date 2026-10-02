import {
  ApiGatewayManagementApiClient,
  GoneException,
  PostToConnectionCommand,
} from "@aws-sdk/client-apigatewaymanagementapi";
import type { TranslateWsOutbound } from "rapid-cortex-shared";
import { env } from "../lib/env.js";
import { translateStore } from "./store.js";

function managementClient(): ApiGatewayManagementApiClient | null {
  const endpoint = env.translateWsApiEndpoint?.trim();
  if (!endpoint) return null;
  return new ApiGatewayManagementApiClient({ endpoint });
}

export async function sendTranslateToConnection(
  connectionId: string,
  message: TranslateWsOutbound,
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
      await translateStore.deleteConnection(connectionId);
    }
  }
}

export async function broadcastTranslate(sessionId: string, message: TranslateWsOutbound): Promise<void> {
  const client = managementClient();
  if (!client) return;
  const rows = await translateStore.listConnections(sessionId);
  await Promise.allSettled(
    rows.map(async (row) => {
      try {
        await client.send(
          new PostToConnectionCommand({
            ConnectionId: row.connectionId,
            Data: Buffer.from(JSON.stringify(message)),
          }),
        );
      } catch (e) {
        if (e instanceof GoneException || (e as { statusCode?: number }).statusCode === 410) {
          await translateStore.deleteConnection(row.connectionId);
        }
      }
    }),
  );
}
