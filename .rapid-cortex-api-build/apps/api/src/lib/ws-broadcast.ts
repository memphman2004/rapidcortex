/**
 * Agency WebSocket broadcast for AI gate (and other agency-scoped pushes).
 * Uses GSI2 on WEBSOCKET_CONNECTIONS_TABLE (AGENCY#agencyId).
 */

import {
  ApiGatewayManagementApiClient,
  GoneException,
  PostToConnectionCommand,
} from "@aws-sdk/client-apigatewaymanagementapi";
import type { AIGateModeChangeEvent } from "rapid-cortex-shared";
import { env } from "./env.js";
import { WebSocketConnectionRepository } from "../repositories/websocketConnectionRepository.js";

export type AgencyWSPayload =
  | AIGateModeChangeEvent
  | { type: string; [k: string]: unknown };

const connections = new WebSocketConnectionRepository();

function managementClient(): ApiGatewayManagementApiClient | null {
  const endpoint = env.websocketApiEndpoint?.trim() || process.env.WEBSOCKET_API_ENDPOINT?.trim();
  if (!endpoint) return null;
  return new ApiGatewayManagementApiClient({ endpoint });
}

/**
 * Broadcast a payload to all live WebSocket connections for an agency.
 * Failures are logged; never throws (callers use allSettled semantics).
 */
export async function broadcastToAgency(agencyId: string, payload: AgencyWSPayload): Promise<void> {
  const ws = managementClient();
  if (!ws) {
    console.info(JSON.stringify({ msg: "ws_broadcast_skipped_no_endpoint", agencyId }));
    return;
  }

  let rows: Awaited<ReturnType<typeof connections.listByAgencyId>> = [];
  try {
    rows = await connections.listByAgencyId(agencyId);
  } catch (err) {
    console.error(JSON.stringify({ msg: "ws_broadcast_list_error", agencyId, error: String(err) }));
    return;
  }

  // Envelope: { type, data } for web clients that expect AgencyWebSocketMessage shape.
  const { type, ...rest } = payload as { type: string } & Record<string, unknown>;
  const frame = Buffer.from(JSON.stringify({ type, data: rest }));

  await Promise.allSettled(
    rows.map(async (row) => {
      try {
        await ws.send(
          new PostToConnectionCommand({
            ConnectionId: row.connectionId,
            Data: frame,
          }),
        );
      } catch (err) {
        if (err instanceof GoneException || (err as { statusCode?: number }).statusCode === 410) {
          console.info(
            JSON.stringify({
              msg: "ws_stale_connection_skipped",
              connectionId: row.connectionId,
              agencyId,
            }),
          );
          try {
            await connections.deleteByConnectionId(row.connectionId);
          } catch {
            /* ignore cleanup failure */
          }
        } else {
          console.error(
            JSON.stringify({
              msg: "ws_broadcast_error",
              connectionId: row.connectionId,
              agencyId,
              error: String(err),
            }),
          );
        }
      }
    }),
  );
}
