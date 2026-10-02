import type { APIGatewayProxyWebsocketHandlerV2 } from "aws-lambda";
import { type TranslateWsInbound } from "rapid-cortex-shared";
import { env } from "../../lib/env.js";
import { processUtterance } from "../../translate/pipeline.js";
import { broadcastTranslate, sendTranslateToConnection } from "../../translate/broadcast.js";
import { translateStore } from "../../translate/store.js";
import { verifyTranslateWsToken } from "../../translate/ws-token.js";

function routeKey(event: { requestContext?: { routeKey?: string; eventType?: string } }): string {
  return event.requestContext?.routeKey || event.requestContext?.eventType || "";
}

function query(event: { queryStringParameters?: Record<string, string | undefined> | null }) {
  return event.queryStringParameters ?? {};
}

export const handler: APIGatewayProxyWebsocketHandlerV2 = async (event) => {
  const connectionId = event.requestContext.connectionId;
  if (!connectionId) return { statusCode: 500, body: "Missing connection id" };

  if (!env.enableRcTranslate || !env.translateConnectionsTable) {
    return { statusCode: 503, body: JSON.stringify({ error: "translate_disabled" }) };
  }

  const key = routeKey(event);

  try {
    if (key === "$connect") {
      const token = query(event).token ?? "";
      if (!token) return { statusCode: 401, body: JSON.stringify({ error: "missing_token" }) };
      const claims = await verifyTranslateWsToken(token);
      const session = await translateStore.getSession(claims.agencyId, claims.sessionId);
      if (!session || session.status === "CLOSED" || session.status === "EXPIRED") {
        return { statusCode: 403, body: JSON.stringify({ error: "session_unavailable" }) };
      }
      // WS JWT is already session- and agency-bound. Officer sockets must match officerId;
      // monitor tokens are issued only after HTTP RBAC.
      if (claims.wsRole === "officer" && session.officerId !== claims.sub) {
        return { statusCode: 403, body: JSON.stringify({ error: "forbidden" }) };
      }

      await translateStore.putConnection({
        connectionId,
        sessionId: session.sessionId,
        agencyId: session.agencyId,
        userId: claims.sub,
        wsRole: claims.wsRole,
        ttl: Math.floor(Date.now() / 1000) + 60 * 60 * 4,
      });

      if (claims.wsRole === "officer" && (session.status === "PENDING" || session.status === "PAUSED")) {
        const next = {
          ...session,
          status: "ACTIVE" as const,
          updatedAt: new Date().toISOString(),
        };
        await translateStore.putSession(next);
        await broadcastTranslate(session.sessionId, {
          type: "session_state",
          status: "ACTIVE",
          segmentCount: next.segmentCount,
        });
      }

      if (claims.wsRole === "monitor") {
        await broadcastTranslate(session.sessionId, {
          type: "monitor_joined",
          monitorUserName: "Monitor",
        });
      }

      return { statusCode: 200, body: JSON.stringify({ message: "Connected" }) };
    }

    if (key === "$disconnect") {
      const conn = await translateStore.getConnection(connectionId);
      if (conn) {
        await translateStore.deleteConnection(connectionId);
        const remaining = await translateStore.listConnections(conn.sessionId);
        if (conn.wsRole === "monitor") {
          await broadcastTranslate(conn.sessionId, {
            type: "monitor_left",
            monitorUserName: "Monitor",
          });
        }
        if (conn.wsRole === "officer" && !remaining.some((r) => r.wsRole === "officer")) {
          const session = await translateStore.getSession(conn.agencyId, conn.sessionId);
          if (session && session.status === "ACTIVE") {
            await translateStore.putSession({
              ...session,
              status: "PAUSED",
              updatedAt: new Date().toISOString(),
            });
            await broadcastTranslate(conn.sessionId, {
              type: "session_state",
              status: "PAUSED",
              segmentCount: session.segmentCount,
            });
          }
        }
      }
      return { statusCode: 200, body: JSON.stringify({ message: "Disconnected" }) };
    }

    const conn = await translateStore.getConnection(connectionId);
    if (!conn) return { statusCode: 403, body: JSON.stringify({ error: "unknown_connection" }) };

    let inbound: TranslateWsInbound;
    try {
      inbound = JSON.parse(event.body ?? "{}") as TranslateWsInbound;
    } catch {
      return { statusCode: 400, body: JSON.stringify({ error: "invalid_json" }) };
    }

    if (inbound.type === "ping") {
      await sendTranslateToConnection(connectionId, { type: "pong" });
      return { statusCode: 200, body: JSON.stringify({ ok: true }) };
    }

    const session = await translateStore.getSession(conn.agencyId, conn.sessionId);
    if (!session) return { statusCode: 404, body: JSON.stringify({ error: "session_not_found" }) };

    if (inbound.type === "phrase") {
      const result = await processUtterance({
        session,
        speaker: inbound.speaker,
        text: inbound.text,
        phraseId: inbound.phraseId,
        isFinal: true,
      });
      for (const msg of result.events) {
        await broadcastTranslate(conn.sessionId, msg);
      }
      return { statusCode: 200, body: JSON.stringify({ ok: true }) };
    }

    if (inbound.type === "audio_chunk") {
      if (conn.wsRole !== "officer") {
        return { statusCode: 403, body: JSON.stringify({ error: "monitors_are_listen_only" }) };
      }
      const result = await processUtterance({
        session,
        speaker: inbound.speaker,
        audioBase64: inbound.audioBase64,
        sampleRate: inbound.sampleRate,
        isFinal: inbound.isFinal,
      });
      for (const msg of result.events) {
        await broadcastTranslate(conn.sessionId, msg);
      }
      return { statusCode: 200, body: JSON.stringify({ ok: true }) };
    }

    return { statusCode: 400, body: JSON.stringify({ error: "unknown_type" }) };
  } catch (error) {
    console.error(
      JSON.stringify({
        type: "translate.ws.error",
        error: error instanceof Error ? error.message : String(error),
      }),
    );
    return { statusCode: 500, body: JSON.stringify({ error: "ws_failed" }) };
  }
};
