import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { ApiGatewayManagementApiClient, PostToConnectionCommand } from "@aws-sdk/client-apigatewaymanagementapi";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../lib/auth.js";
import { env } from "../lib/env.js";
import { resolveIncidentRead } from "../lib/incidentReadAccess.js";
import {
  badRequest,
  forbidden,
  notFound,
  ok,
  serverError,
  serviceUnavailable,
  unauthorized,
} from "../lib/response.js";
import { ResponderConnectionsRepository } from "../repositories/responderConnectionsRepository.js";

const repo = new ResponderConnectionsRepository();

function canAuthorizeAudio(role: string): boolean {
  return role === "dispatcher" || role === "supervisor" || role === "agencyadmin" || role === "rcsuperadmin" || role === "rcadmin";
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    if (!env.responderConnectionsTable) {
      return serviceUnavailable("Responder connections are not configured");
    }

    const user = await getUserContext(event);
    if (!user) return unauthorized();
    if (!isUserAccountActive(user)) return unauthorized(ACCOUNT_INACTIVE_MESSAGE);
    if (!canAuthorizeAudio(user.role)) return forbidden();

    const incidentId = event.pathParameters?.incidentId ?? event.pathParameters?.id;
    const connectionId = event.pathParameters?.connectionId;
    if (!incidentId || !connectionId) return badRequest("incidentId and connectionId required");

    const resolved = await resolveIncidentRead(incidentId, user);
    if (!resolved) return forbidden();
    if (user.role !== "rcsuperadmin" && user.agencyId !== resolved.incident.agencyId) {
      return forbidden();
    }

    const existing = await repo.get(connectionId);
    if (!existing || existing.incidentId !== incidentId || existing.agencyId !== resolved.incident.agencyId) {
      return notFound();
    }

    const updated = await repo.authorizeAudio(connectionId, incidentId, resolved.incident.agencyId);
    const streamArn = env.incidentAudioStreamArn;
    const audioStreamUnavailable = !streamArn;
    if (audioStreamUnavailable) {
      console.warn(
        JSON.stringify({
          type: "responder.audio_stream_unavailable",
          incidentId,
          agencyId: resolved.incident.agencyId,
          connectionId,
        }),
      );
    }

    const message = {
      type: "audio_authorized",
      data: {
        incidentId,
        streamArn: streamArn || null,
        sessionExpiry: new Date(Date.now() + 60 * 60_000).toISOString(),
        audioStreamUnavailable,
      },
    };

    const endpoint = env.websocketApiEndpoint?.trim();
    if (endpoint) {
      try {
        const client = new ApiGatewayManagementApiClient({ endpoint });
        await client.send(
          new PostToConnectionCommand({
            ConnectionId: connectionId,
            Data: Buffer.from(JSON.stringify(message)),
          }),
        );
      } catch (err) {
        console.warn(
          JSON.stringify({
            type: "responder.audio_authorize_push_failed",
            incidentId,
            agencyId: resolved.incident.agencyId,
            connectionId,
            error: String(err),
          }),
        );
      }
    }

    return ok({ connection: updated, audioStreamUnavailable });
  } catch (error) {
    console.error(
      JSON.stringify({
        type: "responder.audio_authorize_error",
        incidentId: event.pathParameters?.incidentId,
        agencyId: undefined,
        error: String(error),
      }),
    );
    return serverError();
  }
};
